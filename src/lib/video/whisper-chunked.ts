/**
 * whisper-chunked.ts — Transcrição paralela de chunks de áudio via Whisper API.
 *
 * Recebe lista de AudioChunk (produzida pelo audio-extractor.ts do Squad Delta),
 * transcreve em paralelo com concorrência = WHISPER_PARALLEL_CONCURRENCY (3),
 * aplica offset de timestamps e merge com deduplicação de boundary.
 */

import OpenAI from 'openai';
import { createReadStream } from 'fs';
import { AI_MODELS, VIDEO_LIMITS } from './constants';
import type { TranscriptionSegment, WordTimestamp } from '@/types/video';
import type { AudioChunk } from './audio-extractor';

// Re-export para que importadores de whisper-chunked não precisem conhecer audio-extractor
export type { AudioChunk };

// ---------------------------------------------------------------------------
// Tipos internos
// ---------------------------------------------------------------------------

interface WhisperChunkResult {
  chunkIndex: number;
  startTimeSeconds: number;
  durationSeconds: number;
  /** Segmentos já com offset aplicado. */
  segments: TranscriptionSegment[];
  /** Words já com offset aplicado. */
  words: WordTimestamp[];
  language: string;
}

// ---------------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------------

export interface ChunkedTranscriptionResult {
  fullText: string;
  segments: TranscriptionSegment[];
  words: WordTimestamp[];
  language: string;
  totalDurationSeconds: number;
  chunksTranscribed: number;
}

// ---------------------------------------------------------------------------
// Função principal
// ---------------------------------------------------------------------------

/**
 * Transcreve N chunks de áudio em paralelo (concorrência 3) usando Whisper API.
 * Aplica offset de timestamp em cada segment e word baseado no startTimeSeconds do chunk.
 *
 * - Em caso de falha de UM chunk, faz retry 1x antes de propagar erro.
 * - Merge final: ordena por startTimeSeconds, mantém continuidade.
 * - Resolve duplicações: se chunks têm overlap por causa de boundary fuzzy, deduplica
 *   pegando o maior segment quando timestamps batem com tolerância 0.3s.
 *
 * Throw com mensagem clara se algum chunk falhar permanentemente.
 */
export async function transcribeChunked(opts: {
  chunks: AudioChunk[];
  language?: string;
  onChunkComplete?: (chunkIndex: number, totalChunks: number) => void;
}): Promise<ChunkedTranscriptionResult> {
  const { chunks, language = 'pt', onChunkComplete } = opts;

  if (chunks.length === 0) {
    throw new Error('[whisper-chunked] Nenhum chunk de áudio fornecido para transcrição.');
  }

  const concurrency = VIDEO_LIMITS.WHISPER_PARALLEL_CONCURRENCY;
  const results: WhisperChunkResult[] = new Array(chunks.length);

  // Processa em batches de `concurrency` chunks em paralelo
  for (let i = 0; i < chunks.length; i += concurrency) {
    const batch = chunks.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map((chunk) => transcribeChunkWithRetry(chunk, language))
    );
    for (let j = 0; j < batch.length; j++) {
      results[i + j] = batchResults[j];
      onChunkComplete?.(i + j + 1, chunks.length);
    }
  }

  // Ordenar por startTimeSeconds (segurança — já deve estar ordenado)
  results.sort((a, b) => a.startTimeSeconds - b.startTimeSeconds);

  // Merge com deduplicação de boundary
  const mergedSegments = mergeSegments(results);
  const mergedWords = mergeWords(results);

  // fullText: junta todos os texts dos segments
  const fullText = mergedSegments.map((s) => s.text).join(' ').trim();

  // Duração total: maior end entre segments, ou soma das durações
  const totalDurationSeconds =
    mergedSegments.length > 0
      ? mergedSegments[mergedSegments.length - 1].end
      : results.reduce((acc, r) => acc + r.durationSeconds, 0);

  // Language: pega a do primeiro chunk (todos devem ser iguais)
  const detectedLanguage = results[0]?.language ?? language;

  return {
    fullText,
    segments: mergedSegments,
    words: mergedWords,
    language: detectedLanguage,
    totalDurationSeconds,
    chunksTranscribed: chunks.length,
  };
}

// ---------------------------------------------------------------------------
// Transcrição com retry
// ---------------------------------------------------------------------------

async function transcribeChunkWithRetry(
  chunk: AudioChunk,
  language: string
): Promise<WhisperChunkResult> {
  try {
    return await transcribeChunk(chunk, language);
  } catch (firstErr: unknown) {
    const isRetryable = isNetworkOrServerError(firstErr);
    if (!isRetryable) {
      const msg = firstErr instanceof Error ? firstErr.message : String(firstErr);
      throw new Error(
        `[whisper-chunked] Chunk ${chunk.index} falhou permanentemente (erro não retentável): ${msg}`
      );
    }

    console.warn(
      `[whisper-chunked] Chunk ${chunk.index} falhou na 1ª tentativa, aguardando 2s para retry...`
    );
    await sleep(2000);

    try {
      return await transcribeChunk(chunk, language);
    } catch (secondErr: unknown) {
      const msg = secondErr instanceof Error ? secondErr.message : String(secondErr);
      throw new Error(
        `[whisper-chunked] Chunk ${chunk.index} falhou após retry. Não é possível continuar: ${msg}`
      );
    }
  }
}

