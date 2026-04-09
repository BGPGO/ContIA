/* ═══════════════════════════════════════════════════════════════════════════
   PSD Template → Fabric.js v6 JSON Converter

   Converts PsdTemplate data (extracted from PSDs) into Fabric.js canvas JSON
   that can be loaded with canvas.loadFromJSON(). Every text element carries
   `data: { role, editable }` for the copy injection system.

   Background images are loaded as Fabric.js Image objects at (0,0) filling
   the canvas, with selectable: false.
   ═══════════════════════════════════════════════════════════════════════════ */

import type { PsdTemplate, TemplateTextLayer } from './psd-templates';
import { FONT_MAP } from './psd-templates';
import type { CanvasElementRole } from '@/types/canvas';

/* ── Options ── */

export interface PsdToFabricOptions {
  slideIndex?: number;       // For carousels: which slide to render (default 0)
  sampleText?: Record<string, string>; // Optional text overrides by layer name/id
}

/* ── Font family mapping for Fabric.js ── */

function getFabricFont(psdFontName?: string): {
  fontFamily: string;
  fontWeight: string;
  fontStyle: string;
} {
  if (!psdFontName) {
    return { fontFamily: 'Poppins', fontWeight: '400', fontStyle: 'normal' };
  }
  const mapped = FONT_MAP[psdFontName];
  if (mapped) {
    return {
      fontFamily: mapped.family,
      fontWeight: String(mapped.weight),
      fontStyle: mapped.style,
    };
  }
  return { fontFamily: 'Poppins', fontWeight: '400', fontStyle: 'normal' };
}

/* ── Role inference from layer properties ── */

function inferRole(
  layer: TemplateTextLayer,
  allLayers: TemplateTextLayer[]
): CanvasElementRole {
  const name = layer.name.toLowerCase();
  const text = layer.text.toLowerCase();

  // Brand-specific keywords
  if (
    name.includes('resultado em') ||
    text.includes('resultado em') ||
    name.includes('movimento')
  ) {
    return 'brand';
  }

  // Explicit brand markers
  if (name.includes('bgp') && (layer.fontSize || 24) > 100) {
    return 'headline';
  }

  // Very small/short utility text
  if (name === "'" || (layer.text.length <= 2 && !(/\d/.test(layer.text)))) {
    return 'decoration';
  }

  // "Em breve" type CTAs
  if (name.includes('em breve') || text.includes('em breve')) {
    return 'cta';
  }

  // Sort layers by font size to determine relative roles
  const sizes = allLayers
    .map((l) => l.fontSize || 24)
    .sort((a, b) => b - a);
  const uniqueSizes = [...new Set(sizes)];
  const layerSize = layer.fontSize || 24;

  // Largest font → headline
  if (layerSize === uniqueSizes[0]) {
    return 'headline';
  }

  // Second largest → subheadline
  if (uniqueSizes.length > 1 && layerSize === uniqueSizes[1]) {
    // But if font is AlmarenaNeue (body font) treat as body
    if (layer.fontFamily === 'AlmarenaNeue-Regular') {
      return 'body';
    }
    return 'subheadline';
  }

  // AlmarenaNeue is used for body text in these templates
  if (layer.fontFamily === 'AlmarenaNeue-Regular') {
    return 'body';
  }

  // Poppins-ExtraLight → usually subtle/CTA text
  if (layer.fontFamily === 'Poppins-ExtraLight') {
    return 'cta';
  }

  // Default for remaining text
  return 'body';
}

/* ── Build a Fabric.js Textbox object from a PSD text layer ── */

