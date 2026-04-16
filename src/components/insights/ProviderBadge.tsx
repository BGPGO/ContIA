"use client";

import { METADATA_BY_PROVIDER } from "@/lib/drivers/metadata";
import type { ProviderKey } from "@/types/providers";

interface ProviderBadgeProps {
  provider: ProviderKey;
  size?: "sm" | "md";
}

export function ProviderBadge({ provider, size = "sm" }: ProviderBadgeProps) {
  const meta = METADATA_BY_PROVIDER[provider];
  if (!meta) return null;

  const sizeClasses = size === "sm"
    ? "text-[10px] px-1.5 py-0.5"
    : "text-[12px] px-2 py-1";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md font-medium ${sizeClasses}`}
      style={{
        backgroundColor: `${meta.color}15`,
        color: meta.color,
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ backgroundColor: meta.color }}
      />
      {meta.displayName}
    </span>
  );
}
