export type ContentFormat = "post" | "carrossel" | "reels" | "email" | "copy";
export type ContentTone = "formal" | "casual" | "tecnico" | "divertido" | "inspirador";

export interface EmpresaContext {
  nome: string;
  descricao: string;
  nicho: string;
  website?: string;
  siteAnalysis?: string;
  instagramAnalysis?: string;
  tom?: ContentTone;
  dnaMarca?: string; // JSON stringified DNASintetizado
}

export interface GenerationRequest {
  format: ContentFormat;
  topic: string;
  empresaContext: EmpresaContext;
  plataformas: string[];
  tone: ContentTone;
  language?: string;
  additionalInstructions?: string;
}

export interface GeneratedContent {
  titulo: string;
  conteudo: string;
  hashtags: string[];
  cta: string;
  slides?: CarouselSlide[];
  reelsScript?: ReelsScript;
  emailSubject?: string;
  emailBody?: string;
  imagePrompt: string;
  imageUrl?: string;
  visualPost?: VisualPostContent;  // structured content for visual design
}

/** Structured content for visual post design */
export interface VisualPostContent {
  headline: string;        // Main impactful headline (max 60 chars)
  subheadline?: string;    // Supporting line (max 100 chars)
  body?: string;           // Body text (max 200 chars for visual posts)
  accentText?: string;     // Highlighted stat or key phrase
  cta: string;             // Short CTA (max 40 chars)
  suggestedTemplate: "bold-statement" | "gradient-wave" | "minimal-clean" | "quote-card" | "tip-numbered" | "stats-highlight" | "split-content" | "carousel-slide";
}

export interface CarouselSlide {
  slideNumber: number;
  titulo: string;
  conteudo: string;
  imagePrompt: string;
  imageUrl?: string;
}

export interface ReelsScript {
  hook: string;
  corpo: string[];
  cta: string;
  duracao: string;
  musica_sugerida: string;
}

export interface AnalyzeSiteRequest {
  url: string;
}

export interface AnalyzeSiteResponse {
  resumo: string;
  tom_de_voz: string;
  publico_alvo: string;
  palavras_chave: string[];
  proposta_valor: string;
  cores_predominantes: string[];
}

export interface AnalyzeInstagramRequest {
  username: string;
}

export interface AnalyzeInstagramResponse {
  resumo_visual: string;
  tom_legendas: string;
  temas_recorrentes: string[];
  estilo_visual: string;
  formatos_mais_usados: string[];
  hashtags_frequentes: string[];
  frequencia_postagem: string;
}

export interface PostVisualStyle {
  layout: string; // e.g. "background-image-darkened-with-text-overlay", "solid-color-with-centered-text", "split-image-text"
  background: {
    type: "image-darkened" | "solid-color" | "gradient" | "pattern";
    overlay_opacity: number; // 0-1
    colors: string[];
  };
  text: {
    position: "center" | "bottom" | "top" | "left";
    has_container: boolean;
    container_style?: string;
    font_style: string; // "bold-sans" | "elegant-serif" | "handwritten" | "modern-minimal"
    title_size: "large" | "medium" | "small";
    colors: string[];
  };
  elements: string[]; // e.g. ["logo", "watermark", "border", "icon", "emoji"]
  aspect_ratio: string; // "1:1", "4:5", "9:16"
}

export interface InstagramPostAnalysis {
  caption: string;
  visual_description: string;
  format: string; // "carrossel", "imagem", "reels", "video"
  engagement_cues: string[];
  topic: string;
}

export interface FullInstagramAnalysis {
  profile: {
    resumo_visual: string;
    tom_legendas: string;
    temas_recorrentes: string[];
    estilo_visual: string;
    formatos_mais_usados: string[];
    hashtags_frequentes: string[];
    frequencia_postagem: string;
  };
  visual_style: PostVisualStyle;
  recent_posts: InstagramPostAnalysis[];
  suggested_next_posts: SuggestedPost[];
}

export interface SuggestedPost {
  topic: string;
  format: string;
  reasoning: string;
  hook: string;
}

export interface PostTemplate {
  style: PostVisualStyle;
  titulo: string;
  subtitulo?: string;
  corpo?: string;
  cta?: string;
  hashtags: string[];
  background_image_prompt?: string;
}

export interface CreationTemplate {
  id: string;
  empresa_id: string;
  name: string;
  tone: ContentTone;
  platforms: string[];
  site_url?: string;
  instagram_username?: string;
  site_analysis?: AnalyzeSiteResponse | null;
  ig_analysis?: FullInstagramAnalysis | null;
  visual_style?: PostVisualStyle | null;
  brand_colors?: string[];
  created_at: string;
  updated_at: string;
}
