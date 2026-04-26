/**
 * ass-generator.ts — Gerador de legendas no formato ASS (Advanced SubStation Alpha).
 *
 * Converte word_timestamps + CaptionStyle em arquivo .ass com:
 *   - Header [Script Info] + [V4+ Styles]
 *   - [Events] com Dialogue por grupo de palavras (max_words_per_line)
 *   - Timestamps relativos ao corte (cutStart vira 0)
 *   - Override tags por estilo (Hormozi amarelo, MrBeast outline, karaoke \k, etc.)
 */

import type { WordTimestamp, CaptionStyle, AnimationType, CaptionPosition } from '@/types/captions';

// ---------------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------------

export interface AssGeneratorOptions {
  words: WordTimestamp[];
  style: CaptionStyle;
  /** Início do corte no áudio original (segundos). */
  cutStart: number;
  /** Fim do corte no áudio original (segundos). */
  cutEnd: number;
  /** Largura do vídeo de saída (padrão: 1080). */
  videoWidth?: number;
  /** Altura do vídeo de saída (padrão: 1920). */
  videoHeight?: number;
}

// ---------------------------------------------------------------------------
// Helpers de conversão
// ---------------------------------------------------------------------------

/**
 * Converte tempo em segundos (float) para formato ASS: H:MM:SS.cs (centisegundos).
 */
function toAssTime(seconds: number): string {
  const cs = Math.round(seconds * 100);
  const centiseconds = cs % 100;
  const totalSeconds = Math.floor(cs / 100);
  const secs = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const mins = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);
  return (
    `${hours}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.` +
    `${String(centiseconds).padStart(2, '0')}`
  );
}

/**
 * Converte cor HEX (#RRGGBB ou #RRGGBBAA) para formato ASS (&HAABBGGRR).
 * ASS usa ABGR com alpha 00 = totalmente opaco.
 */
function hexToAss(hex: string): string {
  // Remover '#' e normalizar pra 6 chars
  const clean = hex.replace('#', '').slice(0, 6).padEnd(6, '0');
  const r = clean.slice(0, 2);
  const g = clean.slice(2, 4);
  const b = clean.slice(4, 6);
  return `&H00${b}${g}${r}`.toUpperCase();
}

/**
 * Escapa texto para uso em eventos ASS.
 * Caracteres problemáticos: { } \ e quebras de linha.
 */
function escapeAssText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/\r?\n/g, '\\N');
}

/**
 * Aplica text_case ao texto.
 */
function applyTextCase(text: string, textCase: CaptionStyle['text_case']): string {
  switch (textCase) {
    case 'upper': return text.toUpperCase();
    case 'lower': return text.toLowerCase();
    case 'title': return text.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
    case 'sentence': return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
    default: return text;
  }
}

/**
 * Retorna Alignment ASS e MarginV baseados em CaptionPosition.
 *
 * Alignment ASS:
 *   7 8 9  ← topo
 *   4 5 6  ← meio
 *   1 2 3  ← baixo
 * Usamos sempre centralizado horizontalmente → 8 (topo), 5 (centro), 2 (baixo).
 */
function positionToAssParams(
  position: CaptionPosition,
  videoHeight: number
): { alignment: number; marginV: number } {
  switch (position) {
    case 'top':
      return { alignment: 8, marginV: Math.round(videoHeight * 0.05) };
    case 'upper-third':
      return { alignment: 8, marginV: Math.round(videoHeight * 0.20) };
    case 'center':
      return { alignment: 5, marginV: 0 };
    case 'lower-third':
      return { alignment: 2, marginV: Math.round(videoHeight * 0.30) };
    case 'bottom':
    default:
      return { alignment: 2, marginV: Math.round(videoHeight * 0.05) };
  }
}

/**
 * Retorna override tags ASS baseados na animação do estilo.
 * As tags ficam dentro de {} no início do Dialogue Text.
 */
function buildAnimationTags(animation: AnimationType, style: CaptionStyle): string {
  switch (animation) {
    case 'pop-scale':
      // Escala de 150% pra 100% nos primeiros 400ms
      return '{\\t(0,200,\\fscx150\\fscy150)\\t(200,400,\\fscx100\\fscy100)}';
    case 'fade':
    case 'fade-soft':
      return '{\\fad(150,150)}';
    case 'word-fade':
      // Fade in suave
      return '{\\fad(200,0)}';
    case 'glow-pulse':
      // ASS não suporta glow nativo; usa shadow aumentado como aproximação
      return '';
    case 'color-switch':
      // Cor base por padrão — pode ser overridada por palavra ativa
      return '';
    case 'bounce-aggressive':
      return '{\\t(0,100,\\fscx130\\fscy130)\\t(100,250,\\fscx90\\fscy90)\\t(250,400,\\fscx105\\fscy105)\\t(400,500,\\fscx100\\fscy100)}';
    case 'pop-in':
      return '{\\t(0,200,\\fscx120\\fscy120)\\t(200,350,\\fscx100\\fscy100)}';
    case 'scale-keyword':
      // Aplicado somente em palavras específicas — usa multiplier do estilo
      return `{\\fscx${Math.round(style.supersize_multiplier * 100)}\\fscy${Math.round(style.supersize_multiplier * 100)}}`;
    case 'none':
    default:
      return '';
  }
}

// ---------------------------------------------------------------------------
// Função principal
// ---------------------------------------------------------------------------

