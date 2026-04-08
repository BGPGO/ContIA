export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

/**
 * POST /api/video/analyze-cuts
 * Analyzes transcription with GPT to generate intelligent video summary + contextual cuts
 */
export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY not configured" }, { status: 503 });
  }

  try {
    const { transcription, duration, title } = await req.json();

    if (!transcription || !Array.isArray(transcription) || transcription.length === 0) {
      return NextResponse.json({ error: "Transcription required" }, { status: 400 });
    }

    const openai = new OpenAI({ apiKey });

    // Build transcription text with timestamps
    const transcriptText = transcription
      .map((s: { start: number; end: number; text: string }) =>
        `[${formatTime(s.start)} - ${formatTime(s.end)}] ${s.text}`
      )
      .join("\n");

    const result = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      temperature: 0.6,
      max_tokens: 2000,
      messages: [
        {
          role: "system",
          content: `Voce e um especialista em conteudo para redes sociais (Instagram Reels, TikTok, YouTube Shorts).
Sua missao e analisar a transcricao de um video e retornar:

1. Um RESUMO inteligente do video (2-3 frases)
2. O TIPO do video (tutorial, opiniao, storytelling, vendas, entretenimento, educacional, motivacional, vlogs, etc.)
3. O POTENCIAL VIRAL (1-10) com justificativa curta
4. PONTOS FORTES do conteudo (2-3 bullets)
5. SUGESTOES DE CORTES contextualizadas ao tipo de conteudo:
   - Para TUTORIAL: cortes por etapa/dica
   - Para OPINIAO: cortes por argumento forte
   - Para STORYTELLING: cortes por momento emocional
   - Para VENDAS: cortes por beneficio/prova social
   - Para ENTRETENIMENTO: cortes por piada/momento engracante
   - Cada corte com: titulo criativo, startTime, endTime (segundos), descricao do porque desse corte, potencial_viral (1-10)

REGRAS:
- Sugira entre 2 e 6 cortes dependendo da duracao e qualidade do conteudo
- Cortes devem ter entre 15-90 segundos (ideal pra Reels/TikTok)
- Priorize momentos com HOOK forte (primeiros segundos cativantes)
- Cada corte deve funcionar SOZINHO, sem contexto do resto do video
- Timestamps devem ser EXATOS baseados na transcricao fornecida
- Se o video for curto (<60s), pode sugerir 1-2 cortes ou nenhum (e explicar que ja e curto o suficiente)

Responda em JSON:
{
  "summary": "string",
  "type": "string",
  "viral_potential": { "score": number, "reason": "string" },
  "strengths": ["string"],
  "cuts": [
    {
      "title": "string (criativo e chamativo)",
      "startTime": number,
      "endTime": number,
      "description": "string (porque esse corte funciona)",
      "viral_score": number
    }
  ]
}`,
        },
        {
          role: "user",
          content: `Titulo: "${title || "Video"}"
Duracao: ${Math.round(duration || 0)} segundos

TRANSCRICAO COMPLETA:
${transcriptText}`,
        },
      ],
    });

    const content = result.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json({ error: "Empty AI response" }, { status: 500 });
    }

    const analysis = JSON.parse(content);
    return NextResponse.json(analysis);
  } catch (err) {
    console.error("[analyze-cuts] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Analysis failed" },
      { status: 500 }
    );
  }
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
