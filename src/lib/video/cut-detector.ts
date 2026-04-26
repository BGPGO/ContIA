/**
 * cut-detector.ts — Pass 1 do pipeline two-pass de detecção de cortes virais.
 *
 * Usa Gemini 2.5 Flash com 5 "lenses" especializadas em paralelo para varrer
 * a transcrição completa e propor candidatos a cortes virais.
 *
 * Estratégia:
 *   5 lenses × até 10 candidatos = 50 potenciais
 *   Após dedup por overlap (>50%) e validação de duração → top 30
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { AI_MODELS, VIDEO_LIMITS } from "./constants";
import type { TranscriptionSegment } from "@/types/video";

// ---------------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------------

export type CutLens = "humor" | "insight" | "controversy" | "story" | "emotion";

export interface CutCandidate {
  start_time: number;
  end_time: number;
  /** Primeira frase ou descrição curta que aparece no corte. */
  hook: string;
  category: "humor" | "insight" | "controversy" | "story" | "emotion" | "other";
  /** Score 0-100 dado pela IA nessa lens específica. */
  preliminary_score: number;
  /** Por que esse momento foi escolhido pela lens. */
  reason: string;
  /** Qual lens originou este candidato. */
  source_lens: CutLens;
}

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

/** Formata segundos como "MM:SS". */
function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Snaps um timestamp para o segment mais próximo da transcrição. */
function snapToNearestSegment(
  time: number,
  segments: TranscriptionSegment[],
  mode: "start" | "end"
): number {
  if (segments.length === 0) return time;

  let best = segments[0];
  let bestDelta = Infinity;

  for (const seg of segments) {
    const segTime = mode === "start" ? seg.start : seg.end;
    const delta = Math.abs(segTime - time);
    if (delta < bestDelta) {
      bestDelta = delta;
      best = seg;
    }
  }

  return mode === "start" ? best.start : best.end;
}

/**
 * Calcula a sobreposição entre dois intervalos [a1,a2] e [b1,b2].
 * Retorna fração de sobreposição relativa ao intervalo menor.
 */
function overlapFraction(
  a1: number,
  a2: number,
  b1: number,
  b2: number
): number {
  const overlapStart = Math.max(a1, b1);
  const overlapEnd = Math.min(a2, b2);
  if (overlapEnd <= overlapStart) return 0;
  const overlapLen = overlapEnd - overlapStart;
  const minLen = Math.min(a2 - a1, b2 - b1);
  return minLen > 0 ? overlapLen / minLen : 0;
}

/** Descrição em PT-BR de cada lens. */
function lensDescription(lens: CutLens): string {
  switch (lens) {
    case "humor":
      return "momentos engraçados, piadas, situações cômicas, risadas, ironias";
    case "insight":
      return 'insights profundos, sacadas, frases que ensinam algo, "aha moments"';
    case "controversy":
      return "opiniões polêmicas, afirmações ousadas, debates, discordâncias";
    case "story":
      return "histórias bem contadas, narrativas com começo/meio/fim, anedotas pessoais";
    case "emotion":
      return "momentos de vulnerabilidade, emoção forte, intimidade, autenticidade";
  }
}

/** Monta o prompt especializado para uma lens. */
function buildLensPrompt(
  lens: CutLens,
  transcriptText: string,
  durationMinutes: number
): string {
  return `Você é um editor especialista em cortes virais para Reels e Shorts em português brasileiro.

Sua missão é encontrar momentos de ${lens.toUpperCase()} neste podcast brasileiro de ${durationMinutes.toFixed(0)} minutos.

TIPO DE MOMENTO: ${lensDescription(lens)}

Critérios para um bom corte (TODOS devem se aplicar):
1. Hook nos primeiros 3 segundos: a primeira frase precisa fisgar
2. Auto-contido: faz sentido SEM contexto anterior
3. Duração entre ${VIDEO_LIMITS.CUT_MIN_DURATION_S}s e ${VIDEO_LIMITS.CUT_MAX_DURATION_S}s
4. Termina com punchline, conclusão clara, pergunta retórica ou cliffhanger
5. Linguagem natural e impacto emocional/intelectual

Retorne JSON ARRAY com até 10 momentos do tipo ${lens.toUpperCase()}. Se não houver, retorne array vazio [].

Cada item deve ter exatamente esta estrutura:
{
  "start_time": <segundos numéricos>,
  "end_time": <segundos numéricos>,
  "hook": "<primeira frase falada no corte, max 100 chars>",
  "category": "${lens}",
  "preliminary_score": <0-100, quão viral você acha>,
  "reason": "<1-2 frases explicando POR QUÊ esse momento funciona>"
}

ATENÇÃO: timestamps DEVEM existir na transcrição. Não invente. Use os [MM:SS] como referência e converta para segundos.

TRANSCRIÇÃO:
${transcriptText}

Retorne APENAS o JSON array, sem markdown, sem comentários.`;
}

// ---------------------------------------------------------------------------
// Chamada Gemini por lens
// ---------------------------------------------------------------------------

/**
 * Chama Gemini 2.5 Flash com um prompt específico de lens.
 * Em caso de erro (timeout, parse, etc.), retorna array vazio e loga warning.
 */
