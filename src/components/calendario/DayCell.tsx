"use client";

import { format, isSameMonth, isToday } from "date-fns";
import { Post } from "@/types";
import { cn } from "@/lib/utils";
import { PostChip } from "./PostChip";

interface DayCellProps {
  day: Date;
  currentMonth: Date;
  posts: Post[];
  onDayClick: (date: Date) => void;
}

export function DayCell({ day, currentMonth, posts, onDayClick }: DayCellProps) {
  const inMonth = isSameMonth(day, currentMonth);
  const today = isToday(day);

  // Separate posts with thumb from those without
  const thumbPosts = posts.filter((p) => p.midia_url);
  const noThumbPosts = posts.filter((p) => !p.midia_url);
  const visibleThumbs = thumbPosts.slice(0, 2);

  // Extra count: all posts beyond what's visually shown
  // If we have 2+ thumbs shown, extras are posts beyond 2
  // If 1 thumb shown, extras are remaining posts (thumb + no-thumb) beyond 1
  const extraCount = Math.max(0, posts.length - (visibleThumbs.length > 0 ? visibleThumbs.length : 0));

  return (
    <div
      className={cn(
        "relative min-h-[80px] border-r border-b border-border-subtle cursor-pointer overflow-hidden transition-all duration-150 group",
        today ? "ring-2 ring-inset ring-[#4ecdc4]/60" : "",
        !inMonth && "opacity-25"
      )}
      onClick={() => {
        if (inMonth) onDayClick(day);
      }}
    >
      {/* ── Thumb: 1 post with midia_url ─────────────────────────────── */}
      {visibleThumbs.length === 1 && (
        <img
          src={visibleThumbs[0].midia_url!}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}

      {/* ── Thumb: 2 posts with midia_url (diagonal split) ───────────── */}
      {visibleThumbs.length === 2 && (
        <>
          <img
            src={visibleThumbs[0].midia_url!}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            style={{ clipPath: "polygon(0 0, 100% 0, 0 100%)" }}
          />
          <img
            src={visibleThumbs[1].midia_url!}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            style={{ clipPath: "polygon(100% 0, 100% 100%, 0 100%)" }}
          />
          {/* subtle diagonal divider line */}
          <div
            className="absolute inset-0 pointer-events-none z-[1]"
            style={{
              background:
                "linear-gradient(to top right, transparent calc(50% - 1px), rgba(255,255,255,0.25) calc(50%), transparent calc(50% + 1px))",
            }}
          />
        </>
      )}

      {/* ── Dark overlay for readability when thumbs are present ─────── */}
      {visibleThumbs.length > 0 && (
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/30 z-[2] group-hover:from-black/60 transition-all duration-150" />
      )}

      {/* ── Hover overlay for cells without thumbs ───────────────────── */}
      {visibleThumbs.length === 0 && (
        <div className="absolute inset-0 bg-[#4ecdc4]/0 group-hover:bg-[#4ecdc4]/5 transition-colors duration-150" />
      )}

      {/* ── Day number ───────────────────────────────────────────────── */}
      <div
        className={cn(
          "absolute top-1 left-1.5 flex items-center gap-1 z-10",
          visibleThumbs.length > 0
            ? "text-white drop-shadow-sm"
            : today
            ? "text-[#4ecdc4]"
            : "dark:text-white/40 text-text-muted"
        )}
      >
        <span className="text-xs leading-none font-medium">
          {format(day, "d")}
        </span>
        {today && visibleThumbs.length === 0 && (
          <span className="w-1 h-1 rounded-full bg-[#4ecdc4]" />
        )}
      </div>

      {/* ── Extra count badge ────────────────────────────────────────── */}
      {extraCount > 0 && visibleThumbs.length > 0 && (
        <div className="absolute top-1 right-1 z-10 text-[9px] font-semibold px-1.5 py-0.5 rounded-md bg-black/70 text-white leading-none">
          +{extraCount}
        </div>
      )}

      {/* ── Fallback: chips for posts without midia_url ──────────────── */}
      {visibleThumbs.length === 0 && noThumbPosts.length > 0 && (
        <div className="p-1 pt-5 space-y-[2px] relative z-10">
          {noThumbPosts.slice(0, 3).map((post) => (
            <PostChip key={post.id} post={post} onSelect={() => onDayClick(day)} />
          ))}
          {noThumbPosts.length > 3 && (
            <span className="text-[9px] dark:text-white/40 text-text-muted pl-1.5 font-medium">
              +{noThumbPosts.length - 3} mais
            </span>
          )}
        </div>
      )}

      {/* ── Status indicator dot at bottom when thumb present ────────── */}
      {visibleThumbs.length > 0 && posts.length > 0 && (
        <div className="absolute bottom-1.5 left-1.5 z-10 flex items-center gap-0.5">
          {posts.slice(0, 3).map((p) => (
            <span
              key={p.id}
              className="w-1 h-1 rounded-full"
              style={{
                backgroundColor:
                  p.status === "publicado"
                    ? "#22c55e"
                    : p.status === "agendado"
                    ? "#eab308"
                    : "#6b7280",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
