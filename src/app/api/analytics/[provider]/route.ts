import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { METADATA_BY_PROVIDER } from "@/lib/drivers/metadata";
import type { ProviderKey } from "@/types/providers";
import type {
  AnalyticsKPI,
  TimeSeriesDataPoint,
  ProviderPost,
  BreakdownItem,
  HeatmapData,
  HashtagStat,
  InsightsSummary,
  StrategicInsight,
  MetaAdsAdvanced,
  AdCampaignSummary,
  FacebookAdvanced,
  CrmAdvanced,
  CrmFunnelStage,
  CrmLeadOrigin,
} from "@/types/analytics";
import {
  fetchInstagramLive,
  persistInstagramSnapshot,
  toProviderKPIs,
  toProviderPosts,
  toProviderBreakdown,
  toProviderHeatmap,
  toProviderHashtags,
  toProviderTimeSeries,
  toInstagramAdvanced,
} from "@/lib/analytics/instagram-fetcher";

const DAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];
const HOUR_LABELS = Array.from({ length: 24 }, (_, i) => `${i}h`);

const CONTENT_TYPE_COLORS: Record<string, string> = {
  post: "#6c5ce7",
  reel: "#fbbf24",
  story: "#e1306c",
  video: "#ff0000",
  youtube_video: "#ff0000",
  youtube_short: "#fbbf24",
  landing_page: "#10B981",
  ad_campaign: "#4285F4",
  email: "#8B5CF6",
  whatsapp: "#25D366",
};

const DIAS_SEMANA_PT_BR = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

const CONTENT_TYPE_LABELS: Record<string, string> = {
  post: "Post",
  reel: "Reels",
  story: "Stories",
  video: "Vídeo",
  youtube_video: "Vídeo YouTube",
  youtube_short: "Short YouTube",
  carousel: "Carrossel",
  landing_page: "Landing Page",
  ad_campaign: "Campanha",
  email: "E-mail",
  whatsapp: "WhatsApp",
};

const SEVERITY_ORDER: Record<string, number> = {
  critical: 0,
  warning: 1,
  positive: 2,
  neutral: 3,
};

interface InsightsInput {
  posts: ProviderPost[];
  kpis: AnalyticsKPI[];
  periodStart: string;
  periodEnd: string;
}

