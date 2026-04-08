import { NextRequest, NextResponse } from "next/server";
import { getOpenAIClient, isAIConfigured } from "@/lib/ai/config";
import { getPromptForFormat, getTemperature, getMaxTokens, getSystemPrompt } from "@/lib/ai/prompts";
import { generateSchema, formatZodError } from "@/lib/validation";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { checkDuplicate, addToHistory } from "@/lib/anti-duplicidade";
import type { GenerationRequest, GeneratedContent } from "@/types/ai";

export async function POST(request: NextRequest) {
  console.log("[generate] OPENAI_API_KEY present:", !!process.env.OPENAI_API_KEY);

  if (!isAIConfigured()) {
    return NextResponse.json(
      { error: "OpenAI API nao configurada. Verifique a variavel OPENAI_API_KEY no servidor." },
      { status: 503 }
    );
  }

  // Rate limiting
  const clientIp = getClientIp(request);
  if (!checkRateLimit(clientIp, "generate")) {
    return NextResponse.json(
      { error: "Limite de requisicoes excedido. Tente novamente em 1 minuto." },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();

    // Input validation
    const parsed = generateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: formatZodError(parsed.error) },
        { status: 400 }
      );
    }

    const { format, topic, empresaContext, plataformas, tone } = parsed.data as GenerationRequest;
    const empresaId: string | undefined = body.empresa_id;

    // Enrich context with style profile + real Instagram captions
    let enrichedContext = { ...empresaContext };

    if (empresaId) {
      // 1. Fetch style profile (pattern analysis from real posts)
      try {
        const { analyzePostPatterns } = await import("@/lib/ai/pattern-analyzer");
        const styleProfile = await analyzePostPatterns(empresaId);
        enrichedContext.styleProfile = JSON.stringify(styleProfile);
        console.log("[generate] Style profile loaded:", styleProfile.analyzed_posts_count, "posts analyzed");
      } catch (err) {
        console.warn("[generate] Style profile not available:", (err as Error).message);
      }

      // 2. Fetch real Instagram captions directly for injection
      try {
        const { createClient } = await import("@/lib/supabase/server");
        const supabase = await createClient();
        const { data: realPosts } = await supabase
          .from("instagram_media_cache")
          .select("caption, media_type, like_count, comments_count")
          .eq("empresa_id", empresaId)
          .order("like_count", { ascending: false })
          .limit(10);

        if (realPosts?.length) {
          const captions = realPosts
            .filter((p: any) => p.caption && p.caption.length > 30)
            .slice(0, 7)
            .map((p: any) => p.caption);

          if (captions.length > 0) {
            // Inject real captions into the context as instagramAnalysis override
            enrichedContext.instagramAnalysis = JSON.stringify({
              _realCaptions: captions,
              _source: "instagram_media_cache",
              _count: captions.length,
            });
            console.log("[generate] Injected", captions.length, "real Instagram captions");
          }
        }
      } catch (err) {
        console.warn("[generate] Could not fetch real captions:", (err as Error).message);
      }
    }

    const openai = getOpenAIClient();
    const prompt = getPromptForFormat(format, enrichedContext, topic, tone, plataformas);

    const hasDNA = !!enrichedContext?.dnaMarca;
    const systemPrompt = getSystemPrompt(hasDNA);
    const temperature = getTemperature(format, tone);
    const maxTokens = getMaxTokens(format);

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
      temperature,
      max_tokens: maxTokens,
    });

    const rawContent = completion.choices[0]?.message?.content || "{}";

    // Try to parse JSON, handling potential markdown wrapping
    let cleanJson = rawContent.trim();
    if (cleanJson.startsWith("```")) {
      cleanJson = cleanJson.replace(/```json?\n?/g, "").replace(/```$/g, "").trim();
    }

    const generated: GeneratedContent = JSON.parse(cleanJson);

    // Anti-duplicidade: verificar similaridade com posts anteriores
    const empresaKey = body.empresaContext?.nome || "unknown";
    const contentToCheck = generated.conteudo || generated.titulo || "";
    let duplicidade: { alerta: boolean; similaridade: string; postSimilar?: string } | undefined;

    if (contentToCheck) {
      const dupResult = checkDuplicate(empresaKey, contentToCheck);
      if (dupResult.isDuplicate) {
        duplicidade = {
          alerta: true,
          similaridade: `${dupResult.similarity}%`,
          postSimilar: dupResult.similarPost,
        };
      }
      // Registrar no histórico independente de ser duplicado ou não
      addToHistory(empresaKey, contentToCheck);
    }

    return NextResponse.json({
      ...generated,
      ...(duplicidade ? { duplicidade } : {}),
    });
  } catch (error: any) {
    console.error("AI generation error:", error);
    return NextResponse.json(
      { error: error.message || "Generation failed" },
      { status: 500 }
    );
  }
}
