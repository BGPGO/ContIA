import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PROVIDER_DISPLAY_ORDER } from "@/lib/drivers/metadata";
import type { ProviderKey } from "@/types/providers";

/**
 * GET /api/insights/dashboard?empresa_id=xxx&period_start=YYYY-MM-DD&period_end=YYYY-MM-DD
 *
 * Returns aggregated dashboard data: KPIs, time series, top content, latest analysis.
 */
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

  const supabase = await createClient();

  // Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
  }

  // Compute previous period (same duration)
  const start = new Date(periodStart);
  const end = new Date(periodEnd);
  const diffMs = end.getTime() - start.getTime();
  const prevEnd = new Date(start.getTime() - 86400000); // day before start
  const prevStart = new Date(prevEnd.getTime() - diffMs);
  const prevStartISO = prevStart.toISOString().split("T")[0];
  const prevEndISO = prevEnd.toISOString().split("T")[0];

  // Parallel queries
  const [
    connectionsRes,
    snapshotsCurrentRes,
    snapshotsPrevRes,
    contentRes,
    analysisRes,
  ] = await Promise.all([
    // Active connections
    supabase
      .from("social_connections")
      .select("id, provider")
      .eq("empresa_id", empresaId)
      .eq("is_active", true),

    // Current period snapshots
    supabase
      .from("provider_snapshots")
      .select("*")
      .eq("empresa_id", empresaId)
      .gte("snapshot_date", periodStart)
      .lte("snapshot_date", periodEnd)
      .order("snapshot_date", { ascending: true }),

    // Previous period snapshots
    supabase
      .from("provider_snapshots")
      .select("*")
      .eq("empresa_id", empresaId)
      .gte("snapshot_date", prevStartISO)
      .lte("snapshot_date", prevEndISO)
      .order("snapshot_date", { ascending: true }),

    // Content items in period
    supabase
      .from("content_items")
      .select("*")
      .eq("empresa_id", empresaId)
      .gte("published_at", periodStart)
      .lte("published_at", periodEnd)
      .order("published_at", { ascending: false })
      .limit(200),

    // Latest AI analysis
    supabase
      .from("ai_analyses")
      .select("analysis")
      .eq("empresa_id", empresaId)
      .eq("scope", "report")
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const connections = connectionsRes.data ?? [];
  const currentSnapshots = snapshotsCurrentRes.data ?? [];
  const prevSnapshots = snapshotsPrevRes.data ?? [];
  const contentItems = contentRes.data ?? [];

  // Connected providers count
  const connectedProviders = new Set(connections.map((c) => c.provider));
  const connectedCount = connectedProviders.size;

  // --- KPIs ---
  function sumMetric(
    snapshots: typeof currentSnapshots,
    key: string
  ): number {
    // Get the latest snapshot per provider and sum
    const latestByProvider = new Map<string, Record<string, number>>();
    for (const s of snapshots) {
      const existing = latestByProvider.get(s.provider);
      if (!existing || s.snapshot_date > (latestByProvider.get(s.provider + "_date") as unknown as string ?? "")) {
        latestByProvider.set(s.provider, s.metrics as Record<string, number>);
        latestByProvider.set(s.provider + "_date", s.snapshot_date as unknown as Record<string, number>);
      }
    }
    let total = 0;
    for (const [k, metrics] of latestByProvider) {
      if (k.endsWith("_date")) continue;
      if (typeof metrics === "object" && metrics !== null) {
        total += (metrics[key] ?? 0);
      }
    }
    return total;
  }

  const currentFollowers = sumMetric(currentSnapshots, "followers_count");
  const prevFollowers = sumMetric(prevSnapshots, "followers_count");

  const currentPosts = contentItems.length;
  const prevContentCount = (
    await supabase
      .from("content_items")
      .select("id", { count: "exact", head: true })
      .eq("empresa_id", empresaId)
      .gte("published_at", prevStartISO)
      .lte("published_at", prevEndISO)
  ).count ?? 0;

  // Engagement: sum likes + comments across all content
  function sumEngagement(items: typeof contentItems): number {
    return items.reduce((acc, item) => {
      const m = item.metrics as Record<string, number>;
      return acc + (m.likes ?? m.like_count ?? 0) + (m.comments ?? m.comments_count ?? 0) + (m.shares ?? m.share_count ?? 0);
    }, 0);
  }

  const currentEngagement = sumEngagement(contentItems);
  const avgEngagement = currentPosts > 0 ? Math.round((currentEngagement / currentPosts) * 100) / 100 : 0;

  // Leads from CRM (metric_events)
  const leadsRes = await supabase
    .from("metric_events")
    .select("metric_value")
    .eq("empresa_id", empresaId)
    .eq("metric_key", "leads_generated")
    .gte("occurred_at", periodStart)
    .lte("occurred_at", periodEnd);

  const currentLeads = (leadsRes.data ?? []).reduce((acc, e) => acc + (e.metric_value ?? 0), 0);

  const prevLeadsRes = await supabase
    .from("metric_events")
    .select("metric_value")
    .eq("empresa_id", empresaId)
    .eq("metric_key", "leads_generated")
    .gte("occurred_at", prevStartISO)
    .lte("occurred_at", prevEndISO);

  const prevLeads = (prevLeadsRes.data ?? []).reduce((acc, e) => acc + (e.metric_value ?? 0), 0);

  function computeDelta(current: number, previous: number) {
    const delta = current - previous;
    const deltaPercent = previous > 0 ? (delta / previous) * 100 : current > 0 ? 100 : 0;
    const trend: "up" | "down" | "flat" = delta > 0 ? "up" : delta < 0 ? "down" : "flat";
    return { delta, deltaPercent: Math.round(deltaPercent * 10) / 10, trend };
  }

  const followersD = computeDelta(currentFollowers, prevFollowers);
  const postsD = computeDelta(currentPosts, prevContentCount);
  const engD = computeDelta(avgEngagement, 0); // simplified
  const leadsD = computeDelta(currentLeads, prevLeads);

  const kpis = [
    {
      label: "Total de Seguidores",
      value: currentFollowers,
      previousValue: prevFollowers,
      ...followersD,
      icon: "users",
    },
    {
      label: "Engajamento Medio",
      value: avgEngagement,
      previousValue: 0,
      ...engD,
      icon: "heart",
    },
    {
      label: "Posts Publicados",
      value: currentPosts,
      previousValue: prevContentCount,
      ...postsD,
      icon: "file",
    },
    {
      label: "Leads Gerados",
      value: currentLeads,
      previousValue: prevLeads,
      ...leadsD,
      icon: "user_plus",
    },
  ];

  // --- Time Series ---
  const dateMap = new Map<string, Record<string, number>>();
  for (const s of currentSnapshots) {
    const date = s.snapshot_date;
    if (!dateMap.has(date)) dateMap.set(date, { });
    const entry = dateMap.get(date)!;
    const metrics = s.metrics as Record<string, number>;
    const provider = s.provider as string;

    entry[`${provider}_followers`] = (entry[`${provider}_followers`] ?? 0) + (metrics.followers_count ?? 0);
    entry[`${provider}_engagement`] = (entry[`${provider}_engagement`] ?? 0) + (metrics.engagement_rate ?? 0);
    entry[`${provider}_reach`] = (entry[`${provider}_reach`] ?? 0) + (metrics.reach ?? 0);
    entry[`${provider}_impressions`] = (entry[`${provider}_impressions`] ?? 0) + (metrics.impressions ?? 0);
  }

  const timeSeries = Array.from(dateMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, metrics]) => ({ date, ...metrics }));

  // --- Top Content ---
  const topContent = contentItems
    .map((item) => {
      const m = item.metrics as Record<string, number>;
      const engagement =
        (m.likes ?? m.like_count ?? 0) +
        (m.comments ?? m.comments_count ?? 0) +
        (m.shares ?? m.share_count ?? 0);
      return {
        id: item.id as string,
        provider: item.provider as ProviderKey,
        content_type: item.content_type as string,
        title: item.title as string | null,
        caption: item.caption as string | null,
        thumbnail_url: item.thumbnail_url as string | null,
        url: item.url as string | null,
        published_at: item.published_at as string | null,
        engagement,
        metrics: m,
      };
    })
    .sort((a, b) => b.engagement - a.engagement)
    .slice(0, 10);

  // --- Latest Analysis ---
  const latestAnalysis = analysisRes.data?.analysis ?? null;

  // --- Comparisons ---
  const comparisons = kpis.map((k) => ({
    metric: k.label,
    current: k.value,
    previous: k.previousValue,
    delta: k.delta,
    deltaPercent: k.deltaPercent,
    trend: k.trend,
  }));

  return NextResponse.json({
    kpis,
    timeSeries,
    topContent,
    connectedCount,
    totalProviders: PROVIDER_DISPLAY_ORDER.length,
    latestAnalysis,
    comparisons,
  });
}
