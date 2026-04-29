/**
 * Agency PDF Generator — ContIA Wave 3 (Squad F)
 *
 * Combina AgencyReportData + AgencyReportAnalysis → Buffer de PDF via Puppeteer.
 * Reusa as mesmas flags/configurações de pdf-generator.ts para consistência.
 *
 * IMPORTANTE: rodar apenas em runtime Node.js (não Edge).
 */

import type { AgencyReportData } from "@/types/agency-report";
import type { AgencyReportAnalysis } from "@/lib/ai/agency-report-generator";
import { renderAgencyTemplate } from "./templates/agency";

/* ── generateAgencyPDF ───────────────────────────────────────────────────── */

/**
 * Gera um PDF do relatório agência e retorna o Buffer.
 *
 * @param data     Dados agregados das plataformas (AgencyReportData)
 * @param analysis Análise narrativa gerada pela IA (AgencyReportAnalysis)
 * @returns        Buffer com o PDF em formato A4
 */
export async function generateAgencyPDF(
  data: AgencyReportData,
  analysis: AgencyReportAnalysis
): Promise<Buffer> {
  // Lazy imports — evita problemas em Edge/build
  const puppeteer = await import("puppeteer");

  // Renderiza HTML inline (sem dependências externas)
  const html = renderAgencyTemplate(data, analysis);

  const browser = await puppeteer.default.launch({
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--no-first-run",
      "--no-zygote",
      "--disable-gpu",
    ],
  });

  try {
    const page = await browser.newPage();

    // Viewport A4 em 96 DPI (igual ao pdf-generator.ts)
    await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 1.5 });

    // Carrega HTML inline — aguarda rede inativa (fontes, etc.)
    await page.setContent(html, {
      waitUntil: "networkidle0",
      timeout: 30000,
    });

    // Aguarda fontes renderizarem
    await page.evaluateHandle("document.fonts.ready");

    // Gera PDF A4
    const pdfData = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0mm", right: "0mm", bottom: "0mm", left: "0mm" },
      displayHeaderFooter: false,
      preferCSSPageSize: true,
    });

    return Buffer.from(pdfData);
  } finally {
    await browser.close();
  }
}
