// src/lib/captions/registry.ts
import type React from 'react';
import type { CaptionStyle, WordTimestamp, Keyword } from '@/types/captions';

import { HormoziClassic } from '@/components/video/captions/styles/HormoziClassic';
import { MrBeast } from '@/components/video/captions/styles/MrBeast';
import { AliMinimal } from '@/components/video/captions/styles/AliMinimal';
import { KaraokeClassic } from '@/components/video/captions/styles/KaraokeClassic';

export interface StyleProps {
  word: WordTimestamp;
  isActive: boolean;
  isKeyword: boolean;
  keyword?: Keyword;
  style: CaptionStyle;
  currentSec: number;
}

export const STYLE_COMPONENTS: Record<string, React.FC<StyleProps>> = {
  'hormozi-classic': HormoziClassic,
  'mrbeast-beast': MrBeast,
  'ali-minimal': AliMinimal,
  'karaoke-classic': KaraokeClassic,
};

export function getStyleComponent(slug: string): React.FC<StyleProps> {
  return STYLE_COMPONENTS[slug] ?? HormoziClassic;
}
