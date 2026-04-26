"use client";

import { MessageCircle, ArrowRight } from "lucide-react";
import { motion } from "motion/react";
import type { CrmAdvanced } from "@/types/analytics";

interface WhatsAppEngagementCardProps {
  whatsapp: CrmAdvanced["whatsapp"];
}

interface FunnelStepProps {
  label: string;
  count: number;
  rate?: string;
  rateLabel?: string;
  color: string;
  isLast?: boolean;
}

function FunnelStep({ label, count, rate, rateLabel, color, isLast = false }: FunnelStepProps) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex flex-col items-center gap-1 flex-1">
        <div
          className="w-full rounded-lg p-3 text-center"
          style={{ backgroundColor: color + "12", borderColor: color + "30", borderWidth: 1 }}
        >
          <p className="text-[20px] font-bold tabular-nums leading-none" style={{ color }}>
            {count.toLocaleString("pt-BR")}
          </p>
          <p className="text-[10px] text-text-muted mt-1">{label}</p>
          {rate && (
            <p className="text-[10px] font-semibold mt-0.5" style={{ color }}>
              {rate} {rateLabel}
            </p>
          )}
        </div>
      </div>
      {!isLast && <ArrowRight size={12} className="text-text-muted/40 shrink-0" />}
    </div>
  );
}

export function WhatsAppEngagementCard({ whatsapp }: WhatsAppEngagementCardProps) {
  if (whatsapp.sent === 0 && whatsapp.delivered === 0) {
    return (
      <div className="bg-bg-card border border-border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-1">
          <MessageCircle size={16} style={{ color: "#25D366" }} />
          <h3 className="text-[14px] font-semibold text-text-primary">WhatsApp</h3>
        </div>
        <div className="flex items-center justify-center h-36 text-[13px] text-text-muted">
          Nenhum dado de WhatsApp no período.
        </div>
      </div>
    );
  }

  const WA_GREEN = "#25D366";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.05 }}
      className="bg-bg-card border border-border rounded-xl p-5 flex flex-col gap-4"
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: WA_GREEN + "20" }}
        >
          <MessageCircle size={16} style={{ color: WA_GREEN }} />
        </div>
        <div>
          <h3 className="text-[14px] font-semibold text-text-primary leading-none">WhatsApp</h3>
          <p className="text-[11px] text-text-muted mt-0.5">Cadências e engajamento</p>
        </div>
      </div>

      {/* Mini-funil */}
      <div className="flex items-center gap-1">
        <FunnelStep
          label="Enviados"
          count={whatsapp.sent}
          color="#6366f1"
        />
        <FunnelStep
          label="Entregues"
          count={whatsapp.delivered}
          rate={`${whatsapp.deliveryRate.toFixed(1)}%`}
          rateLabel="entrega"
          color={WA_GREEN}
        />
        <FunnelStep
          label="Respostas"
          count={whatsapp.replies}
          rate={`${whatsapp.replyRate.toFixed(1)}%`}
          rateLabel="resposta"
          color="#f59e0b"
        />
        <FunnelStep
          label="Conversões"
          count={whatsapp.conversions}
          color="#22c55e"
          isLast
        />
      </div>

      {/* Conversões em destaque */}
      {whatsapp.conversions > 0 && (
        <div className="bg-success/8 border border-success/20 rounded-lg px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-[12px] font-semibold text-success">Conversões via WhatsApp</p>
            <p className="text-[11px] text-text-muted mt-0.5">Leads convertidos pelas cadências</p>
          </div>
          <p className="text-[28px] font-bold text-success tabular-nums">
            {whatsapp.conversions.toLocaleString("pt-BR")}
          </p>
        </div>
      )}

      {/* Rates resumo */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-bg-elevated rounded-lg p-3">
          <p className="text-[11px] text-text-muted">Taxa de Entrega</p>
          <p className="text-[18px] font-bold text-text-primary tabular-nums">
            {whatsapp.deliveryRate.toFixed(1)}%
          </p>
        </div>
        <div className="bg-bg-elevated rounded-lg p-3">
          <p className="text-[11px] text-text-muted">Taxa de Resposta</p>
          <p className="text-[18px] font-bold text-text-primary tabular-nums">
            {whatsapp.replyRate.toFixed(1)}%
          </p>
        </div>
      </div>
    </motion.div>
  );
}
