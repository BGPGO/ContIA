/**
 * GET /api/cron/scheduled-reports
 *
 * Cron endpoint para processar relatórios agendados.
 * Protegido por CRON_SECRET no header Authorization.
 *
 * Para configurar no Coolify:
 * 1. Defina CRON_SECRET no .env (ou variáveis de ambiente do serviço)
 * 2. Configure um cron job para chamar:
 *    GET https://contia.bertuzzipatrimonial.com.br/api/cron/scheduled-reports
 *    Header: Authorization: Bearer <CRON_SECRET>
 * 3. Frequência recomendada: a cada hora ("0 * * * *")
 *
 * Lógica:
 * - Busca scheduled_reports WHERE active=true AND next_run_at <= now()
 * - Para cada: gera relatório, salva, envia emails, atualiza next_run_at
 */

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { generateReportAnalysis } from "@/lib/ai/report-generator";
import { sendReportEmail } from "@/lib/email/send-report";
import { periodFromCron, computeNextRunAt } from "@/lib/reports/cron-utils";
import type { ProviderKey } from "@/types/providers";
import type { ReportType, Report } from "@/types/reports";

/* ── Helpers ─────────────────────────────────────────────────── */

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !serviceKey) {
    throw new Error("Supabase não configurado para cron.");
  }

  return createServiceClient(url, serviceKey);
}

function validateCronSecret(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("CRON_SECRET não definido nas variáveis de ambiente.");
    return false;
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader) return false;

  const token = authHeader.replace(/^Bearer\s+/i, "");
  return token === cronSecret;
}

function cronToReportType(cron: string): ReportType {
  const parts = cron.trim().split(/\s+/);
  const [, , domPart, monthPart, dowPart] = parts;
  if (domPart === "*" && dowPart !== "*") return "weekly";
  if (monthPart?.includes(",")) return "quarterly";
  return "monthly";
}

/* ── GET handler ─────────────────────────────────────────────── */

