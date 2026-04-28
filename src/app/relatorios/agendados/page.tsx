"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import {
  CalendarClock,
  Plus,
  ArrowLeft,
  Play,
  Pause,
  Edit3,
  Trash2,
  Loader2,
  AlertCircle,
  Clock,
  Users,
  Check,
  X,
} from "lucide-react";
import { useScheduledReports, type CreateScheduledReportInput } from "@/hooks/useScheduledReports";
import { useConnections } from "@/hooks/useConnections";
import { CRON_PRESETS, weeklyOnDay, monthlyOnDay, cronToLabel } from "@/lib/reports/cron-utils";
import type { ScheduledReport } from "@/types/reports";
import type { ProviderKey } from "@/types/providers";

/* ── Provider labels ────────────────────────────────────────── */

const PROVIDER_NAMES: Partial<Record<ProviderKey, string>> = {
  instagram: "Instagram",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  youtube: "YouTube",
  ga4: "Google Analytics",
  google_ads: "Google Ads",
  meta_ads: "Meta Ads",
  greatpages: "Greatpages",
  crm: "CRM",
};

/* ── Frequency types ─────────────────────────────────────────── */

type Frequency = "weekly" | "monthly" | "quarterly";

const DOW_OPTIONS = [
  { value: 1, label: "Segunda-feira" },
  { value: 2, label: "Terça-feira" },
  { value: 3, label: "Quarta-feira" },
  { value: 4, label: "Quinta-feira" },
  { value: 5, label: "Sexta-feira" },
  { value: 6, label: "Sábado" },
  { value: 0, label: "Domingo" },
];

/* ── Modal ──────────────────────────────────────────────────── */

interface ScheduleModalProps {
  editing?: ScheduledReport | null;
  connectedProviders: ProviderKey[];
  onSave: (input: CreateScheduledReportInput) => Promise<void>;
  onClose: () => void;
}

