/**
 * job-runner.ts — Orquestrador in-process do pipeline de cortes de vídeo.
 *
 * Roda dentro do container Next.js (sem worker separado).
 * Volume baixo (4 podcasts/mês) justifica a simplicidade.
 *
 * Waves de implementação:
 *   Wave 4 — extracting_audio, chunking_audio       ← IMPLEMENTADO (Squad Delta)
 *             transcribing, merging_transcription   ← IMPLEMENTADO (Squad Epsilon)
 *   Wave 5 — detecting_cuts, refining_cuts, rendering, uploading_clips ← TODO
 */

import { createServiceClient } from "@/lib/supabase/service";
import type { ProcessingStep, VideoProjectStatusV2, VideoCutV2 } from "@/types/video-pipeline";
import {
  extractAndChunkAudio,
  cleanupAudioFiles,
  getJobWorkDir,
  type ExtractedAudio,
} from "./audio-extractor";
import {
  transcribeChunked,
  type ChunkedTranscriptionResult,
} from "./whisper-chunked";
import fs from "fs";
import path from "path";
import { Readable } from "stream";
import { pipeline as streamPipeline } from "stream/promises";
import type { ReadableStream as NodeWebReadableStream } from "stream/web";
import { VIDEO_LIMITS, COST_PER_HOUR_CENTS, STORAGE_BUCKETS } from "./constants";
import { detectCutCandidates, formatTranscriptWithTimestamps } from "./cut-detector";
import { refineCuts } from "./cut-refiner";
import { renderClip } from "./clip-renderer";
import { uploadClip } from "./clip-uploader";
import type { WordTimestamp, CaptionStyle } from "@/types/captions";

// ---------------------------------------------------------------------------
// Tipos internos
// ---------------------------------------------------------------------------

export interface JobContext {
  jobId: string;
  projectId: string;
  userId: string;
  empresaId: string;
  storagePath: string;
}

// ---------------------------------------------------------------------------
// Função principal
// ---------------------------------------------------------------------------

/**
 * Orquestra pipeline completo: download → audio extract → chunk → transcribe →
 * detect cuts → refine cuts → render clips → upload clips.
 *
 * NUNCA lança exceções — sempre marca job como failed e retorna silenciosamente.
 * Isso garante que o fire-and-forget em start-job não gere UnhandledPromiseRejection.
 */
