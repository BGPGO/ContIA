// src/types/captions.ts
// Tipos canônicos de Legendas Virais DIY — Fase 1

import type { SubtitleStyle } from './video';

// Unions
export type AnimationType =
  | 'none' | 'fade' | 'pop-in' | 'pop-scale' | 'bounce-aggressive'
  | 'word-fade' | 'color-switch' | 'pill-slide-in' | 'scale-keyword'
  | 'char-by-char' | 'fade-soft' | 'glow-pulse';

export type TextCase = 'upper' | 'lower' | 'title' | 'sentence';
export type CaptionCategory = 'viral' | 'minimal' | 'entertainment' | 'business' | 'aesthetic';
export type CaptionPosition = 'top' | 'upper-third' | 'center' | 'lower-third' | 'bottom';
export type BackgroundType = 'none' | 'pill' | 'box';
export type KeywordEmphasis = 'color-only' | 'supersize' | 'pill' | 'glow' | 'stroke-color';

export interface CaptionStyle {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: CaptionCategory;

  is_preset: boolean;
  empresa_id: string | null;
  user_id: string | null;
  cloned_from: string | null;

  font_family: string;
  font_url: string | null;
  font_weight: number;
  text_case: TextCase;

  color_base: string;
  color_keyword: string;
  color_stroke: string | null;
  stroke_width: number;

  background_type: BackgroundType;
  background_color: string | null;

  position: CaptionPosition;
  animation: AnimationType;

  keyword_emphasis: KeywordEmphasis;
  supersize_multiplier: number;

  max_words_per_line: number;
  use_brand_colors: boolean;
  use_primary_font: boolean;

  preview_video_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface WordTimestamp {
  word: string;
  start: number;
  end: number;
  confidence?: number;
}

export interface Keyword {
  word: string;
  importance: 1 | 2 | 3;
  emoji?: string;
}

export const CAPTION_CATEGORIES: Record<CaptionCategory, string> = {
  viral: 'Viral',
  minimal: 'Minimal',
  entertainment: 'Entretenimento',
  business: 'Negócios',
  aesthetic: 'Estética',
};

// Mapper de compatibilidade → SubtitleStyle antigo (para VideoPlayer atual refletir escolha)
export function captionStyleToLegacySubtitleStyle(cs: CaptionStyle): SubtitleStyle {
  const fontSize: SubtitleStyle['fontSize'] =
    cs.supersize_multiplier >= 1.5 ? 'xl'
    : cs.font_weight >= 800 ? 'lg'
    : cs.font_weight >= 500 ? 'md'
    : 'sm';

  const fontWeight: SubtitleStyle['fontWeight'] =
    cs.font_weight >= 800 ? 'extrabold'
    : cs.font_weight >= 600 ? 'bold'
    : 'normal';

  const position: SubtitleStyle['position'] =
    cs.position === 'top' ? 'top'
    : cs.position === 'center' || cs.position === 'upper-third' ? 'center'
    : 'bottom';

  const animation: SubtitleStyle['animation'] =
    cs.animation === 'fade' || cs.animation === 'fade-soft' || cs.animation === 'word-fade' ? 'fade'
    : cs.animation === 'pop-in' || cs.animation === 'pop-scale' || cs.animation === 'bounce-aggressive' || cs.animation === 'scale-keyword' ? 'pop'
    : 'none';

  const f = cs.font_family.toLowerCase();
  const fontFamily: SubtitleStyle['fontFamily'] =
    f.includes('mono') ? 'mono'
    : f.includes('serif') || f.includes('playfair') || f.includes('merriweather') ? 'serif'
    : 'sans';

  return {
    fontSize,
    color: cs.color_base,
    bgColor: cs.background_color ?? 'transparent',
    fontWeight,
    position,
    animation,
    fontFamily,
  };
}

export type { SubtitleStyle };
