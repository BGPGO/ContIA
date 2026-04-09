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
} from "lucide-react";
import type { FabricCanvasRef } from "./FabricCanvas";
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

interface BrandAssetsPanelProps {
  canvasRef: React.RefObject<FabricCanvasRef | null>;
  empresaId?: string;
  /** Compact mode for sidebar use inside editor */
  compact?: boolean;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Filter tabs config
   ═══════════════════════════════════════════════════════════════════════════ */

const FILTER_TABS: { id: AssetFilter; label: string; icon: typeof Image }[] = [
  { id: "all", label: "Todos", icon: Sparkles },
  { id: "logo", label: "Logos", icon: Image },
  { id: "font", label: "Fontes", icon: Type },
  { id: "element", label: "Elementos", icon: Shapes },
  { id: "photo", label: "Fotos", icon: Camera },
];

/* ═══════════════════════════════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════════════════════════════ */

export function BrandAssetsPanel({ canvasRef, empresaId, compact = false }: BrandAssetsPanelProps) {
  const { empresa, updateEmpresa } = useEmpresa();
  const resolvedEmpresaId = empresaId || empresa?.id || "";

  const [assets, setAssets] = useState<BrandAsset[]>([]);
  const [filter, setFilter] = useState<AssetFilter>("all");
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadType, setUploadType] = useState<BrandAsset["type"]>("logo");
  const [newColor, setNewColor] = useState("");
  const [showColorInput, setShowColorInput] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Brand colors from empresa
  const brandColors: string[] = (empresa as any)?.brand_colors || [
    empresa?.cor_primaria,
    empresa?.cor_secundaria,
  ].filter(Boolean);

