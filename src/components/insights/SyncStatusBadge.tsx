"use client";

import { RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";

interface SyncStatusBadgeProps {
  syncStatus: "ok" | "pending" | "error";
  lastSyncedAt: string | null;
}

function formatRelative(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "agora mesmo";
  if (diffMin === 1) return "há 1 min";
  if (diffMin < 60) return `há ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH === 1) return "há 1 hora";
  return `há ${diffH} horas`;
}

export function SyncStatusBadge({ syncStatus, lastSyncedAt }: SyncStatusBadgeProps) {
  if (syncStatus === "pending") {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-warning/10 border border-warning/20 text-warning text-[12px] font-medium">
        <RefreshCw size={12} className="animate-spin shrink-0" />
        <span>Sincronizando dados em segundo plano...</span>
      </div>
    );
  }

  if (syncStatus === "error") {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-danger/10 border border-danger/20 text-danger text-[12px] font-medium">
        <AlertCircle size={12} className="shrink-0" />
        <span>Não foi possível atualizar. Mostrando últimos dados disponíveis.</span>
      </div>
    );
  }

  // syncStatus === "ok"
  if (!lastSyncedAt) return null;

  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-success/10 border border-success/20 text-success text-[12px] font-medium">
      <CheckCircle2 size={12} className="shrink-0" />
      <span>Atualizado {formatRelative(lastSyncedAt)}</span>
    </div>
  );
}
