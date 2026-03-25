"use client";

import { useState, useMemo } from "react";
import {
  Plus,
  X,
  TrendingUp,
  TrendingDown,
  ChevronUp,
  ChevronDown,
  Users,
  Activity,
  Clock,
  Search,
} from "lucide-react";
import { useEmpresa } from "@/hooks/useEmpresa";
import { concorrentesMock } from "@/lib/mock-data";
import { cn, formatNumber, getPlataformaCor, getPlataformaLabel } from "@/lib/utils";
import { Concorrente, ConcorrentePlataforma, PostConcorrente } from "@/types";

// ─── helpers ────────────────────────────────────────────────────────────────

const PLATAFORMAS = ["instagram", "facebook", "linkedin", "twitter", "youtube", "tiktok"];

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

// Deterministic "trend" derived from engagement rate — no random() on each render
function getTrend(taxa: number): "up" | "down" {
  return taxa >= 4.0 ? "up" : "down";
}

// ─── modal: adicionar concorrente ─────────────────────────────────────────────

interface AddConcorrenteModalProps {
  onClose: () => void;
  onAdd: (c: Concorrente) => void;
  empresaId: string;
}

function AddConcorrenteModal({ onClose, onAdd, empresaId }: AddConcorrenteModalProps) {
  const [nome, setNome] = useState("");
  const [plataforma, setPlataforma] = useState("instagram");
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim() || !username.trim()) {
      setError("Preencha nome e username.");
      return;
    }
    const novo: Concorrente = {
      id: `c-${Date.now()}`,
      empresa_id: empresaId,
      nome: nome.trim(),
      plataformas: [
        {
          rede: plataforma,
          username: username.trim(),
          seguidores: 0,
          taxa_engajamento: 0,
          freq_postagem: "—",
          posts_recentes: [],
        },
      ],
      created_at: new Date().toISOString(),
    };
    onAdd(novo);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative w-full max-w-sm bg-bg-card backdrop-blur-xl border border-border rounded-xl p-4 fade-in shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-text-primary">Adicionar Concorrente</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-card-hover transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs text-text-secondary">Nome do concorrente</label>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Acme Corp"
              className="w-full px-2.5 py-1.5 rounded-lg bg-bg-card border border-border text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/40 transition-colors text-xs"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-text-secondary">Plataforma</label>
            <select
              value={plataforma}
              onChange={(e) => setPlataforma(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg bg-bg-card border border-border text-text-primary focus:outline-none focus:border-accent/40 transition-colors text-xs appearance-none"
            >
              {PLATAFORMAS.map((p) => (
                <option key={p} value={p}>
                  {getPlataformaLabel(p)}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-text-secondary">Username / Handle</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="@usuario ou perfil"
              className="w-full px-2.5 py-1.5 rounded-lg bg-bg-card border border-border text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/40 transition-colors text-xs"
            />
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

// ─── posts table per platform ─────────────────────────────────────────────────

type SortField = "conteudo" | "data" | "curtidas" | "comentarios" | "compartilhamentos";

interface PostsTableProps {
  posts: PostConcorrente[];
  plataformaLabel: string;
  cor: string;
}

function PostsTable({ posts, plataformaLabel, cor }: PostsTableProps) {
  const [sortField, setSortField] = useState<SortField>("data");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  }

  const sorted = useMemo(() => {
    return [...posts].sort((a, b) => {
      let cmp = 0;
      if (sortField === "conteudo") {
        cmp = a.conteudo.localeCompare(b.conteudo);
      } else if (sortField === "data") {
        cmp = a.data.localeCompare(b.data);
      } else {
        cmp = a[sortField] - b[sortField];
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [posts, sortField, sortDir]);

  if (posts.length === 0) {
    return (
      <p className="text-text-muted text-[11px] text-center py-2 italic">
        Sem posts recentes em {plataformaLabel}.
      </p>
    );
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) {
      return <ChevronUp size={10} className="opacity-20" />;
    }
    return sortDir === "asc" ? (
      <ChevronUp size={10} style={{ color: cor }} />
    ) : (
      <ChevronDown size={10} style={{ color: cor }} />
    );
  }

  const cols: { field: SortField; label: string; align: string }[] = [
    { field: "conteudo", label: "Conteudo", align: "text-left" },
    { field: "data", label: "Data", align: "text-center" },
    { field: "curtidas", label: "Curtidas", align: "text-right" },
    { field: "comentarios", label: "Coment.", align: "text-right" },
    { field: "compartilhamentos", label: "Compart.", align: "text-right" },
  ];

  return (
    <div className="overflow-x-auto mt-2 rounded-lg border border-border-subtle">
      <table className="w-full text-[11px]">
        <thead>
          <tr className="border-b border-border-subtle bg-bg-card/50">
            {cols.map((c) => (
              <th
                key={c.field}
                className={cn(
                  "px-2.5 py-1.5 font-medium text-text-muted cursor-pointer select-none hover:text-text-secondary transition-colors",
                  c.align
                )}
                onClick={() => toggleSort(c.field)}
              >
                <span className="inline-flex items-center gap-0.5">
                  {c.label} <SortIcon field={c.field} />
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((post, idx) => (
            <tr
              key={idx}
              className="border-b border-border-subtle last:border-0 hover:bg-bg-card transition-colors"
            >
              <td className="px-2.5 py-1.5 text-text-secondary max-w-[180px]">
                <span className="line-clamp-1 leading-snug">{post.conteudo}</span>
              </td>
              <td className="px-2.5 py-1.5 text-text-muted text-center whitespace-nowrap">
                {formatShortDate(post.data)}
              </td>
              <td className="px-2.5 py-1.5 text-right">
                <span className="text-danger/80 font-medium tabular-nums">
                  {formatNumber(post.curtidas)}
                </span>
              </td>
              <td className="px-2.5 py-1.5 text-right">
                <span className="text-info/80 font-medium tabular-nums">
                  {formatNumber(post.comentarios)}
                </span>
              </td>
              <td className="px-2.5 py-1.5 text-right">
                <span className="text-success/80 font-medium tabular-nums">
                  {formatNumber(post.compartilhamentos)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── platform section ─────────────────────────────────────────────────────────

interface PlatformSectionProps {
  plat: ConcorrentePlataforma;
}

function PlatformSection({ plat }: PlatformSectionProps) {
  const cor = getPlataformaCor(plat.rede);
  const label = getPlataformaLabel(plat.rede);
  const trend = getTrend(plat.taxa_engajamento);

  return (
    <div className="rounded-lg border border-border-subtle bg-bg-card/50 p-3 space-y-2">
      {/* platform header row */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: cor }}
          />
          <span className="font-medium text-xs text-text-primary">{label}</span>
          <span className="text-[11px] text-text-muted">{plat.username}</span>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full",
            trend === "up"
              ? "bg-success/10 text-success"
              : "bg-danger/10 text-danger"
          )}
        >
          {trend === "up" ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
          {trend === "up" ? "Em alta" : "Em queda"}
        </span>
      </div>

      {/* stats row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="flex flex-col">
          <span className="text-[10px] text-text-muted flex items-center gap-1">
            <Users size={9} /> Seguidores
          </span>
          <span className="text-xs font-semibold text-text-primary tabular-nums">
            {formatNumber(plat.seguidores)}
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] text-text-muted flex items-center gap-1">
            <Activity size={9} /> Engajamento
          </span>
          <span
            className="text-xs font-semibold tabular-nums"
            style={{ color: cor }}
          >
            {plat.taxa_engajamento.toFixed(1)}%
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] text-text-muted flex items-center gap-1">
            <Clock size={9} /> Frequencia
          </span>
          <span className="text-xs font-semibold text-text-primary">
            {plat.freq_postagem}
          </span>
        </div>
      </div>

      {/* posts recentes */}
      <PostsTable posts={plat.posts_recentes} plataformaLabel={label} cor={cor} />
    </div>
  );
}

// ─── competitor detail (expandable) ──────────────────────────────────────────

interface CompetitorDetailProps {
  concorrente: Concorrente;
}

function CompetitorDetail({ concorrente }: CompetitorDetailProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-bg-card backdrop-blur-xl border border-border rounded-xl overflow-hidden fade-in">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between p-3 text-left hover:bg-bg-card transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-accent/15 flex items-center justify-center shrink-0">
            <span className="text-accent font-semibold text-[11px]">
              {concorrente.nome.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <h3 className="font-medium text-text-primary text-sm leading-tight">
              {concorrente.nome}
            </h3>
            <p className="text-[11px] text-text-muted">
              {concorrente.plataformas.length}{" "}
              {concorrente.plataformas.length === 1 ? "plataforma" : "plataformas"}
            </p>
          </div>
        </div>
        <span className="text-text-muted">
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </span>
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          {concorrente.plataformas.map((plat) => (
            <PlatformSection key={plat.rede} plat={plat} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── comparison table ─────────────────────────────────────────────────────────

type TableSortField = "nome" | "rede" | "seguidores" | "engajamento" | "frequencia";

interface ComparisonTableProps {
  concorrentes: Concorrente[];
}

function ComparisonTable({ concorrentes }: ComparisonTableProps) {
  const [sortField, setSortField] = useState<TableSortField>("seguidores");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const rows = useMemo(() => {
    const flat = concorrentes.flatMap((c) =>
      c.plataformas.map((p) => ({
        nome: c.nome,
        rede: p.rede,
        seguidores: p.seguidores,
        engajamento: p.taxa_engajamento,
        frequencia: p.freq_postagem,
      }))
    );

    return [...flat].sort((a, b) => {
      let cmp = 0;
      if (sortField === "nome") cmp = a.nome.localeCompare(b.nome);
      else if (sortField === "rede") cmp = a.rede.localeCompare(b.rede);
      else if (sortField === "seguidores") cmp = a.seguidores - b.seguidores;
      else if (sortField === "engajamento") cmp = a.engajamento - b.engajamento;
      else cmp = a.frequencia.localeCompare(b.frequencia);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [concorrentes, sortField, sortDir]);

  function toggleSort(field: TableSortField) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  }

  function SortIcon({ field }: { field: TableSortField }) {
    if (sortField !== field) return <ChevronUp size={10} className="opacity-20" />;
    return sortDir === "asc" ? (
      <ChevronUp size={10} className="text-accent" />
    ) : (
      <ChevronDown size={10} className="text-accent" />
    );
  }

  if (rows.length === 0) return null;

  const cols: { field: TableSortField; label: string; align: string }[] = [
    { field: "nome", label: "Concorrente", align: "text-left" },
    { field: "rede", label: "Plataforma", align: "text-left" },
    { field: "seguidores", label: "Seguidores", align: "text-right" },
    { field: "engajamento", label: "Engajamento", align: "text-right" },
    { field: "frequencia", label: "Frequencia", align: "text-left" },
  ];

  return (
    <div className="bg-bg-card backdrop-blur-xl border border-border rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border">
              {cols.map((c) => (
                <th
                  key={c.field}
                  className={cn(
                    "px-3 py-2.5 font-medium text-text-muted cursor-pointer select-none hover:text-text-secondary transition-colors text-[11px]",
                    c.align
                  )}
                  onClick={() => toggleSort(c.field)}
                >
                  <span className="inline-flex items-center gap-0.5">
                    {c.label} <SortIcon field={c.field} />
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const cor = getPlataformaCor(row.rede);
              return (
                <tr
                  key={idx}
                  className="border-b border-border-subtle last:border-0 hover:bg-bg-card transition-colors"
                >
                  <td className="px-3 py-2 text-text-primary font-medium text-xs">{row.nome}</td>
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cor }} />
                      <span style={{ color: cor }}>{getPlataformaLabel(row.rede)}</span>
                    </span>
                  </td>
                  <td className="px-3 py-2 text-text-secondary tabular-nums text-right text-xs">
                    {formatNumber(row.seguidores)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <span
                      className="font-semibold tabular-nums text-xs"
                      style={{ color: cor }}
                    >
                      {row.engajamento.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-3 py-2 text-text-secondary text-xs">{row.frequencia}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── main page ────────────────────────────────────────────────────────────────

export default function ConcorrentesPage() {
  const { empresa } = useEmpresa();
  const [showModal, setShowModal] = useState(false);
  const [extra, setExtra] = useState<Concorrente[]>([]);
  const [search, setSearch] = useState("");

  const concorrentes = useMemo(() => {
    const base = empresa
      ? concorrentesMock.filter((c) => c.empresa_id === empresa.id)
      : [];
    return [...base, ...extra].filter((c) =>
      c.nome.toLowerCase().includes(search.toLowerCase())
    );
  }, [empresa, extra, search]);

  if (!empresa) {
    return (
      <div className="flex items-center justify-center h-64 text-text-secondary text-sm">
        Nenhuma empresa selecionada.
      </div>
    );
  }

  return (
    <div className="fade-in space-y-4 p-4 max-w-6xl mx-auto">

      {/* ── modal ─────────────────────────────────────────────────────── */}
      {showModal && (
        <AddConcorrenteModal
          onClose={() => setShowModal(false)}
          onAdd={(c) => setExtra((prev) => [...prev, c])}
          empresaId={empresa.id}
        />
      )}

      {/* ── header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-text-primary tracking-tight">
          Rastreador de Concorrentes
        </h1>
        <div className="flex items-center gap-2">
          {/* search */}
          <div className="relative">
            <Search
              size={13}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar..."
              className="w-40 pl-7 pr-2.5 py-1.5 rounded-lg bg-bg-card border border-border text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/30 transition-colors text-xs"
            />
          </div>
          {/* add button */}
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-text-secondary hover:text-text-primary hover:bg-bg-card-hover transition-colors text-xs"
          >
            <Plus size={13} />
            Adicionar
          </button>
        </div>
      </div>

      {/* ── comparison table ───────────────────────────────────────────── */}
      <ComparisonTable concorrentes={concorrentes} />

      {/* ── competitor details ──────────────────────────────────────────── */}
      {concorrentes.length === 0 ? (
        <div className="bg-bg-card backdrop-blur-xl border border-border rounded-xl text-center py-10 space-y-2">
          <Users size={28} className="text-text-muted mx-auto" />
          <p className="text-text-secondary text-sm">Nenhum concorrente encontrado.</p>
          <p className="text-text-muted text-xs">
            {search
              ? "Tente outro termo de busca."
              : 'Clique em "Adicionar" para comecar.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {concorrentes.map((c) => (
            <CompetitorDetail key={c.id} concorrente={c} />
          ))}
        </div>
      )}
    </div>
  );
}
