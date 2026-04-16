import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { METADATA_BY_PROVIDER } from "@/lib/drivers/metadata";
import { fetchInstagramLive } from "@/lib/analytics/instagram-fetcher";
import type { ProviderKey } from "@/types/providers";

/**
 * GET /api/insights/compare?empresa_id=xxx&period_a_start=...&period_a_end=...&period_b_start=...&period_b_end=...
 *
 * Returns comparison data between two periods.
 * Se provider_snapshots estiver vazio para o período A (Instagram), busca dados LIVE
 * e retorna historical_limited: true para o frontend exibir banner informativo.
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

  // ── Resolver conexões Instagram (session → admin → legado) ──
  type IgConnection = {
    id: string;
    access_token: string | null;
    provider_user_id: string | null;
    username: string | null;
  };

  let igConnection: IgConnection | null = null;

  // Fonte 1: session client (RLS por user_id)
  const { data: connSession } = await supabase
    .from("social_connections")
    .select("id, access_token, provider_user_id, username")
    .eq("empresa_id", empresaId)
    .eq("provider", "instagram")
    .eq("is_active", true)
    .limit(1);

  if (connSession && connSession.length > 0) {
    igConnection = connSession[0];
  }

  // Fonte 2: admin client (bypass RLS — fallback)
  if (!igConnection) {
    try {
      const admin = getAdminSupabase();
      const { data: connAdmin } = await admin
        .from("social_connections")
        .select("id, access_token, provider_user_id, username")
        .eq("empresa_id", empresaId)
        .eq("provider", "instagram")
        .eq("is_active", true)
        .limit(1);
      if (connAdmin && connAdmin.length > 0) {
        igConnection = connAdmin[0];
      }
    } catch {
      // admin fallback silencioso
    }
  }

  // Fonte 3: empresa.redes_sociais (legado)
  if (!igConnection) {
    const { data: empresa } = await supabase
      .from("empresas")
      .select("redes_sociais")
      .eq("id", empresaId)
      .single();

    const legacyIg = (
      empresa?.redes_sociais as Record<string, Record<string, string | boolean>> | null
    )?.instagram;

    if (legacyIg?.conectado && legacyIg.access_token) {
      igConnection = {
        id: `legacy-${empresaId}`,
        access_token: legacyIg.access_token as string,
        provider_user_id: (legacyIg.provider_user_id as string) ?? null,
        username: (legacyIg.username as string) ?? null,
      };
    }
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

  let snapshotsA = snapshotsARes.data ?? [];
  const snapshotsB = snapshotsBRes.data ?? [];
  const contentA = contentARes.data ?? [];
  const contentB = contentBRes.data ?? [];
  const activeProviders = [...new Set((connectionsRes.data ?? []).map((c) => c.provider as ProviderKey))];

  // ── Live fetch para Instagram quando período A não tem snapshots ──
  let historicalLimited = false;
  let historicalMessage = "";

  // Calcular total de snapshots disponíveis globalmente para estimar dias de coleta
  const { count: totalSnapshots } = await supabase
    .from("provider_snapshots")
    .select("id", { count: "exact", head: true })
    .eq("empresa_id", empresaId)
    .eq("provider", "instagram");

  const igSnapshotsA = snapshotsA.filter((s) => s.provider === "instagram");
  const igSnapshotsB = snapshotsB.filter((s) => s.provider === "instagram");

  const igConnected = igConnection?.access_token && igConnection.provider_user_id;
  const hasNoIgDataInA = igSnapshotsA.length === 0 && igConnected;

  if (hasNoIgDataInA) {
    historicalLimited = true;
    const daysCollected = totalSnapshots ?? 0;
    const daysNeeded = Math.max(0, 7 - daysCollected);

    historicalMessage =
      daysNeeded > 0
        ? `Comparativo histórico em construção — os dados estão sendo coletados diariamente. Estarão disponíveis em aproximadamente ${daysNeeded} dia${daysNeeded > 1 ? "s" : ""}.`
        : "Comparativo histórico em construção — os dados estão sendo coletados diariamente. Quanto mais tempo a conta ficar conectada, mais rico será o comparativo.";

    // Buscar LIVE e criar snapshot sintético para período A
    try {
      const liveData = await fetchInstagramLive(
        igConnection!.access_token!,
        igConnection!.provider_user_id!,
        30
      );

      const today = new Date().toISOString().split("T")[0];
      const syntheticSnapshot = {
        id: "live-synthetic",
        empresa_id: empresaId,
        connection_id: igConnection!.id,
        provider: "instagram" as ProviderKey,
        snapshot_date: today,
        metrics: {
          followers_count: liveData.kpis.followers,
          reach: liveData.kpis.reach,
          impressions: liveData.kpis.impressions,
        },
      };

      // Injetar snapshot sintético no período A
      snapshotsA = [...snapshotsA, syntheticSnapshot];
    } catch (err) {
      console.error("[compare] Falha ao buscar Instagram live:", err instanceof Error ? err.message : err);
    }
  } else if (igSnapshotsB.length === 0 && igSnapshotsA.length > 0) {
    // Tem dados no A mas não no B — histórico parcial
    historicalLimited = true;
    historicalMessage =
      "Comparativo histórico em construção — ainda não há dados suficientes para o período anterior. Continue conectado para acumular histórico.";
  }

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
    historical_limited: historicalLimited,
    message: historicalMessage || null,
  });
}
