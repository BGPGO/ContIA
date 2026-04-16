"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import Link from "next/link";
import {
  FileText,
  Plus,
  CalendarClock,
  Download,
  Send,
  Trash2,
  Eye,
  Loader2,
  AlertCircle,
  Clock,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useReports } from "@/hooks/useReports";
import type { Report, ReportStatus, ReportType } from "@/types/reports";

/* ── Constants ──────────────────────────────────────────────── */

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 3 }, (_, i) => CURRENT_YEAR - i);
const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const STATUS_CONFIG: Record<ReportStatus, { label: string; color: string; icon: React.FC<{ size?: number; className?: string }> }> = {
  ready: { label: "Pronto", color: "text-emerald-400 bg-emerald-400/10", icon: CheckCircle2 },
  generating: { label: "Gerando", color: "text-amber-400 bg-amber-400/10", icon: Loader2 },
  failed: { label: "Falhou", color: "text-red-400 bg-red-400/10", icon: XCircle },
};

const TYPE_LABELS: Record<ReportType, string> = {
  weekly: "Semanal",
  monthly: "Mensal",
  quarterly: "Trimestral",
  custom: "Personalizado",
};

const PROVIDER_COLORS: Record<string, string> = {
  instagram: "bg-pink-500/20 text-pink-300",
  facebook: "bg-blue-500/20 text-blue-300",
  linkedin: "bg-sky-500/20 text-sky-300",
  youtube: "bg-red-500/20 text-red-300",
  ga4: "bg-orange-500/20 text-orange-300",
  google_ads: "bg-yellow-500/20 text-yellow-300",
  meta_ads: "bg-indigo-500/20 text-indigo-300",
  greatpages: "bg-purple-500/20 text-purple-300",
  crm: "bg-teal-500/20 text-teal-300",
};

/* ── Helpers ────────────────────────────────────────────────── */

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(iso));
}

function formatPeriod(start: string, end: string): string {
  const fmt = (d: string) => new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(new Date(d));
  return `${fmt(start)} – ${fmt(end)}`;
}

/* ── Send modal ─────────────────────────────────────────────── */

