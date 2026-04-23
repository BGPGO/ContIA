"use client";

export function CalendarSkeleton() {
  return (
    <div className="grid grid-cols-7 border-t border-l border-border-subtle animate-pulse">
      {Array.from({ length: 35 }).map((_, i) => (
        <div
          key={i}
          className="min-h-[80px] p-1.5 border-r border-b border-border-subtle"
        >
          <div className="w-4 h-3 bg-bg-elevated rounded mb-2" />
          <div className="space-y-1">
            <div className="h-3 bg-bg-elevated rounded" />
            <div className="h-3 bg-bg-elevated rounded w-3/4" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function MobileListSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="space-y-1.5">
          <div className="h-3 w-24 bg-bg-elevated rounded" />
          <div className="h-12 bg-bg-elevated rounded-lg" />
        </div>
      ))}
    </div>
  );
}
