/**
 * Zod schemas para validacao da resposta IA de relatorios.
 * Batem 1:1 com os tipos em src/types/reports.ts.
 */

import { z } from "zod";

/* ── Componentes ──────────────────────────────────────────────────────────── */

export const HighlightSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  metric: z
    .object({
      label: z.string(),
      value: z.string(),
      delta: z.string().optional(),
    })
    .optional(),
  provider: z.string().optional(),
});

export const InsightSchema = z.object({
  type: z.enum(["positive", "negative", "neutral", "warning"]),
  title: z.string().min(1),
  description: z.string().min(10),
  providers: z.array(z.string()),
});

export const RecommendationSchema = z.object({
  action: z.string().min(10),
  rationale: z.string().min(10),
  priority: z.enum(["high", "medium", "low"]),
  estimatedImpact: z.string().optional(),
});

export const WarningSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(10),
  severity: z.enum(["info", "warning", "critical"]),
});

export const ComparisonSchema = z.object({
  metric: z.string(),
  current: z.number(),
  previous: z.number(),
  delta: z.number(),
  deltaPercent: z.number(),
  trend: z.enum(["up", "down", "flat"]),
  context: z.string().optional(),
});

/* ── Schema completo ─────────────────────────────────────────────────────── */

export const ReportAnalysisSchema = z.object({
  summary: z.string().min(20).max(5000),
  highlights: z.array(HighlightSchema).max(10),
  insights: z.array(InsightSchema).max(10),
  recommendations: z.array(RecommendationSchema).max(10),
  warnings: z.array(WarningSchema).max(10),
  comparisons: z.array(ComparisonSchema).max(30),
});

/* ── Schemas parciais para cada chamada IA ──────────────────────────────── */

export const SummaryHighlightsRecommendationsSchema = z.object({
  summary: z.string().min(20).max(5000),
  highlights: z.array(HighlightSchema).max(10),
  recommendations: z.array(RecommendationSchema).max(10),
});

export const InsightsWarningsSchema = z.object({
  insights: z.array(InsightSchema).max(10),
  warnings: z.array(WarningSchema).max(10),
});

export const ComparisonsNarrativeSchema = z.object({
  comparisons: z.array(ComparisonSchema).max(30),
});

/* ── Inferred types ──────────────────────────────────────────────────────── */

export type ReportAnalysisInput = z.infer<typeof ReportAnalysisSchema>;
export type SummaryHighlightsRecommendationsInput = z.infer<typeof SummaryHighlightsRecommendationsSchema>;
export type InsightsWarningsInput = z.infer<typeof InsightsWarningsSchema>;
export type ComparisonsNarrativeInput = z.infer<typeof ComparisonsNarrativeSchema>;
