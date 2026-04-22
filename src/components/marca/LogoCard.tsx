"use client";

import { useRef, useState } from "react";
import { ImageIcon, Upload, Trash2, Loader2 } from "lucide-react";
import { motion } from "motion/react";

interface LogoCardProps {
  empresaId: string;
  logoUrl: string | null;
  onLogoUpdated: (newUrl: string | null) => void;
}

export function LogoCard({ empresaId, logoUrl, onLogoUpdated }: LogoCardProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !empresaId) return;
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("empresa_id", empresaId);
      formData.append("type", "logo");
      formData.append("name", file.name.replace(/\.[^.]+$/, ""));
      const res = await fetch("/api/brand-assets", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Falha no upload do logo");
      }
      const body = await res.json();
      const newUrl: string | null =
        body?.asset?.file_url ?? body?.file_url ?? null;
      onLogoUpdated(newUrl);
    } catch (err) {
      setError((err as Error).message || "Erro ao fazer upload do logo");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemove = async () => {
    if (!confirm("Remover o logo atual?")) return;
    setRemoving(true);
    setError(null);
    try {
      // Fetch the logo asset to get its ID for deletion
      const listRes = await fetch(
        `/api/brand-assets?empresa_id=${empresaId}&type=logo`
      );
      if (listRes.ok) {
        const assets: Array<{ id: string; type: string }> =
          await listRes.json();
        const logoAsset = assets.find((a) => a.type === "logo");
        if (logoAsset) {
          await fetch(`/api/brand-assets/${logoAsset.id}`, {
            method: "DELETE",
          });
        }
      }
      onLogoUpdated(null);
    } catch (err) {
      setError((err as Error).message || "Erro ao remover o logo");
    } finally {
      setRemoving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.16 }}
    >
      <div className="flex items-center gap-3 mb-5">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{
            backgroundColor: "#fbbf2418",
            boxShadow: "0 0 20px #fbbf2410",
          }}
        >
          <ImageIcon size={20} style={{ color: "#fbbf24" }} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-text-primary">Logo da Marca</h2>
          <p className="text-xs text-text-muted mt-0.5">
            Logo principal da empresa
          </p>
        </div>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-xl p-6">
        <div className="flex items-start gap-6">
          {/* Preview */}
          <div className="shrink-0">
            {logoUrl ? (
              <div
                className="w-[200px] h-[200px] rounded-xl border border-white/10 overflow-hidden flex items-center justify-center"
                style={{
                  backgroundImage:
                    "repeating-conic-gradient(#ffffff08 0% 25%, transparent 0% 50%)",
                  backgroundSize: "16px 16px",
                }}
              >
                <img
                  src={logoUrl}
                  alt="Logo da marca"
                  className="max-w-full max-h-full object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              </div>
            ) : (
              <div className="w-[200px] h-[200px] rounded-xl border border-dashed border-white/20 flex flex-col items-center justify-center gap-3 bg-white/3">
                <ImageIcon size={36} className="text-white/30" />
                <p className="text-xs text-white/40 text-center px-4">
                  Nenhum logo cadastrado
                </p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex-1 flex flex-col gap-3 pt-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.svg"
              className="hidden"
              onChange={handleFileSelect}
            />

            {logoUrl ? (
              <>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading || removing}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 bg-[#4ecdc4] text-black hover:bg-[#3cb8b0] disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {uploading ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Upload size={14} />
                      Substituir logo
                    </>
                  )}
                </button>
                <button
                  onClick={handleRemove}
                  disabled={uploading || removing}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 border border-white/15 text-white hover:bg-white/5 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {removing ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Removendo...
                    </>
                  ) : (
                    <>
                      <Trash2 size={14} />
                      Remover logo
                    </>
                  )}
                </button>
              </>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 bg-[#4ecdc4] text-black hover:bg-[#3cb8b0] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {uploading ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Upload size={14} />
                    Fazer upload
                  </>
                )}
              </button>
            )}

            <p className="text-xs text-white/40">
              Formatos aceitos: PNG, JPG, SVG, WebP
            </p>

            {error && (
              <p className="text-xs text-red-400 mt-1 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
