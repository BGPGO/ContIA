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
}

export interface Post {
  id: string;
  empresa_id: string;
  titulo: string;
  conteudo: string;
  midia_url: string | null;
  plataformas: string[];
  status: "rascunho" | "agendado" | "publicado" | "erro";
  agendado_para: string | null;
  publicado_em: string | null;
  tematica: string;
  metricas: PostMetricas | null;
  created_at: string;
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
