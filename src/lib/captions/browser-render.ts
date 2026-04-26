// src/lib/captions/browser-render.ts
// Biblioteca client-side para renderizar um trecho de vídeo (cut) com overlay
// de legenda viral queimada diretamente no browser via Canvas + MediaRecorder.
// Zero servidor, zero dependências npm adicionais.

/**
 * @deprecated
 * Render client-side via Canvas + MediaRecorder.
 * Substituído pelo render server-side em `src/lib/video/clip-renderer.ts` (Wave 5).
 * Mantido apenas pra preview rápido no browser. Não usar pra export final.
 */
import type { CaptionStyle, WordTimestamp, Keyword } from '@/types/captions';

// ---------------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------------

export interface RenderCutParams {
  videoUrl: string;         // URL do vídeo source (Supabase signed URL ou blob:)
  cutStart: number;         // segundos
  cutEnd: number;           // segundos
  style: CaptionStyle;
  words: WordTimestamp[];
  keywords: Keyword[];
  width?: number;           // default 1080
  height?: number;          // default 1920
  fps?: number;             // default 30
  onProgress?: (pct: number, message: string) => void;
  signal?: AbortSignal;     // para cancelar
}

export interface RenderResult {
  blob: Blob;
  mimeType: string;         // 'video/mp4' ou 'video/webm'
  durationSeconds: number;
  sizeBytes: number;
}

// ---------------------------------------------------------------------------
// Preferência de MIME type (Chrome 126+ suporta MP4 nativo via MediaRecorder)
// ---------------------------------------------------------------------------

const MIME_PRIORITY = [
  'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
  'video/mp4',
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
] as const;

// ---------------------------------------------------------------------------
// Capabilities check
// ---------------------------------------------------------------------------

export function getBrowserRenderCapabilities(): {
  supported: boolean;
  preferredMimeType: string;
  reason?: string;
} {
  if (typeof window === 'undefined') {
    return { supported: false, preferredMimeType: '', reason: 'SSR' };
  }
  if (typeof MediaRecorder === 'undefined') {
    return { supported: false, preferredMimeType: '', reason: 'MediaRecorder não suportado' };
  }
  if (
    typeof HTMLCanvasElement === 'undefined' ||
    typeof HTMLCanvasElement.prototype.captureStream !== 'function'
  ) {
    return { supported: false, preferredMimeType: '', reason: 'Canvas.captureStream não suportado' };
  }
  const preferred = MIME_PRIORITY.find((m) => MediaRecorder.isTypeSupported(m));
  if (!preferred) {
    return { supported: false, preferredMimeType: '', reason: 'Nenhum codec suportado' };
  }
  return { supported: true, preferredMimeType: preferred };
}

// ---------------------------------------------------------------------------
// Helpers internos de renderização de legenda
// ---------------------------------------------------------------------------

/** Posição vertical (px) da âncora da legenda, baseada no canvas height. */
function computeCaptionY(position: CaptionStyle['position'], height: number): number {
  switch (position) {
    case 'top':         return height * 0.08;
    case 'upper-third': return height * 0.22;
    case 'center':      return height * 0.50;
    case 'lower-third': return height * 0.78;
    case 'bottom':      return height * 0.92;
    default:            return height * 0.85;
  }
}

/** Agrupa palavras em linhas respeitando max_words_per_line. */
function groupWordsIntoLines(
  words: WordTimestamp[],
  maxPerLine: number
): WordTimestamp[][] {
  const lines: WordTimestamp[][] = [];
  for (let i = 0; i < words.length; i += maxPerLine) {
    lines.push(words.slice(i, i + maxPerLine));
  }
  return lines;
}

/** Aplica text_case ao texto. */
function applyCase(text: string, c: CaptionStyle['text_case']): string {
  switch (c) {
    case 'upper':    return text.toUpperCase();
    case 'lower':    return text.toLowerCase();
    case 'title':    return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
    case 'sentence': return text;
    default:         return text;
  }
}

/** Normaliza palavra para lookup no set de keywords (minúsculo, sem pontuação). */
function normalizeWord(w: string): string {
  return w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}

/** Font size base por slug. */
function baseFontSize(slug: string): number {
  switch (slug) {
    case 'mrbeast-beast':   return 72;
    case 'hormozi-classic': return 68;
    case 'ali-minimal':     return 48;
    case 'karaoke-classic': return 62;
    default:                return 60;
  }
}

// ---------------------------------------------------------------------------
// Contexto de render (passado internamente entre funções de desenho)
// ---------------------------------------------------------------------------

interface RenderContext {
  ctx: CanvasRenderingContext2D;
  style: CaptionStyle;
  width: number;
  height: number;
  keywordsSet: Set<string>;
  keywordsMap: Map<string, Keyword>;
}

/**
 * Desenha uma palavra no canvas com fill + stroke + shadow.
 * Retorna a largura ocupada (incluindo espaçamento) para uso no cursor inline.
 */
