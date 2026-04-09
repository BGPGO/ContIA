/* ═══════════════════════════════════════════════════════════════════════════
   Template Converter — TemplateStyleConfig → Fabric.js v6 JSON

   Converts the existing config-driven template system into Fabric.js canvas
   JSON that can be loaded with canvas.loadFromJSON(). Every text element
   carries `data: { role, editable }` for the copy injection system.
   ═══════════════════════════════════════════════════════════════════════════ */

import type { TemplateStyleConfig } from "@/types/custom-template";
import type { CopyToTemplatePayload, CanvasElementRole, ContiaObjectData } from "@/types/canvas";
import { CANVAS_DIMENSIONS } from "@/types/canvas";

// ── Helpers ──

function rgba(hex: string, a: number): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

/** Scale a preview-space value (400px base) to canvas-space (1080px base) */
const S = 1080 / 400;

function objData(role: CanvasElementRole, editable = false, locked = false): ContiaObjectData {
  return { role, editable, locked };
}

// ── Fabric.js object factories ──

interface FabricObj {
  type: string;
  [key: string]: unknown;
}

function makeRect(props: Record<string, unknown>): FabricObj {
  return {
    type: "Rect",
    left: 0,
    top: 0,
    width: 1080,
    height: 1080,
    fill: "#000000",
    selectable: false,
    evented: false,
    ...props,
  };
}

function makeTextbox(
  text: string,
  role: CanvasElementRole,
  props: Record<string, unknown>
): FabricObj {
  return {
    type: "Textbox",
    text,
    left: 0,
    top: 0,
    width: 960,
    fontSize: 48,
    fontWeight: "400",
    fontFamily: "Inter",
    fill: "#ffffff",
    textAlign: "left",
    lineHeight: 1.2,
    charSpacing: 0,
    selectable: true,
    editable: true,
    ...props,
    data: objData(role, true),
  };
}

function makeLine(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  props: Record<string, unknown>
): FabricObj {
  return {
    type: "Line",
    x1,
    y1,
    x2,
    y2,
    left: Math.min(x1, x2),
    top: Math.min(y1, y2),
    stroke: "#4ecdc4",
    strokeWidth: 4,
    selectable: false,
    evented: false,
    ...props,
    data: objData("decoration"),
  };
}

function makeCircle(props: Record<string, unknown>): FabricObj {
  return {
    type: "Circle",
    left: 0,
    top: 0,
    radius: 50,
    fill: "transparent",
    stroke: "#4ecdc4",
    strokeWidth: 2,
    opacity: 0.1,
    selectable: false,
    evented: false,
    ...props,
    data: objData("decoration"),
  };
}

