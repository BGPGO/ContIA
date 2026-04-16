/**
 * POST /api/reports/scheduled/[id]/run
 * Executa imediatamente um agendamento (dispara geração + envio).
 */

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { generateReportAnalysis } from "@/lib/ai/report-generator";
import { sendReportEmail } from "@/lib/email/send-report";
import { periodFromCron } from "@/lib/reports/cron-utils";
import type { ProviderKey } from "@/types/providers";
import type { ReportType, Report } from "@/types/reports";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  // Fetch schedule with empresa validation
  const { data: schedule } = await supabase
    .from("scheduled_reports")
    .select("*, empresas!inner(id, nome, user_id)")
    .eq("id", id)
    .single();

  if (!schedule) return NextResponse.json({ error: "Agendamento não encontrado" }, { status: 404 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((schedule as any).empresas?.user_id !== user.id) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  try {
    // Use service role to bypass RLS for cron-like operations
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const serviceSupa = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey);

    const { periodStart, periodEnd, previousStart, previousEnd } = periodFromCron(schedule.schedule_cron);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const empresaNome = (schedule as any).empresas?.nome ?? "Empresa";
    const empresaId = schedule.empresa_id;

    // Fetch data
    const { data: content } = await serviceSupa
      .from("content_items")
      .select("*")
      .eq("empresa_id", empresaId)
      .in("provider", schedule.providers)
      .gte("published_at", periodStart.toISOString())
      .lte("published_at", periodEnd.toISOString());

    const { data: snapshots } = await serviceSupa
      .from("provider_snapshots")
      .select("*")
      .eq("empresa_id", empresaId)
      .in("provider", schedule.providers)
      .gte("snapshot_date", periodStart.toISOString().split("T")[0])
      .lte("snapshot_date", periodEnd.toISOString().split("T")[0]);

    const { data: previousContent } = await serviceSupa
      .from("content_items")
      .select("*")
      .eq("empresa_id", empresaId)
      .in("provider", schedule.providers)
      .gte("published_at", previousStart.toISOString())
      .lte("published_at", previousEnd.toISOString());

    const { data: previousSnapshots } = await serviceSupa
      .from("provider_snapshots")
      .select("*")
      .eq("empresa_id", empresaId)
      .in("provider", schedule.providers)
      .gte("snapshot_date", previousStart.toISOString().split("T")[0])
      .lte("snapshot_date", previousEnd.toISOString().split("T")[0]);

    const { data: dnaRow } = await serviceSupa
      .from("marca_dna")
      .select("dna_sintetizado")
      .eq("empresa_id", empresaId)
      .limit(1)
      .single();

    // Determine report type from cron
    const reportType: ReportType = cronToReportType(schedule.schedule_cron);
    const reportName = `${schedule.name} — ${new Intl.DateTimeFormat("pt-BR", { month: "short", year: "numeric" }).format(periodEnd)}`;

    // Create report record
    const { data: report } = await serviceSupa
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

    if (!report) throw new Error("Erro ao criar registro do relatório");

    // Generate AI analysis
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

    // Update report
    await serviceSupa
      .from("reports")
      .update({
        ai_analysis: analysis,
        data: { contentCount: (content ?? []).length, providers: schedule.providers, generatedAt: new Date().toISOString() },
        status: "ready",
      })
      .eq("id", report.id);

    // Fetch full report for email
    const { data: fullReport } = await serviceSupa
      .from("reports")
      .select("*")
      .eq("id", report.id)
      .single();

    // Update schedule last_run_at
    await serviceSupa
      .from("scheduled_reports")
      .update({ last_run_at: new Date().toISOString() })
      .eq("id", id);

    // Send emails
    let emailResult = { sent: 0, failed: [] as string[] };
    if (schedule.recipients.length > 0 && fullReport) {
      emailResult = await sendReportEmail(fullReport as Report, schedule.recipients);
    }

    return NextResponse.json({
      success: true,
      reportId: report.id,
      emailsSent: emailResult.sent,
      emailsFailed: emailResult.failed,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao executar agendamento";
    console.error("[scheduled/run]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function cronToReportType(cron: string): ReportType {
  // Weekly: "0 9 * * 1" (Monday)
  if (/\* \* [0-7]$/.test(cron) || cron.includes("* * 1") || cron.includes("* * 0")) return "weekly";
  // Monthly: "0 9 1 * *"
  if (/\d+ \d+ \d+ \* \*/.test(cron)) return "monthly";
  // Quarterly: typically 3-month intervals
  if (/\d+ \d+ \d+ \*\/3 \*/.test(cron) || /\d+ \d+ \d+ (1|4|7|10) \*/.test(cron)) return "quarterly";
  return "monthly";
}
