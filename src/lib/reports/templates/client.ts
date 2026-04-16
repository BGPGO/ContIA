/**
 * Template Client — versão para apresentar ao cliente (5-8 páginas).
 * Foco em storytelling, visual limpo, linguagem natural, próximos passos acionáveis.
 */

import type { Report, ReportAnalysis } from '@/types/reports'
import { renderKpiCardSVG, renderPieChartSVG } from '../charts-svg'
import type { BrandDna } from './executive'

function safeAnalysis(report: Report): ReportAnalysis | null {
  const a = report.ai_analysis
  if (a && typeof a === 'object' && 'summary' in a && typeof (a as ReportAnalysis).summary === 'string') {
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

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const HIGHLIGHT_EMOJIS = ['🚀', '📈', '💡', '🎯', '⭐', '🔥', '💪']

export function renderClientTemplate(report: Report, dna: BrandDna): string {
  const primary = dna.primary ?? '#4ecdc4'
  const secondary = dna.secondary ?? '#6c5ce7'
  const accent = dna.accent ?? '#fbbf24'
  const analysis = safeAnalysis(report)
  const brandName = dna.name ?? 'Empresa'
  const logoUrl = dna.logo
  const periodStart = formatDate(report.period_start)
  const periodEnd = formatDate(report.period_end)
  const generatedAt = new Date().toLocaleDateString('pt-BR')

  const typeLabels: Record<string, string> = {
    weekly: 'Semanal',
    monthly: 'Mensal',
    quarterly: 'Trimestral',
    custom: 'Personalizado',
  }
  const typeLabel = typeLabels[report.type] ?? report.type

  /* ── KPI cards ── */
  const highlightsWithMetric = (analysis?.highlights ?? []).filter((h) => h.metric)
  const kpiCards = highlightsWithMetric.slice(0, 4).map((h) => {
    if (!h.metric) return ''
    return renderKpiCardSVG(h.metric.label, h.metric.value, h.metric.delta, {
      color: primary,
      width: 170,
      height: 88,
    })
  })

  /* ── Pie chart dos providers ── */
  const providers = report.providers ?? []
  const pieData = providers.slice(0, 6).map((p, i) => ({
    label: p.charAt(0).toUpperCase() + p.slice(1),
    value: Math.max(1, 100 - i * 12),
  }))
  const pieChart = pieData.length >= 2
    ? renderPieChartSVG(pieData, { width: 320, height: 180, title: 'Presença Digital' })
    : ''

  /* ── Story highlights (sem metric) ── */
  const storyHighlights = (analysis?.highlights ?? []).slice(0, 7).map((h, i) => {
    const emoji = HIGHLIGHT_EMOJIS[i % HIGHLIGHT_EMOJIS.length]
    const hasDelta = h.metric?.delta
    return `
    <div class="story-card">
      <div class="story-emoji">${emoji}</div>
      <div class="story-body">
        <div class="story-title">${escHtml(h.title)}</div>
        <div class="story-desc">${escHtml(h.description)}</div>
        ${h.metric ? `
        <div class="story-metric">
          <span class="metric-value">${escHtml(h.metric.value)}</span>
          <span class="metric-label">${escHtml(h.metric.label)}</span>
          ${hasDelta ? `<span class="metric-delta ${!h.metric.delta?.startsWith('-') ? 'positive' : 'negative'}">${escHtml(h.metric.delta ?? '')}</span>` : ''}
        </div>` : ''}
      </div>
    </div>`
  }).join('')

  /* ── Next steps (recommendations) ── */
  const nextSteps = (analysis?.recommendations ?? []).slice(0, 5).map((r, i) => {
    const pColor = r.priority === 'high' ? '#f87171' : r.priority === 'medium' ? '#fbbf24' : '#34d399'
    const pLabel = r.priority === 'high' ? '🔴 Alta' : r.priority === 'medium' ? '🟡 Média' : '🟢 Baixa'
    return `
    <div class="next-step">
      <div class="step-num" style="background:linear-gradient(135deg,${primary},${secondary})">${i + 1}</div>
      <div class="step-body">
        <div class="step-action">${escHtml(r.action)}</div>
        <div class="step-rationale">${escHtml(r.rationale)}</div>
        <div class="step-footer">
          <span class="priority-tag" style="color:${pColor};border-color:${pColor}44">${pLabel}</span>
          ${r.estimatedImpact ? `<span class="impact-tag">${escHtml(r.estimatedImpact)}</span>` : ''}
        </div>
      </div>
    </div>`
  }).join('')

  /* ── Warnings summary ── */
  const hasWarnings = (analysis?.warnings?.length ?? 0) > 0
  const warningBlocks = (analysis?.warnings ?? []).map((w) => {
    const sColor = w.severity === 'critical' ? '#f87171' : w.severity === 'warning' ? '#fbbf24' : '#60a5fa'
    const sEmoji = w.severity === 'critical' ? '🚨' : w.severity === 'warning' ? '⚠️' : 'ℹ️'
    return `
    <div class="warning-card" style="border-color:${sColor}44;background:${sColor}08">
      <span class="warning-icon">${sEmoji}</span>
      <div>
        <div class="warning-title" style="color:${sColor}">${escHtml(w.title)}</div>
        <div class="warning-desc">${escHtml(w.description)}</div>
      </div>
    </div>`
  }).join('')

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');

  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    background: #fff;
    color: #1a1a2e;
    font-size: 12px;
    line-height: 1.5;
  }

  /* ── Capa Branded ── */
  .cover {
    width: 210mm;
    min-height: 297mm;
    background: linear-gradient(160deg, ${primary}f5 0%, ${secondary}e8 50%, #0a0d1e 100%);
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 20mm 18mm;
    page-break-after: always;
    position: relative;
    overflow: hidden;
  }
  .cover-top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }
  .cover-logo-area {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .cover-logo-placeholder {
    width: 48px;
    height: 48px;
    border-radius: 10px;
    background: rgba(255,255,255,0.2);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    font-weight: 800;
    color: white;
  }
  .cover-logo-name {
    font-size: 14px;
    font-weight: 700;
    color: rgba(255,255,255,0.9);
  }
  .cover-badge-top {
    font-size: 8px;
    font-weight: 700;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.6);
    padding: 4px 12px;
    border: 1px solid rgba(255,255,255,0.3);
    border-radius: 20px;
  }
  .cover-center {
    text-align: center;
    padding: 0 10mm;
  }
  .cover-tagline {
    font-size: 11px;
    font-weight: 500;
    color: rgba(255,255,255,0.6);
    text-transform: uppercase;
    letter-spacing: 0.2em;
    margin-bottom: 16px;
  }
  .cover-company-name {
    font-size: 48px;
    font-weight: 800;
    color: #ffffff;
    letter-spacing: -0.04em;
    margin-bottom: 12px;
    line-height: 1.1;
  }
  .cover-report-type {
    font-size: 20px;
    font-weight: 300;
    color: rgba(255,255,255,0.85);
    margin-bottom: 24px;
  }
  .cover-period-pill {
    display: inline-block;
    background: rgba(255,255,255,0.15);
    border: 1px solid rgba(255,255,255,0.3);
    backdrop-filter: blur(10px);
    padding: 8px 20px;
    border-radius: 24px;
    font-size: 11px;
    color: rgba(255,255,255,0.9);
    font-weight: 500;
  }
  .cover-bottom {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    font-size: 9px;
    color: rgba(255,255,255,0.4);
  }
  .cover-deco {
    position: absolute;
    top: 40mm;
    right: -40px;
    width: 200px;
    height: 200px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 70%);
  }
  .cover-deco2 {
    position: absolute;
    bottom: 30mm;
    left: -60px;
    width: 280px;
    height: 280px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(255,255,255,0.06) 0%, transparent 70%);
  }

  /* ── Pages ── */
  .page {
    width: 210mm;
    min-height: 297mm;
    padding: 14mm 14mm 16mm;
    page-break-after: always;
    position: relative;
  }
  .page:last-child { page-break-after: auto; }

  .page-accent-bar {
    height: 4px;
    background: linear-gradient(90deg, ${primary}, ${secondary}, ${accent});
    border-radius: 2px;
    margin-bottom: 20px;
  }

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 20px;
  }
  .page-title { font-size: 20px; font-weight: 800; color: #1a1a2e; letter-spacing: -0.03em; }
  .page-subtitle { font-size: 11px; color: #8b8fb0; margin-top: 2px; }
  .page-tag {
    font-size: 8px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: white;
    background: linear-gradient(135deg, ${primary}, ${secondary});
    padding: 4px 10px;
    border-radius: 12px;
  }

  /* ── Summary storytelling ── */
  .narrative-box {
    background: linear-gradient(135deg, #f8f9ff 0%, #f0fff8 100%);
    border: 1px solid ${primary}22;
    border-radius: 12px;
    padding: 20px 22px;
    margin-bottom: 24px;
    position: relative;
  }
  .narrative-box::before {
    content: '"';
    position: absolute;
    top: 10px;
    left: 16px;
    font-size: 40px;
    color: ${primary};
    opacity: 0.2;
    line-height: 1;
    font-family: Georgia, serif;
  }
  .narrative-text {
    font-size: 12px;
    color: #2d3748;
    line-height: 1.75;
    padding-left: 8px;
  }

  /* ── KPI row ── */
  .kpi-row {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    margin-bottom: 22px;
  }

  /* ── Charts ── */
  .chart-row {
    display: flex;
    gap: 14px;
    margin-bottom: 22px;
    align-items: flex-start;
  }
  .chart-wrapper {
    background: #fafafa;
    border: 1px solid #e8e8e8;
    border-radius: 10px;
    padding: 10px;
    overflow: hidden;
  }

  /* ── Story Cards ── */
  .section-label {
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.15em;
    color: ${primary};
    margin-bottom: 14px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .section-label::after {
    content: '';
    flex: 1;
    height: 1px;
    background: ${primary}33;
  }

  .story-card {
    display: flex;
    gap: 14px;
    padding: 14px 16px;
    border: 1px solid #e8e8ef;
    border-radius: 10px;
    margin-bottom: 10px;
    background: #fafafa;
    page-break-inside: avoid;
    align-items: flex-start;
  }
  .story-emoji {
    font-size: 22px;
    line-height: 1;
    flex-shrink: 0;
    margin-top: 2px;
  }
  .story-body { flex: 1; }
  .story-title { font-size: 12px; font-weight: 700; color: #1a1a2e; margin-bottom: 4px; }
  .story-desc { font-size: 10.5px; color: #4a5568; line-height: 1.6; margin-bottom: 6px; }
  .story-metric {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .metric-value { font-size: 16px; font-weight: 800; color: ${primary}; }
  .metric-label { font-size: 9px; color: #8b8fb0; font-weight: 500; }
  .metric-delta {
    font-size: 9px;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 10px;
  }
  .metric-delta.positive { background: #34d39922; color: #34d399; }
  .metric-delta.negative { background: #f8717122; color: #f87171; }

  /* ── Next Steps ── */
  .next-step {
    display: flex;
    gap: 14px;
    padding: 14px 16px;
    border: 1px solid #e8e8ef;
    border-radius: 10px;
    margin-bottom: 12px;
    background: #fafafa;
    page-break-inside: avoid;
    align-items: flex-start;
  }
  .step-num {
    width: 30px;
    height: 30px;
    border-radius: 8px;
    color: white;
    font-size: 14px;
    font-weight: 800;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .step-body { flex: 1; }
  .step-action { font-size: 12px; font-weight: 700; color: #1a1a2e; margin-bottom: 4px; }
  .step-rationale { font-size: 10.5px; color: #4a5568; line-height: 1.55; margin-bottom: 8px; }
  .step-footer { display: flex; gap: 8px; align-items: center; }
  .priority-tag {
    font-size: 9px;
    font-weight: 600;
    padding: 2px 10px;
    border: 1px solid;
    border-radius: 10px;
  }
  .impact-tag {
    font-size: 9px;
    color: #8b8fb0;
    background: #f0f0f5;
    padding: 2px 8px;
    border-radius: 10px;
  }

  /* ── Warnings ── */
  .warning-card {
    display: flex;
    gap: 12px;
    padding: 12px 14px;
    border: 1px solid;
    border-radius: 8px;
    margin-bottom: 10px;
    align-items: flex-start;
    page-break-inside: avoid;
  }
  .warning-icon { font-size: 18px; flex-shrink: 0; }
  .warning-title { font-size: 11px; font-weight: 700; margin-bottom: 3px; }
  .warning-desc { font-size: 10px; color: #4a5568; line-height: 1.5; }

  /* ── Footer ── */
  .page-footer {
    position: absolute;
    bottom: 8mm;
    left: 14mm;
    right: 14mm;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: 6px;
    border-top: 1px solid #e8e8ef;
  }
  .footer-brand { font-size: 8px; color: #bbb; }
  .footer-page { font-size: 8px; color: #bbb; }

  /* ── Closing page ── */
  .closing-page {
    width: 210mm;
    min-height: 297mm;
    background: linear-gradient(160deg, #0a0d1e 0%, #141736 60%, #0c0f24 100%);
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    text-align: center;
    padding: 30mm 20mm;
  }
  .closing-tagline { font-size: 28px; font-weight: 800; color: #e8eaff; letter-spacing: -0.03em; margin-bottom: 16px; }
  .closing-sub { font-size: 12px; color: #8b8fb0; margin-bottom: 32px; line-height: 1.6; max-width: 120mm; }
  .closing-divider { width: 40px; height: 3px; background: linear-gradient(90deg, ${primary}, ${secondary}); border-radius: 2px; margin: 0 auto 28px; }
  .closing-footer { font-size: 9px; color: #5e6388; }

  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>

<!-- CAPA BRANDED -->
<div class="cover">
  <div class="cover-deco"></div>
  <div class="cover-deco2"></div>

  <div class="cover-top">
    <div class="cover-logo-area">
      ${logoUrl
        ? `<img src="${escHtml(logoUrl)}" width="48" height="48" style="border-radius:10px;object-fit:cover" alt="${escHtml(brandName)}"/>`
        : `<div class="cover-logo-placeholder">${escHtml(brandName.charAt(0))}</div>`}
      <div class="cover-logo-name">${escHtml(brandName)}</div>
    </div>
    <div class="cover-badge-top">Relatório de Resultados</div>
  </div>

  <div class="cover-center">
    <div class="cover-tagline">Desempenho Digital</div>
    <div class="cover-company-name">${escHtml(brandName)}</div>
    <div class="cover-report-type">Relatório ${escHtml(typeLabel)}</div>
    <div class="cover-period-pill">${periodStart} &nbsp;&rarr;&nbsp; ${periodEnd}</div>
  </div>

  <div class="cover-bottom">
    <span>Gerado em ${generatedAt}</span>
    <span>ContIA 2.0 &bull; Inteligência de Conteúdo</span>
  </div>
</div>

<!-- PÁG: Resumo em linguagem natural -->
<div class="page">
  <div class="page-accent-bar"></div>
  <div class="page-header">
    <div>
      <div class="page-title">O que aconteceu?</div>
      <div class="page-subtitle">Resumo do período analisado pela nossa IA</div>
    </div>
    <div class="page-tag">${escHtml(typeLabel.toUpperCase())}</div>
  </div>

  ${analysis?.summary ? `
  <div class="narrative-box">
    <div class="narrative-text">${escHtml(analysis.summary)}</div>
  </div>` : ''}

  ${kpiCards.length > 0 ? `
  <div class="section-label">Números do período</div>
  <div class="kpi-row">
    ${kpiCards.join('\n    ')}
  </div>` : ''}

  ${pieChart ? `
  <div class="section-label">Canais monitorados</div>
  <div class="chart-wrapper" style="display:inline-block">${pieChart}</div>` : ''}

  <div class="page-footer">
    <div class="footer-brand">ContIA 2.0 &bull; ${escHtml(brandName)}</div>
    <div class="footer-page">2</div>
  </div>
</div>

<!-- PÁG: Highlights visuais -->
${storyHighlights ? `
<div class="page">
  <div class="page-accent-bar"></div>
  <div class="page-header">
    <div>
      <div class="page-title">Os grandes momentos</div>
      <div class="page-subtitle">Destaques e conquistas do período</div>
    </div>
    <div class="page-tag">DESTAQUES</div>
  </div>

  <div class="section-label">Principais resultados</div>
  ${storyHighlights}

  <div class="page-footer">
    <div class="footer-brand">ContIA 2.0 &bull; ${escHtml(brandName)}</div>
    <div class="footer-page">3</div>
  </div>
</div>` : ''}

<!-- PÁG: Próximos passos acionáveis -->
${nextSteps ? `
<div class="page">
  <div class="page-accent-bar"></div>
  <div class="page-header">
    <div>
      <div class="page-title">O que fazer agora?</div>
      <div class="page-subtitle">Recomendações da IA para o próximo período</div>
    </div>
    <div class="page-tag">AÇÕES</div>
  </div>

  <div class="section-label">Próximos passos</div>
  ${nextSteps}

  <div class="page-footer">
    <div class="footer-brand">ContIA 2.0 &bull; ${escHtml(brandName)}</div>
    <div class="footer-page">4</div>
  </div>
</div>` : ''}

<!-- PÁG: Pontos de atenção (se houver) -->
${hasWarnings ? `
<div class="page">
  <div class="page-accent-bar"></div>
  <div class="page-header">
    <div>
      <div class="page-title">Pontos de atenção</div>
      <div class="page-subtitle">Itens que precisam de acompanhamento</div>
    </div>
    <div class="page-tag">ALERTAS</div>
  </div>

  <div class="section-label">Sinais de alerta identificados</div>
  ${warningBlocks}

  <div class="page-footer">
    <div class="footer-brand">ContIA 2.0 &bull; ${escHtml(brandName)}</div>
    <div class="footer-page">5</div>
  </div>
</div>` : ''}

<!-- ENCERRAMENTO -->
<div class="closing-page">
  <div class="closing-tagline">Dados que geram decisões.</div>
  <div class="closing-divider"></div>
  <div class="closing-sub">
    Este relatório foi gerado automaticamente pelo ContIA 2.0,<br>
    a plataforma de inteligência de conteúdo da ${escHtml(brandName)}.<br><br>
    Todas as análises são baseadas em dados reais das plataformas conectadas.
  </div>
  <div class="closing-footer">
    ContIA 2.0 &bull; Gerado em ${generatedAt} &bull; ${periodStart} → ${periodEnd}
  </div>
</div>

</body>
</html>`
}
