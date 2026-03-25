"use client";

import { useMemo, useState } from "react";
import {
  Eye,
  TrendingUp,
  Users,
  Heart,
  MessageCircle,
  Share2,
  MousePointerClick,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { useEmpresa } from "@/hooks/useEmpresa";
import { getAnalyticsMock } from "@/lib/mock-data";
import { cn, formatNumber, getPlataformaCor, getPlataformaLabel } from "@/lib/utils";
import { DadoDiario, Post } from "@/types";

// ── helpers ──────────────────────────────────────────────────────────────────

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

// ── stat card with variants ─────────────────────────────────────────────────

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
  suffix?: string;
  change?: string;
  changePositive?: boolean;
}

function StatCard({ icon, label, value, color, suffix, change, changePositive }: StatCardProps) {
  return (
    <div className="bg-bg-card border border-border rounded-xl p-5 transition-all duration-200 hover:border-border-light">
      <div className="flex items-center justify-between mb-4 relative z-10">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: `${color}20`, boxShadow: `0 0 16px ${color}12` }}
        >
          <span style={{ color }}>{icon}</span>
        </div>
        {change && (
          <span className={cn(
            "inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg",
            changePositive ? "text-success bg-success/10" : "text-danger bg-danger/10"
          )}>
            {changePositive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
            {change}
          </span>
        )}
      </div>
      <div className="flex items-baseline gap-1.5 relative z-10">
        <span className="text-3xl font-bold -tracking-tight text-text-primary tabular-nums leading-none">
          {value}
        </span>
        {suffix && (
          <span className="text-lg font-semibold" style={{ color }}>
            {suffix}
          </span>
        )}
      </div>
      <span className="text-sm text-text-secondary mt-2 block relative z-10">{label}</span>
    </div>
  );
}

// ── area chart ──────────────────────────────────────────────────────────────

interface AreaChartProps {
  dados: DadoDiario[];
  dataKey: keyof DadoDiario;
  color: string;
  colorEnd?: string;
  formatValue?: (v: number) => string;
  label: string;
  sublabel?: string;
  currentValue?: string;
}

