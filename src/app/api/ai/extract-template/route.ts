import { NextRequest, NextResponse } from "next/server";
import { getOpenAIClient, isAIConfigured } from "@/lib/ai/config";
import type { ChatCompletionMessageParam, ChatCompletionContentPart } from "openai/resources/chat/completions";
import type { CanvasElementRole, ContiaObjectData } from "@/types/canvas";
import { CANVAS_DIMENSIONS } from "@/types/canvas";

/* ═══════════════════════════════════════════════════════════════════════════
   System prompt — instructs GPT-4o Vision to extract layout structure
   ═══════════════════════════════════════════════════════════════════════════ */

const SYSTEM_PROMPT = `Voce e um designer grafico especialista em analise de layouts para redes sociais.

Analise esta imagem de post/card e extraia a estrutura visual completa.

REGRAS:
1. Identifique TODOS os elementos de texto, suas posicoes (em % do canvas), tamanhos estimados de fonte, pesos, cores e alinhamentos
2. Classifique cada texto pelo papel: headline, subheadline, body, cta, brand, category
3. Identifique o fundo: cor solida, gradiente ou IMAGEM/FOTO
4. Identifique elementos decorativos: linhas, formas, bordas, acentos visuais
5. Extraia a paleta de cores dominante (3-5 cores hex)
6. Posicoes devem ser em PORCENTAGEM do canvas (0-100% para x e y)
7. Tamanho de fonte em pixels estimados (considerando canvas de 1080px)
8. SEMPRE retorne JSON valido no formato especificado
9. Se o fundo for uma imagem/foto, use type "image" e descreva a foto em "photo_description"
10. Para gradientes, identifique as cores inicial e final e o angulo aproximado
11. Elementos decorativos incluem: linhas separadoras, barras de cor, circulos, retangulos, bordas
12. O campo "content" deve conter o texto EXATO visivel na imagem — NUNCA use placeholders como {{headline}}
13. Se nao conseguir ler um texto, descreva-o como "[texto ilegivel]"
14. font_weight deve ser string: "300" para light, "400" para regular, "600" para semibold, "700" para bold, "800" para extrabold, "900" para black
15. Descreva a HIERARQUIA VISUAL: qual elemento chama mais atencao primeiro? segundo? terceiro?
16. Para fontes: estime se e serif, sans-serif, display, handwritten, monospace
17. Para imagens de fundo: descreva a foto/ilustracao em detalhe (para gerar similar com DALL-E se necessario)
18. Se houver LOGO ou ICONE, identifique posicao e tamanho estimado
19. Se houver elementos SOBREPOSTOS (texto sobre imagem com overlay), identifique a cor e opacidade do overlay
20. Identifique ESPACAMENTO entre elementos (gaps em %)
21. Para cada texto, estime o NUMERO DE LINHAS visiveis

FORMATO DE RESPOSTA: Apenas JSON, sem markdown, sem explicacoes.

{
  "layout": {
    "background": {
      "type": "solid|gradient|image",
      "color": "#hex",
      "gradientFrom": "#hex",
      "gradientTo": "#hex",
      "gradientAngle": 135,
      "has_photo": false,
      "photo_description": "descricao detalhada da foto de fundo",
      "overlay_color": "#000000",
      "overlay_opacity": 0.0,
      "dominant_color": "#hex"
    },
    "elements": [
      {
        "type": "text",
        "role": "headline|subheadline|body|cta|brand|category",
        "content": "texto exato da imagem",
        "x_percent": 5,
        "y_percent": 15,
        "width_percent": 90,
        "height_percent": 15,
        "font_size_estimate": 48,
        "font_weight": "700",
        "font_type": "sans-serif|serif|display|handwritten|monospace",
        "font_align": "left|center|right",
        "color": "#ffffff",
        "line_count": 1,
        "letter_spacing": "normal|tight|wide"
      },
      {
        "type": "shape",
        "shape": "line|rect|circle",
        "x_percent": 5,
        "y_percent": 50,
        "width_percent": 30,
        "height_percent": 0.5,
        "color": "#4ecdc4"
      }
    ],
    "visual_hierarchy": ["headline", "subheadline", "cta", "brand"],
    "colorPalette": ["#hex1", "#hex2", "#hex3"],
    "style": "minimal|bold|editorial|gradient|quote|photo-overlay",
    "overall_style": "descricao do estilo geral"
  }
}`;

