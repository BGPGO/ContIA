/**
 * cut-refiner.ts — Pass 2 do pipeline two-pass de detecção de cortes virais.
 *
 * Recebe os candidatos brutos do Gemini (Pass 1) e os refina via Claude Sonnet 4.6:
 * - Reescreve títulos (max 50 chars, atraentes, em PT-BR)
 * - Reescreve hooks como a frase exata de abertura
 * - Recalcula viral_score com critérios editoriais mais rigorosos
 * - Filtra cortes com score < 50
 * - Limita a MAX_CUTS_PER_PODCAST (10) cortes finais
 */

import { getAnthropicClient } from "@/lib/ai/anthropic";
import { AI_MODELS, VIDEO_LIMITS } from "./constants";
import type { VideoCutV2, VideoCutCategory } from "@/types/video-pipeline";
import type { CutCandidate } from "./cut-detector";

// ---------------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------------

/**
 * Corte refinado — todos os campos de VideoCutV2 exceto os de render
 * (render_status, rendered_url, render_error, caption_style_id).
 * Esses campos são atribuídos pelo job-runner antes de persistir.
 */
export type RefinedCut = Omit<
  VideoCutV2,
  "id" | "rendered_url" | "render_status" | "render_error" | "caption_style_id"
>;

// ---------------------------------------------------------------------------
// Tipos internos da resposta Sonnet
// ---------------------------------------------------------------------------

interface SonnetCutItem {
  title: string;
  hook: string;
  start_time: number;
  end_time: number;
  viral_score: number;
  category: string;
  reason: string;
}

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

/**
 * Extrai o primeiro JSON array válido de um texto que pode conter markdown.
 */
function extractJsonArray(text: string): string {
  const trimmed = text.trim();

  // Remover markdown code fences se presentes
  if (trimmed.startsWith("```")) {
    const stripped = trimmed
      .replace(/^```json?\n?/m, "")
      .replace(/```\s*$/m, "")
      .trim();
    return stripped;
  }

  // Extrair primeiro array JSON da string (caso Sonnet adicione texto antes/depois)
  const match = trimmed.match(/\[[\s\S]*\]/);
  if (match) return match[0];

  return trimmed;
}

/**
 * Valida se uma string é uma VideoCutCategory válida.
 */
function toValidCategory(raw: string): VideoCutCategory {
  const valid: VideoCutCategory[] = [
    "humor",
    "insight",
    "controversy",
    "story",
    "emotion",
    "other",
  ];
  return valid.includes(raw as VideoCutCategory) ? (raw as VideoCutCategory) : "other";
}

/**
 * Monta o prompt para o Claude Sonnet 4.6.
 */
function buildSonnetPrompt(
  candidates: CutCandidate[],
  transcriptionContext: string
): string {
  const candidatesJson = JSON.stringify(
    candidates.map((c) => ({
      start_time: c.start_time,
      end_time: c.end_time,
      hook: c.hook,
      category: c.category,
      preliminary_score: c.preliminary_score,
      reason: c.reason,
      source_lens: c.source_lens,
    })),
    null,
    2
  );

  return `Você é um editor sênior de conteúdo viral em português brasileiro, especialista em Reels e TikTok.

Recebi candidatos brutos a cortes de podcast detectados por uma primeira passagem de IA. Sua missão é REFINAR esses cortes:

1. Para cada candidato, escreva um TÍTULO atrativo em PT-BR (max 50 caracteres, sem clickbait barato).
2. Reescreva o HOOK como a primeira frase exata que aparecerá no corte (max 100 chars).
3. Recalcule VIRAL_SCORE (0-100) com base em:
   - Força do hook nos primeiros 3 segundos
   - Auto-contenção (faz sentido sozinho?)
   - Densidade de informação ou emoção
   - Replay value (vale a pena assistir 2x?)
   - Compartilhabilidade ("vou mandar isso pro X")
4. Reescreva REASON em PT-BR explicando por que esse corte funciona (1-2 frases).
5. Mantenha CATEGORY do candidato.
6. NÃO altere start_time / end_time (preserve EXATOS).

Retorne JSON ARRAY ordenado por viral_score DESC, com no máximo ${VIDEO_LIMITS.MAX_CUTS_PER_PODCAST} cortes (descarte os mais fracos e todos com viral_score < 50).

Cada item:
{
  "title": "...",
  "hook": "...",
  "start_time": <preservar>,
  "end_time": <preservar>,
  "viral_score": <0-100>,
  "category": "<preservar>",
  "reason": "..."
}

CONTEXTO COMPLETO DA TRANSCRIÇÃO (use para entender o que aconteceu antes/depois de cada corte):
${transcriptionContext}

CANDIDATOS A REFINAR:
${candidatesJson}

Retorne APENAS o JSON array final, sem markdown.`;
}

