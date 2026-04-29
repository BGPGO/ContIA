/**
 * Tipos de relatórios e análises IA — ContIA 2.0
 *
 * Batendo com as tabelas `reports` e `scheduled_reports` do schema SQL.
 */

import type { ProviderKey } from './providers'

/* ── Report Types ─────────────────────────────────────────────────────────── */

export type ReportType = 'weekly' | 'monthly' | 'quarterly' | 'custom' | 'agency'
export type ReportStatus = 'generating' | 'ready' | 'failed'

/* ── Report (reports row) ─────────────────────────────────────────────────── */

export interface Report {
  id: string
  empresa_id: string
  user_id: string
  name: string
  type: ReportType
  providers: string[]
  period_start: string
  period_end: string
  data: Record<string, unknown>
  ai_analysis: ReportAnalysis | Record<string, unknown>
  pdf_url: string | null
  status: ReportStatus
  created_at: string
}

/* ── ScheduledReport (scheduled_reports row) ──────────────────────────────── */

export interface ScheduledReport {
  id: string
  empresa_id: string
  user_id: string
  name: string
  schedule_cron: string
  providers: string[]
  template_id: string | null
  recipients: string[]
  last_run_at: string | null
  next_run_at: string | null
  active: boolean
  created_at: string
  updated_at: string
}

/* ── Componentes da análise IA ────────────────────────────────────────────── */

export interface Highlight {
  title: string
  description: string
  metric?: {
    label: string
    value: string
    delta?: string
  }
  provider?: ProviderKey | string
}

export interface Insight {
  type: 'positive' | 'negative' | 'neutral' | 'warning'
  title: string
  description: string
  providers: string[]
}

export interface Recommendation {
  action: string
  rationale: string
  priority: 'high' | 'medium' | 'low'
  estimatedImpact?: string
}

export interface Warning {
  title: string
  description: string
  severity: 'info' | 'warning' | 'critical'
}

export interface Comparison {
  metric: string
  current: number
  previous: number
  delta: number
  deltaPercent: number
  trend: 'up' | 'down' | 'flat'
  context?: string
}

/* ── ReportAnalysis — output completo da IA ───────────────────────────────── */

export interface ReportAnalysis {
  summary: string
  highlights: Highlight[]
  insights: Insight[]
  recommendations: Recommendation[]
  warnings: Warning[]
  comparisons: Comparison[]
}