function computeInsightsSummary(input: InsightsInput): InsightsSummary {
  const { posts, kpis, periodStart, periodEnd } = input;

  const startDate = new Date(periodStart);
  const endDate = new Date(periodEnd);
  const diasNoPeriodo = Math.max(
    1,
    Math.round((endDate.getTime() - startDate.getTime()) / 86400000)
  );

  // ── bestPostingDay / bestPostingHour ──────────────────────────────
  let bestPostingDay: number | null = null;
  let bestPostingHour: number | null = null;

  if (posts.length >= 5) {
    // Map: "day_hour" => { totalEngRate: number, count: number }
    const cellMap = new Map<string, { totalEngRate: number; count: number }>();
    for (const post of posts) {
      if (!post.published_at) continue;
      const d = new Date(post.published_at);
      const day = d.getDay();
      const hour = d.getHours();
      const m = post.metrics;
      const reach = m.reach ?? m.impressions ?? 1;
      const eng = (m.likes ?? m.like_count ?? 0) + (m.comments ?? m.comments_count ?? 0) + (m.saves ?? 0) + (m.shares ?? m.share_count ?? 0);
      const engRate = reach > 0 ? eng / reach : 0;
      const key = `${day}_${hour}`;
      const existing = cellMap.get(key);
      if (existing) {
        existing.totalEngRate += engRate;
        existing.count += 1;
      } else {
        cellMap.set(key, { totalEngRate: engRate, count: 1 });
      }
    }

    let bestAvg = -1;
    for (const [key, { totalEngRate, count }] of cellMap.entries()) {
      if (count < 2) continue;
      const avg = totalEngRate / count;
      if (avg > bestAvg) {
        bestAvg = avg;
        const [dayStr, hourStr] = key.split("_");
        bestPostingDay = parseInt(dayStr, 10);
        bestPostingHour = parseInt(hourStr, 10);
      }
    }
  }

  // ── formatWinner ──────────────────────────────────────────────────
  let formatWinner: InsightsSummary["formatWinner"] = null;

  const formatMap = new Map<string, { totalEngRate: number; count: number }>();
  for (const post of posts) {
    const type = post.content_type ?? "post";
    const m = post.metrics;
    const reach = m.reach ?? m.impressions ?? 1;
    const eng = (m.likes ?? m.like_count ?? 0) + (m.comments ?? m.comments_count ?? 0) + (m.saves ?? 0) + (m.shares ?? m.share_count ?? 0);
    const engRate = reach > 0 ? eng / reach : 0;
    const existing = formatMap.get(type);
    if (existing) {
      existing.totalEngRate += engRate;
      existing.count += 1;
    } else {
      formatMap.set(type, { totalEngRate: engRate, count: 1 });
    }
  }

  let bestFormatAvg = -1;
  for (const [type, { totalEngRate, count }] of formatMap.entries()) {
    if (count < 3) continue;
    const avg = totalEngRate / count;
    if (avg > bestFormatAvg) {
      bestFormatAvg = avg;
      formatWinner = {
        type,
        label: CONTENT_TYPE_LABELS[type] ?? type,
        engagementRate: avg,
      };
    }
  }

  // ── growthRate ────────────────────────────────────────────────────
  let growthRate: number | null = null;

  if (diasNoPeriodo >= 7) {
    const followersKpi = kpis.find((k) => k.key === "followers");
    if (followersKpi && followersKpi.value !== null && followersKpi.previousValue !== null) {
      const current = followersKpi.value;
      const previous = followersKpi.previousValue;
      if (previous > 0) {
        const diff = current - previous;
        const weeklyDiff = (diff / diasNoPeriodo) * 7;
        growthRate = Math.round(((weeklyDiff / previous) * 100) * 10) / 10;
      }
    }
  }

  // ── engagementTrend ───────────────────────────────────────────────
  let engagementTrend: InsightsSummary["engagementTrend"] = null;

  if (posts.length >= 6) {
    const sorted = [...posts]
      .filter((p) => p.published_at !== null)
      .sort((a, b) => new Date(a.published_at!).getTime() - new Date(b.published_at!).getTime());

    if (sorted.length >= 6) {
      const mid = Math.floor(sorted.length / 2);
      const firstHalf = sorted.slice(0, mid);
      const secondHalf = sorted.slice(mid);

      const avgEngRate = (arr: ProviderPost[]) => {
        if (arr.length === 0) return 0;
        const sum = arr.reduce((acc, post) => {
          const m = post.metrics;
          const reach = m.reach ?? m.impressions ?? 1;
          const eng = (m.likes ?? m.like_count ?? 0) + (m.comments ?? m.comments_count ?? 0) + (m.saves ?? 0) + (m.shares ?? m.share_count ?? 0);
          return acc + (reach > 0 ? eng / reach : 0);
        }, 0);
        return sum / arr.length;
      };

      const firstAvg = avgEngRate(firstHalf);
      const secondAvg = avgEngRate(secondHalf);

      if (firstAvg > 0) {
        const change = ((secondAvg - firstAvg) / firstAvg) * 100;
        if (change > 10) engagementTrend = "accelerating";
        else if (change < -10) engagementTrend = "decelerating";
        else engagementTrend = "stable";
      } else {
        engagementTrend = secondAvg > 0 ? "accelerating" : "stable";
      }
    }
  }

  // ── avgPostingFrequency ───────────────────────────────────────────
  const avgPostingFrequency = Math.round(((posts.length / diasNoPeriodo) * 7) * 10) / 10;

  // ── topCTAs ───────────────────────────────────────────────────────
  const CTA_REGEX = /\b(clique|confira|veja|descubra|saiba|aproveite|garanta|inscreva|compre|salve|compartilhe|comente|siga)\b/gi;
  const ctaCounts = new Map<string, number>();
  for (const post of posts) {
    if (!post.caption) continue;
    const matches = post.caption.match(CTA_REGEX) ?? [];
    for (const match of matches) {
      const normalized = match.toLowerCase();
      ctaCounts.set(normalized, (ctaCounts.get(normalized) ?? 0) + 1);
    }
  }
  const topCTAs = Array.from(ctaCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([word]) => word);

  // ── Build insights array ──────────────────────────────────────────
  const insights: StrategicInsight[] = [];

  // Format winner
  if (formatWinner) {
    insights.push({
      id: "format_winner",
      category: "content",
      severity: "positive",
      title: `${formatWinner.label} é seu melhor formato`,
      description: `Posts em ${formatWinner.label.toLowerCase()} têm taxa de engajamento de ${(formatWinner.engagementRate * 100).toFixed(1)}%, acima da média geral.`,
      metric: `${(formatWinner.engagementRate * 100).toFixed(1)}%`,
      actionable: `Postar mais conteúdo em ${formatWinner.label.toLowerCase()}.`,
    });
  }

  // Best time
  if (bestPostingDay !== null && bestPostingHour !== null) {
    const diaNome = DIAS_SEMANA_PT_BR[bestPostingDay];
    insights.push({
      id: "best_time",
      category: "timing",
      severity: "positive",
      title: `${diaNome} às ${bestPostingHour}h é seu melhor horário`,
      description: `Posts publicados ${diaNome.toLowerCase()}-feira por volta de ${bestPostingHour}h tiveram maior engajamento.`,
      actionable: `Agendar próximos posts para ${diaNome} ${bestPostingHour}h.`,
    });
  }

  // Growth rate
  if (growthRate !== null) {
    if (growthRate > 1) {
      insights.push({
        id: "growth_strong",
        category: "growth",
        severity: "positive",
        title: "Crescimento acelerado de seguidores",
        description: `Você cresce ${growthRate.toFixed(1)}% por semana em seguidores. Continue o ritmo.`,
        metric: `+${growthRate.toFixed(1)}%/semana`,
      });
    } else if (growthRate < -0.5) {
      insights.push({
        id: "growth_loss",
        category: "growth",
        severity: "critical",
        title: "Você está perdendo seguidores",
        description: `Queda de ${Math.abs(growthRate).toFixed(1)}% por semana. Investigue posts recentes ou pausas de atividade.`,
        metric: `${growthRate.toFixed(1)}%/semana`,
        actionable: "Revisar últimos 7 dias para identificar a causa.",
      });
    }
  }

  // Engagement trend
  if (engagementTrend === "decelerating") {
    insights.push({
      id: "eng_decel",
      category: "engagement",
      severity: "warning",
      title: "Engajamento em queda",
      description: "A taxa de engajamento na segunda metade do período foi menor que na primeira. Conteúdo perdendo tração.",
      actionable: "Testar novo formato ou tema esta semana.",
    });
  } else if (engagementTrend === "accelerating") {
    insights.push({
      id: "eng_accel",
      category: "engagement",
      severity: "positive",
      title: "Engajamento em alta",
      description: "Taxa subiu na segunda metade do período. Está acertando o tom.",
    });
  }

  // Posting frequency
  if (avgPostingFrequency < 2) {
    insights.push({
      id: "freq_low",
      category: "content",
      severity: "warning",
      title: "Frequência baixa de postagem",
      description: `Você posta ${avgPostingFrequency.toFixed(1)}x por semana. Marcas em crescimento postam 4-5x.`,
      actionable: "Aumentar para pelo menos 3 posts/semana.",
    });
  }

  // KPI anomalies (delta > 30%)
  for (const kpi of kpis) {
    if (kpi.deltaPercent === null) continue;
    if (Math.abs(kpi.deltaPercent) > 30) {
      insights.push({
        id: `kpi_${kpi.key}`,
        category: "anomaly",
        severity: kpi.deltaPercent < 0 ? "critical" : "positive",
        title: kpi.deltaPercent < 0
          ? `Queda expressiva em ${kpi.label}`
          : `Alta expressiva em ${kpi.label}`,
        description: kpi.deltaPercent < 0
          ? `${kpi.label} caiu ${Math.abs(kpi.deltaPercent).toFixed(1)}% em relação ao período anterior. Monitore a causa.`
          : `${kpi.label} cresceu ${kpi.deltaPercent.toFixed(1)}% em relação ao período anterior.`,
        metric: `${kpi.deltaPercent > 0 ? "+" : ""}${kpi.deltaPercent.toFixed(1)}%`,
      });
    }
  }

  // Sort by severity and cap at 6
  insights.sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 99) - (SEVERITY_ORDER[b.severity] ?? 99));
  const cappedInsights = insights.slice(0, 6);

  return {
    bestPostingDay,
    bestPostingHour,
    formatWinner,
    growthRate,
    engagementTrend,
    avgPostingFrequency,
    topCTAs,
    insights: cappedInsights,
  };
}