// ---------------------------------------------------------------------------
// Função principal exportada
// ---------------------------------------------------------------------------

/**
 * Pass 2: pega os candidatos do Gemini e refina via Claude Sonnet 4.6.
 *
 * - Refina título, hook, viral_score e reason
 * - Filtra cortes com viral_score < 50
 * - Garante que start_time/end_time batem com os candidatos originais
 * - Limita a VIDEO_LIMITS.MAX_CUTS_PER_PODCAST cortes finais
 *
 * Retorna array de RefinedCut (sem id/render_status — atribuídos pelo job-runner).
 */
export async function refineCuts(opts: {
  candidates: CutCandidate[];
  transcriptionContext: string;
}): Promise<RefinedCut[]> {
  const { candidates, transcriptionContext } = opts;

  if (candidates.length === 0) {
    throw new Error("[cut-refiner] Nenhum candidato para refinar");
  }

  console.log(
    `[cut-refiner] Iniciando refinamento de ${candidates.length} candidatos via Sonnet 4.6`
  );

  const client = getAnthropicClient();
  const prompt = buildSonnetPrompt(candidates, transcriptionContext);

  const response = await client.messages.create({
    model: AI_MODELS.CUT_REFINER,
    max_tokens: 4000,
    temperature: 0.4,
    messages: [{ role: "user", content: prompt }],
  });

  // Extrair texto da resposta
  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("\n");

  if (!text) {
    throw new Error("[cut-refiner] Sonnet retornou resposta vazia");
  }

  // Parsear JSON
  let parsed: SonnetCutItem[];
  try {
    const jsonStr = extractJsonArray(text);
    parsed = JSON.parse(jsonStr) as SonnetCutItem[];
    if (!Array.isArray(parsed)) {
      throw new Error("resposta não é array");
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`[cut-refiner] Falha ao parsear resposta do Sonnet: ${msg}`);
  }

  console.log(`[cut-refiner] Sonnet retornou ${parsed.length} cortes antes da validação`);

  // Construir mapa de candidatos originais por start_time para validação
  const candidateMap = new Map<number, CutCandidate>();
  for (const c of candidates) {
    candidateMap.set(c.start_time, c);
  }

  // Validação pós-Sonnet
  const refined: RefinedCut[] = parsed
    .filter((item) => {
      // Descartar cortes com viral_score < 50
      if ((item.viral_score ?? 0) < 50) return false;

      // Verificar se start_time bate com algum candidato original (tolerância 1s)
      const hasMatch = candidates.some(
        (c) => Math.abs(c.start_time - item.start_time) <= 1
      );
      if (!hasMatch) {
        console.warn(
          `[cut-refiner] Corte com start_time=${item.start_time} não bate com candidatos originais — descartando`
        );
        return false;
      }

      return true;
    })
    .map((item): RefinedCut => {
      // Encontrar candidato original mais próximo para restaurar timestamps exatos
      let closestCandidate = candidates[0];
      let minDelta = Infinity;
      for (const c of candidates) {
        const delta = Math.abs(c.start_time - item.start_time);
        if (delta < minDelta) {
          minDelta = delta;
          closestCandidate = c;
        }
      }

      return {
        title: (item.title ?? "").slice(0, 50),
        hook: (item.hook ?? "").slice(0, 100),
        // Preservar timestamps exatos do candidato original
        start_time: closestCandidate.start_time,
        end_time: closestCandidate.end_time,
        viral_score: Math.max(0, Math.min(100, item.viral_score ?? 0)),
        category: toValidCategory(item.category ?? closestCandidate.category),
        reason: item.reason ?? closestCandidate.reason,
      };
    })
    // Reordenar por viral_score desc
    .sort((a, b) => b.viral_score - a.viral_score)
    // Limitar a MAX_CUTS_PER_PODCAST
    .slice(0, VIDEO_LIMITS.MAX_CUTS_PER_PODCAST);

  console.log(
    `[cut-refiner] ${refined.length} cortes finais após refinamento ` +
      `(scores: ${refined.map((r) => r.viral_score).join(", ")})`
  );

  return refined;
}
