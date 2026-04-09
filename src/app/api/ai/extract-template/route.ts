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
3. Identifique o fundo: cor solida, gradiente ou imagem
4. Identifique elementos decorativos: linhas, formas, bordas, acentos visuais
5. Extraia a paleta de cores dominante (3-5 cores hex)
6. Posicoes devem ser em PORCENTAGEM do canvas (0-100% para x e y)
7. Tamanho de fonte em pixels estimados (considerando canvas de 1080px)
8. SEMPRE retorne JSON valido no formato especificado
9. Se o fundo for uma imagem/foto, use type "solid" com a cor dominante de fundo
10. Para gradientes, identifique as cores inicial e final e o angulo aproximado
11. Elementos decorativos incluem: linhas separadoras, barras de cor, circulos, retangulos, bordas
12. O campo "content" deve conter o texto EXATO visivel na imagem
13. Se nao conseguir ler um texto, descreva-o como "[texto ilegivel]"
14. font_weight deve ser string: "300" para light, "400" para regular, "600" para semibold, "700" para bold, "800" para extrabold, "900" para black

FORMATO DE RESPOSTA: Apenas JSON, sem markdown, sem explicacoes.

{
  "layout": {
    "background": {
      "type": "solid|gradient",
      "color": "#hex",
      "gradientFrom": "#hex",
      "gradientTo": "#hex",
      "gradientAngle": 135
    },
    "elements": [
      {
        "type": "text",
        "role": "headline|subheadline|body|cta|brand|category",
        "content": "texto exato da imagem",
        "x_percent": 5,
        "y_percent": 15,
        "width_percent": 90,
        "font_size_estimate": 48,
        "font_weight": "700",
        "font_align": "left|center|right",
        "color": "#ffffff"
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
    "colorPalette": ["#hex1", "#hex2", "#hex3"],
    "style": "minimal|bold|editorial|gradient|quote"
  }
}`;

/* ═══════════════════════════════════════════════════════════════════════════
   Fabric.js object helpers
   ═══════════════════════════════════════════════════════════════════════════ */

interface FabricObj {
  type: string;
  [key: string]: unknown;
}

function objData(role: CanvasElementRole, editable = false, locked = false): ContiaObjectData {
  return { role, editable, locked };
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

/* ═══════════════════════════════════════════════════════════════════════════
   Placeholder map for template roles
   ═══════════════════════════════════════════════════════════════════════════ */

const ROLE_PLACEHOLDER: Record<string, string> = {
  headline: "{{headline}}",
  subheadline: "{{subheadline}}",
  body: "{{body}}",
  cta: "{{cta}}",
  brand: "{{brand}}",
  category: "{{category}}",
};

/* ═══════════════════════════════════════════════════════════════════════════
   Convert AI layout → Fabric.js canvas JSON
   ═══════════════════════════════════════════════════════════════════════════ */

interface AILayout {
  background: {
    type: string;
    color?: string;
    gradientFrom?: string;
    gradientTo?: string;
    gradientAngle?: number;
  };
  elements: AIElement[];
  colorPalette: string[];
  style: string;
}

interface AITextElement {
  type: "text";
  role: string;
  content: string;
  x_percent: number;
  y_percent: number;
  width_percent: number;
  font_size_estimate: number;
  font_weight: string;
  font_align: string;
  color: string;
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
  aspectRatio: "1:1" | "4:5" | "9:16"
): { canvasJson: object; extractedCopy: Record<string, string> } {
  const dim = CANVAS_DIMENSIONS[aspectRatio] || CANVAS_DIMENSIONS["1:1"];
  const W = dim.width;
  const H = dim.height;
  const objects: FabricObj[] = [];
  const extractedCopy: Record<string, string> = {};

  // ── 1. Background ──
  let bgFill: string | object = layout.background.color || "#151826";

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

      // Use placeholder text for the template
      const placeholder = ROLE_PLACEHOLDER[textEl.role] || textEl.content;

      objects.push(
        makeTextbox(placeholder, role, {
          left: x,
          top: y,
          width: w,
          fontSize,
          fontWeight: textEl.font_weight || "400",
          textAlign: textEl.font_align || "left",
          fill: textEl.color || "#ffffff",
        })
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

  const canvasJson = {
    version: "6.0.0",
    objects,
    background: typeof bgFill === "string" ? bgFill : "#151826",
  };

  return { canvasJson, extractedCopy };
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
      max_tokens: 3000,
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
    const { canvasJson, extractedCopy } = convertLayoutToFabric(layout, aspectRatio);

    // ── Build style description ──
    const styleLabels: Record<string, string> = {
      minimal: "Minimalista",
      bold: "Ousado/Impactante",
      editorial: "Editorial",
      gradient: "Gradiente moderno",
      quote: "Estilo citacao",
    };
    const styleName = styleLabels[layout.style] || layout.style || "Personalizado";
    const bgType = layout.background.type === "gradient" ? "com gradiente" : "com fundo solido";
    const textCount = layout.elements.filter((e) => e.type === "text").length;
    const shapeCount = layout.elements.filter((e) => e.type === "shape").length;
    const styleDescription = `Template ${styleName} ${bgType}, ${textCount} elemento(s) de texto${shapeCount > 0 ? ` e ${shapeCount} elemento(s) decorativo(s)` : ""}`;

    return NextResponse.json({
      canvas_json: canvasJson,
      extracted_copy: extractedCopy,
      color_palette: layout.colorPalette || [],
      style_description: styleDescription,
    });
  } catch (error: any) {
    console.error("AI template extraction error:", error);
    return NextResponse.json(
      { error: error.message || "Falha ao extrair template da imagem. Tente novamente." },
      { status: 500 }
    );
  }
}