function computeAdsInsightsSummary(
  metaAds: MetaAdsAdvanced,
  kpis: AnalyticsKPI[]
): InsightsSummary {
  const insights: StrategicInsight[] = [];

  // 1. Top campaign ROAS vs média
  if (metaAds.topPerformingCampaign && metaAds.avgROAS !== null && metaAds.avgROAS > 0) {
    const topRoas = metaAds.topPerformingCampaign.roas ?? 0;
    const ratio = metaAds.avgROAS > 0 ? topRoas / metaAds.avgROAS : 0;
    if (ratio >= 1.5) {
      insights.push({
        id: "ads_top_campaign_roas",
        category: "content",
        severity: "positive",
        title: `${metaAds.topPerformingCampaign.name} tem ROAS ${ratio.toFixed(1)}× maior que a média`,
        description: `ROAS desta campanha é ${topRoas.toFixed(2)} contra média de ${metaAds.avgROAS.toFixed(2)}. Considere escalar o orçamento.`,
        metric: `ROAS ${topRoas.toFixed(2)}×`,
        actionable: "Aumentar orçamento desta campanha em 20–30%.",
      });
    }
  }

  // 2. CPC subiu vs período anterior
  const cpcKpi = kpis.find((k) => k.key === "cpc");
  if (cpcKpi && cpcKpi.deltaPercent !== null && cpcKpi.deltaPercent > 25) {
    insights.push({
      id: "ads_cpc_up",
      category: "anomaly",
      severity: "warning",
      title: `CPC subiu ${cpcKpi.deltaPercent.toFixed(1)}% no período`,
      description: `Custo por clique aumentou de R$${(cpcKpi.previousValue ?? 0).toFixed(2)} para R$${(cpcKpi.value ?? 0).toFixed(2)}. Possível saturação de audiência ou aumento de leilão.`,
      metric: `+${cpcKpi.deltaPercent.toFixed(1)}%`,
      actionable: "Revisar segmentação e criativos — testar novos públicos.",
    });
  }

  // 3. Conversões caíram com spend igual ou maior
  const convKpi = kpis.find((k) => k.key === "conversions");
  const spendKpi = kpis.find((k) => k.key === "spend");
  if (
    convKpi &&
    spendKpi &&
    convKpi.deltaPercent !== null &&
    spendKpi.deltaPercent !== null &&
    convKpi.deltaPercent < -15 &&
    spendKpi.deltaPercent >= -5
  ) {
    insights.push({
      id: "ads_conv_drop",
      category: "anomaly",
      severity: "critical",
      title: "Conversões caíram apesar do investimento estável",
      description: `Conversões reduziram ${Math.abs(convKpi.deltaPercent).toFixed(1)}% enquanto o gasto manteve-se. Possível fadiga criativa ou problema na landing page.`,
      metric: `${convKpi.deltaPercent.toFixed(1)}%`,
      actionable: "Verificar landing page, testar novos criativos e revisar copy.",
    });
  }

  // 4. Campanhas com 0 conversões e gasto relevante
  const zeroCampanhas = metaAds.campaigns.filter(
    (c) => c.conversions === 0 && c.spend >= 50
  );
  if (zeroCampanhas.length > 0) {
    const nomes = zeroCampanhas
      .slice(0, 2)
      .map((c) => c.name)
      .join(", ");
    const totalWaste = zeroCampanhas.reduce((s, c) => s + c.spend, 0);
    insights.push({
      id: "ads_zero_conv",
      category: "anomaly",
      severity: "warning",
      title: `${zeroCampanhas.length} campanha(s) com R$${totalWaste.toFixed(0)} sem conversão`,
      description: `${nomes}${zeroCampanhas.length > 2 ? " e outras" : ""} têm gasto significativo mas nenhuma conversão registrada.`,
      metric: `R$${totalWaste.toFixed(0)} desperdiçado`,
      actionable: "Pausar ou revisar criativos e segmentação dessas campanhas.",
    });
  }

  // 5. ROAS médio < 1 — investimento sem retorno
  if (metaAds.avgROAS !== null && metaAds.totalConversionValue > 0 && metaAds.avgROAS < 1) {
    insights.push({
      id: "ads_roas_negative",
      category: "anomaly",
      severity: "critical",
      title: "ROAS médio abaixo de 1 — investimento sem retorno",
      description: `Para cada R$1 investido, R$${metaAds.avgROAS.toFixed(2)} retornam em valor de conversão. Urgente revisar estratégia de anúncios.`,
      metric: `ROAS ${metaAds.avgROAS.toFixed(2)}×`,
      actionable: "Revisar público-alvo, ofertas e funil de conversão imediatamente.",
    });
  }

  // 6. KPI anomalies (delta > 30%)
  for (const kpi of kpis) {
    if (kpi.deltaPercent === null) continue;
    if (Math.abs(kpi.deltaPercent) > 30 && !["cpc"].includes(kpi.key)) {
      insights.push({
        id: `ads_kpi_${kpi.key}`,
        category: "anomaly",
        severity: kpi.deltaPercent < 0 ? "critical" : "positive",
        title: kpi.deltaPercent < 0
          ? `Queda expressiva em ${kpi.label}`
          : `Alta expressiva em ${kpi.label}`,
        description: kpi.deltaPercent < 0
          ? `${kpi.label} caiu ${Math.abs(kpi.deltaPercent).toFixed(1)}% em relação ao período anterior.`
          : `${kpi.label} cresceu ${kpi.deltaPercent.toFixed(1)}% em relação ao período anterior.`,
        metric: `${kpi.deltaPercent > 0 ? "+" : ""}${kpi.deltaPercent.toFixed(1)}%`,
      });
    }
  }

  insights.sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 99) - (SEVERITY_ORDER[b.severity] ?? 99));
  const cappedInsights = insights.slice(0, 6);

  return {
    bestPostingDay: null,
    bestPostingHour: null,
    formatWinner: null,
    growthRate: null,
    engagementTrend: null,
    avgPostingFrequency: null,
    topCTAs: [],
    insights: cappedInsights,
  };
}

