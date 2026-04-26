// src/lib/video/constants.ts
// Limites, buckets de storage, modelos de IA e tabela de custos
// centralizados pro pipeline assíncrono de /cortes.
//
// Toda mudança de limite/modelo/custo deve passar por aqui — nenhuma
// rota/squad deve hardcodear esses valores.

/**
 * Limites operacionais do pipeline.
 *
 * Calibrados pra MVP:
 * - 4 podcasts/mês máximo (volume estimado)
 * - Cap em 2h30 (9000s) — suficiente pra 99% dos podcasts brasileiros
 * - Whisper aceita até 25MB por upload; usamos 23MB com margem de segurança
 * - 10 min por chunk = ~22-23MB com 64kbps mp3 mono (sweet spot)
 * - Render serial (concurrency=1) pra não travar container Coolify
 */
export const VIDEO_LIMITS = {
  /** Cap de duração do podcast original em segundos (2h30). */
  MAX_DURATION_SECONDS: 9000,
  /** Tamanho máximo do upload bruto (5 GB). */
  MAX_FILE_SIZE_BYTES: 5 * 1024 * 1024 * 1024,
  /** Tamanho máximo de cada chunk de áudio enviado pro Whisper (23 MB, com margem do limite oficial de 25 MB). */
  WHISPER_CHUNK_BYTES: 23 * 1024 * 1024,
  /** Duração-alvo de cada chunk em segundos (10 min). */
  WHISPER_CHUNK_DURATION_S: 600,
  /** Quantos chunks enviar em paralelo pro Whisper. */
  WHISPER_PARALLEL_CONCURRENCY: 3,
  /** Máximo de cortes que o pipeline retorna por podcast. */
  MAX_CUTS_PER_PODCAST: 10,
  /** Duração mínima aceitável de um corte em segundos. */
  CUT_MIN_DURATION_S: 15,
  /** Duração máxima aceitável de um corte em segundos (1m30). */
  CUT_MAX_DURATION_S: 90,
  /** Concorrência de render FFmpeg simultâneo. Serial pra não saturar CPU/RAM do container. */
  RENDER_PARALLEL_CONCURRENCY: 1,
  /** Timeout total do job inteiro (30 min). Excedeu, marca failed. */
  TOTAL_JOB_TIMEOUT_MS: 30 * 60 * 1000,
} as const;

/**
 * IDs dos buckets do Supabase Storage.
 * - RAW: upload original do podcast (.mp4, .mov, .mkv, etc) — privado
 * - CUTS: MP4 finais dos cortes renderizados — privado, signed URL
 */
export const STORAGE_BUCKETS = {
  RAW: 'videos',
  CUTS: 'cuts',
} as const;

/**
 * Modelos de IA usados em cada etapa do pipeline.
 *
 * - WHISPER: transcrição (OpenAI)
 * - CUT_DETECTOR: 1ª passada pra varrer transcrição inteira e propor cortes
 *                 (Gemini 2.5 Flash — barato e rápido pra contexto longo)
 * - CUT_REFINER: 2ª passada pra rankear/refinar os top candidatos
 *                (Claude Sonnet 4.6 — melhor pra raciocínio editorial)
 */
export const AI_MODELS = {
  WHISPER: 'whisper-1',
  CUT_DETECTOR: 'gemini-2.5-flash-preview-04-17',
  CUT_REFINER: 'claude-sonnet-4-6',
} as const;

/**
 * Tabela de custos em centavos USD pra estimar gasto por podcast.
 *
 * Valores de referência (preços públicos abril/2026):
 * - Whisper: $0.006/min = $0.36/hora
 * - Gemini Flash: ~$0.10/podcast (varia conforme tokens da transcrição)
 * - Sonnet 4.6: ~$0.05/podcast (só rerank de ~30 candidatos)
 *
 * Usado em video_projects.cost_estimate_cents ao final do job.
 */
export const COST_PER_HOUR_CENTS = {
  /** Whisper: 36 cents por hora de áudio. */
  WHISPER: 36,
  /** Gemini Flash (estimativa por podcast inteiro, não por hora). */
  GEMINI_FLASH_PER_PODCAST: 10,
  /** Sonnet 4.6 (estimativa por podcast inteiro, só refinement step). */
  SONNET_PER_PODCAST: 5,
} as const;

export type VideoLimitsKey = keyof typeof VIDEO_LIMITS;
export type StorageBucketKey = keyof typeof STORAGE_BUCKETS;
export type AiModelKey = keyof typeof AI_MODELS;
