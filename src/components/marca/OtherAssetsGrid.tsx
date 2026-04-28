"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Plus, Trash2, Loader2, Shapes, Camera } from "lucide-react";
import { Palette } from "lucide-react";
import { motion } from "motion/react";
import { isSupabaseConfigured } from "@/lib/supabase/config";

interface BrandAsset {
  id: string;
  name: string;
  type: "logo" | "font" | "element" | "texture" | "photo";
  file_url: string;
  file_name: string | null;
  file_size: number | null;
}

type OtherAssetType = "element" | "texture" | "photo";

interface AssetGroupConfig {
  type: OtherAssetType;
  label: string;
  icon: React.ReactNode;
  color: string;
}

const GROUPS: AssetGroupConfig[] = [
  {
    type: "element",
    label: "Elementos",
    icon: <Shapes size={16} />,
    color: "#34d399",
  },
  {
    type: "texture",
    label: "Texturas",
    icon: <Palette size={16} />,
    color: "#f472b6",
  },
  {
    type: "photo",
    label: "Fotos",
    icon: <Camera size={16} />,
    color: "#60a5fa",
  },
];

interface OtherAssetsGridProps {
  empresaId: string;
}

export function OtherAssetsGrid({ empresaId }: OtherAssetsGridProps) {
  const [assets, setAssets] = useState<BrandAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState<OtherAssetType | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const fetchAssets = useCallback(async () => {
    if (!empresaId || !isSupabaseConfigured()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/brand-assets?empresa_id=${empresaId}`);
      if (res.ok) {
        const all: BrandAsset[] = await res.json();
        setAssets(all.filter((a) => ["element", "texture", "photo"].includes(a.type)));
      }
    } catch {
      // silently ignore
    } finally {
      setLoading(false);
    }
  }, [empresaId]);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  const handleUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: OtherAssetType
  ) => {
    const file = e.target.files?.[0];
    if (!file || !empresaId) return;
    setUploading(type);
    setErrors((prev) => ({ ...prev, [type]: "" }));
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("empresa_id", empresaId);
      formData.append("type", type);
      formData.append("name", file.name.replace(/\.[^.]+$/, ""));
      const res = await fetch("/api/brand-assets", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Falha no upload`);
      }
      await fetchAssets();
    } catch (err) {
      setErrors((prev) => ({
        ...prev,
        [type]: (err as Error).message || "Erro no upload",
      }));
    } finally {
      setUploading(null);
      const ref = fileInputRefs.current[type];
      if (ref) ref.value = "";
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remover este asset?")) return;
    try {
      const res = await fetch(`/api/brand-assets/${id}`, { method: "DELETE" });
      if (res.ok) {
        setAssets((prev) => prev.filter((a) => a.id !== id));
      }
    } catch {
      // silently ignore
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.32 }}
    >
      <div className="flex items-center gap-3 mb-5">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{
            backgroundColor: "#34d39918",
            boxShadow: "0 0 20px #34d39910",
          }}
        >
          <Shapes size={20} style={{ color: "#34d399" }} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-text-primary">Outros Assets</h2>
          <p className="text-xs text-text-muted mt-0.5">
            Elementos, texturas e fotos da marca
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-text-muted py-4">
          <Loader2 size={12} className="animate-spin" />
          Carregando assets...
        </div>
      ) : (
        <div className="space-y-6">
          {GROUPS.map((group) => {
            const groupAssets = assets.filter((a) => a.type === group.type);
            const isUploading = uploading === group.type;
            return (
              <div key={group.type} className="bg-bg-card border border-border rounded-xl p-5">
                {/* Group header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span style={{ color: group.color }}>{group.icon}</span>
                    <h3 className="text-sm font-semibold text-text-primary">
                      {group.label}
                    </h3>
                    <span className="text-xs text-text-muted">
                      ({groupAssets.length})
                    </span>
                  </div>
                  <div>
                    <input
                      ref={(el) => {
                        fileInputRefs.current[group.type] = el;
                      }}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleUpload(e, group.type)}
                    />
                    <button
                      onClick={() =>
                        fileInputRefs.current[group.type]?.click()
                      }
                      disabled={isUploading}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border text-text-secondary hover:bg-bg-card-hover disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      {isUploading ? (
                        <>
                          <Loader2 size={12} className="animate-spin" />
                          Enviando...
                        </>
                      ) : (
                        <>
                          <Plus size={12} />
                          Adicionar
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Error */}
                {errors[group.type] && (
                  <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2 mb-3">
                    {errors[group.type]}
                  </p>
                )}

                {/* Grid */}
                {groupAssets.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {groupAssets.map((asset) => (
                      <motion.div
                        key={asset.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="relative group rounded-lg overflow-hidden border border-border bg-bg-elevated aspect-square"
                      >
                        <img
                          src={asset.file_url}
                          alt={asset.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display =
                              "none";
                          }}
                        />
                        {/* Overlay on hover */}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/60 transition-all flex flex-col items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                          <p className="text-xs text-white font-medium px-2 text-center truncate w-full px-4">
                            {asset.name}
                          </p>
                          <button
                            onClick={() => handleDelete(asset.id)}
                            className="p-2 rounded-lg bg-red-500/80 text-white hover:bg-red-600 transition-colors"
                            title="Remover"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-text-muted italic">
                    Nenhum {group.label.toLowerCase()} cadastrado.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
