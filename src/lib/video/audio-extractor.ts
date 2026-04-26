/**
 * audio-extractor.ts — Download streaming + extração de áudio + chunking.
 *
 * Pipeline:
 *   1. Download streaming do Supabase Storage via signed URL → /var/tmp (ou VIDEO_WORK_DIR)
 *   2. FFmpeg extrai áudio mp3 mono 16kHz 64kbps
 *   3. FFmpeg segmenta o áudio em chunks de WHISPER_CHUNK_DURATION_S segundos
 *   4. FFprobe faz probe de cada chunk pra duração real
 *   5. Retorna metadata completa com paths absolutos
 *
 * Cleanup garantido via cleanupAudioFiles() — chamar no finally do job runner.
 */

import fs from "fs";
import path from "path";
import os from "os";
import { Readable } from "stream";
import { pipeline as streamPipeline } from "stream/promises";
import type { ReadableStream as NodeWebReadableStream } from "stream/web";
import { createServiceClient } from "@/lib/supabase/service";
import { runFFmpeg, probeVideo } from "./ffmpeg-runner";
import { VIDEO_LIMITS, STORAGE_BUCKETS } from "./constants";

// ---------------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------------

export interface AudioChunk {
  /** Path absoluto do arquivo no disco. */
  path: string;
  /** Índice 0-based. */
  index: number;
  /** Offset desde o início do áudio original (segundos). */
  startTimeSeconds: number;
  /** Duração real deste chunk (pode ser menor no último). */
  durationSeconds: number;
  /** Tamanho do arquivo em bytes. */
  sizeBytes: number;
}

export interface ExtractedAudio {
  /** Path absoluto do mp3 full (mono 16kHz 64kbps). */
  fullAudioPath: string;
  /** Chunks splitados prontos pra transcrição paralela. */
  chunks: AudioChunk[];
  /** Duração total do áudio em segundos. */
  durationSeconds: number;
  /** Tamanho total do áudio em bytes (full mp3). */
  totalSizeBytes: number;
}

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

/**
 * Resolve o diretório base de trabalho.
 * Ordem de preferência:
 *   1. Env var VIDEO_WORK_DIR (permite override via Coolify)
 *   2. /var/tmp se existir e for gravável (tmpfs-free em alpine)
 *   3. os.tmpdir() como fallback
 */
function resolveBaseWorkDir(): string {
  const envDir = process.env.VIDEO_WORK_DIR;
  if (envDir) return envDir;

  try {
    fs.accessSync("/var/tmp", fs.constants.W_OK);
    return "/var/tmp";
  } catch {
    return os.tmpdir();
  }
}

/**
 * Retorna o workDir pra um job específico.
 * Exposta pro job-runner montar o path sem reimplementar a lógica.
 */
