/**
 * SectionHeader — separador visual de seções nos dashboards de Analytics.
 * Substitui as definições inline duplicadas em analytics/page.tsx e analytics/[provider]/page.tsx.
 */

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
}

export function SectionHeader({ title, subtitle }: SectionHeaderProps) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-3 mb-1">
        <div className="h-px flex-1 bg-border/60" />
        <h2 className="text-[13px] font-semibold text-text-muted uppercase tracking-widest whitespace-nowrap">
          {title}
        </h2>
        <div className="h-px flex-1 bg-border/60" />
      </div>
      {subtitle && (
        <p className="text-center text-[12px] text-text-muted/70 mt-1">{subtitle}</p>
      )}
    </div>
  );
}
