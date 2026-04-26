/**
 * Helpers de mapeamento do funil CRM → modelo padronizado FunnelStage.
 * Os nomes de stage no CRM são verbosos e podem variar; este módulo
 * os normaliza para chaves estáveis usadas por todo o sistema de atribuição.
 */

import type { FunnelStage, FunnelEndToEndStage } from "@/types/attribution";

/* ── Labels PT-BR ────────────────────────────────────────────────── */

/**
 * Labels PT-BR canônicas para cada FunnelStage padronizada.
 * Usadas pelos componentes de UI (Sankey, tabelas, tooltips).
 */
export const FUNNEL_STAGE_LABELS: Record<FunnelStage, string> = {
  lead: "Lead",
  contact_made: "Contato Feito",
  meeting_scheduled: "Reunião Agendada",
  meeting_held: "Reunião Realizada",
  proposal_sent: "Proposta Enviada",
  negotiation: "Negociação",
  won: "Ganho",
  lost: "Perdido",
};

/* ── CRM → FunnelStage map ───────────────────────────────────────── */

/**
 * Mapeamento de nomes de stage do CRM para FunnelStage padronizada.
 * Chaves normalizadas: lowercase, sem acentos, trim.
 * Variações e typos comuns do CRM estão mapeados explicitamente.
 */
const CRM_STAGE_MAP: Record<string, FunnelStage> = {
  // Lead / entrada
  lead: "lead",
  leads: "lead",
  novo: "lead",
  "novo lead": "lead",

  // Contato feito
  "contato feito": "contact_made",
  "contato realizado": "contact_made",
  "em contato": "contact_made",
  contactado: "contact_made",
  abordado: "contact_made",

  // Reunião agendada
  "marcar reuniao": "meeting_scheduled",
  "marcar reunião": "meeting_scheduled",
  "reuniao agendada": "meeting_scheduled",
  "reunião agendada": "meeting_scheduled",
  "agendar reuniao": "meeting_scheduled",
  "agendar reunião": "meeting_scheduled",
  agendado: "meeting_scheduled",

  // Reunião realizada / aconteceu
  "reuniao realizada": "meeting_held",
  "reunião realizada": "meeting_held",
  "reuniao feita": "meeting_held",
  "reunião feita": "meeting_held",
  "reuniao aconteceu": "meeting_held",
  "reuniao ocorreu": "meeting_held",
  "apresentacao feita": "meeting_held",
  "apresentação feita": "meeting_held",

  // Proposta
  "proposta enviada": "proposal_sent",
  "proposta feita": "proposal_sent",
  "proposta emitida": "proposal_sent",
  proposta: "proposal_sent",

  // Negociação
  negociacao: "negotiation",
  negociação: "negotiation",
  "em negociacao": "negotiation",
  "em negociação": "negotiation",
  negociando: "negotiation",
  "proposta aceita": "negotiation",

  // Won
  ganho: "won",
  won: "won",
  fechado: "won",
  "cliente fechado": "won",
  convertido: "won",
  fechou: "won",
  "deal ganho": "won",

  // Lost
  perdido: "lost",
  lost: "lost",
  "nao fechou": "lost",
  "nao converteu": "lost",
  descartado: "lost",
  cancelado: "lost",
  "deal perdido": "lost",
};

/* ── Normalize helper (interno) ──────────────────────────────────── */

function normalizeLabel(label: string): string {
  return label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/* ── normalizeFunnelStage ────────────────────────────────────────── */

/**
 * Mapeia um label de stage do CRM para FunnelStage padronizada.
 * Aplica normalização de acentos e case antes da lookup.
 * Fallback: "lead" para stages não reconhecidas.
 *
 * @example
 * normalizeFunnelStage("Contato Feito")   // → "contact_made"
 * normalizeFunnelStage("Marcar Reunião")  // → "meeting_scheduled"
 * normalizeFunnelStage("Ganho")           // → "won"
 */
export function normalizeFunnelStage(crmStageName: string): FunnelStage {
  const key = normalizeLabel(crmStageName);
  return CRM_STAGE_MAP[key] ?? "lead";
}

/* ── buildEndToEndFunnel ─────────────────────────────────────────── */

/**
 * Constrói o array `FunnelEndToEndStage[]` a partir dos stages brutos do CRM.
 * - Normaliza cada stage para `FunnelStage`
 * - Agrega contagens de stages que mapeiam para o mesmo destino
 * - Calcula `conversionFromPrev` e `conversionFromTop`
 * - Retorna na ordem canônica do funil (excluindo "lost" do fluxo principal)
 *
 * @param crmStages - Array de stages do CRM com name, count e revenue opcional
 * @returns Array ordenado de FunnelEndToEndStage
 */
export function buildEndToEndFunnel(
  crmStages: Array<{ name: string; count: number; revenue?: number }>
): FunnelEndToEndStage[] {
  // Ordem canônica do funil (lost fica separado — não entra no fluxo)
  const ORDERED_STAGES: FunnelStage[] = [
    "lead",
    "contact_made",
    "meeting_scheduled",
    "meeting_held",
    "proposal_sent",
    "negotiation",
    "won",
    "lost",
  ];

  // Agrega contagens por FunnelStage (múltiplos CRM stages podem mapear para o mesmo)
  const aggregated = new Map<FunnelStage, { count: number; revenue: number }>();

  for (const s of crmStages) {
    const stage = normalizeFunnelStage(s.name);
    const existing = aggregated.get(stage) ?? { count: 0, revenue: 0 };
    aggregated.set(stage, {
      count: existing.count + s.count,
      revenue: existing.revenue + (s.revenue ?? 0),
    });
  }

  // Monta o resultado na ordem canônica
  const result: FunnelEndToEndStage[] = [];
  const topCount =
    aggregated.get("lead")?.count ??
    // Se não tem "lead", usa o maior count como top
    Math.max(...Array.from(aggregated.values()).map((v) => v.count), 1);

  let prevCount: number | null = null;

  for (const stage of ORDERED_STAGES) {
    const data = aggregated.get(stage);
    if (!data) continue;

    const entry: FunnelEndToEndStage = {
      stage,
      label: FUNNEL_STAGE_LABELS[stage],
      count: data.count,
    };

    // valueSum apenas para "won"
    if (stage === "won" && data.revenue > 0) {
      entry.valueSum = data.revenue;
    }

    // Conversão em relação ao anterior
    if (prevCount !== null && prevCount > 0) {
      entry.conversionFromPrev = data.count / prevCount;
    }

    // Conversão em relação ao topo
    if (topCount > 0 && stage !== "lead") {
      entry.conversionFromTop = data.count / topCount;
    }

    result.push(entry);
    prevCount = data.count;
  }

  return result;
}
