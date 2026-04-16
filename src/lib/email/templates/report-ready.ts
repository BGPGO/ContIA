/**
 * Template HTML para email de relatório pronto.
 * Usa inline styles para máxima compatibilidade com clientes de email.
 */

export interface ReportEmailData {
  reportName: string;
  empresaNome: string;
  periodLabel: string;
  summaryPreview: string;
  reportUrl: string;
  pdfUrl?: string | null;
}

export function buildReportReadyEmail(data: ReportEmailData): {
  subject: string;
  html: string;
  text: string;
} {
  const { reportName, empresaNome, periodLabel, summaryPreview, reportUrl, pdfUrl } = data;

  const preview = summaryPreview.length > 200
    ? summaryPreview.slice(0, 200) + "..."
    : summaryPreview;

  const subject = `Seu relatório "${reportName}" está pronto — ContIA`;

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#0c0f24;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0c0f24;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- Header / Brand -->
          <tr>
            <td style="padding-bottom:24px;" align="center">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:linear-gradient(135deg,#4ecdc4,#2db6a0);width:36px;height:36px;border-radius:10px;text-align:center;vertical-align:middle;">
                    <span style="color:white;font-size:18px;font-weight:bold;">C</span>
                  </td>
                  <td style="padding-left:10px;vertical-align:middle;">
                    <span style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.5px;">ContIA</span>
                    <span style="color:#4ecdc4;font-size:11px;font-weight:500;margin-left:6px;background:rgba(78,205,196,0.1);padding:2px 6px;border-radius:4px;">AI</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Card Principal -->
          <tr>
            <td style="background-color:#141736;border:1px solid #1e2348;border-radius:16px;padding:32px;">

              <!-- Ícone + Título -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding-bottom:20px;">
                    <div style="display:inline-block;background:rgba(78,205,196,0.12);border-radius:50%;width:56px;height:56px;text-align:center;line-height:56px;">
                      <span style="font-size:24px;">📊</span>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-bottom:8px;">
                    <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;line-height:1.3;">
                      Seu relatório está pronto!
                    </h1>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-bottom:24px;">
                    <p style="margin:0;color:#8b92b8;font-size:14px;">
                      ${empresaNome} · ${periodLabel}
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Divider -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="border-top:1px solid #1e2348;padding-bottom:20px;"></td>
                </tr>
              </table>

              <!-- Report Name -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:rgba(78,205,196,0.06);border:1px solid rgba(78,205,196,0.15);border-radius:10px;padding:16px;margin-bottom:20px;">
                    <p style="margin:0 0 4px 0;color:#4ecdc4;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Relatório</p>
                    <p style="margin:0;color:#ffffff;font-size:16px;font-weight:600;">${reportName}</p>
                  </td>
                </tr>
              </table>

              <!-- Preview Summary -->
              ${preview ? `
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;">
                <tr>
                  <td>
                    <p style="margin:0 0 8px 0;color:#8b92b8;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Resumo da análise</p>
                    <p style="margin:0;color:#c4c9e0;font-size:14px;line-height:1.6;">${preview}</p>
                  </td>
                </tr>
              </table>
              ` : ""}

              <!-- Divider -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;">
                <tr>
                  <td style="border-top:1px solid #1e2348;padding-bottom:24px;"></td>
                </tr>
              </table>

              <!-- CTAs -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding-bottom:12px;">
                    <a href="${reportUrl}"
                       style="display:inline-block;background:linear-gradient(135deg,#4ecdc4,#2db6a0);color:#0c0f24;font-size:15px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:10px;letter-spacing:-0.2px;">
                      Ver relatório completo
                    </a>
                  </td>
                </tr>
                ${pdfUrl ? `
                <tr>
                  <td align="center">
                    <a href="${pdfUrl}"
                       style="display:inline-block;background:transparent;color:#4ecdc4;font-size:13px;font-weight:600;text-decoration:none;padding:10px 24px;border:1px solid rgba(78,205,196,0.3);border-radius:8px;">
                      Baixar PDF
                    </a>
                  </td>
                </tr>
                ` : ""}
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 0 8px 0;" align="center">
              <p style="margin:0 0 8px 0;color:#4a5080;font-size:12px;">
                Este email foi enviado automaticamente pela plataforma ContIA.
              </p>
              <p style="margin:0;color:#4a5080;font-size:12px;">
                Bertuzzi Patrimonial · <a href="mailto:contato@bertuzzipatrimonial.app.br" style="color:#4ecdc4;text-decoration:none;">contato@bertuzzipatrimonial.app.br</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `${subject}

Olá,

Seu relatório "${reportName}" para ${empresaNome} (${periodLabel}) foi gerado com sucesso.

${preview ? `Resumo: ${preview}\n\n` : ""}Ver relatório: ${reportUrl}
${pdfUrl ? `Baixar PDF: ${pdfUrl}` : ""}

ContIA — Bertuzzipatrimonial.app.br
`;

  return { subject, html, text };
}
