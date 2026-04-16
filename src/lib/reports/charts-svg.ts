/**
 * Charts server-side em SVG puro — sem dependência de DOM/browser.
 * Renderiza direto em strings SVG para embutir nos templates HTML do PDF.
 */

/* ── Types ────────────────────────────────────────────────────────────────── */

export interface TimeSeriesPoint {
  label: string
  value: number
}

export interface BarPoint {
  label: string
  value: number
  color?: string
}

export interface PiePoint {
  label: string
  value: number
  color?: string
}

export interface ChartOptions {
  width?: number
  height?: number
  primaryColor?: string
  secondaryColor?: string
  showLabels?: boolean
  showGrid?: boolean
  title?: string
}

/* ── Paleta padrão ────────────────────────────────────────────────────────── */

const DEFAULT_COLORS = [
  '#4ecdc4',
  '#6c5ce7',
  '#fbbf24',
  '#f87171',
  '#34d399',
  '#60a5fa',
  '#e1306c',
  '#a29bfe',
]

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/* ── Line Chart ───────────────────────────────────────────────────────────── */

export function renderLineChartSVG(
  data: TimeSeriesPoint[],
  options: ChartOptions = {}
): string {
  const {
    width = 500,
    height = 200,
    primaryColor = '#4ecdc4',
    showLabels = true,
    showGrid = true,
    title,
  } = options

  if (data.length === 0) return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"></svg>`

  const paddingTop = title ? 32 : 16
  const paddingBottom = showLabels ? 36 : 16
  const paddingLeft = 40
  const paddingRight = 16

  const chartWidth = width - paddingLeft - paddingRight
  const chartHeight = height - paddingTop - paddingBottom

  const values = data.map((d) => d.value)
  const maxVal = Math.max(...values) * 1.1 || 1
  const minVal = Math.min(0, Math.min(...values))

  const toX = (i: number) => paddingLeft + (i / (data.length - 1 || 1)) * chartWidth
  const toY = (v: number) => paddingTop + chartHeight - ((v - minVal) / (maxVal - minVal)) * chartHeight

  // Grid lines
  let gridLines = ''
  if (showGrid) {
    const steps = 4
    for (let i = 0; i <= steps; i++) {
      const y = paddingTop + (i / steps) * chartHeight
      const val = Math.round(maxVal - (i / steps) * (maxVal - minVal))
      gridLines += `<line x1="${paddingLeft}" y1="${y}" x2="${paddingLeft + chartWidth}" y2="${y}" stroke="#1e2348" stroke-width="1"/>`
      gridLines += `<text x="${paddingLeft - 5}" y="${y + 4}" font-size="9" fill="#5e6388" text-anchor="end">${val}</text>`
    }
  }

  // Path
  const points = data.map((d, i) => `${toX(i)},${toY(d.value)}`).join(' ')
  const linePath = `M ${data.map((d, i) => `${toX(i)} ${toY(d.value)}`).join(' L ')}`

  // Area fill path
  const areaPath = `${linePath} L ${toX(data.length - 1)} ${toY(minVal)} L ${toX(0)} ${toY(minVal)} Z`

  // X labels
  let xLabels = ''
  if (showLabels) {
    const step = Math.max(1, Math.floor(data.length / 6))
    data.forEach((d, i) => {
      if (i % step === 0 || i === data.length - 1) {
        xLabels += `<text x="${toX(i)}" y="${height - 8}" font-size="9" fill="#5e6388" text-anchor="middle">${escapeXml(d.label)}</text>`
      }
    })
  }

  // Data points
  const dots = data
    .map((d, i) => `<circle cx="${toX(i)}" cy="${toY(d.value)}" r="3" fill="${primaryColor}" stroke="#141736" stroke-width="1.5"/>`)
    .join('')

  const titleTag = title
    ? `<text x="${width / 2}" y="18" font-size="11" fill="#8b8fb0" text-anchor="middle" font-weight="600">${escapeXml(title)}</text>`
    : ''

  const gradientId = `lg${Math.random().toString(36).slice(2, 7)}`

  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="${gradientId}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${primaryColor}" stop-opacity="0.25"/>
      <stop offset="100%" stop-color="${primaryColor}" stop-opacity="0.02"/>
    </linearGradient>
  </defs>
  ${titleTag}
  ${gridLines}
  <path d="${areaPath}" fill="url(#${gradientId})"/>
  <path d="${linePath}" fill="none" stroke="${primaryColor}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
  ${dots}
  ${xLabels}
</svg>`
}

/* ── Bar Chart ────────────────────────────────────────────────────────────── */

export function renderBarChartSVG(
  data: BarPoint[],
  options: ChartOptions = {}
): string {
  const {
    width = 500,
    height = 200,
    primaryColor = '#4ecdc4',
    showLabels = true,
    title,
  } = options

  if (data.length === 0) return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"></svg>`

  const paddingTop = title ? 32 : 16
  const paddingBottom = showLabels ? 44 : 16
  const paddingLeft = 40
  const paddingRight = 16

  const chartWidth = width - paddingLeft - paddingRight
  const chartHeight = height - paddingTop - paddingBottom

  const maxVal = Math.max(...data.map((d) => d.value)) * 1.1 || 1
  const barWidth = (chartWidth / data.length) * 0.6
  const barGap = (chartWidth / data.length) * 0.4

  // Grid
  let gridLines = ''
  const steps = 4
  for (let i = 0; i <= steps; i++) {
    const y = paddingTop + (i / steps) * chartHeight
    const val = Math.round(maxVal - (i / steps) * maxVal)
    gridLines += `<line x1="${paddingLeft}" y1="${y}" x2="${paddingLeft + chartWidth}" y2="${y}" stroke="#1e2348" stroke-width="1"/>`
    gridLines += `<text x="${paddingLeft - 5}" y="${y + 4}" font-size="9" fill="#5e6388" text-anchor="end">${val}</text>`
  }

  // Bars
  const bars = data
    .map((d, i) => {
      const barH = (d.value / maxVal) * chartHeight
      const x = paddingLeft + i * (barWidth + barGap) + barGap / 2
      const y = paddingTop + chartHeight - barH
      const color = d.color ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length] ?? primaryColor
      const label = escapeXml(d.label.length > 8 ? d.label.slice(0, 7) + '…' : d.label)
      const valueLabel = d.value >= 1000 ? `${(d.value / 1000).toFixed(1)}k` : String(d.value)

      return `
      <rect x="${x}" y="${y}" width="${barWidth}" height="${barH}" rx="3" fill="${color}" opacity="0.85"/>
      ${showLabels ? `<text x="${x + barWidth / 2}" y="${height - 28}" font-size="8" fill="#5e6388" text-anchor="middle" transform="rotate(-30,${x + barWidth / 2},${height - 28})">${label}</text>` : ''}
      <text x="${x + barWidth / 2}" y="${y - 4}" font-size="8" fill="${color}" text-anchor="middle">${valueLabel}</text>`
    })
    .join('')

  const titleTag = title
    ? `<text x="${width / 2}" y="18" font-size="11" fill="#8b8fb0" text-anchor="middle" font-weight="600">${escapeXml(title)}</text>`
    : ''

  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  ${titleTag}
  ${gridLines}
  ${bars}
