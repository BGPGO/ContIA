"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Image,
  Type,
  Shapes,
  Sparkles,
  Camera,
  Upload,
  Trash2,
  Plus,
  X,
  Loader2,
  Palette,
  Check,
  ArrowLeft,
  Download,
  Search,
} from "lucide-react";
import Link from "next/link";
import { useEmpresa } from "@/hooks/useEmpresa";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";

/* ═══════════════════════════════════════════════════════════════════════════
   Types
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

type AssetFilter = "all" | "logo" | "font" | "element" | "texture" | "photo";

const FILTER_TABS: { id: AssetFilter; label: string; icon: typeof Image }[] = [
  { id: "all", label: "Todos", icon: Sparkles },
  { id: "logo", label: "Logos", icon: Image },
  { id: "font", label: "Fontes", icon: Type },
  { id: "element", label: "Elementos", icon: Shapes },
  { id: "texture", label: "Texturas", icon: Palette },
  { id: "photo", label: "Fotos", icon: Camera },
];

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Page Component
   ═══════════════════════════════════════════════════════════════════════════ */

export default function BrandAssetsPage() {
  const { empresa, updateEmpresa } = useEmpresa();
  const empresaId = empresa?.id || "";

  const [assets, setAssets] = useState<BrandAsset[]>([]);
  const [filter, setFilter] = useState<AssetFilter>("all");
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadType, setUploadType] = useState<BrandAsset["type"]>("logo");
  const [newColor, setNewColor] = useState("");
  const [showColorInput, setShowColorInput] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const brandColors: string[] = (empresa as any)?.brand_colors || [
    empresa?.cor_primaria,
    empresa?.cor_secundaria,
  ].filter(Boolean);

  // ── Fetch assets ──
  const fetchAssets = useCallback(async () => {
    if (!empresaId || !isSupabaseConfigured()) return;
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ empresa_id: empresaId });
      if (filter !== "all") params.set("type", filter);
      const res = await fetch(`/api/brand-assets?${params}`);
      if (res.ok) {
        setAssets(await res.json());
      }
    } catch (err) {
      console.warn("[BrandAssets] Fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [empresaId, filter]);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  // ── Upload ──
  const handleUpload = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0 || !empresaId) return;
      setIsUploading(true);
      setUploadError(null);
      try {
        const errors: string[] = [];
        for (const file of Array.from(files)) {
          const formData = new FormData();
          formData.append("file", file);
          formData.append("empresa_id", empresaId);
          formData.append("name", file.name.replace(/\.[^.]+$/, ""));
          formData.append("type", uploadType);
          const res = await fetch("/api/brand-assets", { method: "POST", body: formData });
          if (!res.ok) {
            const err = await res.json();
            errors.push(err.error || `Falha ao enviar ${file.name}`);
            console.warn("[BrandAssets] Upload failed:", err.error);
          }
        }
        if (errors.length > 0) {
          setUploadError(errors.join("; "));
        }
        fetchAssets();
      } catch (err) {
        console.warn("[BrandAssets] Upload error:", err);
        setUploadError((err as Error).message || "Erro no upload");
      } finally {
        setIsUploading(false);
      }
    },
    [empresaId, uploadType, fetchAssets]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      if (!confirm("Remover este material?")) return;
      try {
        const res = await fetch(`/api/brand-assets/${id}`, { method: "DELETE" });
        if (res.ok) setAssets((prev) => prev.filter((a) => a.id !== id));
      } catch (err) {
        console.warn("[BrandAssets] Delete error:", err);
      }
    },
    []
  );

  // ── Colors ──
  const handleAddColor = useCallback(async () => {
    if (!newColor || !empresa) return;
    const color = newColor.startsWith("#") ? newColor : `#${newColor}`;
    if (!/^#[0-9a-fA-F]{6}$/.test(color)) return;
    const updated = [...brandColors, color];
    try {
      if (isSupabaseConfigured()) {
        const supabase = createClient();
        await supabase.from("empresas").update({ brand_colors: updated }).eq("id", empresa.id);
      }
      if (updateEmpresa) await updateEmpresa(empresa.id, { brand_colors: updated } as any);
    } catch (err) {
      console.warn("[BrandAssets] Add color error:", err);
    }
    setNewColor("");
    setShowColorInput(false);
  }, [newColor, empresa, brandColors, updateEmpresa]);

  const handleRemoveColor = useCallback(
    async (index: number) => {
      if (!empresa) return;
      const updated = brandColors.filter((_, i) => i !== index);
      try {
        if (isSupabaseConfigured()) {
          const supabase = createClient();
          await supabase.from("empresas").update({ brand_colors: updated }).eq("id", empresa.id);
        }
        if (updateEmpresa) await updateEmpresa(empresa.id, { brand_colors: updated } as any);
      } catch (err) {
        console.warn("[BrandAssets] Remove color error:", err);
      }
    },
    [empresa, brandColors, updateEmpresa]
  );

  // ── Filtering ──
  const filteredAssets = search
    ? assets.filter((a) => a.name.toLowerCase().includes(search.toLowerCase()))
    : assets;

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary">
      {/* Header */}
      <div className="border-b border-border-subtle bg-bg-secondary/80 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/marca"
              className="p-2 rounded-lg hover:bg-bg-card-hover text-text-muted hover:text-text-primary transition-all"
            >
              <ArrowLeft size={18} />
            </Link>
            <div>
              <h1 className="text-lg font-semibold text-text-primary">
                Materiais da Marca
              </h1>
              <p className="text-xs text-text-muted">
                Logos, fontes, elementos e paleta de cores
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar material..."
                className="pl-9 pr-3 py-2 bg-bg-primary border border-border rounded-lg text-xs
                  text-text-primary placeholder:text-text-muted focus:outline-none focus:border-[#4ecdc4]/40
                  w-48 transition-all"
              />
            </div>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white
                transition-all cursor-pointer hover:opacity-90"
              style={{
                background: "linear-gradient(135deg, #6c5ce7 0%, #4ecdc4 100%)",
              }}
            >
              <Upload size={14} />
              Upload
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6">
        {/* Upload type + Filter tabs */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex gap-2">
            {FILTER_TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = filter === tab.id;
              const count = tab.id === "all"
                ? assets.length
                : assets.filter((a) => a.type === tab.id).length;
              return (
                <button
                  key={tab.id}
                  onClick={() => setFilter(tab.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer
                    ${isActive
                      ? "bg-[#4ecdc4]/15 text-[#4ecdc4] border border-[#4ecdc4]/30"
                      : "text-text-muted hover:text-text-secondary hover:bg-bg-card-hover border border-transparent"
                    }`}
                >
                  <Icon size={14} />
                  {tab.label}
                  <span className="text-[10px] opacity-60">({count})</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] text-text-muted">Tipo do upload:</span>
            {(["logo", "element", "photo", "texture", "font"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setUploadType(t)}
                className={`px-2 py-1 rounded text-[10px] font-medium transition-all cursor-pointer
                  ${uploadType === t
                    ? "bg-[#6c5ce7]/20 text-[#a78bfa] border border-[#6c5ce7]/30"
                    : "text-text-muted hover:text-text-secondary border border-transparent hover:bg-bg-card-hover"
                  }`}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Drop zone */}
        <div
          className={`border-2 border-dashed rounded-xl p-8 mb-6 text-center transition-all cursor-pointer
            ${isDragging
              ? "border-[#4ecdc4]/60 bg-[#4ecdc4]/10"
              : "border-border hover:border-[#4ecdc4]/30 hover:bg-[#4ecdc4]/5"
            }`}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            handleUpload(e.dataTransfer.files);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onClick={() => fileInputRef.current?.click()}
        >
          {isUploading ? (
            <Loader2 size={32} className="animate-spin text-[#4ecdc4] mx-auto" />
          ) : (
            <>
              <Upload size={32} className="text-text-muted mx-auto mb-3" />
              <p className="text-sm text-text-secondary mb-1">
                Arraste arquivos aqui ou clique para selecionar
              </p>
              <p className="text-xs text-text-muted">
                Imagens, SVGs, fontes (TTF/OTF/WOFF) - max 20MB
              </p>
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,.svg,.ttf,.otf,.woff,.woff2"
            className="hidden"
            onChange={(e) => handleUpload(e.target.files)}
          />
        </div>

        {/* Upload error message */}
        {uploadError && (
          <div className="mb-6 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center gap-3">
            <span className="text-sm text-red-400 flex-1">{uploadError}</span>
            <button
              onClick={() => setUploadError(null)}
              className="text-red-400 hover:text-red-300 cursor-pointer p-1"
            >
              <X size={16} />
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Assets grid */}
          <div className="lg:col-span-3">
            {isLoading ? (
              <div className="flex justify-center py-16">
                <Loader2 size={32} className="animate-spin text-[#4ecdc4]/40" />
              </div>
            ) : filteredAssets.length === 0 ? (
              <div className="text-center py-16 bg-bg-secondary rounded-xl border border-border-subtle">
                <Image size={48} className="text-text-muted/30 mx-auto mb-4" />
                <h3 className="text-sm font-medium text-text-secondary mb-1">
                  Nenhum material encontrado
                </h3>
                <p className="text-xs text-text-muted">
                  Faca upload de logos, icones e elementos da sua marca
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {filteredAssets.map((asset) => (
                  <div
                    key={asset.id}
                    className="group relative bg-bg-secondary rounded-xl border border-border-subtle
                      hover:border-[#4ecdc4]/30 transition-all overflow-hidden"
                  >
                    {/* Thumbnail */}
                    <div className="aspect-square bg-bg-primary flex items-center justify-center overflow-hidden">
                      {asset.type === "font" ? (
                        <div className="flex flex-col items-center gap-2">
                          <Type size={32} className="text-text-muted/40" />
                          <span className="text-xs text-text-muted">.{asset.file_name?.split(".").pop()}</span>
                        </div>
                      ) : (
                        <img
                          src={asset.file_url}
                          alt={asset.name}
                          className="w-full h-full object-contain p-3"
                          loading="lazy"
                        />
                      )}
                    </div>

                    {/* Info */}
                    <div className="p-3 border-t border-border-subtle">
                      <p className="text-xs text-text-primary font-medium truncate">{asset.name}</p>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[10px] text-text-muted capitalize">{asset.type}</span>
                        <span className="text-[10px] text-text-muted">
                          {formatFileSize(asset.file_size)}
                        </span>
                      </div>
                    </div>

                    {/* Hover actions */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100
                      transition-opacity flex items-center justify-center gap-3">
                      <a
                        href={asset.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-all"
                        title="Abrir"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Download size={16} />
                      </a>
                      <button
                        onClick={() => handleDelete(asset.id)}
                        className="p-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30
                          transition-all cursor-pointer"
                        title="Remover"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Color palette sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-bg-secondary rounded-xl border border-border-subtle p-4 sticky top-24">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-text-primary flex items-center gap-2">
                  <Palette size={14} className="text-[#4ecdc4]" />
                  Paleta de Cores
                </h3>
                <button
                  onClick={() => setShowColorInput(!showColorInput)}
                  className="p-1 rounded-md hover:bg-bg-card-hover text-text-muted hover:text-[#4ecdc4]
                    transition-all cursor-pointer"
                >
                  <Plus size={14} />
                </button>
              </div>

              {/* Colors grid */}
              <div className="grid grid-cols-4 gap-2 mb-3">
                {brandColors.map((color, i) => (
                  <div key={`${color}-${i}`} className="group relative">
                    <button
                      className="w-full aspect-square rounded-lg border border-border
                        hover:border-[#4ecdc4]/40 transition-all cursor-pointer
                        hover:scale-105 shadow-sm"
                      style={{ backgroundColor: color }}
                      title={color}
                      onClick={() => navigator.clipboard?.writeText(color)}
                    />
                    <span className="absolute -bottom-4 left-0 right-0 text-[8px] text-text-muted
                      text-center opacity-0 group-hover:opacity-100 transition-opacity">
                      {color}
                    </span>
                    <button
                      onClick={() => handleRemoveColor(i)}
                      className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white
                        flex items-center justify-center opacity-0 group-hover:opacity-100
                        transition-opacity cursor-pointer text-[8px]"
                    >
                      <X size={8} />
                    </button>
                  </div>
                ))}
              </div>

              {brandColors.length === 0 && !showColorInput && (
                <p className="text-xs text-text-muted text-center py-4">
                  Adicione as cores da sua marca
                </p>
              )}

              {/* Add color */}
              {showColorInput && (
                <div className="flex items-center gap-2 mt-4 pt-3 border-t border-border-subtle">
                  <input
                    type="color"
                    value={newColor || "#4ecdc4"}
                    onChange={(e) => setNewColor(e.target.value)}
                    className="w-8 h-8 rounded cursor-pointer bg-transparent border border-border"
                  />
                  <input
                    type="text"
                    value={newColor}
                    onChange={(e) => setNewColor(e.target.value)}
                    placeholder="#000000"
                    className="flex-1 bg-bg-primary border border-border rounded-lg px-3 py-2 text-xs
                      text-text-primary placeholder:text-text-muted focus:outline-none focus:border-[#4ecdc4]/40"
                    onKeyDown={(e) => e.key === "Enter" && handleAddColor()}
                  />
                  <button
                    onClick={handleAddColor}
                    className="p-2 rounded-lg bg-[#4ecdc4]/20 text-[#4ecdc4] hover:bg-[#4ecdc4]/30
                      transition-all cursor-pointer"
                  >
                    <Check size={14} />
                  </button>
                </div>
              )}

              {/* Primary/Secondary from empresa */}
              {empresa && (
                <div className="mt-4 pt-3 border-t border-border-subtle">
                  <p className="text-[10px] text-text-muted uppercase tracking-wider mb-2">
                    Cores da empresa
                  </p>
                  <div className="flex gap-2">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-5 h-5 rounded border border-border"
                        style={{ backgroundColor: empresa.cor_primaria }}
                      />
                      <span className="text-[10px] text-text-secondary">
                        {empresa.cor_primaria}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-5 h-5 rounded border border-border"
                        style={{ backgroundColor: empresa.cor_secundaria }}
                      />
                      <span className="text-[10px] text-text-secondary">
                        {empresa.cor_secundaria}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
