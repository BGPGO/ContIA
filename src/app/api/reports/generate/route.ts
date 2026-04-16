/**
 * POST /api/reports/generate
 *
 * Gera relatorio IA completo para uma empresa.
 * Auth Supabase obrigatorio. Rate limit: 1 relatorio a cada 5min por empresa.
 */

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { isAIConfigured } from "@/lib/ai/config";
import { generateReportAnalysis, type ReportInput } from "@/lib/ai/report-generator";
import { generateReportPDF } from "@/lib/reports/pdf-generator";
import { uploadReportPdf, buildPdfPath } from "@/lib/reports/storage";
import type { ProviderKey } from "@/types/providers";
import type { ReportType } from "@/types/reports";
import { fetchInstagramLive, persistInstagramSnapshot } from "@/lib/analytics/instagram-fetcher";

/* ── Input validation ────────────────────────────────────────────────────── */

const RequestSchema = z.object({
  periodStart: z.string().refine((s) => !isNaN(Date.parse(s)), {
    message: "periodStart deve ser uma data valida (ISO 8601)",
  }),
  periodEnd: z.string().refine((s) => !isNaN(Date.parse(s)), {
    message: "periodEnd deve ser uma data valida (ISO 8601)",
  }),
  providers: z
    .array(
      z.enum([
        "instagram",
        "facebook",
        "linkedin",
        "youtube",
        "ga4",
        "google_ads",
        "meta_ads",
        "greatpages",
        "crm",
      ])
    )
    .min(1, "Selecione pelo menos 1 plataforma"),
  reportType: z.enum(["weekly", "monthly", "quarterly", "custom"]),
  name: z.string().max(200).optional(),
  empresaId: z.string().uuid().optional(),
});

/* ── Rate limit por empresa (in-memory) ──────────────────────────────────── */

const rateLimitMap = new Map<string, number>();
const RATE_LIMIT_MS = 5 * 60 * 1000; // 5 minutos

function checkEmpresaRateLimit(empresaId: string): boolean {
  const lastRun = rateLimitMap.get(empresaId);
  if (lastRun && Date.now() - lastRun < RATE_LIMIT_MS) return false;
  rateLimitMap.set(empresaId, Date.now());
  return true;
}

/* ── Periodo anterior ────────────────────────────────────────────────────── */

function getPreviousPeriod(
  start: Date,
  end: Date,
  reportType: ReportType
): { start: Date; end: Date } {
  const durationMs = end.getTime() - start.getTime();
  return {
    start: new Date(start.getTime() - durationMs),
    end: new Date(start.getTime()),
  };
}

/* ── Report name ─────────────────────────────────────────────────────────── */

const TYPE_LABELS: Record<ReportType, string> = {
  weekly: "Semanal",
  monthly: "Mensal",
  quarterly: "Trimestral",
  custom: "Personalizado",
};

function generateReportName(reportType: ReportType, periodEnd: Date): string {
  const fmt = new Intl.DateTimeFormat("pt-BR", { month: "short", year: "numeric" });
  return `Relatorio ${TYPE_LABELS[reportType]} - ${fmt.format(periodEnd)}`;
}

/* ── POST handler ────────────────────────────────────────────────────────── */

