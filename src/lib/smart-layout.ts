import type { CopyContent } from "@/types/copy-studio";

// ═══════════════════════════════════════════════════════════════
// DESIGN SYSTEM CONSTANTS
// ═══════════════════════════════════════════════════════════════

interface BrandPalette {
  background: string;
  text: string;
  accent: string;
  muted: string;
  cardBg: string;
  cardBorder: string;
}

const DEFAULT_PALETTE: BrandPalette = {
  background: "#080c1a",
  text: "#e0e4f0",
  accent: "#3b82f6",
  muted: "#6b7094",
  cardBg: "#111528",
  cardBorder: "#1e2348",
};

const DIMS: Record<string, { w: number; h: number }> = {
  "1:1": { w: 1080, h: 1080 },
  "4:5": { w: 1080, h: 1350 },
  "9:16": { w: 1080, h: 1920 },
};

const MARGIN = { left: 60, right: 60, top: 50, bottom: 40 };
const SECTION_GAP = 28;
const CARD_PADDING = 24;
const CARD_RADIUS = 12;

// ═══════════════════════════════════════════════════════════════
// FABRIC OBJECT BUILDERS
// ═══════════════════════════════════════════════════════════════

function textObj(props: {
  left: number; top: number; width: number;
  text: string; fontSize: number; fontWeight?: string;
  fill?: string; opacity?: number; textAlign?: string;
  lineHeight?: number; charSpacing?: number;
  fontStyle?: string; role?: string;
}): object {
  return {
    type: "Textbox",
    left: props.left,
    top: props.top,
    width: props.width,
    text: props.text,
    fontSize: props.fontSize,
    fontFamily: "Inter, Helvetica, Arial, sans-serif",
    fontWeight: props.fontWeight || "400",
    fill: props.fill || "#e0e4f0",
    opacity: props.opacity ?? 1,
    textAlign: props.textAlign || "left",
    lineHeight: props.lineHeight || 1.3,
    charSpacing: props.charSpacing || 0,
    fontStyle: props.fontStyle || "normal",
    splitByGrapheme: false,
    data: { role: props.role || "body", editable: true },
  };
}

function rectObj(props: {
  left: number; top: number; width: number; height: number;
  fill?: string; stroke?: string; strokeWidth?: number;
  rx?: number; ry?: number; opacity?: number; role?: string;
}): object {
  return {
    type: "Rect",
    left: props.left,
    top: props.top,
    width: props.width,
    height: props.height,
    fill: props.fill || "transparent",
    stroke: props.stroke || "transparent",
    strokeWidth: props.strokeWidth || 0,
    rx: props.rx || 0,
    ry: props.ry || 0,
    opacity: props.opacity ?? 1,
    selectable: false,
    data: { role: props.role || "decoration" },
  };
}

function circleObj(props: {
  left: number; top: number; radius: number;
  fill?: string; opacity?: number;
}): object {
  return {
    type: "Circle",
    left: props.left,
    top: props.top,
    radius: props.radius,
    fill: props.fill || "#3b82f6",
    opacity: props.opacity ?? 1,
    selectable: false,
    data: { role: "decoration" },
  };
}

// ═══════════════════════════════════════════════════════════════
// HEADLINE WITH HIGHLIGHTS
// ═══════════════════════════════════════════════════════════════

// Strategy: Split headline into stacked text blocks — white for normal text,
// accent color for highlighted portions. Many top IG creators use this two-color
// headline approach for visual impact.

