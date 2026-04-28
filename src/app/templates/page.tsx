"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Loader2,
  Layout,
  Trash2,
  Pencil,
  Copy,
  Search,
  Upload,
  Image as ImageIcon,
  Layers,
  X,
  Check,
} from "lucide-react";
import { useEmpresa } from "@/hooks/useEmpresa";
import { useVisualTemplates } from "@/hooks/useVisualTemplates";
import type { VisualTemplateSummary } from "@/types/canvas";

/* ═══════════════════════════════════════════════════════════════════════════
   Brand Asset type (mirrors API response)
   ═══════════════════════════════════════════════════════════════════════════ */

interface BrandAsset {
  id: string;
  empresa_id: string;
  name: string;
  type: "logo" | "font" | "element" | "texture" | "photo";
  file_url: string;
  file_name: string | null;
  file_size: number | null;
  mime_type: string | null;
  tags: string[];
  created_at: string;
}

const ASSET_TYPE_LABELS: Record<BrandAsset["type"], string> = {
  logo: "Logo",
  font: "Fonte",
  element: "Elemento",
  texture: "Textura",
  photo: "Foto",
};

const ASSET_TYPE_OPTIONS: BrandAsset["type"][] = [
  "logo",
  "photo",
  "texture",
  "element",
  "font",
];

/* ═══════════════════════════════════════════════════════════════════════════
   Source badge (same style as TemplateGallery)
   ═══════════════════════════════════════════════════════════════════════════ */

