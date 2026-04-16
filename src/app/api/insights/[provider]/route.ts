import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { METADATA_BY_PROVIDER } from "@/lib/drivers/metadata";
import type { ProviderKey } from "@/types/providers";

/**
 * GET /api/insights/[provider]?empresa_id=xxx&period_start=YYYY-MM-DD&period_end=YYYY-MM-DD&page=1&limit=20
 *
 * Returns deep-dive data for a specific provider.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider: providerRaw } = await params;
  const provider = providerRaw as ProviderKey;

  const meta = METADATA_BY_PROVIDER[provider];
  if (!meta) {
    return NextResponse.json({ error: "Provider invalido" }, { status: 400 });
  }

  const { searchParams } = req.nextUrl;
  const empresaId = searchParams.get("empresa_id");
  const periodStart = searchParams.get("period_start");
  const periodEnd = searchParams.get("period_end");
  const page = parseInt(searchParams.get("page") ?? "1", 10);
  const limit = parseInt(searchParams.get("limit") ?? "20", 10);

  if (!empresaId || !periodStart || !periodEnd) {
    return NextResponse.json(
      { error: "empresa_id, period_start e period_end sao obrigatorios" },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
  }

  // Previous period
  const start = new Date(periodStart);
  const end = new Date(periodEnd);
  const diffMs = end.getTime() - start.getTime();
  const prevEnd = new Date(start.getTime() - 86400000);
  const prevStart = new Date(prevEnd.getTime() - diffMs);
  const prevStartISO = prevStart.toISOString().split("T")[0];
  const prevEndISO = prevEnd.toISOString().split("T")[0];

  const offset = (page - 1) * limit;

  // Parallel queries
  const [
    connectionRes,
    snapshotsRes,
    prevSnapshotsRes,
    contentRes,
    contentCountRes,
    analysisRes,
  ] = await Promise.all([
    supabase
      .from("social_connections")
      .select("id")
      .eq("empresa_id", empresaId)
      .eq("provider", provider)
      .eq("is_active", true)
      .limit(1),

    supabase
      .from("provider_snapshots")
      .select("*")
      .eq("empresa_id", empresaId)
      .eq("provider", provider)
      .gte("snapshot_date", periodStart)
      .lte("snapshot_date", periodEnd)
      .order("snapshot_date", { ascending: true }),

    supabase
      .from("provider_snapshots")
      .select("*")
      .eq("empresa_id", empresaId)
      .eq("provider", provider)
      .gte("snapshot_date", prevStartISO)
      .lte("snapshot_date", prevEndISO)
      .order("snapshot_date", { ascending: true }),

    supabase
      .from("content_items")
      .select("*")
      .eq("empresa_id", empresaId)
      .eq("provider", provider)
      .gte("published_at", periodStart)
      .lte("published_at", periodEnd)
      .order("published_at", { ascending: false })
      .range(offset, offset + limit - 1),

    supabase
      .from("content_items")
      .select("id", { count: "exact", head: true })
      .eq("empresa_id", empresaId)
      .eq("provider", provider)
      .gte("published_at", periodStart)
      .lte("published_at", periodEnd),

    supabase
      .from("ai_analyses")
      .select("analysis")
      .eq("empresa_id", empresaId)
      .eq("scope", "report")
      .eq("provider", provider)
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const connected = (connectionRes.data ?? []).length > 0;
  const snapshots = snapshotsRes.data ?? [];
  const prevSnapshots = prevSnapshotsRes.data ?? [];
  const contentItems = contentRes.data ?? [];
  const totalContent = contentCountRes.count ?? 0;

  // KPIs
  function getLatestMetric(snaps: typeof snapshots, key: string): number {
    if (snaps.length === 0) return 0;
    const latest = snaps[snaps.length - 1];
    const m = latest.metrics as Record<string, number>;
    return m[key] ?? 0;
  }

  function computeDelta(current: number, previous: number) {
    const delta = current - previous;
    const deltaPercent = previous > 0 ? (delta / previous) * 100 : current > 0 ? 100 : 0;
    const trend: "up" | "down" | "flat" = delta > 0 ? "up" : delta < 0 ? "down" : "flat";
    return { delta, deltaPercent: Math.round(deltaPercent * 10) / 10, trend };
  }

  // Build provider-specific KPIs based on capabilities
  const kpis = [];

  // Followers (social providers)
  const curFollowers = getLatestMetric(snapshots, "followers_count");
  const prevFollowers = getLatestMetric(prevSnapshots, "followers_count");
  if (curFollowers > 0 || prevFollowers > 0) {
    const d = computeDelta(curFollowers, prevFollowers);
    kpis.push({ label: "Seguidores", value: curFollowers, previousValue: prevFollowers, ...d, icon: "users" });
  }

  // Reach
  const curReach = getLatestMetric(snapshots, "reach");
  const prevReach = getLatestMetric(prevSnapshots, "reach");
  if (curReach > 0 || prevReach > 0) {
    const d = computeDelta(curReach, prevReach);
    kpis.push({ label: "Alcance", value: curReach, previousValue: prevReach, ...d, icon: "eye" });
  }

  // Impressions
  const curImp = getLatestMetric(snapshots, "impressions");
  const prevImp = getLatestMetric(prevSnapshots, "impressions");
  if (curImp > 0 || prevImp > 0) {
    const d = computeDelta(curImp, prevImp);
    kpis.push({ label: "Impressoes", value: curImp, previousValue: prevImp, ...d, icon: "eye" });
  }

  // Posts count
  const prevContentRes = await supabase
    .from("content_items")
    .select("id", { count: "exact", head: true })
    .eq("empresa_id", empresaId)
    .eq("provider", provider)
    .gte("published_at", prevStartISO)
    .lte("published_at", prevEndISO);
  const prevContentCount = prevContentRes.count ?? 0;
  const postsD = computeDelta(totalContent, prevContentCount);
  kpis.push({ label: "Publicacoes", value: totalContent, previousValue: prevContentCount, ...postsD, icon: "file" });

  // Ads metrics
  if (meta.capabilities.canReadAds) {
    const curSpend = getLatestMetric(snapshots, "spend");
    const prevSpend = getLatestMetric(prevSnapshots, "spend");
    if (curSpend > 0 || prevSpend > 0) {
      const d = computeDelta(curSpend, prevSpend);
      kpis.push({ label: "Investimento", value: curSpend, previousValue: prevSpend, ...d, icon: "dollar" });
    }

    const curConv = getLatestMetric(snapshots, "conversions");
    const prevConv = getLatestMetric(prevSnapshots, "conversions");
    if (curConv > 0 || prevConv > 0) {
      const d = computeDelta(curConv, prevConv);
      kpis.push({ label: "Conversoes", value: curConv, previousValue: prevConv, ...d, icon: "click" });
    }
  }

  // Time Series
  const timeSeries = snapshots.map((s) => {
    const m = s.metrics as Record<string, number>;
    return {
      date: s.snapshot_date,
      followers: m.followers_count ?? 0,
      engagement: m.engagement_rate ?? 0,
      reach: m.reach ?? 0,
      impressions: m.impressions ?? 0,
    };
  });

  // Content
  const content = contentItems.map((item) => {
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
  });

  return NextResponse.json({
    provider,
    displayName: meta.displayName,
    color: meta.color,
    connected,
    kpis,
    timeSeries,
    content,
    totalContent,
    hasMore: offset + limit < totalContent,
    analysis: analysisRes.data?.analysis ?? null,
  });
}
