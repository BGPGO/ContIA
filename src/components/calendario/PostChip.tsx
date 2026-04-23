"use client";

import { Post } from "@/types";
import { cn } from "@/lib/utils";
import { getPlataformaCor } from "@/lib/utils";

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max).trimEnd() + "…" : str;
}

interface PostChipProps {
  post: Post;
  selected?: boolean;
  onSelect: () => void;
}

export function PostChip({ post, selected = false, onSelect }: PostChipProps) {
  const color = getPlataformaCor(post.plataformas[0]);

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      className={cn(
        "w-full text-left flex items-center gap-1 rounded text-[10px] leading-tight py-[3px] pr-1 transition-all duration-100",
        selected && "ring-1 ring-[#4ecdc4]/60"
      )}
      style={{
        borderLeft: `3px solid ${color}`,
        paddingLeft: "5px",
        color: "var(--color-text-secondary)",
        background: `linear-gradient(90deg, ${color}10, transparent)`,
      }}
      title={post.titulo}
    >
      <span className="truncate flex-1">{truncate(post.titulo, 18)}</span>
    </button>
  );
}
