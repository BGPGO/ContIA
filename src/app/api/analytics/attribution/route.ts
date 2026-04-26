/**
 * GET /api/analytics/attribution
 *
 * Endpoint de Atribuição Cross-Channel — cruza:
 *   • CRM BGPGO  (leads, deals, UTM via /api/analytics/attribution do CRM)
 *   • Meta Ads   (campanhas e gasto via content_items)
 *   • Instagram  (posts orgânicos via content_items)
 *
 * Query params obrigatórios:
 *   empresa_id   UUID da empresa
 *   period_start YYYY-MM-DD
 *   period_end   YYYY-MM-DD
 *
 * Auth: sessão Supabase (cookie). Usa admin client para leitura de dados.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminSupabase } from "@/lib/supabase/admin";
import type { StrategicInsight } from "@/types/analytics";
import type {
  AttributionData,
  AttributionTotals,
  ChannelROI,
  CampaignAttribution,
  CreativePerformance,
  FunnelEndToEndStage,
  TopIGPost,
  ChannelSource,
  FunnelStage,
} from "@/types/attribution";

/* ── Env ─────────────────────────────────────────────────────────── */

const CRM_API_URL =
  process.env.CRM_API_URL ?? "https://crm-api.bgpgo.com.br";

function getCrmApiKey(): string {
  return process.env.CRM_ANALYTICS_API_KEY ?? "";
}

/* ── CRM attribution response types ─────────────────────────────── */

/**
 * O CRM endpoint retorna shape com campos verbosos (leadsCount, dealsWonCount, dealsWonRevenue).
 * Aqui usamos any-friendly types que aceitam tanto os nomes verbosos quanto aliases curtos.
 */
interface CrmLeadItem {
  id: string;
  createdAt: string;
  // Pode vir achatado OU dentro de firstTouch
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_content?: string | null;
  firstTouch?: {
    at?: string;
    utm_source?: string | null;
    utm_medium?: string | null;
    utm_campaign?: string | null;
    utm_content?: string | null;
  };
  stage?: string | null;
  dealValue?: number | null;
  closedAt?: string | null;
  won?: boolean;
  deal?: {
    value?: number | null;
    status?: string;
    closedAt?: string | null;
  } | null;
}

interface CrmChannelSummary {
  source: string;
  medium: string | null;
  // Aliases verbosos (CRM) e curtos (ContIA esperava)
  leads?: number;
  leadsCount?: number;
  dealsWon?: number;
  dealsWonCount?: number;
  revenue?: number;
  dealsWonRevenue?: number;
  avgLeadToWon_days?: number;
  conversionRate?: number;
}

interface CrmCampaignSummary {
  campaign: string;
  source?: string;
  leads?: number;
  leadsCount?: number;
  dealsWon?: number;
  dealsWonCount?: number;
  revenue?: number;
  dealsWonRevenue?: number;
  avgDealValue?: number;
}

interface CrmCreativeSummary {
  content: string;
  campaign: string;
  leads?: number;
  leadsCount?: number;
  dealsWon?: number;
  dealsWonCount?: number;
  revenue?: number;
  dealsWonRevenue?: number;
}

/** Helpers pra normalizar campos com aliases */
function pickLeads(c: { leads?: number; leadsCount?: number }): number {
  return c.leads ?? c.leadsCount ?? 0;
}
function pickDealsWon(c: { dealsWon?: number; dealsWonCount?: number }): number {
  return c.dealsWon ?? c.dealsWonCount ?? 0;
}
function pickRevenue(c: { revenue?: number; dealsWonRevenue?: number }): number {
  return c.revenue ?? c.dealsWonRevenue ?? 0;
}

interface CrmFunnelEntry {
  stage: string;
  label: string;
  count: number;
  valueSum?: number;
}

interface CrmTotals {
  leads: number;
  dealsWon: number;
  revenue: number;
  avgLeadToWon_days?: number;
}

