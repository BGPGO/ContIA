/**
 * Instagram Data Sync Pipeline
 *
 * Pulls profile, media and insights from the Instagram API
 * and caches everything in Supabase for fast dashboard reads.
 */

import { createClient as createServiceClient, SupabaseClient } from "@supabase/supabase-js";
import { getProfile, getMedia, getInsights, InstagramAPIError } from "./instagram";
import type { IGProfile, IGMedia, IGInsight } from "./instagram";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = SupabaseClient<any, any, any>;

/* ── Types ──────────────────────────────────────────────── */

export interface SyncResult {
  success: boolean;
  profileSynced: boolean;
  mediaCount: number;
  insightsCount: number;
  error?: string;
  durationMs: number;
}

interface ConnectionRow {
  access_token: string;
  provider_user_id: string;
  user_id: string;
}

/* ── Service Supabase (bypasses RLS) ────────────────────── */

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !serviceKey) {
    throw new Error("Supabase not configured for instagram sync");
  }

  return createServiceClient(url, serviceKey);
}

/* ── Main sync function ─────────────────────────────────── */

export async function syncInstagramData(
  empresaId: string,
  userId: string
): Promise<SyncResult> {
  const start = Date.now();
  const supabase = getServiceSupabase();

  // Create sync log entry
  const { data: syncLog } = await supabase
    .from("instagram_sync_log")
    .insert({
      empresa_id: empresaId,
      user_id: userId,
      status: "running",
    })
    .select("id")
    .single();

  const syncLogId = syncLog?.id;

  try {
    // 1. Fetch connection credentials
    const { data: connection, error: connError } = await supabase
      .from("social_connections")
      .select("access_token, provider_user_id, user_id")
      .eq("empresa_id", empresaId)
      .eq("provider", "instagram")
      .eq("is_active", true)
      .single();

    if (connError || !connection) {
      throw new Error("Instagram not connected for this empresa");
    }

    const { access_token, provider_user_id } = connection as ConnectionRow;

    // 2. Sync profile
    const profileSynced = await syncProfile(
      supabase,
      empresaId,
      userId,
      provider_user_id,
      access_token
    );

    // 3. Sync media
    const mediaCount = await syncMedia(
      supabase,
      empresaId,
      userId,
      provider_user_id,
      access_token
    );

    // 4. Sync insights (all periods)
    const insightsCount = await syncInsights(
      supabase,
      empresaId,
      userId,
      provider_user_id,
      access_token
    );

    // Update sync log
    if (syncLogId) {
      await supabase
        .from("instagram_sync_log")
        .update({
          status: "completed",
          profile_synced: profileSynced,
          media_count: mediaCount,
          insights_count: insightsCount,
          completed_at: new Date().toISOString(),
        })
        .eq("id", syncLogId);
    }

    return {
      success: true,
      profileSynced,
      mediaCount,
      insightsCount,
      durationMs: Date.now() - start,
    };
  } catch (err) {
    const errorMsg =
      err instanceof InstagramAPIError
        ? `IG API Error [${err.code}]: ${err.message}`
        : err instanceof Error
        ? err.message
        : "Unknown error";

    console.error("[instagram-sync] Error:", errorMsg);

    // Update sync log with failure
    if (syncLogId) {
      await supabase
        .from("instagram_sync_log")
        .update({
          status: "failed",
          error: errorMsg,
          completed_at: new Date().toISOString(),
        })
        .eq("id", syncLogId);
    }

    return {
      success: false,
      profileSynced: false,
      mediaCount: 0,
      insightsCount: 0,
      error: errorMsg,
      durationMs: Date.now() - start,
    };
  }
}

/* ── Profile sync ───────────────────────────────────────── */

async function syncProfile(
  supabase: AnySupabaseClient,
  empresaId: string,
  userId: string,
  igUserId: string,
  token: string
): Promise<boolean> {
  try {
    const profile: IGProfile = await getProfile(igUserId, token);
    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

    await supabase.from("instagram_profile_cache").upsert(
      {
        empresa_id: empresaId,
        user_id: userId,
        username: profile.username,
        followers_count: profile.followers_count,
        follows_count: profile.follows_count,
        media_count: profile.media_count,
        biography: profile.biography,
        profile_picture_url: profile.profile_picture_url,
        snapshot_date: today,
      },
      { onConflict: "empresa_id,snapshot_date" }
    );

    console.log(
      `[instagram-sync] Profile synced: @${profile.username} (${profile.followers_count} followers)`
    );
    return true;
  } catch (err) {
    console.error("[instagram-sync] Profile sync failed:", err);
    return false;
  }
}