function buildTextObject(
  layer: TemplateTextLayer,
  allLayers: TemplateTextLayer[],
  sampleText?: Record<string, string>
): object {
  const font = getFabricFont(layer.fontFamily);
  const role = inferRole(layer, allLayers);

  // Determine X position: for carousel slides use slideX
  const left = layer.slideX !== undefined ? layer.slideX : layer.x;
  const top = layer.y;

  // Text content: use sample override if available, else PSD text
  let text = layer.text;
  if (sampleText) {
    if (sampleText[layer.id]) {
      text = sampleText[layer.id];
    } else if (sampleText[layer.name]) {
      text = sampleText[layer.name];
    }
  }
  // Convert PSD line breaks (\r) to real newlines
  text = text.replace(/\r/g, '\n');

  // charSpacing: Fabric.js uses 1/1000 em units, PSD tracking is also in 1/1000 em
  // Fabric charSpacing is in 1/1000 of font size, same as PSD tracking
  const charSpacing = layer.tracking || 0;

  // Clamp font size to reasonable range (min 10px, max 120px for 1080-width canvas)
  const rawSize = layer.fontSize || 24;
  const fontSize = Math.max(10, Math.min(120, rawSize));

  return {
    type: 'Textbox',
    left,
    top,
    width: layer.width,
    text,
    fontSize,
    fontFamily: font.fontFamily,
    fontWeight: font.fontWeight,
    fontStyle: layer.fauxItalic ? 'italic' : font.fontStyle,
    fill: layer.fontColor || '#ffffff',
    textAlign: layer.alignment || 'left',
    charSpacing,
    lineHeight: layer.lineHeight || 1.2,
    opacity: layer.opacity ?? 1,
    selectable: true,
    editable: true,
    // Prevent auto-resize of width
    splitByGrapheme: false,
    data: {
      id: layer.id,
      role,
      editable: true,
      psdLayerName: layer.name,
    },
  };
}

/* ── Build the background image object ── */

function buildBackgroundImageObject(
  imageUrl: string,
  width: number,
  height: number
): object {
  return {
    type: 'Image',
    left: 0,
    top: 0,
    width,
    height,
    scaleX: 1,
    scaleY: 1,
    src: imageUrl,
    crossOrigin: 'anonymous',
    selectable: false,
    evented: false,
    data: {
      role: 'background-image',
      editable: false,
    },
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   convertPsdToFabricJson — Single slide conversion
   ═══════════════════════════════════════════════════════════════════════════ */

export function convertPsdToFabricJson(
  template: PsdTemplate,
  options?: PsdToFabricOptions
): object {
  const slideIndex = options?.slideIndex ?? 0;
  const sampleText = options?.sampleText;

  const canvasWidth = template.slideWidth || template.width;
  const canvasHeight = template.slideHeight || template.height;

  // Determine background image URL
  let bgUrl: string | null = null;
  if (
    template.format === 'carousel' &&
    template.slideAssets?.backgrounds?.[slideIndex]
  ) {
    bgUrl = template.slideAssets.backgrounds[slideIndex];
  } else {
    bgUrl = template.background;
  }

  const objects: object[] = [];

  // 1. Background image
  if (bgUrl) {
    objects.push(buildBackgroundImageObject(bgUrl, canvasWidth, canvasHeight));
  }

  // 2. Filter text layers for this slide
  let layers: TemplateTextLayer[];
  if (template.format === 'carousel') {
    layers = template.textLayers.filter((l) => l.slide === slideIndex);
  } else {
    layers = template.textLayers;
  }

  // 3. Build text objects
  for (const layer of layers) {
    objects.push(buildTextObject(layer, layers, sampleText));
  }

  return {
    version: '6.0.0',
    objects,
    background: '#000000',
    width: canvasWidth,
    height: canvasHeight,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   convertPsdCarouselToFabricSlides — All slides for a carousel
   ═══════════════════════════════════════════════════════════════════════════ */

export function convertPsdCarouselToFabricSlides(
  template: PsdTemplate,
  sampleText?: Record<string, string>
): object[] {
  const slideCount = template.slides || 1;
  const slides: object[] = [];

  for (let i = 0; i < slideCount; i++) {
    slides.push(
      convertPsdToFabricJson(template, { slideIndex: i, sampleText })
    );
  }

  return slides;
}
