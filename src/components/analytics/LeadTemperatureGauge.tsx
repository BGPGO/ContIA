"use client";

import { motion } from "motion/react";
import { Flame, Sun, Snowflake } from "lucide-react";

interface LeadTemperatureGaugeProps {
  hot: number;
  warm: number;
  cold: number;
}

interface TempCardProps {
  index: number;
  icon: React.ReactNode;
  label: string;
  count: number;
  total: number;
  color: string;
  bgColor: string;
  borderColor: string;
}

function TempCard({
  index,
  icon,
  label,
  count,
  total,
  color,
  bgColor,
  borderColor,
}: TempCardProps) {
  const pct = total > 0 ? ((count / total) * 100).toFixed(1) : "0";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.08 }}
      className={`flex-1 rounded-xl p-4 border flex flex-col gap-3`}
      style={{ backgroundColor: bgColor, borderColor }}
    >
      {/* Ícone */}
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center"
        style={{ backgroundColor: color + "25" }}
      >
        {icon}
      </div>

      {/* Número */}
      <div>
        <p className="text-[28px] font-bold tabular-nums leading-none" style={{ color }}>
          {count.toLocaleString("pt-BR")}
        </p>
        <p className="text-[13px] font-semibold text-text-primary mt-0.5">{label}</p>
        <p className="text-[11px] text-text-muted mt-0.5">{pct}% do total</p>
      </div>

      {/* Barra */}
      <div className="h-1.5 bg-bg-elevated rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${total > 0 ? (count / total) * 100 : 0}%` }}
          transition={{ duration: 0.6, delay: index * 0.08 + 0.2, ease: "easeOut" }}
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
        />
      </div>
    </motion.div>
  );
}

export function LeadTemperatureGauge({ hot, warm, cold }: LeadTemperatureGaugeProps) {
  const total = hot + warm + cold;

  if (total === 0) {
    return (
      <div className="bg-bg-card border border-border rounded-xl p-5">
        <h3 className="text-[14px] font-semibold text-text-primary mb-1">Temperatura dos Leads</h3>
        <div className="flex items-center justify-center h-32 text-[13px] text-text-muted">
          Nenhum dado de temperatura no período.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-bg-card border border-border rounded-xl p-5">
      <h3 className="text-[14px] font-semibold text-text-primary mb-0.5">
        Temperatura dos Leads
      </h3>
      <p className="text-[12px] text-text-muted mb-4">
        {total.toLocaleString("pt-BR")} leads classificados no período
      </p>

      <div className="flex flex-col sm:flex-row gap-3">
        <TempCard
          index={0}
          icon={<Flame size={20} color="#ef4444" />}
          label="Quentes"
          count={hot}
          total={total}
          color="#ef4444"
          bgColor="#ef444408"
          borderColor="#ef444430"
        />
        <TempCard
          index={1}
          icon={<Sun size={20} color="#f59e0b" />}
          label="Mornos"
          count={warm}
          total={total}
          color="#f59e0b"
          bgColor="#f59e0b08"
          borderColor="#f59e0b30"
        />
        <TempCard
          index={2}
          icon={<Snowflake size={20} color="#3b82f6" />}
          label="Frios"
          count={cold}
          total={total}
          color="#3b82f6"
          bgColor="#3b82f608"
          borderColor="#3b82f630"
        />
      </div>
    </div>
  );
}