function buildHeadlineObjects(
  headline: string,
  highlights: string[],
  left: number, top: number, width: number,
  fontSize: number, palette: BrandPalette
): { objects: object[]; bottomY: number } {
  const objects: object[] = [];

  if (highlights.length === 0) {
    objects.push(textObj({
      left, top, width, text: headline,
      fontSize, fontWeight: "900", fill: palette.text,
      lineHeight: 1.05, role: "headline",
    }));
    const estimatedLines = Math.ceil(headline.length * fontSize * 0.5 / width) + 1;
    const bottomY = top + estimatedLines * fontSize * 1.05;
    return { objects, bottomY };
  }

  // Find the highlight phrase in the headline
  const highlightPhrase = highlights.join(" ");
  const idx = headline.toLowerCase().indexOf(highlightPhrase.toLowerCase());

  if (idx === -1) {
    // Highlight not found — render all white
    objects.push(textObj({
      left, top, width, text: headline,
      fontSize, fontWeight: "900", fill: palette.text,
      lineHeight: 1.05, role: "headline",
    }));
    const estimatedLines = Math.ceil(headline.length * fontSize * 0.5 / width) + 1;
    return { objects, bottomY: top + estimatedLines * fontSize * 1.05 };
  }

  // Split into before / highlighted / after and render as stacked blocks
  const before = headline.slice(0, idx).trim();
  const highlighted = headline.slice(idx, idx + highlightPhrase.length);
  const after = headline.slice(idx + highlightPhrase.length).trim();

  let currentY = top;

  if (before) {
    objects.push(textObj({
      left, top: currentY, width, text: before,
      fontSize, fontWeight: "900", fill: palette.text,
      lineHeight: 1.05, role: "headline",
    }));
    const lines = Math.ceil(before.length * fontSize * 0.52 / width);
    currentY += Math.max(1, lines) * fontSize * 1.05;
  }

  // Highlighted part in accent color
  objects.push(textObj({
    left, top: currentY, width, text: highlighted,
    fontSize, fontWeight: "900", fill: palette.accent,
    lineHeight: 1.05, role: "headline",
  }));
  const hlLines = Math.ceil(highlighted.length * fontSize * 0.52 / width);
  currentY += Math.max(1, hlLines) * fontSize * 1.05;

  if (after) {
    objects.push(textObj({
      left, top: currentY, width, text: after,
      fontSize, fontWeight: "900", fill: palette.text,
      lineHeight: 1.05, role: "headline",
    }));
    const aLines = Math.ceil(after.length * fontSize * 0.52 / width);
    currentY += Math.max(1, aLines) * fontSize * 1.05;
  }

  return { objects, bottomY: currentY };
}

// ═══════════════════════════════════════════════════════════════
// SECTION RENDERERS
// TODO: type section parameters properly when RichSlide types are
//       imported directly (currently using any for flexibility)
// ═══════════════════════════════════════════════════════════════

function renderParagraph(
  section: any, // SlideSection
  left: number, y: number, width: number,
  palette: BrandPalette
): { objects: object[]; height: number } {
  const objects: object[] = [];
  if (!section.content || section.content.length === 0) return { objects, height: 0 };

  const fullText = section.content.map((seg: any) => seg.text).join("");

  objects.push(textObj({
    left, top: y, width, text: fullText,
    fontSize: 26, fill: palette.text, opacity: 0.75,
    lineHeight: 1.5, role: "body",
  }));

  const estimatedLines = Math.ceil(fullText.length * 13 / width) + 1;
  const height = estimatedLines * 26 * 1.5;

  return { objects, height: Math.max(height, 50) };
}

function renderStat(
  section: any,
  left: number, y: number, width: number,
  palette: BrandPalette
): { objects: object[]; height: number } {
  const objects: object[] = [];
  if (!section.stat) return { objects, height: 0 };

  const stat = section.stat;

  // Stat value — big and accent colored
  objects.push(textObj({
    left, top: y, width, text: stat.value,
    fontSize: 56, fontWeight: "800", fill: palette.accent,
    lineHeight: 1.1, role: "body",
  }));

  // Stat label
  objects.push(textObj({
    left, top: y + 65, width, text: stat.label,
    fontSize: 24, fill: palette.text, opacity: 0.7,
    lineHeight: 1.3, role: "body",
  }));

  let height = 100;

  // Source
  if (stat.source) {
    objects.push(textObj({
      left, top: y + 100, width, text: stat.source,
      fontSize: 18, fill: palette.muted, opacity: 0.5,
      role: "body",
    }));
    height = 130;
  }

  return { objects, height };
}