interface CrmAttributionResponse {
  leads?: CrmLeadItem[];
  channelSummary?: CrmChannelSummary[];
  campaignSummary?: CrmCampaignSummary[];
  creativeSummary?: CrmCreativeSummary[];
  funnel?: CrmFunnelEntry[];
  totals?: CrmTotals;
}

/* ── Fuzzy match helper ──────────────────────────────────────────── */

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Match estrito entre nome da campanha Meta e UTM do CRM.
 * Substring match foi removida porque casava errado: "lal_venda" matchava
 * "lal_venda_lp_nova" (são campanhas diferentes). Agora só:
 * - Match exato (após normalização)
 * - Match com word-boundary (uma é prefixo da outra terminando em "_")
 */
function fuzzyMatch(a: string, b: string): boolean {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  // Prefix match com boundary: "az_bi_cadastro" matcha "az_bi_cadastro_lal_venda"
  // mas só se um termina exatamente onde o outro estende com "_".
  // Hoje desabilitado porque tava gerando false positives demais.
  // Re-habilitar com critério mais rígido se necessário.
  return false;
}

/**
 * UTMs literais sem substituição de macro Meta — sinal de configuração errada.
 * Ex: "{{campaign.name}}", "{{ad.name}}", "{{adset.name}}"
 */
function isLiteralMacroUtm(s: string): boolean {
  return /^\{\{.*\}\}$/.test(s.trim());
}

/* ── Fetch CRM attribution ───────────────────────────────────────── */