export async function GET(request: NextRequest) {
  if (!validateCronSecret(request)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const supabase = getServiceSupabase();
  const now = new Date().toISOString();

  try {
    // Buscar agendamentos prontos para executar
    const { data: schedules, error: fetchError } = await supabase
      .from("scheduled_reports")
      .select("*, empresas!inner(id, nome)")
      .eq("active", true)
      .lte("next_run_at", now)
      .not("next_run_at", "is", null);

    if (fetchError) {
      console.error("[cron/scheduled-reports] Erro ao buscar agendamentos:", fetchError);
      return NextResponse.json({ error: "Erro ao buscar agendamentos" }, { status: 500 });
    }

    if (!schedules || schedules.length === 0) {
      return NextResponse.json({
        message: "Nenhum agendamento para processar.",
        processed: 0,
        timestamp: now,
      });
    }

    type ProcessResult = {
      scheduleId: string;
      scheduleName: string;
      success: boolean;
      reportId?: string;
      emailsSent?: number;
      error?: string;
    };
    const results: ProcessResult[] = [];
    let successCount = 0;
    let failCount = 0;

    for (const schedule of schedules) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const empresaNome = (schedule as any).empresas?.nome ?? "Empresa";
        const empresaId = schedule.empresa_id;
        const reportType = cronToReportType(schedule.schedule_cron);

        const { periodStart, periodEnd, previousStart, previousEnd } = periodFromCron(schedule.schedule_cron);

        // Buscar dados
        const [
          { data: content },
          { data: snapshots },
          { data: previousContent },
          { data: previousSnapshots },
          { data: dnaRow },
        ] = await Promise.all([
          supabase.from("content_items").select("*")
            .eq("empresa_id", empresaId)
            .in("provider", schedule.providers)
            .gte("published_at", periodStart.toISOString())
            .lte("published_at", periodEnd.toISOString()),
          supabase.from("provider_snapshots").select("*")
            .eq("empresa_id", empresaId)
            .in("provider", schedule.providers)
            .gte("snapshot_date", periodStart.toISOString().split("T")[0])
            .lte("snapshot_date", periodEnd.toISOString().split("T")[0]),
          supabase.from("content_items").select("*")
            .eq("empresa_id", empresaId)
            .in("provider", schedule.providers)
            .gte("published_at", previousStart.toISOString())
            .lte("published_at", previousEnd.toISOString()),
          supabase.from("provider_snapshots").select("*")
            .eq("empresa_id", empresaId)
            .in("provider", schedule.providers)
            .gte("snapshot_date", previousStart.toISOString().split("T")[0])
            .lte("snapshot_date", previousEnd.toISOString().split("T")[0]),
          supabase.from("marca_dna").select("dna_sintetizado")
            .eq("empresa_id", empresaId).limit(1).single(),
        ]);

        const reportName = `${schedule.name} — ${new Intl.DateTimeFormat("pt-BR", { month: "short", year: "numeric" }).format(periodEnd)}`;

        // Criar registro
        const { data: report } = await supabase
          .from("reports")
          .insert({
            empresa_id: empresaId,
            user_id: schedule.user_id,
            name: reportName,
            type: reportType,
            providers: schedule.providers,
            period_start: periodStart.toISOString().split("T")[0],
            period_end: periodEnd.toISOString().split("T")[0],
            data: {},
            ai_analysis: {},
            status: "generating",
          })
          .select("id")
          .single();

        if (!report) throw new Error("Falha ao criar relatório");

        // Gerar análise
        const analysis = await generateReportAnalysis({
          empresaId,
          periodStart,
          periodEnd,
          previousPeriodStart: previousStart,
          previousPeriodEnd: previousEnd,
          providers: schedule.providers as ProviderKey[],
          snapshots: snapshots ?? [],
          content: content ?? [],
          previousContent: previousContent ?? [],
          previousSnapshots: previousSnapshots ?? [],
          empresaName: empresaNome,
          empresaDna: dnaRow?.dna_sintetizado ?? undefined,
          reportType,
        });

        await supabase.from("reports").update({
          ai_analysis: analysis,
          data: { contentCount: (content ?? []).length, providers: schedule.providers, generatedAt: new Date().toISOString() },
          status: "ready",
        }).eq("id", report.id);

        // Buscar relatório completo para email
        const { data: fullReport } = await supabase.from("reports").select("*").eq("id", report.id).single();

        // Enviar emails
        let emailsSent = 0;
        if (schedule.recipients.length > 0 && fullReport) {
          const emailResult = await sendReportEmail(fullReport as Report, schedule.recipients);
          emailsSent = emailResult.sent;
        }

        // Atualizar last_run_at e next_run_at
        const nextRun = computeNextRunAt(schedule.schedule_cron);
        await supabase.from("scheduled_reports").update({
          last_run_at: new Date().toISOString(),
          next_run_at: nextRun?.toISOString() ?? null,
        }).eq("id", schedule.id);

        results.push({
          scheduleId: schedule.id,
          scheduleName: schedule.name,
          success: true,
          reportId: report.id,
          emailsSent,
        });
        successCount++;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Erro desconhecido";
        console.error(`[cron/scheduled-reports] Erro no agendamento ${schedule.id}:`, errorMsg);
        results.push({
          scheduleId: schedule.id,
          scheduleName: schedule.name,
          success: false,
          error: errorMsg,
        });
        failCount++;

        // Update next_run_at mesmo em caso de erro (para não travar)
        const nextRun = computeNextRunAt(schedule.schedule_cron);
        await supabase.from("scheduled_reports").update({
          next_run_at: nextRun?.toISOString() ?? null,
        }).eq("id", schedule.id);
      }
    }

    return NextResponse.json({
      message: `Processados ${schedules.length} agendamentos: ${successCount} sucesso, ${failCount} falha.`,
      processed: schedules.length,
      success: successCount,
      failed: failCount,
      results,
      timestamp: now,
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Erro interno";
    console.error("[cron/scheduled-reports] Erro geral:", errorMsg);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
