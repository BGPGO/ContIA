// ── Copy Studio Types ──
// Types for the chat-based collaborative content creation system

import { ContentFormat, ContentTone } from "./ai";

// ── Rich Slide Types (professional carousel layouts) ───────────────────────

/** Content section types for rich slide layouts */
export type SlideContentType = "cover" | "content" | "data" | "timeline" | "quote" | "list" | "cta";

/** A text segment that may have highlights */
export interface RichText {
  text: string;
  highlight?: boolean;  // Should this segment be visually emphasized?
  bold?: boolean;
  color?: string;       // Optional accent color override
}

/** A stat/metric to display prominently */
export interface StatBlock {
  value: string;        // e.g. "R$ 100 bi", "47%", "3x"
  label: string;        // e.g. "em impostos estimados"
  source?: string;      // e.g. "Fonte: IBGE 2025"
}

/** A callout/quote box */
export interface CalloutBlock {
  text: string;
  attribution?: string; // Who said it or source
  style?: "quote" | "insight" | "warning" | "highlight";
}

/** A list item (for timeline or bullet lists) */
export interface ListItem {
  title: string;        // Bold/highlighted part
  description?: string; // Regular text
  date?: string;        // For timeline items
}

/** A rich content section within a slide */
export interface SlideSection {
  type: "paragraph" | "stat" | "callout" | "list" | "divider" | "cta-button";
  // For paragraph:
  content?: RichText[];   // Array of text segments (some highlighted, some not)
  // For stat:
  stat?: StatBlock;
  // For callout:
  callout?: CalloutBlock;
  // For list:
  items?: ListItem[];
  // For cta-button:
  buttonText?: string;
  buttonSubtext?: string;
}

/** Enhanced slide structure for professional carousels */
export interface RichSlide {
  slideNumber: number;
  contentType: SlideContentType;
  tag?: string;           // Small category label (e.g. "TRIBUTACAO")
  headline: string;
  headlineHighlights?: string[];  // Words within headline to highlight in accent color
  sections: SlideSection[];
  footnote?: string;      // Small attribution/source at bottom
}

// ── Copy content structure — what the AI produces and iterates on ──────────

export interface CopyContent {
  headline: string;
  caption: string;
  hashtags: string[];
  cta: string;
  slides?: CopySlide[];       // for carousels (basic)
  richSlides?: RichSlide[];   // for carousels (rich professional layout)
  reelsScript?: ReelsScript;  // for reels
  imagePrompt?: string;       // for DALL-E generation later
}

export interface CopySlide {
  slideNumber: number;
  headline: string;
  body: string;
  imagePrompt?: string;
  // Rich fields (optional for backward compat)
  contentType?: SlideContentType;
  tag?: string;
  headlineHighlights?: string[];
  sections?: SlideSection[];
  footnote?: string;
}

export interface ReelsScript {
  hook: string;
  corpo: string[];
  cta: string;
  duracao: string;
  musica_sugerida?: string;
}

// Chat message in a copy session
export interface CopyChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  copy_snapshot?: CopyContent;  // AI attaches updated copy with each response
  timestamp: string;
}

// Quick action type
export type QuickAction =
  | "gancho_forte"
  | "encurtar"
  | "alongar"
  | "trocar_tom"
  | "adicionar_cta"
  | "mais_hashtags"
  | "menos_hashtags"
  | "mais_emoji"
  | "menos_emoji"
  | "reformular";

// Quick action metadata
export interface QuickActionConfig {
  id: QuickAction;
  label: string;
  icon: string; // lucide icon name
  prompt: string; // what gets sent to AI
}

// Session status
export type CopySessionStatus = "draft" | "approved" | "designed" | "exported";

// Full copy session
export interface CopySession {
  id: string;
  empresa_id: string;
  user_id: string;
  title: string;
  format: ContentFormat;
  tone: ContentTone;
  platforms: string[];
  topic: string;
  current_copy: CopyContent | null;
  messages: CopyChatMessage[];
  dna_context: Record<string, unknown> | null;
  style_profile: Record<string, unknown> | null;
  status: CopySessionStatus;
  created_at: string;
  updated_at: string;
}

// API request/response types
export interface CopyChatRequest {
  session_id?: string;
  message: string;
  format: ContentFormat;
  tone: ContentTone;
  platforms: string[];
  topic: string;
  current_copy?: CopyContent | null;
  history: CopyChatMessage[];
  empresa_id: string;
}

export interface CopyChatResponse {
  message: string;       // AI's conversational response
  copy: CopyContent;     // Updated copy
  session_id: string;
}

// Quick actions config export
export const QUICK_ACTIONS: QuickActionConfig[] = [
  { id: "gancho_forte", label: "Gancho +", icon: "Zap", prompt: "Reescreva o gancho/headline para ser mais impactante e parar o scroll. Mantenha o restante." },
  { id: "encurtar", label: "Encurtar", icon: "Minimize2", prompt: "Encurte a legenda mantendo a essência. Seja mais direto." },
  { id: "alongar", label: "Expandir", icon: "Maximize2", prompt: "Expanda a legenda com mais detalhes e storytelling, mantendo o tom." },
  { id: "trocar_tom", label: "Tom", icon: "Palette", prompt: "Sugira 3 versões da legenda em tons diferentes (casual, inspirador, técnico). Mantenha o conteúdo." },
  { id: "adicionar_cta", label: "CTA", icon: "MousePointerClick", prompt: "Adicione ou melhore o CTA (call-to-action). Deve ser natural, não forçado." },
  { id: "mais_hashtags", label: "#Tags +", icon: "Hash", prompt: "Adicione mais hashtags estratégicas relevantes ao nicho e ao conteúdo." },
  { id: "menos_hashtags", label: "#Tags -", icon: "HashIcon", prompt: "Reduza para apenas 5 hashtags mais estratégicas." },
  { id: "mais_emoji", label: "Emoji +", icon: "Smile", prompt: "Adicione emojis estratégicos na legenda para tornar mais visual." },
  { id: "menos_emoji", label: "Emoji -", icon: "SmilePlus", prompt: "Remova ou reduza os emojis da legenda." },
  { id: "reformular", label: "Reformular", icon: "RefreshCw", prompt: "Reescreva completamente mantendo o mesmo tema e informações, mas com abordagem diferente." },
];
