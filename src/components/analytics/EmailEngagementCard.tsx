"use client";

import { Mail } from "lucide-react";
import { motion } from "motion/react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from "recharts";
import type { CrmAdvanced } from "@/types/analytics";

interface EmailEngagementCardProps {
  email: CrmAdvanced["email"];
}

interface TooltipPayload {
  name: string;
  value: number;
  fill: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-bg-card border border-border rounded-lg p-2.5 shadow-lg text-[11px]">
      <p className="font-medium text-text-primary mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.fill }}>
          {p.value.toFixed(2)}%
        </p>
      ))}
    </div>
  );
}

export function EmailEngagementCard({ email }: EmailEngagementCardProps) {
  if (
    email.campaigns === 0 &&
    email.sent === 0 &&
    email.openRate === 0
  ) {
    return (
      <div className="bg-bg-card border border-border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-1">
          <Mail size={16} className="text-accent" />
          <h3 className="text-[14px] font-semibold text-text-primary">Email Marketing</h3>
        </div>
        <div className="flex items-center justify-center h-36 text-[13px] text-text-muted">
          Nenhum dado de email no período.
        </div>
      </div>
    );
  }

  const rateData = [
    { name: "Abertura", value: email.openRate,  fill: "#22c55e" },
    { name: "Clique",   value: email.clickRate,  fill: "#3b82f6" },
    { name: "Bounce",   value: email.bounceRate, fill: "#ef4444" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="bg-bg-card border border-border rounded-xl p-5 flex flex-col gap-4"
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
          <Mail size={16} className="text-accent" />
        </div>
        <div>
          <h3 className="text-[14px] font-semibold text-text-primary leading-none">Email Marketing</h3>
          <p className="text-[11px] text-text-muted mt-0.5">Campanhas e engajamento</p>
        </div>
      </div>

      {/* Stats linha */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-bg-elevated rounded-lg p-3 text-center">
          <p className="text-[20px] font-bold text-text-primary tabular-nums leading-none">
            {email.campaigns}
          </p>
          <p className="text-[10px] text-text-muted mt-1">Campanhas</p>
        </div>
        <div className="bg-bg-elevated rounded-lg p-3 text-center">
          <p className="text-[20px] font-bold text-text-primary tabular-nums leading-none">
            {email.sent.toLocaleString("pt-BR")}
          </p>
          <p className="text-[10px] text-text-muted mt-1">Enviados</p>
        </div>
        <div className="bg-bg-elevated rounded-lg p-3 text-center">
          <p className="text-[20px] font-bold text-success tabular-nums leading-none">
            {email.openRate.toFixed(1)}%
          </p>
          <p className="text-[10px] text-text-muted mt-1">Abertura</p>
        </div>
      </div>

      {/* Bar chart: Open / Click / Bounce */}
      <div>
        <p className="text-[11px] text-text-muted mb-2">Open · Click · Bounce (%)</p>
        <div className="h-[120px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rateData} barSize={28} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10, fill: "var(--color-text-muted)" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "var(--color-text-muted)" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => `${v}%`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {rateData.map((entry, idx) => (
                  <Cell key={idx} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </motion.div>
  );
}
