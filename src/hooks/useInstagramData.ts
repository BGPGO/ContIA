"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useEmpresa } from "./useEmpresa";
import { createClient } from "@/lib/supabase/client";

/* ── Types ──────────────────────────────────────────────── */

interface ProfileSnapshot {
  id: string;
  username: string;
  followers_count: number;
  follows_count: number;
  media_count: number;
  biography: string | null;
  profile_picture_url: string | null;
  snapshot_date: string;
}

interface MediaItem {
  id: string;
  ig_media_id: string;
  caption: string | null;
  media_type: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
  media_url: string | null;
  thumbnail_url: string | null;
  permalink: string | null;
  timestamp: string;
  like_count: number;
  comments_count: number;
  insights: Record<string, unknown>;
  synced_at: string;
}

interface InsightRow {
  id: string;
  metric_name: string;
  period: string;
  value: number;
  end_time: string | null;
  synced_at: string;
}

interface SyncResult {
  success: boolean;
  profileSynced: boolean;
  mediaCount: number;
  insightsCount: number;
  error?: string;
  durationMs: number;
}

interface SyncStatus {
  lastSync: {
    started_at: string;
    completed_at: string | null;
    status: string;
  } | null;
  counts: {
    media: number;
    profileSnapshots: number;
    insights: number;
  };
}

interface UseInstagramDataReturn {
  profile: ProfileSnapshot | null;
  media: MediaItem[];
  insights: InsightRow[];
  loading: boolean;
  syncing: boolean;
  error: string | null;
  lastSyncAt: string | null;
  sync: () => Promise<SyncResult | null>;
}

/* ── Constants ──────────────────────────────────────────── */

const AUTO_SYNC_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

/* ── Hook ───────────────────────────────────────────────── */

export function useInstagramData(): UseInstagramDataReturn {
  const { empresa } = useEmpresa();
  const supabase = createClient();

  const [profile, setProfile] = useState<ProfileSnapshot | null>(null);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [insights, setInsights] = useState<InsightRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);

  const autoSyncChecked = useRef(false);

  // Load cached data from Supabase
  const loadCachedData = useCallback(async () => {
    if (!empresa?.id) return;

    setLoading(true);
    setError(null);

    try {
      const [profileRes, mediaRes, insightsRes, statusRes] = await Promise.all([
        // Latest profile snapshot
        supabase
          .from("instagram_profile_cache")
          .select("*")
          .eq("empresa_id", empresa.id)
          .order("snapshot_date", { ascending: false })
          .limit(1)
          .single(),

        // All cached media, newest first
        supabase
          .from("instagram_media_cache")
          .select("*")
          .eq("empresa_id", empresa.id)
          .order("timestamp", { ascending: false }),

        // All cached insights
        supabase
          .from("instagram_insights_cache")
          .select("*")
          .eq("empresa_id", empresa.id)
          .order("end_time", { ascending: false }),

        // Last sync status
        fetch(`/api/instagram/sync/status?empresa_id=${empresa.id}`).then(
          (r) => r.json()
        ),
      ]);

      if (profileRes.data) {
        setProfile(profileRes.data as ProfileSnapshot);
      }

      if (mediaRes.data) {
        setMedia(mediaRes.data as MediaItem[]);
      }

      if (insightsRes.data) {
        setInsights(insightsRes.data as InsightRow[]);
      }

      const syncInfo = statusRes as SyncStatus;
      if (syncInfo?.lastSync?.completed_at) {
        setLastSyncAt(syncInfo.lastSync.completed_at);
      }
    } catch (err) {
      console.error("[useInstagramData] Failed to load cached data:", err);
      setError("Erro ao carregar dados do Instagram");
    } finally {
      setLoading(false);
    }
  }, [empresa?.id, supabase]);

  // Trigger a new sync via API
  const sync = useCallback(async (): Promise<SyncResult | null> => {
    if (!empresa?.id || syncing) return null;

    setSyncing(true);
    setError(null);

    try {
      const res = await fetch("/api/instagram/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ empresa_id: empresa.id }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Erro ao sincronizar");
        return data.result ?? null;
      }

      const result = data.result as SyncResult;
      setLastSyncAt(new Date().toISOString());

      // Reload cached data after sync
      await loadCachedData();

      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro de rede";
      setError(msg);
      return null;
    } finally {
      setSyncing(false);
    }
  }, [empresa?.id, syncing, loadCachedData]);

  // Load data on mount
  useEffect(() => {
    loadCachedData();
  }, [loadCachedData]);

  // Auto-sync if last sync is older than 1 hour
  useEffect(() => {
    if (autoSyncChecked.current || loading || syncing || !empresa?.id) return;
    autoSyncChecked.current = true;

    if (!lastSyncAt) {
      // Never synced — trigger first sync
      sync();
      return;
    }

    const elapsed = Date.now() - new Date(lastSyncAt).getTime();
    if (elapsed > AUTO_SYNC_INTERVAL_MS) {
      sync();
    }
  }, [lastSyncAt, loading, syncing, empresa?.id, sync]);

  return {
    profile,
    media,
    insights,
    loading,
    syncing,
    error,
    lastSyncAt,
    sync,
  };
}