/* ═══════════════════════════════════════════════════════════════════════════
   Fabric.js object helpers
   ═══════════════════════════════════════════════════════════════════════════ */

interface FabricObj {
  type: string;
  [key: string]: unknown;
}

function objData(role: CanvasElementRole, editable = false, locked = false, originalText?: string): ContiaObjectData {
  const data: ContiaObjectData = { role, editable, locked };
  if (originalText) data.originalText = originalText;
  return data;
}

function makeRect(props: Record<string, unknown>): FabricObj {
  return {
    type: "Rect",
    left: 0,
    top: 0,
    width: 100,
    height: 100,
    fill: "#000000",
    selectable: false,
    evented: false,
    ...props,
  };
}

function makeTextbox(
  text: string,
  role: CanvasElementRole,
  props: Record<string, unknown>,
  originalText?: string
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
    data: objData(role, true, false, originalText),
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
    opacity: 0.5,
    selectable: false,
    evented: false,
    ...props,
    data: objData("decoration"),
  };
}

function makeLine(props: Record<string, unknown>): FabricObj {
  return {
    type: "Line",
    x1: 0,
    y1: 0,
    x2: 100,
    y2: 0,
    stroke: "#4ecdc4",
    strokeWidth: 4,
    selectable: false,
    evented: false,
    ...props,
    data: objData("decoration"),
  };
}