function SourceBadge({ source }: { source: string }) {
  const config: Record<string, { label: string; color: string }> = {
    manual: { label: "Manual", color: "#4ecdc4" },
    ai_chat: { label: "IA", color: "#6c5ce7" },
    image_extraction: { label: "Imagem", color: "#f59e0b" },
    psd: { label: "PSD", color: "#ec4899" },
    import: { label: "Importado", color: "#3b82f6" },
    preset: { label: "Preset", color: "#10b981" },
  };
  const c = config[source] || config.manual;

  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium"
      style={{ backgroundColor: `${c.color}15`, color: c.color }}
    >
      {c.label}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Delete confirmation modal
   ═══════════════════════════════════════════════════════════════════════════ */

function ConfirmDeleteModal({
  name,
  onConfirm,
  onCancel,
}: {
  name: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
      />
      <div className="relative bg-bg-secondary dark:border-white/[0.08] border-border rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
        <h3 className="text-base font-semibold text-text-primary mb-2">
          Excluir template?
        </h3>
        <p className="text-sm text-text-muted mb-5">
          O template <strong className="text-text-primary">{name}</strong> sera
          excluido permanentemente.
        </p>
        <div className="flex items-center gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-sm font-medium text-text-muted dark:hover:bg-white/5 hover:bg-bg-card-hover/60 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-colors"
          >
            Excluir
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Page
   ═══════════════════════════════════════════════════════════════════════════ */

export default function TemplatesPage() {
  const router = useRouter();
  const { empresa } = useEmpresa();
  const empresaId = empresa?.id;

  const {
    templates,
    isLoading: templatesLoading,
    error: templatesError,
    deleteTemplate,
    duplicateTemplate,
  } = useVisualTemplates(empresaId);

  // ── Brand assets state ──
  const [assets, setAssets] = useState<BrandAsset[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(true);
  const [assetsError, setAssetsError] = useState<string | null>(null);

  // ── Search ──
  const [search, setSearch] = useState("");

  // ── Delete confirmation ──
  const [deleteTarget, setDeleteTarget] = useState<VisualTemplateSummary | null>(null);

  // ── Upload state ──
  const [uploading, setUploading] = useState(false);
  const [uploadType, setUploadType] = useState<BrandAsset["type"]>("photo");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Fetch brand assets ──
  const fetchAssets = useCallback(async () => {
    if (!empresaId) {
      setAssets([]);
      setAssetsLoading(false);
      return;
    }
    setAssetsLoading(true);
    setAssetsError(null);
    try {
      const res = await fetch(
        `/api/brand-assets?empresa_id=${encodeURIComponent(empresaId)}`
      );
      if (!res.ok) throw new Error("Erro ao carregar assets");
      const data: BrandAsset[] = await res.json();
      setAssets(data);
    } catch (err) {
      setAssetsError((err as Error).message);
    } finally {
      setAssetsLoading(false);
    }
  }, [empresaId]);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  // ── Filtered templates ──
  const filteredTemplates = search
    ? templates.filter((t) =>
        t.name.toLowerCase().includes(search.toLowerCase())
      )
    : templates;

  // ── Filtered assets ──
  const filteredAssets = search
    ? assets.filter(
        (a) =>
          a.name.toLowerCase().includes(search.toLowerCase()) ||
          a.type.toLowerCase().includes(search.toLowerCase())
      )
    : assets;

  // ── Handlers ──
  function handleNewTemplate() {
    router.push("/studio/editor");
  }

  function handleEditTemplate(id: string) {
    router.push(`/studio/editor?template=${id}`);
  }

  async function handleDeleteTemplate() {
    if (!deleteTarget) return;
    try {
      await deleteTemplate(deleteTarget.id);
    } catch {
      // error handled by hook
    }
    setDeleteTarget(null);
  }

  async function handleDuplicate(id: string) {
    try {
      await duplicateTemplate(id);
    } catch {
      // error handled by hook
    }
  }

  async function handleUploadFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !empresaId) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("empresa_id", empresaId);
      formData.append("type", uploadType);
      formData.append("name", file.name.replace(/\.[^/.]+$/, ""));

      const res = await fetch("/api/brand-assets", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Erro no upload" }));
        throw new Error(body.error || "Erro no upload");
      }

      // Refresh assets list
      await fetchAssets();
    } catch (err) {
      setAssetsError((err as Error).message);
    } finally {
      setUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  // ── No empresa selected ──
  if (!empresaId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Layout size={40} className="mx-auto text-text-muted opacity-40 mb-3" />
          <p className="text-text-muted">
            Selecione uma empresa para ver os templates.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 md:p-8 lg:p-10">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-text-primary mb-1">
            Templates & Assets
          </h1>
          <p className="text-sm text-text-muted">
            Gerencie seus templates visuais e assets da marca
          </p>
        </div>

        <button
          onClick={handleNewTemplate}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-[#6c5ce7] to-[#4ecdc4] text-white hover:opacity-90 transition-opacity shadow-lg shadow-[#6c5ce7]/20"
        >
          <Plus size={18} />
          Novo Template
        </button>
      </div>

      {/* ── Search bar ── */}
      <div className="relative mb-8 max-w-md">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
        />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar templates e assets..."
          className="w-full pl-9 pr-4 py-2.5 bg-bg-card dark:border-white/[0.06] border-border rounded-xl text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-[#4ecdc4]/40 transition-colors"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
         Section: Templates Salvos
         ══════════════════════════════════════════════════════════════════════ */}
      <section className="mb-12">
        <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-4 flex items-center gap-2">
          <Layers size={14} />
          Templates Salvos
          {!templatesLoading && (
            <span className="text-text-muted/60">({filteredTemplates.length})</span>
          )}
        </h2>

        {/* Loading */}
        {templatesLoading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-5 h-5 text-[#4ecdc4] animate-spin" />
            <span className="ml-3 text-sm text-text-muted">
              Carregando templates...
            </span>
          </div>
        )}

        {/* Error */}
        {templatesError && !templatesLoading && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 mb-4">
            <p className="text-sm text-red-400">{templatesError}</p>
          </div>
        )}

        {/* Grid */}
        {!templatesLoading && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {/* "+ Novo" card */}
            <button
              onClick={handleNewTemplate}
              className="group flex flex-col items-center justify-center aspect-square rounded-xl border-2 border-dashed border-white/[0.1] hover:border-[#4ecdc4]/40 bg-bg-card/50 hover:bg-bg-card transition-all duration-200"
            >
              <div className="w-12 h-12 rounded-xl bg-[#4ecdc4]/10 group-hover:bg-[#4ecdc4]/20 flex items-center justify-center mb-2 transition-colors">
                <Plus size={24} className="text-[#4ecdc4]" />
              </div>
              <span className="text-xs font-medium text-text-muted group-hover:text-[#4ecdc4] transition-colors">
                Novo Template
              </span>
            </button>

            {/* Template cards */}
            {filteredTemplates.map((tpl) => (
              <div
                key={tpl.id}
                className="group relative bg-bg-card rounded-xl overflow-hidden dark:border-white/[0.04] border-border/40 hover:border-[#4ecdc4]/30 transition-all duration-200"
              >
                {/* Thumbnail */}
                <button
                  onClick={() => handleEditTemplate(tpl.id)}
                  className="w-full"
                >
                  <div className="aspect-square bg-bg-primary flex items-center justify-center overflow-hidden">
                    {tpl.thumbnail_url ? (
                      <img
                        src={tpl.thumbnail_url}
                        alt={tpl.name}
                        className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                      />
                    ) : (
                      <Layout
                        size={28}
                        className="text-text-muted opacity-30"
                      />
                    )}
                  </div>
                </button>

                {/* Info */}
                <div className="p-3 space-y-1.5">
                  <p className="text-[12px] font-semibold text-text-primary truncate">
                    {tpl.name}
                  </p>
                  <div className="flex items-center gap-1.5">
                    <SourceBadge source={tpl.source} />
                    <span className="text-[10px] text-text-muted">
                      {tpl.aspect_ratio}
                    </span>
                  </div>
                </div>

                {/* Hover actions */}
                <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditTemplate(tpl.id);
                    }}
                    className="w-7 h-7 rounded-md bg-black/60 backdrop-blur-sm flex items-center justify-center hover:bg-black/80 transition-colors"
                    title="Editar"
                  >
                    <Pencil size={13} className="text-text-primary" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDuplicate(tpl.id);
                    }}
                    className="w-7 h-7 rounded-md bg-black/60 backdrop-blur-sm flex items-center justify-center hover:bg-black/80 transition-colors"
                    title="Duplicar"
                  >
                    <Copy size={13} className="text-text-primary" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTarget(tpl);
                    }}
                    className="w-7 h-7 rounded-md bg-black/60 backdrop-blur-sm flex items-center justify-center hover:bg-red-900/60 transition-colors"
                    title="Excluir"
                  >
                    <Trash2 size={13} className="text-red-400" />
                  </button>
                </div>
              </div>
            ))}

            {/* Empty state (no templates at all) */}
            {filteredTemplates.length === 0 && !search && (
              <div className="col-span-full dark:border-white/[0.06] border-dashed border-border rounded-xl p-10 text-center">
                <Layout
                  size={32}
                  className="mx-auto text-text-muted opacity-30 mb-3"
                />
                <p className="text-sm text-text-muted">
                  Nenhum template salvo ainda
                </p>
                <p className="text-xs text-text-muted/60 mt-1">
                  Crie um design no editor e salve como template
                </p>
              </div>
            )}

            {/* No search results */}
            {filteredTemplates.length === 0 && search && (
              <div className="col-span-full py-8 text-center">
                <p className="text-sm text-text-muted">
                  Nenhum template encontrado para &quot;{search}&quot;
                </p>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
         Section: Brand Assets
         ══════════════════════════════════════════════════════════════════════ */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider flex items-center gap-2">
            <ImageIcon size={14} />
            Brand Assets (Logos, Fotos, Texturas)
            {!assetsLoading && (
              <span className="text-text-muted/60">({filteredAssets.length})</span>
            )}
          </h2>

          {/* Upload controls */}
          <div className="flex items-center gap-2">
            <select
              value={uploadType}
              onChange={(e) =>
                setUploadType(e.target.value as BrandAsset["type"])
              }
              className="px-2 py-1.5 rounded-lg text-xs bg-bg-card dark:border-white/[0.06] border-border text-text-primary focus:outline-none focus:border-[#4ecdc4]/40"
            >
              {ASSET_TYPE_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {ASSET_TYPE_LABELS[t]}
                </option>
              ))}
            </select>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleUploadFile}
              className="hidden"
            />

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#4ecdc4]/10 text-[#4ecdc4] hover:bg-[#4ecdc4]/20 transition-colors disabled:opacity-50"
            >
              {uploading ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Upload size={13} />
              )}
              Upload
            </button>
          </div>
        </div>

        {/* Assets loading */}
        {assetsLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 text-[#4ecdc4] animate-spin" />
            <span className="ml-3 text-sm text-text-muted">
              Carregando assets...
            </span>
          </div>
        )}

        {/* Assets error */}
        {assetsError && !assetsLoading && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 mb-4">
            <p className="text-sm text-red-400">{assetsError}</p>
          </div>
        )}

        {/* Assets grid */}
        {!assetsLoading && (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
            {filteredAssets.map((asset) => (
              <div
                key={asset.id}
                className="group relative bg-bg-card rounded-xl overflow-hidden dark:border-white/[0.04] border-border/40 hover:border-white/[0.1] transition-all duration-200"
              >
                {/* Image */}
                <div className="aspect-square bg-bg-primary flex items-center justify-center overflow-hidden">
                  {asset.mime_type?.startsWith("image/") ? (
                    <img
                      src={asset.file_url}
                      alt={asset.name}
                      className="w-full h-full object-contain p-1"
                    />
                  ) : (
                    <ImageIcon
                      size={24}
                      className="text-text-muted opacity-30"
                    />
                  )}
                </div>

                {/* Info */}
                <div className="p-2">
                  <p className="text-[10px] font-medium text-text-primary truncate">
                    {asset.name}
                  </p>
                  <span
                    className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium mt-1"
                    style={{
                      backgroundColor: "rgba(78,205,196,0.1)",
                      color: "#4ecdc4",
                    }}
                  >
                    {ASSET_TYPE_LABELS[asset.type]}
                  </span>
                </div>
              </div>
            ))}

            {/* Empty state */}
            {filteredAssets.length === 0 && !search && (
              <div className="col-span-full dark:border-white/[0.06] border-dashed border-border rounded-xl p-8 text-center">
                <ImageIcon
                  size={28}
                  className="mx-auto text-text-muted opacity-30 mb-2"
                />
                <p className="text-sm text-text-muted">
                  Nenhum asset da marca
                </p>
                <p className="text-xs text-text-muted/60 mt-1">
                  Faca upload de logos, fotos e texturas
                </p>
              </div>
            )}

            {/* No search results */}
            {filteredAssets.length === 0 && search && (
              <div className="col-span-full py-6 text-center">
                <p className="text-sm text-text-muted">
                  Nenhum asset encontrado para &quot;{search}&quot;
                </p>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── Delete confirmation modal ── */}
      {deleteTarget && (
        <ConfirmDeleteModal
          name={deleteTarget.name}
          onConfirm={handleDeleteTemplate}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
