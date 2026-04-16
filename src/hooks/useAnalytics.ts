"use client";

import { useState, useCallback, useEffect, useRef } from "react";

/* ── Types (mirrors API response) ─────────────────────── */

export interface IGAnalyticsProfile {
  id: string;
  username: string;
  name: string;
  biography: string;
  profile_picture_url: string;
  followers_count: number;
  follows_count: number;
  media_count: number;
  website: string;
}

export interface IGAnalyticsEngagement {
  avg_likes: number;
  avg_comments: number;
  avg_saves: number;
  avg_shares: number;
  engagement_rate: number;
  total_likes: number;
  total_comments: number;
  total_saves: number;
  total_shares: number;
}

export interface IGAnalyticsTopPost {
  id: string;
  caption: string;
  media_type: string;
  media_url: string;
  thumbnail_url: string | null;
  permalink: string;
  timestamp: string;
  like_count: number;
  comments_count: number;
  engagement_rate: number;
  saves: number;
  shares: number;
  reach: number;
  views: number;
}

export interface IGContentBreakdown {
  type: string;
  count: number;
  percentage: number;
}

export interface IGPostingFrequency {
  posts_per_week: number;
  by_day_of_week: number[];
  by_hour: number[];
}

export interface IGHashtagStats {
  tag: string;
  count: number;
}

export interface IGInsightTimeSeries {
  name: string;
  values: { value: number; end_time?: string }[];
}

export interface IGAnalyticsData {
  profile: IGAnalyticsProfile;
  engagement: IGAnalyticsEngagement;
  top_posts: IGAnalyticsTopPost[];
  content_breakdown: IGContentBreakdown[];
  posting_frequency: IGPostingFrequency;
  insights: IGInsightTimeSeries[];
  insights_error?: string | null;
  account_insights: {
    total_interactions: number;
    new_followers: number;
  };
  content_analysis: {
    top_hashtags: IGHashtagStats[];
    avg_caption_length: number;
    emoji_count: number;
    avg_emojis_per_post: number;
  };
  fetched_at: string;
}

export interface UseAnalyticsReturn {
  data: IGAnalyticsData | null;
  loading: boolean;
  error: string | null;
  notConnected: boolean;
  refresh: () => Promise<void>;
}

/* ── Hook ─────────────────────────────────────────────── */

export function useAnalytics(empresaId: string | undefined): UseAnalyticsReturn {
  const [data, setData] = useState<IGAnalyticsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notConnected, setNotConnected] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const fetchAnalytics = useCallback(async () => {
    if (!empresaId) return;

    // Cancel any ongoing request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    setNotConnected(false);

    try {
      const res = await fetch(
        `/api/analytics/instagram-legacy?empresa_id=${encodeURIComponent(empresaId)}`,
        { signal: controller.signal }
      );

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Erro desconhecido" }));

        if (body.code === "NOT_CONNECTED" || res.status === 404) {
          setNotConnected(true);
          setData(null);
          return;
        }

        throw new Error(body.error || `HTTP ${res.status}`);
      }

      const json: IGAnalyticsData = await res.json();
      setData(json);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Erro ao carregar analytics");
    } finally {
      setLoading(false);
    }
  }, [empresaId]);

  useEffect(() => {
    fetchAnalytics();
    return () => abortRef.current?.abort();
  }, [fetchAnalytics]);

  return { data, loading, error, notConnected, refresh: fetchAnalytics };
}
