/**
 * Engine principal de geracao de relatorios IA — ContIA 2.0
 *
 * Transforma metricas brutas em relatorios escritos profissionais via GPT-4o.
 * 3 chamadas paralelas + cache agressivo via hash.
 */

import { getOpenAIClient } from "./config";
import {
  aggregateByProvider,
  calculateDeltas,
  findTopContent,
  findOutliers,
  computeInputsHash,
  type AggregatedProvider,
} from "./report-aggregator";
import {
  buildSummaryHighlightsRecommendationsPrompt,
  buildInsightsWarningsPrompt,
  buildComparisonsNarrativePrompt,
  type PromptDataInput,
} from "./prompts/report-prompts";
import {
  ReportAnalysisSchema,
  SummaryHighlightsRecommendationsSchema,
  InsightsWarningsSchema,
  ComparisonsNarrativeSchema,
} from "./schemas/report-analysis";
import type {
  ContentItem,
  ProviderKey,
  ProviderSnapshot,
} from "@/types/providers";
import type {
  ReportAnalysis,
  ReportType,
  Comparison,
} from "@/types/reports";

/* ── ReportInput ─────────────────────────────────────────────────────────── */

export interface ReportInput {
  empresaId: string;
  periodStart: Date;
  periodEnd: Date;
  previousPeriodStart?: Date;
  previousPeriodEnd?: Date;
  providers: ProviderKey[];

  snapshots: ProviderSnapshot[];
  content: ContentItem[];
  previousContent?: ContentItem[];
  previousSnapshots?: ProviderSnapshot[];

  empresaName: string;
  empresaDna?: Record<string, unknown>;
  reportType: ReportType;
  language?: "pt-BR";
}

/* ── Cache (Supabase ai_analyses) ────────────────────────────────────────── */

async function checkCache(
  supabaseImport: () => Promise<{ createClient: () => Promise<import("@supabase/supabase-js").SupabaseClient> }>,
  empresaId: string,
  inputsHash: string,
  periodStart: Date,
  periodEnd: Date
): Promise<ReportAnalysis | null> {
  try {
    const { createClient } = await supabaseImport();
    const supabase = await createClient();

    const { data } = await supabase
      .from("ai_analyses")
      .select("analysis")
      .eq("empresa_id", empresaId)
      .eq("inputs_hash", inputsHash)
      .eq("period_start", periodStart.toISOString().split("T")[0])
      .eq("period_end", periodEnd.toISOString().split("T")[0])
      .eq("scope", "report")
      .limit(1)
      .single();

    if (data?.analysis) {
      const parsed = ReportAnalysisSchema.safeParse(data.analysis);
      if (parsed.success) return parsed.data as ReportAnalysis;
    }
  } catch {
    // Cache miss or DB error — proceed with generation
  }
  return null;
}

async function saveCache(
  supabaseImport: () => Promise<{ createClient: () => Promise<import("@supabase/supabase-js").SupabaseClient> }>,
  empresaId: string,
  inputsHash: string,
  periodStart: Date,
  periodEnd: Date,
  analysis: ReportAnalysis
): Promise<void> {
  try {
    const { createClient } = await supabaseImport();
    const supabase = await createClient();

    await supabase.from("ai_analyses").upsert(
      {
        empresa_id: empresaId,
        scope: "report",
        provider: null,
        period_start: periodStart.toISOString().split("T")[0],
        period_end: periodEnd.toISOString().split("T")[0],
        inputs_hash: inputsHash,
        analysis,
        generated_at: new Date().toISOString(),
      },
      { onConflict: "empresa_id,scope,provider,period_start,period_end,inputs_hash" }
    );
  } catch (err) {
    console.error("[report-generator] Erro ao salvar cache:", err);
  }
}

/* ── OpenAI call with retry ──────────────────────────────────────────────── */

async function callOpenAI<T>(
  model: "gpt-4o" | "gpt-4o-mini",
  temperature: number,
  system: string,
  user: string,
  schema: { safeParse: (data: unknown) => { success: boolean; data?: T; error?: { message?: string } } },
  maxRetries: number = 1
): Promise<T> {
  const openai = getOpenAIClient();

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await openai.chat.completions.create({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature,
      response_format: { type: "json_object" },
      max_tokens: model === "gpt-4o" ? 4096 : 2048,
    });

    const raw = response.choices[0]?.message?.content ?? "{}";

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      if (attempt < maxRetries) continue;
      throw new Error("IA retornou JSON invalido no relatorio");
    }

    const result = schema.safeParse(parsed);
    if (result.success) return result.data as T;

    if (attempt < maxRetries) {
      console.warn(
        `[report-generator] Validacao falhou (tentativa ${attempt + 1}), retentando...`,
        result.error
      );
      continue;
    }

    throw new Error(
      `IA retornou formato invalido apos ${maxRetries + 1} tentativas: ${
        result.error?.message ?? "schema mismatch"
      }`
    );
  }

  throw new Error("Falha inesperada na geracao do relatorio");
}

