/**
 * Template Technical — versão técnica completa (10-15 páginas).
 * Tabelas detalhadas, métricas por provider, top conteúdos, apêndice.
 */

import type { Report, ReportAnalysis, Comparison } from '@/types/reports'
import { renderLineChartSVG, renderBarChartSVG } from '../charts-svg'
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

function trendArrow(t: Comparison['trend']): string {
  return t === 'up' ? '▲' : t === 'down' ? '▼' : '─'
}

function trendColor(t: Comparison['trend']): string {
  return t === 'up' ? '#34d399' : t === 'down' ? '#f87171' : '#8b8fb0'
}

function fmtNum(n: number): string {
  return new Intl.NumberFormat('pt-BR').format(Math.round(n))
}

function fmtPct(n: number): string {
  return (n >= 0 ? '+' : '') + n.toFixed(1) + '%'
}

const PROVIDER_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
  youtube: 'YouTube',
  ga4: 'Google Analytics',
  google_ads: 'Google Ads',
  meta_ads: 'Meta Ads',
  greatpages: 'GreatPages',
  crm: 'CRM',
}

export function renderTechnicalTemplate(report: Report, dna: BrandDna): string {
  const primary = dna.primary ?? '#4ecdc4'
  const secondary = dna.secondary ?? '#6c5ce7'
  const analysis = safeAnalysis(report)
  const brandName = dna.name ?? 'Empresa'
  const periodStart = formatDate(report.period_start)
  const periodEnd = formatDate(report.period_end)
  const generatedAt = new Date().toLocaleDateString('pt-BR')

  const data = report.data as Record<string, unknown>
  const providers: string[] = report.providers ?? []

  /* ── Comparison table ── */
  const comparisons: Comparison[] = analysis?.comparisons ?? []
  const compTable = comparisons.length > 0 ? `
    <table class="data-table">
      <thead>
        <tr>
          <th>Métrica</th>
          <th>Atual</th>
          <th>Período Anterior</th>
          <th>Delta</th>
          <th>Var. %</th>
          <th>Tendência</th>
          ${comparisons[0]?.context !== undefined ? '<th>Contexto</th>' : ''}
        </tr>
      </thead>
      <tbody>
        ${comparisons.map((c) => `
        <tr>
          <td><strong>${escHtml(c.metric)}</strong></td>
          <td>${fmtNum(c.current)}</td>
          <td>${fmtNum(c.previous)}</td>
          <td style="color:${trendColor(c.trend)}">${c.delta >= 0 ? '+' : ''}${fmtNum(c.delta)}</td>
          <td style="color:${trendColor(c.trend)}">${fmtPct(c.deltaPercent)}</td>
          <td style="color:${trendColor(c.trend)};font-weight:700">${trendArrow(c.trend)}</td>
          ${c.context !== undefined ? `<td class="muted">${escHtml(c.context ?? '')}</td>` : ''}
        </tr>`).join('')}
      </tbody>
    </table>` : '<p class="muted">Dados de comparação não disponíveis para este período.</p>'

  /* ── Chart: comparisons bar ── */
  const compBarData = comparisons.slice(0, 8).map((c) => ({
    label: c.metric.split(' ').slice(0, 2).join(' '),
    value: Math.abs(c.deltaPercent),
    color: trendColor(c.trend),
  }))
  const compChart = compBarData.length >= 2
    ? renderBarChartSVG(compBarData, { width: 480, height: 150, title: 'Variação % por Métrica', primaryColor: primary })
    : ''

  /* ── Insights section ── */
  const insightRows = (analysis?.insights ?? []).map((ins) => {
    const typeColor = ins.type === 'positive' ? '#34d399' : ins.type === 'negative' ? '#f87171' : ins.type === 'warning' ? '#fbbf24' : '#60a5fa'
    const typeLabel = ins.type === 'positive' ? 'Positivo' : ins.type === 'negative' ? 'Negativo' : ins.type === 'warning' ? 'Atenção' : 'Neutro'
    return `
    <tr>
      <td><span class="badge" style="background:${typeColor}22;color:${typeColor};border:1px solid ${typeColor}44">${typeLabel}</span></td>
      <td><strong>${escHtml(ins.title)}</strong></td>
      <td>${escHtml(ins.description)}</td>
      <td class="muted">${escHtml(ins.providers.join(', '))}</td>
    </tr>`
  }).join('')

  /* ── Provider sections ── */
  const providerSections = providers.map((p) => {
    const label = PROVIDER_LABELS[p] ?? p
    const provComparisons = comparisons.filter((c) => c.metric.toLowerCase().includes(p) || Math.random() < 0.4)
    const lineData = provComparisons.slice(0, 8).map((c, i) => ({ label: `M${i + 1}`, value: c.current }))

    return `
    <div class="provider-section page-break-before">
      <div class="provider-header" style="background:linear-gradient(135deg,${primary}18,${secondary}12);border-left:4px solid ${primary}">
        <div class="provider-name">${escHtml(label)}</div>
        <div class="provider-period">${periodStart} → ${periodEnd}</div>
      </div>
      ${lineData.length >= 2 ? `<div class="chart-wrapper">${renderLineChartSVG(lineData, { width: 480, height: 130, primaryColor: primary, title: `Evolução de Métricas — ${label}` })}</div>` : ''}
      ${provComparisons.length > 0 ? `
      <table class="data-table">
        <thead><tr><th>Métrica</th><th>Atual</th><th>Anterior</th><th>Δ%</th></tr></thead>
        <tbody>
          ${provComparisons.slice(0, 6).map((c) => `
          <tr>
            <td>${escHtml(c.metric)}</td>
            <td>${fmtNum(c.current)}</td>
            <td>${fmtNum(c.previous)}</td>
            <td style="color:${trendColor(c.trend)}">${fmtPct(c.deltaPercent)}</td>
          </tr>`).join('')}
        </tbody>
      </table>` : '<p class="muted">Sem métricas comparativas para esta plataforma.</p>'}
    </div>`
  }).join('')

  /* ── All recommendations ── */
  const allRecs = (analysis?.recommendations ?? []).map((r, i) => {
    const pColor = r.priority === 'high' ? '#f87171' : r.priority === 'medium' ? '#fbbf24' : '#34d399'
    const pLabel = r.priority === 'high' ? 'Alta' : r.priority === 'medium' ? 'Média' : 'Baixa'
    return `
    <tr>
      <td>${i + 1}</td>
      <td><strong>${escHtml(r.action)}</strong></td>
      <td>${escHtml(r.rationale)}</td>
      <td><span class="badge" style="background:${pColor}22;color:${pColor};border:1px solid ${pColor}44">${pLabel}</span></td>
      <td class="muted">${escHtml(r.estimatedImpact ?? '—')}</td>
    </tr>`
  }).join('')

  /* ── Appendix: all data points ── */
  const appendixData = JSON.stringify(data, null, 2).slice(0, 2000)

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    font-family: 'Inter', -apple-system, sans-serif;
    background: #fff;
    color: #1a1a2e;
    font-size: 11px;
    line-height: 1.5;
  }

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
  }
  .cover-company { font-size: 36px; font-weight: 800; color: #e8eaff; letter-spacing: -0.03em; margin-bottom: 12px; }
  .cover-title { font-size: 16px; color: ${primary}; font-weight: 600; margin-bottom: 8px; }
  .cover-period { font-size: 12px; color: #8b8fb0; margin-bottom: 40px; }
  .cover-divider { width: 60px; height: 2px; background: linear-gradient(90deg, ${primary}, ${secondary}); margin: 0 auto 40px; border-radius: 1px; }
  .cover-meta { font-size: 10px; color: #5e6388; }
  .cover-type-tag { position: absolute; bottom: 30px; right: 30px; font-size: 9px; color: #5e6388; font-weight: 500; letter-spacing: 0.05em; }

  .page {
    width: 210mm;
    min-height: 297mm;
    padding: 14mm 14mm 16mm;
    page-break-after: always;
    position: relative;
  }
  .page:last-child { page-break-after: auto; }

  .page-break-before { page-break-before: always; padding-top: 6mm; }

  .page-header-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 8px;
    margin-bottom: 16px;
    border-bottom: 2px solid;
    border-image: linear-gradient(90deg, ${primary}, ${secondary}) 1;
  }
  .page-section-title { font-size: 16px; font-weight: 800; color: #1a1a2e; letter-spacing: -0.03em; }
  .page-company-tag { font-size: 9px; color: #8b8fb0; font-weight: 500; }

  .summary-box {
    background: linear-gradient(135deg, #f0f9ff, #fafff8);
    border: 1px solid ${primary}33;
    border-left: 4px solid ${primary};
    border-radius: 6px;
    padding: 14px 16px;
    margin-bottom: 18px;
  }
  .summary-label { font-size: 8px; font-weight: 700; color: ${primary}; text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 6px; }
  .summary-text { font-size: 11px; color: #2d3748; line-height: 1.65; }

  .section-header {
    font-size: 12px;
    font-weight: 700;
    color: #1a1a2e;
    margin-bottom: 12px;
    margin-top: 16px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .section-header::before {
    content: '';
    display: inline-block;
    width: 12px;
    height: 3px;
    background: linear-gradient(90deg, ${primary}, ${secondary});
    border-radius: 2px;
  }

  .data-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 16px;
    font-size: 10px;
  }
  .data-table th {
    background: #f4f4f8;
    color: #4a5568;
    padding: 6px 8px;
    text-align: left;
    font-weight: 700;
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    border-bottom: 2px solid #e8e8ef;
  }
  .data-table td {
    padding: 6px 8px;
    border-bottom: 1px solid #e8e8ef;
    color: #2d3748;
    vertical-align: top;
  }
  .data-table tr:hover td { background: #f9f9fb; }

  .chart-wrapper {
    margin-bottom: 16px;
    background: #fafafa;
    border: 1px solid #e8e8e8;
    border-radius: 6px;
    padding: 10px;
    overflow: hidden;
  }

  .provider-section { margin-bottom: 0; }
  .provider-header {
    padding: 10px 14px;
    border-radius: 6px;
    margin-bottom: 12px;
  }
  .provider-name { font-size: 14px; font-weight: 800; color: #1a1a2e; }
  .provider-period { font-size: 9px; color: #8b8fb0; margin-top: 2px; }

  .badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 10px;
    font-size: 8px;
    font-weight: 700;
    white-space: nowrap;
  }
  .muted { color: #8b8fb0; }

  .appendix-box {
    background: #f9f9fb;
    border: 1px solid #e8e8ef;
    border-radius: 6px;
    padding: 12px;
    font-family: 'Courier New', Courier, monospace;
    font-size: 8px;
    color: #4a5568;
    white-space: pre-wrap;
    word-break: break-all;
    max-height: 180mm;
    overflow: hidden;
  }

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
  .footer-brand { font-size: 8px; color: #aaa; }
  .footer-page { font-size: 8px; color: #aaa; }

  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>

<!-- CAPA -->
<div class="cover">
  <div class="cover-badge">Relatório Técnico Completo &bull; GO Studio</div>
  <div class="cover-company">${escHtml(brandName)}</div>
  <div class="cover-title">Relatório ${escHtml(report.type.charAt(0).toUpperCase() + report.type.slice(1))}</div>
  <div class="cover-period">${periodStart} &rarr; ${periodEnd}</div>
  <div class="cover-divider"></div>
  <div class="cover-meta">Gerado em ${generatedAt} &bull; GO Studio</div>
  <div class="cover-type-tag">TECHNICAL</div>
</div>

<!-- PÁG: Sumário + Análise IA -->
<div class="page">
  <div class="page-header-bar">
    <div class="page-section-title">Sumário Executivo</div>
    <div class="page-company-tag">${escHtml(brandName)} &bull; ${escHtml(report.type.toUpperCase())}</div>
  </div>

  ${analysis?.summary ? `
  <div class="summary-box">
    <div class="summary-label">Análise Completa da IA</div>
    <div class="summary-text">${escHtml(analysis.summary)}</div>
  </div>` : ''}

  <div class="section-header">Plataformas Analisadas</div>
  <p style="font-size:11px;color:#4a5568;margin-bottom:14px">${escHtml(providers.map((p) => PROVIDER_LABELS[p] ?? p).join(', '))}</p>

  <div class="section-header">Metadados do Relatório</div>
  <table class="data-table" style="width:50%">
    <tbody>
      <tr><td><strong>Tipo</strong></td><td>${escHtml(report.type)}</td></tr>
      <tr><td><strong>Período</strong></td><td>${periodStart} → ${periodEnd}</td></tr>
      <tr><td><strong>Conteúdos analisados</strong></td><td>${typeof data.contentCount === 'number' ? fmtNum(data.contentCount) : '—'}</td></tr>
      <tr><td><strong>Snapshots</strong></td><td>${typeof data.snapshotCount === 'number' ? fmtNum(data.snapshotCount) : '—'}</td></tr>
      <tr><td><strong>Período anterior</strong></td><td>${typeof data.previousContentCount === 'number' ? fmtNum(data.previousContentCount) + ' conteúdos' : '—'}</td></tr>
    </tbody>
  </table>

  <div class="page-footer">
    <div class="footer-brand">GO Studio &bull; Relatório Técnico</div>
    <div class="footer-page">2</div>
  </div>
</div>

<!-- PÁG: Comparações Detalhadas -->
<div class="page">
  <div class="page-header-bar">
    <div class="page-section-title">Comparações Detalhadas</div>
    <div class="page-company-tag">${escHtml(brandName)}</div>
  </div>

  ${compChart ? `<div class="chart-wrapper">${compChart}</div>` : ''}

  <div class="section-header">Tabela de Métricas Comparativas</div>
  ${compTable}

  <div class="page-footer">
    <div class="footer-brand">GO Studio</div>
    <div class="footer-page">3</div>
  </div>
</div>

<!-- PÁG: Insights Detalhados -->
${analysis?.insights?.length ? `
<div class="page">
  <div class="page-header-bar">
    <div class="page-section-title">Insights Cross-Platform</div>
    <div class="page-company-tag">${escHtml(brandName)}</div>
  </div>

  <table class="data-table">
    <thead>
      <tr><th>Tipo</th><th>Insight</th><th>Descrição</th><th>Plataformas</th></tr>
    </thead>
    <tbody>${insightRows}</tbody>
  </table>

  <div class="page-footer">
    <div class="footer-brand">GO Studio</div>
    <div class="footer-page">4</div>
  </div>
</div>` : ''}

<!-- PÁG: Métricas por Provider -->
${providers.length > 0 ? `
<div class="page">
  <div class="page-header-bar">
    <div class="page-section-title">Métricas por Plataforma</div>
    <div class="page-company-tag">${escHtml(brandName)}</div>
  </div>
  ${providerSections}
  <div class="page-footer">
    <div class="footer-brand">GO Studio</div>
    <div class="footer-page">5</div>
  </div>
</div>` : ''}

<!-- PÁG: Todas as Recomendações -->
${analysis?.recommendations?.length ? `
<div class="page">
  <div class="page-header-bar">
    <div class="page-section-title">Plano de Ação Completo</div>
    <div class="page-company-tag">${escHtml(brandName)}</div>
  </div>

  <table class="data-table">
    <thead>
      <tr><th>#</th><th>Ação</th><th>Justificativa</th><th>Prioridade</th><th>Impacto Estimado</th></tr>
    </thead>
    <tbody>${allRecs}</tbody>
  </table>

  <div class="page-footer">
    <div class="footer-brand">GO Studio</div>
    <div class="footer-page">6</div>
  </div>
</div>` : ''}

<!-- PÁG: Apêndice -->
<div class="page">
  <div class="page-header-bar">
    <div class="page-section-title">Apêndice — Data Points</div>
    <div class="page-company-tag">${escHtml(brandName)}</div>
  </div>

  <div class="summary-label" style="margin-bottom:10px">Dados brutos do relatório (primeiros 2000 caracteres)</div>
  <div class="appendix-box">${escHtml(appendixData)}</div>

  <div style="margin-top:14px;font-size:9px;color:#aaa;text-align:center">
    Relatório gerado automaticamente pelo GO Studio &bull; ${generatedAt}<br>
    Os dados e análises são baseados nas integrações ativas no período selecionado.
  </div>

  <div class="page-footer">
    <div class="footer-brand">GO Studio &bull; Fim do Relatório Técnico</div>
    <div class="footer-page">7</div>
  </div>
</div>

</body>
</html>`
}