function AreaChart({ dados, dataKey, color, colorEnd, formatValue, label, sublabel, currentValue }: AreaChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const endColor = colorEnd || color;

  const values = useMemo(() => dados.map((d) => d[dataKey] as number), [dados, dataKey]);
  const maxVal = useMemo(() => Math.max(...values, 1), [values]);
  const minVal = useMemo(() => Math.min(...values), [values]);
  const range = maxVal - minVal || 1;

  const chartH = 160;
  const chartW = 500;
  const padding = 10;

  const points = useMemo(() => {
    return values.map((v, i) => ({
      x: padding + (i / (values.length - 1)) * (chartW - padding * 2),
      y: padding + (chartH - padding * 2) - ((v - minVal) / range) * (chartH - padding * 2),
    }));
  }, [values, minVal, range, chartH, chartW, padding]);

  const linePath = useMemo(() => {
    if (points.length < 2) return "";
    let d = `M ${points[0].x},${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[Math.max(0, i - 1)];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[Math.min(points.length - 1, i + 2)];
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;
      d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
    }
    return d;
  }, [points]);

  const areaPath = useMemo(() => {
    if (!linePath) return "";
    const lastPt = points[points.length - 1];
    const firstPt = points[0];
    return `${linePath} L ${lastPt.x},${chartH} L ${firstPt.x},${chartH} Z`;
  }, [linePath, points, chartH]);

  const fmt = formatValue || ((v: number) => formatNumber(v));
  const gradId = `area-grad-${dataKey}-${label.replace(/\s/g, "")}`;
  const lineGradId = `line-grad-${dataKey}-${label.replace(/\s/g, "")}`;

  // Find max and min indices for highlight points
  const maxIdx = useMemo(() => {
    let idx = 0;
    for (let i = 1; i < values.length; i++) {
      if (values[i] > values[idx]) idx = i;
    }
    return idx;
  }, [values]);

  const minIdx = useMemo(() => {
    let idx = 0;
    for (let i = 1; i < values.length; i++) {
      if (values[i] < values[idx]) idx = i;
    }
    return idx;
  }, [values]);

  return (
    <div className="bg-bg-card border border-border rounded-xl p-5 hover:border-border-light transition-colors">
      {/* Chart header */}
      <div className="flex items-start justify-between mb-1">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">{label}</h3>
          {sublabel && <span className="text-xs text-text-secondary">{sublabel}</span>}
        </div>
        <div className="text-right">
          {hoveredIndex !== null ? (
            <div>
              <span className="text-lg font-bold tabular-nums -tracking-tight" style={{ color }}>
                {fmt(values[hoveredIndex])}
              </span>
              <span className="text-xs text-text-muted block">{formatShortDate(dados[hoveredIndex].data)}</span>
            </div>
          ) : currentValue ? (
            <span className="text-lg font-bold tabular-nums -tracking-tight" style={{ color }}>
              {currentValue}
            </span>
          ) : null}
        </div>
      </div>

      <div className="relative mt-3" style={{ height: chartH }}>
        <svg
          viewBox={`0 0 ${chartW} ${chartH}`}
          preserveAspectRatio="none"
          className="w-full h-full"
        >
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.3" />
              <stop offset="30%" stopColor={color} stopOpacity="0.12" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
            <linearGradient id={lineGradId} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={color} />
              <stop offset="100%" stopColor={endColor} />
            </linearGradient>
          </defs>

          {/* Horizontal grid lines */}
          {[0.2, 0.4, 0.6, 0.8].map((pct) => (
            <line
              key={pct}
              x1={padding}
              y1={chartH * pct}
              x2={chartW - padding}
              y2={chartH * pct}
              stroke="var(--color-border-subtle)"
              strokeWidth="0.5"
            />
          ))}

          {/* Vertical hover line */}
          {hoveredIndex !== null && points[hoveredIndex] && (
            <line
              x1={points[hoveredIndex].x}
              y1={padding}
              x2={points[hoveredIndex].x}
              y2={chartH}
              stroke="var(--color-border-light)"
              strokeWidth="0.5"
              strokeDasharray="3 3"
            />
          )}

          {/* Area fill */}
          <path d={areaPath} fill={`url(#${gradId})`} />

          {/* Glow line — soft depth */}
          <path
            d={linePath}
            fill="none"
            stroke={color}
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.08"
          />

          {/* Main line — thin and elegant */}
          <path
            d={linePath}
            fill="none"
            stroke={`url(#${lineGradId})`}
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Max point */}
          {points[maxIdx] && (
            <>
              <circle
                cx={points[maxIdx].x}
                cy={points[maxIdx].y}
                r="6"
                fill={color}
                opacity="0.12"
              />
              <circle
                cx={points[maxIdx].x}
                cy={points[maxIdx].y}
                r="3"
                fill={color}
                stroke="var(--color-bg-card)"
                strokeWidth="1.5"
              />
            </>
          )}

          {/* Min point */}
          {points[minIdx] && maxIdx !== minIdx && (
            <>
              <circle
                cx={points[minIdx].x}
                cy={points[minIdx].y}
                r="6"
                fill={endColor}
                opacity="0.12"
              />
              <circle
                cx={points[minIdx].x}
                cy={points[minIdx].y}
                r="3"
                fill={endColor}
                stroke="var(--color-bg-card)"
                strokeWidth="1.5"
              />
            </>
          )}

          {/* Hover point */}
          {hoveredIndex !== null && points[hoveredIndex] && hoveredIndex !== maxIdx && hoveredIndex !== minIdx && (
            <>
              <circle
                cx={points[hoveredIndex].x}
                cy={points[hoveredIndex].y}
                r="6"
                fill={color}
                opacity="0.15"
              />
              <circle
                cx={points[hoveredIndex].x}
                cy={points[hoveredIndex].y}
                r="3.5"
                fill={color}
                stroke="var(--color-bg-card)"
                strokeWidth="1.5"
              />
            </>
          )}
        </svg>

        {/* Hover zones */}
        <div className="absolute inset-0 flex">
          {dados.map((_, i) => (
            <div
              key={i}
              className="flex-1 cursor-crosshair"
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
            />
          ))}
        </div>
      </div>

      {/* X-axis */}
      <div className="flex justify-between mt-2 px-1">
        {dados.filter((_, i) => i % Math.ceil(dados.length / 6) === 0 || i === dados.length - 1).map((d) => (
          <span key={d.data} className="text-[10px] text-text-muted tabular-nums">
            {new Date(d.data).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── platform breakdown ───────────────────────────────────────────────────────

function PlatformBreakdown({ redes }: { redes: Record<string, { conectado: boolean; username: string }> }) {
  const mockStats: Record<string, { engajamento: number; seguidores: number }> = {
    instagram: { engajamento: 5.4, seguidores: 12400 },
    facebook:  { engajamento: 2.1, seguidores: 8700 },
    linkedin:  { engajamento: 6.8, seguidores: 5300 },
    twitter:   { engajamento: 3.3, seguidores: 4100 },
    youtube:   { engajamento: 7.2, seguidores: 3200 },
    tiktok:    { engajamento: 9.1, seguidores: 18900 },
  };

  const connected = Object.entries(redes).filter(([, v]) => v.conectado);
  if (connected.length === 0) {
    return <p className="text-text-muted text-sm text-center py-6">Nenhuma plataforma conectada.</p>;
  }

  const maxEng = Math.max(...connected.map(([k]) => mockStats[k]?.engajamento ?? 0), 1);

  return (
    <div className="space-y-3.5">
      {connected.map(([rede]) => {
        const color = getPlataformaCor(rede);
        const label = getPlataformaLabel(rede);
        const stats = mockStats[rede] ?? { engajamento: 3.0, seguidores: 1000 };
        const barWidth = (stats.engajamento / maxEng) * 100;

        return (
          <div key={rede} className="flex items-center gap-3">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${color}18` }}
            >
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-text-primary font-medium">{label}</span>
                <span className="text-xs font-semibold tabular-nums" style={{ color }}>
                  {stats.engajamento.toFixed(1)}%
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-bg-elevated overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${barWidth}%`,
                    background: `linear-gradient(90deg, ${color}, ${color}99)`,
                  }}
                />
              </div>
            </div>
            <span className="text-xs text-text-secondary tabular-nums shrink-0 w-14 text-right">
              {formatNumber(stats.seguidores)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── best posts ──────────────────────────────────────────────────────────────

function BestPosts({ posts }: { posts: Post[] }) {
  const sorted = useMemo(
    () => [...posts]
      .filter((p) => p.metricas !== null)
      .sort((a, b) => (b.metricas?.impressoes ?? 0) - (a.metricas?.impressoes ?? 0)),
    [posts]
  );

  if (sorted.length === 0) {
    return <p className="text-text-muted text-sm text-center py-6">Nenhum post publicado com métricas.</p>;
  }

  return (
    <div>
      <div className="grid grid-cols-[1fr_80px_70px_70px_80px] gap-2 px-3 pb-2.5">
        <span className="text-[11px] font-medium uppercase tracking-wide text-text-muted">Título</span>
        <span className="text-[11px] font-medium uppercase tracking-wide text-text-muted text-right">Impressões</span>
        <span className="text-[11px] font-medium uppercase tracking-wide text-text-muted text-right hidden sm:block">Curtidas</span>
        <span className="text-[11px] font-medium uppercase tracking-wide text-text-muted text-right hidden sm:block">Coment.</span>
        <span className="text-[11px] font-medium uppercase tracking-wide text-text-muted text-right hidden md:block">Compart.</span>
      </div>
      <div className="divide-y divide-border-subtle">
        {sorted.map((post) => {
          const m = post.metricas!;
          return (
            <div
              key={post.id}
              className="grid grid-cols-[1fr_80px_70px_70px_80px] gap-2 px-3 py-3 items-center hover:bg-bg-card-hover transition-colors rounded"
            >
              <span className="text-sm text-text-primary truncate font-medium">{post.titulo}</span>
              <span className="text-xs text-text-primary tabular-nums text-right font-semibold">
                {formatNumber(m.impressoes)}
              </span>
              <div className="hidden sm:flex items-center justify-end gap-1.5 text-xs text-text-secondary tabular-nums">
                <Heart size={11} className="text-danger" />
                {formatNumber(m.curtidas)}
              </div>
              <div className="hidden sm:flex items-center justify-end gap-1.5 text-xs text-text-secondary tabular-nums">
                <MessageCircle size={11} className="text-info" />
                {formatNumber(m.comentarios)}
              </div>
              <div className="hidden md:flex items-center justify-end gap-1.5 text-xs text-text-secondary tabular-nums">
                <Share2 size={11} className="text-success" />
                {formatNumber(m.compartilhamentos)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── main page ────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const { empresa } = useEmpresa();

  const analytics = useMemo(
    () => (empresa ? getAnalyticsMock(empresa.id) : null),
    [empresa]
  );

  const dados30 = useMemo(() => analytics?.dados_diarios ?? [], [analytics]);

  if (!empresa || !analytics) {
    return (
      <div className="flex items-center justify-center h-64 text-text-secondary text-sm">
        Nenhuma empresa selecionada.
      </div>
    );
  }

  const totalInteracoes = dados30.reduce((a, b) => a + b.interacoes, 0);
  const ultimoSeguidores = dados30[dados30.length - 1]?.seguidores_total ?? 0;

  return (
    <div className="fade-in space-y-6 p-6 max-w-7xl mx-auto">

      {/* Page Header */}
      <div className="page-header">
        <h1>Analytics</h1>
        <p>{empresa.nome} &middot; Últimos 30 dias</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          icon={<Eye size={18} />}
          label="Total de Impressões"
          value={formatNumber(analytics.total_impressoes)}
          color="var(--color-accent)"
          change="+18.2%"
          changePositive={true}
        />
        <StatCard
          icon={<TrendingUp size={18} />}
          label="Taxa de Engajamento"
          value={analytics.taxa_engajamento.toFixed(1)}
          suffix="%"
          color="var(--color-success)"
          change="+2.4%"
          changePositive={true}
        />
        <StatCard
          icon={<Users size={18} />}
          label="Total de Seguidores"
          value={formatNumber(ultimoSeguidores)}
          color="var(--color-info)"
          change={`+${analytics.crescimento_seguidores.toFixed(1)}%`}
          changePositive={true}
        />
        <StatCard
          icon={<MousePointerClick size={18} />}
          label="Total de Interações"
          value={formatNumber(totalInteracoes)}
          color="var(--color-warning)"
          change="+12.7%"
          changePositive={true}
        />
      </div>

      {/* 4 Charts in 2x2 grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <AreaChart
          dados={dados30}
          dataKey="impressoes"
          color="#6c5ce7"
          colorEnd="#a29bfe"
          label="Impressões Diárias"
          sublabel="Visualizações totais por dia"
          currentValue={formatNumber(analytics.total_impressoes)}
        />
        <AreaChart
          dados={dados30}
          dataKey="seguidores_total"
          color="#3b82f6"
          colorEnd="#60a5fa"
          label="Crescimento de Seguidores"
          sublabel="Total acumulado"
          currentValue={formatNumber(ultimoSeguidores)}
        />
        <AreaChart
          dados={dados30}
          dataKey="engajamento"
          color="#34d399"
          colorEnd="#6ee7b7"
          label="Taxa de Engajamento"
          sublabel="Percentual diário"
          currentValue={`${analytics.taxa_engajamento.toFixed(1)}%`}
          formatValue={(v) => `${v.toFixed(1)}%`}
        />
        <AreaChart
          dados={dados30}
          dataKey="interacoes"
          color="#fbbf24"
          colorEnd="#fcd34d"
          label="Interações por Dia"
          sublabel="Curtidas, comentários e compartilhamentos"
          currentValue={formatNumber(totalInteracoes)}
        />
      </div>

      {/* Platform breakdown + Best posts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="bg-bg-card border border-border rounded-xl p-5 hover:border-border-light transition-colors">
          <h3 className="text-sm font-semibold text-text-primary mb-4">Por plataforma</h3>
          <PlatformBreakdown redes={empresa.redes_sociais as Record<string, { conectado: boolean; username: string }>} />
        </div>
        <div className="lg:col-span-2 bg-bg-card border border-border rounded-xl p-5 hover:border-border-light transition-colors">
          <h3 className="text-sm font-semibold text-text-primary mb-4">Melhores posts</h3>
          <BestPosts posts={analytics.melhores_posts} />
        </div>
      </div>
    </div>
  );
}