function isNetworkOrServerError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  // Erros de rede
  if (
    msg.includes('econnreset') ||
    msg.includes('etimedout') ||
    msg.includes('enotfound') ||
    msg.includes('socket') ||
    msg.includes('network')
  ) {
    return true;
  }
  // Erros 5xx da API
  if (/5\d{2}/.test(msg) || msg.includes('server error') || msg.includes('internal server')) {
    return true;
  }
  // Status code 5xx via openai sdk
  if ('status' in err && typeof (err as { status: unknown }).status === 'number') {
    const status = (err as { status: number }).status;
    return status >= 500 && status < 600;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Chamada Whisper
// ---------------------------------------------------------------------------

async function transcribeChunk(
  chunk: AudioChunk,
  language: string
): Promise<WhisperChunkResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('[whisper-chunked] OPENAI_API_KEY não configurada.');
  }

  const openai = new OpenAI({ apiKey });

  const transcription = await openai.audio.transcriptions.create({
    file: createReadStream(chunk.path) as Parameters<typeof openai.audio.transcriptions.create>[0]['file'],
    model: AI_MODELS.WHISPER,
    response_format: 'verbose_json',
    timestamp_granularities: ['word', 'segment'],
    language: language ?? 'pt',
    temperature: 0.2,
    prompt:
      'Transcreva a fala com precisão, ignorando música de fundo. Mantenha pontuação correta.',
  });

  // verbose_json retorna campos extras não tipados pelo SDK
  const data = transcription as unknown as {
    text?: string;
    language?: string;
    duration?: number;
    segments?: Array<{
      id?: number;
      start: number;
      end: number;
      text: string;
    }>;
    words?: Array<{
      word: string;
      start: number;
      end: number;
    }>;
  };

  const rawSegments = data.segments ?? [];
  const rawWords = data.words ?? [];

  // Aplicar offset de timestamp
  const offsetSegments: TranscriptionSegment[] = rawSegments.map((s, idx) => ({
    id: `seg-${chunk.index}-${s.id ?? idx}`,
    start: s.start + chunk.startTimeSeconds,
    end: s.end + chunk.startTimeSeconds,
    text: s.text,
  }));

  const offsetWords: WordTimestamp[] = rawWords.map((w) => ({
    word: w.word,
    start: w.start + chunk.startTimeSeconds,
    end: w.end + chunk.startTimeSeconds,
  }));

  console.log(
    `[whisper-chunked] chunk ${chunk.index + 1}/? ok (${offsetSegments.length} segs, ${offsetWords.length} words)`
  );

  return {
    chunkIndex: chunk.index,
    startTimeSeconds: chunk.startTimeSeconds,
    durationSeconds: chunk.durationSeconds,
    segments: offsetSegments,
    words: offsetWords,
    language: data.language ?? language,
  };
}

// ---------------------------------------------------------------------------
// Merge com deduplicação de boundary
// ---------------------------------------------------------------------------

/**
 * Merge de segments de todos os chunks, com deduplicação de boundary (tolerância 0.3s).
 *
 * Whisper pode incluir as últimas palavras do chunk anterior no início do próximo.
 * Se o start do primeiro segment de chunk N for <= end do último segment de chunk N-1
 * (com tolerância 0.3s), descarta-se o segment duplicado do chunk N.
 */
function mergeSegments(results: WhisperChunkResult[]): TranscriptionSegment[] {
  const merged: TranscriptionSegment[] = [];

  for (const result of results) {
    if (result.segments.length === 0) continue;

    let startIdx = 0;

    if (merged.length > 0) {
      const lastEnd = merged[merged.length - 1].end;
      const OVERLAP_TOLERANCE = 0.3;

      // Descartar segments do início do chunk atual que sobreponham com o chunk anterior
      while (
        startIdx < result.segments.length &&
        result.segments[startIdx].start < lastEnd - OVERLAP_TOLERANCE
      ) {
        startIdx++;
      }
    }

    for (let i = startIdx; i < result.segments.length; i++) {
      merged.push(result.segments[i]);
    }
  }

  return merged;
}

/**
 * Merge de words de todos os chunks, com deduplicação de boundary (tolerância 0.3s).
 */
function mergeWords(results: WhisperChunkResult[]): WordTimestamp[] {
  const merged: WordTimestamp[] = [];

  for (const result of results) {
    if (result.words.length === 0) continue;

    let startIdx = 0;

    if (merged.length > 0) {
      const lastEnd = merged[merged.length - 1].end;
      const OVERLAP_TOLERANCE = 0.3;

      while (
        startIdx < result.words.length &&
        result.words[startIdx].start < lastEnd - OVERLAP_TOLERANCE
      ) {
        startIdx++;
      }
    }

    for (let i = startIdx; i < result.words.length; i++) {
      merged.push(result.words[i]);
    }
  }

  return merged;
}

// ---------------------------------------------------------------------------
// Utilitário
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