function ScheduleModal({ editing, connectedProviders, onSave, onClose }: ScheduleModalProps) {
  const [name, setName] = useState(editing?.name ?? "");
  const [frequency, setFrequency] = useState<Frequency>("monthly");
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [hour, setHour] = useState(9);
  const [selectedProviders, setSelectedProviders] = useState<ProviderKey[]>(
    editing?.providers as ProviderKey[] ?? connectedProviders
  );
  const [templateId, setTemplateId] = useState<string>(editing?.template_id ?? "executive");
  const [emailInput, setEmailInput] = useState("");
  const [recipients, setRecipients] = useState<string[]>(editing?.recipients ?? []);
  const [active, setActive] = useState(editing?.active ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function buildCron(): string {
    switch (frequency) {
      case "weekly": return weeklyOnDay(dayOfWeek, hour);
      case "monthly": return monthlyOnDay(dayOfMonth, hour);
      case "quarterly": return CRON_PRESETS.quarterly.cron;
    }
  }

  function addEmail() {
    const t = emailInput.trim();
    if (t && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t) && !recipients.includes(t)) {
      setRecipients((prev) => [...prev, t]);
      setEmailInput("");
    }
  }

  function toggleProvider(key: ProviderKey) {
    setSelectedProviders((prev) =>
      prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]
    );
  }

  async function handleSubmit() {
    if (!name.trim()) { setError("Informe um nome"); return; }
    if (selectedProviders.length === 0) { setError("Selecione ao menos 1 plataforma"); return; }
    if (recipients.length === 0) { setError("Informe ao menos 1 destinatário"); return; }

    setSaving(true);
    setError(null);
    try {
      await onSave({
        name: name.trim(),
        schedule_cron: buildCron(),
        providers: selectedProviders,
        template_id: templateId,
        recipients,
        active,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar");
      setSaving(false);
    }
  }

  const cronPreview = buildCron();

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-10 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-bg-card border border-border rounded-2xl p-6 w-full max-w-lg shadow-2xl my-4"
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-[16px] font-semibold text-text-primary">
            {editing ? "Editar agendamento" : "Novo agendamento"}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-all">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4">
          {/* Name */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-text-muted uppercase tracking-wider">Nome</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Relatório Mensal Instagram"
              className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2.5 text-[13px] text-text-primary placeholder-text-muted outline-none focus:border-accent/50"
            />
          </div>

          {/* Frequency */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-text-muted uppercase tracking-wider">Frequência</label>
            <div className="grid grid-cols-3 gap-2">
              {(["weekly", "monthly", "quarterly"] as Frequency[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFrequency(f)}
                  className={`py-2 rounded-lg text-[12px] font-medium border transition-all ${
                    frequency === f ? "border-accent bg-accent/10 text-accent" : "border-border text-text-secondary hover:border-accent/30"
                  }`}
                >
                  {f === "weekly" ? "Semanal" : f === "monthly" ? "Mensal" : "Trimestral"}
                </button>
              ))}
            </div>
          </div>

          {/* Day selector */}
          {frequency === "weekly" && (
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-text-muted uppercase tracking-wider">Dia da semana</label>
              <select
                value={dayOfWeek}
                onChange={(e) => setDayOfWeek(parseInt(e.target.value, 10))}
                className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2 text-[13px] text-text-primary outline-none focus:border-accent/50"
              >
                {DOW_OPTIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </div>
          )}

          {frequency === "monthly" && (
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-text-muted uppercase tracking-wider">Dia do mês</label>
              <select
                value={dayOfMonth}
                onChange={(e) => setDayOfMonth(parseInt(e.target.value, 10))}
                className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2 text-[13px] text-text-primary outline-none focus:border-accent/50"
              >
                {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>Dia {d}</option>)}
              </select>
            </div>
          )}

          {/* Hour */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-text-muted uppercase tracking-wider">Horário de envio</label>
            <select
              value={hour}
              onChange={(e) => setHour(parseInt(e.target.value, 10))}
              className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2 text-[13px] text-text-primary outline-none focus:border-accent/50"
            >
              {Array.from({ length: 24 }, (_, i) => i).map((h) => (
                <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>
              ))}
            </select>
          </div>

          {/* Cron preview */}
          <p className="text-[11px] text-text-muted">
            Agendamento: <span className="text-accent font-mono">{cronPreview}</span> — {cronToLabel(cronPreview)}
          </p>

          {/* Providers */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-text-muted uppercase tracking-wider">Plataformas</label>
            {connectedProviders.length === 0 ? (
              <p className="text-[12px] text-text-muted">Nenhuma plataforma conectada</p>
            ) : (
              <div className="grid grid-cols-2 gap-1.5">
                {connectedProviders.map((key) => {
                  const sel = selectedProviders.includes(key);
                  return (
                    <button key={key} onClick={() => toggleProvider(key)}
                      className={`flex items-center gap-2 p-2.5 rounded-lg border text-[12px] transition-all ${sel ? "border-accent bg-accent/10 text-accent" : "border-border text-text-secondary hover:border-accent/30"}`}
                    >
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${sel ? "border-accent bg-accent" : "border-border"}`}>
                        {sel && <Check size={9} className="text-bg-primary" />}
                      </div>
                      {PROVIDER_NAMES[key] ?? key}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Template */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-text-muted uppercase tracking-wider">Template</label>
            <select
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2 text-[13px] text-text-primary outline-none focus:border-accent/50"
            >
              <option value="executive">Executivo (resumido)</option>
              <option value="technical">Técnico (completo)</option>
              <option value="client">Cliente (visual)</option>
            </select>
          </div>

          {/* Recipients */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-text-muted uppercase tracking-wider">Destinatários</label>
            <div className="flex gap-2">
              <input
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addEmail()}
                placeholder="email@exemplo.com"
                className="flex-1 bg-bg-elevated border border-border rounded-lg px-3 py-2 text-[13px] text-text-primary placeholder-text-muted outline-none focus:border-accent/50"
              />
              <button onClick={addEmail} className="px-3 py-2 bg-accent/20 text-accent rounded-lg text-[13px] hover:bg-accent/30 transition-colors">
                +
              </button>
            </div>
            {recipients.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {recipients.map((e) => (
                  <span key={e} className="flex items-center gap-1 text-[11px] bg-bg-elevated border border-border rounded-full px-2 py-0.5 text-text-secondary">
                    {e}
                    <button onClick={() => setRecipients((p) => p.filter((x) => x !== e))} className="text-text-muted hover:text-red-400 ml-0.5">×</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Active toggle */}
          <div className="flex items-center justify-between py-2 border-t border-border">
            <span className="text-[13px] text-text-secondary">Ativo</span>
            <button
              onClick={() => setActive(!active)}
              className={`relative w-10 h-6 rounded-full transition-colors ${active ? "bg-accent" : "bg-bg-elevated border border-border"}`}
            >
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-sm ${active ? "left-5" : "left-1"}`} />
            </button>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-[12px]">
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button onClick={onClose} className="px-4 py-2 text-[13px] text-text-secondary hover:text-text-primary transition-colors">Cancelar</button>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 bg-accent text-bg-primary text-[13px] font-semibold rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

/* ── Page ───────────────────────────────────────────────────── */

export default function AgendadosPage() {
  const router = useRouter();
  const { schedules, loading, error, refresh, create, update, remove, toggle, runNow } = useScheduledReports();
  const { connections, isConnected } = useConnections();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<ScheduledReport | null>(null);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const connectedProviders = Object.keys(connections).filter((k) =>
    isConnected(k as ProviderKey)
  ) as ProviderKey[];

  async function handleSave(input: CreateScheduledReportInput) {
    if (editingSchedule) {
      await update({ id: editingSchedule.id, ...input });
    } else {
      await create(input);
    }
    setEditingSchedule(null);
  }

  async function handleRunNow(id: string) {
    setRunningId(id);
    await runNow(id);
    setRunningId(null);
    refresh();
  }

  async function handleDelete(id: string) {
    if (!confirm("Deletar este agendamento?")) return;
    setDeletingId(id);
    await remove(id);
    setDeletingId(null);
  }

  function handleEdit(schedule: ScheduledReport) {
    setEditingSchedule(schedule);
    setModalOpen(true);
  }

  function formatNextRun(iso: string | null): string {
    if (!iso) return "—";
    return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
  }

  function formatLastRun(iso: string | null): string {
    if (!iso) return "Nunca";
    return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(iso));
  }

  return (
    <div className="max-w-5xl mx-auto p-2 sm:p-4 md:p-6 space-y-5">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-all">
            <ArrowLeft size={18} />
          </button>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-accent/20 to-secondary/20 flex items-center justify-center">
              <CalendarClock size={18} className="text-accent" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-text-primary tracking-tight">Agendamentos</h1>
              <p className="text-[13px] text-text-secondary">Relatórios automáticos enviados por email</p>
            </div>
          </div>
        </div>
        <button
          onClick={() => { setEditingSchedule(null); setModalOpen(true); }}
          className="flex items-center gap-1.5 px-4 py-2 text-[13px] font-semibold bg-accent text-bg-primary rounded-lg hover:opacity-90 transition-opacity shadow-sm shadow-accent/20"
        >
          <Plus size={15} />
          Novo Agendamento
        </button>
      </motion.div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center justify-center py-20 gap-3 text-text-secondary">
            <Loader2 size={20} className="animate-spin text-accent" />
            <span className="text-[14px]">Carregando agendamentos...</span>
          </motion.div>
        ) : error ? (
          <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-[13px]">
            <AlertCircle size={18} />
            {error}
          </motion.div>
        ) : schedules.length === 0 ? (
          <motion.div key="empty" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-accent/10 to-secondary/10 flex items-center justify-center mb-5">
              <CalendarClock size={32} className="text-text-muted opacity-60" />
            </div>
            <h2 className="text-[18px] font-semibold text-text-primary mb-2">Nenhum agendamento</h2>
            <p className="text-[13px] text-text-secondary max-w-sm mb-6">
              Configure relatórios automáticos para receberem por email sem precisar gerar manualmente.
            </p>
            <button
              onClick={() => { setEditingSchedule(null); setModalOpen(true); }}
              className="flex items-center gap-2 px-5 py-2.5 bg-accent text-bg-primary text-[14px] font-semibold rounded-xl hover:opacity-90 transition-opacity"
            >
              <Plus size={16} />
              Criar primeiro agendamento
            </button>
          </motion.div>
        ) : (
          <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="bg-bg-card border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-text-muted uppercase tracking-wider">Agendamento</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-text-muted uppercase tracking-wider hidden sm:table-cell">Frequência</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-text-muted uppercase tracking-wider hidden md:table-cell">Próx. execução</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-text-muted uppercase tracking-wider hidden lg:table-cell">Destinatários</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-text-muted uppercase tracking-wider hidden md:table-cell">Última exec.</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-text-muted uppercase tracking-wider">Ativo</th>
                    <th className="text-right px-4 py-3 text-[11px] font-semibold text-text-muted uppercase tracking-wider">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence>
                    {schedules.map((s, i) => {
                      const isRunning = runningId === s.id;
                      const isDeleting = deletingId === s.id;
                      return (
                        <motion.tr
                          key={s.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 10 }}
                          transition={{ delay: i * 0.04 }}
                          className="border-b border-border/50 hover:bg-bg-elevated/30 transition-colors"
                        >
                          <td className="px-4 py-3.5">
                            <p className="text-[13px] font-medium text-text-primary truncate max-w-[180px]">{s.name}</p>
                            <div className="flex items-center gap-1 mt-0.5 text-[11px] text-text-muted">
                              <Clock size={10} />
                              Criado {new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(new Date(s.created_at))}
                            </div>
                          </td>
                          <td className="px-4 py-3.5 hidden sm:table-cell">
                            <span className="text-[12px] text-text-secondary">{cronToLabel(s.schedule_cron)}</span>
                          </td>
                          <td className="px-4 py-3.5 hidden md:table-cell">
                            <span className="text-[12px] text-text-secondary">{formatNextRun(s.next_run_at)}</span>
                          </td>
                          <td className="px-4 py-3.5 hidden lg:table-cell">
                            <div className="flex items-center gap-1 text-[12px] text-text-secondary">
                              <Users size={12} />
                              {s.recipients.length} email{s.recipients.length !== 1 ? "s" : ""}
                            </div>
                          </td>
                          <td className="px-4 py-3.5 hidden md:table-cell">
                            <span className="text-[12px] text-text-muted">{formatLastRun(s.last_run_at)}</span>
                          </td>
                          <td className="px-4 py-3.5">
                            <button
                              onClick={() => toggle(s.id, !s.active)}
                              className={`relative w-9 h-5 rounded-full transition-colors ${s.active ? "bg-accent" : "bg-bg-elevated border border-border"}`}
                            >
                              <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all shadow-sm ${s.active ? "left-4" : "left-0.5"}`} />
                            </button>
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => handleRunNow(s.id)}
                                disabled={isRunning}
                                title="Executar agora"
                                className="p-1.5 rounded-lg text-text-muted hover:text-accent hover:bg-accent/10 transition-all disabled:opacity-40"
                              >
                                {isRunning ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}
                              </button>
                              <button
                                onClick={() => handleEdit(s)}
                                title="Editar"
                                className="p-1.5 rounded-lg text-text-muted hover:text-accent hover:bg-accent/10 transition-all"
                              >
                                <Edit3 size={15} />
                              </button>
                              <button
                                onClick={() => toggle(s.id, !s.active)}
                                title={s.active ? "Pausar" : "Ativar"}
                                className="p-1.5 rounded-lg text-text-muted hover:text-amber-400 hover:bg-amber-400/10 transition-all"
                              >
                                <Pause size={15} />
                              </button>
                              <button
                                onClick={() => handleDelete(s.id)}
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

      {/* Modal */}
      <AnimatePresence>
        {modalOpen && (
          <ScheduleModal
            editing={editingSchedule}
            connectedProviders={connectedProviders}
            onSave={handleSave}
            onClose={() => { setModalOpen(false); setEditingSchedule(null); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