</svg>`
}

/* ── Pie Chart ────────────────────────────────────────────────────────────── */

export function renderPieChartSVG(
  data: PiePoint[],
  options: ChartOptions = {}
): string {
  const { width = 300, height = 200, title } = options

  if (data.length === 0) return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"></svg>`

  const cx = width * 0.38
  const cy = height / 2
  const radius = Math.min(cx, cy) - 20

  const total = data.reduce((s, d) => s + d.value, 0) || 1

  let startAngle = -Math.PI / 2
  const slices = data.map((d, i) => {
    const angle = (d.value / total) * 2 * Math.PI
    const endAngle = startAngle + angle
    const x1 = cx + radius * Math.cos(startAngle)
    const y1 = cy + radius * Math.sin(startAngle)
    const x2 = cx + radius * Math.cos(endAngle)
    const y2 = cy + radius * Math.sin(endAngle)
    const largeArc = angle > Math.PI ? 1 : 0
    const color = d.color ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length] ?? '#4ecdc4'
    const midAngle = startAngle + angle / 2
    const result = { x1, y1, x2, y2, largeArc, color, midAngle, d }
    startAngle = endAngle
    return result
  })

  const paths = slices
    .map(
      (s) =>
        `<path d="M ${cx} ${cy} L ${s.x1} ${s.y1} A ${radius} ${radius} 0 ${s.largeArc} 1 ${s.x2} ${s.y2} Z" fill="${s.color}" opacity="0.9" stroke="#0c0f24" stroke-width="1.5"/>`
    )
    .join('')

  // Legend
  const legendX = cx + radius + 16
  const legend = slices
    .map((s, i) => {
      const pct = Math.round((s.d.value / total) * 100)
      const label = s.d.label.length > 14 ? s.d.label.slice(0, 13) + '…' : s.d.label
      return `
      <rect x="${legendX}" y="${14 + i * 20}" width="10" height="10" rx="2" fill="${s.color}"/>
      <text x="${legendX + 14}" y="${23 + i * 20}" font-size="9" fill="#8b8fb0">${escapeXml(label)} (${pct}%)</text>`
    })
    .join('')

  const titleTag = title
    ? `<text x="${width / 2}" y="14" font-size="11" fill="#8b8fb0" text-anchor="middle" font-weight="600">${escapeXml(title)}</text>`
    : ''

  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  ${titleTag}
  ${paths}
  ${legend}
</svg>`
}

/* ── KPI Card SVG ─────────────────────────────────────────────────────────── */

export function renderKpiCardSVG(
  label: string,
  value: string,
  delta?: string,
  options: { color?: string; width?: number; height?: number } = {}
): string {
  const { color = '#4ecdc4', width = 160, height = 80 } = options

  const deltaPositive = delta ? !delta.startsWith('-') : null
  const deltaColor = deltaPositive === null ? '#5e6388' : deltaPositive ? '#34d399' : '#f87171'
  const deltaArrow = deltaPositive === null ? '' : deltaPositive ? '↑ ' : '↓ '

  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" rx="8" fill="#141736" stroke="#1e2348" stroke-width="1"/>
  <rect width="4" height="${height}" rx="2" fill="${color}"/>
  <text x="14" y="20" font-size="9" fill="#8b8fb0" font-weight="500">${escapeXml(label.toUpperCase())}</text>
  <text x="14" y="50" font-size="22" fill="#e8eaff" font-weight="700">${escapeXml(value)}</text>
  ${delta ? `<text x="14" y="68" font-size="9" fill="${deltaColor}">${deltaArrow}${escapeXml(delta)} vs período anterior</text>` : ''}
</svg>`
}