/* ── Formatar periodo ────────────────────────────────────────────────────── */

function formatPeriodLabel(start: Date, end: Date): string {
  const fmt = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  return `${fmt.format(start)} a ${fmt.format(end)}`;
}

/* ── Build prompt data ───────────────────────────────────────────────────── */

function buildPromptData(input: ReportInput, aggregated: Record<string, AggregatedProvider>): PromptDataInput {
  const topContent = findTopContent(input.content, 5);
  const outliers = findOutliers(input.content);

  return {
    empresaName: input.empresaName,
    reportType: input.reportType,
    periodLabel: formatPeriodLabel(input.periodStart, input.periodEnd),
    providers: input.providers,
    aggregated,
    topContent: topContent.map((c) => ({
      provider: c.provider,
      title: c.title,
      caption: c.caption?.slice(0, 200) ?? null,
      type: c.content_type,
      engagement:
        (c.metrics.likes ?? c.metrics.like_count ?? 0) +
        (c.metrics.comments ?? c.metrics.comments_count ?? 0) +
        (c.metrics.shares ?? c.metrics.share_count ?? 0),
      metrics: c.metrics,
    })),
    outliers: {
      high: outliers.high.map((c) => ({
        provider: c.provider,
        title: c.title,
        engagement:
          (c.metrics.likes ?? c.metrics.like_count ?? 0) +
          (c.metrics.comments ?? c.metrics.comments_count ?? 0),
      })),
      low: outliers.low.map((c) => ({
        provider: c.provider,
        title: c.title,
        engagement:
          (c.metrics.likes ?? c.metrics.like_count ?? 0) +
          (c.metrics.comments ?? c.metrics.comments_count ?? 0),
      })),
    },
    empresaDna: input.empresaDna,
  };
}

/* ── generateReportAnalysis — funcao publica principal ───────────────────── */

export async function generateReportAnalysis(input: ReportInput): Promise<ReportAnalysis> {
  // Lazy import to avoid issues in edge/build
  const supabaseImport = () => import("@/lib/supabase/server");

  // 1. Pre-processamento
  const currentAgg = aggregateByProvider(input.content, input.snapshots);

  // 2. Hash e cache check
  const inputsHash = computeInputsHash({
    empresaId: input.empresaId,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    providers: input.providers,
    reportType: input.reportType,
    contentIds: input.content.map((c) => c.id).sort(),
    snapshotIds: input.snapshots.map((s) => s.id).sort(),
  });

  const cached = await checkCache(
    supabaseImport,
    input.empresaId,
    inputsHash,
    input.periodStart,
    input.periodEnd
  );
  if (cached) return cached;

  // 3. Preparar dados para prompts
  const promptData = buildPromptData(input, currentAgg);

  // 4. Calcular comparisons (pre-IA)
  let rawComparisons: Comparison[] = [];
  if (input.previousContent && input.previousContent.length > 0) {
    const previousAgg = aggregateByProvider(
      input.previousContent,
      input.previousSnapshots ?? []
    );
    rawComparisons = calculateDeltas(currentAgg, previousAgg);
  }

  // 5. 3 chamadas em paralelo
  const prompt1 = buildSummaryHighlightsRecommendationsPrompt(promptData);
  const prompt2 = buildInsightsWarningsPrompt(promptData);
  const prompt3 = rawComparisons.length > 0
    ? buildComparisonsNarrativePrompt(rawComparisons)
    : null;

  const [summaryResult, insightsResult, comparisonsResult] = await Promise.all([
    callOpenAI(
      "gpt-4o",
      0.7,
      prompt1.system,
      prompt1.user,
      SummaryHighlightsRecommendationsSchema
    ),
    callOpenAI(
      "gpt-4o",
      0.5,
      prompt2.system,
      prompt2.user,
      InsightsWarningsSchema
    ),
    prompt3
      ? callOpenAI(
          "gpt-4o-mini",
          0.3,
          prompt3.system,
          prompt3.user,
          ComparisonsNarrativeSchema
        )
      : Promise.resolve({ comparisons: [] as Comparison[] }),
  ]);

  // 6. Montar resultado final
  const analysis: ReportAnalysis = {
    summary: summaryResult.summary,
    highlights: summaryResult.highlights,
    recommendations: summaryResult.recommendations,
    insights: insightsResult.insights,
    warnings: insightsResult.warnings,
    comparisons: comparisonsResult.comparisons,
  };

  // 7. Validacao final completa
  const finalValidation = ReportAnalysisSchema.safeParse(analysis);
  if (!finalValidation.success) {
    console.error("[report-generator] Validacao final falhou:", finalValidation.error);
    throw new Error("Erro na montagem do relatorio: validacao do schema falhou");
  }

  // 8. Salvar cache
  await saveCache(supabaseImport, input.empresaId, inputsHash, input.periodStart, input.periodEnd, analysis);

  return analysis;
}
