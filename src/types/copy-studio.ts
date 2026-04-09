// ── Copy Studio Types ──
// Types for the chat-based collaborative content creation system

import { ContentFormat, ContentTone } from "./ai";

// Copy content structure — what the AI produces and iterates on
export interface CopyContent {
  headline: string;
  caption: string;
  hashtags: string[];
  cta: string;
  slides?: CopySlide[];       // for carousels
  reelsScript?: ReelsScript;  // for reels
  imagePrompt?: string;       // for DALL-E generation later
}

export interface CopySlide {
  slideNumber: number;
  headline: string;
  body: string;
  imagePrompt?: string;
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
