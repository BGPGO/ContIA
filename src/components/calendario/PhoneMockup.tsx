"use client";

import { motion } from "motion/react";
import { Clock, Wifi, Battery, Signal } from "lucide-react";
import { FeedPost } from "@/hooks/useInstagramFeedPreview";

/* ── Instagram icon SVG ─────────────────────────────────── */

function IgIcon({ size = 14, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}

/* ── Types ──────────────────────────────────────────────── */

interface PhoneMockupProps {
  feedPosts: FeedPost[];
  profilePic: string | null;
  username: string;
  followersCount: number;
  postsCount: number;
  loading?: boolean;
}

/* ── Helpers ────────────────────────────────────────────── */

function formatFollowers(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

/* ── Skeleton grid cell ─────────────────────────────────── */

function SkeletonCell() {
  return (
    <div className="aspect-square bg-gradient-to-br from-gray-200 to-gray-100 animate-pulse" />
  );
}

/* ── Feed cell ──────────────────────────────────────────── */

function FeedCell({ post }: { post: FeedPost }) {
  const hasImage = post.thumbnail && post.thumbnail.length > 0;

  return (
    <div className="aspect-square relative overflow-hidden group">
      {hasImage ? (
        <img
          src={post.thumbnail}
          alt=""
          className="w-full h-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-gray-200 via-gray-100 to-gray-50 flex items-center justify-center">
          <IgIcon size={16} className="text-gray-300" />
        </div>
      )}

      {/* Scheduled overlay */}
      {post.isScheduled && (
        <div className="absolute inset-0 bg-black/35 flex flex-col items-center justify-center gap-0.5 backdrop-blur-[1px]">
          <Clock size={12} className="text-white drop-shadow" />
          <span className="text-[8px] font-medium text-white drop-shadow tracking-wide">
            {post.date}
          </span>
        </div>
      )}

      {/* Hover caption preview */}
      {post.caption && !post.isScheduled && (
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-end p-1">
          <p className="text-[7px] text-white leading-tight line-clamp-3">
            {post.caption}
          </p>
        </div>
      )}
    </div>
  );
}

/* ── Phone Mockup ───────────────────────────────────────── */

export function PhoneMockup({
  feedPosts,
  profilePic,
  username,
  followersCount,
  postsCount,
  loading = false,
}: PhoneMockupProps) {
  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(
    now.getMinutes()
  ).padStart(2, "0")}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
      className="flex flex-col items-center"
    >
      {/* Label */}
      <p className="text-[11px] text-text-muted mb-3 font-medium tracking-wide uppercase">
        Preview do Feed
      </p>

      {/* Phone frame */}
      <div className="relative w-[280px] bg-white rounded-[40px] p-3 shadow-2xl shadow-black/30 border-[3px] border-gray-800">
        {/* Notch / Dynamic Island */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-[90px] h-[24px] bg-gray-900 rounded-full z-10" />

        {/* Screen area */}
        <div className="mt-7 rounded-[28px] overflow-hidden bg-white border border-gray-100">
          {/* Status bar */}
          <div className="flex items-center justify-between px-5 py-1.5 bg-white">
            <span className="text-[10px] font-semibold text-black">{timeStr}</span>
            <div className="flex items-center gap-1">
              <Signal size={10} className="text-black" />
              <Wifi size={10} className="text-black" />
              <Battery size={10} className="text-black" />
            </div>
          </div>

          {/* Instagram header */}
          <div className="px-3 py-1.5 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <IgIcon size={14} className="text-black" />
              <span className="text-[11px] font-bold text-black tracking-tight">
                Instagram
              </span>
            </div>
          </div>

          {/* Profile section */}
          <div className="px-3 py-2.5 flex items-center gap-3 border-b border-gray-50">
            {/* Avatar */}
            <div className="shrink-0">
              {profilePic ? (
                <img
                  src={profilePic}
                  alt={username}
                  className="w-14 h-14 rounded-full border-2 border-gray-200 object-cover"
                />
              ) : (
                <div className="w-14 h-14 rounded-full border-2 border-gray-200 bg-gradient-to-br from-purple-400 via-pink-400 to-orange-300 flex items-center justify-center">
                  <span className="text-white text-lg font-bold">
                    {username.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
            </div>

            {/* Stats */}
            <div className="flex gap-4 text-center flex-1 justify-center">
              <div className="flex flex-col">
                <span className="text-[11px] font-bold text-black leading-none">
                  {postsCount}
                </span>
                <span className="text-[9px] text-gray-500 mt-0.5">Posts</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] font-bold text-black leading-none">
                  {formatFollowers(followersCount)}
                </span>
                <span className="text-[9px] text-gray-500 mt-0.5">Seguidores</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] font-bold text-black leading-none">
                  -
                </span>
                <span className="text-[9px] text-gray-500 mt-0.5">Seguindo</span>
              </div>
            </div>
          </div>

          {/* Username */}
          <div className="px-3 py-1.5 border-b border-gray-100">
            <span className="text-[10px] font-semibold text-black">
              @{username}
            </span>
          </div>

          {/* Tab bar (grid / reels / tagged) */}
          <div className="flex border-b border-gray-100">
            <div className="flex-1 py-1.5 border-b-2 border-black flex items-center justify-center">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
              </svg>
            </div>
            <div className="flex-1 py-1.5 flex items-center justify-center">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
                <polygon points="5,3 19,12 5,21" />
              </svg>
            </div>
            <div className="flex-1 py-1.5 flex items-center justify-center">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
          </div>

          {/* Feed grid */}
          <div className="grid grid-cols-3 gap-[1px] bg-gray-100 max-h-[280px] overflow-y-auto">
            {loading
              ? Array.from({ length: 9 }).map((_, i) => (
                  <SkeletonCell key={i} />
                ))
              : feedPosts.length > 0
              ? feedPosts.map((post) => (
                  <FeedCell key={post.id} post={post} />
                ))
              : Array.from({ length: 9 }).map((_, i) => (
                  <div
                    key={i}
                    className="aspect-square bg-gray-50 flex items-center justify-center"
                  >
                    <IgIcon size={12} className="text-gray-200" />
                  </div>
                ))}
          </div>
        </div>

        {/* Home indicator */}
        <div className="mt-2 mx-auto w-[100px] h-[4px] bg-gray-800 rounded-full" />
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-4">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-black/35 flex items-center justify-center">
            <Clock size={6} className="text-white" />
          </div>
          <span className="text-[10px] text-text-muted">Agendado</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
          <span className="text-[10px] text-text-muted">Publicado</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-purple-400" />
          <span className="text-[10px] text-text-muted">Instagram</span>
        </div>
      </div>
    </motion.div>
  );
}