function renderCallout(
  section: any,
  left: number, y: number, width: number,
  palette: BrandPalette
): { objects: object[]; height: number } {
  const objects: object[] = [];
  if (!section.callout) return { objects, height: 0 };

  const callout = section.callout;
  const textLen = callout.text.length;
  const innerWidth = width - CARD_PADDING * 2 - 8;
  const estimatedLines = Math.ceil(textLen * 12 / innerWidth) + 1;
  const textHeight = estimatedLines * 24 * 1.4;
  const cardHeight = textHeight + CARD_PADDING * 2;

  // Card background with border
  objects.push(rectObj({
    left, top: y, width, height: cardHeight,
    fill: palette.cardBg,
    stroke: palette.cardBorder,
    strokeWidth: 1.5,
    rx: CARD_RADIUS, ry: CARD_RADIUS,
  }));

  // Left accent bar inside card
  objects.push(rectObj({
    left: left + 2, top: y + CARD_PADDING,
    width: 3, height: cardHeight - CARD_PADDING * 2,
    fill: palette.accent,
    opacity: 0.6,
  }));

  // Callout text
  objects.push(textObj({
    left: left + CARD_PADDING + 8, top: y + CARD_PADDING,
    width: innerWidth,
    text: callout.text,
    fontSize: 24, fill: palette.text, opacity: 0.85,
    lineHeight: 1.4, fontStyle: "italic",
    role: "body",
  }));

  // Attribution
  if (callout.attribution) {
    objects.push(textObj({
      left: left + CARD_PADDING + 8, top: y + cardHeight - CARD_PADDING - 16,
      width: width - CARD_PADDING * 2,
      text: `— ${callout.attribution}`,
      fontSize: 18, fill: palette.muted,
      role: "body",
    }));
  }

  return { objects, height: cardHeight };
}

function renderList(
  section: any,
  left: number, y: number, width: number,
  palette: BrandPalette
): { objects: object[]; height: number } {
  const objects: object[] = [];
  if (!section.items || section.items.length === 0) return { objects, height: 0 };

  let currentY = y;

  for (const item of section.items) {
    const prefix = item.date || "●";
    const hasDate = !!item.date;
    const indentLeft = hasDate ? 220 : 30;

    objects.push(textObj({
      left, top: currentY, width: 200,
      text: prefix,
      fontSize: 22, fontWeight: "700", fill: palette.accent,
      role: "body",
    }));

    // Title (bold)
    objects.push(textObj({
      left: left + indentLeft, top: currentY,
      width: width - indentLeft,
      text: item.title,
      fontSize: 24, fontWeight: "700", fill: palette.text,
      lineHeight: 1.3, role: "body",
    }));

    currentY += 32;

    // Description
    if (item.description) {
      objects.push(textObj({
        left: left + indentLeft, top: currentY,
        width: width - indentLeft,
        text: item.description,
        fontSize: 22, fill: palette.text, opacity: 0.65,
        lineHeight: 1.4, role: "body",
      }));
      const descLines = Math.ceil(item.description.length * 11 / (width - indentLeft)) + 1;
      currentY += descLines * 22 * 1.4;
    }

    currentY += 16; // gap between items
  }

  return { objects, height: currentY - y };
}

function renderDivider(
  left: number, y: number, width: number,
  palette: BrandPalette
): { objects: object[]; height: number } {
  return {
    objects: [rectObj({
      left, top: y + 10, width: width * 0.3, height: 1.5,
      fill: palette.accent, opacity: 0.3,
    })],
    height: 24,
  };
}

function renderCtaButton(
  section: any,
  left: number, y: number, width: number,
  palette: BrandPalette
): { objects: object[]; height: number } {
  const objects: object[] = [];

  const btnText = section.buttonText || "SAIBA MAIS";
  const btnWidth = Math.min(width * 0.7, 500);
  const btnHeight = 56;
  const btnLeft = left + (width - btnWidth) / 2;

  // Button outline
  objects.push(rectObj({
    left: btnLeft, top: y,
    width: btnWidth, height: btnHeight,
    fill: "transparent",
    stroke: palette.accent,
    strokeWidth: 2,
    rx: 8, ry: 8,
  }));

  // Button text
  objects.push(textObj({
    left: btnLeft, top: y + 14,
    width: btnWidth,
    text: `▸  ${btnText}`,
    fontSize: 22, fontWeight: "700", fill: palette.accent,
    textAlign: "center", charSpacing: 200,
    role: "cta",
  }));

  let height = btnHeight + 8;

  // Subtext
  if (section.buttonSubtext) {
    objects.push(textObj({
      left, top: y + btnHeight + 16, width,
      text: section.buttonSubtext,
      fontSize: 20, fill: palette.muted, opacity: 0.6,
      textAlign: "center", role: "body",
    }));
    height += 36;
  }

  return { objects, height };
}

