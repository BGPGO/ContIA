/**
 * POST /api/reports/[id]/send
 * Envia o relatório por email para os recipients informados.
 */

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { sendReportEmail } from "@/lib/email/send-report";
import type { Report } from "@/types/reports";

const RequestSchema = z.object({
  recipients: z.array(z.string().email("Email inválido")).min(1, "Informe pelo menos um destinatário"),
  customMessage: z.string().max(500).optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body JSON inválido" }, { status: 400 });
  }

  const validation = RequestSchema.safeParse(body);
  if (!validation.success) {
    const messages = validation.error.issues.map((i) => i.message).join("; ");
    return NextResponse.json({ error: messages }, { status: 400 });
  }

  const { recipients, customMessage } = validation.data;

  // Fetch report
  const { data: report } = await supabase
    .from("reports")
    .select("*")
    .eq("id", id)
    .single();

  if (!report) {
    return NextResponse.json({ error: "Relatório não encontrado" }, { status: 404 });
  }

  // Verify ownership
  const { data: empresa } = await supabase
    .from("empresas")
    .select("id")
    .eq("id", report.empresa_id)
    .eq("user_id", user.id)
    .single();

  if (!empresa) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  if (report.status !== "ready") {
    return NextResponse.json(
      { error: "O relatório ainda não está pronto para envio" },
      { status: 422 }
    );
  }

  // Check RESEND_API_KEY before attempting send
  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json(
      { error: "RESEND_API_KEY nao configurada. Configure esta variavel de ambiente no Coolify para habilitar o envio de emails." },
      { status: 503 }
    );
  }

  try {
    const result = await sendReportEmail(report as Report, recipients, { customMessage });

    if (result.sent === 0 && result.failed.length > 0) {
      return NextResponse.json(
        { error: `Falha ao enviar para todos os destinatarios`, sent: 0, failed: result.failed },
        { status: 502 }
      );
    }

    return NextResponse.json({
      sent: result.sent,
      failed: result.failed,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao enviar email";
    console.error("[reports/send]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