/**
 * GET /api/analytics/[provider]?empresa_id=xxx&period_start=YYYY-MM-DD&period_end=YYYY-MM-DD
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider: providerParam } = await params;
  const provider = providerParam as ProviderKey;
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

  const meta = METADATA_BY_PROVIDER[provider];
  if (!meta) {
    return NextResponse.json({ error: "Provider desconhecido" }, { status: 404 });
  }

  // Auth check com session client (valida identidade)
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
  }

  // ── Resolver conexao: tenta TODAS as fontes (session client funciona com RLS) ──

  let connection: {
    id: string;
    access_token: string | null;
    provider_user_id: string | null;
    username: string | null;
  } | null = null;

  // Fonte 1: social_connections via SESSION client (RLS por user_id)
  const { data: connData, error: connError } = await supabase
    .from("social_connections")
    .select("id, access_token, provider_user_id, username")
    .eq("empresa_id", empresaId)
    .eq("provider", provider)
    .eq("is_active", true)
    .limit(1);

  if (connError) {
    console.error("[analytics/provider] social_connections error (session):", connError.message);
  }
  if (connData && connData.length > 0) {
    connection = connData[0];
  }

  // Fonte 2: social_connections via ADMIN client (bypass RLS — fallback se session falhou)
  if (!connection) {
    try {
      const admin = getAdminSupabase();
      const { data: adminConn } = await admin
        .from("social_connections")
        .select("id, access_token, provider_user_id, username")
        .eq("empresa_id", empresaId)
        .eq("provider", provider)
        .eq("is_active", true)
        .limit(1);
      if (adminConn && adminConn.length > 0) {
        connection = adminConn[0];
        console.log("[analytics/provider] Conexao encontrada via admin client");
      }
    } catch (adminErr) {
      console.error("[analytics/provider] Admin client falhou:", adminErr instanceof Error ? adminErr.message : adminErr);
    }
  }

  // Fonte 3: empresa.redes_sociais (legado) via SESSION client
  if (!connection && provider === "instagram") {
    const { data: empresa } = await supabase
      .from("empresas")
      .select("redes_sociais")
      .eq("id", empresaId)
      .single();

    const legacyIg = (empresa?.redes_sociais as Record<string, Record<string, string | boolean>> | null)?.instagram;
    if (legacyIg?.conectado && legacyIg.access_token) {
      connection = {
        id: `legacy-${empresaId}`,
        access_token: legacyIg.access_token as string,
        provider_user_id: (legacyIg.provider_user_id as string) ?? null,
        username: (legacyIg.username as string) ?? null,
      };
      console.log("[analytics/provider] Usando empresa.redes_sociais para Instagram");
    }
  }

  // ── Passo 3: Se realmente nao tem conexao, retorna ──
  if (!connection) {
    return NextResponse.json({
      provider,
      connected: false,
      kpis: [],
      timeSeries: [],
      posts: [],
      breakdown: [],
      heatmap: null,
      funnelStages: null,
      topHashtags: null,
      trafficSources: null,
      topPages: null,
      campaigns: null,
      insightsSummary: null,
    });
  }

  // ── Passo 4: INSTAGRAM LIVE — buscar dados ao vivo da API ──
  if (provider === "instagram" && connection.access_token && connection.provider_user_id) {
    try {
      const liveData = await fetchInstagramLive(connection.access_token, connection.provider_user_id, 30);

      // Persistir snapshot em background (nao bloqueia resposta)
      persistInstagramSnapshot(empresaId, connection.id, liveData).catch((err) =>
        console.error("[analytics/provider] Falha ao persistir snapshot:", err)
      );

      // Buscar snapshots historicos para time series com multiplos dias
      let historicalSnapshots: { snapshot_date: unknown; metrics: unknown }[] | null = null;
      try {
        const admin = getAdminSupabase();
        const { data: hs } = await admin
          .from("provider_snapshots")
          .select("snapshot_date, metrics")
          .eq("connection_id", connection.id)
          .gte("snapshot_date", periodStart)
          .lte("snapshot_date", periodEnd)
          .order("snapshot_date", { ascending: true });
        historicalSnapshots = hs;
      } catch {
        // Admin nao disponivel — sem historico, so ponto live
      }

      // Time series = historico + ponto live de hoje
      const today = new Date().toISOString().split("T")[0];
      const historicalTimeSeries: TimeSeriesDataPoint[] = (historicalSnapshots ?? []).map((s) => {
        const m = s.metrics as Record<string, number | null>;
        return {
          date: s.snapshot_date as string,
          followers: m.followers_count ?? 0,
          reach: m.reach ?? 0,
          // null = conta não suporta impressões; preservar null em vez de coagir para 0
          impressions: "impressions" in m ? m.impressions : null,
          engagement: 0,
          sessions: 0,
          users: 0,
          spend: 0,
          clicks: 0,
          leads: 0,
        };
      });

      // Se hoje nao esta no historico, adiciona ponto live
      if (!historicalTimeSeries.some((p) => p.date === today)) {
        historicalTimeSeries.push({
          date: today,
          followers: liveData.profile.followers_count,
          reach: liveData.kpis.reach,
          impressions: liveData.kpis.impressions,
          engagement: 0,
          sessions: 0,
          users: 0,
          spend: 0,
          clicks: 0,
          leads: 0,
        });
      }

      // Se historico tem poucos pontos, complementar com time series baseado em media
      const finalTimeSeries =
        historicalTimeSeries.length > 1
          ? historicalTimeSeries
          : toProviderTimeSeries(liveData);

      const livePosts = toProviderPosts(liveData);
      const liveKpis = toProviderKPIs(liveData);

      return NextResponse.json({
        provider,
        connected: true,
        kpis: liveKpis,
        timeSeries: finalTimeSeries,
        posts: livePosts,
        breakdown: toProviderBreakdown(liveData),
        heatmap: toProviderHeatmap(liveData),
        funnelStages: null,
        topHashtags: toProviderHashtags(liveData),
        trafficSources: null,
        topPages: null,
        campaigns: null,
        instagramAdvanced: toInstagramAdvanced(liveData),
        insightsSummary: computeInsightsSummary({
          posts: livePosts,
          kpis: liveKpis,
          periodStart,
          periodEnd,
        }),
      });
    } catch (err) {
      console.error("[analytics/provider] Instagram live fetch falhou:", err instanceof Error ? err.message : err);
      // Continua para fallback DB-based abaixo
    }
  }

  // Previous period
  const start = new Date(periodStart);
  const end = new Date(periodEnd);
  const diffMs = end.getTime() - start.getTime();
  const prevEnd = new Date(start.getTime() - 86400000);
  const prevStart = new Date(prevEnd.getTime() - diffMs);
  const prevStartISO = prevStart.toISOString().split("T")[0];
  const prevEndISO = prevEnd.toISOString().split("T")[0];

  // Usar session client para DB queries (RLS garante seguranca)
  // Se tabelas novas nao tem RLS user_id, tenta admin como fallback
  let dbClient = supabase;
  try {
    dbClient = getAdminSupabase();
  } catch {
    // Admin nao disponivel, usar session
  }

  // Fix 1: para providers de anúncios (meta_ads, google_ads), NÃO filtrar content_items
  // por published_at — campanhas são criadas uma vez mas gastam continuamente além da data de criação.
  // Apenas providers "post-based" (instagram, facebook, linkedin, youtube) usam o filtro de data.
  const isPostBased =
    provider === "instagram" ||
    provider === "facebook" ||
    provider === "linkedin" ||
    provider === "youtube";

  const contentItemsBaseQuery = dbClient
    .from("content_items")
    .select("*")
    .eq("empresa_id", empresaId)
    .eq("provider", provider);

  const contentItemsQuery = isPostBased
    ? contentItemsBaseQuery
        .gte("published_at", periodStart)
        .lte("published_at", periodEnd)
        .order("published_at", { ascending: false })
        .limit(100)
    : contentItemsBaseQuery
        .order("synced_at", { ascending: false })
        .limit(200);

  const prevContentItemsBaseQuery = dbClient
    .from("content_items")
    .select("*")
    .eq("empresa_id", empresaId)
    .eq("provider", provider);

  const prevContentItemsQuery = isPostBased
    ? prevContentItemsBaseQuery
        .gte("published_at", prevStartISO)
        .lte("published_at", prevEndISO)
        .order("published_at", { ascending: false })
        .limit(100)
    : prevContentItemsBaseQuery
        .order("synced_at", { ascending: false })
        .limit(200);

  const [snapshotsRes, prevSnapshotsRes, contentRes] = await Promise.all([
    dbClient
      .from("provider_snapshots")
      .select("*")
      .eq("empresa_id", empresaId)
      .eq("provider", provider)
      .gte("snapshot_date", periodStart)
      .lte("snapshot_date", periodEnd)
      .order("snapshot_date", { ascending: true }),
    dbClient
      .from("provider_snapshots")
      .select("*")
      .eq("empresa_id", empresaId)
      .eq("provider", provider)
      .gte("snapshot_date", prevStartISO)
      .lte("snapshot_date", prevEndISO)
      .order("snapshot_date", { ascending: true }),
    contentItemsQuery,
  ]);

  const snapshots = snapshotsRes.data ?? [];
  const prevSnapshots = prevSnapshotsRes.data ?? [];
  const contentItems = contentRes.data ?? [];

  // Fix 2: log estruturado para diagnóstico
  console.log(
    `[analytics/${provider}] empresa=${empresaId} period=${periodStart}..${periodEnd} snapshots=${snapshots.length} prevSnaps=${prevSnapshots.length} contentItems=${contentItems.length}`
  );

  // Helpers
  function latestMetric(snaps: typeof snapshots, key: string): number {
    if (snaps.length === 0) return 0;
    const latest = snaps[snaps.length - 1];
    return (latest.metrics as Record<string, number>)[key] ?? 0;
  }

  /**
   * Versão null-aware: retorna null se a chave está explicitamente marcada
   * como null (indisponível) no último snapshot. Usado para métricas como
   * "impressions" que podem ser indisponíveis em contas personal do Instagram.
   */
  function latestMetricNullable(snaps: typeof snapshots, key: string): number | null {
    if (snaps.length === 0) return null;
    const latest = snaps[snaps.length - 1];
    const m = latest.metrics as Record<string, number | null>;
    if (!(key in m)) return null;
    return m[key];
  }

  function computeDelta(current: number, previous: number) {
    const delta = current - previous;
    const deltaPercent =
      previous > 0
        ? Math.round(((delta / previous) * 100) * 10) / 10
        : current > 0
          ? 100
          : 0;
    const trend: "up" | "down" | "flat" =
      delta > 0 ? "up" : delta < 0 ? "down" : "flat";
    return { delta, deltaPercent, trend };
  }

  function computeDeltaNullable(
    current: number | null,
    previous: number | null
  ): { delta: number | null; deltaPercent: number | null; trend: "up" | "down" | "flat" | "unknown" } {
    if (current === null || previous === null) {
      return { delta: null, deltaPercent: null, trend: "unknown" };
    }
    return computeDelta(current, previous);
  }

  // --- Build KPIs based on provider ---
  const kpis: AnalyticsKPI[] = [];

  if (
    provider === "instagram" ||
    provider === "facebook" ||
    provider === "linkedin" ||
    provider === "youtube"
  ) {
    const followers = latestMetric(snapshots, "followers_count");
    const prevFollowers = latestMetric(prevSnapshots, "followers_count");
    kpis.push({
      key: "followers",
      label: "Seguidores",
      value: followers,
      previousValue: prevFollowers,
      ...computeDelta(followers, prevFollowers),
      icon: "users",
    });

    const reach = latestMetric(snapshots, "reach");
    const prevReach = latestMetric(prevSnapshots, "reach");
    kpis.push({
      key: "reach",
      label: provider === "youtube" ? "Views" : "Alcance",
      value: reach,
      previousValue: prevReach,
      ...computeDelta(reach, prevReach),
      icon: "eye",
    });

    // Impressions: preserva null para contas que não suportam (ex: Instagram Personal)
    const impressions = latestMetricNullable(snapshots, "impressions");
    const prevImpressions = latestMetricNullable(prevSnapshots, "impressions");
    kpis.push({
      key: "impressions",
      label: "Impressoes",
      value: impressions,
      previousValue: prevImpressions,
      ...computeDeltaNullable(impressions, prevImpressions),
      icon: "trending",
    });

    const totalEng = contentItems.reduce((acc, item) => {
      const m = item.metrics as Record<string, number>;
      return (
        acc +
        (m.likes ?? m.like_count ?? 0) +
        (m.comments ?? m.comments_count ?? 0) +
        (m.shares ?? m.share_count ?? 0) +
        (m.saves ?? 0)
      );
    }, 0);
    const engRate =
      followers > 0 && contentItems.length > 0
        ? Math.round(((totalEng / contentItems.length / followers) * 100) * 100) / 100
        : 0;
    kpis.push({
      key: "engagement",
      label: "Engajamento",
      value: engRate,
      previousValue: 0,
      delta: 0,
      deltaPercent: 0,
      trend: "flat",
      icon: "heart",
      suffix: "%",
    });
  } else if (provider === "ga4") {
    for (const [key, label, icon] of [
      ["sessions", "Sessoes", "click"],
      ["users", "Usuarios", "users"],
      ["pageviews", "Pageviews", "eye"],
      ["bounce_rate", "Bounce Rate", "trending"],
    ] as const) {
      const v = latestMetric(snapshots, key);
      const pv = latestMetric(prevSnapshots, key);
      kpis.push({
        key,
        label,
        value: v,
        previousValue: pv,
        ...computeDelta(v, pv),
        icon,
        suffix: key === "bounce_rate" ? "%" : undefined,
      });
    }
  } else if (provider === "google_ads" || provider === "meta_ads") {
    for (const [key, label, icon, suffix] of [
      ["spend", "Investimento", "dollar", "R$"],
      ["impressions", "Impressoes", "eye", undefined],
      ["clicks", "Cliques", "click", undefined],
      ["ctr", "CTR", "trending", "%"],
      ["cpc", "CPC", "dollar", "R$"],
      ["conversions", "Conversoes", "user_plus", undefined],
    ] as const) {
      const v = latestMetric(snapshots, key);
      const pv = latestMetric(prevSnapshots, key);
      kpis.push({
        key,
        label,
        value: v,
        previousValue: pv,
        ...computeDelta(v, pv),
        icon,
        suffix: suffix ?? undefined,
      });
    }
  } else if (provider === "crm") {
    // Helper para somar uma métrica em todos os snapshots do período (métricas cumulativas).
    const sumMetric = (snaps: typeof snapshots, key: string): number => {
      return snaps.reduce((acc, s) => {
        const m = s.metrics as Record<string, number>;
        return acc + (m[key] ?? 0);
      }, 0);
    };

    // Hero KPIs — 4 cards principais
    // leads_new e deals_won são CUMULATIVOS no período (somar todos snapshots).
    // pipeline_value e conversion_rate são de ESTADO (último snapshot).
    for (const cfg of [
      { key: "leads_new", label: "Leads Novos", icon: "user_plus", suffix: undefined, agg: "sum" as const },
      { key: "deals_won", label: "Deals Fechados", icon: "dollar", suffix: undefined, agg: "sum" as const },
      { key: "pipeline_value", label: "Pipeline", icon: "dollar", suffix: "R$", agg: "latest" as const },
      { key: "conversion_rate", label: "Conversao", icon: "trending", suffix: "%", agg: "latest" as const },
    ]) {
      const v = cfg.agg === "sum" ? sumMetric(snapshots, cfg.key) : latestMetric(snapshots, cfg.key);
      const pv = cfg.agg === "sum" ? sumMetric(prevSnapshots, cfg.key) : latestMetric(prevSnapshots, cfg.key);
      kpis.push({
        key: cfg.key,
        label: cfg.label,
        value: v,
        previousValue: pv,
        ...computeDelta(v, pv),
        icon: cfg.icon,
        suffix: cfg.suffix,
      });
    }
  } else if (provider === "greatpages") {
    for (const [key, label, icon] of [
      ["active_pages", "LPs Ativas", "file"],
      ["total_leads", "Leads", "user_plus"],
      ["conversion_rate", "Conversao", "trending"],
    ] as const) {
      const v = latestMetric(snapshots, key);
      const pv = latestMetric(prevSnapshots, key);
      kpis.push({
        key,
        label,
        value: v,
        previousValue: pv,
        ...computeDelta(v, pv),
        icon,
        suffix: key === "conversion_rate" ? "%" : undefined,
      });
    }
  }

  // --- Time series ---
  const timeSeries: TimeSeriesDataPoint[] = snapshots.map((s) => {
    const m = s.metrics as Record<string, number | null>;
    return {
      date: s.snapshot_date as string,
      followers: m.followers_count ?? 0,
      reach: m.reach ?? 0,
      // null = conta não suporta impressões; preservar null em vez de coagir para 0
      impressions: "impressions" in m ? m.impressions : null,
      engagement: m.engagement_rate ?? 0,
      sessions: m.sessions ?? 0,
      users: m.users ?? 0,
      spend: m.spend ?? 0,
      clicks: m.clicks ?? 0,
      leads: m.leads_new ?? 0,
    };
  });

  // --- Posts ---
  const posts: ProviderPost[] = contentItems.map((item) => ({
    id: item.id as string,
    content_type: item.content_type as string,
    title: item.title as string | null,
    caption: item.caption as string | null,
    thumbnail_url: item.thumbnail_url as string | null,
    url: item.url as string | null,
    published_at: item.published_at as string | null,
    metrics: item.metrics as Record<string, number>,
  }));

  // --- Breakdown by content type ---
  const typeCounts = new Map<string, number>();
  for (const item of contentItems) {
    const t = item.content_type as string;
    typeCounts.set(t, (typeCounts.get(t) ?? 0) + 1);
  }
  const total = contentItems.length || 1;
  const breakdown: BreakdownItem[] = Array.from(typeCounts.entries())
    .map(([label, value]) => ({
      label,
      value,
      percentage: Math.round((value / total) * 100),
      color: CONTENT_TYPE_COLORS[label] ?? "#4ecdc4",
    }))
    .sort((a, b) => b.value - a.value);

  // --- Heatmap (best time to post) ---
  let heatmap: HeatmapData | null = null;
  if (
    provider === "instagram" ||
    provider === "facebook" ||
    provider === "linkedin"
  ) {
    const grid: number[][] = Array.from({ length: 7 }, () =>
      Array.from({ length: 24 }, () => 0)
    );
    for (const item of contentItems) {
      if (!item.published_at) continue;
      const d = new Date(item.published_at as string);
      const day = d.getDay();
      const hour = d.getHours();
      const m = item.metrics as Record<string, number>;
      grid[day][hour] +=
        (m.likes ?? m.like_count ?? 0) + (m.comments ?? m.comments_count ?? 0);
    }
    heatmap = { grid, dayLabels: DAY_LABELS, hourLabels: HOUR_LABELS };
  }

  // --- Top hashtags ---
  let topHashtags: HashtagStat[] | null = null;
  if (provider === "instagram" || provider === "facebook") {
    const tagCounts = new Map<string, number>();
    for (const item of contentItems) {
      const caption = (item.caption as string) ?? "";
      const tags = caption.match(/#[\w\u00C0-\u017F]+/g) ?? [];
      for (const tag of tags) {
        const normalized = tag.toLowerCase();
        tagCounts.set(normalized, (tagCounts.get(normalized) ?? 0) + 1);
      }
    }
    topHashtags = Array.from(tagCounts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);
  }

  // ── Meta Ads Advanced ──────────────────────────────────────────────────
  if (provider === "meta_ads") {
    // Aggregate per-campaign metrics from content_items (content_type = 'ad_campaign')
    const campaignItems = contentItems.filter(
      (item) => (item.content_type as string) === "ad_campaign"
    );

    // Group by provider_content_id (campaign ID)
    const campaignMap = new Map<string, {
      id: string;
      name: string;
      status: string;
      spend: number;
      impressions: number;
      clicks: number;
      conversions: number;
      conversionValue: number;
      reach: number;
      frequency: number;
      startDate: string | null;
      endDate: string | null;
    }>();

    for (const item of campaignItems) {
      const cid = (item.provider_content_id as string) ?? (item.id as string);
      const m = item.metrics as Record<string, number>;
      const rawData = item.raw as Record<string, unknown> | null;
      const existing = campaignMap.get(cid);

      if (existing) {
        existing.spend += m.spend ?? 0;
        existing.impressions += m.impressions ?? 0;
        existing.clicks += m.clicks ?? 0;
        existing.conversions += m.conversions ?? 0;
        existing.conversionValue += m.conversion_value ?? 0;
        existing.reach += m.reach ?? 0;
        existing.frequency = m.frequency ?? existing.frequency;
      } else {
        campaignMap.set(cid, {
          id: cid,
          name: (item.title as string) ?? cid,
          status: (rawData?.effective_status as string | undefined) ?? (rawData?.status as string | undefined) ?? "UNKNOWN",
          spend: m.spend ?? 0,
          impressions: m.impressions ?? 0,
          clicks: m.clicks ?? 0,
          conversions: m.conversions ?? 0,
          conversionValue: m.conversion_value ?? 0,
          reach: m.reach ?? 0,
          frequency: m.frequency ?? 0,
          startDate: (rawData?.created_time as string | undefined) ?? (item.published_at as string | null),
          endDate: null,
        });
      }
    }

    const allCampaigns: AdCampaignSummary[] = Array.from(campaignMap.values()).map((c) => {
      const ctr = c.impressions > 0 ? c.clicks / c.impressions : 0;
      const cpc = c.clicks > 0 ? c.spend / c.clicks : 0;
      const cpm = c.impressions > 0 ? (c.spend / c.impressions) * 1000 : 0;
      const costPerConversion = c.conversions > 0 ? c.spend / c.conversions : null;
      const roas = c.conversionValue > 0 && c.spend > 0 ? c.conversionValue / c.spend : null;

      return {
        campaignId: c.id,
        name: c.name,
        status: c.status,
        spend: c.spend,
        impressions: c.impressions,
        clicks: c.clicks,
        ctr,
        cpc,
        cpm,
        conversions: c.conversions,
        costPerConversion,
        roas,
        reach: c.reach,
        frequency: c.frequency,
        startDate: c.startDate,
        endDate: c.endDate,
      };
    });

    // Fix 2 (meta_ads): log de campanhas coletadas para diagnóstico
    console.log(
      `[analytics/meta_ads] empresa=${empresaId} campaignItems=${campaignItems.length} uniqueCampaigns=${campaignMap.size}`
    );

    // Sort by spend desc, top 10
    const topCampaigns = [...allCampaigns]
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 10);

    // Totals
    const totalSpend = allCampaigns.reduce((s, c) => s + c.spend, 0);
    const totalImpressions = allCampaigns.reduce((s, c) => s + c.impressions, 0);
    const totalClicks = allCampaigns.reduce((s, c) => s + c.clicks, 0);
    const totalConversions = allCampaigns.reduce((s, c) => s + c.conversions, 0);
    const totalConversionValue = Array.from(campaignMap.values()).reduce((s, c) => s + c.conversionValue, 0);

    const avgCTR = totalImpressions > 0 ? totalClicks / totalImpressions : 0;
    const avgCPC = totalClicks > 0 ? totalSpend / totalClicks : 0;
    const avgCPM = totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0;
    const avgROAS = totalConversionValue > 0 && totalSpend > 0 ? totalConversionValue / totalSpend : null;

    // Fix 2 (meta_ads): log com totais calculados
    console.log(
      `[analytics/meta_ads] totalSpend=${totalSpend} totalImpressions=${totalImpressions} totalClicks=${totalClicks} totalConversions=${totalConversions} avgROAS=${avgROAS ?? "null"}`
    );

    // spend by day from snapshots
    const spendByDay = snapshots.map((s) => {
      const m = s.metrics as Record<string, number>;
      return {
        date: s.snapshot_date as string,
        spend: m.spend ?? 0,
        conversions: m.conversions ?? 0,
      };
    });

    // Top and worst performing campaigns
    const campaignsWithRoas = allCampaigns.filter(
      (c) => c.roas !== null && c.conversions >= 5
    );
    const topPerformingCampaign = campaignsWithRoas.length > 0
      ? campaignsWithRoas.reduce((best, c) =>
          (c.roas ?? 0) > (best.roas ?? 0) ? c : best
        )
      : null;

    const campaignsWithSpend = allCampaigns.filter(
      (c) => c.roas !== null && c.spend >= 100
    );
    const worstPerformingCampaign = campaignsWithSpend.length > 0
      ? campaignsWithSpend.reduce((worst, c) =>
          (c.roas ?? Infinity) < (worst.roas ?? Infinity) ? c : worst
        )
      : null;

    const metaAdsAdvanced: MetaAdsAdvanced = {
      totalSpend,
      totalImpressions,
      totalClicks,
      avgCTR,
      avgCPC,
      avgCPM,
      totalConversions,
      totalConversionValue,
      avgROAS,
      campaigns: topCampaigns,
      spendByDay,
      topPerformingCampaign,
      worstPerformingCampaign,
    };

    // Override KPIs with Meta Ads specific ones (with full delta)
    const metaKpis: AnalyticsKPI[] = [];

    const snapshotMetrics = (snaps: typeof snapshots, key: string): number => {
      const sum = snaps.reduce((s, snap) => {
        const m = snap.metrics as Record<string, number>;
        return s + (m[key] ?? 0);
      }, 0);
      return sum;
    };

    // For spend/impressions/clicks/conversions: sum over period (cumulative metrics)
    // For CTR/CPC: compute from totals (derived)
    const prevTotalSpend = snapshotMetrics(prevSnapshots, "spend");
    const prevTotalImpressions = snapshotMetrics(prevSnapshots, "impressions");
    const prevTotalClicks = snapshotMetrics(prevSnapshots, "clicks");
    const prevTotalConversions = snapshotMetrics(prevSnapshots, "conversions");
    const prevAvgCTR = prevTotalImpressions > 0 ? prevTotalClicks / prevTotalImpressions : 0;
    const prevAvgCPC = prevTotalClicks > 0 ? prevTotalSpend / prevTotalClicks : 0;
    const prevConversionValue = snapshotMetrics(prevSnapshots, "conversion_value");
    const prevROAS = prevConversionValue > 0 && prevTotalSpend > 0 ? prevConversionValue / prevTotalSpend : null;

    metaKpis.push({
      key: "spend",
      label: "Investimento",
      value: totalSpend,
      previousValue: prevTotalSpend,
      ...computeDelta(totalSpend, prevTotalSpend),
      icon: "dollar",
      suffix: "R$",
    });
    metaKpis.push({
      key: "impressions",
      label: "Impressões pagas",
      value: totalImpressions,
      previousValue: prevTotalImpressions,
      ...computeDelta(totalImpressions, prevTotalImpressions),
      icon: "eye",
    });
    metaKpis.push({
      key: "clicks",
      label: "Cliques",
      value: totalClicks,
      previousValue: prevTotalClicks,
      ...computeDelta(totalClicks, prevTotalClicks),
      icon: "click",
    });
    metaKpis.push({
      key: "ctr",
      label: "CTR",
      value: Math.round(avgCTR * 10000) / 100,
      previousValue: Math.round(prevAvgCTR * 10000) / 100,
      ...computeDelta(avgCTR, prevAvgCTR),
      icon: "trending",
      suffix: "%",
    });
    metaKpis.push({
      key: "cpc",
      label: "CPC",
      value: Math.round(avgCPC * 100) / 100,
      previousValue: Math.round(prevAvgCPC * 100) / 100,
      ...computeDelta(avgCPC, prevAvgCPC),
      icon: "dollar",
      suffix: "R$",
    });
    metaKpis.push({
      key: "conversions",
      label: "Conversões",
      value: totalConversions,
      previousValue: prevTotalConversions,
      ...computeDelta(totalConversions, prevTotalConversions),
      icon: "user_plus",
    });
    metaKpis.push({
      key: "roas",
      label: "ROAS",
      value: avgROAS !== null ? Math.round(avgROAS * 100) / 100 : null,
      previousValue: prevROAS !== null ? Math.round(prevROAS * 100) / 100 : null,
      ...computeDeltaNullable(avgROAS, prevROAS),
      icon: "trending",
      suffix: "×",
    });

    return NextResponse.json({
      provider,
      connected: true,
      kpis: metaKpis,
      timeSeries,
      posts,
      breakdown,
      heatmap: null,
      funnelStages: null,
      topHashtags: null,
      trafficSources: null,
      topPages: null,
      campaigns: null,
      metaAdsAdvanced,
      insightsSummary: computeAdsInsightsSummary(metaAdsAdvanced, metaKpis),
    });
  }

  // ── Facebook Advanced ───────────────────────────────────────────────────
  if (provider === "facebook") {
    // Page-level metrics from latest snapshot
    const latestSnap = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;
    const latestSnapMetrics = latestSnap
      ? (latestSnap.metrics as Record<string, number>)
      : {};

    // Previous period latest snapshot
    const prevLatestSnap = prevSnapshots.length > 0 ? prevSnapshots[prevSnapshots.length - 1] : null;
    const prevSnapMetrics = prevLatestSnap
      ? (prevLatestSnap.metrics as Record<string, number>)
      : {};

    const pageFans = latestSnapMetrics.page_fans ?? latestSnapMetrics.fan_count ?? latestSnapMetrics.followers_count ?? 0;
    const prevPageFans = prevSnapMetrics.page_fans ?? prevSnapMetrics.fan_count ?? prevSnapMetrics.followers_count ?? 0;
    const pageNewFans = Math.max(0, pageFans - prevPageFans);

    const pageImpressions = latestSnapMetrics.page_impressions ?? 0;
    const pageEngagedUsers = latestSnapMetrics.page_engaged_users ?? 0;

    // Aggregate from content_items
    let totalReactions = 0;
    let totalComments = 0;
    let totalShares = 0;
    const typeCountsFb: Record<string, number> = {};

    for (const item of contentItems) {
      const m = item.metrics as Record<string, number>;
      totalReactions += m.reactions ?? m.likes ?? m.like_count ?? 0;
      totalComments += m.comments ?? m.comments_count ?? 0;
      totalShares += m.shares ?? m.share_count ?? 0;
      const ct = (item.content_type as string) ?? "post";
      typeCountsFb[ct] = (typeCountsFb[ct] ?? 0) + 1;
    }

    // Top 5 posts by engagement
    const sortedPosts = [...contentItems]
      .map((item) => {
        const m = item.metrics as Record<string, number>;
        const reactions = m.reactions ?? m.likes ?? m.like_count ?? 0;
        const comments = m.comments ?? m.comments_count ?? 0;
        const shares = m.shares ?? m.share_count ?? 0;
        const reach = m.reach ?? m.post_impressions ?? 0;
        return { item, engagement: reactions + comments + shares, reactions, comments, shares, reach };
      })
      .sort((a, b) => b.engagement - a.engagement)
      .slice(0, 5);

    const fbTopPosts = sortedPosts.map(({ item, reactions, comments, shares, reach }) => ({
      id: (item.id as string) ?? "",
      message: (item.caption as string) ?? (item.title as string) ?? "",
      permalink: (item.url as string | null),
      publishedAt: (item.published_at as string) ?? "",
      reactions,
      comments,
      shares,
      reach,
    }));

    // Fix 2 (facebook): log para diagnóstico
    console.log(
      `[analytics/facebook] empresa=${empresaId} pageFans=${pageFans} pageImpressions=${pageImpressions} totalReactions=${totalReactions} posts=${contentItems.length}`
    );

    const facebookAdvanced: FacebookAdvanced = {
      totalLikes: totalReactions, // reactions = likes on FB API
      totalReactions,
      totalComments,
      totalShares,
      pageImpressions,
      pageEngagedUsers,
      pageFans,
      pageNewFans,
      postsByType: typeCountsFb,
      topPosts: fbTopPosts,
    };

    // Facebook-specific KPIs (override generic ones)
    const fbKpis: AnalyticsKPI[] = [];

    fbKpis.push({
      key: "followers",
      label: "Fãs da Página",
      value: pageFans,
      previousValue: prevPageFans,
      ...computeDelta(pageFans, prevPageFans),
      icon: "users",
    });
    fbKpis.push({
      key: "page_impressions",
      label: "Alcance da Página",
      value: pageImpressions,
      previousValue: prevSnapMetrics.page_impressions ?? 0,
      ...computeDelta(pageImpressions, prevSnapMetrics.page_impressions ?? 0),
      icon: "eye",
    });
    fbKpis.push({
      key: "page_engaged_users",
      label: "Usuários Engajados",
      value: pageEngagedUsers,
      previousValue: prevSnapMetrics.page_engaged_users ?? 0,
      ...computeDelta(pageEngagedUsers, prevSnapMetrics.page_engaged_users ?? 0),
      icon: "heart",
    });
    fbKpis.push({
      key: "posts_count",
      label: "Posts Publicados",
      value: contentItems.length,
      previousValue: 0,
      delta: 0,
      deltaPercent: 0,
      trend: "flat",
      icon: "file",
    });
    fbKpis.push({
      key: "reactions",
      label: "Reações",
      value: totalReactions,
      previousValue: 0,
      delta: 0,
      deltaPercent: 0,
      trend: "flat",
      icon: "heart",
    });
    fbKpis.push({
      key: "comments",
      label: "Comentários",
      value: totalComments,
      previousValue: 0,
      delta: 0,
      deltaPercent: 0,
      trend: "flat",
      icon: "message",
    });
    fbKpis.push({
      key: "shares",
      label: "Compartilhamentos",
      value: totalShares,
      previousValue: 0,
      delta: 0,
      deltaPercent: 0,
      trend: "flat",
      icon: "share",
    });

    return NextResponse.json({
      provider,
      connected: true,
      kpis: fbKpis,
      timeSeries,
      posts,
      breakdown,
      heatmap,
      funnelStages: null,
      topHashtags,
      trafficSources: null,
      topPages: null,
      campaigns: null,
      facebookAdvanced,
      insightsSummary: computeInsightsSummary({
        posts,
        kpis: fbKpis,
        periodStart,
        periodEnd,
      }),
    });
  }

  // ── CRM Advanced ────────────────────────────────────────────────────────
  if (provider === "crm") {
    const m0 = snapshots.length > 0
      ? (snapshots[snapshots.length - 1].metrics as Record<string, number>)
      : {} as Record<string, number>;

    // Funil — ordem da entrada até fechamento
    const FUNNEL_STAGES: Array<{ stage: string; label: string; color: string }> = [
      { stage: "funnel_stage_lead",                   label: "Lead",                   color: "#3b82f6" },
      { stage: "funnel_stage_contato_feito",          label: "Contato Feito",          color: "#6366f1" },
      { stage: "funnel_stage_marcar_reunião",         label: "Marcar Reunião",         color: "#8b5cf6" },
      { stage: "funnel_stage_reunião_agendada",       label: "Reunião Agendada",       color: "#a855f7" },
      { stage: "funnel_stage_aguardando_dados",       label: "Aguardando Dados",       color: "#d946ef" },
      { stage: "funnel_stage_proposta_enviada",       label: "Proposta Enviada",       color: "#f59e0b" },
      { stage: "funnel_stage_aguardando_assinatura",  label: "Aguardando Assinatura",  color: "#f97316" },
      { stage: "funnel_stage_ganho_fechado",          label: "Ganho Fechado",          color: "#22c55e" },
    ];

    const funnel: CrmFunnelStage[] = FUNNEL_STAGES.map(({ stage, label, color }) => ({
      stage,
      label,
      count: m0[stage] ?? 0,
      color,
    }));

    // Origens dos leads
    const ORIGIN_LABELS: Record<string, string> = {
      leads_origin_cpc:           "CPC",
      leads_origin_direto:        "Direto",
      "leads_origin_www.google.com": "Google Orgânico",
    };

    const originEntries = Object.entries(ORIGIN_LABELS).map(([key, label]) => ({
      origin: key,
      label,
      count: m0[key] ?? 0,
    }));
    const totalOrigins = originEntries.reduce((s, e) => s + e.count, 0) || 1;
    const leadsByOrigin: CrmLeadOrigin[] = originEntries
      .map((e) => ({
        ...e,
        pct: Math.round((e.count / totalOrigins) * 1000) / 10,
      }))
      .sort((a, b) => b.count - a.count);

    // Temperatura
    const hot  = m0.leads_hot  ?? 0;
    const warm = m0.leads_warm ?? 0;
    const cold = m0.leads_cold ?? 0;

    // Conversão
    const won     = m0.deals_won  ?? m0.funnel_won    ?? 0;
    const revenue = m0.pipeline_value ?? m0.funnel_revenue ?? 0;
    const convRate = m0.conversion_rate ?? m0.funnel_conversion_rate ?? 0;
    const avgTicket = won > 0 ? Math.round(revenue / won) : 0;

    // Email
    const emailCampaigns = m0.email_campaigns ?? 0;
    const emailSent      = m0.email_sent       ?? 0;
    const emailOpenRate  = m0.email_open_rate  ?? 0;
    const emailClickRate = m0.email_click_rate ?? 0;
    const emailBounce    = m0.email_bounce_rate ?? 0;

    // WhatsApp
    const waSent         = m0.wa_sent          ?? 0;
    const waDelivered    = m0.wa_delivered      ?? 0;
    const waReplies      = m0.wa_replies        ?? 0;
    const waConversions  = m0.wa_conversions    ?? 0;
    const deliveryRate   = waSent > 0 ? Math.round((waDelivered / waSent) * 1000) / 10 : 0;
    const replyRate      = waSent > 0 ? Math.round((waReplies   / waSent) * 1000) / 10 : 0;

    // GreatPages
    const gpLeads = m0.gp_leads        ?? 0;
    const gpLPs   = m0.gp_landing_pages ?? 0;

    const crmAdvanced: CrmAdvanced = {
      funnel,
      leadsByOrigin,
      leadsByTemperature: { hot, warm, cold },
      conversion: { rate: convRate, won, revenue, avgTicket },
      email: {
        campaigns: emailCampaigns,
        sent:      emailSent,
        openRate:  emailOpenRate,
        clickRate: emailClickRate,
        bounceRate: emailBounce,
      },
      whatsapp: {
        sent:         waSent,
        delivered:    waDelivered,
        deliveryRate,
        replies:      waReplies,
        replyRate,
        conversions:  waConversions,
      },
      greatpages: { leads: gpLeads, landingPages: gpLPs },
    };

    return NextResponse.json({
      provider,
      connected: true,
      kpis,
      timeSeries,
      posts,
      breakdown,
      heatmap: null,
      funnelStages: null,
      topHashtags: null,
      trafficSources: null,
      topPages: null,
      campaigns: null,
      crmAdvanced,
      insightsSummary: computeInsightsSummary({
        posts,
        kpis,
        periodStart,
        periodEnd,
      }),
    });
  }

  return NextResponse.json({
    provider,
    connected: true,
    kpis,
    timeSeries,
    posts,
    breakdown,
    heatmap,
    funnelStages: null,
    topHashtags,
    trafficSources: null,
    topPages: null,
    campaigns: null,
    insightsSummary: computeInsightsSummary({
      posts,
      kpis,
      periodStart,
      periodEnd,
    }),
  });
}
