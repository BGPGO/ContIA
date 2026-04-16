/**
 * Helpers de pre-processamento para relatorios — sem IA, TypeScript puro.
 * Agrega metricas, calcula deltas, identifica outliers, computa hash.
 */

import { createHash } from "crypto";
import type { ContentItem, ProviderKey, ProviderSnapshot } from "@/types/providers";
import type { Comparison, ReportType } from "@/types/reports";

/* ── Types ────────────────────────────────────────────────────────────────── */

export interface AggregatedProvider {
  totalEngagement: number;
  avgEngagement: number;
  contentCount: number;
  followers?: number;
  topMetrics: Record<string, number>;
}

export interface ReportInputForHash {
  empresaId: string;
  periodStart: Date;
  periodEnd: Date;
  providers: ProviderKey[];
  reportType: ReportType;
  contentIds: string[];
  snapshotIds: string[];
}

/* ── Engagement helper ───────────────────────────────────────────────────── */

function getEngagement(item: ContentItem): number {
  const m = item.metrics;
  return (
    (m.likes ?? m.like_count ?? 0) +
    (m.comments ?? m.comments_count ?? 0) +
    (m.shares ?? m.share_count ?? 0) +
    (m.saves ?? m.saved ?? 0)
  );
}

/* ── aggregateByProvider ─────────────────────────────────────────────────── */

export function aggregateByProvider(
  content: ContentItem[],
  snapshots: ProviderSnapshot[]
): Record<string, AggregatedProvider> {
  const result: Record<string, AggregatedProvider> = {};

  // Group content by provider
  const byProvider = new Map<string, ContentItem[]>();
  for (const item of content) {
    const list = byProvider.get(item.provider) ?? [];
    list.push(item);
    byProvider.set(item.provider, list);
  }

  for (const [provider, items] of byProvider) {
    const engagements = items.map(getEngagement);
    const totalEngagement = engagements.reduce((a, b) => a + b, 0);

    // Aggregate all metric keys
    const topMetrics: Record<string, number> = {};
    for (const item of items) {
      for (const [key, val] of Object.entries(item.metrics)) {
        topMetrics[key] = (topMetrics[key] ?? 0) + val;
      }
    }

    // Get latest snapshot for follower count
    const providerSnapshots = snapshots
      .filter((s) => s.provider === provider)
      .sort((a, b) => b.snapshot_date.localeCompare(a.snapshot_date));
    const latestSnapshot = providerSnapshots[0];

    result[provider] = {
      totalEngagement,
      avgEngagement: items.length > 0 ? totalEngagement / items.length : 0,
      contentCount: items.length,
      followers: latestSnapshot?.metrics?.followers ?? latestSnapshot?.metrics?.followers_count,
      topMetrics,
    };
  }

  return result;
}

/* ── calculateDeltas ─────────────────────────────────────────────────────── */

export function calculateDeltas(
  currentAgg: Record<string, AggregatedProvider>,
  previousAgg: Record<string, AggregatedProvider>
): Comparison[] {
  const comparisons: Comparison[] = [];

  // Collect all providers
  const allProviders = new Set([
    ...Object.keys(currentAgg),
    ...Object.keys(previousAgg),
  ]);

  for (const provider of allProviders) {
    const curr = currentAgg[provider];
    const prev = previousAgg[provider];
    if (!curr || !prev) continue;

    // Compare key aggregate metrics
    const metricsToCompare: Array<{ metric: string; current: number; previous: number }> = [
      {
        metric: `${provider}_engagement_total`,
        current: curr.totalEngagement,
        previous: prev.totalEngagement,
      },
      {
        metric: `${provider}_engagement_avg`,
        current: curr.avgEngagement,
        previous: prev.avgEngagement,
      },
      {
        metric: `${provider}_content_count`,
        current: curr.contentCount,
        previous: prev.contentCount,
      },
    ];

    // Followers
    if (curr.followers != null && prev.followers != null) {
      metricsToCompare.push({
        metric: `${provider}_followers`,
        current: curr.followers,
        previous: prev.followers,
      });
    }

    // Compare individual top metrics
    const allMetricKeys = new Set([
      ...Object.keys(curr.topMetrics),
      ...Object.keys(prev.topMetrics),
    ]);
    for (const key of allMetricKeys) {
      const c = curr.topMetrics[key] ?? 0;
      const p = prev.topMetrics[key] ?? 0;
      if (c === 0 && p === 0) continue;
      metricsToCompare.push({
        metric: `${provider}_${key}`,
        current: c,
        previous: p,
      });
    }

    for (const { metric, current, previous } of metricsToCompare) {
      const delta = current - previous;
      const deltaPercent = previous !== 0 ? (delta / previous) * 100 : current > 0 ? 100 : 0;
      const trend: "up" | "down" | "flat" =
        Math.abs(deltaPercent) < 3 ? "flat" : delta > 0 ? "up" : "down";

      comparisons.push({
        metric,
        current: Math.round(current * 100) / 100,
        previous: Math.round(previous * 100) / 100,
        delta: Math.round(delta * 100) / 100,
        deltaPercent: Math.round(deltaPercent * 100) / 100,
        trend,
      });
    }
  }

  return comparisons;
}

/* ── findTopContent ──────────────────────────────────────────────────────── */

export function findTopContent(content: ContentItem[], limit: number = 5): ContentItem[] {
  return [...content].sort((a, b) => getEngagement(b) - getEngagement(a)).slice(0, limit);
}

/* ── findOutliers ────────────────────────────────────────────────────────── */

export function findOutliers(content: ContentItem[]): {
  high: ContentItem[];
  low: ContentItem[];
} {
  if (content.length < 3) return { high: [], low: [] };

  const engagements = content.map(getEngagement);
  const mean = engagements.reduce((a, b) => a + b, 0) / engagements.length;
  const variance =
    engagements.reduce((sum, e) => sum + Math.pow(e - mean, 2), 0) / engagements.length;
  const stdDev = Math.sqrt(variance);

  const threshold = 1.5; // 1.5 standard deviations
  const highThreshold = mean + stdDev * threshold;
  const lowThreshold = mean - stdDev * threshold;

  const high: ContentItem[] = [];
  const low: ContentItem[] = [];

  for (let i = 0; i < content.length; i++) {
    if (engagements[i] > highThreshold) high.push(content[i]);
    else if (engagements[i] < lowThreshold) low.push(content[i]);
  }

  return {
    high: high.sort((a, b) => getEngagement(b) - getEngagement(a)).slice(0, 5),
    low: low.sort((a, b) => getEngagement(a) - getEngagement(b)).slice(0, 5),
  };
}

/* ── computeInputsHash ──────────────────────────────────────────────────── */

export function computeInputsHash(input: ReportInputForHash): string {
  const payload = JSON.stringify({
    empresaId: input.empresaId,
    periodStart: input.periodStart.toISOString(),
    periodEnd: input.periodEnd.toISOString(),
    providers: [...input.providers].sort(),
    reportType: input.reportType,
    contentIds: [...input.contentIds].sort(),
    snapshotIds: [...input.snapshotIds].sort(),
  });

  return createHash("sha256").update(payload).digest("hex");
}
