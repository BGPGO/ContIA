import templatesData from './templates-data.json';

export interface TemplateTextLayer {
  id: string;
  name: string;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  opacity: number;
  fontFamily?: string;
  fontSize?: number;
  fontColor?: string;
  fontWeight?: string;
  fontStyle?: string;
  lineHeight?: number;
  alignment?: 'left' | 'center' | 'right';
  tracking?: number;
  numLines?: number;
  fauxBold?: boolean;
  fauxItalic?: boolean;
  slide?: number;
  slideX?: number;
}

export interface PsdTemplate {
  id: string;
  name: string;
  fileName: string;
  width: number;
  height: number;
  format: 'feed' | 'story' | 'carousel';
  slides: number;
  slideWidth: number;
  slideHeight: number;
  thumbnail: string;
  background: string;
  fullComposite: string;
  fonts: string[];
  colors: string[];
  textLayers: TemplateTextLayer[];
  slideAssets?: {
    composites: string[];
    backgrounds: string[];
  };
}

export const FONT_MAP: Record<string, { family: string; weight: number; style: string }> = {
  'Formula1-Display-Bold': { family: 'Formula1 Display', weight: 700, style: 'normal' },
  'Formula1-Display-Regular': { family: 'Formula1 Display', weight: 400, style: 'normal' },
  'Poppins-SemiBold': { family: 'Poppins', weight: 600, style: 'normal' },
  'Poppins-ExtraLight': { family: 'Poppins', weight: 200, style: 'normal' },
  'AlmarenaNeue-Regular': { family: 'Almarena Neue', weight: 400, style: 'normal' },
};

export function getFontCSS(psdFontName?: string): { fontFamily: string; fontWeight: number; fontStyle: string } {
  if (!psdFontName) return { fontFamily: 'Poppins, sans-serif', fontWeight: 400, fontStyle: 'normal' };
  const mapped = FONT_MAP[psdFontName];
  if (mapped) return { fontFamily: `'${mapped.family}', sans-serif`, fontWeight: mapped.weight, fontStyle: mapped.style };
  return { fontFamily: 'Poppins, sans-serif', fontWeight: 400, fontStyle: 'normal' };
}

export function getPsdTemplates(): PsdTemplate[] {
  return templatesData as PsdTemplate[];
}

export function getPsdTemplateById(id: string): PsdTemplate | undefined {
  return (templatesData as PsdTemplate[]).find(t => t.id === id);
}
