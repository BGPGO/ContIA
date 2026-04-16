"use client";

import { useMemo } from "react";
import { Post } from "@/types";
import { useEmpresa } from "./useEmpresa";
import { usePosts } from "./usePosts";
import { useInstagramData } from "./useInstagramData";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

/* ── Types ──────────────────────────────────────────────── */

export interface FeedPost {
  id: string;
  thumbnail: string;
  isScheduled: boolean;
  isPublished: boolean;
  isFromAPI: boolean;
  date: string;
  caption?: string;
}

export interface InstagramFeedPreview {
  feedPosts: FeedPost[];
  profilePic: string | null;
  username: string;
  followersCount: number;
  postsCount: number;
  loading: boolean;
}

/* ── Helpers ────────────────────────────────────────────── */

function formatShortDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  try {
    return format(new Date(dateStr), "dd/MM", { locale: ptBR });
  } catch {
    return "";
  }
}

function isInstagramPost(post: Post): boolean {
  return post.plataformas.some(
    (p) => p === "instagram" || p === "Instagram"
  );
}

/* ── Build feed ─────────────────────────────────────────── */

function buildFeedPreview(
  scheduledPosts: Post[],
  publishedPosts: Post[],
  igMedia: { id: string; media_url: string | null; thumbnail_url: string | null; timestamp: string; caption: string | null }[],
  limit: number = 9
): FeedPost[] {
  const feed: FeedPost[] = [];
  const usedIds = new Set<string>();

  // 1. Scheduled (future, closest first)
  const now = new Date();
  const futureScheduled = scheduledPosts
    .filter(
      (p) =>
        isInstagramPost(p) &&
        p.agendado_para &&
        new Date(p.agendado_para) >= now
    )
    .sort(
      (a, b) =>
        new Date(a.agendado_para!).getTime() -
        new Date(b.agendado_para!).getTime()
    );

  for (const p of futureScheduled) {
    if (feed.length >= limit) break;
    usedIds.add(p.id);
    feed.push({
      id: p.id,
      thumbnail: p.midia_url || "",
      isScheduled: true,
      isPublished: false,
      isFromAPI: false,
      date: formatShortDate(p.agendado_para),
      caption: p.conteudo,
    });
  }

  // 2. Published (newest first)
  const sorted = publishedPosts
    .filter((p) => isInstagramPost(p) && !usedIds.has(p.id))
    .sort(
      (a, b) =>
        new Date(b.publicado_em || b.created_at).getTime() -
        new Date(a.publicado_em || a.created_at).getTime()
    );

  for (const p of sorted) {
    if (feed.length >= limit) break;
    usedIds.add(p.id);
    feed.push({
      id: p.id,
      thumbnail: p.midia_url || "",
      isScheduled: false,
      isPublished: true,
      isFromAPI: false,
      date: formatShortDate(p.publicado_em || p.created_at),
      caption: p.conteudo,
    });
  }

  // 3. Instagram API media
  for (const m of igMedia) {
    if (feed.length >= limit) break;
    if (usedIds.has(m.id)) continue;
    usedIds.add(m.id);
    feed.push({
      id: m.id,
      thumbnail: m.thumbnail_url || m.media_url || "",
      isScheduled: false,
      isPublished: false,
      isFromAPI: true,
      date: formatShortDate(m.timestamp),
      caption: m.caption || undefined,
    });
  }

  return feed.slice(0, limit);
}

/* ── Hook ───────────────────────────────────────────────── */

export function useInstagramFeedPreview(
  empresaId: string | undefined
): InstagramFeedPreview {
  const { empresa } = useEmpresa();
  const { posts: allPosts, loading: postsLoading } = usePosts(empresaId);
  const {
    profile,
    media,
    loading: igLoading,
  } = useInstagramData();

  const scheduledPosts = useMemo(
    () => allPosts.filter((p) => p.status === "agendado"),
    [allPosts]
  );

  const publishedPosts = useMemo(
    () => allPosts.filter((p) => p.status === "publicado"),
    [allPosts]
  );

  const feedPosts = useMemo(
    () => buildFeedPreview(scheduledPosts, publishedPosts, media, 12),
    [scheduledPosts, publishedPosts, media]
  );

  const igConfig = empresa?.redes_sociais?.instagram;

  return {
    feedPosts,
    profilePic: profile?.profile_picture_url || igConfig?.profile_picture_url || null,
    username: profile?.username || igConfig?.username || empresa?.instagram_handle || "username",
    followersCount: profile?.followers_count || igConfig?.followers_count || 0,
    postsCount: profile?.media_count || feedPosts.length,
    loading: postsLoading || igLoading,
  };
}
