/**
 * Geração de insights estratégicos cruzados para o painel de atribuição.
 * Consome AttributionData (sem `insights`) e retorna até 6 StrategicInsight
 * ordenados por severidade: critical → warning → positive → neutral.
 */

import type { AttributionData } from "@/types/attribution";
import type { StrategicInsight } from "@/types/analytics";

/* ── Severity order ──────────────────────────────────────────────── */

const SEVERITY_ORDER: Record<StrategicInsight["severity"], number> = {
  critical: 0,
  warning: 1,
  positive: 2,
  neutral: 3,
};

/* ── computeAttributionInsights ─────────────────────────────────── */

/**
 * Gera até 6 insights estratégicos cruzando dados de atribuição.
 *
 * Regras avaliadas (em ordem de prioridade de severidade):
 * 1. Campanha estrela      — ROAS > 3 → positive
 * 2. Campanha negativa     — ROAS < 1 → critical
 * 3. Canal vencedor        — maior conversionRate → positive
 * 4. Funil afunilando      — lead→meeting_scheduled < 20% → warning
 * 5. Tempo de ciclo longo  — avgLeadToWon_days > 30 → warning
 * 6. Match rate baixo      — matchRate < 40% → warning
 *
 * @param data - AttributionData sem o campo `insights`
 * @returns Array de StrategicInsight ordenado por severidade, máx 6
 */
export function computeAttributionInsights(
  data: Omit<AttributionData, "insights">
): StrategicInsight[] {
  const insights: StrategicInsight[] = [];

  /* 1. Campanha estrela (ROAS > 3) ─────────────────────────────── */
  const starCampaign = data.campaignAttribution
    .filter((c) => c.roas !== null && c.roas > 3 && c.matched)
    .sort((a, b) => (b.roas ?? 0) - (a.roas ?? 0))[0];

  if (starCampaign) {
    insights.push({
      id: "attribution-star-campaign",
      category: "growth",
      severity: "positive",
      title: "Campanha estrela identificada",
      description: `"${starCampaign.campaignName}" tem ROAS de ${starCampaign.roas?.toFixed(1)}x — cada R$1 investido gerou R$${starCampaign.roas?.toFixed(2)} em receita.`,
      metric: `ROAS ${starCampaign.roas?.toFixed(1)}x`,
      actionable:
        "Considere aumentar o orçamento desta campanha para capturar mais leads de alto valor.",
    });
  }

  /* 2. Campanha negativa (ROAS < 1) ───────────────────────────── */
  const worstCampaign = data.campaignAttribution
    .filter((c) => c.roas !== null && c.roas < 1 && c.spend > 0 && c.matched)
    .sort((a, b) => (a.roas ?? 0) - (b.roas ?? 0))[0];

  if (worstCampaign) {
    insights.push({
      id: "attribution-negative-campaign",
      category: "growth",
      severity: "critical",
      title: "Campanha com ROAS negativo",
      description: `"${worstCampaign.campaignName}" tem ROAS de ${worstCampaign.roas?.toFixed(2)}x — gasto de R$${worstCampaign.spend.toFixed(0)} gerou apenas R$${worstCampaign.crmRevenue.toFixed(0)} em receita.`,
      metric: `ROAS ${worstCampaign.roas?.toFixed(2)}x`,
      actionable:
        "Pausar ou reformular esta campanha pode liberar orçamento para canais com melhor performance.",
    });
  }

  /* 3. Canal vencedor (maior conversionRate) ───────────────────── */
  const topChannel = data.channelROI
    .filter((c) => c.leads >= 3) // mínimo 3 leads para ser relevante
    .sort((a, b) => b.conversionRate - a.conversionRate)[0];

  if (topChannel) {
    const pct = (topChannel.conversionRate * 100).toFixed(1);
    insights.push({
      id: "attribution-top-channel",
      category: "growth",
      severity: "positive",
      title: "Canal com maior taxa de conversão",
      description: `"${topChannel.source}" converte ${pct}% dos leads em clientes${topChannel.spend ? ` com CAC de R$${topChannel.cac?.toFixed(0)}` : " (canal orgânico)"}.`,
      metric: `${pct}% conversão`,
      actionable:
        "Priorize esse canal nas próximas campanhas para maximizar o retorno sobre leads.",
    });
  }

  /* 4. Funil afunilando (lead→meeting_scheduled < 20%) ─────────── */
  const leadStage = data.funnelEndToEnd.find((s) => s.stage === "lead");
  const meetingStage = data.funnelEndToEnd.find(
    (s) => s.stage === "meeting_scheduled"
  );

  if (leadStage && meetingStage && leadStage.count > 0) {
    const meetingRate = meetingStage.count / leadStage.count;
    if (meetingRate < 0.2) {
      const pct = (meetingRate * 100).toFixed(1);
      insights.push({
        id: "attribution-funnel-bottleneck",
        category: "growth",
        severity: "warning",
        title: "Gargalo no funil: poucos leads chegam à reunião",
        description: `Apenas ${pct}% dos leads (${meetingStage.count} de ${leadStage.count}) avançam para reunião agendada — abaixo dos 20% recomendados.`,
        metric: `${pct}% lead→reunião`,
        actionable:
          "Revise o script de abordagem e os critérios de qualificação de leads para melhorar a conversão nesta etapa.",
      });
    }
  }

  /* 5. Tempo de ciclo longo (avgLeadToWon_days > 30) ──────────── */
  if (data.totals.avgLeadToWon_days > 30) {
    insights.push({
      id: "attribution-long-cycle",
      category: "growth",
      severity: "warning",
      title: "Ciclo de vendas acima do ideal",
      description: `O tempo médio de lead a fechamento é de ${Math.round(data.totals.avgLeadToWon_days)} dias — ciclos acima de 30 dias indicam gargalos no processo comercial.`,
      metric: `${Math.round(data.totals.avgLeadToWon_days)} dias médios`,
      actionable:
        "Identifique em qual etapa os deals ficam parados e implemente SLAs por estágio do funil.",
    });
  }

  /* 6. Match rate baixo (< 40%) ───────────────────────────────── */
  if (data.totals.matchRate < 0.4) {
    const pct = (data.totals.matchRate * 100).toFixed(0);
    insights.push({
      id: "attribution-low-match-rate",
      category: "anomaly",
      severity: "warning",
      title: "Atribuição incompleta: match rate baixo",
      description: `Apenas ${pct}% das campanhas Meta foram vinculadas a leads do CRM. Isso dificulta medir o real retorno dos anúncios.`,
      metric: `${pct}% match rate`,
      actionable:
        "Verifique se os UTMs das campanhas Meta estão configurados e sendo capturados corretamente no CRM.",
    });
  }

  /* Ordenação e limite ─────────────────────────────────────────── */
  return insights
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
    .slice(0, 6);
}