  // ── Fetch assets ──
  const fetchAssets = useCallback(async () => {
    if (!resolvedEmpresaId || !isSupabaseConfigured()) return;
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ empresa_id: resolvedEmpresaId });
      if (filter !== "all") params.set("type", filter);
      const res = await fetch(`/api/brand-assets?${params}`);
      if (res.ok) {
        const data = await res.json();
        setAssets(data);
      }
    } catch (err) {
      console.warn("[BrandAssets] Fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [resolvedEmpresaId, filter]);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  // ── Upload handler ──
  const handleUpload = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0 || !resolvedEmpresaId) return;
      setIsUploading(true);

      try {
        for (const file of Array.from(files)) {
          const formData = new FormData();
          formData.append("file", file);
          formData.append("empresa_id", resolvedEmpresaId);
          formData.append("name", file.name.replace(/\.[^.]+$/, ""));
          formData.append("type", uploadType);

          const res = await fetch("/api/brand-assets", { method: "POST", body: formData });
          if (!res.ok) {
            const err = await res.json();
            console.warn("[BrandAssets] Upload failed:", err.error);
          }
        }
        fetchAssets();
      } catch (err) {
        console.warn("[BrandAssets] Upload error:", err);
      } finally {
        setIsUploading(false);
      }
    },
    [resolvedEmpresaId, uploadType, fetchAssets]
  );

  // ── Delete handler ──
  const handleDelete = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/brand-assets/${id}`, { method: "DELETE" });
        if (res.ok) {
          setAssets((prev) => prev.filter((a) => a.id !== id));
        }
      } catch (err) {
        console.warn("[BrandAssets] Delete error:", err);
      }
    },
    []
  );

  // ── Add asset to canvas ──
  const handleAddToCanvas = useCallback(
    async (asset: BrandAsset) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      if (asset.type === "font") return; // Fonts handled differently
      await canvas.addImage(asset.file_url);
    },
    [canvasRef]
  );

  // ── Add/remove brand colors ──
  const handleAddColor = useCallback(async () => {
    if (!newColor || !empresa) return;
    const hexPattern = /^#[0-9a-fA-F]{6}$/;
    const color = newColor.startsWith("#") ? newColor : `#${newColor}`;
    if (!hexPattern.test(color)) return;

    const updated = [...brandColors, color];
    try {
      if (isSupabaseConfigured()) {
        const supabase = createClient();
        await supabase
          .from("empresas")
          .update({ brand_colors: updated })
          .eq("id", empresa.id);
      }
      // Force re-render through empresa context
      if (updateEmpresa) {
        await updateEmpresa(empresa.id, { brand_colors: updated } as any);
      }
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
          await supabase
            .from("empresas")
            .update({ brand_colors: updated })
            .eq("id", empresa.id);
        }
        if (updateEmpresa) {
          await updateEmpresa(empresa.id, { brand_colors: updated } as any);
        }
      } catch (err) {
        console.warn("[BrandAssets] Remove color error:", err);
      }
    },
    [empresa, brandColors, updateEmpresa]
  );

  // ── Drop handler ──
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      handleUpload(e.dataTransfer.files);
    },
    [handleUpload]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  // ── Render ──
  const filteredAssets = assets;

  return (
    <div className={`flex flex-col ${compact ? "h-full" : ""}`}>
      {/* Header */}
      <div className="px-3 pt-3 pb-2">
        <h3 className="text-xs uppercase text-[#5e6388] font-medium tracking-wider flex items-center gap-2">
          <Palette size={12} className="text-[#4ecdc4]/60" />
          Materiais da Marca
        </h3>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 px-3 pb-2 overflow-x-auto scrollbar-none">
        {FILTER_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = filter === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium whitespace-nowrap transition-all cursor-pointer
                ${isActive
                  ? "bg-[#4ecdc4]/15 text-[#4ecdc4] border border-[#4ecdc4]/30"
                  : "text-[#5e6388] hover:text-[#8b8fb0] hover:bg-white/5 border border-transparent"
                }`}
            >
              <Icon size={10} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Upload area */}
      <div
        className="mx-3 mb-2 border border-dashed border-white/10 rounded-lg p-3 text-center
          hover:border-[#4ecdc4]/30 hover:bg-[#4ecdc4]/5 transition-all cursor-pointer"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onClick={() => fileInputRef.current?.click()}
      >
        {isUploading ? (
          <Loader2 size={16} className="animate-spin text-[#4ecdc4] mx-auto" />
        ) : (
          <>
            <Upload size={14} className="text-[#5e6388] mx-auto mb-1" />
            <p className="text-[10px] text-[#5e6388]">
              Arraste ou clique para upload
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

      {/* Upload type selector */}
      <div className="flex gap-1 px-3 pb-2">
        <span className="text-[9px] text-[#5e6388] self-center mr-1">Tipo:</span>
        {(["logo", "element", "photo", "texture", "font"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setUploadType(t)}
            className={`px-1.5 py-0.5 rounded text-[9px] font-medium transition-all cursor-pointer
              ${uploadType === t
                ? "bg-[#6c5ce7]/20 text-[#a78bfa] border border-[#6c5ce7]/30"
                : "text-[#5e6388] hover:text-[#8b8fb0] border border-transparent"
              }`}
          >
            {t === "logo" ? "Logo" : t === "element" ? "Elem" : t === "photo" ? "Foto" : t === "texture" ? "Text" : "Font"}
          </button>
        ))}
      </div>

      {/* Assets grid */}
      <div className="flex-1 overflow-y-auto px-3 pb-2">
        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 size={20} className="animate-spin text-[#4ecdc4]/40" />
          </div>
        ) : filteredAssets.length === 0 ? (
          <div className="text-center py-6">
            <Image size={24} className="text-[#5e6388]/30 mx-auto mb-2" />
            <p className="text-[11px] text-[#5e6388]">
              Nenhum material ainda
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {filteredAssets.map((asset) => (
              <div
                key={asset.id}
                className="group relative bg-[#080b1e] rounded-lg border border-white/5
                  hover:border-[#4ecdc4]/30 transition-all overflow-hidden cursor-pointer"
                onClick={() => handleAddToCanvas(asset)}
                title={`Clique para adicionar "${asset.name}" ao canvas`}
              >
                {/* Thumbnail */}
                <div className="aspect-square bg-[#0c0f24] flex items-center justify-center overflow-hidden">
                  {asset.type === "font" ? (
                    <Type size={24} className="text-[#5e6388]/40" />
                  ) : (
                    <img
                      src={asset.file_url}
                      alt={asset.name}
                      className="w-full h-full object-contain p-1"
                      loading="lazy"
                    />
                  )}
                </div>

                {/* Name */}
                <div className="px-1.5 py-1">
                  <p className="text-[9px] text-[#8b8fb0] truncate">{asset.name}</p>
                  <p className="text-[8px] text-[#5e6388]">{asset.type}</p>
                </div>

                {/* Delete button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(asset.id);
                  }}
                  className="absolute top-1 right-1 p-1 rounded bg-red-500/80 text-white opacity-0
                    group-hover:opacity-100 transition-opacity cursor-pointer hover:bg-red-600"
                >
                  <Trash2 size={10} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Color Palette Section */}
      <div className="border-t border-white/5 px-3 py-2">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] uppercase text-[#5e6388] font-medium tracking-wider">
            Paleta de Cores
          </span>
          <button
            onClick={() => setShowColorInput(!showColorInput)}
            className="p-0.5 rounded hover:bg-white/5 text-[#5e6388] hover:text-[#4ecdc4] transition-all cursor-pointer"
          >
            <Plus size={12} />
          </button>
        </div>

        {/* Color swatches */}
        <div className="flex flex-wrap gap-1.5">
          {brandColors.map((color, i) => (
            <div key={`${color}-${i}`} className="group relative">
              <button
                className="w-7 h-7 rounded-md border border-white/10 hover:border-[#4ecdc4]/40
                  transition-all cursor-pointer shadow-sm hover:scale-110"
                style={{ backgroundColor: color }}
                title={color}
                onClick={() => {
                  // Copy color to clipboard
                  navigator.clipboard?.writeText(color);
                }}
              />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveColor(i);
                }}
                className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-red-500 text-white
                  flex items-center justify-center opacity-0 group-hover:opacity-100
                  transition-opacity cursor-pointer"
              >
                <X size={7} />
              </button>
            </div>
          ))}

          {brandColors.length === 0 && !showColorInput && (
            <p className="text-[9px] text-[#5e6388]">Sem cores cadastradas</p>
          )}
        </div>

        {/* Add color input */}
        {showColorInput && (
          <div className="flex items-center gap-1.5 mt-2">
            <input
              type="color"
              value={newColor || "#4ecdc4"}
              onChange={(e) => setNewColor(e.target.value)}
              className="w-7 h-7 rounded cursor-pointer bg-transparent border border-white/10"
            />
            <input
              type="text"
              value={newColor}
              onChange={(e) => setNewColor(e.target.value)}
              placeholder="#000000"
              className="flex-1 bg-[#080b1e] border border-white/10 rounded px-2 py-1 text-[10px]
                text-[#e8eaff] placeholder:text-[#5e6388] focus:outline-none focus:border-[#4ecdc4]/40"
              onKeyDown={(e) => e.key === "Enter" && handleAddColor()}
            />
            <button
              onClick={handleAddColor}
              className="p-1 rounded bg-[#4ecdc4]/20 text-[#4ecdc4] hover:bg-[#4ecdc4]/30
                transition-all cursor-pointer"
            >
              <Check size={12} />
            </button>
            <button
              onClick={() => { setShowColorInput(false); setNewColor(""); }}
              className="p-1 rounded text-[#5e6388] hover:text-[#e8eaff] hover:bg-white/5
                transition-all cursor-pointer"
            >
              <X size={12} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