/**
 * Gera string completa de um arquivo .ass a partir de word_timestamps + CaptionStyle.
 *
 * Estratégia MVP por estilo:
 * - KaraokeClassic → karaoke ASS com \k em cada palavra
 * - AliMinimal     → texto simples com fade suave
 * - HormoziClassic → texto em maiúsculas, cor amarela, pop-scale
 * - MrBeast        → similar ao Hormozi com outline grosso
 */
export function generateAssSubtitles(opts: AssGeneratorOptions): string {
  const {
    words,
    style,
    cutStart,
    cutEnd,
    videoWidth = 1080,
    videoHeight = 1920,
  } = opts;

  // ─── 1. Filtrar e normalizar timestamps dentro do corte ────────────────────
  const cutWords = words
    .filter((w) => w.end > cutStart && w.start < cutEnd)
    .map((w) => ({
      ...w,
      start: Math.max(0, w.start - cutStart),
      end: Math.min(cutEnd - cutStart, w.end - cutStart),
    }));

  // ─── 2. Parâmetros visuais ─────────────────────────────────────────────────
  const primaryColor = hexToAss(style.color_base);
  const outlineColor = style.color_stroke ? hexToAss(style.color_stroke) : hexToAss('#000000');
  const keywordColor = hexToAss(style.color_keyword);
  const backColor = style.background_color ? hexToAss(style.background_color) : '&H80000000';
  const bold = style.font_weight >= 600 ? -1 : 0;

  // Tamanho da fonte: escalar pra resolução 1080×1920
  // Base: 72px pra 1920px de altura → escala linear
  const baseFontSize = Math.round((videoHeight / 1920) * 72);

  // Outline (bordas):
  const outlineWidth = style.stroke_width > 0 ? style.stroke_width : 2;
  const shadowDepth = style.animation === 'glow-pulse' ? 4 : 1;

  // Posicionamento
  const { alignment, marginV } = positionToAssParams(style.position, videoHeight);

  // BorderStyle: 1 = outline+shadow, 3 = opaque box
  const borderStyle = style.background_type === 'box' ? 3 : 1;

  // Determinar se é estilo karaoke
  const isKaraoke = style.slug?.includes('karaoke') || style.name?.toLowerCase().includes('karaoke');

  // ─── 3. Header ASS ─────────────────────────────────────────────────────────
  const header = [
    '[Script Info]',
    `ScriptType: v4.00+`,
    `PlayResX: ${videoWidth}`,
    `PlayResY: ${videoHeight}`,
    `WrapStyle: 0`,
    `ScaledBorderAndShadow: yes`,
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    `Style: Default,${style.font_family},${baseFontSize},${primaryColor},${keywordColor},${outlineColor},${backColor},${bold},0,0,0,100,100,0,0,${borderStyle},${outlineWidth},${shadowDepth},${alignment},0,0,${marginV},1`,
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
  ].join('\n');

  // ─── 4. Gerar eventos de diálogo ──────────────────────────────────────────
  if (cutWords.length === 0) {
    return header + '\n';
  }

  const dialogues: string[] = [];

  if (isKaraoke) {
    // Karaoke: agrupar palavras em linhas, cada linha tem duração total com \k por palavra
    const lines = groupWordsInLines(cutWords, style.max_words_per_line);
    for (const line of lines) {
      if (line.length === 0) continue;
      const lineStart = line[0].start;
      const lineEnd = line[line.length - 1].end;

      // Construir texto com tags \k (duração em centisegundos por palavra)
      const karaokeParts = line.map((w) => {
        const durationCs = Math.max(1, Math.round((w.end - w.start) * 100));
        const word = escapeAssText(applyTextCase(w.word, style.text_case));
        return `{\\k${durationCs}}${word}`;
      });

      const text = karaokeParts.join(' ');
      dialogues.push(
        `Dialogue: 0,${toAssTime(lineStart)},${toAssTime(lineEnd)},Default,,0,0,0,,${text}`
      );
    }
  } else {
    // Não-karaoke: agrupar em linhas, aplicar animação no início
    const lines = groupWordsInLines(cutWords, style.max_words_per_line);
    const animTags = buildAnimationTags(style.animation, style);

    for (const line of lines) {
      if (line.length === 0) continue;
      const lineStart = line[0].start;
      const lineEnd = line[line.length - 1].end;

      const rawText = line.map((w) => w.word).join(' ');
      const text = escapeAssText(applyTextCase(rawText, style.text_case));

      dialogues.push(
        `Dialogue: 0,${toAssTime(lineStart)},${toAssTime(lineEnd)},Default,,0,0,0,,${animTags}${text}`
      );
    }
  }

  return header + '\n' + dialogues.join('\n') + '\n';
}

// ---------------------------------------------------------------------------
// Helper: agrupamento de palavras em linhas
// ---------------------------------------------------------------------------

/**
 * Agrupa um array de WordTimestamp em grupos (linhas) de no máximo N palavras.
 * Mantém timestamps originais (relativos ao corte).
 */
function groupWordsInLines(
  words: WordTimestamp[],
  maxWordsPerLine: number
): WordTimestamp[][] {
  const lines: WordTimestamp[][] = [];
  const n = Math.max(1, maxWordsPerLine);

  for (let i = 0; i < words.length; i += n) {
    lines.push(words.slice(i, i + n));
  }

  return lines;
}