export async function runProcessFullJob(jobId: string): Promise<void> {
  const db = createServiceClient();

  // 1. Buscar job + projeto para montar contexto
  const { data: job, error: jobFetchError } = await db
    .from("video_jobs")
    .select("id, project_id, payload, status")
    .eq("id", jobId)
    .single();

  if (jobFetchError || !job) {
    console.error(`[job-runner] Job ${jobId} nao encontrado:`, jobFetchError);
    return;
  }

  // Evitar re-execução se já está rodando/concluído
  if (job.status === "running" || job.status === "completed") {
    console.warn(`[job-runner] Job ${jobId} ja esta em status '${job.status}', ignorando.`);
    return;
  }

  const payload = job.payload as {
    storage_path: string;
    empresa_id: string;
    user_id: string;
  };

  const ctx: JobContext = {
    jobId,
    projectId: job.project_id,
    userId: payload.user_id,
    empresaId: payload.empresa_id,
    storagePath: payload.storage_path,
  };

  // 2. Marcar job como running + started_at
  await db
    .from("video_jobs")
    .update({
      status: "running",
      started_at: new Date().toISOString(),
    })
    .eq("id", jobId);

  let audio: ExtractedAudio | null = null;
  let renderedVideoPath: string | null = null;

  try {
    // -------------------------------------------------------------------------
    // Wave 4 — Download + Extração de áudio + Chunking (Squad Delta)
    // -------------------------------------------------------------------------

    await updateJobStep(ctx.jobId, ctx.projectId, "extracting_audio", 10);
    console.log(`[job-runner] Job ${jobId} iniciando download + extração de áudio...`);

    audio = await extractAndChunkAudio({
      supabaseStoragePath: ctx.storagePath,
      workDir: getJobWorkDir(ctx.jobId),
      onProgress: (step, pct) => {
        // Mapear progresso interno pra range de progress do job:
        //   downloading  → extracting_audio   10-20
        //   extracting   → extracting_audio   20-30
        //   chunking     → chunking_audio     30-35
        const stepMap: Record<
          "downloading" | "extracting" | "chunking",
          { range: [number, number]; pipelineStep: ProcessingStep }
        > = {
          downloading: { range: [10, 20], pipelineStep: "extracting_audio" },
          extracting: { range: [20, 30], pipelineStep: "extracting_audio" },
          chunking: { range: [30, 35], pipelineStep: "chunking_audio" },
        };
        const cfg = stepMap[step];
        const [min, max] = cfg.range;
        const mapped = Math.round(min + (pct / 100) * (max - min));

        // Fire-and-forget: não bloqueia o callback do FFmpeg
        void updateJobStep(ctx.jobId, ctx.projectId, cfg.pipelineStep, mapped).catch(
          (e: unknown) => console.warn("[job-runner] updateJobStep nao-critico falhou:", e)
        );
      },
    });

    console.log(
      `[job-runner] Job ${jobId} áudio extraído: ` +
        `${audio.durationSeconds.toFixed(1)}s, ` +
        `${audio.chunks.length} chunks, ` +
        `${Math.round(audio.totalSizeBytes / 1024 / 1024)}MB`
    );

    // Validar limite de duração (2h30)
    if (audio.durationSeconds > VIDEO_LIMITS.MAX_DURATION_SECONDS) {
      throw new Error(
        `Vídeo excede o limite de 2h30 ` +
          `(duração detectada: ${Math.round(audio.durationSeconds / 60)}min). ` +
          `Limite máximo: ${Math.round(VIDEO_LIMITS.MAX_DURATION_SECONDS / 60)}min.`
      );
    }

    // Atualizar duration_seconds do projeto
    await updateProjectDuration(ctx.projectId, audio.durationSeconds);

    // -------------------------------------------------------------------------
    // Wave 4 — Transcrição paralela via Whisper (Squad Epsilon)
    // -------------------------------------------------------------------------

    await updateJobStep(ctx.jobId, ctx.projectId, "transcribing", 35);
    console.log(
      `[job-runner] Job ${jobId} iniciando transcrição de ${audio.chunks.length} chunks...`
    );

    const transcription = await transcribeChunked({
      chunks: audio.chunks,
      language: "pt",
      onChunkComplete: (done, total) => {
        // 35-60% durante transcrição
        const pct = 35 + Math.round((done / total) * 25);
        void updateJobStep(ctx.jobId, ctx.projectId, "transcribing", pct).catch(
          (e: unknown) => console.warn("[job-runner] updateJobStep nao-critico falhou:", e)
        );
      },
    });

    console.log(
      `[job-runner] Job ${jobId} transcrição concluída: ` +
        `${transcription.chunksTranscribed} chunks, ` +
        `${transcription.segments.length} segments, ` +
        `${transcription.words.length} words, ` +
        `${transcription.fullText.length} chars`
    );

    // Merge + persist
    await updateJobStep(ctx.jobId, ctx.projectId, "merging_transcription", 60);
    await persistTranscription(ctx.projectId, transcription);
    await updateJobStep(ctx.jobId, ctx.projectId, "merging_transcription", 65);

    // -------------------------------------------------------------------------
    // Wave 5 — Detecção de cortes — Pass 1: Gemini 2.5 Flash (Squad Zeta)
    // -------------------------------------------------------------------------

    await updateJobStep(ctx.jobId, ctx.projectId, "detecting_cuts", 65);
    console.log(`[job-runner] Job ${jobId} iniciando detecção de cortes (Gemini Flash)...`);

    const transcriptText = formatTranscriptWithTimestamps(transcription.segments);

    const candidates = await detectCutCandidates({
      transcriptionText: transcriptText,
      segments: transcription.segments,
      durationSeconds: transcription.totalDurationSeconds,
    });

    if (candidates.length === 0) {
      throw new Error("Nenhum candidato a corte encontrado pela análise IA");
    }

    console.log(
      `[job-runner] Job ${jobId} detecção concluída: ${candidates.length} candidatos`
    );

    // -------------------------------------------------------------------------
    // Wave 5 — Refinamento de cortes — Pass 2: Claude Sonnet 4.6 (Squad Zeta)
    // -------------------------------------------------------------------------

    await updateJobStep(ctx.jobId, ctx.projectId, "refining_cuts", 78);
    console.log(`[job-runner] Job ${jobId} iniciando refinamento de cortes (Sonnet 4.6)...`);

    const refined = await refineCuts({
      candidates,
      transcriptionContext: transcription.fullText,
    });

    console.log(
      `[job-runner] Job ${jobId} refinamento concluído: ${refined.length} cortes finais`
    );

    // Persistir cortes (sem rendered_url ainda — Squad Eta vai preencher)
    const cutsForDb: VideoCutV2[] = refined.map((r) => ({
      ...r,
      id: `cut_${randomId()}`,
      render_status: "pending" as const,
    }));

    await persistCuts(ctx.projectId, cutsForDb);

    // -------------------------------------------------------------------------
    // Wave 5 — Render e upload dos clips (Squad Eta)
    // -------------------------------------------------------------------------

    await updateJobStep(ctx.jobId, ctx.projectId, "rendering", 82);
    console.log(`[job-runner] Job ${jobId} iniciando render de ${cutsForDb.length} cortes...`);

    // Re-baixar o vídeo original (foi deletado após extração de áudio)
    const videoPath = await downloadVideoForRender(
      ctx.storagePath,
      getJobWorkDir(ctx.jobId)
    );
    renderedVideoPath = videoPath;

    // Carregar estilo de legenda do projeto (ou primeiro preset como fallback)
    const captionStyle = await loadCaptionStyle(ctx.projectId);

    // Buscar word_timestamps persistidos (os mesmos da transcrição)
    const words = transcription.words as WordTimestamp[];

    const renderedCuts: VideoCutV2[] = [];

    for (let i = 0; i < cutsForDb.length; i++) {
      const cut = { ...cutsForDb[i] };
      try {
        // Marcar como rendering e persistir estado intermediário
        cut.render_status = "rendering";
        await persistCuts(ctx.projectId, [
          ...renderedCuts,
          cut,
          ...cutsForDb.slice(i + 1),
        ]);

        const rendered = await renderClip({
          inputVideoPath: videoPath,
          cut,
          words,
          captionStyle,
          workDir: getJobWorkDir(ctx.jobId),
          onProgress: (pct) => {
            void updateJobStep(
              ctx.jobId,
              ctx.projectId,
              "rendering",
              82 + Math.round(((i + pct / 100) / cutsForDb.length) * 13)
            ).catch((e: unknown) =>
              console.warn("[job-runner] updateJobStep render não-crítico falhou:", e)
            );
          },
        });

        const { signed_url } = await uploadClip({
          localPath: rendered.outputPath,
          projectId: ctx.projectId,
          cutId: cut.id,
        });

        // Remover clip local após upload bem-sucedido
        await fs.promises.unlink(rendered.outputPath).catch(() => undefined);

        cut.render_status = "ready";
        cut.rendered_url = signed_url;
        renderedCuts.push(cut);

        // Progresso 82–95 distribuído entre os cortes
        const pct = 82 + Math.round(((i + 1) / cutsForDb.length) * 13);
        await updateJobStep(ctx.jobId, ctx.projectId, "rendering", pct);

        console.log(
          `[job-runner] Job ${jobId} corte ${i + 1}/${cutsForDb.length} renderizado: ` +
            `${cut.id} (${rendered.durationSeconds.toFixed(1)}s, ` +
            `${Math.round(rendered.fileSizeBytes / 1024 / 1024)}MB)`
        );
      } catch (renderErr: unknown) {
        const errMsg = renderErr instanceof Error ? renderErr.message : String(renderErr);
        cut.render_status = "failed";
        cut.render_error = errMsg;
        renderedCuts.push(cut);
        console.warn(
          `[job-runner] Job ${jobId} corte ${cut.id} falhou (continuando): ${errMsg}`
        );
      }
    }

    // Persistir estado final de todos os cortes
    await persistCuts(ctx.projectId, renderedCuts);

    await updateJobStep(ctx.jobId, ctx.projectId, "uploading_clips", 95);
    // (upload já foi feito por corte — step simbólico para o frontend)

    // -------------------------------------------------------------------------
    // Concluído
    // -------------------------------------------------------------------------

    const costCents = calculateCost(audio.durationSeconds);

    await updateJobStep(ctx.jobId, ctx.projectId, "completed", 100);
    await db
      .from("video_jobs")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        progress: 100,
        current_step: "completed",
        result: {
          duration_seconds: audio.durationSeconds,
          chunks_count: audio.chunks.length,
          cost_estimate_cents: costCents,
        },
      })
      .eq("id", jobId);

    await db
      .from("video_projects")
      .update({
        status: "ready",
        processing_step: "completed",
        processing_progress: 100,
        cost_estimate_cents: costCents,
        updated_at: new Date().toISOString(),
      })
      .eq("id", ctx.projectId);

    console.log(
      `[job-runner] Job ${jobId} concluido. ` +
        `Duração: ${Math.round(audio.durationSeconds / 60)}min, ` +
        `Custo estimado: $${(costCents / 100).toFixed(3)}`
    );
  } catch (err: unknown) {
    // Garantir que nunca propagamos a exceção — apenas logamos e marcamos como failed
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`[job-runner] Job ${jobId} falhou:`, err);

    // Buscar current_step para registrar onde falhou
    const { data: currentJob } = await db
      .from("video_jobs")
      .select("current_step")
      .eq("id", jobId)
      .single();

    await db
      .from("video_jobs")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        error: errorMsg,
      })
      .eq("id", jobId);

    await db
      .from("video_projects")
      .update({
        status: "failed",
        error: errorMsg,
        error_step: currentJob?.current_step ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", ctx.projectId);
  } finally {
    // Cleanup garantido: remover arquivos temporários mesmo em caso de erro
    if (audio) {
      await cleanupAudioFiles(audio).catch((e: unknown) =>
        console.warn("[job-runner] Cleanup de áudio falhou (não fatal):", e)
      );
    }
    // Cleanup do vídeo re-baixado pra render — garantido em caso de erro também
    if (renderedVideoPath) {
      await fs.promises.unlink(renderedVideoPath).catch((e: unknown) =>
        console.warn("[job-runner] Cleanup do vídeo de render falhou (não fatal):", e)
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers públicos
// ---------------------------------------------------------------------------

/**
 * Atualiza o step atual em video_jobs + video_projects sincronizados.
 * Chamado em cada transição de etapa do pipeline.
 */
export async function updateJobStep(
  jobId: string,
  projectId: string,
  step: ProcessingStep,
  progress: number,
  extra?: Record<string, unknown>
): Promise<void> {
  const db = createServiceClient();

  const jobStatus = mapStepToJobStatus(step);
  const projectStatus = mapStepToProjectStatus(step);

  await Promise.all([
    db
      .from("video_jobs")
      .update({
        current_step: step,
        progress,
        ...(jobStatus && { status: jobStatus }),
        ...extra,
      })
      .eq("id", jobId),
    db
      .from("video_projects")
      .update({
        status: projectStatus,
        processing_step: step,
        processing_progress: progress,
        updated_at: new Date().toISOString(),
      })
      .eq("id", projectId),
  ]);
}

/**
 * Mapeia ProcessingStep → VideoProjectStatusV2 para video_projects.status.
 *
 * queued                           → queued
 * extracting_audio | chunking_audio → extracting_audio
 * transcribing | merging_transcription → transcribing
 * detecting_cuts | refining_cuts   → detecting_cuts
 * rendering | uploading_clips      → rendering
 * completed                        → ready
 * failed                           → failed
 */
export function mapStepToProjectStatus(step: ProcessingStep): VideoProjectStatusV2 {
  switch (step) {
    case "queued":
      return "queued";
    case "extracting_audio":
    case "chunking_audio":
      return "extracting_audio";
    case "transcribing":
    case "merging_transcription":
      return "transcribing";
    case "detecting_cuts":
    case "refining_cuts":
      return "detecting_cuts";
    case "rendering":
    case "uploading_clips":
      return "rendering";
    case "completed":
      return "ready";
    case "failed":
      return "failed";
  }
}

/**
 * Mapeia ProcessingStep → status do video_jobs (subset simples).
 * Retorna null quando não é necessário mudar o status do job.
 */
function mapStepToJobStatus(
  step: ProcessingStep
): "running" | "completed" | "failed" | null {
  if (step === "completed") return "completed";
  if (step === "failed") return "failed";
  return null; // mantém "running" (setado na inicialização)
}

// ---------------------------------------------------------------------------
// Helpers internos do pipeline
// ---------------------------------------------------------------------------

/**
 * Persiste transcrição completa no video_project.
 *
 * Grava:
 *   - transcription (jsonb) → segments + fullText + language
 *   - word_timestamps (jsonb) → array de WordTimestamp pra Captions DIY
 *
 * Chamado após `transcribeChunked` e antes da detecção de cortes.
 */
async function persistTranscription(
  projectId: string,
  result: ChunkedTranscriptionResult
): Promise<void> {
  const db = createServiceClient();
  const { error } = await db
    .from("video_projects")
    .update({
      transcription: {
        full_text: result.fullText,
        segments: result.segments,
        language: result.language,
        total_duration_seconds: result.totalDurationSeconds,
        chunks_transcribed: result.chunksTranscribed,
      },
      word_timestamps: result.words,
      updated_at: new Date().toISOString(),
    })
    .eq("id", projectId);

  if (error) {
    throw new Error(
      `[job-runner] Falha ao persistir transcrição no projeto ${projectId}: ${error.message}`
    );
  }
}

/**
 * Atualiza duration_seconds no video_project.
 * Chamado após extração de áudio, antes de validar o limite.
 */
async function updateProjectDuration(
  projectId: string,
  durationSeconds: number
): Promise<void> {
  const db = createServiceClient();
  const { error } = await db
    .from("video_projects")
    .update({
      duration_seconds: durationSeconds,
      updated_at: new Date().toISOString(),
    })
    .eq("id", projectId);
  if (error) {
    console.warn(`[job-runner] Falha ao atualizar duration_seconds (não fatal): ${error.message}`);
  }
}

/**
 * Gera ID aleatório curto (10 chars base-36) para IDs de cortes.
 */
function randomId(): string {
  return Math.random().toString(36).substring(2, 12);
}

/**
 * Persiste o array de cortes refinados em video_projects.cuts (jsonb).
 * Chamado após refineCuts e antes dos steps de render (Squad Eta).
 */
async function persistCuts(projectId: string, cuts: VideoCutV2[]): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("video_projects")
    .update({ cuts, updated_at: new Date().toISOString() })
    .eq("id", projectId);
  if (error) throw new Error(`Erro persistindo cuts: ${error.message}`);
}

/**
 * Re-baixa o vídeo original do bucket RAW para o workDir (streaming).
 *
 * O arquivo é deletado pelo extractor de áudio após a Wave 4; precisamos
 * dele de volta na Wave 5 pra o FFmpeg fazer crop + encode.
 *
 * @returns Path absoluto do vídeo baixado
 */
async function downloadVideoForRender(
  storagePath: string,
  workDir: string
): Promise<string> {
  if (!fs.existsSync(workDir)) {
    fs.mkdirSync(workDir, { recursive: true });
  }

  const supabase = createServiceClient();

  const { data: signedData, error: signedError } = await supabase.storage
    .from(STORAGE_BUCKETS.RAW)
    .createSignedUrl(storagePath, 60 * 60); // 1h de validade

  if (signedError || !signedData?.signedUrl) {
    throw new Error(
      `[job-runner] Falha ao gerar URL assinada para re-download de '${storagePath}': ` +
        (signedError?.message ?? "URL não retornada pelo Supabase")
    );
  }

  const fetchRes = await fetch(signedData.signedUrl);
  if (!fetchRes.ok) {
    throw new Error(
      `[job-runner] Falha no re-download do vídeo '${storagePath}': ` +
        `HTTP ${fetchRes.status} ${fetchRes.statusText}`
    );
  }
  if (!fetchRes.body) {
    throw new Error("[job-runner] Resposta do re-download não contém body (stream vazio).");
  }

  const filename = path.basename(storagePath);
  const localPath = path.join(workDir, `render_${filename}`);

  const fileWriteStream = fs.createWriteStream(localPath);

  const body = fetchRes.body as unknown as
    | (NodeJS.ReadableStream & { pipe?: unknown })
    | NodeWebReadableStream;

  const nodeReadable: NodeJS.ReadableStream =
    typeof (body as { pipe?: unknown }).pipe === "function"
      ? (body as NodeJS.ReadableStream)
      : (Readable.fromWeb(body as NodeWebReadableStream) as NodeJS.ReadableStream);

  await streamPipeline(nodeReadable, fileWriteStream);

  console.log(`[job-runner] Vídeo re-baixado para render: ${localPath}`);
  return localPath;
}

/**
 * Carrega o CaptionStyle do projeto para aplicar nas legendas.
 *
 * Estratégia:
 *   1. Busca video_projects.selected_style_id
 *   2. Se existir, busca em caption_styles por ID
 *   3. Se não existir ou não encontrar, usa o primeiro preset (order by created_at)
 *   4. Se não houver nenhum preset, usa estilo padrão hardcoded (fallback seguro)
 */
async function loadCaptionStyle(projectId: string): Promise<CaptionStyle> {
  const supabase = createServiceClient();

  // 1. Buscar selected_style_id do projeto
  const { data: project } = await supabase
    .from("video_projects")
    .select("selected_style_id")
    .eq("id", projectId)
    .single();

  const selectedStyleId = (project as { selected_style_id?: string } | null)?.selected_style_id;

  if (selectedStyleId) {
    const { data: style } = await supabase
      .from("caption_styles")
      .select("*")
      .eq("id", selectedStyleId)
      .single();

    if (style) return style as CaptionStyle;
  }

  // 2. Fallback pro primeiro preset disponível
  const { data: preset } = await supabase
    .from("caption_styles")
    .select("*")
    .eq("is_preset", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .single();

  if (preset) return preset as CaptionStyle;

  // 3. Fallback hardcoded seguro (sem depender de DB)
  console.warn(
    "[job-runner] Nenhum caption_style encontrado — usando estilo padrão hardcoded."
  );
  const now = new Date().toISOString();
  return {
    id: "default",
    slug: "hormozi-classic",
    name: "Hormozi Classic",
    description: "Estilo padrão — texto branco com outline preto",
    category: "viral",
    is_preset: true,
    empresa_id: null,
    user_id: null,
    cloned_from: null,
    font_family: "Arial",
    font_url: null,
    font_weight: 800,
    text_case: "upper",
    color_base: "#FFFFFF",
    color_keyword: "#FFD700",
    color_stroke: "#000000",
    stroke_width: 3,
    background_type: "none",
    background_color: null,
    position: "center",
    animation: "pop-scale",
    keyword_emphasis: "color-only",
    supersize_multiplier: 1.3,
    max_words_per_line: 4,
    use_brand_colors: false,
    use_primary_font: false,
    preview_video_url: null,
    created_at: now,
    updated_at: now,
  } satisfies CaptionStyle;
}

/**
 * Estima custo total do processamento em centavos USD.
 *
 * Componentes:
 * - Whisper: COST_PER_HOUR_CENTS.WHISPER × horas de áudio
 * - Gemini Flash: fixo por podcast (detector de cortes — Wave 5)
 * - Sonnet: fixo por podcast (refinamento — Wave 5)
 */
export function calculateCost(durationSeconds: number): number {
  const durationMinutes = durationSeconds / 60;
  const whisperCents = (COST_PER_HOUR_CENTS.WHISPER / 60) * durationMinutes;
  const geminiCents = COST_PER_HOUR_CENTS.GEMINI_FLASH_PER_PODCAST;
  const sonnetCents = COST_PER_HOUR_CENTS.SONNET_PER_PODCAST;
  return Math.ceil(whisperCents + geminiCents + sonnetCents);
}