function drawWordOnCanvas(
  rc: RenderContext,
  word: WordTimestamp,
  x: number,
  y: number,
  isActive: boolean,
  isKeyword: boolean
): number {
  const { ctx, style } = rc;
  const text = applyCase(word.word, style.text_case);

  const sizeMultiplier =
    isKeyword && style.keyword_emphasis === 'supersize'
      ? style.supersize_multiplier
      : 1;
  const fontSize = Math.round(baseFontSize(style.slug) * sizeMultiplier);

  ctx.font = `${style.font_weight} ${fontSize}px "${style.font_family}", system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const metrics = ctx.measureText(text);
  const wordWidth = metrics.width;
  const midX = x + wordWidth / 2;

  // Shadow / glow
  ctx.shadowColor = 'rgba(0,0,0,0.65)';
  ctx.shadowBlur =
    style.slug === 'mrbeast-beast' && isActive && isKeyword ? 20 : 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = style.stroke_width > 0 ? 3 : 2;

  // Stroke (deve vir antes do fill para ficar por baixo)
  if (style.stroke_width > 0 && style.color_stroke) {
    ctx.strokeStyle = style.color_stroke;
    ctx.lineWidth = style.stroke_width * 2; // canvas stroke é equivalente a 2× CSS
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;
    ctx.strokeText(text, midX, y);
  }

  // Determina cor de fill
  let fillColor: string;
  if (style.animation === 'color-switch' && isActive) {
    fillColor = style.color_keyword;
  } else if (isKeyword) {
    fillColor = style.color_keyword;
  } else {
    fillColor = style.color_base;
  }

  ctx.fillStyle = fillColor;
  ctx.fillText(text, midX, y);

  // Reset shadow para não vazar para drawImage
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  return wordWidth + 14; // 14px de espaçamento entre palavras
}

/**
 * Desenha o overlay completo de legenda para o instante `currentSec`
 * (relativo ao início do cut, i.e. 0 = cutStart).
 */
function drawCaptionFrame(
  rc: RenderContext,
  words: WordTimestamp[],
  currentSec: number
): void {
  // Filtra palavras "visíveis" neste instante (com janela de overlap generosa)
  const visible = words.filter(
    (w) => currentSec >= w.start - 0.05 && currentSec <= w.end + 0.4
  );
  if (visible.length === 0) return;

  const lines = groupWordsIntoLines(visible, rc.style.max_words_per_line);
  const anchorY = computeCaptionY(rc.style.position, rc.height);
  const lineHeight = 90; // px entre baselines das linhas
  const totalHeight = lines.length * lineHeight;
  const startY = anchorY - totalHeight / 2;

  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    const lineY = startY + li * lineHeight;

    // Pré-computa larguras para centralizar a linha
    rc.ctx.font = `${rc.style.font_weight} ${baseFontSize(rc.style.slug)}px "${rc.style.font_family}", system-ui, sans-serif`;
    const widths: number[] = line.map(
      (w) => rc.ctx.measureText(applyCase(w.word, rc.style.text_case)).width + 14
    );
    const totalWidth = widths.reduce((a, b) => a + b, 0);

    let cursorX = (rc.width - totalWidth) / 2;

    for (let i = 0; i < line.length; i++) {
      const w = line[i];
      const isActive  = currentSec >= w.start && currentSec <= w.end;
      const isKeyword = rc.keywordsSet.has(normalizeWord(w.word));
      drawWordOnCanvas(rc, w, cursorX, lineY, isActive, isKeyword);
      cursorX += widths[i];
    }
  }
}

// ---------------------------------------------------------------------------
// Função principal de render
// ---------------------------------------------------------------------------

export async function renderCutInBrowser(
  params: RenderCutParams
): Promise<RenderResult> {
  const {
    videoUrl,
    cutStart,
    cutEnd,
    style,
    words,
    keywords,
    width  = 1080,
    height = 1920,
    fps    = 30,
    onProgress,
    signal,
  } = params;

  // --- Capabilities check --------------------------------------------------
  const caps = getBrowserRenderCapabilities();
  if (!caps.supported) {
    throw new Error(`Render browser não suportado: ${caps.reason}`);
  }

  onProgress?.(2, 'Preparando render...');

  if (signal?.aborted) throw new Error('Cancelado antes de iniciar');

  // --- Cria elemento <video> hidden ----------------------------------------
  const video = document.createElement('video');
  video.src = videoUrl;
  video.muted = true;      // áudio será capturado via captureStream, não pelo speaker
  video.crossOrigin = 'anonymous';
  video.playsInline = true;
  video.preload = 'auto';

  await new Promise<void>((resolve, reject) => {
    const onErr = () => reject(new Error('Falha ao carregar o vídeo source'));
    video.addEventListener('loadedmetadata', () => resolve(), { once: true });
    video.addEventListener('error', onErr, { once: true });
    if (signal) {
      signal.addEventListener('abort', () => reject(new Error('Cancelado')), { once: true });
    }
  });

  // --- Cria <canvas> 9:16 hidden -------------------------------------------
  const canvas = document.createElement('canvas');
  canvas.width  = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Não foi possível obter contexto 2D do canvas');

  // --- Pré-processa palavras do cut ----------------------------------------
  // Ajusta timing para ser relativo ao início do cut (t=0 = cutStart)
  const cutWords: WordTimestamp[] = words
    .filter((w) => w.end > cutStart && w.start < cutEnd)
    .map((w) => ({
      word:  w.word,
      start: Math.max(0, w.start - cutStart),
      end:   Math.min(cutEnd - cutStart, w.end - cutStart),
      confidence: w.confidence,
    }));

  const keywordsSet = new Set(keywords.map((k) => normalizeWord(k.word)));
  const keywordsMap = new Map(keywords.map((k) => [k.word.toLowerCase(), k]));

  const rc: RenderContext = { ctx, style, width, height, keywordsSet, keywordsMap };

  // --- Configura MediaRecorder + stream ------------------------------------
  const canvasStream = canvas.captureStream(fps) as MediaStream;

  // Tenta adicionar trilha de áudio do vídeo ao stream
  try {
    type VideoWithCapture = HTMLVideoElement & { captureStream?: () => MediaStream };
    const videoStream = (video as VideoWithCapture).captureStream?.();
    if (videoStream) {
      videoStream.getAudioTracks().forEach((t) => canvasStream.addTrack(t));
    }
  } catch {
    // Sem áudio se o browser não suportar — continua silencioso
  }

  const recorder = new MediaRecorder(canvasStream, {
    mimeType: caps.preferredMimeType,
  });
  const chunks: Blob[] = [];
  recorder.addEventListener('dataavailable', (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  });

  const cutDuration = cutEnd - cutStart;

  // --- Seek para cutStart --------------------------------------------------
  video.currentTime = cutStart;
  await new Promise<void>((resolve, reject) => {
    video.addEventListener('seeked', () => resolve(), { once: true });
    video.addEventListener('error', () => reject(new Error('Erro no seek do vídeo')), { once: true });
  });

  onProgress?.(5, 'Renderizando frames...');

  // Inicia gravação e reprodução
  recorder.start();
  await video.play();

  // --- rAF loop de render --------------------------------------------------
  let rafId = 0;
  const renderStart = performance.now();
  const maxElapsedMs = (cutDuration + 1.0) * 1000; // 1s de folga

  await new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('Cancelado'));
      return;
    }

    const onAbort = () => {
      cancelAnimationFrame(rafId);
      video.pause();
      reject(new Error('Cancelado'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });

    const tick = () => {
      const rel     = video.currentTime - cutStart;
      const elapsed = performance.now() - renderStart;

      // --- Desenha frame do vídeo (cover fit) ---
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, width, height);

      try {
        const vw = video.videoWidth;
        const vh = video.videoHeight;
        if (vw > 0 && vh > 0) {
          const scale = Math.max(width / vw, height / vh);
          const dw    = vw * scale;
          const dh    = vh * scale;
          const dx    = (width  - dw) / 2;
          const dy    = (height - dh) / 2;
          ctx.drawImage(video, dx, dy, dw, dh);
        }
      } catch {
        // Frame pode falhar pontualmente (e.g. seeking) — ignora
      }

      // --- Overlay de legenda ---
      drawCaptionFrame(rc, cutWords, rel);

      // --- Progresso ---
      if (onProgress && cutDuration > 0) {
        const pct = Math.min(95, 5 + Math.floor((rel / cutDuration) * 90));
        onProgress(pct, 'Renderizando frames...');
      }

      // --- Condição de parada ---
      if (rel >= cutDuration || elapsed >= maxElapsedMs || video.ended) {
        video.pause();
        cancelAnimationFrame(rafId);
        signal?.removeEventListener('abort', onAbort);
        resolve();
        return;
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
  });

  // --- Finaliza gravação ---------------------------------------------------
  onProgress?.(96, 'Finalizando...');
  recorder.stop();
  await new Promise<void>((resolve) =>
    recorder.addEventListener('stop', () => resolve(), { once: true })
  );

  // --- Monta Blob final ----------------------------------------------------
  const blob = new Blob(chunks, { type: caps.preferredMimeType });

  // Cleanup
  canvasStream.getTracks().forEach((t) => t.stop());
  video.src = '';

  onProgress?.(100, 'Pronto!');

  return {
    blob,
    mimeType:        caps.preferredMimeType,
    durationSeconds: cutDuration,
    sizeBytes:       blob.size,
  };
}

// ---------------------------------------------------------------------------
// Helper de download
// ---------------------------------------------------------------------------

/**
 * Cria um link temporário e dispara download do Blob como arquivo local.
 * Funciona em todos os browsers modernos.
 */
export function downloadBlobAsFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoga o URL após um curto delay para garantir que o download iniciou
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
