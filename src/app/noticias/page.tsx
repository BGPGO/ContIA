"use client";

import { useState, useMemo } from "react";
import {
  Rss,
  ChevronDown,
  ChevronUp,
  Plus,
  X,
  ExternalLink,
  ToggleLeft,
  ToggleRight,
  Newspaper,
  Tag,
  Clock,
} from "lucide-react";
import { useEmpresa } from "@/hooks/useEmpresa";
import { noticiasMock } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { ConfigRSS, Noticia } from "@/types";

// ─── helpers ────────────────────────────────────────────────────────────────

function formatRelativeDate(dateStr: string): string {
  const now = new Date();
  // normalise to midnight for comparison
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const d = new Date(dateStr);
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffMs = today.getTime() - target.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Hoje";
  if (diffDays === 1) return "Ontem";
  if (diffDays < 7) return `${diffDays} dias`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} sem.`;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

// Stable topic colour mapping
const TOPIC_COLORS: Record<string, string> = {
  "Inteligencia Artificial": "var(--color-accent)",
  Startups: "var(--color-warning)",
  "Redes Sociais": "var(--color-instagram)",
  "Marketing Digital": "var(--color-success)",
  SEO: "var(--color-info)",
  Tecnologia: "var(--color-accent-light)",
  Gastronomia: "#e17055",
};

function topicColor(topico: string): string {
  return TOPIC_COLORS[topico] ?? "var(--color-accent)";
}

// ─── add feed modal ───────────────────────────────────────────────────────────

interface AddFeedModalProps {
  onClose: () => void;
  onAdd: (feed: ConfigRSS) => void;
}

function AddFeedModal({ onClose, onAdd }: AddFeedModalProps) {
  const [nome, setNome] = useState("");
  const [url, setUrl] = useState("");
  const [topico, setTopico] = useState("Tecnologia");
  const [error, setError] = useState("");

  const topicos = [
    "Inteligencia Artificial",
    "Startups",
    "Redes Sociais",
    "Marketing Digital",
    "SEO",
    "Tecnologia",
    "Gastronomia",
    "Outro",
  ];

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim() || !url.trim()) {
      setError("Preencha nome e URL.");
      return;
    }
    try {
      new URL(url);
    } catch {
      setError("URL invalida. Inclua http:// ou https://");
      return;
    }
    onAdd({ nome: nome.trim(), url: url.trim(), topico, ativo: true });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-bg-card backdrop-blur-xl border border-border rounded-xl p-4 fade-in shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-text-primary">Adicionar Feed RSS</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-card-hover transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs text-text-secondary">Nome do feed</label>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: TechCrunch"
              className="w-full px-2.5 py-1.5 rounded-lg bg-bg-card border border-border text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/40 transition-colors text-xs"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-text-secondary">URL do feed</label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://exemplo.com/feed/"
              className="w-full px-2.5 py-1.5 rounded-lg bg-bg-card border border-border text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/40 transition-colors text-xs"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-text-secondary">Topico</label>
            <select
              value={topico}
              onChange={(e) => setTopico(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg bg-bg-card border border-border text-text-primary focus:outline-none focus:border-accent/40 transition-colors text-xs appearance-none"
            >
              {topicos.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {error && <p className="text-xs text-danger">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-3 py-1.5 rounded-lg border border-border text-text-secondary hover:text-text-primary hover:bg-bg-card transition-colors text-xs"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 px-3 py-1.5 rounded-lg bg-accent/90 hover:bg-accent text-white transition-colors text-xs font-medium"
            >
              Adicionar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── RSS config section ───────────────────────────────────────────────────────

interface RSSConfigSectionProps {
  feeds: ConfigRSS[];
  onFeedsChange: (feeds: ConfigRSS[]) => void;
}

function RSSConfigSection({ feeds, onFeedsChange }: RSSConfigSectionProps) {
  const [collapsed, setCollapsed] = useState(true);
  const [showModal, setShowModal] = useState(false);

  function toggleFeed(index: number) {
    const updated = feeds.map((f, i) =>
      i === index ? { ...f, ativo: !f.ativo } : f
    );
    onFeedsChange(updated);
  }

  function addFeed(feed: ConfigRSS) {
    onFeedsChange([...feeds, feed]);
  }

  function truncateUrl(url: string, max = 38): string {
    return url.length > max ? url.slice(0, max) + "..." : url;
  }

  return (
    <>
      {showModal && (
        <AddFeedModal onClose={() => setShowModal(false)} onAdd={addFeed} />
      )}

      <div className="bg-bg-card backdrop-blur-xl border border-border rounded-xl overflow-hidden">
        {/* section header */}
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-left group hover:bg-bg-card transition-colors"
        >
          <div className="flex items-center gap-2">
            <Rss size={13} className="text-accent" />
            <span className="font-medium text-text-primary text-xs">
              Feeds RSS
            </span>
            <span className="text-[10px] text-text-muted bg-bg-card-hover border border-border px-1.5 py-0.5 rounded-full tabular-nums">
              {feeds.length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowModal(true);
              }}
              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] text-accent hover:text-accent-light transition-colors"
            >
              <Plus size={11} />
              Adicionar
            </button>
            <span className="text-text-muted group-hover:text-text-secondary transition-colors">
              {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
            </span>
          </div>
        </button>

        {/* collapsible body */}
        {!collapsed && (
          <div className="px-4 pb-3 space-y-1">
            {feeds.length === 0 ? (
              <p className="text-text-muted text-xs text-center py-3 italic">
                Nenhum feed configurado.
              </p>
            ) : (
              feeds.map((feed, idx) => {
                const cor = topicColor(feed.topico);
                return (
                  <div
                    key={idx}
                    className={cn(
                      "flex items-center justify-between gap-3 px-3 py-2 rounded-lg transition-colors",
                      feed.ativo
                        ? "bg-bg-card/50"
                        : "bg-bg-card/20 opacity-40"
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: cor }}
                      />
                      <span className="text-xs font-medium text-text-primary truncate">
                        {feed.nome}
                      </span>
                      <span className="text-[10px] text-text-muted font-mono truncate hidden sm:block">
                        {truncateUrl(feed.url)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className="text-[10px] font-medium px-1.5 py-0.5 rounded-full hidden sm:inline-block"
                        style={{
                          backgroundColor: `${cor}15`,
                          color: cor,
                        }}
                      >
                        {feed.topico}
                      </span>
                      <button
                        onClick={() => toggleFeed(idx)}
                        className="transition-colors"
                        style={{ color: feed.ativo ? "var(--color-success)" : "var(--color-text-muted)" }}
                        title={feed.ativo ? "Desativar feed" : "Ativar feed"}
                      >
                        {feed.ativo ? (
                          <ToggleRight size={16} />
                        ) : (
                          <ToggleLeft size={16} />
                        )}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </>
  );
}

// ─── topic filter pills ──────────────────────────────────────────────────────

interface TopicFiltersProps {
  topics: string[];
  selected: string | null;
  onChange: (t: string | null) => void;
}

function TopicFilters({ topics, selected, onChange }: TopicFiltersProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <button
        onClick={() => onChange(null)}
        className={cn(
          "px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all",
          selected === null
            ? "bg-accent/15 border-accent/30 text-accent"
            : "bg-bg-card/50 border-border text-text-muted hover:text-text-secondary hover:border-border-light"
        )}
      >
        Todos
      </button>

      {topics.map((t) => {
        const cor = topicColor(t);
        const active = selected === t;
        return (
          <button
            key={t}
            onClick={() => onChange(active ? null : t)}
            className="px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all"
            style={
              active
                ? {
                    backgroundColor: `${cor}15`,
                    borderColor: `${cor}30`,
                    color: cor,
                  }
                : {
                    backgroundColor: "rgba(255,255,255,0.02)",
                    borderColor: "rgba(255,255,255,0.06)",
                    color: "var(--color-text-muted)",
                  }
            }
          >
            {t}
          </button>
        );
      })}
    </div>
  );
}

// ─── news card ────────────────────────────────────────────────────────────────

interface NewsCardProps {
  noticia: Noticia;
}

function NewsCard({ noticia }: NewsCardProps) {
  const cor = topicColor(noticia.topico);
  const relDate = formatRelativeDate(noticia.publicado_em);

  return (
    <a
      href={noticia.url}
      target="_blank"
      rel="noopener noreferrer"
      className="bg-bg-card backdrop-blur-xl border border-border rounded-xl p-4 fade-in flex flex-col gap-2.5 group cursor-pointer no-underline hover:bg-bg-card-hover hover:border-border-light transition-all"
    >
      {/* top row: source + date */}
      <div className="flex items-center justify-between gap-2">
        <span
          className="text-[11px] font-medium px-2 py-0.5 rounded-full"
          style={{
            backgroundColor: `${cor}10`,
            color: cor,
          }}
        >
          {noticia.fonte}
        </span>
        <span className="text-[11px] text-text-muted flex items-center gap-1">
          <Clock size={10} />
          {relDate}
        </span>
      </div>

      {/* headline */}
      <h3 className="text-sm font-medium text-text-primary group-hover:text-accent/90 transition-colors leading-snug line-clamp-2">
        {noticia.titulo}
        <ExternalLink
          size={10}
          className="inline-block ml-1 mb-0.5 opacity-0 group-hover:opacity-50 transition-opacity"
        />
      </h3>

      {/* summary */}
      <p className="text-xs text-text-secondary leading-relaxed line-clamp-3 flex-1">
        {noticia.resumo}
      </p>

      {/* bottom: topic badge */}
      <div className="mt-auto">
        <span
          className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full"
          style={{
            backgroundColor: `${cor}10`,
            color: cor,
          }}
        >
          <span
            className="w-1 h-1 rounded-full shrink-0"
            style={{ backgroundColor: cor }}
          />
          {noticia.topico}
        </span>
      </div>
    </a>
  );
}

// ─── main page ────────────────────────────────────────────────────────────────

export default function NoticiasPage() {
  const { empresa } = useEmpresa();
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [feeds, setFeeds] = useState<ConfigRSS[]>(empresa?.config_rss ?? []);

  // keep feeds in sync when empresa changes
  const empresaFeeds = empresa?.config_rss ?? [];
  const mergedFeeds = useMemo(() => {
    // if feeds state was seeded from empresa, just use state
    return feeds;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feeds]);

  // Derive unique topics from mock data
  const topics = useMemo(() => {
    return Array.from(new Set(noticiasMock.map((n) => n.topico))).sort();
  }, []);

  // Filter news
  const filtered = useMemo(() => {
    if (!selectedTopic) return noticiasMock;
    return noticiasMock.filter((n) => n.topico === selectedTopic);
  }, [selectedTopic]);

  if (!empresa) {
    return (
      <div className="flex items-center justify-center h-64 text-text-secondary text-sm">
        Nenhuma empresa selecionada.
      </div>
    );
  }

  return (
    <div className="fade-in space-y-4 p-4 max-w-6xl mx-auto">

      {/* ── header ─────────────────────────────────────────────────────── */}
      <h1 className="text-xl font-semibold text-text-primary tracking-tight">
        Consolidador de Noticias
      </h1>

      {/* ── RSS config ──────────────────────────────────────────────────── */}
      <RSSConfigSection
        feeds={mergedFeeds.length ? mergedFeeds : empresaFeeds}
        onFeedsChange={setFeeds}
      />

      {/* ── topic filters ───────────────────────────────────────────────── */}
      <TopicFilters
        topics={topics}
        selected={selectedTopic}
        onChange={setSelectedTopic}
      />

      {/* ── news grid ───────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-text-secondary">
            {selectedTopic ? selectedTopic : "Todas as noticias"}
          </span>
          <span className="text-[11px] text-text-muted tabular-nums">
            {filtered.length} {filtered.length === 1 ? "artigo" : "artigos"}
          </span>
        </div>

        {filtered.length === 0 ? (
          <div className="bg-bg-card backdrop-blur-xl border border-border rounded-xl text-center py-10 space-y-2">
            <Newspaper size={28} className="text-text-muted mx-auto" />
            <p className="text-text-secondary text-sm">Nenhum artigo encontrado.</p>
            <p className="text-text-muted text-xs">Tente selecionar outro topico.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filtered.map((n) => (
              <NewsCard key={n.id} noticia={n} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
