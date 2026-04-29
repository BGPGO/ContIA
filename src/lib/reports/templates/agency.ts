/**
 * Template Agency — PDF do Relatório Agência ContIA (Wave 3, Squad F)
 *
 * Estrutura: Capa → Panorama → Instagram → Facebook → Meta Ads → Rodapé
 * Renderizado por Puppeteer em A4. HTML inline sem deps externas.
 */

import type { AgencyReportData, KpiValue, AgencyRecommendation } from "@/types/agency-report";
import type { AgencyReportAnalysis } from "@/lib/ai/agency-report-generator";

/* ── Helpers ─────────────────────────────────────────────────────────────── */

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatDateLong(iso: string): string {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/**
 * Formata um KpiValue para exibição.
 * Retorna "—" se value for null.
 */
export function formatKpi(kpi: KpiValue | null | undefined): string {
  if (!kpi || kpi.value === null) return "—";
  const v = kpi.value;
  const fmt = kpi.format ?? "integer";

  switch (fmt) {
    case "currency_brl":
      return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        maximumFractionDigits: 2,
      }).format(v);
    case "percent":
      return `${v.toFixed(1)}%`;
    case "decimal":
      return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(v);
    default:
      return new Intl.NumberFormat("pt-BR").format(Math.round(v));
  }
}

/**
 * Formata delta percentual com seta e cor.
 * Retorna objeto { text, color } para uso no template.
 */
export function formatDelta(kpi: KpiValue | null | undefined): {
  text: string;
  color: string;
  badge: string;
} {
  if (!kpi || kpi.deltaPercent === null) {
    return { text: "—", color: "#6b7280", badge: "badge-neutral" };
  }
  const pct = kpi.deltaPercent * 100;
  if (Math.abs(pct) < 0.1) {
    return { text: "—", color: "#6b7280", badge: "badge-neutral" };
  }
  if (pct > 0) {
    return {
      text: `↑ ${pct.toFixed(1)}%`,
      color: "#16a34a",
      badge: "badge-up",
    };
  }
  return {
    text: `↓ ${Math.abs(pct).toFixed(1)}%`,
    color: "#dc2626",
    badge: "badge-down",
  };
}

/* ── Componentes HTML ────────────────────────────────────────────────────── */

function kpiCard(
  label: string,
  kpi: KpiValue | null | undefined,
  primary: string,
  size: "large" | "medium" = "medium"
): string {
  const value = formatKpi(kpi);
  const { text: deltaText, color: deltaColor } = formatDelta(kpi);
  const prevVal =
    kpi?.previousValue !== null && kpi?.previousValue !== undefined
      ? formatKpi({ ...kpi, value: kpi.previousValue } as KpiValue)
      : null;

  const valueSize = size === "large" ? "32px" : "24px";
  const cardPad = size === "large" ? "20px 24px" : "14px 18px";

  return `
    <div class="kpi-card" style="padding:${cardPad}">
      <div class="kpi-label" style="font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#6b7280;margin-bottom:4px">${esc(label)}</div>
      <div class="kpi-value" style="font-size:${valueSize};font-weight:700;color:#111827;line-height:1.1">${esc(value)}</div>
      <div class="kpi-delta" style="margin-top:6px;display:flex;align-items:center;gap:6px">
        <span style="font-size:11px;font-weight:600;color:${deltaColor}">${esc(deltaText)}</span>
        ${prevVal ? `<span style="font-size:10px;font-style:italic;color:#9ca3af">ant: ${esc(prevVal)}</span>` : ""}
      </div>
    </div>`;
}

function networkRow(
  label: string,
  reach: KpiValue | null | undefined,
  engagement: KpiValue | null | undefined
): string {
  return `
    <tr>
      <td style="font-weight:600">${esc(label)}</td>
      <td>${esc(formatKpi(reach))}</td>
      <td style="color:${formatDelta(reach).color}">${esc(formatDelta(reach).text)}</td>
      <td>${esc(formatKpi(engagement))}</td>
      <td style="color:${formatDelta(engagement).color}">${esc(formatDelta(engagement).text)}</td>
    </tr>`;
}

function recommendationsList(recs: AgencyRecommendation[]): string {
  if (!recs || recs.length === 0) return "";
  const items = recs
    .map((r) => {
      const pColor =
        r.priority === "high"
          ? "#dc2626"
          : r.priority === "medium"
          ? "#d97706"
          : "#16a34a";
      const pLabel =
        r.priority === "high" ? "Alta" : r.priority === "medium" ? "Média" : "Baixa";
      return `
        <li style="margin-bottom:10px;display:flex;gap:10px;align-items:flex-start">
          <span style="display:inline-block;min-width:42px;padding:2px 6px;border-radius:4px;font-size:9px;font-weight:700;background:${pColor}22;color:${pColor};text-align:center;margin-top:2px">${esc(pLabel)}</span>
          <div>
            <div style="font-weight:600;font-size:12px;color:#111827">${esc(r.action)}</div>
            <div style="font-size:11px;color:#6b7280;margin-top:2px">${esc(r.rationale)}</div>
            ${r.estimatedImpact ? `<div style="font-size:10px;color:#2563eb;margin-top:2px">Impacto estimado: ${esc(r.estimatedImpact)}</div>` : ""}
          </div>
        </li>`;
    })
    .join("");
  return `<ul style="list-style:none;padding:0;margin:0">${items}</ul>`;
}

