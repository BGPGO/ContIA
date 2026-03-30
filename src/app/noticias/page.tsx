"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
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
  RefreshCw,
  Loader2,
} from "lucide-react";
import { useEmpresa } from "@/hooks/useEmpresa";
import { noticiasMock } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { ConfigRSS, Noticia } from "@/types";

// ── helpers ────────────────────────────────────────────────────────────────

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
  "Intelig\u00eancia Artificial": "var(--color-accent)",
  Startups: "var(--color-warning)",
  "Redes Sociais": "var(--color-instagram)",
  "Marketing Digital": "var(--color-success)",
  Marketing: "var(--color-success)",
  SEO: "var(--color-info)",
  Tecnologia: "var(--color-accent-light)",
  Tech: "var(--color-accent-light)",
  Gastronomia: "#e17055",
  Geral: "var(--color-info)",
  Negocios: "var(--color-warning)",
};

function topicColor(topico: string): string {
  return TOPIC_COLORS[topico] ?? "var(--color-accent)";
}

// ── add feed modal ───────────────────────────────────────────────────────────

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
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-sm bg-bg-card backdrop-blur-xl border border-border rounded-xl p-4 shadow-2xl">
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
      </motion.div>
    </div>
  );
}

// ── RSS config section ───────────────────────────────────────────────────────

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
      <AnimatePresence>
        {showModal && (
          <AddFeedModal onClose={() => setShowModal(false)} onAdd={addFeed} />
        )}
      </AnimatePresence>

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
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
              className="overflow-hidden"
            >
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
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}

// ── topic filter pills ──────────────────────────────────────────────────────

interface TopicFiltersProps {
  topics: string[];
  selected: string | null;
  onChange: (t: string | null) => void;
}

function TopicFilters({ topics, selected, onChange }: TopicFiltersProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <motion.button
        whileTap={{ scale: 0.92 }}
        layout
        onClick={() => onChange(null)}
        className={cn(
          "px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all",
          selected === null
            ? "bg-accent/15 border-accent/30 text-accent"
            : "bg-bg-card/50 border-border text-text-muted hover:text-text-secondary hover:border-border-light"
        )}
      >
        Todos
      </motion.button>

      {topics.map((t) => {
        const cor = topicColor(t);
        const active = selected === t;
        return (
          <motion.button
            key={t}
            whileTap={{ scale: 0.92 }}
            layout
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
          </motion.button>
        );
      })}
    </div>
  );
}

// ── news card ────────────────────────────────────────────────────────────────

interface NewsCardProps {
  noticia: Noticia;
  index: number;
}

function NewsCard({ noticia, index }: NewsCardProps) {
  const cor = topicColor(noticia.topico);
  const relDate = formatRelativeDate(noticia.publicado_em);

  return (
    <motion.a
      href={noticia.url}
      target="_blank"
      rel="noopener noreferrer"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className="bg-bg-card backdrop-blur-xl border border-border rounded-xl p-4 flex flex-col gap-2.5 group cursor-pointer no-underline hover:bg-bg-card-hover hover:border-border-light transition-colors"
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
    </motion.a>
  );
}

// ── main page ────────────────────────────────────────────────────────────────

