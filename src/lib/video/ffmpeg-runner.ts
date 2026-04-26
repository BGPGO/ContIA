/**
 * ffmpeg-runner.ts — Wrapper Node sobre FFmpeg/FFprobe via child_process.spawn.
 *
 * Todas as funções lançam erros com mensagens em PT-BR e incluem o stderr
 * do FFmpeg quando aplicável, facilitando diagnóstico em produção.
 */

import { spawn } from "child_process";

// ---------------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------------

export interface FFmpegOptions {
  /** Args completos pro ffmpeg (sem 'ffmpeg' inicial). */
  args: string[];
  /** Timeout em ms. Default: 30 minutos. */
  timeoutMs?: number;
  /** Callback com progresso 0-100 (parseia 'time=' do stderr quando possível). */
  onProgress?: (percent: number) => void;
}

export interface FFprobeResult {
  durationSeconds: number;
  hasAudio: boolean;
  videoCodec?: string;
  audioCodec?: string;
  width?: number;
  height?: number;
}

// ---------------------------------------------------------------------------
// Tipos de FFprobe JSON (internal)
// ---------------------------------------------------------------------------

interface FFprobeStream {
  codec_type: string;
  codec_name?: string;
  width?: number;
  height?: number;
  duration?: string;
}

interface FFprobeFormat {
  duration?: string;
}

interface FFprobeOutput {
  streams?: FFprobeStream[];
  format?: FFprobeFormat;
}

// ---------------------------------------------------------------------------
// Implementações
// ---------------------------------------------------------------------------

/**
 * Executa ffmpeg com os args fornecidos.
 * Captura stderr (onde ffmpeg loga tudo), retorna quando o processo termina.
 * Lança erro com stderr se exit code != 0 ou se o timeout for excedido.
 */
export async function runFFmpeg(opts: FFmpegOptions): Promise<{ stderr: string }> {
  const timeoutMs = opts.timeoutMs ?? 30 * 60 * 1000;

  return new Promise((resolve, reject) => {
    let proc: ReturnType<typeof spawn>;

    try {
      proc = spawn("ffmpeg", opts.args, { stdio: ["ignore", "pipe", "pipe"] });
    } catch (spawnErr: unknown) {
      const msg = spawnErr instanceof Error ? spawnErr.message : String(spawnErr);
      if (msg.includes("ENOENT") || msg.includes("not found")) {
        reject(
          new Error(
            "ffmpeg não encontrado. Em dev local, instale ffmpeg manualmente " +
              "(brew install ffmpeg / choco install ffmpeg). " +
              "No container Coolify o ffmpeg já está disponível via apk add."
          )
        );
      } else {
        reject(new Error(`Falha ao iniciar ffmpeg: ${msg}`));
      }
      return;
    }

    const stderrChunks: Buffer[] = [];
    let totalDurationSeconds: number | null = null;

    proc.stderr?.on("data", (chunk: Buffer) => {
      stderrChunks.push(chunk);
      const line = chunk.toString();

      // Extrair duração total do cabeçalho (Duration: HH:MM:SS.xx)
      if (totalDurationSeconds === null) {
        const durMatch = /Duration:\s+(\d+):(\d+):(\d+\.\d+)/.exec(line);
        if (durMatch) {
          totalDurationSeconds =
            parseInt(durMatch[1], 10) * 3600 +
            parseInt(durMatch[2], 10) * 60 +
            parseFloat(durMatch[3]);
        }
      }

      // Parsear progresso via "time=HH:MM:SS.xx"
      if (opts.onProgress && totalDurationSeconds && totalDurationSeconds > 0) {
        const timeMatch = /time=(\d+):(\d+):(\d+\.\d+)/.exec(line);
        if (timeMatch) {
          const currentSeconds =
            parseInt(timeMatch[1], 10) * 3600 +
            parseInt(timeMatch[2], 10) * 60 +
            parseFloat(timeMatch[3]);
          const pct = Math.min(99, Math.round((currentSeconds / totalDurationSeconds) * 100));
          opts.onProgress(pct);
        }
      }
    });

    // stdout não é usado (ffmpeg escreve output pra arquivo), mas drenar evita bloqueio
    proc.stdout?.resume();

    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill("SIGKILL");
    }, timeoutMs);

    proc.on("error", (err: NodeJS.ErrnoException) => {
      clearTimeout(timer);
      if (err.code === "ENOENT") {
        reject(
          new Error(
            "ffmpeg não encontrado. Em dev local, instale ffmpeg manualmente " +
              "(brew install ffmpeg / choco install ffmpeg). " +
              "No container Coolify o ffmpeg já está disponível via apk add."
          )
        );
      } else {
        reject(new Error(`Erro ao executar ffmpeg: ${err.message}`));
      }
    });

    proc.on("close", (code: number | null) => {
      clearTimeout(timer);
      const stderr = Buffer.concat(stderrChunks).toString();

      if (timedOut) {
        reject(
          new Error(
            `FFmpeg excedeu timeout de ${Math.round(timeoutMs / 60000)} minutos.\n` +
              `Stderr (últimas 500 chars): ...${stderr.slice(-500)}`
          )
        );
        return;
      }

      if (code !== 0) {
        reject(
          new Error(
            `FFmpeg terminou com código de saída ${code ?? "null"}.\n` +
              `Stderr (últimas 1000 chars):\n${stderr.slice(-1000)}`
          )
        );
        return;
      }

      if (opts.onProgress) opts.onProgress(100);
      resolve({ stderr });
    });
  });
}