// ═══════════════════════════════════════════════════════════════
// DOT NAVIGATION (bottom of each slide)
// ═══════════════════════════════════════════════════════════════

function renderDots(
  totalSlides: number, currentSlide: number,
  centerX: number, y: number, palette: BrandPalette
): object[] {
  if (totalSlides <= 1) return [];
  const dotRadius = 4;
  const dotGap = 14;
  const totalWidth = (totalSlides - 1) * dotGap;
  const startX = centerX - totalWidth / 2;

  return Array.from({ length: totalSlides }, (_, i) => circleObj({
    left: startX + i * dotGap - dotRadius,
    top: y,
    radius: dotRadius,
    fill: i === currentSlide ? palette.accent : palette.muted,
    opacity: i === currentSlide ? 1 : 0.3,
  }));
}

// ═══════════════════════════════════════════════════════════════
// SECTION DISPATCHER
// ═══════════════════════════════════════════════════════════════

function renderSection(
  section: any,
  left: number, y: number, width: number,
  palette: BrandPalette
): { objects: object[]; height: number } {
  switch (section.type) {
    case "paragraph":
      return renderParagraph(section, left, y, width, palette);
    case "stat":
      return renderStat(section, left, y, width, palette);
    case "callout":
      return renderCallout(section, left, y, width, palette);
    case "list":
      return renderList(section, left, y, width, palette);
    case "divider":
      return renderDivider(left, y, width, palette);
    case "cta-button":
      return renderCtaButton(section, left, y, width, palette);
    default:
      return { objects: [], height: 0 };
  }
}

// ═══════════════════════════════════════════════════════════════
// SLIDE GENERATORS BY TYPE
// ═══════════════════════════════════════════════════════════════

function generateCoverSlide(
  slide: any, // TODO: type properly when RichSlide types land
  w: number, h: number,
  totalSlides: number,
  palette: BrandPalette
): object {
  const objects: object[] = [];
  const contentWidth = w - MARGIN.left - MARGIN.right;
  let y = MARGIN.top;

  // Tag
  if (slide.tag) {
    objects.push(textObj({
      left: MARGIN.left, top: y, width: contentWidth,
      text: slide.tag,
      fontSize: 20, fontWeight: "600", fill: palette.muted,
      charSpacing: 300, role: "category",
    }));
    y += 44;
  }

  // Large headline with highlights
  const hlWords = slide.headlineHighlights || [];
  const headlineFontSize = slide.headline.length > 40 ? 64 : slide.headline.length > 25 ? 72 : 88;
  const { objects: hlObjs, bottomY } = buildHeadlineObjects(
    slide.headline, hlWords, MARGIN.left, y, contentWidth, headlineFontSize, palette
  );
  objects.push(...hlObjs);
  y = bottomY + 24;

  // Render sections (usually just a subtitle paragraph on cover)
  if (slide.sections) {
    for (const section of slide.sections) {
      if (section.type === "cta-button") {
        // Position "Deslize para explorar" near bottom
        const result = renderCtaButton(section, MARGIN.left, Math.max(y, h - 140), contentWidth, palette);
        objects.push(...result.objects);
      } else {
        const result = renderSection(section, MARGIN.left, y, contentWidth, palette);
        objects.push(...result.objects);
        y += result.height + SECTION_GAP;
      }
    }
  }

  // Dots at bottom
  objects.push(...renderDots(totalSlides, 0, w / 2, h - MARGIN.bottom, palette));

  return { version: "6.0.0", objects, background: palette.background };
}

