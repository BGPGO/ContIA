/* ═══════════════════════════════════════════════════════════════════════════
   Preset Template Definitions — Fabric JSON generators
   Shared between useFabricCanvas (runtime) and usePresetPreviews (thumbnails)
   ═══════════════════════════════════════════════════════════════════════════ */

import type { CanvasElementRole } from "@/types/canvas";

export const ASPECT_DIMS: Record<string, { w: number; h: number }> = {
  "1:1": { w: 1080, h: 1080 },
  "4:5": { w: 1080, h: 1350 },
  "9:16": { w: 1080, h: 1920 },
};

function makeText(
  text: string,
  role: CanvasElementRole,
  opts: Record<string, any>,
  w: number,
  h: number
) {
  return {
    type: "Textbox",
    left: opts.left ?? w * 0.1,
    top: opts.top ?? h * 0.3,
    width: opts.width ?? w * 0.8,
    text,
    fontSize: opts.fontSize ?? 48,
    fontFamily: opts.fontFamily ?? "Plus Jakarta Sans",
    fontWeight: opts.fontWeight ?? "bold",
    fill: opts.fill ?? "#e8eaff",
    textAlign: opts.textAlign ?? "center",
    data: { id: crypto.randomUUID(), role, editable: true },
    ...opts,
  };
}

function makeRect(opts: Record<string, any>, w: number, h: number) {
  return {
    type: "Rect",
    left: opts.left ?? 0,
    top: opts.top ?? 0,
    width: opts.width ?? w,
    height: opts.height ?? h,
    fill: opts.fill ?? "#4ecdc4",
    rx: opts.rx ?? 0,
    ry: opts.ry ?? 0,
    selectable: opts.selectable ?? false,
    data: {
      id: crypto.randomUUID(),
      role: opts.role ?? "decoration",
      editable: false,
    },
    ...opts,
  };
}

function makeCircle(opts: Record<string, any>) {
  return {
    type: "Circle",
    left: opts.left ?? 0,
    top: opts.top ?? 0,
    radius: opts.radius ?? 10,
    fill: opts.fill ?? "#4ecdc4",
    selectable: opts.selectable ?? false,
    data: {
      id: crypto.randomUUID(),
      role: opts.role ?? "decoration",
      editable: false,
    },
    ...opts,
  };
}

function makeTriangle(opts: Record<string, any>) {
  return {
    type: "Triangle",
    left: opts.left ?? 0,
    top: opts.top ?? 0,
    width: opts.width ?? 60,
    height: opts.height ?? 60,
    fill: opts.fill ?? "#4ecdc4",
    selectable: opts.selectable ?? false,
    angle: opts.angle ?? 0,
    data: {
      id: crypto.randomUUID(),
      role: opts.role ?? "decoration",
      editable: false,
    },
    ...opts,
  };
}

