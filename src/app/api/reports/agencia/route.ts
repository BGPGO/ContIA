/**
 * POST /api/reports/agencia
 *
 * Agrega dados das plataformas (Instagram, Facebook, Meta Ads) em um
 * AgencyReportData estruturado, sem chamar IA.
 * Squad E (Wave 2) consome este endpoint para gerar análise textual.
 * Squad F (Wave 3) adicionou suporte a ?format=pdf.
 *
 * Auth: Supabase user session obrigatória.
 * Body: { empresaId: string, periodStart: string, periodEnd: string, providers?: string[] }
 * Query: ?format=pdf → gera PDF e retorna { reportId, pdfUrl }
 *        (sem format ou ?format=json) → retorna { data: AgencyReportData }
 */

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getAdminSupabase } from "@/lib/supabase/admin";
import type { AgencyReportData } from "@/types/agency-report";
import {
  aggregateInstagram,
  aggregateFacebook,
  aggregateMetaAds,
  aggregatePanorama,
  type SnapshotRow,
  type ContentRow,
} from "@/lib/reports/agency-aggregator";
import { generateAgencyReportAnalysis } from "@/lib/ai/agency-report-generator";
import { isAnthropicConfigured } from "@/lib/ai/anthropic";
import { generateAgencyPDF } from "@/lib/reports/agency-pdf-generator";
import { uploadReportPdf, buildPdfPath } from "@/lib/reports/storage";

/* ── Rate limit por empresa (in-memory) ──────────────────────────────────── */

const agenciaRateLimitMap = new Map<string, number>();
const AGENCIA_RATE_LIMIT_MS = 5 * 60 * 1000; // 5 minutos

function checkEmpresaRateLimit(empresaId: string): boolean {
  const lastRun = agenciaRateLimitMap.get(empresaId);
  if (lastRun && Date.now() - lastRun < AGENCIA_RATE_LIMIT_MS) return false;
  agenciaRateLimitMap.set(empresaId, Date.now());
  return true;
}

/* ── Input validation ──────────────────────────────────────────────────── */

const RequestSchema = z.object({
  empresaId: z.string().uuid(),
  periodStart: z
    .string()
    .refine((s) => !isNaN(Date.parse(s)), { message: "periodStart inválido" }),
  periodEnd: z
    .string()
    .refine((s) => !isNaN(Date.parse(s)), { message: "periodEnd inválido" }),
  providers: z
    .array(z.enum(["instagram", "facebook", "meta_ads"]))
    .optional()
    .default(["instagram", "facebook", "meta_ads"]),
});

/* ── Período anterior ──────────────────────────────────────────────────── */

function getPreviousPeriod(start: Date, end: Date): { start: Date; end: Date } {
  const durationMs = end.getTime() - start.getTime();
  return {
    start: new Date(start.getTime() - durationMs),
    end: new Date(start.getTime()),
  };
}

/* ── POST handler ──────────────────────────────────────────────────────── */