function generateContentSlide(
  slide: any, slideIndex: number,
  w: number, h: number, totalSlides: number,
  palette: BrandPalette
): object {
  const objects: object[] = [];
  const contentWidth = w - MARGIN.left - MARGIN.right;
  let y = MARGIN.top;

  // Tag
  if (slide.tag) {
    objects.push(textObj({
      left: MARGIN.left, top: y, width: contentWidth,
      text: `● ${slide.tag}`,
      fontSize: 18, fontWeight: "600", fill: palette.muted,
      charSpacing: 200, role: "category",
    }));
    y += 38;
  }

  // Headline
  const hlWords = slide.headlineHighlights || [];
  const fontSize = slide.headline.length > 50 ? 42 : slide.headline.length > 30 ? 48 : 56;
  const { objects: hlObjs, bottomY } = buildHeadlineObjects(
    slide.headline, hlWords, MARGIN.left, y, contentWidth, fontSize, palette
  );
  objects.push(...hlObjs);
  y = bottomY + 20;

  // Sections
  if (slide.sections) {
    for (const section of slide.sections) {
      const result = renderSection(section, MARGIN.left, y, contentWidth, palette);
      objects.push(...result.objects);
      y += result.height + SECTION_GAP;
    }
  }

  // Footnote
  if (slide.footnote) {
    objects.push(textObj({
      left: MARGIN.left, top: h - MARGIN.bottom - 28, width: contentWidth,
      text: slide.footnote,
      fontSize: 18, fill: palette.muted, opacity: 0.4,
      role: "body",
    }));
  }

  // Dots
  objects.push(...renderDots(totalSlides, slideIndex, w / 2, h - MARGIN.bottom, palette));

  return { version: "6.0.0", objects, background: palette.background };
}

function generateDataSlide(
  slide: any, slideIndex: number,
  w: number, h: number, totalSlides: number,
  palette: BrandPalette
): object {
  // Data slides reuse the versatile content renderer with emphasis on stats
  return generateContentSlide(slide, slideIndex, w, h, totalSlides, palette);
}

function generateCtaSlide(
  slide: any, slideIndex: number,
  w: number, h: number, totalSlides: number,
  palette: BrandPalette
): object {
  const objects: object[] = [];
  const contentWidth = w - MARGIN.left - MARGIN.right;

  // CTA slides center content vertically
  const headlineFontSize = slide.headline.length > 40 ? 56 : 72;
  const hlWords = slide.headlineHighlights || [];

  // Position headline at ~25% from top
  const { objects: hlObjs, bottomY } = buildHeadlineObjects(
    slide.headline, hlWords, MARGIN.left, h * 0.2, contentWidth, headlineFontSize, palette
  );
  objects.push(...hlObjs);

  let y = bottomY + 24;

  // Sections
  if (slide.sections) {
    for (const section of slide.sections) {
      if (section.type === "cta-button") {
        // Position CTA button in lower third
        const btnY = Math.max(y + 20, h * 0.65);
        const result = renderCtaButton(section, MARGIN.left, btnY, contentWidth, palette);
        objects.push(...result.objects);
        y = btnY + result.height + SECTION_GAP;
      } else {
        const result = renderSection(section, MARGIN.left, y, contentWidth, palette);
        objects.push(...result.objects);
        y += result.height + SECTION_GAP;
      }
    }
  }

  // Footnote (brand handle)
  if (slide.footnote) {
    objects.push(textObj({
      left: MARGIN.left, top: h - MARGIN.bottom - 28, width: contentWidth,
      text: slide.footnote,
      fontSize: 18, fill: palette.muted, opacity: 0.4,
      textAlign: "center", role: "brand",
    }));
  }

  // Dots
  objects.push(...renderDots(totalSlides, slideIndex, w / 2, h - MARGIN.bottom, palette));

  return { version: "6.0.0", objects, background: palette.background };
}

// ═══════════════════════════════════════════════════════════════
// MAIN: Generate carousel from rich slides
// ═══════════════════════════════════════════════════════════════

