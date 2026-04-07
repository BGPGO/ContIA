"use client";

import { useState, useEffect, useCallback } from "react";
import type { IGProfile, IGMedia, IGInsight } from "@/lib/instagram";
import type { MarcaDNA } from "@/types";

/* ── Types ──────────────────────────────────────────────── */

interface DashboardData {
  connected: boolean;
  profile: IGProfile | null;
  recentPosts: IGMedia[];
  insights: IGInsight[];
  dna: MarcaDNA | null;
  loading: boolean;
  error: string | null;
}

/* ── Computed Stats ─────────────────────────────────────── */

export interface DashboardStats {
  avgLikes: number;
  avgComments: number;
  lastPostAgo: string;
  mostUsedFormat: string;
  engagementRate: number;
  reachValue: number | null;
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;

  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) return `há ${minutes}min`;

  const hours = Math.floor(diffMs / 3_600_000);
  if (hours < 24) return `há ${hours}h`;

  const days = Math.floor(diffMs / 86_400_000);
  if (days === 1) return "há 1 dia";
  if (days < 30) return `há ${days} dias`;

  const months = Math.floor(days / 30);
  if (months === 1) return "há 1 mês";
  return `há ${months} meses`;
}

export function computeStats(
  posts: IGMedia[],
  insights: IGInsight[],
  profile: IGProfile | null
): DashboardStats {
  const totalLikes = posts.reduce((sum, p) => sum + (p.like_count ?? 0), 0);
  const totalComments = posts.reduce(
    (sum, p) => sum + (p.comments_count ?? 0),
    0
  );
  const count = posts.length || 1;

  const avgLikes = Math.round(totalLikes / count);
  const avgComments = Math.round(totalComments / count);

  // Most used format
  const formatCount: Record<string, number> = {};
  for (const p of posts) {
    formatCount[p.media_type] = (formatCount[p.media_type] ?? 0) + 1;
  }
  const mostUsedFormat =
    Object.entries(formatCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "-";

  // Last post relative time
  const lastPostAgo =
    posts.length > 0 ? timeAgo(posts[0].timestamp) : "Nenhum post";

  // Engagement rate: (avg likes + avg comments) / followers * 100
  const followers = profile?.followers_count ?? 0;
  const engagementRate =
    followers > 0 ? ((avgLikes + avgComments) / followers) * 100 : 0;

  // Reach from insights
  const reachInsight = insights.find((i) => i.name === "reach");
  const reachValue = reachInsight?.values?.[0]?.value ?? null;

  return { avgLikes, avgComments, lastPostAgo, mostUsedFormat, engagementRate, reachValue };
}

/* ── Hook ───────────────────────────────────────────────── */

export function useDashboard(empresaId: string | undefined): DashboardData & {
  stats: DashboardStats;
  refresh: () => Promise<void>;
} {
  const [connected, setConnected] = useState(false);
  const [profile, setProfile] = useState<IGProfile | null>(null);
  const [recentPosts, setRecentPosts] = useState<IGMedia[]>([]);
  const [insights, setInsights] = useState<IGInsight[]>([]);
  const [dna, setDna] = useState<MarcaDNA | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    if (!empresaId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/dashboard?empresa_id=${empresaId}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Erro ao carregar dashboard");
      }

      const data = await res.json();
      setConnected(data.connected);
      setProfile(data.profile);
      setRecentPosts(data.recentPosts ?? []);
      setInsights(data.insights ?? []);
      setDna(data.dna);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      setError(msg);
      console.error("[useDashboard]", msg);
    } finally {
      setLoading(false);
    }
  }, [empresaId]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const stats = computeStats(recentPosts, insights, profile);

  return {
    connected,
    profile,
    recentPosts,
    insights,
    dna,
    loading,
    error,
    stats,
    refresh: fetchDashboard,
  };
}