/* ── Media sync ─────────────────────────────────────────── */

async function syncMedia(
  supabase: AnySupabaseClient,
  empresaId: string,
  userId: string,
  igUserId: string,
  token: string
): Promise<number> {
  try {
    const mediaItems: IGMedia[] = await getMedia(igUserId, token, 50);

    if (mediaItems.length === 0) return 0;

    const rows = mediaItems.map((m) => ({
      empresa_id: empresaId,
      user_id: userId,
      ig_media_id: m.id,
      caption: m.caption ?? null,
      media_type: m.media_type,
      media_url: m.media_url,
      thumbnail_url: m.thumbnail_url ?? null,
      permalink: m.permalink,
      timestamp: m.timestamp,
      like_count: m.like_count ?? 0,
      comments_count: m.comments_count ?? 0,
      synced_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from("instagram_media_cache")
      .upsert(rows, { onConflict: "empresa_id,ig_media_id" });

    if (error) {
      console.error("[instagram-sync] Media upsert error:", error.message);
      return 0;
    }

    console.log(`[instagram-sync] Media synced: ${rows.length} posts`);
    return rows.length;
  } catch (err) {
    console.error("[instagram-sync] Media sync failed:", err);
    return 0;
  }
}

/* ── Insights sync ──────────────────────────────────────── */

async function syncInsights(
  supabase: AnySupabaseClient,
  empresaId: string,
  userId: string,
  igUserId: string,
  token: string
): Promise<number> {
  const periods: ("day" | "week" | "days_28")[] = ["day", "week", "days_28"];
  let totalCount = 0;

  for (const period of periods) {
    try {
      const insights: IGInsight[] = await getInsights(igUserId, token, period);

      const rows = insights.flatMap((insight) =>
        insight.values.map((v) => ({
          empresa_id: empresaId,
          user_id: userId,
          metric_name: insight.name,
          period,
          value: v.value,
          end_time: v.end_time ?? null,
          synced_at: new Date().toISOString(),
        }))
      );

      if (rows.length > 0) {
        const { error } = await supabase
          .from("instagram_insights_cache")
          .upsert(rows, {
            onConflict: "empresa_id,metric_name,period,end_time",
          });

        if (error) {
          console.error(
            `[instagram-sync] Insights upsert error (${period}):`,
            error.message
          );
        } else {
          totalCount += rows.length;
        }
      }
    } catch (err) {
      // Some periods may fail for accounts without enough data — that's OK
      console.warn(
        `[instagram-sync] Insights (${period}) failed:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  console.log(`[instagram-sync] Insights synced: ${totalCount} data points`);
  return totalCount;
}

/* ── Get last sync status ───────────────────────────────── */

export async function getLastSyncStatus(empresaId: string) {
  const supabase = getServiceSupabase();

  const { data } = await supabase
    .from("instagram_sync_log")
    .select("*")
    .eq("empresa_id", empresaId)
    .order("started_at", { ascending: false })
    .limit(1)
    .single();

  if (!data) return null;

  // Also get counts from cache tables
  const [mediaResult, profileResult, insightsResult] = await Promise.all([
    supabase
      .from("instagram_media_cache")
      .select("id", { count: "exact", head: true })
      .eq("empresa_id", empresaId),
    supabase
      .from("instagram_profile_cache")
      .select("id", { count: "exact", head: true })
      .eq("empresa_id", empresaId),
    supabase
      .from("instagram_insights_cache")
      .select("id", { count: "exact", head: true })
      .eq("empresa_id", empresaId),
  ]);

  return {
    lastSync: data,
    counts: {
      media: mediaResult.count ?? 0,
      profileSnapshots: profileResult.count ?? 0,
      insights: insightsResult.count ?? 0,
    },
  };
}
