import { NextRequest, NextResponse } from "next/server";
import { getOpenAIClient, isAIConfigured } from "@/lib/ai/config";
import type { TemplateStyleConfig } from "@/types/custom-template";
import type { ChatCompletionMessageParam, ChatCompletionContentPart } from "openai/resources/chat/completions";

// ---------------------------------------------------------------------------
// System prompt — comprehensive schema + design principles
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `Voce e um assistente especializado em design de posts para redes sociais.
Sua funcao e gerar ou modificar configuracoes de template (TemplateStyleConfig) com base nas instrucoes do usuario.

Voce DEVE retornar APENAS um JSON valido com duas chaves:
- "config": objeto TemplateStyleConfig completo
- "explanation": string curta em portugues explicando o que foi feito

NAO inclua markdown, comentarios ou texto fora do JSON.

## Schema completo — TemplateStyleConfig

### background
Define o fundo do post.
- type: "solid" | "gradient" | "image"
  - "solid": usa apenas "color"
  - "gradient": usa "gradientFrom", "gradientTo" e "gradientAngle"
  - "image": usa "imageUrl" com overlay opcional
- color: string (hex). Cor de fundo para tipo solid. Tambem serve de fallback.
- gradientFrom?: string (hex). Cor inicial do gradiente.
- gradientTo?: string (hex). Cor final do gradiente.
- gradientAngle?: number (0-360, default 135). Direcao do gradiente em graus.
- imageUrl?: string. URL da imagem de fundo.
- overlayOpacity?: number (0-1). Opacidade de overlay escuro sobre imagem/gradiente. 0 = sem overlay, 1 = totalmente escuro.

### text
Controla tipografia e posicionamento do texto.
- headlineSize: number (20-40). Tamanho do titulo em px. Use 26-30 para equilibrio.
- headlineWeight: 600 | 700 | 800 | 900. Peso da fonte do titulo. 700 e o padrao profissional, 800-900 para impacto.
- headlineColor: string (hex ou rgba). Cor do titulo.
- headlineAlign: "left" | "center" | "right". Alinhamento horizontal do titulo.
- subheadlineSize: number (12-18). Tamanho do subtitulo em px.
- subheadlineColor: string (hex ou rgba). Cor do subtitulo — geralmente mais sutil que o titulo.
- verticalPosition: "top" | "center" | "bottom". Onde o bloco de texto fica verticalmente no card.
- letterSpacing?: number (-0.02 a 0.05). Espacamento entre letras. Negativo = mais compacto, positivo = mais espaçado.

### decorations
Elementos decorativos visuais — cada um e um toggle independente.
- accentBar: "none" | "left" | "top" | "bottom"
  - "left": barra colorida de 5px na lateral esquerda do card
  - "top": barra colorida no topo
  - "bottom": barra colorida na base
  - "none": sem barra
- accentBarColor: string (hex). Cor da barra de destaque.
- cornerAccents: boolean. Pequenas marcas decorativas nos cantos do card (estilo editorial).
- diagonalStripe: boolean. Faixa diagonal atravessando o card (estilo moderno/esportivo).
- diagonalColor?: string (hex/rgba). Cor da faixa diagonal.
- dotGrid: boolean. Grade de pontos sutis no fundo (estilo tech/minimal).
- geometricFrame: boolean. Moldura geometrica ao redor do conteudo.
- floatingCircles: boolean. Circulos decorativos flutuantes no fundo (estilo organico).
- chevronBefore: boolean. Adiciona ">>" antes do titulo (estilo tech/editorial).
- quoteMarks: boolean. Aspas decorativas grandes ao redor do texto (estilo citacao).
- noiseTexture: boolean. Textura granulada sutil sobre o fundo (adiciona profundidade).
- radialGlow: boolean. Brilho radial sutil no centro/canto do card.

### category
Tag de categoria no topo do post (ex: "DICAS", "TENDENCIAS").
- show: boolean. Exibir ou nao a tag de categoria.
- position: "top-left" | "top-right" | "top-center". Posicao da tag.
- style: "caps-text" | "pill-badge"
  - "caps-text": texto em caixa alta, sem fundo
  - "pill-badge": texto dentro de uma pilula com fundo colorido
- color: string (hex ou rgba). Cor do texto/fundo da tag.

### brand
Marca/logo no rodape do post.
- show: boolean. Exibir ou nao a marca.
- position: "bottom-right" | "bottom-left" | "bottom-center". Posicao da marca.
- showIcon: boolean. Exibe um icone quadrado com a inicial da marca.
- opacity: number (0.1-0.5). Opacidade da marca — deve ser sutil para nao competir com o conteudo.
- color: string (hex). Cor da marca.

### text (campos adicionais)
- highlightWords: string[] (opcional). Lista de palavras no titulo que devem aparecer em COR DE DESTAQUE. Exemplo: se o titulo e "Seu negocio fatura bem?" e o usuario quer destaque em "fatura", use highlightWords: ["fatura"]. MUITO PODEROSO para posts impactantes.
- highlightColor: string (hex, opcional). Cor das palavras destacadas. Padrao: cor accent da marca.

### backgroundText (opcional)
Texto decorativo grande no FUNDO do post — como letra gigante, numero, simbolo. Fica ATRAS do conteudo. Muito usado em posts profissionais.
- content: string. O texto (ex: "B", "?", "01", "BGP"). Normalmente 1-3 caracteres.
- style: "outlined" | "solid" | "ghost". "outlined" = so contorno sem preenchimento. "solid" = preenchido com baixa opacidade. "ghost" = super sutil.
- size: number (100-300). Tamanho em pixels.
- position: "center" | "bottom-right" | "top-left" | "top-right" | "bottom-left"
- color: string (hex). Cor do texto decorativo.
- opacity: number (0.02-0.15). Deve ser BEM sutil para nao competir com o conteudo.
- rotation: number (opcional, graus). Rotacao do texto. Padrao 0.

### separator (opcional)
Separador visual entre titulo e subtitulo.
- show: boolean. Exibir separador.
- style: "line" | "dots" | "accent-line" | "none". "line" = linha simples. "dots" = bolinhas + linha. "accent-line" = linha gradiente.
- color: string (hex).
- width: number (20-80). Largura do separador.

### slideIndicator
Indicador de slide para carrosseis.
- show: boolean. Exibir indicador de slide.
- style: "badge" | "large-bg-number" | "outlined-number"
  - "badge": numero pequeno em circulo
  - "large-bg-number": numero grande e sutil no fundo
  - "outlined-number": numero grande apenas com contorno

## Configuracao padrao de exemplo

{
  "background": {
    "type": "gradient",
    "color": "#1a1e2e",
    "gradientFrom": "#151826",
    "gradientTo": "#222740",
    "gradientAngle": 160
  },
  "text": {
    "headlineSize": 26,
    "headlineWeight": 700,
    "headlineColor": "#f0f0f5",
    "headlineAlign": "left",
    "subheadlineSize": 13,
    "subheadlineColor": "rgba(255,255,255,0.35)",
    "verticalPosition": "center",
    "letterSpacing": -0.01,
    "highlightWords": [],
    "highlightColor": "#4ecdc4"
  },
  "decorations": {
    "accentBar": "none",
    "accentBarColor": "#4ecdc4",
    "cornerAccents": false,
    "diagonalStripe": false,
    "dotGrid": false,
    "geometricFrame": false,
    "floatingCircles": false,
    "chevronBefore": true,
    "quoteMarks": false,
    "noiseTexture": true,
    "radialGlow": false
  },
  "category": {
    "show": true,
    "position": "top-right",
    "style": "caps-text",
    "color": "rgba(255,255,255,0.3)"
  },
  "brand": {
    "show": true,
    "position": "bottom-right",
    "showIcon": true,
    "opacity": 0.2,
    "color": "#4ecdc4"
  },
  "backgroundText": {
    "content": "",
    "style": "outlined",
    "size": 200,
    "position": "bottom-right",
    "color": "#4ecdc4",
    "opacity": 0.05
  },
  "separator": {
    "show": false,
    "style": "line",
    "color": "#4ecdc4",
    "width": 40
  },
  "slideIndicator": {
    "show": false,
    "style": "badge"
  }
}

## Principios de design

1. Minimalismo: poucos elementos decorativos ativos ao mesmo tempo. No maximo 2-3 decorations ativas.
2. Hierarquia: o titulo deve ser o ponto focal. Decoracoes sao suporte, nunca competem.
3. Contraste: garantir legibilidade — texto claro em fundo escuro ou vice-versa.
4. Profissionalismo: estetica de redes sociais premium — nao exagerar em cores ou efeitos.
5. Whitespace: deixar espacos vazios. Nao preencher tudo.
6. Consistencia: cores decorativas devem harmonizar com a paleta do fundo e da marca.

## Regras de geracao

- Se o usuario fornecer imagens de referencia, analise o estilo visual (cores, layout, tipografia, decoracoes) e replique no config.
- Se ja existir uma configuracao atual (currentConfig), PRESERVE tudo que o usuario NAO pediu para mudar. Modifique apenas o necessario.
- Se o usuario mencionar uma cor da marca (brandColor no context), use-a como accentBarColor e brand.color.
- Sempre retorne o objeto config COMPLETO com as 6 secoes obrigatorias (background, text, decorations, category, brand, slideIndicator) + opcionais (backgroundText, separator).
- USE highlightWords quando o usuario pedir destaque em palavras especificas. Exemplo: "destaca a palavra lucro" → highlightWords: ["lucro"].
- USE backgroundText quando o usuario pedir uma letra/simbolo de fundo. Exemplo: "coloca um ? grande de fundo" → backgroundText: { content: "?", style: "outlined", size: 220, position: "center", color: "#4ecdc4", opacity: 0.05 }.
- USE separator quando houver titulo E subtitulo e o usuario quiser separacao visual.
- Use valores validos conforme os ranges especificados. Nao invente campos extras.`;

