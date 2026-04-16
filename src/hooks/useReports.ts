"use client";

import { useState, useCallback, useEffect } from "react";
import { useEmpresa } from "./useEmpresa";
import type { Report, ReportStatus, ReportType } from "@/types/reports";

/* ── Filter types ───────────────────────────────────────────── */

export interface ReportFilters {
  month?: number; // 1-12
  year?: number;
  status?: ReportStatus | "all";
  type?: ReportType | "all";
}

export interface UseReportsReturn {
  reports: Report[];
  loading: boolean;
  error: string | null;
  total: number;
  refresh: () => void;
  deleteReport: (id: string) => Promise<boolean>;
  filters: ReportFilters;
  setFilters: (f: ReportFilters) => void;
}

/* ── Hook ───────────────────────────────────────────────────── */

export function useReports(): UseReportsReturn {
  const { empresa } = useEmpresa();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState<ReportFilters>({});

  const fetchReports = useCallback(async () => {
    if (!empresa?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ empresa_id: empresa.id });
      if (filters.month) params.set("month", String(filters.month));
      if (filters.year) params.set("year", String(filters.year));
      if (filters.status && filters.status !== "all") params.set("status", filters.status);
      if (filters.type && filters.type !== "all") params.set("type", filters.type);

      const res = await fetch(`/api/reports/list?${params}`);
      if (!res.ok) throw new Error(`Erro ${res.status}`);

      const data = (await res.json()) as { reports: Report[]; total: number };
      setReports(data.reports);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar relatórios");
    } finally {
      setLoading(false);
    }
  }, [empresa?.id, filters]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const deleteReport = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        const res = await fetch(`/api/reports/${id}`, { method: "DELETE" });
        if (!res.ok) return false;
        setReports((prev) => prev.filter((r) => r.id !== id));
        setTotal((t) => t - 1);
        return true;
      } catch {
        return false;
      }
    },
    []
  );

  return {
    reports,
    loading,
    error,
    total,
    refresh: fetchReports,
    deleteReport,
    filters,
    setFilters,
  };
}
