/* ═══════════════════════════════════════════════════════════════════════════
   Custom Template Types — config-driven template system for "Meus Templates"
   ═══════════════════════════════════════════════════════════════════════════ */

export interface TemplateStyleConfig {
  // Background
  background: {
    type: "solid" | "gradient" | "image";
    color: string; // for solid
    gradientFrom?: string; // for gradient
    gradientTo?: string;
    gradientAngle?: number; // default 135
    imageUrl?: string; // for image bg
    overlayOpacity?: number; // 0-1, dark overlay on image/gradient
  };

  // Text
  text: {
    headlineSize: number; // 20-40 px
    headlineWeight: 600 | 700 | 800 | 900;
    headlineColor: string;
    headlineAlign: "left" | "center" | "right";
    subheadlineSize: number; // 12-18 px
    subheadlineColor: string;
    verticalPosition: "top" | "center" | "bottom";
    letterSpacing?: number; // -0.02 to 0.05
    highlightWords?: string[]; // words in headline to render in accent color
    highlightColor?: string; // color for highlighted words (default: accent)
  };

  // Decorative elements (toggles)
  decorations: {
    accentBar: "none" | "left" | "top" | "bottom";
    accentBarColor: string;
    cornerAccents: boolean;
    diagonalStripe: boolean;
    diagonalColor?: string;
    dotGrid: boolean;
    geometricFrame: boolean;
    floatingCircles: boolean;
    chevronBefore: boolean; // >> before headline
    quoteMarks: boolean; // decorative " "
    noiseTexture: boolean;
    radialGlow: boolean;
  };

  // Category tag
  category: {
    show: boolean;
    position: "top-left" | "top-right" | "top-center";
    style: "caps-text" | "pill-badge";
    color: string;
  };

  // Brand
  brand: {
    show: boolean;
    position: "bottom-right" | "bottom-left" | "bottom-center";
    showIcon: boolean; // small square icon with initial
    opacity: number; // 0.1-0.5
    color: string;
  };

  // Background decorative text (large letter/word behind content)
  backgroundText?: {
    content: string; // e.g. "B", "BGP", "01", "?"
    style: "outlined" | "solid" | "ghost"; // outlined = stroke only, solid = filled low opacity, ghost = very faint
    size: number; // 100-300 px
    position: "center" | "bottom-right" | "top-left" | "top-right" | "bottom-left";
    color: string;
    opacity: number; // 0.02-0.15
    rotation?: number; // degrees, default 0
  };

  // Separator/divider between headline and subheadline
  separator?: {
    show: boolean;
    style: "line" | "dots" | "accent-line" | "none";
    color: string;
    width: number; // 20-80 px
  };

  // Slide number (for carousels)
  slideIndicator: {
    show: boolean;
    style: "badge" | "large-bg-number" | "outlined-number";
  };
}

export interface CustomTemplate {
  id: string;
  empresa_id: string;
  name: string;
  description: string; // User's text brief

  style: TemplateStyleConfig;

  // AI context
  aiPrompt?: string; // Full prompt used to generate
  referenceImageUrls?: string[]; // Data URLs of reference images

  // Metadata
  created_at: string;
  updated_at: string;
}

export const DEFAULT_STYLE_CONFIG: TemplateStyleConfig = {
  background: {
    type: "gradient",
    color: "#1a1e2e",
    gradientFrom: "#151826",
    gradientTo: "#222740",
    gradientAngle: 160,
  },
  text: {
    headlineSize: 26,
    headlineWeight: 700,
    headlineColor: "#f0f0f5",
    headlineAlign: "left",
    subheadlineSize: 13,
    subheadlineColor: "rgba(255,255,255,0.35)",
    verticalPosition: "center",
    letterSpacing: -0.01,
  },
  decorations: {
    accentBar: "none",
    accentBarColor: "#4ecdc4",
    cornerAccents: false,
    diagonalStripe: false,
    dotGrid: false,
    geometricFrame: false,
    floatingCircles: false,
    chevronBefore: true,
    quoteMarks: false,
    noiseTexture: true,
    radialGlow: false,
  },
  category: {
    show: true,
    position: "top-right",
    style: "caps-text",
    color: "rgba(255,255,255,0.3)",
  },
  brand: {
    show: true,
    position: "bottom-right",
    showIcon: true,
    opacity: 0.2,
    color: "#4ecdc4",
  },
  slideIndicator: {
    show: false,
    style: "badge",
  },
};