// ---------------------------------------------------------------------------
// Required top-level keys for validation
// ---------------------------------------------------------------------------

const REQUIRED_CONFIG_KEYS: (keyof TemplateStyleConfig)[] = [
  "background",
  "text",
  "decorations",
  "category",
  "brand",
  "slideIndicator",
];

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  if (!isAIConfigured()) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY nao configurada. Configure a variavel de ambiente." },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();

    const {
      message,
      currentConfig,
      referenceImages,
      context,
    } = body as {
      message?: string;
      currentConfig?: TemplateStyleConfig;
      referenceImages?: string[];
      context?: { brandName?: string; brandColor?: string };
    };

    // --- Validate input ---
    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return NextResponse.json(
        { error: "O campo 'message' e obrigatorio e nao pode estar vazio." },
        { status: 400 }
      );
    }

    // --- Determine model ---
    const hasImages = Array.isArray(referenceImages) && referenceImages.length > 0;
    const model = hasImages ? "gpt-4o" : "gpt-4o-mini";

    // --- Build messages array ---
    const messages: ChatCompletionMessageParam[] = [];

    // 1) System prompt
    messages.push({ role: "system", content: SYSTEM_PROMPT });

    // 2) User message (with optional images)
    const userParts: ChatCompletionContentPart[] = [];

    if (hasImages) {
      for (const img of referenceImages!) {
        userParts.push({
          type: "image_url",
          image_url: { url: img, detail: "high" },
        });
      }
      userParts.push({
        type: "text",
        text: "Imagens de referencia acima. Analise o estilo visual e use como base.\n\n",
      });
    }

    // Build user text content
    let userText = message.trim();

    if (context?.brandName || context?.brandColor) {
      const parts: string[] = [];
      if (context.brandName) parts.push(`nome: ${context.brandName}`);
      if (context.brandColor) parts.push(`cor principal: ${context.brandColor}`);
      userText += `\n\nContexto da marca: ${parts.join(", ")}.`;
    }

    if (currentConfig) {
      userText += `\n\nConfiguracao atual do template (preserve o que nao for pedido para alterar):\n${JSON.stringify(currentConfig, null, 2)}`;
    }

    userParts.push({ type: "text", text: userText });

    messages.push({ role: "user", content: userParts });

    // --- Call OpenAI ---
    const openai = getOpenAIClient();

    const completion = await openai.chat.completions.create({
      model,
      messages,
      temperature: 0.3,
      max_tokens: 2000,
      response_format: { type: "json_object" },
    });

    const rawContent = completion.choices[0]?.message?.content || "{}";

    // --- Parse response ---
    let parsed: { config?: TemplateStyleConfig; explanation?: string };
    try {
      parsed = JSON.parse(rawContent);
    } catch {
      // Try stripping markdown fences if model ignored json mode
      let cleaned = rawContent.trim();
      if (cleaned.startsWith("```")) {
        cleaned = cleaned.replace(/```json?\n?/g, "").replace(/```$/g, "").trim();
      }
      parsed = JSON.parse(cleaned);
    }

    // --- Validate structure ---
    const config = parsed.config;
    if (!config || typeof config !== "object") {
      return NextResponse.json(
        { error: "A IA nao retornou um campo 'config' valido. Tente novamente." },
        { status: 500 }
      );
    }

    const missingKeys = REQUIRED_CONFIG_KEYS.filter((key) => !(key in config));
    if (missingKeys.length > 0) {
      return NextResponse.json(
        {
          error: `Config incompleto. Secoes ausentes: ${missingKeys.join(", ")}. Tente novamente.`,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      config,
      explanation: parsed.explanation || "Template gerado com sucesso.",
    });
  } catch (error: any) {
    console.error("AI template generation error:", error);
    return NextResponse.json(
      { error: error.message || "Falha ao gerar template. Tente novamente." },
      { status: 500 }
    );
  }
}