/**
 * Faz probe de duração e streams do arquivo usando ffprobe.
 * Lança erro com mensagem clara se ffprobe não estiver no PATH.
 */
export async function probeVideo(filePath: string): Promise<FFprobeResult> {
  return new Promise((resolve, reject) => {
    let proc: ReturnType<typeof spawn>;

    const args = [
      "-v", "quiet",
      "-print_format", "json",
      "-show_format",
      "-show_streams",
      filePath,
    ];

    try {
      proc = spawn("ffprobe", args, { stdio: ["ignore", "pipe", "pipe"] });
    } catch (spawnErr: unknown) {
      const msg = spawnErr instanceof Error ? spawnErr.message : String(spawnErr);
      if (msg.includes("ENOENT") || msg.includes("not found")) {
        reject(
          new Error(
            "ffprobe não encontrado. Em dev local, instale ffmpeg manualmente " +
              "(ffprobe faz parte do pacote ffmpeg). " +
              "No container Coolify o ffprobe já está disponível via apk add ffmpeg."
          )
        );
      } else {
        reject(new Error(`Falha ao iniciar ffprobe: ${msg}`));
      }
      return;
    }

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    proc.stdout?.on("data", (chunk: Buffer) => stdoutChunks.push(chunk));
    proc.stderr?.on("data", (chunk: Buffer) => stderrChunks.push(chunk));

    proc.on("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "ENOENT") {
        reject(
          new Error(
            "ffprobe não encontrado. Em dev local, instale ffmpeg manualmente " +
              "(ffprobe faz parte do pacote ffmpeg)."
          )
        );
      } else {
        reject(new Error(`Erro ao executar ffprobe: ${err.message}`));
      }
    });

    proc.on("close", (code: number | null) => {
      if (code !== 0) {
        const stderr = Buffer.concat(stderrChunks).toString();
        reject(
          new Error(
            `FFprobe terminou com código ${code ?? "null"} ao analisar: ${filePath}\n` +
              `Stderr: ${stderr.slice(-500)}`
          )
        );
        return;
      }

      const raw = Buffer.concat(stdoutChunks).toString();
      let parsed: FFprobeOutput;
      try {
        parsed = JSON.parse(raw) as FFprobeOutput;
      } catch {
        reject(new Error(`FFprobe retornou JSON inválido ao analisar: ${filePath}`));
        return;
      }

      // Extrair duração: preferir format.duration, fallback em stream de vídeo/áudio
      let durationSeconds = 0;
      if (parsed.format?.duration) {
        durationSeconds = parseFloat(parsed.format.duration);
      } else if (parsed.streams) {
        for (const s of parsed.streams) {
          if (s.duration) {
            const d = parseFloat(s.duration);
            if (d > durationSeconds) durationSeconds = d;
          }
        }
      }

      const streams = parsed.streams ?? [];
      const videoStream = streams.find((s) => s.codec_type === "video");
      const audioStream = streams.find((s) => s.codec_type === "audio");

      resolve({
        durationSeconds,
        hasAudio: !!audioStream,
        videoCodec: videoStream?.codec_name,
        audioCodec: audioStream?.codec_name,
        width: videoStream?.width,
        height: videoStream?.height,
      });
    });
  });
}
