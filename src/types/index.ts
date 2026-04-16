export interface Empresa {
  id: string;
  nome: string;
  descricao: string;
  nicho: string;
  logo_url: string | null;
  website: string | null;
  cor_primaria: string;
  cor_secundaria: string;
  redes_sociais: RedesSociais;
  config_rss: ConfigRSS[];
  instagram_handle?: string;
  concorrentes_ig?: string[];
  referencias_ig?: string[];
  referencias_sites?: string[];
  created_at: string;
  updated_at: string;
}

export interface RedesSociais {
  instagram?: RedeSocialConfig;
  facebook?: RedeSocialConfig;
  linkedin?: RedeSocialConfig;
  twitter?: RedeSocialConfig;
  youtube?: RedeSocialConfig;
  tiktok?: RedeSocialConfig;
}

export interface RedeSocialConfig {
  conectado: boolean;
  username: string;
  access_token?: string;
  page_id?: string;
  provider_user_id?: string;
  profile_picture_url?: string;
  followers_count?: number;
}

export interface SocialConnection {
  id: string;
  empresa_id: string;
  provider: PlataformaRede;
  provider_user_id: string;
  username: string | null;
  display_name: string | null;
  profile_picture_url: string | null;
  access_token: string;
  token_expires_at: string | null;
  page_id: string | null;
  scopes: string[];
  is_active: boolean;
  last_verified_at: string | null;
  last_error: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Post {
  id: string;
  empresa_id: string;
  titulo: string;
  conteudo: string;
  midia_url: string | null;
  plataformas: string[];
  status:
    | "rascunho"
    | "pendente_aprovacao"
    | "agendado"
    | "publicado"
    | "erro"
    | "rejeitado";
  agendado_para: string | null;
  publicado_em: string | null;
  tematica: string;
  metricas: PostMetricas | null;
  created_at: string;
  approval_required?: boolean;
  rejection_reason?: string | null;
}

// ── Fluxo de aprovação de posts ──

export type PostApprovalStatus = "pending" | "approved" | "rejected";

export interface PostApproval {
  id: string;
  postId: string;
  empresaId: string;
  requestedBy: string | null;
  reviewedBy: string | null;
  status: PostApprovalStatus;
  comment: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PostMetricas {
  impressoes: number;
  curtidas: number;
  comentarios: number;
  compartilhamentos: number;
  cliques: number;
  alcance: number;
}

export interface Concorrente {
  id: string;
  empresa_id: string;
  nome: string;
  plataformas: ConcorrentePlataforma[];
  created_at: string;
}

export interface ConcorrentePlataforma {
  rede: string;
  username: string;
  seguidores: number;
  posts_recentes: PostConcorrente[];
  taxa_engajamento: number;
  freq_postagem: string;
}

export interface PostConcorrente {
  conteudo: string;
  data: string;
  curtidas: number;
  comentarios: number;
  compartilhamentos: number;
}

export interface Noticia {
  id: string;
  titulo: string;
  fonte: string;
  url: string;
  resumo: string;
  topico: string;
  publicado_em: string;
  imagem_url: string | null;
}

export interface ConfigRSS {
  nome: string;
  url: string;
  topico: string;
  ativo: boolean;
}

export interface AnalyticsData {
  total_impressoes: number;
  taxa_engajamento: number;
  crescimento_seguidores: number;
  total_seguidores: number;
  melhores_posts: Post[];
  dados_diarios: DadoDiario[];
}

export interface DadoDiario {
  data: string;
  impressoes: number;
  engajamento: number;
  seguidores_novos: number;
  interacoes: number;
  seguidores_total: number;
}

export type PlataformaRede =
  | "instagram"
  | "facebook"
  | "linkedin"
  | "twitter"
  | "youtube"
  | "tiktok";

// ── Marca DNA ──

export interface MarcaDNA {
  id: string;
  empresa_id: string;
  instagram_analysis: InstagramDNAAnalysis;
  site_analysis: SiteDNAAnalysis;
  concorrentes_analysis: ConcorrenteDNAAnalysis[];
  referencias_analysis: ReferenciaDNAAnalysis[];
  dna_sintetizado: DNASintetizado;
  status: "pendente" | "analisando" | "completo" | "erro";
  ultima_analise: string | null;
  created_at: string;
  updated_at: string;
}

export interface InstagramDNAAnalysis {
  username?: string;
  seguidores?: number;
  bio?: string;
  resumo_visual?: string;
  tom_legendas?: string;
  temas_recorrentes?: string[];
  estilo_visual?: string;
  formatos_mais_usados?: string[];
  hashtags_frequentes?: string[];
  frequencia_postagem?: string;
  posts_recentes?: { caption: string; likes: number; comments: number; isVideo: boolean }[];
}

export interface SiteDNAAnalysis {
  resumo?: string;
  tom_de_voz?: string;
  publico_alvo?: string;
  palavras_chave?: string[];
  proposta_valor?: string;
  cores_predominantes?: string[];
}

export interface ConcorrenteDNAAnalysis {
  nome: string;
  instagram?: string;
  seguidores?: number;
  resumo?: string;
  pontos_fortes?: string[];
  estrategia_conteudo?: string;
  frequencia?: string;
  temas?: string[];
}

export interface ReferenciaDNAAnalysis {
  fonte: string;
  tipo: "instagram" | "site";
  resumo?: string;
  tom?: string;
  estrategia?: string;
  elementos_destaque?: string[];
}

export interface DNASintetizado {
  tom_de_voz?: string;
  personalidade_marca?: string;
  proposta_valor?: string;
  publico_alvo?: string;
  paleta_cores?: string[];
  estilo_visual?: string;
  pilares_conteudo?: string[];
  temas_recomendados?: string[];
  formatos_recomendados?: string[];
  hashtags_recomendadas?: string[];
  frequencia_ideal?: string;
  diferenciais_vs_concorrentes?: string[];
  oportunidades?: string[];
  palavras_usar?: string[];
  palavras_evitar?: string[];
  exemplos_legenda?: string[];
}