export function getJobWorkDir(jobId: string): string {
  return path.join(resolveBaseWorkDir(), `video-job-${jobId}`);
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function getFileSize(filePath: string): Promise<number> {
  const stat = await fs.promises.stat(filePath);
  return stat.size;
}

// ---------------------------------------------------------------------------
// Função principal
// ---------------------------------------------------------------------------

/**
 * Faz download + extração de áudio + chunking de um vídeo no Supabase Storage.
 *
 * @param opts.supabaseStoragePath  Path no bucket 'videos' (ex: "empresas/abc/video.mp4")
 * @param opts.workDir              Diretório de trabalho (será criado se não existir)
 * @param opts.onProgress           Callback com etapa e progresso 0-100
 */
export async function extractAndChunkAudio(opts: {
  supabaseStoragePath: string;
  workDir: string;
  onProgress?: (step: "downloading" | "extracting" | "chunking", pct: number) => void;
}): Promise<ExtractedAudio> {
  const { supabaseStoragePath, workDir, onProgress } = opts;

  ensureDir(workDir);

  const supabase = createServiceClient();

  // Derivar nome do arquivo original com extensão
  const originalFilename = path.basename(supabaseStoragePath);
  const localVideoPath = path.join(workDir, originalFilename);
  const audioFilename = "audio_full.mp3";
  const fullAudioPath = path.join(workDir, audioFilename);
  const chunksDir = path.join(workDir, "chunks");

  // -------------------------------------------------------------------------
  // 1. Download streaming via signed URL
  // -------------------------------------------------------------------------
  onProgress?.("downloading", 0);

  const { data: signedData, error: signedError } = await supabase.storage
    .from(STORAGE_BUCKETS.RAW)
    .createSignedUrl(supabaseStoragePath, 60 * 60); // 1h de validade

  if (signedError || !signedData?.signedUrl) {
    throw new Error(
      `Falha ao gerar URL assinada para '${supabaseStoragePath}': ` +
        (signedError?.message ?? "URL não retornada pelo Supabase")
    );
  }

  const fetchRes = await fetch(signedData.signedUrl);
  if (!fetchRes.ok) {
    throw new Error(
      `Falha no download do vídeo '${supabaseStoragePath}': ` +
        `HTTP ${fetchRes.status} ${fetchRes.statusText}`
    );
  }
  if (!fetchRes.body) {
    throw new Error("Resposta do download não contém body (stream vazio).");
  }

  const fileWriteStream = fs.createWriteStream(localVideoPath);

  // Streaming real — não carrega tudo em RAM.
  // Node 18+ retorna ReadableStream (web) em fetchRes.body; convertemos pra
  // Node Readable via Readable.fromWeb pra encadear no pipeline().
  const body = fetchRes.body as unknown as
    | (NodeJS.ReadableStream & { pipe?: unknown })
    | NodeWebReadableStream;

  const nodeReadable: NodeJS.ReadableStream =
    typeof (body as { pipe?: unknown }).pipe === "function"
      ? (body as NodeJS.ReadableStream)
      : (Readable.fromWeb(body as NodeWebReadableStream) as NodeJS.ReadableStream);

  await streamPipeline(nodeReadable, fileWriteStream);

  onProgress?.("downloading", 100);

  // -------------------------------------------------------------------------
  // 2. Extração de áudio via FFmpeg
  // -------------------------------------------------------------------------
  onProgress?.("extracting", 0);

  try {
    await runFFmpeg({
      args: [
        "-y",
        "-i", localVideoPath,
        "-vn",               // sem vídeo
        "-ac", "1",          // mono
        "-ar", "16000",      // 16kHz (ótimo pra Whisper)
        "-b:a", "64k",       // 64kbps (~28MB/hora)
        "-f", "mp3",
        fullAudioPath,
      ],
      timeoutMs: VIDEO_LIMITS.TOTAL_JOB_TIMEOUT_MS,
      onProgress: (pct) => onProgress?.("extracting", pct),
    });
  } finally {
    // Remover vídeo original após extração — libera espaço imediatamente
    try {
      await fs.promises.unlink(localVideoPath);
    } catch {
      // Não fatal — o cleanup final vai tratar
    }
  }

  onProgress?.("extracting", 100);

  // Probe duração do áudio extraído
  const audioProbe = await probeVideo(fullAudioPath);
  if (!audioProbe.hasAudio) {
    throw new Error(
      `Áudio extraído de '${supabaseStoragePath}' não contém stream de áudio válido.`
    );
  }
  const durationSeconds = audioProbe.durationSeconds;
  const totalSizeBytes = await getFileSize(fullAudioPath);

  // -------------------------------------------------------------------------
  // 3. Chunking via FFmpeg segment
  // -------------------------------------------------------------------------
  onProgress?.("chunking", 0);

  ensureDir(chunksDir);
  const chunkPattern = path.join(chunksDir, "chunk_%03d.mp3");

  await runFFmpeg({
    args: [
      "-y",
      "-i", fullAudioPath,
      "-f", "segment",
      "-segment_time", String(VIDEO_LIMITS.WHISPER_CHUNK_DURATION_S),
      "-reset_timestamps", "1",
      "-c", "copy",
      chunkPattern,
    ],
    timeoutMs: 5 * 60 * 1000, // chunking é rápido (copy codec), 5min de timeout
    onProgress: (pct) => onProgress?.("chunking", pct),
  });

  onProgress?.("chunking", 100);

  // -------------------------------------------------------------------------
  // 4. Enumerar chunks e fazer probe de cada um
  // -------------------------------------------------------------------------
  const chunkFiles = fs
    .readdirSync(chunksDir)
    .filter((f) => f.startsWith("chunk_") && f.endsWith(".mp3"))
    .sort();

  if (chunkFiles.length === 0) {
    throw new Error(
      `Nenhum chunk gerado ao segmentar o áudio de '${supabaseStoragePath}'. ` +
        `Verifique se o arquivo de entrada é válido.`
    );
  }

  const chunks: AudioChunk[] = [];
  const chunkDuration = VIDEO_LIMITS.WHISPER_CHUNK_DURATION_S;

  for (let i = 0; i < chunkFiles.length; i++) {
    const chunkPath = path.join(chunksDir, chunkFiles[i]);
    const chunkProbe = await probeVideo(chunkPath);
    const sizeBytes = await getFileSize(chunkPath);

    // Aviso se chunk exceder limite do Whisper (raro com 64kbps mono 16kHz)
    if (sizeBytes > VIDEO_LIMITS.WHISPER_CHUNK_BYTES) {
      console.warn(
        `[audio-extractor] Chunk ${i} (${chunkPath}) tem ${Math.round(sizeBytes / 1024 / 1024)}MB, ` +
          `acima do limite de ${Math.round(VIDEO_LIMITS.WHISPER_CHUNK_BYTES / 1024 / 1024)}MB do Whisper. ` +
          `Tentando re-encode com 32k...`
      );

      // Re-encode com bitrate menor (32kbps) para reduzir tamanho
      const reEncodedPath = chunkPath.replace(".mp3", "_reenc.mp3");
      await runFFmpeg({
        args: [
          "-y",
          "-i", chunkPath,
          "-b:a", "32k",
          "-ac", "1",
          "-ar", "16000",
          "-f", "mp3",
          reEncodedPath,
        ],
        timeoutMs: 5 * 60 * 1000,
      });

      // Substituir o chunk original pelo re-encodado
      await fs.promises.unlink(chunkPath);
      await fs.promises.rename(reEncodedPath, chunkPath);

      const newSize = await getFileSize(chunkPath);
      console.info(
        `[audio-extractor] Chunk ${i} re-encodado: ${Math.round(newSize / 1024 / 1024)}MB`
      );
    }

    const startTimeSeconds = i * chunkDuration;

    chunks.push({
      path: chunkPath,
      index: i,
      startTimeSeconds,
      durationSeconds: chunkProbe.durationSeconds,
      sizeBytes,
    });
  }

  return {
    fullAudioPath,
    chunks,
    durationSeconds,
    totalSizeBytes,
  };
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

/**
 * Remove todos os arquivos gerados pelo extractAndChunkAudio.
 * Chamar no finally do job runner pra garantir que /var/tmp não vaze.
 */
export async function cleanupAudioFiles(audio: ExtractedAudio): Promise<void> {
  const errors: string[] = [];

  // Remover áudio full
  try {
    await fs.promises.unlink(audio.fullAudioPath);
  } catch (err) {
    errors.push(`fullAudio (${audio.fullAudioPath}): ${err instanceof Error ? err.message : String(err)}`);
  }

  // Remover cada chunk
  for (const chunk of audio.chunks) {
    try {
      await fs.promises.unlink(chunk.path);
    } catch (err) {
      errors.push(`chunk[${chunk.index}] (${chunk.path}): ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Tentar remover o diretório de chunks (só se vazio)
  if (audio.chunks.length > 0) {
    const chunksDir = path.dirname(audio.chunks[0].path);
    try {
      await fs.promises.rmdir(chunksDir);
    } catch {
      // Ignorar — pode não estar vazio se algum arquivo acima falhou
    }
  }

  if (errors.length > 0) {
    console.warn(
      `[audio-extractor] Cleanup parcial — ${errors.length} arquivo(s) não removido(s):\n` +
        errors.join("\n")
    );
  }
}