function sectionHeader(title: string, primary: string): string {
  return `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">
      <div style="width:4px;height:36px;background:${primary};border-radius:2px;flex-shrink:0"></div>
      <h2 style="font-size:22px;font-weight:700;color:#111827;margin:0">${esc(title)}</h2>
    </div>`;
}

function subsectionTitle(title: string): string {
  return `<h3 style="font-size:14px;font-weight:700;color:#374151;margin:20px 0 10px;text-transform:uppercase;letter-spacing:.04em">${esc(title)}</h3>`;
}

function tableHeader(...cols: string[]): string {
  return `<tr>${cols.map((c) => `<th>${esc(c)}</th>`).join("")}</tr>`;
}

/**
 * Gráfico de linha temporal genérico — reutilizado por Meta Ads, IG e FB.
 * @param data     pontos {date: string (ISO), value: number}
 * @param primary  cor primária da linha/área
 * @param title    título exibido acima do gráfico (opcional)
 * @param yUnit    legenda do eixo Y (ex: "R$", "#seguid.")
 * @param height   altura em px (padrão 150)
 */
function timelineSvg(
  data: Array<{ date: string; value: number }>,
  primary: string,
  title?: string,
  yUnit = "",
  height = 150
): string {
  if (!data || data.length < 2) return "";
  const W = 700;
  const H = height;
  const PAD = { top: title ? 26 : 10, right: 20, bottom: 30, left: 55 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const maxVal = Math.max(...data.map((d) => d.value), 1);
  const minVal = Math.min(...data.map((d) => d.value), 0);
  const range = maxVal - minVal || 1;

  const pts = data.map((d, i) => {
    const x = PAD.left + (i / (data.length - 1)) * innerW;
    const y = PAD.top + innerH - ((d.value - minVal) / range) * innerH;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const ptsFill = [
    `${PAD.left},${(PAD.top + innerH).toFixed(1)}`,
    ...pts,
    `${(PAD.left + innerW).toFixed(1)},${(PAD.top + innerH).toFixed(1)}`,
  ];

  // Grid lines (4 linhas horizontais)
  const gridLines = [0, 1, 2, 3, 4]
    .map((i) => {
      const y = PAD.top + (i / 4) * innerH;
      const val = Math.round(maxVal - (i / 4) * (maxVal - minVal));
      return `<line x1="${PAD.left}" y1="${y.toFixed(1)}" x2="${(PAD.left + innerW).toFixed(1)}" y2="${y.toFixed(1)}" stroke="#e5e7eb" stroke-width="0.5"/>
<text x="${(PAD.left - 5).toFixed(1)}" y="${(y + 3).toFixed(1)}" text-anchor="end" font-size="8" fill="#9ca3af">${new Intl.NumberFormat("pt-BR", { notation: "compact" }).format(val)}</text>`;
    })
    .join("");

  const step = Math.max(1, Math.ceil(data.length / 6));
  const labels = data
    .filter((_, i) => i === 0 || i === data.length - 1 || i % step === 0)
    .map((d) => {
      const origIdx = data.indexOf(d);
      const x = PAD.left + (origIdx / (data.length - 1)) * innerW;
      const y = PAD.top + innerH + 18;
      const label = d.date.slice(5); // MM-DD
      return `<text x="${x.toFixed(1)}" y="${y}" text-anchor="middle" font-size="9" fill="#9ca3af">${esc(label)}</text>`;
    })
    .join("");

  const yLabelSvg = yUnit
    ? `<text x="${(PAD.left - 8).toFixed(1)}" y="${(PAD.top + innerH / 2).toFixed(1)}" text-anchor="end" font-size="9" fill="#9ca3af" transform="rotate(-90,${(PAD.left - 8).toFixed(1)},${(PAD.top + innerH / 2).toFixed(1)})">${esc(yUnit)}</text>`
    : "";

  const titleSvg = title
    ? `<text x="${(W / 2).toFixed(1)}" y="14" text-anchor="middle" font-size="11" font-weight="600" fill="#374151">${esc(title)}</text>`
    : "";

  const dots = pts
    .map((p) => `<circle cx="${p.split(",")[0]}" cy="${p.split(",")[1]}" r="2.5" fill="${primary}" />`)
    .join("");

  return `
    <svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg" style="overflow:visible;width:100%;height:${H}px">
      ${titleSvg}
      ${gridLines}
      <polygon points="${ptsFill.join(" ")}" fill="${primary}22" />
      <polyline points="${pts.join(" ")}" fill="none" stroke="${primary}" stroke-width="2" stroke-linejoin="round" />
      ${dots}
      ${labels}
      ${yLabelSvg}
    </svg>`;
}

/** Alias de retrocompatibilidade — Meta Ads usa spendTimelineSvg */
function spendTimelineSvg(
  data: Array<{ date: string; value: number }>,
  primary: string
): string {
  return timelineSvg(data, primary, undefined, "R$", 120);
}

/* ── Heatmap de Melhor Horário IG ───────────────────────────────────────── */

function renderBestTimeHeatmap(
  bestTime: AgencyReportData["instagram"]["bestTime"],
  primary: string
): string {
  if (!bestTime || bestTime.length === 0) return "";

  // Agrupar por turno (4 turnos: 0-5, 6-11, 12-17, 18-23) × dia da semana (0=Dom..6=Sáb)
  const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const TURNS = ["00–05", "06–11", "12–17", "18–23"];

  // grid[dia][turno] = engagementAvg acumulado / count
  type Cell = { sum: number; count: number };
  const grid: Cell[][] = DAYS.map(() => TURNS.map(() => ({ sum: 0, count: 0 })));

  for (const point of bestTime) {
    const day = point.dayOfWeek % 7;
    const turn = Math.floor(point.hour / 6);
    if (turn < 4) {
      grid[day][turn].sum += point.engagementAvg;
      grid[day][turn].count += 1;
    }
  }

  const averages = grid.map((row) =>
    row.map((cell) => (cell.count > 0 ? cell.sum / cell.count : 0))
  );

  const allVals = averages.flat().filter((v) => v > 0);
  const maxVal = allVals.length > 0 ? Math.max(...allVals) : 1;

  const CELL_W = 56;
  const CELL_H = 22;
  const LABEL_W = 30;
  const LABEL_H = 18;
  const W = LABEL_W + DAYS.length * CELL_W + 4;
  const H = LABEL_H + TURNS.length * CELL_H + 4;

  // Cabeçalho dos dias
  const dayHeaders = DAYS.map(
    (d, i) =>
      `<text x="${(LABEL_W + i * CELL_W + CELL_W / 2).toFixed(1)}" y="${LABEL_H - 4}" text-anchor="middle" font-size="9" fill="#6b7280">${esc(d)}</text>`
  ).join("");

  // Células
  const cells = TURNS.map((turn, ti) => {
    const turnLabel = `<text x="${(LABEL_W - 4).toFixed(1)}" y="${(LABEL_H + ti * CELL_H + CELL_H / 2 + 3).toFixed(1)}" text-anchor="end" font-size="8" fill="#9ca3af">${esc(turn)}</text>`;

    const dayCells = DAYS.map((_, di) => {
      const avg = averages[di][ti];
      const intensity = maxVal > 0 ? avg / maxVal : 0;
      // interpolate white -> primary
      const alpha = (intensity * 0.85 + 0.05).toFixed(2);
      const x = LABEL_W + di * CELL_W;
      const y = LABEL_H + ti * CELL_H;
      const textVal =
        avg > 0
          ? avg >= 1000
            ? `${(avg / 1000).toFixed(1)}k`
            : avg.toFixed(0)
          : "";

      return `<rect x="${x}" y="${y}" width="${CELL_W - 2}" height="${CELL_H - 2}" rx="3" fill="${primary}" fill-opacity="${alpha}" stroke="#e5e7eb" stroke-width="0.5"/>
${textVal ? `<text x="${(x + CELL_W / 2).toFixed(1)}" y="${(y + CELL_H / 2 + 3).toFixed(1)}" text-anchor="middle" font-size="8" fill="${intensity > 0.5 ? "#fff" : "#374151"}">${esc(textVal)}</text>` : ""}`;
    }).join("");

    return turnLabel + dayCells;
  }).join("");

  return `
    <div style="margin-bottom:24px">
      <div style="font-size:9px;color:#6b7280;margin-bottom:6px">Engajamento médio por dia/turno</div>
      <svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg" style="overflow:visible">
        ${dayHeaders}
        ${cells}
      </svg>
    </div>`;
}

/* ── Cards de Stories Individuais ───────────────────────────────────────── */

function renderStoriesGrid(
  individuals: AgencyReportData["instagram"]["stories"]["individuals"],
  primary: string
): string {
  if (!individuals || individuals.length === 0) return "";

  // Top 12 por reach
  const sorted = [...individuals].sort((a, b) => b.reach - a.reach).slice(0, 12);
  const total = individuals.length;

  const fmt = (n: number) => new Intl.NumberFormat("pt-BR").format(n);

  const cards = sorted
    .map((s) => {
      const thumbnail = s.thumbnail
        ? `<img src="${esc(s.thumbnail)}" alt="story" style="width:100%;height:60px;object-fit:cover;border-radius:4px;margin-bottom:6px" />`
        : "";
      const date = formatDate(s.publishedAt);

      return `
        <div style="background:#fff;border:1px solid #e5e7eb;border-left:3px solid ${primary};border-radius:6px;padding:8px;font-size:10px">
          ${thumbnail}
          <div style="font-size:9px;color:#6b7280;margin-bottom:6px">${esc(date)}</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:3px 8px">
            <div><span style="color:#9ca3af">Views</span> <strong>${fmt(s.impressions)}</strong></div>
            <div><span style="color:#9ca3af">Alcance</span> <strong>${fmt(s.reach)}</strong></div>
            <div><span style="color:#9ca3af">Respostas</span> <strong>${fmt(s.replies)}</strong></div>
            <div><span style="color:#9ca3af">Saídas</span> <strong>${fmt(s.exits)}</strong></div>
            <div><span style="color:#9ca3af">Avançar</span> <strong>${fmt(s.tapsForward)}</strong></div>
            <div><span style="color:#9ca3af">Voltar</span> <strong>${fmt(s.tapsBack)}</strong></div>
            <div style="grid-column:span 2"><span style="color:#9ca3af">Próx. Story</span> <strong>${fmt(s.nextStory)}</strong></div>
          </div>
        </div>`;
    })
    .join("");

  return `
    <div style="margin-bottom:24px">
      <div style="font-size:9px;color:#6b7280;margin-bottom:8px">Total de ${total} stories no período — exibindo top ${sorted.length} por alcance</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">
        ${cards}
      </div>
    </div>`;
}

/* ── Seções ──────────────────────────────────────────────────────────────── */

function renderCover(data: AgencyReportData, primary: string): string {
  const logoHtml = data.meta.empresaNome
    ? `<div style="width:60px;height:60px;border-radius:50%;background:${primary};display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:800;color:#fff;margin:0 auto 16px">${esc(data.meta.empresaNome.charAt(0).toUpperCase())}</div>`
    : "";

  return `
    <div class="page cover-page" style="background:linear-gradient(160deg,#0f172a 0%,#1e293b 60%,${primary}33 100%);display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;min-height:297mm">
      ${logoHtml}
      <div style="font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:${primary};margin-bottom:12px;font-weight:600">GO Studio · Relatório Agência</div>
      <h1 style="font-size:44px;font-weight:800;color:#f8fafc;margin:0 0 12px;line-height:1.1">${esc(data.meta.empresaNome)}</h1>
      <div style="font-size:18px;color:#94a3b8;margin-bottom:32px">Análise de desempenho — Redes Sociais</div>
      <div style="display:inline-block;padding:10px 24px;border:1px solid ${primary};border-radius:8px;font-size:13px;color:#e2e8f0">
        ${esc(formatDateLong(data.meta.periodStart))} a ${esc(formatDateLong(data.meta.periodEnd))}
      </div>
      <div style="margin-top:12px;font-size:11px;color:#64748b">
        comparado com ${esc(formatDate(data.meta.previousStart))} a ${esc(formatDate(data.meta.previousEnd))}
      </div>
      <div style="position:absolute;bottom:40px;left:0;right:0;text-align:center;font-size:10px;color:#475569">
        Gerado em ${esc(new Date(data.meta.generatedAt).toLocaleDateString("pt-BR"))} · Fontes: Instagram Business, Facebook, Meta Ads
      </div>
    </div>`;
}

function renderPanorama(
  data: AgencyReportData,
  analysis: AgencyReportAnalysis,
  primary: string
): string {
  const p = data.panorama;
  const a = analysis.panorama;

  const kpiGrid = `
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px">
      ${kpiCard("Alcance Total", p.totalReach, primary, "large")}
      ${kpiCard("Engajamento Total", p.totalEngagement, primary, "large")}
      ${kpiCard("Investimento Total", p.totalSpend, primary, "large")}
      ${kpiCard("Leads Totais", p.totalLeads, primary, "large")}
    </div>`;

  const bullets = a.executiveBullets
    .map(
      (b) =>
        `<li style="margin-bottom:8px;display:flex;gap:8px;align-items:flex-start"><span style="color:${primary};font-size:16px;line-height:1.2">•</span><span style="font-size:12px;color:#374151">${esc(b)}</span></li>`
    )
    .join("");

  const networkRows = p.byNetwork
    .map((n) => networkRow(n.label, n.reach, n.engagement))
    .join("");

  return `
    <div class="page" style="page-break-before:always">
      ${sectionHeader("Sumário Executivo", primary)}

      <div style="background:#f8fafc;border-left:3px solid ${primary};padding:14px 18px;border-radius:0 6px 6px 0;margin-bottom:24px">
        <p style="font-size:12px;color:#374151;line-height:1.7;margin:0">${esc(a.narrative)}</p>
      </div>

      ${kpiGrid}

      ${a.executiveBullets.length > 0 ? `
      ${subsectionTitle("Destaques do Período")}
      <ul style="list-style:none;padding:0;margin:0 0 24px">${bullets}</ul>` : ""}

      ${subsectionTitle("Visão por Rede")}
      <table>
        <thead>${tableHeader("Rede", "Alcance", "Δ Alcance", "Engajamento", "Δ Engaj.")}</thead>
        <tbody>${networkRows || "<tr><td colspan='5' style='text-align:center;color:#9ca3af'>Sem dados</td></tr>"}</tbody>
      </table>
    </div>`;
}

function renderInstagram(
  data: AgencyReportData,
  analysis: AgencyReportAnalysis,
  primary: string
): string {
  const ig = data.instagram;
  const a = analysis.instagram;

  /* Audiência: top 3 gênero/idade */
  const genderAgeSorted = Object.entries(ig.audience.genderAge)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  const genderAgeCards = genderAgeSorted
    .map(
      ([key, val]) =>
        `<div class="kpi-card" style="padding:12px 16px">
          <div style="font-size:10px;text-transform:uppercase;color:#6b7280;margin-bottom:4px">${esc(key)}</div>
          <div style="font-size:20px;font-weight:700;color:#111827">${new Intl.NumberFormat("pt-BR").format(val)}</div>
        </div>`
    )
    .join("");

  /* Top 5 cidades */
  const cityRows = ig.audience.cities
    .slice(0, 5)
    .map(
      (c) =>
        `<tr><td>${esc(c.city)}</td><td>${new Intl.NumberFormat("pt-BR").format(c.followers)}</td></tr>`
    )
    .join("");

  /* Cliques por tipo */
  const clickRows = Object.entries(ig.audience.profileLinkTapsBreakdown)
    .map(
      ([tipo, val]) =>
        `<tr><td>${esc(tipo)}</td><td>${new Intl.NumberFormat("pt-BR").format(val)}</td></tr>`
    )
    .join("");

  /* Top Posts */
  const topPostRows = ig.topPosts
    .slice(0, 8)
    .map(
      (p) =>
        `<tr>
          <td>${esc(p.type)}</td>
          <td>${new Intl.NumberFormat("pt-BR").format(p.reach)}</td>
          <td>${new Intl.NumberFormat("pt-BR").format(p.likes)}</td>
          <td>${new Intl.NumberFormat("pt-BR").format(p.comments)}</td>
          <td>${new Intl.NumberFormat("pt-BR").format(p.saves)}</td>
          <td>${new Intl.NumberFormat("pt-BR").format(p.shares)}</td>
          <td style="font-size:10px;color:#6b7280">${esc(formatDate(p.publishedAt))}</td>
        </tr>`
    )
    .join("");

  /* Top Reels */
  const topReelRows = ig.reels.topReels
    .slice(0, 5)
    .map(
      (r) =>
        `<tr>
          <td style="max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(r.caption?.slice(0, 50) ?? "—")}</td>
          <td>${new Intl.NumberFormat("pt-BR").format(r.reach)}</td>
          <td>${new Intl.NumberFormat("pt-BR").format(r.views)}</td>
          <td>${new Intl.NumberFormat("pt-BR").format(r.likes)}</td>
          <td>${new Intl.NumberFormat("pt-BR").format(r.saves)}</td>
          <td style="font-size:10px;color:#6b7280">${esc(formatDate(r.publishedAt))}</td>
        </tr>`
    )
    .join("");

  return `
    <div class="page" style="page-break-before:always">
      ${sectionHeader("Instagram", primary)}

      <div style="background:#f8fafc;border-left:3px solid ${primary};padding:14px 18px;border-radius:0 6px 6px 0;margin-bottom:24px">
        <p style="font-size:12px;color:#374151;line-height:1.7;margin:0">${esc(a.narrative)}</p>
      </div>

      ${subsectionTitle("Perfil")}
      <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:16px">
        ${kpiCard("Seguidores", ig.perfil.followers, primary)}
        ${kpiCard("Alcance Único", ig.perfil.reach, primary)}
        ${kpiCard("Visitas Perfil", ig.perfil.profileVisits, primary)}
        ${kpiCard("Cliques Perfil", ig.perfil.profileLinkTaps, primary)}
        ${kpiCard("Views Totais (org.+pago)", ig.perfil.viewsTotal, primary)}
      </div>
      ${ig.perfil.followersGrowth.length >= 2 ? `
      <div style="margin-bottom:12px">
        ${timelineSvg(ig.perfil.followersGrowth, primary, "Crescimento de Seguidores", "#seguid.", 150)}
      </div>` : ""}
      ${ig.perfil.reachDaily.length >= 2 ? `
      <div style="margin-bottom:24px">
        ${timelineSvg(ig.perfil.reachDaily, "#6366f1", "Alcance Diário", "pessoas", 150)}
      </div>` : ""}

      ${subsectionTitle("Audiência")}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:24px">
        <div>
          <div style="font-size:11px;font-weight:600;color:#6b7280;margin-bottom:8px">GÊNERO / FAIXA ETÁRIA (TOP 3)</div>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">${genderAgeCards || '<span style="color:#9ca3af;font-size:11px">Sem dados</span>'}</div>
        </div>
        <div>
          <div style="font-size:11px;font-weight:600;color:#6b7280;margin-bottom:8px">TOP 5 CIDADES</div>
          <table>
            <thead>${tableHeader("Cidade", "Seguidores")}</thead>
            <tbody>${cityRows || '<tr><td colspan="2" style="text-align:center;color:#9ca3af">Sem dados</td></tr>'}</tbody>
          </table>
        </div>
      </div>

      ${Object.keys(ig.audience.profileLinkTapsBreakdown).length > 0 ? `
      ${subsectionTitle("Cliques no Perfil por Tipo")}
      <table style="margin-bottom:24px">
        <thead>${tableHeader("Tipo", "Cliques")}</thead>
        <tbody>${clickRows}</tbody>
      </table>` : ""}

      ${subsectionTitle("Feed")}
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:24px">
        ${kpiCard("Interações", ig.feed.interactions, primary)}
        ${kpiCard("Posts", ig.feed.postsCount, primary)}
        ${kpiCard("Alcance", ig.feed.reach, primary)}
        ${kpiCard("Comentários", ig.feed.comments, primary)}
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:24px">
        ${kpiCard("Compartilhamentos", ig.feed.shares, primary)}
        ${kpiCard("Curtidas", ig.feed.likes, primary)}
        ${kpiCard("Saves", ig.feed.saves, primary)}
      </div>

      ${subsectionTitle("Reels")}
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px">
        ${kpiCard("Qtd. Reels", ig.reels.reelsCount, primary)}
        ${kpiCard("Alcance", ig.reels.reach, primary)}
        ${kpiCard("Views", ig.reels.views, primary)}
        ${kpiCard("Interações", ig.reels.interactions, primary)}
      </div>
      ${ig.reels.topReels.length > 0 ? `
      <div style="font-size:11px;font-weight:600;color:#6b7280;margin-bottom:8px">REELS EM DESTAQUE</div>
      <table style="margin-bottom:24px">
        <thead>${tableHeader("Legenda", "Alcance", "Views", "Curtidas", "Saves", "Data")}</thead>
        <tbody>${topReelRows}</tbody>
      </table>` : ""}

      ${subsectionTitle("Stories")}
      <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:16px">
        ${kpiCard("Qtd. Stories", ig.stories.storiesCount, primary)}
        ${kpiCard("Visitas Perfil", ig.stories.profileVisits, primary)}
        ${kpiCard("Novos Seguid.", ig.stories.followsFromStories, primary)}
        ${kpiCard("Retenção", ig.stories.retention, primary)}
        ${kpiCard("Interações", ig.stories.interactions, primary)}
      </div>
      ${renderStoriesGrid(ig.stories.individuals, primary)}

      ${ig.topPosts.length > 0 ? `
      ${subsectionTitle("Top Posts")}
      <table style="margin-bottom:24px">
        <thead>${tableHeader("Tipo", "Alcance", "Curtidas", "Coment.", "Saves", "Shares", "Data")}</thead>
        <tbody>${topPostRows}</tbody>
      </table>` : ""}

      ${ig.bestTime && ig.bestTime.length > 0 ? `
      ${subsectionTitle("Melhor Horário para Postagens")}
      ${renderBestTimeHeatmap(ig.bestTime, primary)}` : ""}

      ${a.recommendations.length > 0 ? `
      ${subsectionTitle("Recomendações")}
      ${recommendationsList(a.recommendations)}` : ""}
    </div>`;
}

function renderFacebook(
  data: AgencyReportData,
  analysis: AgencyReportAnalysis,
  primary: string
): string {
  const fb = data.facebook;
  const a = analysis.facebook;

  /* Audiência */
  const genderAgeSorted = Object.entries(fb.audience.genderAge)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  const genderAgeCards = genderAgeSorted
    .map(
      ([key, val]) =>
        `<div class="kpi-card" style="padding:12px 16px">
          <div style="font-size:10px;text-transform:uppercase;color:#6b7280;margin-bottom:4px">${esc(key)}</div>
          <div style="font-size:20px;font-weight:700;color:#111827">${new Intl.NumberFormat("pt-BR").format(val)}</div>
        </div>`
    )
    .join("");

  const cityRows = fb.audience.cities
    .slice(0, 5)
    .map(
      (c) =>
        `<tr><td>${esc(c.city)}</td><td>${new Intl.NumberFormat("pt-BR").format(c.followers)}</td></tr>`
    )
    .join("");

  /* Top posts */
  const topPostRows = fb.posts.topPosts
    .slice(0, 8)
    .map(
      (p) =>
        `<tr>
          <td>${esc(p.type)}</td>
          <td>${new Intl.NumberFormat("pt-BR").format(p.totalReach)}</td>
          <td>${new Intl.NumberFormat("pt-BR").format(p.organicReach)}</td>
          <td>${new Intl.NumberFormat("pt-BR").format(p.paidReach)}</td>
          <td>${new Intl.NumberFormat("pt-BR").format(p.reactions)}</td>
          <td>${new Intl.NumberFormat("pt-BR").format(p.comments)}</td>
          <td>${new Intl.NumberFormat("pt-BR").format(p.shares)}</td>
          <td style="font-size:10px;color:#6b7280">${esc(formatDate(p.publishedAt))}</td>
        </tr>`
    )
    .join("");

  /* Reels FB — tabela expandida */
  const topReelRows = fb.reels.topReels
    .slice(0, 5)
    .map(
      (r) => {
        // Minutos visualizados: avgWatchTime (segundos) * views / 60
        const minutesWatched = r.avgWatchTime > 0 && r.views > 0
          ? (r.avgWatchTime * r.views / 60).toFixed(0)
          : "—";
        return `<tr>
          <td style="max-width:160px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(r.title?.slice(0, 50) ?? "—")}</td>
          <td>${new Intl.NumberFormat("pt-BR").format(r.views)}</td>
          <td>${new Intl.NumberFormat("pt-BR").format(r.reach)}</td>
          <td>${r.avgWatchTime > 0 ? `${r.avgWatchTime.toFixed(0)}s` : "—"}</td>
          <td>${r.completeViews > 0 ? new Intl.NumberFormat("pt-BR").format(r.completeViews) : "—"}</td>
          <td>${r.likes !== undefined ? new Intl.NumberFormat("pt-BR").format(r.likes) : "—"}</td>
          <td>${r.comments !== undefined ? new Intl.NumberFormat("pt-BR").format(r.comments) : "—"}</td>
          <td>${r.shares !== undefined ? new Intl.NumberFormat("pt-BR").format(r.shares) : "—"}</td>
          <td>${minutesWatched !== "—" ? `${minutesWatched} min` : "—"}</td>
          <td style="font-size:10px;color:#6b7280">${esc(formatDate(r.publishedAt))}</td>
        </tr>`;
      }
    )
    .join("");

  return `
    <div class="page" style="page-break-before:always">
      ${sectionHeader("Facebook", primary)}

      <div style="background:#f8fafc;border-left:3px solid ${primary};padding:14px 18px;border-radius:0 6px 6px 0;margin-bottom:24px">
        <p style="font-size:12px;color:#374151;line-height:1.7;margin:0">${esc(a.narrative)}</p>
      </div>

      ${subsectionTitle("Página")}
      <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:16px">
        ${kpiCard("Seguidores", fb.perfil.pageFollowers, primary)}
        ${kpiCard("Novos Seguid.", fb.perfil.newFollowers, primary)}
        ${kpiCard("Alcance", fb.perfil.pageReach, primary)}
        ${kpiCard("Visualiz. Página", fb.perfil.pageViews, primary)}
        ${kpiCard("Mensagens Novas", fb.perfil.pageMessagesNew, primary)}
      </div>
      ${fb.perfil.followersGrowth.length >= 2 ? `
      <div style="margin-bottom:12px">
        ${timelineSvg(fb.perfil.followersGrowth, "#1877f2", "Crescimento de Seguidores (Facebook)", "#seguid.", 150)}
      </div>` : ""}
      ${fb.perfil.reachDaily.length >= 2 ? `
      <div style="margin-bottom:24px">
        ${timelineSvg(fb.perfil.reachDaily, "#42b72a", "Alcance Diário (Facebook)", "pessoas", 150)}
      </div>` : ""}

      ${subsectionTitle("Audiência")}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:24px">
        <div>
          <div style="font-size:11px;font-weight:600;color:#6b7280;margin-bottom:8px">GÊNERO / FAIXA ETÁRIA (TOP 3)</div>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">${genderAgeCards || '<span style="color:#9ca3af;font-size:11px">Sem dados</span>'}</div>
        </div>
        <div>
          <div style="font-size:11px;font-weight:600;color:#6b7280;margin-bottom:8px">TOP 5 CIDADES</div>
          <table>
            <thead>${tableHeader("Cidade", "Seguidores")}</thead>
            <tbody>${cityRows || '<tr><td colspan="2" style="text-align:center;color:#9ca3af">Sem dados</td></tr>'}</tbody>
          </table>
        </div>
      </div>

      ${subsectionTitle("Posts")}
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px">
        ${kpiCard("Qtd. Posts", fb.posts.postsCount, primary)}
        ${kpiCard("Alcance Total", fb.posts.totalReach, primary)}
        ${kpiCard("Alcance Orgânico", fb.posts.organicReach, primary)}
        ${kpiCard("Alcance Pago", fb.posts.paidReach, primary)}
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px">
        ${kpiCard("Reações", fb.posts.reactions, primary)}
        ${kpiCard("Comentários", fb.posts.comments, primary)}
        ${kpiCard("Compartilhamentos", fb.posts.shares, primary)}
      </div>

      ${fb.posts.topPosts.length > 0 ? `
      <div style="font-size:11px;font-weight:600;color:#6b7280;margin:16px 0 8px">POSTAGENS EM DESTAQUE</div>
      <table style="margin-bottom:24px">
        <thead>${tableHeader("Tipo", "Alcance Total", "Orgânico", "Pago", "Reações", "Coment.", "Shares", "Data")}</thead>
        <tbody>${topPostRows}</tbody>
      </table>` : ""}

      ${subsectionTitle("Reels Facebook")}
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px">
        ${kpiCard("Qtd. Reels", fb.reels.reelsCount, primary)}
        ${kpiCard("Views", fb.reels.views, primary)}
        ${kpiCard("Alcance", fb.reels.reach, primary)}
        ${kpiCard("Tempo Médio", fb.reels.avgWatchTime, primary)}
      </div>
      ${fb.reels.topReels.length > 0 ? `
      <table style="margin-bottom:24px;font-size:10px">
        <thead>${tableHeader("Título", "Views", "Alcance", "T. Médio", "Views Complet.", "Curtidas", "Coment.", "Shares", "Min. Total", "Data")}</thead>
        <tbody>${topReelRows}</tbody>
      </table>` : ""}

      ${a.recommendations.length > 0 ? `
      ${subsectionTitle("Recomendações")}
      ${recommendationsList(a.recommendations)}` : ""}
    </div>`;
}

function renderMetaAds(
  data: AgencyReportData,
  analysis: AgencyReportAnalysis,
  primary: string
): string {
  const ads = data.metaAds;
  const a = analysis.metaAds;
  const ov = ads.overview;

  /* Spend timeline SVG */
  const timelineChart = spendTimelineSvg(ads.spendTimeline, primary);

  /* Split por canal */
  const splitFb = ads.byPlatform.facebook;
  const splitIg = ads.byPlatform.instagram;

  /* Top campanhas */
  const campaignRows = ads.topCampaigns
    .slice(0, 5)
    .map(
      (c) =>
        `<tr>
          <td style="max-width:160px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(c.name)}</td>
          <td>${new Intl.NumberFormat("pt-BR").format(c.reach)}</td>
          <td>${new Intl.NumberFormat("pt-BR").format(c.impressions)}</td>
          <td>${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(c.cpm)}</td>
          <td>${c.frequency.toFixed(2)}</td>
          <td>${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(c.spend)}</td>
          <td>${new Intl.NumberFormat("pt-BR").format(c.results)}</td>
          <td>${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(c.costPerResult)}</td>
        </tr>`
    )
    .join("");

  /* Top anúncios */
  const adRows = ads.topAds
    .slice(0, 5)
    .map(
      (ad) =>
        `<tr>
          <td style="max-width:160px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(ad.name)}</td>
          <td>${new Intl.NumberFormat("pt-BR").format(ad.results)}</td>
          <td>${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(ad.costPerResult)}</td>
          <td>${new Intl.NumberFormat("pt-BR").format(ad.reach)}</td>
          <td>${new Intl.NumberFormat("pt-BR").format(ad.impressions)}</td>
          <td>${new Intl.NumberFormat("pt-BR").format(ad.clicks)}</td>
          <td>${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(ad.cpc)}</td>
          <td>${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(ad.cpm)}</td>
          <td>${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(ad.spend)}</td>
        </tr>`
    )
    .join("");

  return `
    <div class="page" style="page-break-before:always">
      ${sectionHeader("Meta Ads", primary)}

      <div style="background:#f8fafc;border-left:3px solid ${primary};padding:14px 18px;border-radius:0 6px 6px 0;margin-bottom:24px">
        <p style="font-size:12px;color:#374151;line-height:1.7;margin:0">${esc(a.narrative)}</p>
      </div>

      ${subsectionTitle("Visão Consolidada")}
      <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:12px">
        ${kpiCard("Leads", ov.leads, primary, "large")}
        ${kpiCard("Custo/Lead", ov.costPerLead, primary, "large")}
        ${kpiCard("Investido", ov.spend, primary, "large")}
        ${kpiCard("Alcance Total", ov.reach, primary, "large")}
        ${kpiCard("Impressões", ov.impressions, primary, "large")}
      </div>
      <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:24px">
        ${kpiCard("Cliques Link", ov.linkClicks, primary)}
        ${kpiCard("CTR", ov.ctr, primary)}
        ${kpiCard("CPM", ov.cpm, primary)}
        ${kpiCard("CPC", ov.cpc, primary)}
        ${kpiCard("Frequência", ov.frequency, primary)}
      </div>

      ${subsectionTitle("Split por Canal")}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px">
        <div>
          <div style="font-size:11px;font-weight:700;color:#1877f2;margin-bottom:8px;text-transform:uppercase">Facebook</div>
          <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px">
            ${kpiCard("Alcance", splitFb.reach, "#1877f2")}
            ${kpiCard("Impressões", splitFb.impressions, "#1877f2")}
            ${kpiCard("Cliques", splitFb.clicks, "#1877f2")}
            ${kpiCard("Investido", splitFb.spend, "#1877f2")}
          </div>
        </div>
        <div>
          <div style="font-size:11px;font-weight:700;color:#e1306c;margin-bottom:8px;text-transform:uppercase">Instagram</div>
          <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px">
            ${kpiCard("Alcance", splitIg.reach, "#e1306c")}
            ${kpiCard("Impressões", splitIg.impressions, "#e1306c")}
            ${kpiCard("Cliques", splitIg.clicks, "#e1306c")}
            ${kpiCard("Investido", splitIg.spend, "#e1306c")}
          </div>
        </div>
      </div>

      ${ads.spendTimeline.length >= 2 ? `
      ${subsectionTitle("Investimento ao Longo do Tempo")}
      <div style="margin-bottom:24px;overflow-x:auto">
        ${timelineChart}
      </div>` : ""}

      ${ads.topCampaigns.length > 0 ? `
      ${subsectionTitle("Campanhas em Destaque")}
      <table style="margin-bottom:24px">
        <thead>${tableHeader("Campanha", "Alcance", "Impressões", "CPM", "Freq.", "Investido", "Resultados", "Custo/Result.")}</thead>
        <tbody>${campaignRows}</tbody>
      </table>` : ""}

      ${ads.topAds.length > 0 ? `
      ${subsectionTitle("Anúncios em Destaque")}
      <table style="margin-bottom:24px">
        <thead>${tableHeader("Anúncio", "Resultados", "Custo/Result.", "Alcance", "Impressões", "Cliques", "CPC", "CPM", "Investido")}</thead>
        <tbody>${adRows}</tbody>
      </table>` : ""}

      ${a.recommendations.length > 0 ? `
      ${subsectionTitle("Recomendações")}
      ${recommendationsList(a.recommendations)}` : ""}
    </div>`;
}

/* ── CSS base ────────────────────────────────────────────────────────────── */

function buildCss(primary: string): string {
  return `
    *, *::before, *::after { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; font-size: 13px; color: #111827; background: #fff; }
    .page { padding: 2cm; position: relative; }
    .cover-page { padding: 0; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 12px; }
    thead th { background: #1e293b; color: #f8fafc; padding: 8px 10px; text-align: left; font-weight: 600; font-size: 10px; text-transform: uppercase; letter-spacing: .04em; }
    tbody tr:nth-child(even) { background: #f8fafc; }
    tbody tr:hover { background: #f1f5f9; }
    tbody td { padding: 8px 10px; border-bottom: 1px solid #e5e7eb; vertical-align: middle; }
    .kpi-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; border-left: 3px solid ${primary}; }
    @media print {
      .page { page-break-inside: avoid; }
    }
  `;
}

/* ── renderAgencyTemplate — função pública principal ─────────────────────── */

export function renderAgencyTemplate(
  data: AgencyReportData,
  analysis: AgencyReportAnalysis
): string {
  /* Cor primária: da empresa se disponível, senão azul escuro padrão */
  const primary = "#1a2332";

  const css = buildCss(primary);
  const cover = renderCover(data, primary);
  const panorama = renderPanorama(data, analysis, primary);
  const instagram = data.meta.providersIncluded.includes("instagram")
    ? renderInstagram(data, analysis, primary)
    : "";
  const facebook = data.meta.providersIncluded.includes("facebook")
    ? renderFacebook(data, analysis, primary)
    : "";
  const metaAds = data.meta.providersIncluded.includes("meta_ads")
    ? renderMetaAds(data, analysis, primary)
    : "";

  const footer = `
    <div style="text-align:center;padding:24px 40px;background:#f8fafc;border-top:2px solid #e5e7eb;font-size:10px;color:#9ca3af;line-height:1.8">
      <div>Relatório gerado em ${esc(new Date(data.meta.generatedAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }))}</div>
      <div>Fontes: Instagram Business · Facebook · Meta Ads</div>
      <div style="margin-top:4px"><strong style="color:#6b7280">${esc(data.meta.empresaNome)}</strong> <span style="color:#d1d5db">·</span> <strong style="color:#1a2332">GO Studio</strong></div>
    </div>`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Relatório Agência — ${esc(data.meta.empresaNome)}</title>
  <style>${css}</style>
</head>
<body>
  ${cover}
  ${panorama}
  ${instagram}
  ${facebook}
  ${metaAds}
  ${footer}
</body>
</html>`;
}
