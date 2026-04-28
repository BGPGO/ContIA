/**
 * Template Executive — versão executiva do relatório (3-5 páginas).
 * Conciso, KPIs grandes, highlights e recomendações top 3.
 */

import type { Report, ReportAnalysis, Highlight, Recommendation, Warning } from '@/types/reports'
import { renderKpiCardSVG, renderBarChartSVG } from '../charts-svg'

export interface BrandDna {
  primary?: string
  secondary?: string
  accent?: string
  logo?: string
  name?: string
}

function safeAnalysis(report: Report): ReportAnalysis | null {
  const a = report.ai_analysis
  if (
    a &&
    typeof a === 'object' &&
    'summary' in a &&
    typeof (a as ReportAnalysis).summary === 'string'
  ) {
    return a as ReportAnalysis
  }
  return null
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(iso))
  } catch {
    return iso
  }
}

function priorityLabel(p: Recommendation['priority']): string {
  return p === 'high' ? 'Alta' : p === 'medium' ? 'Média' : 'Baixa'
}

function priorityColor(p: Recommendation['priority']): string {
  return p === 'high' ? '#f87171' : p === 'medium' ? '#fbbf24' : '#34d399'
}

function severityColor(s: Warning['severity']): string {
  return s === 'critical' ? '#f87171' : s === 'warning' ? '#fbbf24' : '#60a5fa'
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export function renderExecutiveTemplate(report: Report, dna: BrandDna): string {
  const primary = dna.primary ?? '#4ecdc4'
  const secondary = dna.secondary ?? '#6c5ce7'
  const analysis = safeAnalysis(report)
  const brandName = dna.name ?? 'Empresa'
  const periodStart = formatDate(report.period_start)
  const periodEnd = formatDate(report.period_end)
  const generatedAt = new Date().toLocaleDateString('pt-BR')

  /* ── KPI cards: pega as primeiras 3 highlights com metric ── */
  const highlightsWithMetric: Highlight[] = analysis?.highlights?.filter((h) => h.metric) ?? []
  const kpiCards = highlightsWithMetric.slice(0, 3).map((h) => {
    if (!h.metric) return ''
    return renderKpiCardSVG(h.metric.label, h.metric.value, h.metric.delta, {
      color: primary,
      width: 180,
      height: 90,
    })
  })

  /* ── Bar chart de highlights ── */
  const barData = highlightsWithMetric.slice(0, 6).map((h) => ({
    label: h.title.split(' ').slice(0, 2).join(' '),
    value: parseFloat(h.metric?.value?.replace(/[^\d.]/g, '') ?? '0') || 0,
  }))
  const barChart = barData.length >= 2
    ? renderBarChartSVG(barData, { width: 480, height: 160, primaryColor: primary, title: 'Destaques do Período' })
    : ''

  /* ── Highlights section ── */
  const highlightRows = (analysis?.highlights ?? []).slice(0, 5).map((h) => `
    <div class="highlight-item">
      <div class="highlight-title">${escHtml(h.title)}</div>
      <div class="highlight-desc">${escHtml(h.description)}</div>
      ${h.metric ? `<span class="metric-badge">${escHtml(h.metric.label)}: <strong>${escHtml(h.metric.value)}</strong>${h.metric.delta ? ` <em>${escHtml(h.metric.delta)}</em>` : ''}</span>` : ''}
    </div>`).join('')

  /* ── Recommendations ── */
  const recRows = (analysis?.recommendations ?? []).slice(0, 3).map((r, i) => `
    <div class="rec-item">
      <div class="rec-num" style="background:${priorityColor(r.priority)}">${i + 1}</div>
      <div class="rec-body">
        <div class="rec-action">${escHtml(r.action)}</div>
        <div class="rec-rationale">${escHtml(r.rationale)}</div>
        <span class="priority-badge" style="color:${priorityColor(r.priority)};border-color:${priorityColor(r.priority)}">Prioridade ${priorityLabel(r.priority)}${r.estimatedImpact ? ` · ${escHtml(r.estimatedImpact)}` : ''}</span>
      </div>
    </div>`).join('')

  /* ── Warnings ── */
  const warningRows = (analysis?.warnings ?? []).map((w) => `
    <div class="warning-item" style="border-left-color:${severityColor(w.severity)}">
      <div class="warning-title" style="color:${severityColor(w.severity)}">${escHtml(w.title)}</div>
      <div class="warning-desc">${escHtml(w.description)}</div>
    </div>`).join('')

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: #ffffff;
    color: #1a1a2e;
    font-size: 12px;
    line-height: 1.5;
  }

  /* ── Capa ── */
  .cover {
    width: 210mm;
    min-height: 297mm;
    background: linear-gradient(145deg, #0a0d1e 0%, #141736 50%, #0c0f24 100%);
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    text-align: center;
    padding: 40mm 20mm;
    page-break-after: always;
    position: relative;
    overflow: hidden;
  }
  .cover::before {
    content: '';
    position: absolute;
    top: -80px; left: -80px;
    width: 400px; height: 400px;
    border-radius: 50%;
    background: radial-gradient(circle, ${primary}22 0%, transparent 70%);
  }
  .cover::after {
    content: '';
    position: absolute;
    bottom: -60px; right: -60px;
    width: 300px; height: 300px;
    border-radius: 50%;
    background: radial-gradient(circle, ${secondary}1a 0%, transparent 70%);
  }
  .cover-badge {
    background: linear-gradient(135deg, ${primary}33, ${secondary}22);
    border: 1px solid ${primary}55;
    color: ${primary};
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    padding: 6px 16px;
    border-radius: 20px;
    margin-bottom: 24px;
    position: relative;
    z-index: 1;
  }
  .cover-company {
    font-size: 36px;
    font-weight: 800;
    color: #e8eaff;
    letter-spacing: -0.03em;
    margin-bottom: 12px;
    position: relative;
    z-index: 1;
  }
  .cover-title {
    font-size: 16px;
    color: ${primary};
    font-weight: 600;
    margin-bottom: 8px;
    position: relative;
    z-index: 1;
  }
  .cover-period {
    font-size: 12px;
    color: #8b8fb0;
    margin-bottom: 40px;
    position: relative;
    z-index: 1;
  }
  .cover-divider {
    width: 60px;
    height: 2px;
    background: linear-gradient(90deg, ${primary}, ${secondary});
    margin: 0 auto 40px;
    border-radius: 1px;
    position: relative;
    z-index: 1;
  }
  .cover-meta {
    font-size: 10px;
    color: #5e6388;
    position: relative;
    z-index: 1;
  }
  .cover-type-tag {
    position: absolute;
    bottom: 30px;
    right: 30px;
    font-size: 9px;
    color: #5e6388;
    font-weight: 500;
    letter-spacing: 0.05em;
    z-index: 1;
  }

  /* ── Page ── */
  .page {
    width: 210mm;
    min-height: 297mm;
    padding: 16mm 14mm 14mm;
    page-break-after: always;
    position: relative;
  }
  .page:last-child { page-break-after: auto; }

  .page-header-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 10px;
    margin-bottom: 20px;
    border-bottom: 2px solid;
    border-image: linear-gradient(90deg, ${primary}, ${secondary}) 1;
  }
  .page-section-title {
    font-size: 18px;
    font-weight: 800;
    color: #1a1a2e;
    letter-spacing: -0.03em;
  }
  .page-company-tag {
    font-size: 9px;
    color: #8b8fb0;
    font-weight: 500;
  }

  /* ── Summary ── */
  .summary-box {
    background: linear-gradient(135deg, #f0f9ff 0%, #fafff8 100%);
    border: 1px solid ${primary}33;
    border-left: 4px solid ${primary};
    border-radius: 8px;
    padding: 16px 18px;
    margin-bottom: 22px;
  }
  .summary-label {
    font-size: 9px;
    font-weight: 700;
    color: ${primary};
    text-transform: uppercase;
    letter-spacing: 0.12em;
    margin-bottom: 8px;
  }
  .summary-text {
    font-size: 11.5px;
    color: #2d3748;
    line-height: 1.65;
  }

  /* ── KPI Grid ── */
  .kpi-grid {
    display: flex;
    gap: 12px;
    margin-bottom: 22px;
    flex-wrap: wrap;
  }

  /* ── Chart ── */
  .chart-wrapper {
    margin-bottom: 22px;
    background: #fafafa;
    border: 1px solid #e8e8e8;
    border-radius: 8px;
    padding: 12px;
    overflow: hidden;
  }

  /* ── Highlights ── */
  .section-header {
    font-size: 13px;
    font-weight: 700;
    color: #1a1a2e;
    letter-spacing: -0.02em;
    margin-bottom: 14px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .section-header::before {
    content: '';
    display: inline-block;
    width: 14px;
    height: 3px;
    background: linear-gradient(90deg, ${primary}, ${secondary});
    border-radius: 2px;
  }
  .highlight-item {
    padding: 12px 14px;
    border: 1px solid #e8e8ef;
    border-radius: 8px;
    margin-bottom: 10px;
    background: #fafafa;
    page-break-inside: avoid;
  }
  .highlight-title {
    font-size: 12px;
    font-weight: 700;
    color: #1a1a2e;
    margin-bottom: 5px;
  }
  .highlight-desc {
    font-size: 10.5px;
    color: #4a5568;
    line-height: 1.55;
    margin-bottom: 6px;
  }
  .metric-badge {
    background: ${primary}15;
    color: ${primary};
    border: 1px solid ${primary}33;
    border-radius: 12px;
    padding: 2px 10px;
    font-size: 9px;
    font-weight: 600;
  }
  .metric-badge strong { color: #1a1a2e; }
  .metric-badge em { font-style: normal; color: #34d399; }

  /* ── Recommendations ── */
  .rec-item {
    display: flex;
    gap: 12px;
    padding: 12px 14px;
    border: 1px solid #e8e8ef;
    border-radius: 8px;
    margin-bottom: 10px;
    background: #fafafa;
    page-break-inside: avoid;
  }
  .rec-num {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    color: white;
    font-size: 12px;
    font-weight: 800;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    margin-top: 1px;
  }
  .rec-body { flex: 1; }
  .rec-action { font-size: 12px; font-weight: 700; color: #1a1a2e; margin-bottom: 4px; }
  .rec-rationale { font-size: 10.5px; color: #4a5568; margin-bottom: 6px; line-height: 1.55; }
  .priority-badge {
    font-size: 9px;
    font-weight: 600;
    padding: 2px 10px;
    border: 1px solid;
    border-radius: 12px;
    background: transparent;
  }

  /* ── Warnings ── */
  .warning-item {
    padding: 10px 14px;
    border: 1px solid #e8e8ef;
    border-left: 4px solid;
    border-radius: 6px;
    margin-bottom: 8px;
    background: #fafafa;
    page-break-inside: avoid;
  }
  .warning-title { font-size: 11px; font-weight: 700; margin-bottom: 3px; }
  .warning-desc { font-size: 10px; color: #4a5568; line-height: 1.5; }

  /* ── Footer ── */
  .page-footer {
    position: absolute;
    bottom: 10mm;
    left: 14mm;
    right: 14mm;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: 8px;
    border-top: 1px solid #e8e8ef;
  }
  .footer-brand { font-size: 8px; color: #aaa; font-weight: 500; }
  .footer-page { font-size: 8px; color: #aaa; }

  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>

<!-- ══ CAPA ══════════════════════════════════════════════════════════════════ -->
<div class="cover">
  <div class="cover-badge">Relatório Executivo &bull; GO Studio</div>
  <div class="cover-company">${escHtml(brandName)}</div>
  <div class="cover-title">Relatório ${escHtml(report.type.charAt(0).toUpperCase() + report.type.slice(1))}</div>
  <div class="cover-period">${periodStart} &rarr; ${periodEnd}</div>
  <div class="cover-divider"></div>
  <div class="cover-meta">Gerado em ${generatedAt} &bull; GO Studio</div>
  <div class="cover-type-tag">EXECUTIVE</div>
</div>

<!-- ══ PÁG 2: Summary + KPIs ═══════════════════════════════════════════════ -->
<div class="page">
  <div class="page-header-bar">
    <div class="page-section-title">Resumo Executivo</div>
    <div class="page-company-tag">${escHtml(brandName)} &bull; ${escHtml(report.type.toUpperCase())}</div>
  </div>

  ${analysis?.summary ? `
  <div class="summary-box">
    <div class="summary-label">Análise IA</div>
    <div class="summary-text">${escHtml(analysis.summary)}</div>
  </div>` : ''}

  ${kpiCards.length > 0 ? `
  <div class="kpi-grid">
    ${kpiCards.join('\n    ')}
  </div>` : ''}

  ${barChart ? `<div class="chart-wrapper">${barChart}</div>` : ''}

  <div class="page-footer">
    <div class="footer-brand">GO Studio &bull; Gerado por IA</div>
    <div class="footer-page">2</div>
  </div>
</div>

<!-- ══ PÁG 3: Highlights ═══════════════════════════════════════════════════ -->
${analysis?.highlights?.length ? `
<div class="page">
  <div class="page-header-bar">
    <div class="page-section-title">Destaques do Período</div>
    <div class="page-company-tag">${escHtml(brandName)}</div>
  </div>

  <div class="section-header">Principais resultados</div>
  ${highlightRows}

  <div class="page-footer">
    <div class="footer-brand">GO Studio &bull; Gerado por IA</div>
    <div class="footer-page">3</div>
  </div>
</div>` : ''}

<!-- ══ PÁG 4: Recommendations ═════════════════════════════════════════════ -->
${analysis?.recommendations?.length ? `
<div class="page">
  <div class="page-header-bar">
    <div class="page-section-title">Recomendações</div>
    <div class="page-company-tag">${escHtml(brandName)}</div>
  </div>

  <div class="section-header">Top 3 ações prioritárias</div>
  ${recRows}

  <div class="page-footer">
    <div class="footer-brand">GO Studio &bull; Gerado por IA</div>
    <div class="footer-page">4</div>
  </div>
</div>` : ''}

<!-- ══ PÁG 5: Warnings ═════════════════════════════════════════════════════ -->
${analysis?.warnings?.length ? `
<div class="page">
  <div class="page-header-bar">
    <div class="page-section-title">Alertas &amp; Atenção</div>
    <div class="page-company-tag">${escHtml(brandName)}</div>
  </div>

  <div class="section-header">Pontos de atenção identificados</div>
  ${warningRows}

  <div class="page-footer">
    <div class="footer-brand">GO Studio &bull; Gerado por IA</div>
    <div class="footer-page">5</div>
  </div>
</div>` : ''}

</body>
</html>`
}