export interface SmartLayoutOptions {
  aspectRatio: "1:1" | "4:5" | "9:16";
  brandColors?: { primary?: string; secondary?: string };
  brandName?: string;
}

export function generateRichCarousel(
  richSlides: any[], // TODO: type properly when RichSlide types land
  options: SmartLayoutOptions
): object[] {
  const { w, h } = DIMS[options.aspectRatio] || DIMS["1:1"];

  const palette: BrandPalette = {
    ...DEFAULT_PALETTE,
    accent: options.brandColors?.primary || DEFAULT_PALETTE.accent,
  };

  const totalSlides = richSlides.length;

  return richSlides.map((slide, i) => {
    const type = slide.contentType || "content";

    switch (type) {
      case "cover":
        return generateCoverSlide(slide, w, h, totalSlides, palette);
      case "cta":
        return generateCtaSlide(slide, i, w, h, totalSlides, palette);
      case "data":
        return generateDataSlide(slide, i, w, h, totalSlides, palette);
      default:
        // content, timeline, quote, list — all use the versatile content renderer
        return generateContentSlide(slide, i, w, h, totalSlides, palette);
    }
  });
}

// ═══════════════════════════════════════════════════════════════
// BACKWARD-COMPATIBLE EXPORTS
// These match the signatures expected by the editor page
// ═══════════════════════════════════════════════════════════════

export function generateSmartLayout(
  copy: CopyContent,
  brand: { primaryColor?: string; secondaryColor?: string; brandName?: string },
  options: { aspectRatio: "1:1" | "4:5" | "9:16"; format?: string; style?: string }
): object {
  // If richSlides exist, use the first one
  if (copy.richSlides && copy.richSlides.length > 0) {
    const slides = generateRichCarousel(copy.richSlides, {
      aspectRatio: options.aspectRatio,
      brandColors: { primary: brand.primaryColor, secondary: brand.secondaryColor },
      brandName: brand.brandName,
    });
    return slides[0];
  }

  // Fallback: create a simple cover from basic fields
  const { w, h } = DIMS[options.aspectRatio] || DIMS["1:1"];
  const palette: BrandPalette = {
    ...DEFAULT_PALETTE,
    accent: brand.primaryColor || DEFAULT_PALETTE.accent,
  };

  const fakeSlide = {
    slideNumber: 1,
    contentType: "cover" as const,
    headline: copy.headline || "Headline",
    headlineHighlights: [] as string[],
    sections: copy.caption ? [{
      type: "paragraph" as const,
      content: [{ text: copy.caption }],
    }] : [],
  };

  return generateCoverSlide(fakeSlide, w, h, 1, palette);
}

export function generateCarouselLayout(
  copy: CopyContent,
  brand: { primaryColor?: string; secondaryColor?: string; brandName?: string },
  options: { aspectRatio: "1:1" | "4:5" | "9:16"; format?: string }
): object[] {
  // Use richSlides if available
  if (copy.richSlides && copy.richSlides.length > 0) {
    return generateRichCarousel(copy.richSlides, {
      aspectRatio: options.aspectRatio,
      brandColors: { primary: brand.primaryColor, secondary: brand.secondaryColor },
      brandName: brand.brandName,
    });
  }

  // Fallback: convert basic CopySlide[] to rich slide format
  if (copy.slides && copy.slides.length > 0) {
    const fakeRich = copy.slides.map((slide, i) => ({
      slideNumber: slide.slideNumber || i + 1,
      contentType: i === 0 ? "cover" : i === copy.slides!.length - 1 ? "cta" : "content",
      headline: slide.headline,
      headlineHighlights: slide.headlineHighlights || [],
      tag: slide.tag,
      sections: slide.sections || [{
        type: "paragraph",
        content: [{ text: slide.body }],
      }],
      footnote: slide.footnote,
    }));

    return generateRichCarousel(fakeRich, {
      aspectRatio: options.aspectRatio,
      brandColors: { primary: brand.primaryColor, secondary: brand.secondaryColor },
      brandName: brand.brandName,
    });
  }

  // Single slide fallback
  return [generateSmartLayout(copy, brand, options)];
}
