/**
 * Attribution types — Cross-channel attribution (CRM + Meta Ads + Instagram).
 * Criado por Squad Gamma (Wave 1). Consumido por Beta (endpoint) e Delta (UI).
 */

import type { StrategicInsight } from "./analytics";

/* ── Channel Source ──────────────────────────────────────────────── */

/**
 * Identifica o canal de origem de um lead/deal.
 * Inclui string para futureproofing (novos canais sem breaking change).
 */
export type ChannelSource =
  | "meta_ads"
  | "google_ads"
  | "instagram"
  | "facebook"
  | "linkedin"
  | "google" // organic search
  | "direto" // sem UTM
  | "referral"
  | "outro"
  | (string & Record<never, never>); // futureproof: permite string arbitrária preservando autocomplete

/* ── Totals ──────────────────────────────────────────────────────── */

export interface AttributionTotals {
  /** R$ — total Meta Ads + outros canais pagos */
  spend: number;
  /** Total de leads CRM no período */
  leads: number;
  dealsWon: number;
  /** Opcional — CRM attribution endpoint ainda não expõe este valor */
  dealsLost?: number;
  /** R$ — receita de deals won */
  revenue: number;
  /** spend / dealsWon — null quando dealsWon = 0 */
  cac: number | null;
  /** revenue / spend — null quando spend = 0 */
  roas: number | null;
  /** Tempo médio (dias) entre criação do lead e deal won */
  avgLeadToWon_days: number;
  /** revenue / dealsWon — null quando dealsWon = 0 */
  avgTicket: number | null;
  /** 0..1 — % das campanhas Meta linkadas com leads CRM */
  matchRate: number;
  igPosts: number;
  igEngagement: number;
}

/* ── Channel ROI ─────────────────────────────────────────────────── */

export interface ChannelROI {
  source: ChannelSource;
  medium: string | null;
  /** null para canais orgânicos sem gasto mapeado */
  spend: number | null;
  leads: number;
  dealsWon: number;
  revenue: number;
  cac: number | null;
  roas: number | null;
  /** 0..1 — dealsWon / leads */
  conversionRate: number;
  avgTicket: number | null;
}

/* ── Campaign Attribution ────────────────────────────────────────── */

export interface CampaignAttribution {
  campaignName: string;
  /** null se campanha existe no CRM mas sem match Meta */
  metaCampaignId: string | null;
  source: ChannelSource;
  spend: number;
  impressions: number;
  clicks: number;
  /** Conversões do pixel Meta (pode ser 0 se pixel não configurado) */
  metaConversions: number;
  /** Leads do CRM vinculados via utm_campaign match */
  crmLeads: number;
  crmDealsWon: number;
  crmRevenue: number;
  cac: number | null;
  roas: number | null;
  /** true se cruzamento Meta ↔ CRM foi bem-sucedido */
  matched: boolean;
}

/* ── Creative Performance ────────────────────────────────────────── */

export interface CreativePerformance {
  /** Valor de utm_content */
  contentName: string;
  /** utm_campaign pai */
  campaign: string;
  leadsCount: number;
  dealsWonCount: number;
  revenue: number;
  cac: number | null;
  /** URL da thumbnail/preview do criativo Meta — opcional */
  thumbnailUrl?: string | null;
  /** ID do criativo no Meta Ads Manager — opcional */
  metaContentId?: string | null;
}

/* ── Funnel End-to-End ───────────────────────────────────────────── */

/**
 * Estágios padronizados do funil de vendas.
 * Mapeia os nomes verbosos do CRM (ex: "Contato Feito") para chaves estáveis.
 */
export type FunnelStage =
  | "lead"
  | "contact_made"
  | "meeting_scheduled"
  | "meeting_held"
  | "proposal_sent"
  | "negotiation"
  | "won"
  | "lost";

export interface FunnelEndToEndStage {
  stage: FunnelStage;
  /** Label PT-BR para exibição */
  label: string;
  count: number;
  /** R$ — preenchido apenas no estágio "won" */
  valueSum?: number;
  /** % de conversão em relação ao estágio anterior (0..1) */
  conversionFromPrev?: number;
  /** % de conversão em relação ao topo do funil / leads iniciais (0..1) */
  conversionFromTop?: number;
}

/* ── Top IG Post ─────────────────────────────────────────────────── */

export interface TopIGPost {
  id: string;
  caption: string;
  publishedAt: string;
  thumbnailUrl: string | null;
  url: string;
  engagement: number;
  reach: number;
  /** Ex: "post", "reel", "carousel" */
  contentType: string;
}

/* ── Attribution Data (response root) ───────────────────────────── */

export interface AttributionData {
  period: {
    start: string;
    end: string;
  };
  totals: AttributionTotals;
  channelROI: ChannelROI[];
  campaignAttribution: CampaignAttribution[];
  creativePerformance: CreativePerformance[];
  funnelEndToEnd: FunnelEndToEndStage[];
  topIGPosts: TopIGPost[];
  insights: StrategicInsight[];
}
