import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { METADATA_BY_PROVIDER } from "@/lib/drivers/metadata";
import type { ProviderKey } from "@/types/providers";

/**
 * GET /api/insights/compare?empresa_id=xxx&period_a_start=...&period_a_end=...&period_b_start=...&period_b_end=...
 *
 * Returns comparison data between two periods.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const empresaId = searchParams.get("empresa_id");
  const periodAStart = searchParams.get("period_a_start");
  const periodAEnd = searchParams.get("period_a_end");
  const periodBStart = searchParams.get("period_b_start");
  const periodBEnd = searchParams.get("period_b_end");

  if (!empresaId || !periodAStart || !periodAEnd || !periodBStart || !periodBEnd) {
    return NextResponse.json(
      { error: "empresa_id e os 4 parametros de periodo sao obrigatorios" },
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

  // Parallel: snapshots and content for both periods
  const [
    snapshotsARes,
    snapshotsBRes,
    contentARes,
    contentBRes,
    connectionsRes,
  ] = await Promise.all([
    supabase
      .from("provider_snapshots")
      .select("*")
      .eq("empresa_id", empresaId)
      .gte("snapshot_date", periodAStart)
      .lte("snapshot_date", periodAEnd)
      .order("snapshot_date", { ascending: true }),

    supabase
      .from("provider_snapshots")
      .select("*")
      .eq("empresa_id", empresaId)
      .gte("snapshot_date", periodBStart)
      .lte("snapshot_date", periodBEnd)
      .order("snapshot_date", { ascending: true }),

    supabase
      .from("content_items")
      .select("*")
      .eq("empresa_id", empresaId)
      .gte("published_at", periodAStart)
      .lte("published_at", periodAEnd),

    supabase
      .from("content_items")
      .select("*")
      .eq("empresa_id", empresaId)
      .gte("published_at", periodBStart)
      .lte("published_at", periodBEnd),

    supabase
      .from("social_connections")
      .select("provider")
      .eq("empresa_id", empresaId)
      .eq("is_active", true),
  ]);

  const snapshotsA = snapshotsARes.data ?? [];
  const snapshotsB = snapshotsBRes.data ?? [];
  const contentA = contentARes.data ?? [];
  const contentB = contentBRes.data ?? [];
  const activeProviders = [...new Set((connectionsRes.data ?? []).map((c) => c.provider as ProviderKey))];

  // Aggregate per provider: latest snapshot metrics and content stats
  function aggregateByProvider(
    snapshots: typeof snapshotsA,
    content: typeof contentA
  ) {
    const result: Record<
      string,
      { followers: number; reach: number; impressions: number; posts: number; engagement: number }
    > = {};

    // Init all connected providers
    for (const p of activeProviders) {
      result[p] = { followers: 0, reach: 0, impressions: 0, posts: 0, engagement: 0 };
    }

    // Latest snapshot per provider
    const latest = new Map<string, Record<string, number>>();
    for (const s of snapshots) {
      latest.set(s.provider as string, s.metrics as Record<string, number>);
    }

    for (const [provider, metrics] of latest) {
      if (!result[provider]) result[provider] = { followers: 0, reach: 0, impressions: 0, posts: 0, engagement: 0 };
      result[provider].followers = metrics.followers_count ?? 0;
      result[provider].reach = metrics.reach ?? 0;
      result[provider].impressions = metrics.impressions ?? 0;
    }

    // Content aggregation
    for (const item of content) {
      const p = item.provider as string;
      if (!result[p]) result[p] = { followers: 0, reach: 0, impressions: 0, posts: 0, engagement: 0 };
      result[p].posts += 1;
      const m = item.metrics as Record<string, number>;
      result[p].engagement +=
        (m.likes ?? m.like_count ?? 0) +
        (m.comments ?? m.comments_count ?? 0) +
        (m.shares ?? m.share_count ?? 0);
    }

    return result;
  }

  const aggA = aggregateByProvider(snapshotsA, contentA);
  const aggB = aggregateByProvider(snapshotsB, contentB);

  // Build comparison table
  type CompRow = {
    provider: string;
    providerName: string;
    color: string;
    metric: string;
    currentValue: number;
    previousValue: number;
    delta: number;
    deltaPercent: number;
    trend: "up" | "down" | "flat";
  };

  const comparisons: CompRow[] = [];
  const metricKeys = ["followers", "reach", "impressions", "posts", "engagement"] as const;
  const metricLabels: Record<string, string> = {
    followers: "Seguidores",
    reach: "Alcance",
    impressions: "Impressoes",
    posts: "Publicacoes",
    engagement: "Engajamento",
  };

  for (const provider of activeProviders) {
    const a = aggA[provider] ?? { followers: 0, reach: 0, impressions: 0, posts: 0, engagement: 0 };
    const b = aggB[provider] ?? { followers: 0, reach: 0, impressions: 0, posts: 0, engagement: 0 };
    const meta = METADATA_BY_PROVIDER[provider];

    for (const key of metricKeys) {
      const current = a[key];
      const previous = b[key];
      if (current === 0 && previous === 0) continue;

      const delta = current - previous;
      const deltaPercent = previous > 0 ? Math.round(((delta / previous) * 100) * 10) / 10 : current > 0 ? 100 : 0;
      const trend: "up" | "down" | "flat" = delta > 0 ? "up" : delta < 0 ? "down" : "flat";

      comparisons.push({
        provider,
        providerName: meta?.displayName ?? provider,
        color: meta?.color ?? "#4ecdc4",
        metric: metricLabels[key],
        currentValue: current,
        previousValue: previous,
        delta,
        deltaPercent,
        trend,
      });
    }
  }

  // Time series for both periods (for side-by-side charts)
  function buildTimeSeries(snapshots: typeof snapshotsA) {
    return snapshots.map((s) => {
      const m = s.metrics as Record<string, number>;
      return {
        date: s.snapshot_date,
        provider: s.provider,
        followers: m.followers_count ?? 0,
        engagement: m.engagement_rate ?? 0,
        reach: m.reach ?? 0,
        impressions: m.impressions ?? 0,
      };
    });
  }

  return NextResponse.json({
    comparisons,
    timeSeriesA: buildTimeSeries(snapshotsA),
    timeSeriesB: buildTimeSeries(snapshotsB),
    periodA: { start: periodAStart, end: periodAEnd },
    periodB: { start: periodBStart, end: periodBEnd },
    providers: activeProviders,
  });
}