export async function POST(req: NextRequest) {
  // Query param: ?format=pdf
  const formatParam = req.nextUrl.searchParams.get("format");
  const wantsPdf = formatParam === "pdf";

  // 1. Parse body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body JSON inválido" }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((i) => i.message).join("; ") },
      { status: 400 }
    );
  }

  const { empresaId, periodStart, periodEnd, providers } = parsed.data;

  // 2. Auth
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const admin = getAdminSupabase();

  // 3. Verificar acesso à empresa
  const { data: empresa } = await admin
    .from("empresas")
    .select("id, nome")
    .eq("id", empresaId)
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (!empresa) {
    return NextResponse.json(
      { error: "Empresa não encontrada ou sem permissão" },
      { status: 404 }
    );
  }

  // 3b. Rate limit — apenas para format=pdf (geração IA é cara)
  if (wantsPdf && !checkEmpresaRateLimit(empresaId)) {
    return NextResponse.json(
      { error: "Aguarde 5 minutos entre relatórios" },
      { status: 429 }
    );
  }

  const pStart = new Date(periodStart);
  const pEnd = new Date(periodEnd);
  const prev = getPreviousPeriod(pStart, pEnd);

  const pStartStr = pStart.toISOString().split("T")[0];
  const pEndStr = pEnd.toISOString().split("T")[0];
  const prevStartStr = prev.start.toISOString().split("T")[0];
  const prevEndStr = prev.end.toISOString().split("T")[0];

  try {
    // 4. Carregar dados em paralelo: snapshots + content para período atual e anterior
    const [
      snapshotsResult,
      prevSnapshotsResult,
      contentResult,
      prevContentResult,
    ] = await Promise.all([
      admin
        .from("provider_snapshots")
        .select("*")
        .eq("empresa_id", empresaId)
        .in("provider", providers)
        .gte("snapshot_date", pStartStr)
        .lte("snapshot_date", pEndStr)
        .order("snapshot_date", { ascending: true }),

      admin
        .from("provider_snapshots")
        .select("*")
        .eq("empresa_id", empresaId)
        .in("provider", providers)
        .gte("snapshot_date", prevStartStr)
        .lte("snapshot_date", prevEndStr)
        .order("snapshot_date", { ascending: true }),

      admin
        .from("content_items")
        .select("*")
        .eq("empresa_id", empresaId)
        .in("provider", providers)
        .gte("published_at", pStart.toISOString())
        .lte("published_at", pEnd.toISOString())
        .order("published_at", { ascending: false }),

      admin
        .from("content_items")
        .select("*")
        .eq("empresa_id", empresaId)
        .in("provider", providers)
        .gte("published_at", prev.start.toISOString())
        .lte("published_at", prev.end.toISOString())
        .order("published_at", { ascending: false }),
    ]);

    const snapshots = (snapshotsResult.data ?? []) as SnapshotRow[];
    const prevSnapshots = (prevSnapshotsResult.data ?? []) as SnapshotRow[];
    const content = (contentResult.data ?? []) as ContentRow[];
    const prevContent = (prevContentResult.data ?? []) as ContentRow[];

    // 5. Filtros por tipo de conteúdo para Meta Ads (campaigns vs ads)
    const campaigns = content.filter(
      (c) => c.provider === "meta_ads" && c.content_type === "ad_campaign"
    );
    const prevCampaigns = prevContent.filter(
      (c) => c.provider === "meta_ads" && c.content_type === "ad_campaign"
    );
    const ads = content.filter(
      (c) => c.provider === "meta_ads" && c.content_type === "ad"
    );
    const prevAds = prevContent.filter(
      (c) => c.provider === "meta_ads" && c.content_type === "ad"
    );

    // 6. Agregar cada secção
    const instagramData = aggregateInstagram(
      snapshots,
      prevSnapshots,
      content,
      prevContent
    );

    const facebookData = aggregateFacebook(
      snapshots,
      prevSnapshots,
      content,
      prevContent
    );

    const metaAdsData = aggregateMetaAds(
      snapshots,
      prevSnapshots,
      campaigns,
      prevCampaigns,
      ads,
      prevAds
    );

    const panoramaData = aggregatePanorama(
      snapshots,
      prevSnapshots,
      content,
      prevContent
    );

    // 7. Montar AgencyReportData
    const report: AgencyReportData = {
      meta: {
        empresaId: empresa.id as string,
        empresaNome: empresa.nome as string,
        periodStart: pStartStr,
        periodEnd: pEndStr,
        previousStart: prevStartStr,
        previousEnd: prevEndStr,
        generatedAt: new Date().toISOString(),
        providersIncluded: providers,
      },
      panorama: panoramaData,
      instagram: instagramData,
      facebook: facebookData,
      metaAds: metaAdsData,
    };

    // 8. Se format=json ou sem format: retorna dados brutos
    if (!wantsPdf) {
      return NextResponse.json({ data: report });
    }

    // 9. format=pdf: gera análise IA + PDF + upload Storage
    // IMPORTANTE 2: Validar ANTHROPIC_API_KEY antes de chamar IA
    if (!isAnthropicConfigured()) {
      return NextResponse.json(
        { error: "Análise IA indisponível — configurar ANTHROPIC_API_KEY" },
        { status: 503 }
      );
    }
    const analysis = await generateAgencyReportAnalysis(report);

    // 9a. Inserir registro na tabela reports para que /relatorios/[id] funcione
    const { data: reportRow, error: insertError } = await admin
      .from("reports")
      .insert({
        empresa_id: empresaId,
        user_id: user.id,
        name: `Relatório Agência - ${pStartStr} a ${pEndStr}`,
        type: "agency",
        providers: providers ?? ["instagram", "facebook", "meta_ads"],
        period_start: pStartStr,
        period_end: pEndStr,
        data: report as unknown as Record<string, unknown>,
        ai_analysis: analysis as unknown as Record<string, unknown>,
        status: "generating",
      })
      .select("id")
      .single();

    if (insertError || !reportRow) {
      console.error("[reports/agencia] Erro ao criar registro:", insertError);
      return NextResponse.json(
        { error: "Erro ao salvar relatório no banco" },
        { status: 500 }
      );
    }

    const pdfBuffer = await generateAgencyPDF(report, analysis);
    const pdfPath = buildPdfPath(empresaId, reportRow.id);
    const pdfUrl = await uploadReportPdf(pdfBuffer, pdfPath);

    // 9b. Atualizar status + pdf_url
    await admin
      .from("reports")
      .update({ status: "ready", pdf_url: pdfUrl })
      .eq("id", reportRow.id);

    return NextResponse.json({ reportId: reportRow.id, pdfUrl });
  } catch (err) {
    console.error("[reports/agencia] Erro:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro interno" },
      { status: 500 }
    );
  }
}
