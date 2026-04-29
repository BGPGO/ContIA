"use client";

/**
 * Hooks para o Relatório Agência — Wave 3, Squad G
 *
 * useCreateAgencyReport — mutation para POST /api/reports/agencia
 * useAgencyReport       — GET /api/reports/[id] parseado como AgencyReportData + AgencyReportAnalysis
 */

import { useState, useEffect, useCallback } from "react";
import { useEmpresa } from "./useEmpresa";
import type { AgencyReportData } from "@/types/agency-report";
import type { AgencyReportAnalysis } from "@/lib/ai/agency-report-generator";

/** Providers suportados pelo relatório agência */
export type AgencyReportProvider = "instagram" | "facebook" | "meta_ads";

/* ── useCreateAgencyReport ───────────────────────────────────────────────── */

export interface CreateAgencyReportParams {
  periodStart: string; // ISO string
  periodEnd: string;
  providers?: AgencyReportProvider[];
  recipients?: string[];
}

export interface CreateAgencyReportResult {
  /** ID do relatório salvo em `reports` */
  reportId: string;
  /** URL do PDF se format=pdf foi processado. Pode ser null se geração é async. */
  pdfUrl: string | null;
}

export function useCreateAgencyReport() {
  const { empresa } = useEmpresa();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<CreateAgencyReportResult | null>(null);

  const create = useCallback(
    async (
      params: CreateAgencyReportParams
    ): Promise<CreateAgencyReportResult | null> => {
      if (!empresa?.id) {
        setError("Empresa não selecionada");
        return null;
      }

      setLoading(true);
      setError(null);
      setData(null);

      try {
        const res = await fetch("/api/reports/agencia?format=pdf", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            empresaId: empresa.id,
            periodStart: params.periodStart,
            periodEnd: params.periodEnd,
            ...(params.providers && params.providers.length > 0
              ? { providers: params.providers }
              : {}),
          }),
        });

        const json = (await res.json()) as {
          reportId?: string;
          pdfUrl?: string;
          error?: string;
        };

        if (!res.ok) {
          throw new Error(json.error ?? `Erro ${res.status}`);
        }

        if (!json.reportId) {
          throw new Error("Servidor não retornou ID do relatório. Tente novamente.");
        }

        const result: CreateAgencyReportResult = {
          reportId: json.reportId,
          pdfUrl: json.pdfUrl ?? null,
        };
        setData(result);
        return result;
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Erro ao criar relatório";
        setError(msg);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [empresa?.id]
  );

  return { create, loading, error, data };
}

/* ── useAgencyReport ─────────────────────────────────────────────────────── */

export interface AgencyReportFull {
  id: string;
  name: string;
  status: "generating" | "ready" | "failed";
  period_start: string;
  period_end: string;
  providers: string[];
  pdf_url: string | null;
  created_at: string;
  /** Dados agregados brutos */
  agencyData: AgencyReportData | null;
  /** Análise IA gerada pelo Squad E */
  agencyAnalysis: AgencyReportAnalysis | null;
}

export function useAgencyReport(reportId: string | null) {
  const [report, setReport] = useState<AgencyReportFull | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch_ = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/reports/${id}`);
      if (!res.ok) throw new Error("Relatório não encontrado");

      const json = (await res.json()) as {
        report: {
          id: string;
          name: string;
          status: "generating" | "ready" | "failed";
          period_start: string;
          period_end: string;
          providers: string[];
          pdf_url: string | null;
          created_at: string;
          data: Record<string, unknown>;
          ai_analysis: Record<string, unknown>;
        };
      };

      const r = json.report;

      // Detecta se é um relatório de agência pela estrutura do data
      const isAgency =
        r.data &&
        typeof r.data === "object" &&
        "meta" in r.data &&
        "panorama" in r.data;

      setReport({
        id: r.id,
        name: r.name,
        status: r.status,
        period_start: r.period_start,
        period_end: r.period_end,
        providers: r.providers,
        pdf_url: r.pdf_url,
        created_at: r.created_at,
        agencyData: isAgency ? (r.data as unknown as AgencyReportData) : null,
        agencyAnalysis:
          r.ai_analysis && "panorama" in r.ai_analysis
            ? (r.ai_analysis as unknown as AgencyReportAnalysis)
            : null,
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao carregar relatório"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (reportId) {
      fetch_(reportId);
    }
  }, [reportId, fetch_]);

  const refresh = useCallback(() => {
    if (reportId) fetch_(reportId);
  }, [reportId, fetch_]);

  return { report, loading, error, refresh };
}
