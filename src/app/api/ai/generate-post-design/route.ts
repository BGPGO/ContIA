import { NextRequest, NextResponse } from "next/server";
import { getOpenAIClient, isAIConfigured } from "@/lib/ai/config";
import { generatePostDesignSchema, formatZodError } from "@/lib/validation";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import type { PostVisualStyle, EmpresaContext } from "@/types/ai";

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
    const parsed = generatePostDesignSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: formatZodError(parsed.error) },
        { status: 400 }
      );
    }

    const { topic, empresaContext, visualStyle, tone, format, additionalInstructions } = parsed.data;

    const openai = getOpenAIClient();

    const visualStyleDesc = visualStyle
      ? `
ESTILO VISUAL A REPLICAR:
- Layout: ${visualStyle.layout}
- Fundo: ${visualStyle.background?.type}, cores: ${visualStyle.background?.colors?.join(", ")}
- Overlay opacity: ${visualStyle.background?.overlay_opacity}
- Texto: posição ${visualStyle.text?.position}, container: ${visualStyle.text?.has_container ? "sim (" + visualStyle.text?.container_style + ")" : "não"}
- Fonte: ${visualStyle.text?.font_style}, tamanho título: ${visualStyle.text?.title_size}
- Cores do texto: ${visualStyle.text?.colors?.join(", ")}
- Elementos: ${visualStyle.elements?.join(", ")}
- Aspect ratio: ${visualStyle.aspect_ratio}
`
      : "";

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `Você é um designer de posts para redes sociais. Crie posts que REPLICAM o estilo visual do perfil analisado.
Você deve gerar um design estruturado que pode ser renderizado programaticamente.
${visualStyleDesc}
Responda APENAS em JSON válido.`,
        },
        {
          role: "user",
          content: `Empresa: ${empresaContext?.nome || ""}
Nicho: ${empresaContext?.nicho || ""}
Descrição: ${empresaContext?.descricao || ""}
${empresaContext?.siteAnalysis ? "Análise do site: " + empresaContext.siteAnalysis : ""}
${empresaContext?.instagramAnalysis ? "Análise do Instagram: " + empresaContext.instagramAnalysis : ""}

Tom: ${tone || "casual"}
Formato: ${format || "post"}
Tema: "${topic}"
${additionalInstructions ? "Instruções extras: " + additionalInstructions : ""}

Gere um post visual completo. Para CARROSSEL, gere 5-7 slides. Responda em JSON:
{
  "slides": [
    {
      "slideNumber": 1,
      "titulo": "texto principal do slide (curto, impactante, max 8 palavras)",
      "subtitulo": "texto secundário se necessário",
      "corpo": "texto complementar curto se for slide de conteúdo",
      "background": {
        "type": "image-darkened ou solid-color ou gradient",
        "colors": ["#hex1", "#hex2"],
        "overlay_opacity": 0.6,
        "image_prompt": "prompt em inglês para imagem de fundo profissional"
      },
      "text_layout": {
        "position": "center ou top ou bottom",
        "has_container": true,
        "container_color": "rgba(0,0,0,0.5)",
        "container_radius": 12,
        "title_color": "#ffffff",
        "title_size": 32,
        "subtitle_color": "#cccccc",
        "subtitle_size": 18,
        "font_weight": "bold"
      }
    }
  ],
  "legenda": "legenda completa do post com emojis",
  "hashtags": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5"],
  "cta": "call to action",
  "melhor_horario": "sugestão de horário para postar",
  "formato_recomendado": "1080x1080 ou 1080x1350"
}`,
        },
      ],
      temperature: 0.7,
      max_tokens: 3000,
    });

    const raw = completion.choices[0]?.message?.content || "{}";
    let clean = raw.trim();
    if (clean.startsWith("```")) clean = clean.replace(/```json?\n?/g, "").replace(/```$/g, "").trim();
    const design = JSON.parse(clean);

    return NextResponse.json(design);
  } catch (error: any) {
    console.error("Post design generation error:", error);
    return NextResponse.json({ error: error.message || "Design generation failed" }, { status: 500 });
  }
}
