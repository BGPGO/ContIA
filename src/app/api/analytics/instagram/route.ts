import { NextRequest, NextResponse } from "next/server";
import { getProfile, getMedia, getInsights, getMediaInsights } from "@/lib/instagram";
import type { IGProfile, IGMedia, IGInsight } from "@/lib/instagram";
import { createClient } from "@/lib/supabase/server";

/* ── Types ────────────────────────────────────────────── */

interface TopPost {
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

interface ContentBreakdown {
  type: string;
  count: number;
  percentage: number;
}

interface PostingFrequency {
  posts_per_week: number;
  by_day_of_week: number[];
  by_hour: number[];
}

interface HashtagStats {
  tag: string;
  count: number;
}

interface InsightTimeSeries {
  name: string;
  values: { value: number; end_time?: string }[];
}

interface AnalyticsResponse {
  profile: IGProfile;
  engagement: {
    avg_likes: number;
    avg_comments: number;
    avg_saves: number;
    avg_shares: number;
    engagement_rate: number;
    total_likes: number;
    total_comments: number;
    total_saves: number;
    total_shares: number;
  };
  top_posts: TopPost[];
  content_breakdown: ContentBreakdown[];
  posting_frequency: PostingFrequency;
  insights: InsightTimeSeries[];
  insights_error?: string | null;
  account_insights: {
    total_interactions: number;
    new_followers: number;
  };
  content_analysis: {
    top_hashtags: HashtagStats[];
    avg_caption_length: number;
    emoji_count: number;
    avg_emojis_per_post: number;
  };
  fetched_at: string;
}

/* ── Helpers ──────────────────────────────────────────── */

function extractHashtags(caption: string): string[] {
  const matches = caption.match(/#[\w\u00C0-\u024F]+/g);
  return matches ?? [];
}

function countEmojis(text: string): number {
  const emojiRegex = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu;
  const matches = text.match(emojiRegex);
  return matches?.length ?? 0;
}

function computeEngagement(media: IGMedia[], followersCount: number) {
  if (media.length === 0) {
    return { avg_likes: 0, avg_comments: 0, engagement_rate: 0, total_likes: 0, total_comments: 0 };
  }

  const totalLikes = media.reduce((sum, m) => sum + (m.like_count ?? 0), 0);
  const totalComments = media.reduce((sum, m) => sum + (m.comments_count ?? 0), 0);

  const avgLikes = Math.round(totalLikes / media.length);
  const avgComments = Math.round(totalComments / media.length);

  const engagementRate = followersCount > 0
    ? ((totalLikes + totalComments) / media.length / followersCount) * 100
    : 0;

  return {
    avg_likes: avgLikes,
    avg_comments: avgComments,
    engagement_rate: Math.round(engagementRate * 100) / 100,
    total_likes: totalLikes,
    total_comments: totalComments,
  };
}

function computeTopPosts(media: IGMedia[], followersCount: number): Omit<TopPost, "saves" | "shares" | "reach" | "views">[] {
  return media
    .map((m) => {
      const likes = m.like_count ?? 0;
      const comments = m.comments_count ?? 0;
      const er = followersCount > 0 ? ((likes + comments) / followersCount) * 100 : 0;

      return {
        id: m.id,
        caption: m.caption ?? "",
        media_type: m.media_type,
        media_url: m.media_url,
        thumbnail_url: m.thumbnail_url ?? null,
        permalink: m.permalink,
        timestamp: m.timestamp,
        like_count: likes,
        comments_count: comments,
        engagement_rate: Math.round(er * 100) / 100,
      };
    })
    .sort((a, b) => (b.like_count + b.comments_count) - (a.like_count + a.comments_count))
    .slice(0, 5);
}

function computeContentBreakdown(media: IGMedia[]): ContentBreakdown[] {
  const counts: Record<string, number> = {};

  for (const m of media) {
    const type = m.media_type;
    counts[type] = (counts[type] ?? 0) + 1;
  }

  const total = media.length || 1;

  return Object.entries(counts)
    .map(([type, count]) => ({
      type,
      count,
      percentage: Math.round((count / total) * 100),
    }))
    .sort((a, b) => b.count - a.count);
}

function computePostingFrequency(media: IGMedia[]): PostingFrequency {
  const byDayOfWeek = new Array(7).fill(0) as number[];
  const byHour = new Array(24).fill(0) as number[];

  for (const m of media) {
    const d = new Date(m.timestamp);
    byDayOfWeek[d.getDay()]++;
    byHour[d.getHours()]++;
  }

  // Calculate posts per week
  if (media.length < 2) {
    return { posts_per_week: media.length, by_day_of_week: byDayOfWeek, by_hour: byHour };
  }

  const timestamps = media.map((m) => new Date(m.timestamp).getTime()).sort((a, b) => a - b);
  const rangeMs = timestamps[timestamps.length - 1] - timestamps[0];
  const rangeWeeks = rangeMs / (7 * 24 * 60 * 60 * 1000);
  const postsPerWeek = rangeWeeks > 0 ? media.length / rangeWeeks : media.length;

  return {
    posts_per_week: Math.round(postsPerWeek * 10) / 10,
    by_day_of_week: byDayOfWeek,
    by_hour: byHour,
  };
}

function computeContentAnalysis(media: IGMedia[]) {
  const allHashtags: Record<string, number> = {};
  let totalCaptionLength = 0;
  let totalEmojis = 0;
  let postsWithCaption = 0;

  for (const m of media) {
    const caption = m.caption ?? "";
    if (caption.length > 0) {
      postsWithCaption++;
      totalCaptionLength += caption.length;
      totalEmojis += countEmojis(caption);

      for (const tag of extractHashtags(caption)) {
        const lower = tag.toLowerCase();
        allHashtags[lower] = (allHashtags[lower] ?? 0) + 1;
      }
    }
  }

  const topHashtags = Object.entries(allHashtags)
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);

  return {
    top_hashtags: topHashtags,
    avg_caption_length: postsWithCaption > 0 ? Math.round(totalCaptionLength / postsWithCaption) : 0,
    emoji_count: totalEmojis,
    avg_emojis_per_post: postsWithCaption > 0 ? Math.round((totalEmojis / postsWithCaption) * 10) / 10 : 0,
  };
}

/* ── Route Handler ────────────────────────────────────── */

export async function GET(req: NextRequest) {
  const empresaId = req.nextUrl.searchParams.get("empresa_id");
  if (!empresaId) {
    return NextResponse.json({ error: "empresa_id obrigatório" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { data: connection } = await supabase
    .from("social_connections")
    .select("access_token, provider_user_id")
    .eq("empresa_id", empresaId)
    .eq("provider", "instagram")
    .eq("is_active", true)
    .single();

  if (!connection) {
    return NextResponse.json(
      { error: "Instagram não conectado", code: "NOT_CONNECTED" },
      { status: 404 }
    );
  }

  const { access_token, provider_user_id } = connection;

  try {
    // Fetch all data in parallel
    let insightsError: string | null = null;
    const [profile, media, insightsDay] = await Promise.all([
      getProfile(provider_user_id, access_token),
      getMedia(provider_user_id, access_token, 30),
      getInsights(provider_user_id, access_token, "day").catch((err) => {
        const detail = err instanceof Error ? err.message : String(err);
        console.error("[analytics] Instagram insights error:", detail);
        insightsError = `Insights indisponíveis: ${detail}. A conta pode precisar de 100+ seguidores e posts recentes.`;
        return [] as IGInsight[];
      }),
    ]);

    // If day insights failed, try days_28 as fallback
    let finalInsights = insightsDay;
    if (insightsDay.length === 0 && !insightsError) {
      try {
        finalInsights = await getInsights(provider_user_id, access_token, "days_28");
      } catch {
        // Already have insightsDay = [], just continue
      }
    }

    // Extract account-level insight values
    const getInsightTotal = (name: string) => {
      const insight = finalInsights.find((i) => i.name === name);
      if (!insight?.values?.length) return 0;
      return insight.values.reduce((s, v) => s + v.value, 0);
    };

    const accountInsights = {
      total_interactions: getInsightTotal("total_interactions"),
      new_followers: getInsightTotal("follows_and_unfollows"),
    };

    // Fetch per-post insights for top 10 posts (reach, saves, shares, views)
    const topMedia = media.slice(0, 10);
    const mediaInsightsMap = new Map<string, Record<string, number>>();

    const mediaInsightsResults = await Promise.allSettled(
      topMedia.map((m) =>
        getMediaInsights(m.id, access_token, m.media_type as "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM")
          .then((insights) => ({ id: m.id, insights }))
      )
    );

    for (const result of mediaInsightsResults) {
      if (result.status === "fulfilled" && result.value.insights) {
        mediaInsightsMap.set(result.value.id, result.value.insights);
      }
    }

    // Compute engagement with saves/shares from media insights
    const allSaves = topMedia.reduce((sum, m) => sum + (mediaInsightsMap.get(m.id)?.saves ?? 0), 0);
    const allShares = topMedia.reduce((sum, m) => sum + (mediaInsightsMap.get(m.id)?.shares ?? 0), 0);

    const engagement = computeEngagement(media, profile.followers_count);
    const enrichedEngagement = {
      ...engagement,
      avg_saves: topMedia.length > 0 ? Math.round(allSaves / topMedia.length) : 0,
      avg_shares: topMedia.length > 0 ? Math.round(allShares / topMedia.length) : 0,
      total_saves: allSaves,
      total_shares: allShares,
    };

    const topPosts = computeTopPosts(media, profile.followers_count).map((post) => {
      const mi = mediaInsightsMap.get(post.id);
      return {
        ...post,
        saves: mi?.saves ?? 0,
        shares: mi?.shares ?? 0,
        reach: mi?.reach ?? 0,
        views: mi?.views ?? 0,
      };
    });

    const contentBreakdown = computeContentBreakdown(media);
    const postingFrequency = computePostingFrequency(media);
    const contentAnalysis = computeContentAnalysis(media);

    const insights: InsightTimeSeries[] = finalInsights.map((insight) => ({
      name: insight.name,
      values: insight.values,
    }));

    const response: AnalyticsResponse = {
      profile,
      engagement: enrichedEngagement,
      top_posts: topPosts,
      content_breakdown: contentBreakdown,
      posting_frequency: postingFrequency,
      insights,
      ...(insightsError ? { insights_error: insightsError } : {}),
      account_insights: accountInsights,
      content_analysis: contentAnalysis,
      fetched_at: new Date().toISOString(),
    };

    return NextResponse.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json(
      { error: `Erro ao buscar analytics: ${message}` },
      { status: 502 }
    );
  }
}
