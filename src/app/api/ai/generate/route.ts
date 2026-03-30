import { NextRequest, NextResponse } from "next/server";
import { getOpenAIClient, isAIConfigured } from "@/lib/ai/config";
import { getPromptForFormat, getTemperature, getMaxTokens, getSystemPrompt } from "@/lib/ai/prompts";
import { generateSchema, formatZodError } from "@/lib/validation";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { checkDuplicate, addToHistory } from "@/lib/anti-duplicidade";
import type { GenerationRequest, GeneratedContent } from "@/types/ai";

export async function POST(request: NextRequest) {
  if (!isAIConfigured()) {
    return NextResponse.json({ error: "AI not configured" }, { status: 503 });
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

    const openai = getOpenAIClient();
    const prompt = getPromptForFormat(format, empresaContext, topic, tone, plataformas);

    const hasDNA = !!empresaContext?.dnaMarca;
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
    const empresaId = body.empresaContext?.nome || "unknown";
    const contentToCheck = generated.conteudo || generated.titulo || "";
    let duplicidade: { alerta: boolean; similaridade: string; postSimilar?: string } | undefined;

    if (contentToCheck) {
      const dupResult = checkDuplicate(empresaId, contentToCheck);
      if (dupResult.isDuplicate) {
        duplicidade = {
          alerta: true,
          similaridade: `${dupResult.similarity}%`,
          postSimilar: dupResult.similarPost,
        };
      }
      // Registrar no histórico independente de ser duplicado ou não
      addToHistory(empresaId, contentToCheck);
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
