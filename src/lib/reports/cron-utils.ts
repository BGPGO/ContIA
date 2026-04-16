/**
 * Utilitários de cron para relatórios agendados.
 * Suporta frequências: semanal, mensal, trimestral.
 * Sem deps externas (cronstrue/cron-parser) — lógica simples baseada no padrão.
 */

/* ── Frequência legível ─────────────────────────────────────── */

export type CronFrequency = "weekly" | "monthly" | "quarterly";

/** Presets de cron para o modal de agendamento */
export const CRON_PRESETS: Record<CronFrequency, { cron: string; label: string }> = {
  weekly: { cron: "0 9 * * 1", label: "Toda segunda-feira às 9h" },
  monthly: { cron: "0 9 1 * *", label: "Todo dia 1º do mês às 9h" },
  quarterly: { cron: "0 9 1 1,4,7,10 *", label: "Início de cada trimestre às 9h" },
};

/** Gera cron semanal para um dia da semana (0=dom, 1=seg, ...) */
export function weeklyOnDay(dayOfWeek: number, hour = 9): string {
  return `0 ${hour} * * ${dayOfWeek}`;
}

/** Gera cron mensal para um dia do mês */
export function monthlyOnDay(dayOfMonth: number, hour = 9): string {
  return `0 ${hour} ${dayOfMonth} * *`;
}

/* ── Próxima execução ───────────────────────────────────────── */

/**
 * Calcula a próxima data de execução de um cron.
 * Implementação simplificada para os padrões usados na plataforma.
 * Para crons complexos, retorna null (use uma biblioteca adequada em produção).
 */
export function computeNextRunAt(cron: string): Date | null {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return null;

  const [minutePart, hourPart, domPart, monthPart, dowPart] = parts;
  const minute = parseInt(minutePart, 10);
  const hour = parseInt(hourPart, 10);

  const now = new Date();
  const next = new Date();
  next.setSeconds(0, 0);
  next.setMinutes(isNaN(minute) ? 0 : minute);
  next.setHours(isNaN(hour) ? 9 : hour);

  // Monthly: "0 9 1 * *"
  if (domPart !== "*" && monthPart === "*" && dowPart === "*") {
    const dom = parseInt(domPart, 10);
    next.setDate(dom);
    if (next <= now) {
      // Move to next month
      next.setMonth(next.getMonth() + 1);
    }
    return next;
  }

  // Quarterly: "0 9 1 1,4,7,10 *"
  if (domPart !== "*" && monthPart.includes(",")) {
    const dom = parseInt(domPart, 10);
    const months = monthPart.split(",").map((m) => parseInt(m, 10) - 1); // 0-indexed
    const currentMonth = now.getMonth();
    const found = months.find((m) => m > currentMonth || (m === currentMonth && next >= now));
    if (found !== undefined) {
      next.setMonth(found);
      next.setDate(dom);
    } else {
      // next year, first quarter month
      next.setFullYear(next.getFullYear() + 1);
      next.setMonth(months[0]);
      next.setDate(dom);
    }
    return next;
  }

  // Weekly: "0 9 * * 1"
  if (domPart === "*" && monthPart === "*" && dowPart !== "*") {
    const dow = parseInt(dowPart, 10);
    const currentDow = now.getDay();
    let daysUntil = (dow - currentDow + 7) % 7;
    if (daysUntil === 0 && next <= now) daysUntil = 7;
    next.setDate(now.getDate() + daysUntil);
    return next;
  }

  return null;
}

/* ── Período do relatório baseado no cron ───────────────────── */

export interface ReportPeriod {
  periodStart: Date;
  periodEnd: Date;
  previousStart: Date;
  previousEnd: Date;
}

/**
 * Calcula o período de dados para um relatório baseado no padrão do cron.
 */
export function periodFromCron(cron: string): ReportPeriod {
  const parts = cron.trim().split(/\s+/);
  const [, , domPart, monthPart, dowPart] = parts;
  const now = new Date();

  // Weekly: look back 7 days
  if (domPart === "*" && monthPart === "*" && dowPart !== "*") {
    const periodEnd = new Date(now);
    periodEnd.setHours(23, 59, 59, 999);
    periodEnd.setDate(periodEnd.getDate() - 1);

    const periodStart = new Date(periodEnd);
    periodStart.setDate(periodStart.getDate() - 6);
    periodStart.setHours(0, 0, 0, 0);

    const previousEnd = new Date(periodStart);
    previousEnd.setDate(previousEnd.getDate() - 1);
    previousEnd.setHours(23, 59, 59, 999);

    const previousStart = new Date(previousEnd);
    previousStart.setDate(previousStart.getDate() - 6);
    previousStart.setHours(0, 0, 0, 0);

    return { periodStart, periodEnd, previousStart, previousEnd };
  }

  // Quarterly
  if (domPart !== "*" && monthPart.includes(",")) {
    const quarter = Math.floor(now.getMonth() / 3);
    const periodStart = new Date(now.getFullYear(), quarter * 3, 1, 0, 0, 0, 0);
    const periodEnd = new Date(now.getFullYear(), quarter * 3 + 3, 0, 23, 59, 59, 999);

    const prevQuarter = quarter - 1;
    const prevYear = prevQuarter < 0 ? now.getFullYear() - 1 : now.getFullYear();
    const prevQ = (prevQuarter + 4) % 4;
    const previousStart = new Date(prevYear, prevQ * 3, 1, 0, 0, 0, 0);
    const previousEnd = new Date(prevYear, prevQ * 3 + 3, 0, 23, 59, 59, 999);

    return { periodStart, periodEnd, previousStart, previousEnd };
  }

  // Monthly (default)
  const periodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
  const periodEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
  const previousStart = new Date(now.getFullYear(), now.getMonth() - 2, 1, 0, 0, 0, 0);
  const previousEnd = new Date(now.getFullYear(), now.getMonth() - 1, 0, 23, 59, 59, 999);

  return { periodStart, periodEnd, previousStart, previousEnd };
}

/* ── Human-readable label ───────────────────────────────────── */

export function cronToLabel(cron: string): string {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return cron;

  const [minutePart, hourPart, domPart, monthPart, dowPart] = parts;
  const hour = parseInt(hourPart, 10);
  const minute = parseInt(minutePart, 10);
  const timeLabel = `${String(hour).padStart(2, "0")}h${minute > 0 ? String(minute).padStart(2, "0") : ""}`;

  const DOW_LABELS = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];

  if (domPart === "*" && monthPart === "*" && dowPart !== "*") {
    const dow = parseInt(dowPart, 10);
    return `Toda ${DOW_LABELS[dow] ?? "semana"} às ${timeLabel}`;
  }

  if (domPart !== "*" && monthPart === "*" && dowPart === "*") {
    return `Todo dia ${domPart} do mês às ${timeLabel}`;
  }

  if (domPart !== "*" && monthPart.includes(",")) {
    return `Início de cada trimestre às ${timeLabel}`;
  }

  return cron;
}
