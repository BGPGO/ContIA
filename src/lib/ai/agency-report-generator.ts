/**
 * Engine de geração de análise IA para o Relatório Agência — ContIA Wave 2
 * Squad E
 *
 * Dispara 4 prompts em paralelo (panorama, instagram, facebook, metaAds)
 * usando Claude Sonnet 4.6 via @anthropic-ai/sdk.
 * Cache em `ai_analyses` (scope='agency') igual ao report-generator.ts.
 */

import { getAnthropicClient, ANTHROPIC_MODELS } from "./anthropic";
import {
  buildPanoramaPrompt,
  buildInstagramPrompt,
  buildFacebookPrompt,
  buildMetaAdsPrompt,
} from "./prompts/agency-report-prompts";
import type { AgencyReportData, AgencyRecommendation } from "@/types/agency-report";
import { createHash } from "crypto";

/* ── Tipos públicos da análise ───────────────────────────────────────────── */

export interface AgencyReportAnalysis {
  panorama: {
    narrative: string;
    executiveBullets: string[];
  };
  instagram: {
    narrative: string;
    recommendations: AgencyRecommendation[];
  };
  facebook: {
    narrative: string;
    recommendations: AgencyRecommendation[];
  };
  metaAds: {
    narrative: string;
    recommendations: AgencyRecommendation[];
  };
}

/* ── Hash dos dados de entrada (para cache) ──────────────────────────────── */

function hashAgencyData(data: AgencyReportData): string {
  const key = JSON.stringify({
    empresaId: data.meta.empresaId,
    periodStart: data.meta.periodStart,
    periodEnd: data.meta.periodEnd,
    previousStart: data.meta.previousStart,
    previousEnd: data.meta.previousEnd,
    // KPIs principais
    igFollowers: data.instagram.perfil.followers.value,
    fbFollowers: data.facebook.perfil.pageFollowers.value,
    metaSpend: data.metaAds.overview.spend.value,
    metaLeads: data.metaAds.overview.leads.value,
    // IMPORTANTE 4: campos adicionais para invalidar cache quando dados mudam
    igPostsCount: data.instagram.feed.postsCount.value,
    fbPostsCount: data.facebook.posts.postsCount.value,
    metaTopCampaignsLength: data.metaAds.topCampaigns.length,
    // Invalida cache em 24h naturalmente (floor para dia UTC)
    dayBucket: Math.floor(Date.now() / 86400000),
  });
  return createHash("sha256").update(key).digest("hex").slice(0, 16);
}

/* ── Cache check/save via Supabase ai_analyses ───────────────────────────── */

// Tempo máximo de validade do cache: 24 horas
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

async function checkCache(
  empresaId: string,
  inputsHash: string,
  periodStart: string,
  periodEnd: string
): Promise<AgencyReportAnalysis | null> {
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    const { data } = await supabase
      .from("ai_analyses")
      .select("analysis, generated_at")
      .eq("empresa_id", empresaId)
      .eq("inputs_hash", inputsHash)
      .eq("period_start", periodStart)
      .eq("period_end", periodEnd)
      .eq("scope", "agency")
      .limit(1)
      .single();

    if (data?.analysis) {
      // IMPORTANTE 4: Verificar TTL — só usar cache se gerado nas últimas 24h
      if (data.generated_at) {
        const generatedAt = new Date(data.generated_at as string).getTime();
        if (Date.now() - generatedAt > CACHE_TTL_MS) {
          console.log(`[agency-report-generator] Cache expirado (>24h) para empresa ${empresaId}`);
          return null;
        }
      }
      return data.analysis as AgencyReportAnalysis;
    }
  } catch {
    // Cache miss ou erro de DB — prossegue com geração
  }
  return null;
}