async function callGeminiLens(
  lens: CutLens,
  transcriptText: string,
  durationMinutes: number
): Promise<{ lens: CutLens; candidates: CutCandidate[]; error?: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY não configurada");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: AI_MODELS.CUT_DETECTOR,
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.7,
    },
  });

  const prompt = buildLensPrompt(lens, transcriptText, durationMinutes);

  try {
    const result = await model.generateContent(prompt);
    const json = result.response.text();

    // Limpar markdown se presente
    let cleaned = json.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```json?\n?/m, "").replace(/```\s*$/m, "").trim();
    }

    const parsed = JSON.parse(cleaned) as unknown;
    if (!Array.isArray(parsed)) {
      console.warn(`[cut-detector] Lens ${lens}: resposta não é array, ignorando`);
      return { lens, candidates: [], error: "resposta não é array" };
    }

    const candidates: CutCandidate[] = (parsed as CutCandidate[]).map((c) => ({
      ...c,
      source_lens: lens,
      category: lens, // garante que category bate com a lens
    }));

    console.log(`[cut-detector] Lens ${lens}: ${candidates.length} candidato(s) encontrado(s)`);
    return { lens, candidates };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[cut-detector] Lens ${lens} falhou: ${msg}`);
    return { lens, candidates: [], error: msg };
  }
}

// ---------------------------------------------------------------------------
// Função principal exportada
// ---------------------------------------------------------------------------

/**
 * Pass 1: chama Gemini 2.5 Flash com 5 prompts especializados em paralelo.
 *
 * Cada lens retorna até 10 candidatos. Mescla, deduplica overlaps (>50% de
 * sobreposição = mesmo trecho → mantém maior score), valida duração e retorna
 * até 30 únicos rankeados por preliminary_score desc.
 */
export async function detectCutCandidates(opts: {
  transcriptionText: string;
  segments: TranscriptionSegment[];
  durationSeconds: number;
}): Promise<CutCandidate[]> {
  const { transcriptionText, segments, durationSeconds } = opts;
  const durationMinutes = durationSeconds / 60;

  const lenses: CutLens[] = ["humor", "insight", "controversy", "story", "emotion"];

  console.log(
    `[cut-detector] Iniciando detecção com ${lenses.length} lenses em paralelo ` +
      `(podcast de ${durationMinutes.toFixed(1)}min, ${segments.length} segments)`
  );

  // Chamadas em paralelo — uma por lens
  const results = await Promise.all(
    lenses.map((lens) => callGeminiLens(lens, transcriptionText, durationMinutes))
  );

  // Verificar se todas falharam
  const allFailed = results.every((r) => r.error !== undefined && r.candidates.length === 0);
  if (allFailed) {
    throw new Error(
      "[cut-detector] Todas as 5 lenses falharam — verifique GEMINI_API_KEY e conectividade"
    );
  }

  // Mesclar todos os candidatos
  const allCandidates: CutCandidate[] = results.flatMap((r) => r.candidates);
  console.log(`[cut-detector] Total bruto antes de dedup: ${allCandidates.length} candidatos`);

  // Validação: descartar com duração fora dos limites ou timestamps inválidos
  const validated: CutCandidate[] = allCandidates
    .filter((c) => {
      const dur = c.end_time - c.start_time;
      if (dur < VIDEO_LIMITS.CUT_MIN_DURATION_S || dur > VIDEO_LIMITS.CUT_MAX_DURATION_S) {
        return false;
      }
      if (c.start_time < 0 || c.end_time > durationSeconds) {
        return false;
      }
      if (c.start_time >= c.end_time) {
        return false;
      }
      return true;
    })
    .map((c) => {
      // Snap timestamps para segmentos reais da transcrição
      const snappedStart = snapToNearestSegment(c.start_time, segments, "start");
      const snappedEnd = snapToNearestSegment(c.end_time, segments, "end");
      return { ...c, start_time: snappedStart, end_time: snappedEnd };
    });

  console.log(`[cut-detector] Após validação de duração/bounds: ${validated.length} candidatos`);

  // Ordenar por score desc para facilitar dedup (mantemos sempre o maior)
  validated.sort((a, b) => b.preliminary_score - a.preliminary_score);

  // Dedup por overlap >50%
  const deduped: CutCandidate[] = [];
  for (const candidate of validated) {
    const hasOverlap = deduped.some((existing) => {
      const fraction = overlapFraction(
        existing.start_time,
        existing.end_time,
        candidate.start_time,
        candidate.end_time
      );
      return fraction > 0.5;
    });

    if (!hasOverlap) {
      deduped.push(candidate);
    }
    // Se há overlap, descartamos (já temos um com score >= pois ordenamos desc)
  }

  console.log(`[cut-detector] Após dedup por overlap: ${deduped.length} candidatos únicos`);

  // Retornar top 30
  const top30 = deduped.slice(0, 30);

  console.log(
    `[cut-detector] Retornando ${top30.length} candidatos (scores: ` +
      `${top30.map((c) => c.preliminary_score).join(", ")})`
  );

  return top30;
}

// ---------------------------------------------------------------------------
// Helper exportado: formata transcrição com timestamps para uso nos prompts
// ---------------------------------------------------------------------------

/**
 * Formata os segmentos da transcrição em blocos "[MM:SS] texto" para envio ao Gemini.
 */
export function formatTranscriptWithTimestamps(
  segments: TranscriptionSegment[]
): string {
  return segments
    .map((s) => `[${formatTimestamp(s.start)}] ${s.text.trim()}`)
    .join("\n");
}
