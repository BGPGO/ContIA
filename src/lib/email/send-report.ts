/**
 * Envia email de relatório pronto via Resend API.
 * Usa fetch direto (Resend SDK não está no package.json).
 * Domínio verificado: bertuzzipatrimonial.app.br
 */

import { buildReportReadyEmail } from "./templates/report-ready";
import type { Report } from "@/types/reports";

const FROM_ADDRESS = "ContIA <relatorios@bertuzzipatrimonial.app.br>";
const RESEND_API_URL = "https://api.resend.com/emails";

interface ResendEmailPayload {
  from: string;
  to: string[];
  subject: string;
  html: string;
  text: string;
}

interface ResendResponse {
  id?: string;
  statusCode?: number;
  message?: string;
}

async function sendViaResend(payload: ResendEmailPayload): Promise<{ ok: boolean; id?: string; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY não configurada");
  }

  const res = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = (await res.json()) as ResendResponse;

  if (!res.ok) {
    return { ok: false, error: data.message ?? `Resend HTTP ${res.status}` };
  }

  return { ok: true, id: data.id };
}

/* ── Public function ────────────────────────────────────────── */

export async function sendReportEmail(
  report: Report,
  recipients: string[],
  options?: { customMessage?: string; appBaseUrl?: string }
): Promise<{ sent: number; failed: string[] }> {
  if (recipients.length === 0) return { sent: 0, failed: [] };

  const appBaseUrl = options?.appBaseUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? "https://contia.bertuzzipatrimonial.com.br";

  const periodStart = new Date(report.period_start);
  const periodEnd = new Date(report.period_end);
  const fmt = new Intl.DateTimeFormat("pt-BR", { month: "short", year: "numeric" });
  const periodLabel = `${fmt.format(periodStart)} – ${fmt.format(periodEnd)}`;

  const analysis = report.ai_analysis as { summary?: string } | null;
  const summaryPreview = options?.customMessage
    ?? (typeof analysis?.summary === "string" ? analysis.summary : "");

  const emailData = buildReportReadyEmail({
    reportName: report.name,
    empresaNome: "sua empresa", // TODO: passar nome da empresa quando disponível
    periodLabel,
    summaryPreview,
    reportUrl: `${appBaseUrl}/relatorios/${report.id}`,
    pdfUrl: report.pdf_url,
  });

  const sent: string[] = [];
  const failed: string[] = [];

  // Send to each recipient individually for tracking
  for (const recipient of recipients) {
    try {
      const result = await sendViaResend({
        from: FROM_ADDRESS,
        to: [recipient],
        subject: emailData.subject,
        html: emailData.html,
        text: emailData.text,
      });

      if (result.ok) {
        sent.push(recipient);
      } else {
        console.error(`[send-report] Failed to send to ${recipient}:`, result.error);
        failed.push(recipient);
      }
    } catch (err) {
      console.error(`[send-report] Error sending to ${recipient}:`, err);
      failed.push(recipient);
    }
  }

  return { sent: sent.length, failed };
}
