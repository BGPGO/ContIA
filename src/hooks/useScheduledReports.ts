"use client";

import { useState, useCallback, useEffect } from "react";
import { useEmpresa } from "./useEmpresa";
import type { ScheduledReport } from "@/types/reports";

/* ── Input types ────────────────────────────────────────────── */

export interface CreateScheduledReportInput {
  name: string;
  schedule_cron: string;
  providers: string[];
  template_id?: string;
  recipients: string[];
  active?: boolean;
}

export interface UpdateScheduledReportInput extends Partial<CreateScheduledReportInput> {
  id: string;
}

export interface UseScheduledReportsReturn {
  schedules: ScheduledReport[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
  create: (input: CreateScheduledReportInput) => Promise<ScheduledReport | null>;
  update: (input: UpdateScheduledReportInput) => Promise<ScheduledReport | null>;
  remove: (id: string) => Promise<boolean>;
  toggle: (id: string, active: boolean) => Promise<boolean>;
  runNow: (id: string) => Promise<boolean>;
}

/* ── Hook ───────────────────────────────────────────────────── */

export function useScheduledReports(): UseScheduledReportsReturn {
  const { empresa } = useEmpresa();
  const [schedules, setSchedules] = useState<ScheduledReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSchedules = useCallback(async () => {
    if (!empresa?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/reports/scheduled?empresa_id=${empresa.id}`);
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      const data = (await res.json()) as { schedules: ScheduledReport[] };
      setSchedules(data.schedules);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar agendamentos");
    } finally {
      setLoading(false);
    }
  }, [empresa?.id]);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  const create = useCallback(
    async (input: CreateScheduledReportInput): Promise<ScheduledReport | null> => {
      if (!empresa?.id) return null;
      try {
        const res = await fetch("/api/reports/scheduled", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...input, empresa_id: empresa.id }),
        });
        if (!res.ok) return null;
        const data = (await res.json()) as { schedule: ScheduledReport };
        setSchedules((prev) => [data.schedule, ...prev]);
        return data.schedule;
      } catch {
        return null;
      }
    },
    [empresa?.id]
  );

  const update = useCallback(
    async (input: UpdateScheduledReportInput): Promise<ScheduledReport | null> => {
      const { id, ...rest } = input;
      try {
        const res = await fetch(`/api/reports/scheduled/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(rest),
        });
        if (!res.ok) return null;
        const data = (await res.json()) as { schedule: ScheduledReport };
        setSchedules((prev) => prev.map((s) => (s.id === id ? data.schedule : s)));
        return data.schedule;
      } catch {
        return null;
      }
    },
    []
  );

  const remove = useCallback(async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/reports/scheduled/${id}`, { method: "DELETE" });
      if (!res.ok) return false;
      setSchedules((prev) => prev.filter((s) => s.id !== id));
      return true;
    } catch {
      return false;
    }
  }, []);

  const toggle = useCallback(async (id: string, active: boolean): Promise<boolean> => {
    try {
      const res = await fetch(`/api/reports/scheduled/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active }),
      });
      if (!res.ok) return false;
      const data = (await res.json()) as { schedule: ScheduledReport };
      setSchedules((prev) => prev.map((s) => (s.id === id ? data.schedule : s)));
      return true;
    } catch {
      return false;
    }
  }, []);

  const runNow = useCallback(async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/reports/scheduled/${id}/run`, { method: "POST" });
      return res.ok;
    } catch {
      return false;
    }
  }, []);

  return {
    schedules,
    loading,
    error,
    refresh: fetchSchedules,
    create,
    update,
    remove,
    toggle,
    runNow,
  };
}
