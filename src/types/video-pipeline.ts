// src/types/video-pipeline.ts
// Tipos canônicos do pipeline assíncrono in-process do /cortes (refator 2026-04).
// NÃO substitui src/types/video.ts (legacy) — coexiste para backward-compat.
// Squads Beta (rotas) e Gamma (UI) consomem APENAS estes tipos.

/**
 * Etapas granulares do pipeline assíncrono.
 *
 * Ordem natural de execução:
 *   queued -> extracting_audio -> chunking_audio -> transcribing
 *           -> merging_transcription -> detecting_cuts -> refining_cuts
 *           -> rendering -> uploading_clips -> completed
 *
 * `failed` pode acontecer a partir de qualquer etapa.
 */
export type ProcessingStep =
  | 'queued'
  | 'extracting_audio'
  | 'chunking_audio'
  | 'transcribing'
  | 'merging_transcription'
  | 'detecting_cuts'
  | 'refining_cuts'
  | 'rendering'
  | 'uploading_clips'
  | 'completed'
  | 'failed';

/**
 * Status do video_project no pipeline novo.
 *
 * Coexiste no DB com os status legacy (uploading/processing/analyzed/
 * editing/exporting/done/error). Frontend novo só lida com este union;
 * código legacy continua usando VideoProjectStatus de src/types/video.ts.
 */
export type VideoProjectStatusV2 =
  | 'queued'
  | 'extracting_audio'
  | 'transcribing'
  | 'detecting_cuts'
  | 'rendering'
  | 'ready'
  | 'failed';

/**
 * Categoria atribuída pelo detector de cortes (Gemini Flash) e refinada
 * pelo Sonnet. Ajuda a filtrar/agrupar cortes na UI.
 */
export type VideoCutCategory =
  | 'humor'
  | 'insight'
  | 'controversy'
  | 'story'
  | 'emotion'
  | 'other';

/**
 * Status de renderização individual de um corte.
 *
 *   pending   -> ainda não foi pra fila de render
 *   rendering -> FFmpeg processando agora
 *   ready     -> MP4 já no bucket `cuts`, rendered_url disponível
 *   failed    -> render quebrou; render_error tem o motivo
 */
export type CutRenderStatus = 'pending' | 'rendering' | 'ready' | 'failed';

/**
 * Estrutura de um corte no fluxo novo.
 *
 * Persistida em video_projects.cuts (jsonb array). Substitui semanticamente
 * a estrutura antiga em cut_suggestions, mas o esquema legacy continua
 * intacto pra não quebrar fluxos antigos.
 */
export interface VideoCutV2 {
  /** UUID estável gerado no detect_cuts; usado pra paths no bucket. */
  id: string;
  /** Título curto do corte (gerado pela IA). */
  title: string;
  /** Primeira frase/gancho do corte — texto que aparece nos primeiros 3s. */
  hook: string;
  /** Início do corte no vídeo original (segundos, float). */
  start_time: number;
  /** Fim do corte no vídeo original (segundos, float). */
  end_time: number;
  /** Score viral 0-100 atribuído pelo refiner (Sonnet). */
  viral_score: number;
  /** Categoria do conteúdo do corte. */
  category: VideoCutCategory;
  /** Justificativa textual de por que este trecho foi selecionado. */
  reason: string;
  /** Signed URL do MP4 final no bucket `cuts`. Null enquanto não renderizado. */
  rendered_url?: string;
  /** Estado da renderização individual deste corte. */
  render_status: CutRenderStatus;
  /** Mensagem de erro quando render_status === 'failed'. */
  render_error?: string;
  /** ID do caption_style aplicado neste corte (FK soft pra caption_styles.id). */
  caption_style_id?: string;
}

/**
 * Linha da tabela video_jobs. Tracking de cada execução do pipeline
 * (mesmo sendo in-process, registramos pra histórico/retry/auditoria).
 */
export interface VideoJob {
  id: string;
  project_id: string;
  type: 'process_full' | 'rerender_clip';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  current_step: ProcessingStep | null;
  progress: number;
  attempts: number;
  max_attempts: number;
  payload: Record<string, unknown>;
  result: Record<string, unknown> | null;
  error: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

/**
 * Payload do endpoint GET /api/video/[projectId]/status.
 * Frontend faz polling neste contrato pra montar a UI de progresso.
 */
export interface JobStatusResponse {
  project_id: string;
  job_id: string;
  status: VideoProjectStatusV2;
  step: ProcessingStep | null;
  progress: number;
  error_step?: string;
  error_message?: string;
  cuts_count: number;
  duration_seconds: number | null;
  cost_estimate_cents: number | null;
}
