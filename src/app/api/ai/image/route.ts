import { NextRequest, NextResponse } from "next/server";
import { getOpenAIClient, isAIConfigured } from "@/lib/ai/config";
import { imageSchema, formatZodError } from "@/lib/validation";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

/**
 * Resposta do endpoint de geração de imagem.
 * - `imageUrl`: URL final a usar (Storage ou DALL-E como fallback)
 * - `storageUrl`: URL do Supabase Storage quando o upload foi bem-sucedido
 * - `fallback`: true quando o upload falhou e `imageUrl` é a URL temporária do DALL-E
 */
export interface ImageGenerationResponse {
  imageUrl: string;
  storageUrl?: string;
  fallback?: boolean;
}

export async function POST(request: NextRequest) {
  console.log("[image] OPENAI_API_KEY present:", !!process.env.OPENAI_API_KEY);

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

    // Extrair empresaId antes da validação do schema (campo extra, opcional)
    const empresaId: string | undefined =
      typeof body.empresaId === "string" && body.empresaId.trim()
        ? body.empresaId.trim()
        : undefined;

    // Input validation (prompt + size)
    const parsed = imageSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: formatZodError(parsed.error) },
        { status: 400 }
      );
    }

    const { prompt, size } = parsed.data;

    const openai = getOpenAIClient();

    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: `Professional social media graphic: ${prompt}. Clean modern design, high quality.`,
      n: 1,
      size: size as "1024x1024" | "1024x1792" | "1792x1024",
      quality: "standard",
    });

    const dalleUrl = response.data?.[0]?.url ?? null;

    if (!dalleUrl) {
      return NextResponse.json(
        { error: "DALL-E nao retornou uma URL valida. Tente novamente." },
        { status: 500 }
      );
    }

    // --- Tentar fazer upload para Supabase Storage (server-side, sem CORS) ---
    // Se empresaId nao foi fornecido ou Supabase nao esta configurado,
    // retorna URL do DALL-E diretamente (comportamento legado).
    if (!empresaId || !isSupabaseConfigured()) {
      console.warn(
        "[image] empresaId ausente ou Supabase nao configurado — retornando URL DALL-E diretamente.",
        { empresaId: !!empresaId, supabase: isSupabaseConfigured() }
      );
      return NextResponse.json({ imageUrl: dalleUrl } satisfies ImageGenerationResponse);
    }

    // Verificar que a empresa pertence ao usuário autenticado
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.warn("[image] Usuário não autenticado — retornando URL DALL-E.");
      return NextResponse.json({ imageUrl: dalleUrl } satisfies ImageGenerationResponse);
    }

    const { data: empresaRow, error: empresaError } = await supabase
      .from("empresas")
      .select("id")
      .eq("id", empresaId)
      .eq("user_id", user.id)
      .single();

    if (empresaError || !empresaRow) {
      console.warn("[image] Empresa não encontrada ou não pertence ao usuário — retornando URL DALL-E.");
      return NextResponse.json({ imageUrl: dalleUrl } satisfies ImageGenerationResponse);
    }

    // Baixar a imagem do DALL-E server-side (sem restrições de CORS)
    let imageBuffer: ArrayBuffer;
    try {
      const fetchRes = await fetch(dalleUrl);
      if (!fetchRes.ok) throw new Error(`fetch status ${fetchRes.status}`);
      imageBuffer = await fetchRes.arrayBuffer();
    } catch (fetchErr) {
      console.warn("[image] Falha ao baixar imagem DALL-E — fallback para URL direta:", fetchErr);
      return NextResponse.json({
        imageUrl: dalleUrl,
        fallback: true,
      } satisfies ImageGenerationResponse);
    }

    // Fazer upload para brand-assets bucket
    const storagePath = `${empresaId}/ai-generated/${crypto.randomUUID()}.png`;
    const { error: uploadError } = await supabase.storage
      .from("brand-assets")
      .upload(storagePath, imageBuffer, {
        contentType: "image/png",
        upsert: false,
      });

    if (uploadError) {
      console.warn("[image] Upload para Storage falhou — fallback para URL DALL-E:", uploadError.message);
      return NextResponse.json({
        imageUrl: dalleUrl,
        fallback: true,
      } satisfies ImageGenerationResponse);
    }

    const { data: publicData } = supabase.storage
      .from("brand-assets")
      .getPublicUrl(storagePath);

    const storageUrl = publicData?.publicUrl ?? null;

    if (!storageUrl) {
      console.warn("[image] getPublicUrl retornou null — fallback para URL DALL-E.");
      return NextResponse.json({
        imageUrl: dalleUrl,
        fallback: true,
      } satisfies ImageGenerationResponse);
    }

    console.log("[image] Upload concluído:", storageUrl);

    return NextResponse.json({
      imageUrl: storageUrl,
      storageUrl,
    } satisfies ImageGenerationResponse);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Falha ao gerar imagem. Tente novamente.";
    console.error("Image generation error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
