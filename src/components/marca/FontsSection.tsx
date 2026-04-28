"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Type, Plus, X, Loader2, Upload } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";

interface BrandAsset {
  id: string;
  name: string;
  type: string;
  file_url: string;
  file_name: string | null;
}

type AddMode = "google" | "upload" | null;

interface FontsSectionProps {
  empresaId: string;
  brandFonts: string[];
  onFontsUpdated: (fonts: string[]) => void;
}

export function FontsSection({
  empresaId,
  brandFonts,
  onFontsUpdated,
}: FontsSectionProps) {
  const [fontAssets, setFontAssets] = useState<BrandAsset[]>([]);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [addMode, setAddMode] = useState<AddMode>(null);
  const [googleFontName, setGoogleFontName] = useState("");
  const [savingGoogle, setSavingGoogle] = useState(false);
  const [uploadingFont, setUploadingFont] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fontFileInputRef = useRef<HTMLInputElement>(null);

  const fetchFontAssets = useCallback(async () => {
    if (!empresaId || !isSupabaseConfigured()) return;
    setLoadingAssets(true);
    try {
      const res = await fetch(
        `/api/brand-assets?empresa_id=${empresaId}&type=font`
      );
      if (res.ok) {
        setFontAssets(await res.json());
      }
    } catch {
      // silently ignore
    } finally {
      setLoadingAssets(false);
    }
  }, [empresaId]);

  useEffect(() => {
    fetchFontAssets();
  }, [fetchFontAssets]);

  // Save brand_fonts[] to Supabase directly
  const saveFontsToDb = async (fonts: string[]) => {
    if (!isSupabaseConfigured()) return;
    const supabase = createClient();
    await supabase
      .from("empresas")
      .update({ brand_fonts: fonts } as any)
      .eq("id", empresaId);
  };

  const handleAddGoogleFont = async () => {
    const name = googleFontName.trim();
    if (!name) return;
    if (brandFonts.includes(name)) {
      setError("Essa fonte já foi adicionada.");
      return;
    }
    setSavingGoogle(true);
    setError(null);
    try {
      const updated = [...brandFonts, name];
      await saveFontsToDb(updated);
      onFontsUpdated(updated);
      setGoogleFontName("");
      setAddMode(null);
    } catch (err) {
      setError((err as Error).message || "Erro ao salvar a fonte");
    } finally {
      setSavingGoogle(false);
    }
  };

  const handleRemoveGoogleFont = async (fontName: string) => {
    setError(null);
    const updated = brandFonts.filter((f) => f !== fontName);
    try {
      await saveFontsToDb(updated);
      onFontsUpdated(updated);
    } catch (err) {
      setError((err as Error).message || "Erro ao remover a fonte");
    }
  };

  const handleFontFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file || !empresaId) return;
    setUploadingFont(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("empresa_id", empresaId);
      formData.append("type", "font");
      formData.append("name", file.name.replace(/\.[^.]+$/, ""));
      const res = await fetch("/api/brand-assets", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Falha no upload da fonte");
      }
      await fetchFontAssets();
      setAddMode(null);
    } catch (err) {
      setError((err as Error).message || "Erro ao fazer upload da fonte");
    } finally {
      setUploadingFont(false);
      if (fontFileInputRef.current) fontFileInputRef.current.value = "";
    }
  };

  const handleDeleteFontAsset = async (id: string) => {
    if (!confirm("Remover este arquivo de fonte?")) return;
    try {
      const res = await fetch(`/api/brand-assets/${id}`, { method: "DELETE" });
      if (res.ok) {
        setFontAssets((prev) => prev.filter((a) => a.id !== id));
      }
    } catch {
      // silently ignore
    }
  };

  const allFonts = [...new Set([...brandFonts])];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.24 }}
    >
      <div className="flex items-center gap-3 mb-5">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{
            backgroundColor: "#a29bfe18",
            boxShadow: "0 0 20px #a29bfe10",
          }}
        >
          <Type size={20} style={{ color: "#a29bfe" }} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-text-primary">Fontes</h2>
          <p className="text-xs text-text-muted mt-0.5">
            Google Fonts e arquivos de fonte carregados
          </p>
        </div>
      </div>

      <div className="bg-bg-card border border-border rounded-xl p-6 space-y-5">
        {/* Google Fonts list */}
        {allFonts.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-text-muted uppercase tracking-wide mb-3">
              Fontes da marca
            </p>
            <div className="flex flex-col gap-2">
              {allFonts.map((font) => (
                <motion.div
                  key={font}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center justify-between px-4 py-3 bg-bg-elevated border border-border rounded-lg group"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium text-text-primary">
                      {font}
                    </span>
                    <span
                      className="text-base text-text-secondary"
                      style={{ fontFamily: `'${font}', sans-serif` }}
                    >
                      Aa Bb Cc 123
                    </span>
                  </div>
                  <button
                    onClick={() => handleRemoveGoogleFont(font)}
                    className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-red-400 transition-all"
                    title="Remover fonte"
                  >
                    <X size={14} />
                  </button>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Uploaded font files */}
        {loadingAssets ? (
          <div className="flex items-center gap-2 text-xs text-text-muted">
            <Loader2 size={12} className="animate-spin" />
            Carregando arquivos de fonte...
          </div>
        ) : fontAssets.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-medium text-text-muted uppercase tracking-wide mb-3">
              Arquivos de fonte
            </p>
            <div className="flex flex-col gap-2">
              {fontAssets.map((asset) => (
                <motion.div
                  key={asset.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center justify-between px-4 py-3 bg-bg-elevated border border-border rounded-lg group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#a29bfe]/15 border border-[#a29bfe]/20 flex items-center justify-center shrink-0">
                      <Type size={14} style={{ color: "#a29bfe" }} />
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium text-text-primary">
                        {asset.name}
                      </span>
                      {asset.file_name && (
                        <span className="text-xs text-text-muted">
                          {asset.file_name}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteFontAsset(asset.id)}
                    className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-red-400 transition-all"
                    title="Remover arquivo"
                  >
                    <X size={14} />
                  </button>
                </motion.div>
              ))}
            </div>
          </div>
        ) : null}

        {allFonts.length === 0 && fontAssets.length === 0 && !loadingAssets && (
          <p className="text-xs text-text-muted italic">
            Nenhuma fonte cadastrada. Adicione fontes Google ou faça upload de
            arquivos.
          </p>
        )}

        {/* Error message */}
        {error && (
          <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {/* Add mode panel */}
        <AnimatePresence>
          {addMode === "google" && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="pt-3 border-t border-border space-y-3">
                <p className="text-xs font-medium text-text-secondary">
                  Nome da fonte (Google Fonts)
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={googleFontName}
                    onChange={(e) => setGoogleFontName(e.target.value)}
                    onKeyDown={(e) =>
                      e.key === "Enter" && handleAddGoogleFont()
                    }
                    placeholder="Ex: Inter, Montserrat, Playfair Display"
                    className="flex-1 h-9 px-3 text-sm bg-bg-input border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-[#4ecdc4]/40 transition-all"
                  />
                  <button
                    onClick={handleAddGoogleFont}
                    disabled={!googleFontName.trim() || savingGoogle}
                    className="px-4 h-9 rounded-lg text-sm font-medium bg-[#4ecdc4] text-black hover:bg-[#3cb8b0] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                  >
                    {savingGoogle ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      "Salvar"
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setAddMode(null);
                      setGoogleFontName("");
                      setError(null);
                    }}
                    className="px-3 h-9 rounded-lg text-sm border border-border text-text-secondary hover:bg-bg-card-hover transition-all"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Add buttons */}
        {addMode === null && (
          <div className="flex gap-2 pt-2 border-t border-border">
            <input
              ref={fontFileInputRef}
              type="file"
              accept=".ttf,.otf,.woff,.woff2"
              className="hidden"
              onChange={handleFontFileUpload}
            />
            <button
              onClick={() => setAddMode("google")}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-border text-text-secondary hover:bg-bg-card-hover transition-all"
            >
              <Plus size={14} />
              Google Font
            </button>
            <button
              onClick={() => fontFileInputRef.current?.click()}
              disabled={uploadingFont}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-border text-text-secondary hover:bg-bg-card-hover disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {uploadingFont ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Upload size={14} />
                  Upload de arquivo
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