function makeTriangle(props: Record<string, unknown>): FabricObj {
  return {
    type: "Triangle",
    left: 0,
    top: 0,
    width: 100,
    height: 100,
    fill: "transparent",
    selectable: false,
    evented: false,
    ...props,
    data: objData("decoration"),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// convertTemplateStyleToFabric
// ═══════════════════════════════════════════════════════════════════════════

export function convertTemplateStyleToFabric(
  config: TemplateStyleConfig,
  aspectRatio: "1:1" | "4:5" | "9:16",
  sampleData?: CopyToTemplatePayload
): object {
  const dim = CANVAS_DIMENSIONS[aspectRatio] || CANVAS_DIMENSIONS["1:1"];
  const W = dim.width;
  const H = dim.height;
  const accent = config.decorations.accentBarColor || "#4ecdc4";
  const objects: FabricObj[] = [];

  // ── 1. Background ──
  let bgFill: string | object = config.background.color || "#151826";

  if (config.background.type === "gradient" && config.background.gradientFrom && config.background.gradientTo) {
    const angle = (config.background.gradientAngle || 135) * (Math.PI / 180);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    bgFill = {
      type: "linear",
      coords: {
        x1: W / 2 - cos * W / 2,
        y1: H / 2 - sin * H / 2,
        x2: W / 2 + cos * W / 2,
        y2: H / 2 + sin * H / 2,
      },
      colorStops: [
        { offset: 0, color: config.background.gradientFrom },
        { offset: 1, color: config.background.gradientTo },
      ],
    };
  }

  objects.push(
    makeRect({
      width: W,
      height: H,
      fill: bgFill,
      data: objData("background"),
    })
  );

  // Dark overlay
  if (config.background.overlayOpacity && config.background.overlayOpacity > 0) {
    objects.push(
      makeRect({
        width: W,
        height: H,
        fill: rgba("#000000", config.background.overlayOpacity),
        data: objData("decoration"),
      })
    );
  }

  // ── 2. Decorations ──

  // Accent bar
  if (config.decorations.accentBar === "left") {
    objects.push(
      makeRect({
        left: 0,
        top: 0,
        width: Math.round(5 * S),
        height: H,
        fill: accent,
        data: objData("decoration"),
      })
    );
  } else if (config.decorations.accentBar === "top") {
    objects.push(
      makeRect({
        left: 0,
        top: 0,
        width: W,
        height: Math.round(4 * S),
        fill: accent,
        data: objData("decoration"),
      })
    );
  } else if (config.decorations.accentBar === "bottom") {
    objects.push(
      makeRect({
        left: 0,
        top: H - Math.round(4 * S),
        width: W,
        height: Math.round(4 * S),
        fill: accent,
        data: objData("decoration"),
      })
    );
  }

  // Corner accents
  if (config.decorations.cornerAccents) {
    const cs = Math.round(60 * S);
    // Top-left lines
    objects.push(
      makeLine(0, Math.round(20 * S), Math.round(20 * S), 0, {
        stroke: accent,
        strokeWidth: Math.round(2 * S),
        opacity: 0.3,
      })
    );
    objects.push(
      makeLine(0, Math.round(35 * S), Math.round(35 * S), 0, {
        stroke: accent,
        strokeWidth: Math.round(1 * S),
        opacity: 0.3,
      })
    );
    // Bottom-right lines
    objects.push(
      makeLine(W, H - Math.round(20 * S), W - Math.round(20 * S), H, {
        stroke: accent,
        strokeWidth: Math.round(2 * S),
        opacity: 0.3,
      })
    );
    objects.push(
      makeLine(W, H - Math.round(35 * S), W - Math.round(35 * S), H, {
        stroke: accent,
        strokeWidth: Math.round(1 * S),
        opacity: 0.3,
      })
    );
  }

  // Geometric frame
  if (config.decorations.geometricFrame) {
    const inset = Math.round(24 * S);
    objects.push(
      makeRect({
        left: inset,
        top: inset,
        width: W - inset * 2,
        height: H - inset * 2,
        fill: "transparent",
        stroke: "rgba(255,255,255,0.06)",
        strokeWidth: 1,
        data: objData("decoration"),
      })
    );
  }

  // Floating circles
  if (config.decorations.floatingCircles) {
    objects.push(
      makeCircle({
        left: Math.round(W * 0.75),
        top: Math.round(H * 0.15),
        radius: Math.round(80 * S / 2),
        stroke: "rgba(255,255,255,0.06)",
        strokeWidth: Math.round(2 * S),
        fill: "transparent",
        opacity: 1,
      })
    );
    objects.push(
      makeCircle({
        left: Math.round(W * 0.70),
        top: Math.round(H * 0.20),
        radius: Math.round(40 * S / 2),
        stroke: "rgba(255,255,255,0.08)",
        strokeWidth: Math.round(2 * S),
        fill: "transparent",
        opacity: 1,
      })
    );
  }

  // Radial glow (approximated with a large semi-transparent circle)
  if (config.decorations.radialGlow) {
    objects.push(
      makeCircle({
        left: W / 2 - Math.round(100 * S),
        top: H * 0.4 - Math.round(100 * S),
        radius: Math.round(100 * S),
        fill: rgba(accent, 0.06),
        stroke: "transparent",
        strokeWidth: 0,
        opacity: 1,
      })
    );
  }

  // Quote marks
  if (config.decorations.quoteMarks) {
    objects.push(
      makeTextbox("\u201C", "decoration", {
        left: Math.round(W * 0.08),
        top: Math.round(H * 0.06),
        width: Math.round(200 * S),
        fontSize: Math.round(140 * S),
        fontFamily: "Georgia",
        fill: rgba(accent, 0.06),
        selectable: false,
        editable: false,
        data: objData("decoration"),
      })
    );
  }

  // Background decorative text
  if (config.backgroundText?.content) {
    const bt = config.backgroundText;
    const fontSize = Math.round((bt.size || 200) * S);
    let left = W / 2;
    let top = H / 2;
    const originX = "center";
    const originY = "center";

    if (bt.position === "bottom-right") { left = W - Math.round(10 * S); top = H + Math.round(20 * S); }
    else if (bt.position === "top-left") { left = -Math.round(5 * S); top = -Math.round(15 * S); }
    else if (bt.position === "top-right") { left = W - Math.round(10 * S); top = -Math.round(15 * S); }
    else if (bt.position === "bottom-left") { left = -Math.round(5 * S); top = H + Math.round(20 * S); }

    const bgTextObj: FabricObj = {
      type: "Textbox",
      text: bt.content,
      left,
      top,
      originX,
      originY,
      width: fontSize * 2,
      fontSize,
      fontWeight: "900",
      fontFamily: "Inter",
      fill: bt.style === "outlined" ? "transparent" : (bt.color || accent),
      opacity: bt.opacity || 0.05,
      angle: bt.rotation || 0,
      selectable: false,
      editable: false,
      data: objData("decoration"),
    };

    if (bt.style === "outlined") {
      bgTextObj.stroke = bt.color || accent;
      bgTextObj.strokeWidth = Math.round(2 * S);
    }

    objects.push(bgTextObj);
  }

  // Slide indicator — large background number
  if (config.slideIndicator.show) {
    const slideText = sampleData?.slideNumber?.toString() || "{{slide-number}}";

    if (config.slideIndicator.style === "large-bg-number") {
      objects.push({
        type: "Textbox",
        text: slideText,
        left: W - Math.round(10 * S),
        top: H - Math.round(20 * S),
        originX: "right",
        originY: "bottom",
        width: Math.round(300 * S),
        fontSize: Math.round(220 * S),
        fontWeight: "900",
        fontFamily: "Inter",
        fill: "transparent",
        stroke: "rgba(255,255,255,0.04)",
        strokeWidth: Math.round(2 * S),
        selectable: false,
        editable: false,
        textAlign: "right",
        data: objData("slide-number", false),
      });
    } else if (config.slideIndicator.style === "outlined-number") {
      objects.push({
        type: "Textbox",
        text: slideText,
        left: Math.round(20 * S),
        top: H / 2,
        originY: "center",
        width: Math.round(200 * S),
        fontSize: Math.round(180 * S),
        fontWeight: "900",
        fontFamily: "Inter",
        fill: "transparent",
        stroke: "rgba(255,255,255,0.04)",
        strokeWidth: Math.round(2 * S),
        selectable: false,
        editable: false,
        data: objData("slide-number", false),
      });
    } else if (config.slideIndicator.style === "badge") {
      objects.push(
        makeRect({
          left: W - Math.round(70 * S),
          top: Math.round(16 * S),
          width: Math.round(55 * S),
          height: Math.round(24 * S),
          rx: Math.round(12 * S),
          ry: Math.round(12 * S),
          fill: rgba(accent, 0.15),
          data: objData("decoration"),
        })
      );
      objects.push({
        type: "Textbox",
        text: slideText,
        left: W - Math.round(70 * S),
        top: Math.round(18 * S),
        width: Math.round(55 * S),
        fontSize: Math.round(10 * S),
        fontWeight: "700",
        fontFamily: "Inter",
        fill: accent,
        textAlign: "center",
        selectable: false,
        editable: false,
        data: objData("slide-number", false),
      });
    }
  }

  // ── 3. Category tag ──
  if (config.category.show) {
    const catText = sampleData?.category || "{{category}}";
    let catLeft = Math.round(60 * S / S) * S; // px-8 = 32px -> ~86px at 1080
    const catTop = Math.round(28 * S);
    let catAlign: string = "left";

    if (config.category.position === "top-right") {
      catLeft = W - Math.round(60 * S);
      catAlign = "right";
    } else if (config.category.position === "top-center") {
      catLeft = W / 2 - Math.round(100 * S);
      catAlign = "center";
    } else {
      catLeft = Math.round(32 * S);
    }

    if (config.category.style === "pill-badge") {
      // Badge background
      objects.push(
        makeRect({
          left: catLeft - Math.round(8 * S),
          top: catTop - Math.round(4 * S),
          width: Math.round(120 * S),
          height: Math.round(22 * S),
          rx: Math.round(11 * S),
          ry: Math.round(11 * S),
          fill: rgba(accent, 0.15),
          data: objData("decoration"),
        })
      );
    }

    objects.push(
      makeTextbox(catText, "category", {
        left: catLeft,
        top: catTop,
        width: Math.round(200 * S),
        fontSize: config.category.style === "pill-badge" ? Math.round(9 * S) : Math.round(8 * S),
        fontWeight: config.category.style === "pill-badge" ? "700" : "600",
        fill: config.category.style === "pill-badge" ? accent : config.category.color,
        textAlign: catAlign,
        charSpacing: 150, // tracking-[0.15em] equivalent
        textTransform: "uppercase",
      })
    );
  }

  // ── 4. Chevron before headline ──
  if (config.decorations.chevronBefore) {
    const chevronTop = getTextTop(config.text.verticalPosition, H) - Math.round(20 * S);
    objects.push(
      makeTextbox("\u00BB", "decoration", {
        left: Math.round(32 * S),
        top: Math.max(chevronTop, Math.round(40 * S)),
        width: Math.round(40 * S),
        fontSize: Math.round(14 * S),
        fontWeight: "700",
        fill: rgba(accent, 0.45),
        charSpacing: 150,
        selectable: false,
        editable: false,
        data: objData("decoration"),
      })
    );
  }

  // ── 5. Headline ──
  const headlineText = sampleData?.headline || "{{headline}}";
  const hTop = getTextTop(config.text.verticalPosition, H);
  const headlineFontSize = Math.round(config.text.headlineSize * S);

  objects.push(
    makeTextbox(headlineText, "headline", {
      left: Math.round(32 * S),
      top: hTop,
      width: W - Math.round(64 * S),
      fontSize: headlineFontSize,
      fontWeight: String(config.text.headlineWeight),
      fill: config.text.headlineColor,
      textAlign: config.text.headlineAlign,
      lineHeight: 1.3,
      charSpacing: Math.round((config.text.letterSpacing || 0) * 1000),
    })
  );

  // ── 6. Separator ──
  if (config.separator?.show && config.separator.style !== "none") {
    const sepTop = hTop + headlineFontSize * 2 + Math.round(16 * S);
    const sepColor = config.separator.color || accent;
    const sepWidth = Math.round((config.separator.width || 40) * S);
    let sepLeft = Math.round(32 * S);

    if (config.text.headlineAlign === "center") {
      sepLeft = W / 2 - sepWidth / 2;
    } else if (config.text.headlineAlign === "right") {
      sepLeft = W - Math.round(32 * S) - sepWidth;
    }

    if (config.separator.style === "line" || config.separator.style === "accent-line") {
      objects.push(
        makeLine(sepLeft, sepTop, sepLeft + sepWidth, sepTop, {
          stroke: sepColor,
          strokeWidth: config.separator.style === "accent-line" ? Math.round(3 * S) : Math.round(2 * S),
        })
      );
    } else if (config.separator.style === "dots") {
      // Dot-line-dot separator
      const dotR = Math.round(4 * S / 2);
      objects.push(
        makeCircle({
          left: sepLeft,
          top: sepTop - dotR,
          radius: dotR,
          fill: sepColor,
          stroke: "transparent",
          opacity: 0.5,
        })
      );
      objects.push(
        makeLine(sepLeft + dotR * 3, sepTop, sepLeft + sepWidth - dotR * 3, sepTop, {
          stroke: sepColor,
          strokeWidth: Math.round(1.5 * S),
        })
      );
      objects.push(
        makeCircle({
          left: sepLeft + sepWidth - dotR * 2,
          top: sepTop - dotR,
          radius: dotR,
          fill: sepColor,
          stroke: "transparent",
          opacity: 0.5,
        })
      );
    }
  }

  // ── 7. Subheadline ──
  const subText = sampleData?.subheadline || "{{subheadline}}";
  const subTop = hTop + headlineFontSize * 2 + Math.round(40 * S);
  objects.push(
    makeTextbox(subText, "subheadline", {
      left: Math.round(32 * S),
      top: subTop,
      width: W - Math.round(64 * S),
      fontSize: Math.round(config.text.subheadlineSize * S),
      fontWeight: "500",
      fill: config.text.subheadlineColor,
      textAlign: config.text.headlineAlign,
      lineHeight: 1.6,
    })
  );

  // ── 8. Brand ──
  if (config.brand.show) {
    const brandText = sampleData?.brandName || "{{brand}}";
    let brandLeft = W - Math.round(32 * S) - Math.round(120 * S);
    const brandTop = H - Math.round(24 * S);

    if (config.brand.position === "bottom-left") {
      brandLeft = Math.round(32 * S);
    } else if (config.brand.position === "bottom-center") {
      brandLeft = W / 2 - Math.round(60 * S);
    }

    // Brand icon (small square)
    if (config.brand.showIcon) {
      const iconSize = Math.round(14 * S);
      objects.push(
        makeRect({
          left: brandLeft - iconSize - Math.round(4 * S),
          top: brandTop - Math.round(2 * S),
          width: iconSize,
          height: iconSize,
          rx: Math.round(2 * S),
          ry: Math.round(2 * S),
          fill: rgba(config.brand.color, 0.2),
          stroke: rgba(config.brand.color, 0.15),
          strokeWidth: 1,
          opacity: config.brand.opacity,
          data: objData("decoration"),
        })
      );
    }

    objects.push(
      makeTextbox(brandText, "brand", {
        left: brandLeft,
        top: brandTop,
        width: Math.round(120 * S),
        fontSize: Math.round(10 * S),
        fontWeight: "700",
        fill: config.brand.color,
        opacity: config.brand.opacity,
        textAlign: config.brand.position === "bottom-center" ? "center" : "left",
        charSpacing: 50,
      })
    );
  }

  return {
    version: "6.0.0",
    objects,
    background: config.background.type === "solid" ? config.background.color : "#000000",
  };
}

// Helper: compute text top position based on vertical alignment
function getTextTop(position: "top" | "center" | "bottom", canvasHeight: number): number {
  switch (position) {
    case "top":
      return Math.round(canvasHeight * 0.18);
    case "bottom":
      return Math.round(canvasHeight * 0.55);
    case "center":
    default:
      return Math.round(canvasHeight * 0.35);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// applyCopyToCanvas — inject real copy text into canvas JSON
// ═══════════════════════════════════════════════════════════════════════════

export function applyCopyToCanvas(
  canvasJson: object,
  copy: CopyToTemplatePayload
): object {
  const json = JSON.parse(JSON.stringify(canvasJson)) as {
    objects?: Array<{ data?: ContiaObjectData; text?: string }>;
    [key: string]: unknown;
  };

  if (!json.objects) return json;

  const roleToText: Record<string, string | undefined> = {
    headline: copy.headline,
    subheadline: copy.subheadline,
    body: copy.body,
    cta: copy.cta,
    brand: copy.brandName,
    category: copy.category,
    hashtags: copy.hashtags?.join(" "),
    "slide-number": copy.slideNumber != null
      ? copy.totalSlides
        ? `${String(copy.slideNumber).padStart(2, "0")}/${String(copy.totalSlides).padStart(2, "0")}`
        : String(copy.slideNumber)
      : undefined,
  };

  for (const obj of json.objects) {
    if (!obj.data?.role) continue;
    const replacement = roleToText[obj.data.role];
    if (replacement !== undefined && obj.text !== undefined) {
      obj.text = replacement;
    }
  }

  return json;
}

// ═══════════════════════════════════════════════════════════════════════════
// Preset Templates — Fabric.js JSON for built-in templates
// ═══════════════════════════════════════════════════════════════════════════

type AspectRatio = "1:1" | "4:5" | "9:16";

function presetBase(aspectRatio: AspectRatio) {
  const dim = CANVAS_DIMENSIONS[aspectRatio] || CANVAS_DIMENSIONS["1:1"];
  return { W: dim.width, H: dim.height };
}

// ── bold-statement ──
// Dark bg + diagonal accent stripe + left accent bar + corner accents + floating circles

function buildBoldStatement(aspectRatio: AspectRatio): object {
  const { W, H } = presetBase(aspectRatio);
  const accent = "#4ecdc4";
  const dark = "#0c0f24";

  const objects: FabricObj[] = [
    // Background
    makeRect({ width: W, height: H, fill: dark, data: objData("background") }),

    // Left accent bar
    makeRect({
      left: 0, top: 0, width: Math.round(5 * S), height: H,
      fill: accent, data: objData("decoration"),
    }),

    // Diagonal stripe (approximated with a polygon-like rect at angle)
    makeRect({
      left: W * 0.45, top: -H * 0.1, width: W * 0.7, height: H * 1.2,
      fill: rgba(accent, 0.08), angle: -25,
      data: objData("decoration"),
    }),

    // Corner accent lines — top-left
    makeLine(0, Math.round(54), Math.round(54), 0, {
      stroke: accent, strokeWidth: Math.round(2 * S), opacity: 0.3,
    }),
    makeLine(0, Math.round(94), Math.round(94), 0, {
      stroke: accent, strokeWidth: Math.round(1 * S), opacity: 0.3,
    }),

    // Corner accent lines — bottom-right
    makeLine(W, H - Math.round(54), W - Math.round(54), H, {
      stroke: accent, strokeWidth: Math.round(2 * S), opacity: 0.3,
    }),
    makeLine(W, H - Math.round(94), W - Math.round(94), H, {
      stroke: accent, strokeWidth: Math.round(1 * S), opacity: 0.3,
    }),

    // Floating circles
    makeCircle({
      left: Math.round(W * 0.75), top: Math.round(H * 0.15),
      radius: Math.round(108), stroke: rgba(accent, 0.08),
      strokeWidth: Math.round(2 * S), fill: "transparent", opacity: 1,
    }),
    makeCircle({
      left: Math.round(W * 0.70), top: Math.round(H * 0.20),
      radius: Math.round(54), stroke: rgba(accent, 0.12),
      strokeWidth: Math.round(2 * S), fill: "transparent", opacity: 1,
    }),

    // Category pill
    makeRect({
      left: Math.round(40 * S), top: Math.round(H * 0.25),
      width: Math.round(120 * S), height: Math.round(24 * S),
      rx: Math.round(12 * S), ry: Math.round(12 * S),
      fill: rgba(accent, 0.15), data: objData("decoration"),
    }),
    makeTextbox("{{category}}", "category", {
      left: Math.round(40 * S), top: Math.round(H * 0.25 + 2 * S),
      width: Math.round(120 * S),
      fontSize: Math.round(10 * S), fontWeight: "700",
      fill: accent, textAlign: "center",
      charSpacing: 150,
    }),

    // Headline
    makeTextbox("{{headline}}", "headline", {
      left: Math.round(40 * S), top: Math.round(H * 0.35),
      width: W - Math.round(80 * S),
      fontSize: Math.round(32 * S), fontWeight: "800",
      fill: "#ffffff", lineHeight: 1.1,
      charSpacing: -20,
    }),

    // Subheadline
    makeTextbox("{{subheadline}}", "subheadline", {
      left: Math.round(40 * S), top: Math.round(H * 0.58),
      width: W - Math.round(100 * S),
      fontSize: Math.round(14 * S), fontWeight: "500",
      fill: rgba("#ffffff", 0.5), lineHeight: 1.5,
    }),

    // Brand watermark
    makeTextbox("{{brand}}", "brand", {
      left: W - Math.round(50 * S), top: H - Math.round(14 * S),
      width: Math.round(40 * S),
      fontSize: Math.round(8 * S), fontWeight: "700",
      fill: rgba(accent, 0.15), textAlign: "right",
      charSpacing: 200, selectable: false, editable: false,
      data: objData("brand", true),
    }),
  ];

  return { version: "6.0.0", objects, background: dark };
}

// ── minimal-clean ──
// White bg + thin geometric frame + dot accents + elegant centered layout

function buildMinimalClean(aspectRatio: AspectRatio): object {
  const { W, H } = presetBase(aspectRatio);
  const accent = "#4ecdc4";

  const objects: FabricObj[] = [
    // White background
    makeRect({ width: W, height: H, fill: "#ffffff", data: objData("background") }),

    // Thin geometric frame
    makeRect({
      left: Math.round(24 * S), top: Math.round(24 * S),
      width: W - Math.round(48 * S), height: H - Math.round(48 * S),
      fill: "transparent", stroke: rgba(accent, 0.15), strokeWidth: 1,
      data: objData("decoration"),
    }),

    // Corner accent dots
    makeCircle({
      left: Math.round(21 * S) - Math.round(3.5 * S),
      top: Math.round(21 * S) - Math.round(3.5 * S),
      radius: Math.round(3.5 * S), fill: accent,
      stroke: "transparent", opacity: 1,
    }),
    makeCircle({
      left: W - Math.round(21 * S) - Math.round(3.5 * S),
      top: H - Math.round(21 * S) - Math.round(3.5 * S),
      radius: Math.round(3.5 * S), fill: accent,
      stroke: "transparent", opacity: 1,
    }),

    // Category
    makeTextbox("{{category}}", "category", {
      left: 0, top: Math.round(H * 0.30),
      width: W,
      fontSize: Math.round(10 * S), fontWeight: "700",
      fill: accent, textAlign: "center",
      charSpacing: 200,
    }),

    // Headline
    makeTextbox("{{headline}}", "headline", {
      left: Math.round(64 * S), top: Math.round(H * 0.37),
      width: W - Math.round(128 * S),
      fontSize: Math.round(26 * S), fontWeight: "700",
      fill: "#1a1a2e", textAlign: "center",
      lineHeight: 1.25,
    }),

    // Separator: dot-line-dot
    makeCircle({
      left: W / 2 - Math.round(25 * S),
      top: Math.round(H * 0.56),
      radius: Math.round(4 * S),
      fill: "transparent", stroke: rgba(accent, 0.4),
      strokeWidth: Math.round(2 * S), opacity: 1,
    }),
    makeLine(
      W / 2 - Math.round(15 * S), Math.round(H * 0.56 + 4 * S),
      W / 2 + Math.round(15 * S), Math.round(H * 0.56 + 4 * S),
      { stroke: accent, strokeWidth: Math.round(2 * S) }
    ),
    makeCircle({
      left: W / 2 + Math.round(21 * S),
      top: Math.round(H * 0.56),
      radius: Math.round(4 * S),
      fill: "transparent", stroke: rgba(accent, 0.4),
      strokeWidth: Math.round(2 * S), opacity: 1,
    }),

    // Subheadline
    makeTextbox("{{subheadline}}", "subheadline", {
      left: Math.round(64 * S), top: Math.round(H * 0.62),
      width: W - Math.round(128 * S),
      fontSize: Math.round(14 * S), fontWeight: "500",
      fill: "#777790", textAlign: "center",
      lineHeight: 1.55,
    }),

    // Brand watermark
    makeTextbox("{{brand}}", "brand", {
      left: W - Math.round(50 * S), top: H - Math.round(14 * S),
      width: Math.round(40 * S),
      fontSize: Math.round(8 * S), fontWeight: "700",
      fill: "#aaaacc", textAlign: "right",
      charSpacing: 200,
      data: objData("brand", true),
    }),
  ];

  return { version: "6.0.0", objects, background: "#ffffff" };
}

// ── editorial ──
// BGP-style: dark muted bg, category tag, chevron, headline, subtle brand

function buildEditorial(aspectRatio: AspectRatio): object {
  const { W, H } = presetBase(aspectRatio);
  const accent = "#4ecdc4";

  const bgGradient = {
    type: "linear",
    coords: {
      x1: 0, y1: 0,
      x2: W, y2: H,
    },
    colorStops: [
      { offset: 0, color: "#151826" },
      { offset: 0.45, color: "#1d2135" },
      { offset: 1, color: "#222740" },
    ],
  };

  const objects: FabricObj[] = [
    // Background with gradient
    makeRect({ width: W, height: H, fill: bgGradient, data: objData("background") }),

    // Category — top-right
    makeTextbox("{{category}}", "category", {
      left: W - Math.round(60 * S), top: Math.round(28 * S),
      width: Math.round(50 * S),
      fontSize: Math.round(8 * S), fontWeight: "600",
      fill: rgba("#ffffff", 0.3), textAlign: "right",
      charSpacing: 180,
    }),

    // Chevron decoration
    makeTextbox("\u00BB", "decoration", {
      left: Math.round(32 * S),
      top: Math.round(H * 0.38),
      width: Math.round(40 * S),
      fontSize: Math.round(14 * S), fontWeight: "700",
      fill: rgba(accent, 0.45),
      charSpacing: 150,
      selectable: false, editable: false,
      data: objData("decoration"),
    }),

    // Headline
    makeTextbox("{{headline}}", "headline", {
      left: Math.round(32 * S), top: Math.round(H * 0.42),
      width: W - Math.round(64 * S),
      fontSize: Math.round(25 * S), fontWeight: "700",
      fill: "#eeeef3", lineHeight: 1.38,
      charSpacing: -10,
    }),

    // Subheadline
    makeTextbox("{{subheadline}}", "subheadline", {
      left: Math.round(32 * S), top: Math.round(H * 0.62),
      width: W - Math.round(64 * S),
      fontSize: Math.round(12 * S), fontWeight: "400",
      fill: rgba("#ffffff", 0.32), lineHeight: 1.65,
    }),

    // Brand icon background
    makeRect({
      left: W - Math.round(52 * S), top: H - Math.round(28 * S),
      width: Math.round(14 * S), height: Math.round(14 * S),
      rx: Math.round(2 * S), ry: Math.round(2 * S),
      fill: rgba(accent, 0.2),
      stroke: rgba(accent, 0.15), strokeWidth: 1,
      data: objData("decoration"),
    }),

    // Brand text
    makeTextbox("{{brand}}", "brand", {
      left: W - Math.round(36 * S), top: H - Math.round(26 * S),
      width: Math.round(30 * S),
      fontSize: Math.round(10 * S), fontWeight: "700",
      fill: rgba("#ffffff", 0.22),
      charSpacing: 50,
      data: objData("brand", true),
    }),
  ];

  return { version: "6.0.0", objects, background: "#151826" };
}

// ── gradient-wave ──
// Multi-layer gradient + glass circles + geometric frame + centered text

function buildGradientWave(aspectRatio: AspectRatio): object {
  const { W, H } = presetBase(aspectRatio);
  const accent = "#4ecdc4";
  const brand = "#6c5ce7";

  const bgGradient = {
    type: "linear",
    coords: {
      x1: 0, y1: 0,
      x2: W, y2: H,
    },
    colorStops: [
      { offset: 0, color: brand },
      { offset: 0.5, color: "#0c0f24" },
      { offset: 1, color: accent },
    ],
  };

  const objects: FabricObj[] = [
    // Background gradient
    makeRect({ width: W, height: H, fill: bgGradient, data: objData("background") }),

    // Glass circle top-right
    makeCircle({
      left: W * 0.75, top: -H * 0.1,
      radius: Math.round(100 * S),
      fill: rgba(accent, 0.08), stroke: "transparent",
      opacity: 1,
    }),

    // Glass circle bottom-left
    makeCircle({
      left: -W * 0.08, top: H * 0.8,
      radius: Math.round(80 * S),
      fill: rgba(brand, 0.1), stroke: "transparent",
      opacity: 1,
    }),

    // Geometric frame
    makeRect({
      left: Math.round(30 * S), top: Math.round(30 * S),
      width: W - Math.round(60 * S), height: H - Math.round(60 * S),
      fill: "transparent", stroke: rgba("#ffffff", 0.08), strokeWidth: 1,
      data: objData("decoration"),
    }),

    // Diagonal accent line
    makeLine(0, H, W, 0, {
      stroke: accent, strokeWidth: Math.round(1.5 * S), opacity: 0.1,
    }),

    // Category pill
    makeRect({
      left: W / 2 - Math.round(60 * S), top: Math.round(H * 0.28),
      width: Math.round(120 * S), height: Math.round(26 * S),
      rx: Math.round(13 * S), ry: Math.round(13 * S),
      fill: rgba("#ffffff", 0.12), data: objData("decoration"),
    }),
    makeTextbox("{{category}}", "category", {
      left: W / 2 - Math.round(60 * S), top: Math.round(H * 0.28 + 3 * S),
      width: Math.round(120 * S),
      fontSize: Math.round(10 * S), fontWeight: "700",
      fill: "#ffffff", textAlign: "center",
      charSpacing: 200,
    }),

    // Headline — centered
    makeTextbox("{{headline}}", "headline", {
      left: Math.round(48 * S), top: Math.round(H * 0.38),
      width: W - Math.round(96 * S),
      fontSize: Math.round(30 * S), fontWeight: "800",
      fill: "#ffffff", textAlign: "center",
      lineHeight: 1.12, charSpacing: -10,
    }),

    // Subheadline — centered
    makeTextbox("{{subheadline}}", "subheadline", {
      left: Math.round(48 * S), top: Math.round(H * 0.56),
      width: W - Math.round(96 * S),
      fontSize: Math.round(14 * S), fontWeight: "500",
      fill: rgba("#ffffff", 0.65), textAlign: "center",
      lineHeight: 1.5,
    }),

    // Bottom wave (simplified as a rect)
    makeRect({
      left: 0, top: H - Math.round(40 * S),
      width: W, height: Math.round(40 * S),
      fill: rgba("#ffffff", 0.03),
      data: objData("decoration"),
    }),

    // Brand watermark
    makeTextbox("{{brand}}", "brand", {
      left: W - Math.round(50 * S), top: H - Math.round(14 * S),
      width: Math.round(40 * S),
      fontSize: Math.round(8 * S), fontWeight: "700",
      fill: rgba("#ffffff", 0.15), textAlign: "right",
      charSpacing: 200,
      data: objData("brand", true),
    }),
  ];

  return { version: "6.0.0", objects, background: "#0c0f24" };
}

// ── Preset registry ──

const PRESET_BUILDERS: Record<string, (ar: AspectRatio) => object> = {
  "bold-statement": buildBoldStatement,
  "minimal-clean": buildMinimalClean,
  "editorial": buildEditorial,
  "gradient-wave": buildGradientWave,
};

export function getPresetTemplate(
  templateId: string,
  aspectRatio: "1:1" | "4:5" | "9:16"
): object {
  const builder = PRESET_BUILDERS[templateId];
  if (!builder) {
    throw new Error(`Unknown preset template: "${templateId}". Available: ${Object.keys(PRESET_BUILDERS).join(", ")}`);
  }
  return builder(aspectRatio);
}

/** List all available preset template IDs */
export function listPresetTemplateIds(): string[] {
  return Object.keys(PRESET_BUILDERS);
}