export async function POST(req: NextRequest) {
  // 1. Check AI config
  if (!isAIConfigured()) {
    return NextResponse.json(
      { error: "API de IA nao configurada. Configure OPENAI_API_KEY." },
      { status: 503 }
    );
  }

  // 2. Parse body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body JSON invalido" }, { status: 400 });
  }

  const validation = RequestSchema.safeParse(body);
  if (!validation.success) {
    const messages = validation.error.issues.map((i) => i.message).join("; ");
    return NextResponse.json({ error: messages }, { status: 400 });
  }

  const { periodStart, periodEnd, providers, reportType, name, empresaId: requestEmpresaId } = validation.data;

  // 3. Auth
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
  }

  // Admin client para queries de dados (bypass RLS)
  const admin = getAdminSupabase();

  // 4. Resolve empresa — usar empresaId do request se disponivel, senao primeira do user
  let empresaQuery = admin
    .from("empresas")
    .select("id, nome")
    .eq("user_id", user.id);

  if (requestEmpresaId) {
    empresaQuery = empresaQuery.eq("id", requestEmpresaId);
  }

  const { data: empresa } = await empresaQuery.limit(1).single();

  if (!empresa) {
    return NextResponse.json(
      { error: "Nenhuma empresa encontrada para este usuario" },
      { status: 404 }
    );
  }

  // 5. Rate limit
  if (!checkEmpresaRateLimit(empresa.id)) {
    return NextResponse.json(
      { error: "Aguarde 5 minutos entre relatorios" },
      { status: 429 }
    );
  }

  const pStart = new Date(periodStart);
  const pEnd = new Date(periodEnd);

  try {
    // 6. Buscar conteudo do periodo
    const { data: contentRaw } = await admin
      .from("content_items")
      .select("*")
      .eq("empresa_id", empresa.id)
      .in("provider", providers)
      .gte("published_at", pStart.toISOString())
      .lte("published_at", pEnd.toISOString())
      .order("published_at", { ascending: false });

    let content = contentRaw ?? [];

    // ── FALLBACK: se content_items vazio para instagram, buscar legado ──
    const hasIgContent = content.some((c) => c.provider === "instagram");
    if (!hasIgContent && providers.includes("instagram" as ProviderKey)) {
      const { data: legacyMedia } = await admin
        .from("instagram_media_cache")
        .select("*")
        .eq("empresa_id", empresa.id)
        .gte("timestamp", pStart.toISOString())
        .lte("timestamp", pEnd.toISOString())
        .order("timestamp", { ascending: false });

      if (legacyMedia && legacyMedia.length > 0) {
        const syntheticContent = legacyMedia.map((m) => ({
          id: m.id as string,
          empresa_id: empresa.id,
          connection_id: `legacy-ig-${empresa.id}`,
          provider: "instagram" as string,
          provider_content_id: m.ig_media_id as string,
          content_type: (m.media_type === "VIDEO" ? "reel" : "post") as string,
          title: null as string | null,
          caption: m.caption as string | null,
          url: m.permalink as string | null,
          thumbnail_url: (m.thumbnail_url ?? m.media_url) as string | null,
          published_at: m.timestamp as string | null,
          metrics: {
            likes: (m.like_count ?? 0) as number,
            comments: (m.comments_count ?? 0) as number,
            ...(m.insights as Record<string, unknown> ?? {}),
          },
          raw: { media_type: m.media_type, media_url: m.media_url },
          synced_at: m.synced_at as string,
        }));
        content = [...content, ...syntheticContent];
      }
    }

    // 7. Buscar snapshots do periodo
    const { data: snapshotsRaw } = await admin
      .from("provider_snapshots")
      .select("*")
      .eq("empresa_id", empresa.id)
      .in("provider", providers)
      .gte("snapshot_date", pStart.toISOString().split("T")[0])
      .lte("snapshot_date", pEnd.toISOString().split("T")[0])
      .order("snapshot_date", { ascending: false });

    let snapshots = snapshotsRaw ?? [];

    // ── FALLBACK: se snapshots vazio para instagram, buscar legado ──
    const hasIgSnaps = snapshots.some((s) => s.provider === "instagram");
    if (!hasIgSnaps && providers.includes("instagram" as ProviderKey)) {
      const { data: legacyProfiles } = await admin
        .from("instagram_profile_cache")
        .select("*")
        .eq("empresa_id", empresa.id)
        .gte("snapshot_date", pStart.toISOString().split("T")[0])
        .lte("snapshot_date", pEnd.toISOString().split("T")[0])
        .order("snapshot_date", { ascending: false });

      if (legacyProfiles && legacyProfiles.length > 0) {
        const syntheticSnapshots = legacyProfiles.map((p) => ({
          id: p.id as string,
          empresa_id: empresa.id,
          connection_id: `legacy-ig-${empresa.id}`,
          provider: "instagram" as string,
          snapshot_date: p.snapshot_date as string,
          metrics: {
            followers_count: (p.followers_count ?? 0) as number,
            follows_count: (p.follows_count ?? 0) as number,
            media_count: (p.media_count ?? 0) as number,
          },
          created_at: p.created_at as string,
        }));
        snapshots = [...snapshots, ...syntheticSnapshots];
      }
    }

    // ── FALLBACK LIVE: se Instagram sem dados em content NEM snapshots, buscar API live ──
    const hasAnyIgContent = content.some((c) => c.provider === "instagram");
    const hasAnyIgSnaps = snapshots.some((s) => s.provider === "instagram");

    if (providers.includes("instagram" as ProviderKey) && (!hasAnyIgContent || !hasAnyIgSnaps)) {
      let igAccessToken: string | null = null;
      let igProviderUserId: string | null = null;

      // Tentar social_connections
      const { data: igConn, error: igConnError } = await admin
        .from("social_connections")
        .select("access_token, provider_user_id")
        .eq("empresa_id", empresa.id)
        .eq("provider", "instagram")
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();

      if (igConnError) {
        console.error("[reports/generate] Erro ao buscar conexao IG:", igConnError.message);
      }

      if (igConn?.access_token && igConn.provider_user_id) {
        igAccessToken = igConn.access_token;
        igProviderUserId = igConn.provider_user_id;
      } else {
        // Fallback legado empresa.redes_sociais
        const { data: empresaRedes } = await admin
          .from("empresas")
          .select("redes_sociais")
          .eq("id", empresa.id)
          .single();

        const legacyIg = (empresaRedes?.redes_sociais as Record<string, Record<string, string | boolean>> | null)?.instagram;
        if (legacyIg?.access_token && legacyIg.provider_user_id) {
          igAccessToken = legacyIg.access_token as string;
          igProviderUserId = legacyIg.provider_user_id as string;
        }
      }

      if (igAccessToken && igProviderUserId) {
        try {
          const liveData = await fetchInstagramLive(igAccessToken, igProviderUserId, 30);

          // Persistir snapshot em background
          persistInstagramSnapshot(empresa.id, `live-ig-${empresa.id}`, liveData).catch((err) =>
            console.error("[reports/generate] Falha ao persistir snapshot:", err)
          );

          // Injetar content sintetico se nao tem
          if (!hasAnyIgContent && liveData.media.length > 0) {
            const liveContent = liveData.media.map((m) => {
              const mi = liveData.mediaInsightsMap.get(m.id);
              return {
                id: m.id,
                empresa_id: empresa.id,
                connection_id: `live-ig-${empresa.id}`,
                provider: "instagram" as string,
                provider_content_id: m.id,
                content_type: (m.media_type === "VIDEO" ? "reel" : "post") as string,
                title: null as string | null,
                caption: m.caption ?? null,
                url: m.permalink ?? null,
                thumbnail_url: (m.thumbnail_url ?? m.media_url) as string | null,
                published_at: m.timestamp ?? null,
                metrics: {
                  likes: (m.like_count ?? 0) as number,
                  comments: (m.comments_count ?? 0) as number,
                  saves: (mi?.saved ?? 0) as number,
                  shares: (mi?.shares ?? 0) as number,
                  reach: (mi?.reach ?? 0) as number,
                },
                raw: { media_type: m.media_type },
                synced_at: new Date().toISOString(),
              };
            });
            content = [...content, ...liveContent];
          }

          // Injetar snapshot sintetico se nao tem
          if (!hasAnyIgSnaps) {
            const today = new Date().toISOString().split("T")[0];
            snapshots = [
              ...snapshots,
              {
                id: `live-ig-snap-${empresa.id}`,
                empresa_id: empresa.id,
                connection_id: `live-ig-${empresa.id}`,
                provider: "instagram" as string,
                snapshot_date: today,
                metrics: {
                  followers_count: liveData.kpis.followers,
                  reach: liveData.kpis.reach,
                  impressions: liveData.kpis.impressions,
                  engagement_rate: liveData.kpis.engagementRate,
                },
                created_at: new Date().toISOString(),
              },
            ];
          }

          console.log("[reports/generate] Dados live Instagram injetados para relatorio");
        } catch (err) {
          console.error("[reports/generate] Falha ao buscar Instagram live:", err instanceof Error ? err.message : err);
        }
      }
    }

    // 8. Periodo anterior
    const prev = getPreviousPeriod(pStart, pEnd, reportType);

    const { data: previousContent } = await admin
      .from("content_items")
      .select("*")
      .eq("empresa_id", empresa.id)
      .in("provider", providers)
      .gte("published_at", prev.start.toISOString())
      .lte("published_at", prev.end.toISOString());

    const { data: previousSnapshots } = await admin
      .from("provider_snapshots")
      .select("*")
      .eq("empresa_id", empresa.id)
      .in("provider", providers)
      .gte("snapshot_date", prev.start.toISOString().split("T")[0])
      .lte("snapshot_date", prev.end.toISOString().split("T")[0]);

    // 9. DNA da marca (opcional)
    const { data: dnaRow } = await admin
      .from("marca_dna")
      .select("dna_sintetizado")
      .eq("empresa_id", empresa.id)
      .limit(1)
      .single();

    // 10. Criar registro do relatorio (status: generating)
    const reportName = name ?? generateReportName(reportType, pEnd);

    const { data: report, error: insertError } = await admin
      .from("reports")
      .insert({
        empresa_id: empresa.id,
        user_id: user.id,
        name: reportName,
        type: reportType,
        providers,
        period_start: pStart.toISOString().split("T")[0],
        period_end: pEnd.toISOString().split("T")[0],
        data: {},
        ai_analysis: {},
        status: "generating",
      })
      .select("id")
      .single();

    if (insertError || !report) {
      console.error("[reports/generate] Erro ao criar relatorio:", insertError);
      return NextResponse.json(
        { error: "Erro ao criar relatorio no banco" },
        { status: 500 }
      );
    }

    // 11. Gerar analise IA
    const reportInput: ReportInput = {
      empresaId: empresa.id,
      periodStart: pStart,
      periodEnd: pEnd,
      previousPeriodStart: prev.start,
      previousPeriodEnd: prev.end,
      providers: providers as ProviderKey[],
      snapshots: snapshots ?? [],
      content: content ?? [],
      previousContent: previousContent ?? [],
      previousSnapshots: previousSnapshots ?? [],
      empresaName: empresa.nome,
      empresaDna: dnaRow?.dna_sintetizado ?? undefined,
      reportType: reportType as ReportType,
    };

    const analysis = await generateReportAnalysis(reportInput);

    // 12. Atualizar relatorio com analise
    await admin
      .from("reports")
      .update({
        ai_analysis: analysis,
        data: {
          contentCount: (content ?? []).length,
          previousContentCount: (previousContent ?? []).length,
          snapshotCount: (snapshots ?? []).length,
          providers,
          generatedAt: new Date().toISOString(),
        },
        status: "ready",
      })
      .eq("id", report.id);

    // 13. Gerar PDF inline (sincrono) — default template 'client'
    let pdfUrl: string | null = null;
    try {
      const pdfResult = await generateReportPDF({
        reportId: report.id,
        template: "client",
        brandName: empresa.nome,
      });
      const storagePath = buildPdfPath(empresa.id, report.id);
      pdfUrl = await uploadReportPdf(pdfResult.pdfBuffer, storagePath);

      // Atualizar pdf_url no registro
      await admin
        .from("reports")
        .update({ pdf_url: pdfUrl })
        .eq("id", report.id);
    } catch (pdfErr) {
      // Falha no PDF nao cancela o relatorio — loga e segue
      console.error("[reports/generate] Erro ao gerar PDF (nao critico):", pdfErr);
    }

    return NextResponse.json({
      reportId: report.id,
      analysis,
      pdfUrl,
    });
  } catch (error: unknown) {
    console.error("[reports/generate] Erro:", error);
    const message = error instanceof Error ? error.message : "Erro interno ao gerar relatorio";

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