function makeImage(src: string, props: Record<string, unknown>): FabricObj {
  return {
    type: "Image",
    src,
    left: 0,
    top: 0,
    selectable: false,
    evented: false,
    ...props,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   Font type → fontFamily mapping
   ═══════════════════════════════════════════════════════════════════════════ */

const FONT_TYPE_MAP: Record<string, string> = {
  "sans-serif": "Inter",
  serif: "Georgia",
  display: "Impact",
  handwritten: "Dancing Script",
  monospace: "JetBrains Mono",
  "sans-serif-display": "Montserrat",
};

/* ═══════════════════════════════════════════════════════════════════════════
   Convert AI layout → Fabric.js canvas JSON
   ═══════════════════════════════════════════════════════════════════════════ */

interface AIBackground {
  type: string;
  color?: string;
  gradientFrom?: string;
  gradientTo?: string;
  gradientAngle?: number;
  has_photo?: boolean;
  photo_description?: string;
  overlay_color?: string;
  overlay_opacity?: number;
  dominant_color?: string;
}

interface AILayout {
  background: AIBackground;
  elements: AIElement[];
  colorPalette: string[];
  style: string;
  visual_hierarchy?: string[];
  overall_style?: string;
}

interface AITextElement {
  type: "text";
  role: string;
  content: string;
  x_percent: number;
  y_percent: number;
  width_percent: number;
  height_percent?: number;
  font_size_estimate: number;
  font_weight: string;
  font_type?: string;
  font_align: string;
  color: string;
  line_count?: number;
  letter_spacing?: string;
}

interface AIShapeElement {
  type: "shape";
  shape: string;
  x_percent: number;
  y_percent: number;
  width_percent: number;
  height_percent: number;
  color: string;
}

type AIElement = AITextElement | AIShapeElement;

function convertLayoutToFabric(
  layout: AILayout,
  aspectRatio: "1:1" | "4:5" | "9:16",
  imageDataUrl?: string
): { canvasJson: object; extractedCopy: Record<string, string>; hasBackgroundImage: boolean; originalImageUrl?: string; photoBackgroundReplaced: boolean } {
  const dim = CANVAS_DIMENSIONS[aspectRatio] || CANVAS_DIMENSIONS["1:1"];
  const W = dim.width;
  const H = dim.height;
  const objects: FabricObj[] = [];
  const extractedCopy: Record<string, string> = {};
  let hasBackgroundImage = false;
  let photoBackgroundReplaced = false;

  const isPhotoBackground =
    layout.background.type === "image" ||
    layout.background.has_photo === true;

  // Check if the image has text overlaid — if so, using it as background
  // would cause DOUBLE TEXT (original baked-in text + extracted text objects)
  const hasExtractedText = layout.elements.some((el: AIElement) => el.type === "text");

  // ── 1. Background ──
  if (isPhotoBackground && imageDataUrl && !hasExtractedText) {
    // Pure photo background (no text overlay) — safe to use as background
    hasBackgroundImage = true;
    objects.push(
      makeImage(imageDataUrl, {
        left: 0,
        top: 0,
        width: W,
        height: H,
        scaleX: 1,
        scaleY: 1,
        data: objData("background-image", false, true),
      })
    );

    // Add overlay if detected
    const overlayOpacity = layout.background.overlay_opacity || 0;
    if (overlayOpacity > 0) {
      objects.push(
        makeRect({
          left: 0,
          top: 0,
          width: W,
          height: H,
          fill: layout.background.overlay_color || "#000000",
          opacity: overlayOpacity,
          selectable: true,
          evented: true,
          data: objData("decoration", true),
        })
      );
    }
  } else if (isPhotoBackground && hasExtractedText) {
    // Photo WITH text overlay — using the original image as background would
    // cause double text. Use the dominant color as a solid background instead.
    // The original image URL is returned so the user can manually set it later.
    photoBackgroundReplaced = true;
    const bgColor = layout.background.dominant_color || layout.background.color || "#1a1a2e";
    objects.push(
      makeRect({
        width: W,
        height: H,
        fill: bgColor,
        selectable: false,
        evented: false,
        data: { role: "background" as CanvasElementRole, editable: true, locked: false, originalImageUrl: imageDataUrl },
      })
    );

    // Add overlay tint if detected (preserves the mood of the original)
    const overlayOpacity = layout.background.overlay_opacity || 0;
    if (overlayOpacity > 0) {
      objects.push(
        makeRect({
          left: 0,
          top: 0,
          width: W,
          height: H,
          fill: layout.background.overlay_color || "#000000",
          opacity: overlayOpacity,
          selectable: true,
          evented: true,
          data: objData("decoration", true),
        })
      );
    }
  } else {
    // Solid color or gradient background
    let bgFill: string | object = layout.background.color || layout.background.dominant_color || "#151826";

    if (
      layout.background.type === "gradient" &&
      layout.background.gradientFrom &&
      layout.background.gradientTo
    ) {
      const angle = (layout.background.gradientAngle || 135) * (Math.PI / 180);
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      bgFill = {
        type: "linear",
        coords: {
          x1: W / 2 - (cos * W) / 2,
          y1: H / 2 - (sin * H) / 2,
          x2: W / 2 + (cos * W) / 2,
          y2: H / 2 + (sin * H) / 2,
        },
        colorStops: [
          { offset: 0, color: layout.background.gradientFrom },
          { offset: 1, color: layout.background.gradientTo },
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
  }

  // ── 2. Process elements ──
  for (const el of layout.elements) {
    if (el.type === "text") {
      const textEl = el as AITextElement;
      const role = textEl.role as CanvasElementRole;
      const x = Math.round((textEl.x_percent / 100) * W);
      const y = Math.round((textEl.y_percent / 100) * H);
      const w = Math.round((textEl.width_percent / 100) * W);
      const fontSize = Math.max(16, Math.min(120, textEl.font_size_estimate || 32));

      // Store actual text from image
      if (textEl.content && textEl.role) {
        extractedCopy[textEl.role] = textEl.content;
      }

      // USE THE REAL TEXT from the image — NOT placeholders
      const displayText = textEl.content || "[texto nao identificado]";

      // Map font type to family
      const fontFamily = (textEl.font_type && FONT_TYPE_MAP[textEl.font_type]) || "Inter";

      // Map letter spacing
      let charSpacing = 0;
      if (textEl.letter_spacing === "tight") charSpacing = -20;
      else if (textEl.letter_spacing === "wide") charSpacing = 80;

      objects.push(
        makeTextbox(displayText, role, {
          left: x,
          top: y,
          width: w,
          fontSize,
          fontWeight: textEl.font_weight || "400",
          fontFamily,
          textAlign: textEl.font_align || "left",
          fill: textEl.color || "#ffffff",
          charSpacing,
          lineHeight: textEl.line_count && textEl.line_count > 1 ? 1.3 : 1.2,
        }, displayText)
      );
    } else if (el.type === "shape") {
      const shapeEl = el as AIShapeElement;
      const x = Math.round((shapeEl.x_percent / 100) * W);
      const y = Math.round((shapeEl.y_percent / 100) * H);
      const w = Math.round((shapeEl.width_percent / 100) * W);
      const h = Math.round((shapeEl.height_percent / 100) * H);

      if (shapeEl.shape === "circle") {
        const radius = Math.max(w, h) / 2;
        objects.push(
          makeCircle({
            left: x,
            top: y,
            radius,
            fill: shapeEl.color || "#4ecdc4",
            stroke: "transparent",
            opacity: 0.8,
          })
        );
      } else if (shapeEl.shape === "line") {
        objects.push(
          makeLine({
            left: x,
            top: y,
            x1: 0,
            y1: 0,
            x2: w,
            y2: h || 0,
            stroke: shapeEl.color || "#4ecdc4",
            strokeWidth: Math.max(2, h || 4),
          })
        );
      } else {
        // rect or unknown shape → rect
        objects.push(
          makeRect({
            left: x,
            top: y,
            width: w,
            height: Math.max(h, 4),
            fill: shapeEl.color || "#4ecdc4",
            data: objData("decoration"),
          })
        );
      }
    }
  }

  const canvasBg = isPhotoBackground
    ? (layout.background.dominant_color || "#151826")
    : (typeof objects[0]?.fill === "string" ? objects[0].fill as string : "#151826");

  const canvasJson = {
    version: "6.0.0",
    objects,
    background: canvasBg,
  };

  return { canvasJson, extractedCopy, hasBackgroundImage, originalImageUrl: imageDataUrl, photoBackgroundReplaced };
}

/* ═══════════════════════════════════════════════════════════════════════════
   Route handler — POST /api/ai/extract-template
   ═══════════════════════════════════════════════════════════════════════════ */

export async function POST(request: NextRequest) {
  if (!isAIConfigured()) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY nao configurada. Configure a variavel de ambiente." },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();

    const { image, empresa_id, context } = body as {
      image?: string;
      empresa_id?: string;
      context?: {
        brandName?: string;
        brandColor?: string;
        format?: "post" | "carousel" | "story";
      };
    };

    // ── Validate input ──
    if (!image || typeof image !== "string") {
      return NextResponse.json(
        { error: "O campo 'image' (base64 data URL) e obrigatorio." },
        { status: 400 }
      );
    }

    // Check base64 size (~4MB limit → base64 is ~1.33x so ~5.3MB string)
    if (image.length > 6_000_000) {
      return NextResponse.json(
        { error: "Imagem muito grande. O limite e 4MB." },
        { status: 400 }
      );
    }

    // Determine aspect ratio from context
    const formatToRatio: Record<string, "1:1" | "4:5" | "9:16"> = {
      post: "1:1",
      carousel: "1:1",
      story: "9:16",
    };
    const aspectRatio = formatToRatio[context?.format || "post"] || "1:1";

    // ── Build messages for GPT-4o Vision ──
    const messages: ChatCompletionMessageParam[] = [];

    messages.push({ role: "system", content: SYSTEM_PROMPT });

    const userParts: ChatCompletionContentPart[] = [];

    // Add the image
    userParts.push({
      type: "image_url",
      image_url: { url: image, detail: "high" },
    });

    // Add context text
    let contextText = "Analise esta imagem e extraia a estrutura visual completa no formato JSON especificado.";
    contextText += "\nIMPORTANTE: Use o texto EXATO que aparece na imagem no campo 'content'. NAO use placeholders como {{headline}} ou {{body}}.";
    contextText += "\nSe o fundo for uma foto/imagem, coloque type: 'image' e descreva a foto em 'photo_description'.";

    if (context?.brandName) {
      contextText += `\nMarca: ${context.brandName}`;
    }
    if (context?.brandColor) {
      contextText += `\nCor principal da marca: ${context.brandColor}`;
    }

    userParts.push({ type: "text", text: contextText });

    messages.push({ role: "user", content: userParts });

    // ── Call OpenAI GPT-4o Vision ──
    const openai = getOpenAIClient();

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages,
      temperature: 0.2,
      max_tokens: 4000,
      response_format: { type: "json_object" },
    });

    const rawContent = completion.choices[0]?.message?.content || "{}";

    // ── Parse response ──
    let parsed: { layout?: AILayout };
    try {
      parsed = JSON.parse(rawContent);
    } catch {
      // Try stripping markdown fences
      let cleaned = rawContent.trim();
      if (cleaned.startsWith("```")) {
        cleaned = cleaned.replace(/```json?\n?/g, "").replace(/```$/g, "").trim();
      }
      // Try to find JSON object
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleaned = jsonMatch[0];
      }
      parsed = JSON.parse(cleaned);
    }

    // ── Validate structure ──
    const layout = parsed.layout;
    if (!layout || typeof layout !== "object") {
      return NextResponse.json(
        { error: "A IA nao retornou um campo 'layout' valido. Tente novamente." },
        { status: 500 }
      );
    }

    if (!layout.elements || !Array.isArray(layout.elements)) {
      return NextResponse.json(
        { error: "A IA nao identificou elementos na imagem. Tente com outra imagem." },
        { status: 500 }
      );
    }

    // ── Convert layout → Fabric.js JSON ──
    // Pass the original image so it can be used as background if needed
    const { canvasJson, extractedCopy, hasBackgroundImage, originalImageUrl, photoBackgroundReplaced } = convertLayoutToFabric(
      layout,
      aspectRatio,
      image
    );

    // ── Build style description ──
    const styleLabels: Record<string, string> = {
      minimal: "Minimalista",
      bold: "Ousado/Impactante",
      editorial: "Editorial",
      gradient: "Gradiente moderno",
      quote: "Estilo citacao",
      "photo-overlay": "Foto com overlay",
    };
    const styleName = styleLabels[layout.style] || layout.style || "Personalizado";
    const bgType = layout.background.type === "gradient"
      ? "com gradiente"
      : layout.background.type === "image"
        ? "com foto de fundo"
        : "com fundo solido";
    const textCount = layout.elements.filter((e) => e.type === "text").length;
    const shapeCount = layout.elements.filter((e) => e.type === "shape").length;
    const styleDescription = `Template ${styleName} ${bgType}, ${textCount} elemento(s) de texto${shapeCount > 0 ? ` e ${shapeCount} elemento(s) decorativo(s)` : ""}`;

    return NextResponse.json({
      canvas_json: canvasJson,
      extracted_copy: extractedCopy,
      color_palette: layout.colorPalette || [],
      style_description: styleDescription,
      has_background_image: hasBackgroundImage,
      photo_description: layout.background.photo_description || null,
      visual_hierarchy: layout.visual_hierarchy || [],
      overall_style: layout.overall_style || null,
      original_image_url: photoBackgroundReplaced ? originalImageUrl : undefined,
      photo_background_replaced: photoBackgroundReplaced,
    });
  } catch (error: any) {
    console.error("AI template extraction error:", error);
    return NextResponse.json(
      { error: error.message || "Falha ao extrair template da imagem. Tente novamente." },
      { status: 500 }
    );
  }
}