export default function NoticiasPage() {
  const { empresa } = useEmpresa();
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [feeds, setFeeds] = useState<ConfigRSS[]>(empresa?.config_rss ?? []);
  const [noticias, setNoticias] = useState<Noticia[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingMock, setUsingMock] = useState(false);

  // keep feeds in sync when empresa changes
  useEffect(() => {
    if (empresa?.config_rss) {
      setFeeds(empresa.config_rss);
    }
  }, [empresa?.config_rss]);

  const fetchNoticias = useCallback(async () => {
    if (!empresa) return;

    setLoading(true);
    setUsingMock(false);

    try {
      const params = new URLSearchParams({
        nicho: empresa.nicho || "geral",
        empresa_id: empresa.id,
      });
      const res = await fetch(`/api/noticias?${params.toString()}`);

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();

      if (data.noticias && data.noticias.length > 0) {
        // Mapear resposta da API para o tipo Noticia da pagina
        const mapped: Noticia[] = data.noticias.map((n: {
          id: string;
          titulo: string;
          descricao?: string;
          url: string;
          fonte: string;
          topico: string;
          publicado_em: string;
          imagem_url: string | null;
          resumo?: string;
        }) => ({
          id: n.id,
          titulo: n.titulo,
          fonte: n.fonte,
          url: n.url,
          resumo: n.resumo || n.descricao || "",
          topico: n.topico,
          publicado_em: n.publicado_em,
          imagem_url: n.imagem_url,
        }));
        setNoticias(mapped);
      } else {
        // Sem resultados da API — usar mock
        setNoticias(noticiasMock);
        setUsingMock(true);
      }
    } catch (err) {
      console.error("Erro ao buscar noticias, usando dados mock:", err);
      setNoticias(noticiasMock);
      setUsingMock(true);
    } finally {
      setLoading(false);
    }
  }, [empresa]);

  // Fetch on mount and when empresa changes
  useEffect(() => {
    fetchNoticias();
  }, [fetchNoticias]);

  // Derive unique topics from noticias
  const topics = useMemo(() => {
    return Array.from(new Set(noticias.map((n) => n.topico))).sort();
  }, [noticias]);

  // Filter news
  const filtered = useMemo(() => {
    if (!selectedTopic) return noticias;
    return noticias.filter((n) => n.topico === selectedTopic);
  }, [selectedTopic, noticias]);

  if (!empresa) {
    return (
      <div className="flex items-center justify-center h-64 text-text-secondary text-sm">
        Nenhuma empresa selecionada.
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 max-w-6xl mx-auto">

      {/* ── header ─────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <h1 className="text-xl font-semibold text-text-primary tracking-tight">
          Consolidador de Noticias
        </h1>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={fetchNoticias}
          disabled={loading}
          className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border",
            loading
              ? "border-border text-text-muted cursor-not-allowed"
              : "border-accent/30 text-accent hover:bg-accent/10"
          )}
        >
          {loading ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <RefreshCw size={12} />
          )}
          Atualizar
        </motion.button>
      </motion.div>

      {/* ── mock fallback notice ──────────────────────────────────────── */}
      {usingMock && !loading && (
        <div className="bg-bg-card border border-border rounded-lg px-3 py-2 text-xs text-text-muted flex items-center gap-2">
          <Tag size={12} />
          Exibindo dados de exemplo. Os feeds RSS reais nao retornaram resultados.
        </div>
      )}

      {/* ── RSS config ──────────────────────────────────────────────────── */}
      <RSSConfigSection
        feeds={feeds}
        onFeedsChange={setFeeds}
      />

      {/* ── topic filters ───────────────────────────────────────────────── */}
      {!loading && topics.length > 0 && (
        <TopicFilters
          topics={topics}
          selected={selectedTopic}
          onChange={setSelectedTopic}
        />
      )}

      {/* ── news grid ───────────────────────────────────────────────────── */}
      <div className="space-y-3">
        {!loading && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-secondary">
              {selectedTopic ? selectedTopic : "Todas as noticias"}
            </span>
            <span className="text-[11px] text-text-muted tabular-nums">
              {filtered.length} {filtered.length === 1 ? "artigo" : "artigos"}
            </span>
          </div>
        )}

        {loading ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-bg-card backdrop-blur-xl border border-border rounded-xl text-center py-14 space-y-3"
          >
            <Loader2 size={24} className="text-accent mx-auto animate-spin" />
            <p className="text-text-secondary text-sm">Buscando noticias dos feeds RSS...</p>
          </motion.div>
        ) : filtered.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-bg-card backdrop-blur-xl border border-border rounded-xl text-center py-10 space-y-2"
          >
            <Newspaper size={28} className="text-text-muted mx-auto" />
            <p className="text-text-secondary text-sm">Nenhum artigo encontrado.</p>
            <p className="text-text-muted text-xs">Tente selecionar outro topico.</p>
          </motion.div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedTopic ?? "all"}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-3"
            >
              {filtered.map((n, i) => (
                <NewsCard key={n.id} noticia={n} index={i} />
              ))}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
