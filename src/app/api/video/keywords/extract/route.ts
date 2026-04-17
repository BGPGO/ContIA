export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOpenAIClient, isAIConfigured } from "@/lib/ai/config";
import type { Keyword } from "@/types/captions";

// ═══════════════════════════════════════════════════════════════════════
// POST /api/video/keywords/extract
// Detects highlight keywords in transcription text via GPT-4o-mini.
// ═══════════════════════════════════════════════════════════════════════

interface ExtractBody {
  transcription_text: string;
  word_timestamps?: Array<{ word: string; start: number; end: number; confidence?: number }>;
  language?: string;
}

const SYSTEM_PROMPT = `Você é especialista em marketing de conteúdo para redes sociais (Instagram Reels, TikTok, YouTube Shorts).
Analise o texto transcrito de um vídeo em PT-BR e identifique as PALAVRAS que devem ter destaque visual animado na legenda.

Critérios para destacar:
- Palavras emocionais fortes (incrível, transformou, nunca, absurdo, perfeito, único)
- Números e percentuais (300%, 10x, R$5.000, 50 mil)
- Verbos de ação impactantes (descubra, pare, faça, transforme, evite)
- Nomes próprios de marcas, produtos, pessoas
- Superlativos e intensificadores (maior, melhor, pior, sempre, jamais)

Regras:
- Máximo 30% das palavras do texto
- Não destaque stop words (de, para, com, que, etc.)
- Priorize qualidade sobre quantidade

Retorne APENAS JSON no formato:
{
  "keywords": [
    { "word": "incrível", "importance": 3, "emoji": "🔥" },
    { "word": "300%", "importance": 3, "emoji": "📈" },
    { "word": "descubra", "importance": 2 }
  ]
}

Importance: 3 = máximo (palavras de pico emocional), 2 = médio, 1 = leve.
Emoji é opcional — só adicione quando agregar forte relevância visual.`;

function isValidKeyword(k: unknown): k is Keyword {
  if (!k || typeof k !== "object") return false;
  const obj = k as Record<string, unknown>;
  return (
    typeof obj.word === "string" &&
    obj.word.trim().length > 0 &&
    (obj.importance === 1 || obj.importance === 2 || obj.importance === 3)
  );
}

function heuristicFallback(text: string): Keyword[] {
  const words = text
    .split(/\s+/)
    .map((w) => w.replace(/[^a-zA-ZÀ-ÿ0-9%$.,]/g, ""))
    .filter((w) => w.length >= 5);

  const uniqueWords = Array.from(new Set(words));
  return uniqueWords
    .sort((a, b) => b.length - a.length)
    .slice(0, 3)
    .map((word) => ({ word, importance: 2 as const }));
}

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
    }

    // Parse and validate body
    let body: ExtractBody;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Body JSON invalido" }, { status: 400 });
    }

    const { transcription_text } = body;

    if (!transcription_text || typeof transcription_text !== "string" || !transcription_text.trim()) {
      return NextResponse.json(
        { error: "transcription_text e obrigatorio e nao pode ser vazio" },
        { status: 400 }
      );
    }

    // Fallback heuristic if OpenAI not configured
    if (!isAIConfigured()) {
      const keywords = heuristicFallback(transcription_text);
      return NextResponse.json({ keywords });
    }

    const openai = getOpenAIClient();

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Texto: "${transcription_text.trim()}"` },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    const raw = completion.choices[0]?.message?.content ?? "";

    let keywords: Keyword[] = [];
    try {
      const parsed = JSON.parse(raw);
      const raw_keywords: unknown[] = Array.isArray(parsed.keywords) ? parsed.keywords : [];
      keywords = raw_keywords.filter(isValidKeyword);
    } catch {
      // If JSON parsing fails, use heuristic
      keywords = heuristicFallback(transcription_text);
    }

    return NextResponse.json({ keywords });
  } catch (error: unknown) {
    console.error("[video/keywords/extract] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro interno" },
      { status: 500 }
    );
  }
}