async function fetchCrmAttribution(
  from: string,
  to: string
): Promise<CrmAttributionResponse> {
  const apiKey = getCrmApiKey();
  if (!apiKey) {
    console.warn("[attribution] CRM_ANALYTICS_API_KEY não configurada — retornando CRM vazio");
    return {};
  }

  const qs = new URLSearchParams({ from, to });
  const url = `${CRM_API_URL}/api/analytics/attribution?${qs.toString()}`;

  try {
    const res = await fetch(url, {
      headers: {
        "X-API-Key": apiKey,
        "Content-Type": "application/json",
      },
      // Timeout de 8 s para não travar o endpoint
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(
        `[attribution] CRM attribution endpoint retornou ${res.status}: ${body}`
      );
      return {};
    }

    return (await res.json()) as CrmAttributionResponse;
  } catch (err) {
    console.error(
      "[attribution] Falha ao chamar CRM attribution:",
      err instanceof Error ? err.message : err
    );
    return {};
  }
}

/* ── Insights helper ─────────────────────────────────────────────── */

const SEVERITY_ORDER: Record<string, number> = {
  critical: 0,
  warning: 1,
  positive: 2,
  neutral: 3,
};

interface AttributionInsightInput {
  campaignAttribution: CampaignAttribution[];
  channelROI: ChannelROI[];
  totals: AttributionTotals;
  matchedCount: number;
  totalMetaCampaigns: number;
}

function computeAttributionInsights(
  input: AttributionInsightInput
): StrategicInsight[] {
  const { campaignAttribution, channelROI, totals, matchedCount, totalMetaCampaigns } =
    input;
  const insights: StrategicInsight[] = [];

  // 1. Campanha estrela — ROAS > 3
  const starCampaigns = campaignAttribution.filter(
    (c) => c.roas !== null && c.roas > 3
  );
  if (starCampaigns.length > 0) {
    const best = starCampaigns.reduce((a, b) =>
      (a.roas ?? 0) > (b.roas ?? 0) ? a : b
    );
    insights.push({
      id: "attribution_star_campaign",
      category: "growth",
      severity: "positive",
      title: `Campanha estrela: ${best.campaignName}`,
      description: `ROAS de ${(best.roas ?? 0).toFixed(2)}× — cada R$1 investido retorna R$${(best.roas ?? 0).toFixed(2)}. Candidata a escalar orçamento.`,
      metric: `ROAS ${(best.roas ?? 0).toFixed(2)}×`,
      actionable: "Aumentar orçamento desta campanha em 20-30%.",
    });
  }

  // 2. Campanha negativa — ROAS < 1 com gasto relevante
  const negativeCampaigns = campaignAttribution.filter(
    (c) => c.roas !== null && c.roas < 1 && c.spend >= 50
  );
  if (negativeCampaigns.length > 0) {
    const worst = negativeCampaigns.reduce((a, b) =>
      (a.roas ?? 1) < (b.roas ?? 1) ? a : b
    );
    insights.push({
      id: "attribution_negative_campaign",
      category: "anomaly",
      severity: "critical",
      title: `Campanha no negativo: ${worst.campaignName}`,
      description: `Gasta R$${worst.spend.toFixed(0)} e gera apenas R$${worst.crmRevenue.toFixed(0)} em receita. ROAS de ${(worst.roas ?? 0).toFixed(2)}×.`,
      metric: `ROAS ${(worst.roas ?? 0).toFixed(2)}×`,
      actionable: "Pausar ou revisar urgentemente criativos e segmentação.",
    });
  }

  // 3. Canal vencedor — maior taxa deals/leads
  const channelsWithLeads = channelROI.filter((c) => c.leads > 0);
  if (channelsWithLeads.length > 1) {
    const bestChannel = channelsWithLeads.reduce((a, b) =>
      a.conversionRate > b.conversionRate ? a : b
    );
    const avgRate =
      channelsWithLeads.reduce((s, c) => s + c.conversionRate, 0) /
      channelsWithLeads.length;
    const multiplier =
      avgRate > 0 ? bestChannel.conversionRate / avgRate : 0;
    if (multiplier > 1.5) {
      insights.push({
        id: "attribution_winning_channel",
        category: "growth",
        severity: "positive",
        title: `Canal vencedor: ${bestChannel.source}`,
        description: `Converte ${(bestChannel.conversionRate * 100).toFixed(1)}% dos leads em deals — ${multiplier.toFixed(1)}× acima da média dos outros canais.`,
        metric: `${(bestChannel.conversionRate * 100).toFixed(1)}% conversão`,
        actionable: `Direcionar mais investimento para o canal ${bestChannel.source}.`,
      });
    }
  }

  // 4. Gargalo no SDR — lead→meeting < 20%
  const funnelEngaged = totals.leads > 0 ? totals.dealsWon / totals.leads : null;
  if (funnelEngaged !== null && funnelEngaged < 0.2 && totals.leads >= 10) {
    insights.push({
      id: "attribution_funnel_bottleneck",
      category: "engagement",
      severity: "warning",
      title: "Gargalo no funil — baixa taxa lead→fechamento",
      description: `Apenas ${(funnelEngaged * 100).toFixed(1)}% dos ${totals.leads} leads viram deals. Possível gargalo no SDR ou desqualificação precoce.`,
      metric: `${(funnelEngaged * 100).toFixed(1)}% conversão`,
      actionable: "Revisar qualificação de leads e script de abordagem do SDR.",
    });
  }

  // 5. Ciclo longo — avgLeadToWon > 30 dias
  if (totals.avgLeadToWon_days > 30) {
    insights.push({
      id: "attribution_long_cycle",
      category: "content",
      severity: totals.avgLeadToWon_days > 60 ? "warning" : "neutral",
      title: "Ciclo de vendas longo",
      description: `Tempo médio entre lead e fechamento é de ${totals.avgLeadToWon_days.toFixed(0)} dias. Benchmarks do setor ficam entre 15-30 dias.`,
      metric: `${totals.avgLeadToWon_days.toFixed(0)} dias`,
      actionable: "Introduzir follow-up automatizado para reduzir ciclo.",
    });
  }

  // 6. Match rate baixo de LEADS (matchedCount/totalMetaCampaigns aqui = leadsMatched/leadsWithValidUtm)
  if (totalMetaCampaigns > 0) {
    const matchRate = matchedCount / totalMetaCampaigns;
    const unmatched = totalMetaCampaigns - matchedCount;
    if (matchRate < 0.7) {
      insights.push({
        id: "attribution_low_match_rate",
        category: "anomaly",
        severity: "warning",
        title: "Leads chegando sem campanha Meta correspondente",
        description: `${unmatched} de ${totalMetaCampaigns} leads vieram com UTM mas o nome não bate com nenhuma campanha Meta — pode ser campanha pausada antes do período ou UTM divergente do nome no Ads Manager.`,
        metric: `${(matchRate * 100).toFixed(0)}% rastreados`,
        actionable: "Confira no Ads Manager se o template de URL usa {{campaign.name}} sem caracteres especiais que diferem do nome real.",
      });
    }
  }

  // 7. UTMs com macros literais não substituídos (ex: "{{campaign.name}}")
  const literalMacroCampaign = campaignAttribution.find((c) =>
    isLiteralMacroUtm(c.campaignName)
  );
  if (literalMacroCampaign) {
    insights.push({
      id: "attribution_macro_not_substituted",
      category: "anomaly",
      severity: "critical",
      title: "Macro Meta não substituído nos UTMs",
      description: `Detectei leads chegando com utm_campaign literal "${literalMacroCampaign.campaignName}" — significa que o macro do Meta não está sendo substituído ao gerar a URL. Algum anúncio está mal configurado.`,
      metric: `${literalMacroCampaign.crmLeads} leads`,
      actionable: "No Meta Ads Manager, conferir o template de URL: usar {{campaign.name}} (com chaves duplas) — alguns editores escapam o macro.",
    });
  }

  insights.sort(
    (a, b) =>
      (SEVERITY_ORDER[a.severity] ?? 99) - (SEVERITY_ORDER[b.severity] ?? 99)
  );

  return insights.slice(0, 6);
}

/* ── GET Handler ─────────────────────────────────────────────────── */

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const empresaId = searchParams.get("empresa_id");
  const periodStart = searchParams.get("period_start");
  const periodEnd = searchParams.get("period_end");

  if (!empresaId || !periodStart || !periodEnd) {
    return NextResponse.json(
      { error: "empresa_id, period_start e period_end sao obrigatorios" },
      { status: 400 }
    );
  }

  // ── Auth ──────────────────────────────────────────────────────────
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
  }

  // ── Admin client para queries (bypass RLS com auth já validado) ───
  let dbClient: ReturnType<typeof getAdminSupabase>;
  try {
    dbClient = getAdminSupabase();
  } catch {
    return NextResponse.json(
      { error: "Configuracao de banco indisponivel" },
      { status: 503 }
    );
  }

  // ── Fetch paralelo: CRM + Meta Ads + Instagram ────────────────────
  const [crmData, metaCampaignsRes, igPostsRes] = await Promise.all([
    // a) CRM attribution
    fetchCrmAttribution(periodStart, periodEnd),

    // b) Meta Ads campaigns
    dbClient
      .from("content_items")
      .select("provider_content_id, title, metrics, raw")
      .eq("empresa_id", empresaId)
      .eq("provider", "meta_ads")
      .eq("content_type", "ad_campaign"),

    // c) Instagram posts orgânicos do período
    dbClient
      .from("content_items")
      .select(
        "id, provider_content_id, title, caption, content_type, metrics, published_at, url, thumbnail_url"
      )
      .eq("empresa_id", empresaId)
      .eq("provider", "instagram")
      .gte("published_at", periodStart)
      .lte("published_at", periodEnd)
      .order("published_at", { ascending: false }),
  ]);

  const metaCampaigns = metaCampaignsRes.data ?? [];
  const igPosts = igPostsRes.data ?? [];

  // ── Extrair estruturas CRM ────────────────────────────────────────
  const crmChannels: CrmChannelSummary[] = crmData.channelSummary ?? [];
  const crmCampaigns: CrmCampaignSummary[] = crmData.campaignSummary ?? [];
  const crmCreatives: CrmCreativeSummary[] = crmData.creativeSummary ?? [];
  const crmFunnel: CrmFunnelEntry[] = crmData.funnel ?? [];
  const crmTotals: CrmTotals = crmData.totals ?? {
    leads: 0,
    dealsWon: 0,
    revenue: 0,
    avgLeadToWon_days: 0,
  };

  // ── channelROI ────────────────────────────────────────────────────
  /**
   * Normaliza source+medium pra "canonical channel".
   * Meta Ads gera leads com utm_source=Facebook ou Instagram + medium=cpc.
   * Aqui agrupamos isso como "meta_ads" pra UX clara — gestor pensa em "Meta Ads",
   * não em "Facebook cpc". Inconsistencias de capitalização também são unificadas.
   */
  function canonicalChannel(source: string, medium: string | null): ChannelSource {
    const s = source.toLowerCase().trim();
    const m = (medium ?? "").toLowerCase().trim();
    // Meta Ads: source Facebook/Instagram + medium cpc/paid
    if ((s === "facebook" || s === "instagram") && (m === "cpc" || m === "paid")) {
      return "meta_ads";
    }
    if (s.includes("meta")) return "meta_ads";
    if (s === "facebook") return "facebook";
    if (s === "instagram") return "instagram";
    if (s.includes("google") && (m === "cpc" || m === "paid")) return "google_ads";
    if (s.includes("google")) return "google";
    if (s === "linkedin") return "linkedin";
    if (s === "direto" || s === "(direct)" || s === "" || s === "none") return "direto";
    return (s || "outro") as ChannelSource;
  }

  // Agrupar canais CRM por canonicalChannel pra agregar capitalizações inconsistentes
  type ChannelAgg = { leads: number; dealsWon: number; revenue: number; medium: string | null };
  const channelMap = new Map<ChannelSource, ChannelAgg>();
  for (const ch of crmChannels) {
    const canonical = canonicalChannel(ch.source ?? "", ch.medium ?? null);
    const existing = channelMap.get(canonical);
    if (existing) {
      existing.leads += pickLeads(ch);
      existing.dealsWon += pickDealsWon(ch);
      existing.revenue += pickRevenue(ch);
    } else {
      channelMap.set(canonical, {
        leads: pickLeads(ch),
        dealsWon: pickDealsWon(ch),
        revenue: pickRevenue(ch),
        medium: ch.medium ?? null,
      });
    }
  }

  // Total de spend Meta (única fonte de spend que temos hoje — atribuído ao canal meta_ads)
  const totalMetaSpend = metaCampaigns.reduce((sum, c) => {
    const m = c.metrics as Record<string, number>;
    return sum + (m.spend ?? 0);
  }, 0);

  const channelROI: ChannelROI[] = [...channelMap.entries()].map(([source, agg]) => {
    const conversionRate = agg.leads > 0 ? agg.dealsWon / agg.leads : 0;
    const avgTicket: number | null =
      agg.dealsWon > 0 ? Math.round(agg.revenue / agg.dealsWon) : null;

    // Apenas o canal meta_ads recebe spend Meta — google_ads precisaria de driver próprio
    const channelSpend: number | null =
      source === "meta_ads" && totalMetaSpend > 0 ? totalMetaSpend : null;

    const cac =
      channelSpend !== null && agg.dealsWon > 0
        ? channelSpend / agg.dealsWon
        : null;
    const roas =
      channelSpend !== null && channelSpend > 0
        ? agg.revenue / channelSpend
        : null;

    return {
      source,
      medium: agg.medium,
      spend: channelSpend,
      leads: agg.leads,
      dealsWon: agg.dealsWon,
      revenue: agg.revenue,
      cac,
      roas,
      conversionRate,
      avgTicket,
    };
  });

  // ── campaignAttribution: cruzar CRM ↔ Meta Ads ───────────────────

  // Indexar Meta por título (para busca O(1) depois do match)
  type MetaItem = (typeof metaCampaigns)[number];
  const metaByNormTitle = new Map<string, MetaItem>();
  for (const mc of metaCampaigns) {
    if (mc.title) {
      metaByNormTitle.set(normalize(mc.title), mc);
    }
  }

  // Rastrear quais itens Meta foram matched
  const matchedMetaIds = new Set<string>();

  const campaignAttribution: CampaignAttribution[] = crmCampaigns.map(
    (cc) => {
      // Tentar match com Meta
      let matched = false;
      let matchedMeta: MetaItem | null = null;

      // Match exato first
      const exactKey = normalize(cc.campaign);
      if (metaByNormTitle.has(exactKey)) {
        matchedMeta = metaByNormTitle.get(exactKey)!;
        matched = true;
      } else {
        // Fuzzy match
        for (const [normTitle, metaItem] of metaByNormTitle.entries()) {
          if (fuzzyMatch(cc.campaign, normTitle)) {
            matchedMeta = metaItem;
            matched = true;
            break;
          }
        }
      }

      if (matchedMeta) {
        matchedMetaIds.add(matchedMeta.provider_content_id ?? "");
      }

      const metaMetrics = matchedMeta
        ? (matchedMeta.metrics as Record<string, number>)
        : null;
      const spend = metaMetrics?.spend ?? 0;
      const impressions = metaMetrics?.impressions ?? 0;
      const clicks = metaMetrics?.clicks ?? 0;
      const metaConversions = metaMetrics?.conversions ?? 0;

      const ccLeads = pickLeads(cc);
      const ccDealsWon = pickDealsWon(cc);
      const ccRevenue = pickRevenue(cc);
      const cac =
        spend > 0 && ccDealsWon > 0 ? spend / ccDealsWon : null;
      const roas =
        spend > 0 && ccRevenue > 0 ? ccRevenue / spend : null;

      return {
        campaignName: cc.campaign,
        metaCampaignId: matchedMeta?.provider_content_id ?? null,
        source: (matched ? "meta_ads" : "outro") as ChannelSource,
        spend,
        impressions,
        clicks,
        metaConversions,
        crmLeads: ccLeads,
        crmDealsWon: ccDealsWon,
        crmRevenue: ccRevenue,
        cac,
        roas,
        matched,
      };
    }
  );

  // Adicionar campanhas Meta que não foram linked (estão no Meta mas não no CRM)
  for (const mc of metaCampaigns) {
    const pid = mc.provider_content_id ?? "";
    if (!matchedMetaIds.has(pid)) {
      const m = mc.metrics as Record<string, number>;
      campaignAttribution.push({
        campaignName: mc.title ?? pid,
        metaCampaignId: pid,
        source: "meta_ads" as ChannelSource,
        spend: m.spend ?? 0,
        impressions: m.impressions ?? 0,
        clicks: m.clicks ?? 0,
        metaConversions: m.conversions ?? 0,
        crmLeads: 0,
        crmDealsWon: 0,
        crmRevenue: 0,
        cac: null,
        roas: null,
        matched: false,
      });
    }
  }

  // Ordenar por spend desc
  campaignAttribution.sort((a, b) => b.spend - a.spend);

  // ── creativePerformance ───────────────────────────────────────────
  const creativePerformance: CreativePerformance[] = crmCreatives.map((cc) => {
    const leads = pickLeads(cc);
    const dealsWon = pickDealsWon(cc);
    const revenue = pickRevenue(cc);
    return {
      contentName: cc.content,
      campaign: cc.campaign,
      leadsCount: leads,
      dealsWonCount: dealsWon,
      revenue,
      cac: revenue > 0 && dealsWon > 0 ? Math.round(revenue / dealsWon) : null,
    };
  });

  // ── funnelEndToEnd ────────────────────────────────────────────────

  /**
   * Mapeia as chaves de estágio CRM para os FunnelStage literais padronizados.
   * Estágios desconhecidos são mapeados para "lead" como fallback.
   */
  function toFunnelStage(raw: string): FunnelStage {
    const map: Record<string, FunnelStage> = {
      lead: "lead",
      "contato feito": "contact_made",
      "marcar reuniao": "meeting_scheduled",
      "marcar reunião": "meeting_scheduled",
      "reuniao agendada": "meeting_scheduled",
      "reunião agendada": "meeting_scheduled",
      "aguardando dados": "meeting_held",
      "proposta enviada": "proposal_sent",
      "aguardando assinatura": "negotiation",
      "ganho fechado": "won",
      won: "won",
      lost: "lost",
      perdido: "lost",
    };
    return map[raw.toLowerCase().trim()] ?? "lead";
  }

  const topFunnelCount = crmFunnel.length > 0 ? (crmFunnel[0]?.count ?? 0) : 0;

  const funnelEndToEnd: FunnelEndToEndStage[] = crmFunnel.map((stage, idx) => {
    const prevCount =
      idx > 0 ? (crmFunnel[idx - 1]?.count ?? 0) : 0;
    // Retorna fração 0..1 — componentes (EndToEndFunnel, Sankey) multiplicam por 100 internamente
    const conversionFromPrev =
      idx > 0 && prevCount > 0
        ? Math.round((stage.count / prevCount) * 10000) / 10000
        : undefined;
    const conversionFromTop =
      topFunnelCount > 0
        ? Math.round((stage.count / topFunnelCount) * 10000) / 10000
        : undefined;

    return {
      stage: toFunnelStage(stage.stage),
      label: stage.label,
      count: stage.count,
      valueSum: stage.valueSum,
      conversionFromPrev,
      conversionFromTop,
    };
  });

  // ── totals ────────────────────────────────────────────────────────
  // (totalMetaSpend ja foi calculado no bloco de channelROI acima)

  const igTotalEngagement = igPosts.reduce((sum, p) => {
    const m = p.metrics as Record<string, number>;
    return (
      sum +
      (m.likes ?? m.like_count ?? 0) +
      (m.comments ?? m.comments_count ?? 0) +
      (m.shares ?? m.share_count ?? 0) +
      (m.saves ?? 0)
    );
  }, 0);

  /**
   * Match rate semantica: das campanhas CRM RASTREÁVEIS no período, quantas
   * cruzaram com Meta? Ignora "lixo" no denominador:
   *  - "(sem campanha)" — leads sem UTM
   *  - "{{campaign.name}}" — macro Meta nao substituido
   *  - "link-bio", "manychat", etc — labels manuais nao-Meta
   *
   * Numerador e denominador agora sao SOBRE O PERIODO (consistencia temporal).
   * Antes: numerador=periodo, denominador=lifetime → confundia.
   */
  function isTrackable(name: string): boolean {
    if (!name) return false;
    if (name.startsWith("(") || name.startsWith("{{")) return false;
    const lower = name.toLowerCase();
    if (lower === "link-bio" || lower === "manychat" || lower === "organic") return false;
    return true;
  }

  /**
   * Match rate baseado em LEADS (não campanhas) — pondera por volume.
   *
   * Por que leads e nao campanhas:
   * - 1 campanha grande com 113 leads matched + 1 campanha pequena sem match
   *   davam 50% no calculo por campanha, mesmo com 113/116 leads bem rastreados.
   * - Por leads: 113/116 = 97% — reflete a realidade.
   *
   * Numerador: leads cuja utm_campaign cruza com alguma campanha Meta
   * Denominador: leads com utm_campaign valido (exclui null e "(sem campanha)" e "{{macro}}")
   */
  const allLeads = (crmData.leads ?? []) as CrmLeadItem[];
  const matchedCampaignNames = new Set(
    campaignAttribution
      .filter((c) => c.matched && c.metaCampaignId !== null)
      .map((c) => normalize(c.campaignName))
  );

  let leadsWithValidUtm = 0;
  let leadsMatched = 0;
  for (const lead of allLeads) {
    const utmCampaign = (lead.firstTouch?.utm_campaign ?? lead.utm_campaign ?? "").trim();
    if (!utmCampaign || !isTrackable(utmCampaign)) continue;
    leadsWithValidUtm++;
    if (matchedCampaignNames.has(normalize(utmCampaign))) {
      leadsMatched++;
    }
  }

  // Backward-compat com input do computeAttributionInsights (que usa campanhas)
  const matchedCount = leadsMatched;
  const trackableTotal = leadsWithValidUtm;

  const matchRateFinal =
    trackableTotal > 0 ? matchedCount / trackableTotal : 0;

  // Denominador antigo (campanhas Meta ativas lifetime) — mantido pra debug
  const activeMetaCampaigns = metaCampaigns.filter((c) => {
    const m = c.metrics as Record<string, number>;
    return (m.spend ?? 0) > 0;
  }).length;

  const totals: AttributionTotals = {
    spend: totalMetaSpend,
    leads: crmTotals.leads,
    dealsWon: crmTotals.dealsWon,
    // dealsLost omitido — CRM attribution endpoint não retorna dealsLost ainda
    revenue: crmTotals.revenue,
    cac:
      totalMetaSpend > 0 && crmTotals.dealsWon > 0
        ? Math.round(totalMetaSpend / crmTotals.dealsWon)
        : null,
    roas:
      totalMetaSpend > 0 && crmTotals.revenue > 0
        ? Math.round((crmTotals.revenue / totalMetaSpend) * 100) / 100
        : null,
    avgLeadToWon_days: crmTotals.avgLeadToWon_days ?? 0,
    avgTicket:
      crmTotals.dealsWon > 0
        ? Math.round(crmTotals.revenue / crmTotals.dealsWon)
        : null,
    matchRate: matchRateFinal,
    igPosts: igPosts.length,
    igEngagement: igTotalEngagement,
  };

  // ── topIGPosts — top 5 por engagement ────────────────────────────
  const topIGPosts: TopIGPost[] = igPosts
    .map((p) => {
      const m = p.metrics as Record<string, number>;
      const engagement =
        (m.likes ?? m.like_count ?? 0) +
        (m.comments ?? m.comments_count ?? 0) +
        (m.shares ?? m.share_count ?? 0) +
        (m.saves ?? 0);
      const reach = m.reach ?? m.impressions ?? 0;
      return {
        id: (p.id as string) ?? (p.provider_content_id as string),
        caption: (p.caption as string) ?? "",
        publishedAt: (p.published_at as string) ?? "",
        thumbnailUrl: (p.thumbnail_url as string | null),
        url: (p.url as string) ?? "",
        engagement,
        reach,
        contentType: (p.content_type as string) ?? "post",
      };
    })
    .sort((a, b) => b.engagement - a.engagement)
    .slice(0, 5);

  // ── insights ──────────────────────────────────────────────────────
  // totalMetaCampaigns = trackableTotal (UTMs validos no periodo).
  // Mantemos o nome do campo pra compat, mas semanticamente eh "rastreavel" agora.
  const insights = computeAttributionInsights({
    campaignAttribution,
    channelROI,
    totals,
    matchedCount,
    totalMetaCampaigns: trackableTotal,
  });

  // ── Response ──────────────────────────────────────────────────────
  const response: AttributionData = {
    period: { start: periodStart, end: periodEnd },
    totals,
    channelROI,
    campaignAttribution,
    creativePerformance,
    funnelEndToEnd,
    topIGPosts,
    insights,
  };

  return NextResponse.json(response);
}
