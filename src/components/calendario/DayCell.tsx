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
  const MAX_VISIBLE = 3;
  const overflow = posts.length - MAX_VISIBLE;

  return (
    <div
      className={cn(
        "relative min-h-[80px] p-1.5 border-r border-b border-border-subtle flex flex-col gap-[3px] cursor-pointer transition-colors duration-150",
        today
          ? "ring-2 ring-inset ring-[#4ecdc4]/60 hover:bg-[#4ecdc4]/5"
          : "hover:bg-[#4ecdc4]/5",
        !inMonth && "opacity-25"
      )}
      onClick={() => {
        if (inMonth) onDayClick(day);
      }}
    >
      {/* day number */}
      <div className="flex items-center gap-1 mb-0.5">
        <span
          className={cn(
            "text-xs leading-none font-medium",
            today ? "text-[#4ecdc4]" : "text-white/40"
          )}
        >
          {format(day, "d")}
        </span>
        {today && <span className="w-1 h-1 rounded-full bg-[#4ecdc4]" />}
      </div>

      {/* post chips */}
      <div className="flex flex-col gap-[2px] flex-1">
        {posts.slice(0, MAX_VISIBLE).map((post) => (
          <PostChip
            key={post.id}
            post={post}
            onSelect={() => onDayClick(day)}
          />
        ))}
        {overflow > 0 && (
          <span className="text-[10px] text-white/40 pl-1.5 font-medium">
            +{overflow} mais
          </span>
        )}
      </div>

      {/* subtle count indicator dot if posts > 3 */}
      {posts.length > 3 && (
        <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[#4ecdc4]/60" />
      )}
    </div>
  );
}