export function generatePresetJson(
  presetId: string,
  aspectRatio: string
): object {
  const dims = ASPECT_DIMS[aspectRatio] || ASPECT_DIMS["1:1"];
  const w = dims.w;
  const h = dims.h;

  const base = {
    version: "6.0.0",
    objects: [] as object[],
    background: "#080b1e",
  };

  const txt = (text: string, role: CanvasElementRole, opts: Record<string, any>) =>
    makeText(text, role, opts, w, h);
  const rect = (opts: Record<string, any>) => makeRect(opts, w, h);

  switch (presetId) {
    // ── bold-statement (enhanced) ──
    case "bold-statement":
      base.background = "#080b1e";
      base.objects = [
        // Gradient overlay top
        rect({ fill: "rgba(108, 92, 231, 0.08)", height: h * 0.4, top: 0, role: "background" }),
        // Large accent bar
        rect({ fill: "#4ecdc4", height: 8, top: h * 0.13, left: w * 0.25, width: w * 0.5, role: "decoration" }),
        // Corner accents
        rect({ fill: "#6c5ce7", width: 40, height: 4, top: h * 0.08, left: w * 0.1, role: "decoration" }),
        rect({ fill: "#6c5ce7", width: 4, height: 40, top: h * 0.08, left: w * 0.1, role: "decoration" }),
        // Headline
        txt("HEADLINE AQUI", "headline", { top: h * 0.25, fontSize: 72, fontWeight: "900" }),
        // Subtitle
        txt("Subtitulo do post", "subheadline", { top: h * 0.55, fontSize: 32, fontWeight: "400", fill: "#5e6388" }),
        // Bottom accent shape
        rect({ fill: "rgba(78, 205, 196, 0.15)", height: h * 0.12, top: h * 0.88, role: "decoration" }),
        rect({ fill: "#4ecdc4", height: 3, top: h * 0.88, left: w * 0.3, width: w * 0.4, role: "decoration" }),
        // Brand
        txt("@marca", "brand", { top: h * 0.9, fontSize: 24, fill: "#4ecdc4" }),
      ];
      break;

    // ── gradient-wave (enhanced: 3 overlapping shapes) ──
    case "gradient-wave":
      base.background = "#080b1e";
      base.objects = [
        rect({ fill: "rgba(108, 92, 231, 0.25)", height: h * 0.55, top: h * 0.45, role: "background" }),
        rect({ fill: "rgba(78, 205, 196, 0.18)", height: h * 0.4, top: h * 0.6, role: "background" }),
        rect({ fill: "rgba(108, 92, 231, 0.12)", height: h * 0.25, top: h * 0.75, role: "background" }),
        // Decorative circles
        makeCircle({ left: w * 0.8, top: h * 0.08, radius: 30, fill: "rgba(108, 92, 231, 0.3)", role: "decoration" }),
        makeCircle({ left: w * 0.05, top: h * 0.7, radius: 20, fill: "rgba(78, 205, 196, 0.25)", role: "decoration" }),
        txt("Titulo Gradiente", "headline", { top: h * 0.2, fontSize: 64, fontWeight: "800" }),
        txt("Texto complementar aqui", "body", { top: h * 0.5, fontSize: 28, fill: "#c0c4e8" }),
      ];
      break;

    case "minimal-clean":
      base.background = "#ffffff";
      base.objects = [
        txt("Titulo Limpo", "headline", { top: h * 0.35, fontSize: 56, fontWeight: "700", fill: "#1a1a2e" }),
        txt("Descricao minimalista", "subheadline", { top: h * 0.55, fontSize: 24, fontWeight: "400", fill: "#666680" }),
        rect({ fill: "#4ecdc4", height: 4, top: h * 0.75, left: w * 0.4, width: w * 0.2, role: "decoration" }),
      ];
      break;

    // ── quote-card (enhanced: quotation marks, corner accents) ──
    case "quote-card":
      base.background = "#0c0f24";
      base.objects = [
        // Corner accents top-left
        rect({ fill: "#4ecdc4", width: 50, height: 3, top: h * 0.05, left: w * 0.05, role: "decoration" }),
        rect({ fill: "#4ecdc4", width: 3, height: 50, top: h * 0.05, left: w * 0.05, role: "decoration" }),
        // Corner accents bottom-right
        rect({ fill: "#4ecdc4", width: 50, height: 3, top: h * 0.95, left: w * 0.95 - 50, role: "decoration" }),
        rect({ fill: "#4ecdc4", width: 3, height: 50, top: h * 0.95 - 50, left: w * 0.95, role: "decoration" }),
        // Big quotation mark
        txt("\u201C", "decoration", { top: h * 0.08, left: w * 0.08, fontSize: 200, fill: "rgba(78, 205, 196, 0.3)", fontWeight: "400", textAlign: "left" }),
        // Quote text
        txt("Sua frase inspiradora aqui", "headline", { top: h * 0.3, fontSize: 44, fontWeight: "600", textAlign: "left", left: w * 0.1, width: w * 0.8 }),
        // Divider
        rect({ fill: "#4ecdc4", height: 3, top: h * 0.7, left: w * 0.1, width: w * 0.15, role: "decoration" }),
        // Author
        txt("\u2014 Autor", "brand", { top: h * 0.75, fontSize: 22, fill: "#5e6388", textAlign: "left", left: w * 0.1 }),
        // Closing quote faded
        txt("\u201D", "decoration", { top: h * 0.6, left: w * 0.75, fontSize: 160, fill: "rgba(78, 205, 196, 0.08)", fontWeight: "400", textAlign: "right", width: w * 0.2 }),
      ];
      break;

    case "tip-numbered":
      base.background = "#080b1e";
      base.objects = [
        txt("01", "slide-number", { top: h * 0.08, left: w * 0.1, fontSize: 120, fontWeight: "900", fill: "#4ecdc4", textAlign: "left", width: w * 0.3 }),
        txt("DICA", "category", { top: h * 0.1, left: w * 0.55, fontSize: 20, fill: "#6c5ce7", fontWeight: "700", textAlign: "left", width: w * 0.35 }),
        rect({ fill: "#4ecdc4", height: 3, top: h * 0.35, left: w * 0.1, width: w * 0.8, role: "decoration" }),
        txt("Titulo da dica", "headline", { top: h * 0.4, fontSize: 48, fontWeight: "700", textAlign: "left", left: w * 0.1, width: w * 0.8 }),
        txt("Descricao detalhada da dica que voce quer compartilhar com sua audiencia.", "body", { top: h * 0.6, fontSize: 24, fontWeight: "400", fill: "#8b8fb8", textAlign: "left", left: w * 0.1, width: w * 0.8 }),
      ];
      break;

    // ── stats-highlight (enhanced: progress bar, context line) ──
    case "stats-highlight":
      base.background = "#080b1e";
      base.objects = [
        // Top accent
        rect({ fill: "rgba(78, 205, 196, 0.06)", height: h * 0.15, top: 0, role: "background" }),
        // Big number
        txt("87%", "headline", { top: h * 0.18, fontSize: 140, fontWeight: "900", fill: "#4ecdc4" }),
        // Context
        txt("dos profissionais concordam", "subheadline", { top: h * 0.5, fontSize: 32, fontWeight: "500" }),
        // Progress bar background
        rect({ fill: "#141736", height: 12, top: h * 0.66, left: w * 0.15, width: w * 0.7, rx: 6, ry: 6, role: "decoration" }),
        // Progress bar fill (87%)
        rect({ fill: "#4ecdc4", height: 12, top: h * 0.66, left: w * 0.15, width: w * 0.7 * 0.87, rx: 6, ry: 6, role: "decoration" }),
        // Divider
        rect({ fill: "#6c5ce7", height: 4, top: h * 0.74, left: w * 0.3, width: w * 0.4, role: "decoration" }),
        // Source
        txt("Fonte: Pesquisa 2026", "body", { top: h * 0.8, fontSize: 18, fill: "#5e6388" }),
      ];
      break;

    case "split-content":
      base.background = "#080b1e";
      base.objects = [
        rect({ fill: "#4ecdc4", width: w * 0.4, height: h, left: 0, role: "background" }),
        txt("TITULO", "headline", { top: h * 0.3, left: w * 0.05, width: w * 0.3, fontSize: 48, fontWeight: "900", fill: "#080b1e", textAlign: "left" }),
        txt("Conteudo do lado direito com mais detalhes sobre o assunto.", "body", { top: h * 0.3, left: w * 0.48, width: w * 0.45, fontSize: 28, fontWeight: "400", fill: "#c0c4e8", textAlign: "left" }),
        txt("@marca", "brand", { top: h * 0.85, left: w * 0.48, fontSize: 20, fill: "#5e6388", textAlign: "left" }),
      ];
      break;

    // ── carousel-slide (enhanced: slide dots, header gradient) ──
    case "carousel-slide":
      base.background = "#0c0f24";
      base.objects = [
        // Header gradient
        rect({ fill: "#141736", width: w, height: 90, top: 0, role: "decoration" }),
        rect({ fill: "rgba(108, 92, 231, 0.15)", width: w, height: 90, top: 0, role: "decoration" }),
        // Series name
        txt("NOME DA SERIE", "category", { top: 30, fontSize: 18, fill: "#4ecdc4", fontWeight: "700" }),
        // Headline
        txt("Titulo do Slide", "headline", { top: h * 0.25, fontSize: 56, fontWeight: "800" }),
        // Body
        txt("Conteudo principal do slide do carrossel.", "body", { top: h * 0.55, fontSize: 26, fill: "#8b8fb8" }),
        // Footer
        rect({ fill: "#141736", width: w, height: 90, top: h - 90, role: "decoration" }),
        // Slide counter dots
        makeCircle({ left: w * 0.5 - 40, top: h - 50, radius: 5, fill: "#4ecdc4", role: "decoration" }),
        makeCircle({ left: w * 0.5 - 20, top: h - 50, radius: 5, fill: "#5e6388", role: "decoration" }),
        makeCircle({ left: w * 0.5, top: h - 50, radius: 5, fill: "#5e6388", role: "decoration" }),
        makeCircle({ left: w * 0.5 + 20, top: h - 50, radius: 5, fill: "#5e6388", role: "decoration" }),
        makeCircle({ left: w * 0.5 + 40, top: h - 50, radius: 5, fill: "#5e6388", role: "decoration" }),
        // Slide number
        txt("1/5", "slide-number", { top: h - 60, fontSize: 16, fill: "#5e6388", left: w * 0.8, width: w * 0.15, textAlign: "right" }),
      ];
      break;

    case "editorial":
      base.background = "#0c0f24";
      base.objects = [
        rect({ fill: "#4ecdc4", width: 4, height: h * 0.6, left: w * 0.08, top: h * 0.2, role: "decoration" }),
        txt("Editorial", "category", { top: h * 0.12, left: w * 0.13, fontSize: 16, fill: "#6c5ce7", fontWeight: "600", textAlign: "left", width: w * 0.8 }),
        txt("Titulo do artigo editorial aqui", "headline", { top: h * 0.22, left: w * 0.13, width: w * 0.75, fontSize: 44, fontWeight: "700", textAlign: "left" }),
        txt("Paragrafo com o conteudo principal do editorial. Aqui voce escreve o texto completo.", "body", { top: h * 0.5, left: w * 0.13, width: w * 0.75, fontSize: 22, fontWeight: "400", fill: "#8b8fb8", textAlign: "left" }),
        txt("Leia mais \u2192", "cta", { top: h * 0.82, left: w * 0.13, fontSize: 20, fill: "#4ecdc4", fontWeight: "600", textAlign: "left" }),
      ];
      break;

    case "tweet-quote":
      base.background = "#0c0f24";
      base.objects = [
        rect({ fill: "#141736", width: w * 0.85, height: h * 0.6, left: w * 0.075, top: h * 0.2, rx: 16, ry: 16, role: "decoration" }),
        txt("Tweet ou frase que voce quer destacar no seu feed.", "headline", { top: h * 0.32, left: w * 0.12, width: w * 0.76, fontSize: 36, fontWeight: "500", textAlign: "left" }),
        rect({ fill: "#4ecdc4", height: 3, top: h * 0.65, left: w * 0.12, width: w * 0.2, role: "decoration" }),
        txt("@usuario \u2022 10h", "brand", { top: h * 0.7, left: w * 0.12, fontSize: 18, fill: "#5e6388", textAlign: "left" }),
      ];
      break;

    case "vitor-thread":
      base.background = "#080b1e";
      base.objects = [
        rect({ fill: "#6c5ce7", width: w * 0.15, height: h, left: 0, role: "background" }),
        txt("01", "slide-number", { top: h * 0.35, left: w * 0.02, width: w * 0.11, fontSize: 64, fontWeight: "900", fill: "#ffffff" }),
        txt("Titulo da Thread", "headline", { top: h * 0.15, left: w * 0.2, width: w * 0.72, fontSize: 48, fontWeight: "800", textAlign: "left" }),
        txt("Conteudo detalhado da thread. Aqui voce desenvolve o argumento principal.", "body", { top: h * 0.45, left: w * 0.2, width: w * 0.72, fontSize: 24, fill: "#8b8fb8", textAlign: "left" }),
        txt("Salve para depois \u2192", "cta", { top: h * 0.82, left: w * 0.2, fontSize: 20, fill: "#4ecdc4", fontWeight: "600", textAlign: "left" }),
      ];
      break;

    case "vitor-quote":
      base.background = "#080b1e";
      base.objects = [
        rect({ fill: "#6c5ce7", width: w, height: h * 0.08, top: 0, role: "decoration" }),
        rect({ fill: "#6c5ce7", width: w, height: h * 0.08, top: h * 0.92, role: "decoration" }),
        txt("\u201C", "decoration", { top: h * 0.12, fontSize: 160, fill: "#6c5ce7", fontWeight: "400" }),
        txt("Frase impactante que fica na mente do seguidor.", "headline", { top: h * 0.35, fontSize: 42, fontWeight: "600" }),
        rect({ fill: "#4ecdc4", height: 3, top: h * 0.7, left: w * 0.35, width: w * 0.3, role: "decoration" }),
        txt("NOME DO AUTOR", "brand", { top: h * 0.76, fontSize: 20, fill: "#4ecdc4", fontWeight: "700" }),
        txt("Cargo ou descricao", "subheadline", { top: h * 0.82, fontSize: 16, fill: "#5e6388" }),
      ];
      break;

    // ══════════════════════════════════════════════
    //   NEW PRESETS (4 additional)
    // ══════════════════════════════════════════════

    case "brand-hero":
      base.background = "#080b1e";
      base.objects = [
        // Background gradient accents
        rect({ fill: "rgba(108, 92, 231, 0.12)", height: h, width: w * 0.6, left: w * 0.4, role: "background" }),
        rect({ fill: "rgba(78, 205, 196, 0.08)", height: h * 0.5, width: w, top: h * 0.5, role: "background" }),
        // Top decorative line
        rect({ fill: "#4ecdc4", height: 4, top: h * 0.1, left: w * 0.2, width: w * 0.6, role: "decoration" }),
        // Large centered brand text
        txt("SUA MARCA", "headline", { top: h * 0.28, fontSize: 80, fontWeight: "900", fill: "#e8eaff" }),
        // Supporting subtitle
        txt("Posicionamento que transforma", "subheadline", { top: h * 0.5, fontSize: 30, fontWeight: "400", fill: "#8b8fb8" }),
        // Bottom accent shapes
        rect({ fill: "#6c5ce7", height: 60, width: 60, left: w * 0.1, top: h * 0.72, rx: 12, ry: 12, role: "decoration" }),
        rect({ fill: "#4ecdc4", height: 60, width: 60, left: w * 0.1 + 70, top: h * 0.72, rx: 12, ry: 12, role: "decoration", opacity: 0.5 }),
        rect({ fill: "#6c5ce7", height: 60, width: 60, left: w * 0.1 + 140, top: h * 0.72, rx: 12, ry: 12, role: "decoration", opacity: 0.3 }),
        // Brand handle
        txt("@suamarca", "brand", { top: h * 0.88, fontSize: 22, fill: "#4ecdc4", fontWeight: "600" }),
      ];
      break;

    case "data-card":
      base.background = "#080b1e";
      base.objects = [
        // Subtle top accent
        rect({ fill: "rgba(78, 205, 196, 0.1)", height: h * 0.35, top: 0, role: "background" }),
        // Category label
        txt("METRICA", "category", { top: h * 0.08, fontSize: 16, fill: "#6c5ce7", fontWeight: "700", letterSpacing: 3 }),
        // Big number
        txt("3.2x", "headline", { top: h * 0.18, fontSize: 130, fontWeight: "900", fill: "#4ecdc4" }),
        // Label
        txt("mais engajamento", "subheadline", { top: h * 0.48, fontSize: 36, fontWeight: "600", fill: "#e8eaff" }),
        // Description
        txt("Perfis que publicam com consistencia tem resultados muito superiores.", "body", { top: h * 0.6, fontSize: 22, fontWeight: "400", fill: "#8b8fb8" }),
        // Divider
        rect({ fill: "#6c5ce7", height: 4, top: h * 0.76, left: w * 0.25, width: w * 0.5, role: "decoration" }),
        // Icon placeholder (circle)
        makeCircle({ left: w * 0.45, top: h * 0.82, radius: 24, fill: "rgba(108, 92, 231, 0.2)", role: "decoration" }),
        // Source
        txt("Fonte: Analise 2026", "body", { top: h * 0.91, fontSize: 16, fill: "#5e6388" }),
      ];
      break;

    case "list-tips":
      base.background = "#080b1e";
      base.objects = [
        // Header accent
        rect({ fill: "#4ecdc4", height: 6, top: 0, left: 0, width: w, role: "decoration" }),
        // Title
        txt("5 DICAS SOBRE", "category", { top: h * 0.05, fontSize: 18, fill: "#4ecdc4", fontWeight: "700" }),
        txt("Marketing Digital", "headline", { top: h * 0.1, fontSize: 48, fontWeight: "800" }),
        // Divider
        rect({ fill: "#6c5ce7", height: 3, top: h * 0.22, left: w * 0.1, width: w * 0.8, role: "decoration" }),
        // Tip 1
        txt("01", "decoration", { top: h * 0.26, left: w * 0.08, fontSize: 28, fontWeight: "900", fill: "#4ecdc4", textAlign: "left", width: w * 0.1 }),
        txt("Conherca sua audiencia profundamente", "body", { top: h * 0.265, left: w * 0.18, fontSize: 22, fontWeight: "500", fill: "#e8eaff", textAlign: "left", width: w * 0.72 }),
        // Tip 2
        txt("02", "decoration", { top: h * 0.35, left: w * 0.08, fontSize: 28, fontWeight: "900", fill: "#4ecdc4", textAlign: "left", width: w * 0.1 }),
        txt("Publique com consistencia e frequencia", "body", { top: h * 0.355, left: w * 0.18, fontSize: 22, fontWeight: "500", fill: "#e8eaff", textAlign: "left", width: w * 0.72 }),
        // Tip 3
        txt("03", "decoration", { top: h * 0.44, left: w * 0.08, fontSize: 28, fontWeight: "900", fill: "#4ecdc4", textAlign: "left", width: w * 0.1 }),
        txt("Use dados para otimizar resultados", "body", { top: h * 0.445, left: w * 0.18, fontSize: 22, fontWeight: "500", fill: "#e8eaff", textAlign: "left", width: w * 0.72 }),
        // Tip 4
        txt("04", "decoration", { top: h * 0.53, left: w * 0.08, fontSize: 28, fontWeight: "900", fill: "#4ecdc4", textAlign: "left", width: w * 0.1 }),
        txt("Invista em conteudo de valor real", "body", { top: h * 0.535, left: w * 0.18, fontSize: 22, fontWeight: "500", fill: "#e8eaff", textAlign: "left", width: w * 0.72 }),
        // Tip 5
        txt("05", "decoration", { top: h * 0.62, left: w * 0.08, fontSize: 28, fontWeight: "900", fill: "#4ecdc4", textAlign: "left", width: w * 0.1 }),
        txt("Adapte o formato para cada plataforma", "body", { top: h * 0.625, left: w * 0.18, fontSize: 22, fontWeight: "500", fill: "#e8eaff", textAlign: "left", width: w * 0.72 }),
        // Divider bottom
        rect({ fill: "#6c5ce7", height: 3, top: h * 0.74, left: w * 0.1, width: w * 0.8, role: "decoration" }),
        // CTA
        txt("Salve para consultar depois \u2192", "cta", { top: h * 0.8, fontSize: 20, fill: "#4ecdc4", fontWeight: "600" }),
        // Brand
        txt("@marca", "brand", { top: h * 0.9, fontSize: 18, fill: "#5e6388" }),
      ];
      break;

    case "cta-action":
      base.background = "#080b1e";
      base.objects = [
        // Background accent
        rect({ fill: "rgba(108, 92, 231, 0.1)", height: h, width: w, role: "background" }),
        // Top decorative triangle/arrow
        makeTriangle({ left: w * 0.85, top: h * 0.05, width: 50, height: 50, fill: "rgba(78, 205, 196, 0.2)", angle: 90, role: "decoration" }),
        // Headline
        txt("Pronto para comecar?", "headline", { top: h * 0.2, fontSize: 56, fontWeight: "800" }),
        // Body text
        txt("Transforme sua presenca digital com estrategias que realmente funcionam.", "body", { top: h * 0.42, fontSize: 26, fontWeight: "400", fill: "#8b8fb8" }),
        // CTA Button shape (rounded rect)
        rect({ fill: "#4ecdc4", height: 64, top: h * 0.62, left: w * 0.2, width: w * 0.6, rx: 32, ry: 32, role: "decoration" }),
        // CTA text
        txt("COMECE AGORA", "cta", { top: h * 0.635, fontSize: 24, fontWeight: "800", fill: "#080b1e", left: w * 0.2, width: w * 0.6 }),
        // Arrow accent below CTA
        makeTriangle({ left: w * 0.48, top: h * 0.72, width: 30, height: 20, fill: "#4ecdc4", angle: 180, role: "decoration" }),
        // Subtle sub-CTA
        txt("Teste gratis por 7 dias", "subheadline", { top: h * 0.78, fontSize: 18, fill: "#5e6388" }),
        // Brand
        txt("@marca", "brand", { top: h * 0.9, fontSize: 20, fill: "#6c5ce7", fontWeight: "600" }),
      ];
      break;

    default:
      base.objects = [
        txt("Template", "headline", { top: h * 0.35, fontSize: 56 }),
      ];
  }

  return base;
}

/** All available preset IDs */
export const ALL_PRESET_IDS = [
  "bold-statement",
  "gradient-wave",
  "minimal-clean",
  "quote-card",
  "tip-numbered",
  "stats-highlight",
  "split-content",
  "carousel-slide",
  "editorial",
  "tweet-quote",
  "vitor-thread",
  "vitor-quote",
  "brand-hero",
  "data-card",
  "list-tips",
  "cta-action",
];