function SendEmailModal({ report, onClose }: { report: Report; onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [emails, setEmails] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ sent: number; failed: string[] } | null>(null);

  function addEmail() {
    const trimmed = email.trim();
    if (trimmed && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) && !emails.includes(trimmed)) {
      setEmails((prev) => [...prev, trimmed]);
      setEmail("");
    }
  }

  async function handleSend() {
    if (emails.length === 0) return;
    setSending(true);
    try {
      const res = await fetch(`/api/reports/${report.id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipients: emails }),
      });
      const data = await res.json() as { sent: number; failed: string[] };
      setResult(data);
    } catch {
      setResult({ sent: 0, failed: emails });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-[#141736] border border-[#1e2348] rounded-2xl p-6 w-full max-w-md shadow-2xl"
      >
        <h3 className="text-[16px] font-semibold text-text-primary mb-1">Enviar por email</h3>
        <p className="text-[12px] text-text-secondary mb-4">{report.name}</p>

        {!result ? (
          <>
            <div className="flex gap-2 mb-3">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addEmail()}
                placeholder="email@exemplo.com"
                className="flex-1 bg-bg-elevated border border-border rounded-lg px-3 py-2 text-[13px] text-text-primary placeholder-text-muted outline-none focus:border-accent/50"
              />
              <button
                onClick={addEmail}
                className="px-3 py-2 bg-accent/20 text-accent rounded-lg text-[13px] hover:bg-accent/30 transition-colors"
              >
                Adicionar
              </button>
            </div>

            {emails.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-4">
                {emails.map((e) => (
                  <span key={e} className="flex items-center gap-1 text-[11px] bg-bg-elevated border border-border rounded-full px-2.5 py-1 text-text-secondary">
                    {e}
                    <button onClick={() => setEmails((prev) => prev.filter((x) => x !== e))} className="text-text-muted hover:text-red-400 ml-0.5">×</button>
                  </span>
                ))}
              </div>
            )}

            <div className="flex justify-end gap-2 mt-4">
              <button onClick={onClose} className="px-4 py-2 text-[13px] text-text-secondary hover:text-text-primary transition-colors">Cancelar</button>
              <button
                onClick={handleSend}
                disabled={sending || emails.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-accent text-bg-primary text-[13px] font-semibold rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                {sending ? "Enviando..." : `Enviar para ${emails.length}`}
              </button>
            </div>
          </>
        ) : (
          <div className="space-y-3">
            {result.sent > 0 && (
              <div className="flex items-center gap-2 p-3 bg-emerald-400/10 border border-emerald-400/20 rounded-lg text-emerald-400 text-[13px]">
                <CheckCircle2 size={16} /> {result.sent} email{result.sent > 1 ? "s" : ""} enviado{result.sent > 1 ? "s" : ""} com sucesso
              </div>
            )}
            {result.failed.length > 0 && (
              <div className="flex items-center gap-2 p-3 bg-red-400/10 border border-red-400/20 rounded-lg text-red-400 text-[13px]">
                <AlertCircle size={16} /> Falhou: {result.failed.join(", ")}
              </div>
            )}
            <button onClick={onClose} className="w-full px-4 py-2 text-[13px] text-text-secondary hover:text-text-primary border border-border rounded-lg transition-colors">
              Fechar
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}

/* ── Page ───────────────────────────────────────────────────── */

export default function RelatoriosPage() {
  const { reports, loading, error, deleteReport, filters, setFilters } = useReports();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [sendReport, setSendReport] = useState<Report | null>(null);

  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<ReportStatus | "all">("all");
  const [selectedType, setSelectedType] = useState<ReportType | "all">("all");

  function applyFilters() {
    setFilters({
      year: selectedYear,
      month: selectedMonth ?? undefined,
      status: selectedStatus,
      type: selectedType,
    });
  }

  function clearFilters() {
    setSelectedYear(currentDate.getFullYear());
    setSelectedMonth(null);
    setSelectedStatus("all");
    setSelectedType("all");
    setFilters({});
  }

  const hasActiveFilters = filters.year || filters.month || filters.status !== "all" || filters.type !== "all";

  async function handleDelete(id: string) {
    if (!confirm("Deletar este relatório? Esta ação não pode ser desfeita.")) return;
    setDeletingId(id);
    await deleteReport(id);
    setDeletingId(null);
  }

  return (
    <div className="space-y-5 p-2 sm:p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-accent/20 to-secondary/20 flex items-center justify-center">
            <FileText size={18} className="text-accent" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-text-primary tracking-tight">Relatórios</h1>
            <p className="text-[13px] text-text-secondary">Gere análises completas das suas redes e canais com IA</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/relatorios/agendados"
            className="flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium text-text-secondary hover:text-text-primary border border-border rounded-lg hover:border-accent/30 transition-all"
          >
            <CalendarClock size={15} />
            Agendados
          </Link>
          <Link
            href="/relatorios/novo"
            className="flex items-center gap-1.5 px-4 py-2 text-[13px] font-semibold bg-accent text-bg-primary rounded-lg hover:opacity-90 transition-opacity shadow-sm shadow-accent/20"
          >
            <Plus size={15} />
            Novo Relatório
          </Link>
        </div>
      </motion.div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="bg-bg-card border border-border rounded-xl p-4 space-y-3"
      >
        <div className="flex flex-wrap items-end gap-3">
          {/* Year picker */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-text-muted uppercase tracking-wider">Ano</label>
            <div className="flex items-center gap-1">
              <button onClick={() => setSelectedYear((y) => y - 1)} className="p-1 rounded hover:bg-bg-elevated text-text-muted hover:text-text-primary">
                <ChevronLeft size={14} />
              </button>
              <span className="text-[13px] font-medium text-text-primary px-2">{selectedYear}</span>
              <button onClick={() => setSelectedYear((y) => y + 1)} disabled={selectedYear >= CURRENT_YEAR} className="p-1 rounded hover:bg-bg-elevated text-text-muted hover:text-text-primary disabled:opacity-30">
                <ChevronRight size={14} />
              </button>
            </div>
          </div>

          {/* Month picker */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-text-muted uppercase tracking-wider">Mês</label>
            <select
              value={selectedMonth ?? ""}
              onChange={(e) => setSelectedMonth(e.target.value ? parseInt(e.target.value, 10) : null)}
              className="bg-bg-elevated border border-border rounded-lg px-3 py-1.5 text-[13px] text-text-primary outline-none focus:border-accent/50"
            >
              <option value="">Todos os meses</option>
              {MONTHS.map((m, i) => (
                <option key={i} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-text-muted uppercase tracking-wider">Status</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as ReportStatus | "all")}
              className="bg-bg-elevated border border-border rounded-lg px-3 py-1.5 text-[13px] text-text-primary outline-none focus:border-accent/50"
            >
              <option value="all">Todos</option>
              <option value="ready">Pronto</option>
              <option value="generating">Gerando</option>
              <option value="failed">Falhou</option>
            </select>
          </div>

          {/* Type */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-text-muted uppercase tracking-wider">Tipo</label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value as ReportType | "all")}
              className="bg-bg-elevated border border-border rounded-lg px-3 py-1.5 text-[13px] text-text-primary outline-none focus:border-accent/50"
            >
              <option value="all">Todos</option>
              <option value="weekly">Semanal</option>
              <option value="monthly">Mensal</option>
              <option value="quarterly">Trimestral</option>
              <option value="custom">Personalizado</option>
            </select>
          </div>

          <div className="flex items-end gap-2">
            <button
              onClick={applyFilters}
              className="px-4 py-1.5 bg-accent text-bg-primary text-[13px] font-semibold rounded-lg hover:opacity-90 transition-opacity"
            >
              Filtrar
            </button>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="px-3 py-1.5 text-[13px] text-text-secondary hover:text-text-primary border border-border rounded-lg hover:border-accent/30 transition-all"
              >
                Limpar
              </button>
            )}
          </div>
        </div>
      </motion.div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center justify-center py-20 gap-3 text-text-secondary"
          >
            <Loader2 size={20} className="animate-spin text-accent" />
            <span className="text-[14px]">Carregando relatórios...</span>
          </motion.div>
        ) : error ? (
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-[13px]"
          >
            <AlertCircle size={18} />
            {error}
          </motion.div>
        ) : reports.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center py-24 text-center"
          >
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-accent/10 to-secondary/10 flex items-center justify-center mb-5">
              <FileText size={32} className="text-text-muted opacity-60" />
            </div>
            <h2 className="text-[18px] font-semibold text-text-primary mb-2">Nenhum relatório encontrado</h2>
            <p className="text-[13px] text-text-secondary max-w-sm mb-6">
              {hasActiveFilters
                ? "Nenhum relatório corresponde aos filtros selecionados."
                : "Você ainda não gerou nenhum relatório. Comece agora."}
            </p>
            {!hasActiveFilters && (
              <Link
                href="/relatorios/novo"
                className="flex items-center gap-2 px-5 py-2.5 bg-accent text-bg-primary text-[14px] font-semibold rounded-xl hover:opacity-90 transition-opacity shadow-sm shadow-accent/20"
              >
                <Plus size={16} />
                Gerar primeiro relatório
              </Link>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="bg-bg-card border border-border rounded-xl overflow-hidden"
          >
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-text-muted uppercase tracking-wider">Relatório</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-text-muted uppercase tracking-wider hidden md:table-cell">Período</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-text-muted uppercase tracking-wider hidden lg:table-cell">Plataformas</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-text-muted uppercase tracking-wider hidden md:table-cell">Tipo</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-text-muted uppercase tracking-wider">Status</th>
                    <th className="text-right px-4 py-3 text-[11px] font-semibold text-text-muted uppercase tracking-wider">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence>
                    {reports.map((report, i) => {
                      const statusCfg = STATUS_CONFIG[report.status];
                      const StatusIcon = statusCfg.icon;
                      const isDeleting = deletingId === report.id;

                      return (
                        <motion.tr
                          key={report.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 10 }}
                          transition={{ delay: i * 0.03 }}
                          className="border-b border-border/50 hover:bg-bg-elevated/30 transition-colors group"
                        >
                          <td className="px-4 py-3.5">
                            <div>
                              <p className="text-[13px] font-medium text-text-primary group-hover:text-accent transition-colors truncate max-w-[200px]">
                                {report.name}
                              </p>
                              <p className="text-[11px] text-text-muted mt-0.5 flex items-center gap-1">
                                <Clock size={10} />
                                {formatDate(report.created_at)}
                              </p>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 hidden md:table-cell">
                            <span className="text-[12px] text-text-secondary">
                              {formatPeriod(report.period_start, report.period_end)}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 hidden lg:table-cell">
                            <div className="flex flex-wrap gap-1">
                              {report.providers.slice(0, 3).map((p) => (
                                <span key={p} className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${PROVIDER_COLORS[p] ?? "bg-bg-elevated text-text-muted"}`}>
                                  {p}
                                </span>
                              ))}
                              {report.providers.length > 3 && (
                                <span className="text-[10px] text-text-muted">+{report.providers.length - 3}</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3.5 hidden md:table-cell">
                            <span className="text-[12px] text-text-secondary">{TYPE_LABELS[report.type]}</span>
                          </td>
                          <td className="px-4 py-3.5">
                            <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-1 rounded-full ${statusCfg.color}`}>
                              <StatusIcon size={11} className={report.status === "generating" ? "animate-spin" : ""} />
                              {statusCfg.label}
                            </span>
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center justify-end gap-1">
                              <Link
                                href={`/relatorios/${report.id}`}
                                title="Ver relatório"
                                className="p-1.5 rounded-lg text-text-muted hover:text-accent hover:bg-accent/10 transition-all"
                              >
                                <Eye size={15} />
                              </Link>
                              {report.pdf_url && (
                                <a
                                  href={report.pdf_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title="Download PDF"
                                  className="p-1.5 rounded-lg text-text-muted hover:text-accent hover:bg-accent/10 transition-all"
                                >
                                  <Download size={15} />
                                </a>
                              )}
                              {report.status === "ready" && (
                                <button
                                  onClick={() => setSendReport(report)}
                                  title="Enviar por email"
                                  className="p-1.5 rounded-lg text-text-muted hover:text-accent hover:bg-accent/10 transition-all"
                                >
                                  <Send size={15} />
                                </button>
                              )}
                              <button
                                onClick={() => handleDelete(report.id)}
                                disabled={isDeleting}
                                title="Deletar"
                                className="p-1.5 rounded-lg text-text-muted hover:text-red-400 hover:bg-red-400/10 transition-all disabled:opacity-40"
                              >
                                {isDeleting ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                              </button>
                            </div>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Send email modal */}
      <AnimatePresence>
        {sendReport && (
          <SendEmailModal report={sendReport} onClose={() => setSendReport(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
