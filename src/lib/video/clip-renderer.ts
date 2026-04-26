/**
 * clip-renderer.ts — Renderiza um corte de vídeo com crop 9:16 + legendas burned-in.
 *
 * Pipeline por corte:
 *   1. Gera arquivo .ass via generateAssSubtitles
 *   2. Escreve .ass em disco no workDir
 *   3. Chama FFmpeg: seek → crop → scale 1080×1920 → subtitles → encode
 *   4. Retorna path do MP4 resultante + metadados
 *
 * Limitação MVP: usa fontes do sistema (Arial/sans-serif).
 * Para fontes customizadas (Montserrat, etc.), o Dockerfile do container
 * precisaria instalar via `apk add font-noto` ou copiar TTFs pra /usr/share/fonts/.
 */

import fs from 'fs';
import path from 'path';
import type { VideoCutV2 } from '@/types/video-pipeline';
import type { WordTimestamp, CaptionStyle } from '@/types/captions';
import { runFFmpeg, probeVideo } from './ffmpeg-runner';
import { generateAssSubtitles } from './ass-generator';

// ---------------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------------

export interface RenderClipOptions {
  /** Path absoluto do vídeo original no disco local. */
  inputVideoPath: string;
  /** Metadados do corte (start_time, end_time, id, etc.). */
  cut: VideoCutV2;
  /** Array completo de word timestamps do projeto (relativos ao vídeo original). */
  words: WordTimestamp[];
  /** Estilo de legenda a ser queimado no vídeo. */
  captionStyle: CaptionStyle;
  /** Diretório de trabalho onde o .ass e o .mp4 serão gravados. */
  workDir: string;
  /** Nome do arquivo de saída (sem extensão). Padrão: cut_<id>. */
  outputName?: string;
  /** Callback de progresso 0-100. */
  onProgress?: (pct: number) => void;
}

export interface RenderedClip {
  /** Path absoluto do MP4 resultante. */
  outputPath: string;
  /** Tamanho do arquivo em bytes. */
  fileSizeBytes: number;
  /** Duração real do clip em segundos (via ffprobe). */
  durationSeconds: number;
}

// ---------------------------------------------------------------------------
// Implementação
// ---------------------------------------------------------------------------

/**
 * Renderiza 1 corte: crop 9:16 centrado + scale 1080×1920 + legendas burned-in.
 *
 * Notas sobre o seek:
 *  - `-ss ANTES de -i` → seek por keyframe (rápido, pode ter imprecisão ~1s)
 *  - Para pixel-perfect (podcasts com câmera fixa), a imprecisão é aceitável
 *
 * Notas sobre o filtro `subtitles`:
 *  - O caminho do ASS é escapado (`:` → `\:`) para evitar erro no filtro
 *  - Em Windows (dev local) usamos double-backslash; em Linux (produção/Coolify)
 *    o caminho forward-slash já funciona
 *
 * @throws Error se FFmpeg retornar código de saída != 0
 */
export async function renderClip(opts: RenderClipOptions): Promise<RenderedClip> {
  const {
    inputVideoPath,
    cut,
    words,
    captionStyle,
    workDir,
    outputName,
    onProgress,
  } = opts;

  // ─── 1. Garantir que o workDir existe ─────────────────────────────────────
  if (!fs.existsSync(workDir)) {
    fs.mkdirSync(workDir, { recursive: true });
  }

  // ─── 2. Gerar conteúdo .ass ────────────────────────────────────────────────
  const assContent = generateAssSubtitles({
    words,
    style: captionStyle,
    cutStart: cut.start_time,
    cutEnd: cut.end_time,
    videoWidth: 1080,
    videoHeight: 1920,
  });

  const safeId = cut.id.replace(/[^a-zA-Z0-9_-]/g, '_');
  const assFilename = `${safeId}.ass`;
  const assPath = path.join(workDir, assFilename);

  await fs.promises.writeFile(assPath, assContent, 'utf-8');

  // ─── 3. Montar path de saída ────────────────────────────────────────────────
  const baseName = outputName ?? `cut_${safeId}`;
  const outputPath = path.join(workDir, `${baseName}.mp4`);

  // ─── 4. Escapar path do ASS para uso no filtro ────────────────────────────
  // FFmpeg filtro subtitles requer escaping de ':' e '\' no path.
  // Em Linux/macOS (produção): apenas escapa ':' → '\:'
  // Em Windows (dev): converte backslashes → forward slashes + escapa ':'
  const escapedAssPath = assPath
    .replace(/\\/g, '/')          // normalizar para forward slash
    .replace(/:/g, '\\:')         // escapar ':' (separador de drive no Windows e arg do filtro)
    .replace(/'/g, "\\'");        // escapar aspas simples

  // ─── 5. Montar filter_complex ─────────────────────────────────────────────
  // crop=ih*9/16:ih → recorta a largura ao centro para proporção 9:16
  // scale=1080:1920 → redimensiona pro alvo
  // subtitles=path → queima as legendas
  const videoFilter = [
    'crop=ih*9/16:ih',
    'scale=1080:1920',
    `subtitles='${escapedAssPath}'`,
  ].join(',');

  // ─── 6. Executar FFmpeg ────────────────────────────────────────────────────
  // Timeout: 10 min por clip (corte de 1m30 max → ~5min no pior caso com preset veryfast)
  const timeoutMs = 10 * 60 * 1000;

  const args = [
    '-y',
    // Seek rápido por keyframe ANTES do -i
    '-ss', String(cut.start_time),
    '-to', String(cut.end_time),
    '-i', inputVideoPath,
    // Filtros de vídeo
    '-vf', videoFilter,
    // Encoder de vídeo
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-crf', '23',
    // Encoder de áudio
    '-c:a', 'aac',
    '-b:a', '128k',
    // Otimizar pra streaming progressivo
    '-movflags', '+faststart',
    outputPath,
  ];

  try {
    await runFFmpeg({
      args,
      timeoutMs,
      onProgress,
    });
  } catch (err) {
    // Tentar limpar o ass file em caso de erro, mas não bloquear
    fs.promises.unlink(assPath).catch(() => undefined);
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      `[clip-renderer] Falha ao renderizar corte '${cut.id}' ` +
      `(${cut.start_time.toFixed(1)}s–${cut.end_time.toFixed(1)}s): ${msg}`
    );
  }

  // ─── 7. Cleanup do .ass ────────────────────────────────────────────────────
  // Manter o .ass só se necessário para debug; remover por padrão.
  await fs.promises.unlink(assPath).catch(() => undefined);

  // ─── 8. Probe do output pra confirmar duração e tamanho ───────────────────
  const [probe, stat] = await Promise.all([
    probeVideo(outputPath),
    fs.promises.stat(outputPath),
  ]);

  return {
    outputPath,
    fileSizeBytes: stat.size,
    durationSeconds: probe.durationSeconds,
  };
}