async function saveCache(
  empresaId: string,
  inputsHash: string,
  periodStart: string,
  periodEnd: string,
  analysis: AgencyReportAnalysis
): Promise<void> {
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    await supabase.from("ai_analyses").upsert(
      {
        empresa_id: empresaId,
        scope: "agency",
        provider: null,
        period_start: periodStart,
        period_end: periodEnd,
        inputs_hash: inputsHash,
        analysis,
        generated_at: new Date().toISOString(),
      },
      {
        onConflict:
          "empresa_id,scope,provider,period_start,period_end,inputs_hash",
      }
    );
  } catch (err) {
    console.error("[agency-report-generator] Erro ao salvar cache:", err);
  }
}

/* ── Chamada ao Claude via Anthropic SDK ─────────────────────────────────── */

async function callClaude<T>(
  system: string,
  user: string,
  maxTokens: number = 4096
): Promise<T> {
  const client = getAnthropicClient();

  const response = await client.messages.create({
    model: ANTHROPIC_MODELS.sonnet, // claude-sonnet-4-6
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: user }],
  });

  const raw =
    response.content[0]?.type === "text" ? response.content[0].text : "{}";

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(
      `[agency-report-generator] Claude retornou JSON inválido: ${raw.slice(0, 200)}`
    );
  }

  return parsed as T;
}

/* ── Validators básicos (evitar crash se IA omitir campo) ────────────────── */

function normalizePanorama(raw: unknown): AgencyReportAnalysis["panorama"] {
  const r = raw as Record<string, unknown>;
  return {
    narrative:
      typeof r?.narrative === "string" ? r.narrative : "Análise não disponível.",
    executiveBullets: Array.isArray(r?.executiveBullets)
      ? (r.executiveBullets as string[]).filter((b) => typeof b === "string")
      : [],
  };
}

function normalizeNetworkSection(
  raw: unknown
): { narrative: string; recommendations: AgencyRecommendation[] } {
  const r = raw as Record<string, unknown>;
  const narrative =
    typeof r?.narrative === "string" ? r.narrative : "Análise não disponível.";
  const recommendations: AgencyRecommendation[] = Array.isArray(
    r?.recommendations
  )
    ? (r.recommendations as AgencyRecommendation[]).filter(
        (rec) =>
          typeof rec?.action === "string" &&
          typeof rec?.priority === "string" &&
          typeof rec?.rationale === "string"
      )
    : [];
  return { narrative, recommendations };
}

/* ── generateAgencyReportAnalysis — função pública principal ─────────────── */

export async function generateAgencyReportAnalysis(
  data: AgencyReportData
): Promise<AgencyReportAnalysis> {
  const { meta } = data;
  const inputsHash = hashAgencyData(data);

  // 1. Verificar cache
  const cached = await checkCache(
    meta.empresaId,
    inputsHash,
    meta.periodStart,
    meta.periodEnd
  );
  if (cached) {
    console.log(
      `[agency-report-generator] Cache hit para empresa ${meta.empresaId}`
    );
    return cached;
  }

  // 2. Montar prompts
  const promptPanorama = buildPanoramaPrompt(data);
  const promptInstagram = buildInstagramPrompt(data.instagram, meta);
  const promptFacebook = buildFacebookPrompt(data.facebook, meta);
  const promptMetaAds = buildMetaAdsPrompt(data.metaAds, meta);

  // 3. Disparar 4 chamadas em paralelo
  const [rawPanorama, rawInstagram, rawFacebook, rawMetaAds] =
    await Promise.all([
      callClaude(promptPanorama.system, promptPanorama.user, 3000),
      callClaude(promptInstagram.system, promptInstagram.user, 3000),
      callClaude(promptFacebook.system, promptFacebook.user, 3000),
      callClaude(promptMetaAds.system, promptMetaAds.user, 3000),
    ]);

  // 4. Normalizar saídas
  const analysis: AgencyReportAnalysis = {
    panorama: normalizePanorama(rawPanorama),
    instagram: normalizeNetworkSection(rawInstagram),
    facebook: normalizeNetworkSection(rawFacebook),
    metaAds: normalizeNetworkSection(rawMetaAds),
  };

  // 5. Salvar cache
  await saveCache(
    meta.empresaId,
    inputsHash,
    meta.periodStart,
    meta.periodEnd,
    analysis
  );

  return analysis;
}
