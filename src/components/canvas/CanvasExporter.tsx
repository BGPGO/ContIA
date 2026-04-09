"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Download,
  ChevronDown,
  Copy,
  Save,
  Loader2,
  Image as ImageIcon,
  Monitor,
  Check,
} from "lucide-react";
import type { FabricCanvasRef } from "@/components/canvas/FabricCanvas";

/* ═══════════════════════════════════════════════════════════════════════════
   Props
   ═══════════════════════════════════════════════════════════════════════════ */

interface CanvasExporterProps {
  canvasRef: React.RefObject<FabricCanvasRef | null>;
  isVisible: boolean;
  postTitle?: string;
  onSaveAsTemplate?: (name: string) => void;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Resolution presets
   ═══════════════════════════════════════════════════════════════════════════ */

const RESOLUTIONS = [
  { value: 1, label: "1x", sublabel: "1080px" },
  { value: 2, label: "2x", sublabel: "2160px" },
  { value: 3, label: "3x", sublabel: "3240px" },
] as const;

/* ═══════════════════════════════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════════════════════════════ */

export function CanvasExporter({
  canvasRef,
  isVisible,
  postTitle,
  onSaveAsTemplate,
}: CanvasExporterProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [exportFormat, setExportFormat] = useState<"png" | "jpg">("png");
  const [quality, setQuality] = useState(90);
  const [resolution, setResolution] = useState(2);
  const [isExporting, setIsExporting] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [templateName, setTemplateName] = useState("");

  // ── Computed dimensions text ──
  const baseDims = { w: 1080, h: 1080 }; // Will be overridden by actual canvas
  const displayDims = `${baseDims.w * resolution} x ${baseDims.h * resolution}px`;

  // ── Export handler ──
  const handleExport = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    setIsExporting(true);
    try {
      const dataUrl = canvas.toDataURL({
        format: exportFormat,
        quality: exportFormat === "jpg" ? quality / 100 : 1,
        multiplier: resolution,
      });

      // Trigger download
      const link = document.createElement("a");
      link.download = `${postTitle || "post"}-${Date.now()}.${exportFormat}`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("[CanvasExporter] Falha no export:", err);
    } finally {
      setIsExporting(false);
    }
  }, [canvasRef, exportFormat, quality, resolution, postTitle]);

  // ── Copy to clipboard ──
  const handleCopy = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    setIsCopying(true);
    try {
      const dataUrl = canvas.toDataURL({
        format: "png",
        quality: 1,
        multiplier: resolution,
      });

      // Convert data URL to blob
      const response = await fetch(dataUrl);
      const blob = await response.blob();

      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);

      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("[CanvasExporter] Falha ao copiar:", err);
    } finally {
      setIsCopying(false);
    }
  }, [canvasRef, resolution]);

  // ── Save as template ──
  const handleSaveTemplate = useCallback(() => {
    if (!templateName.trim() || !onSaveAsTemplate) return;
    onSaveAsTemplate(templateName.trim());
    setTemplateName("");
    setShowSaveInput(false);
  }, [templateName, onSaveAsTemplate]);

  if (!isVisible) return null;

  return (
    <div className="flex flex-col gap-2">
      {/* ── Primary download button ── */}
      <div className="flex items-center gap-1">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleExport}
          disabled={isExporting}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-[#6c5ce7] to-[#4ecdc4] text-white hover:shadow-[0_0_25px_rgba(78,205,196,0.3)] disabled:opacity-50 transition-all"
        >
          {isExporting ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Download size={16} />
          )}
          {isExporting ? "Exportando..." : `Download ${exportFormat.toUpperCase()}`}
        </motion.button>

        {/* Expand toggle */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-all ${
            isExpanded
              ? "bg-[#4ecdc4]/10 border-[#4ecdc4]/30 text-[#4ecdc4]"
              : "bg-[#141736] border-white/[0.06] text-[#5e6388] hover:text-[#8b8fb8]"
          }`}
        >
          <ChevronDown
            size={16}
            className={`transition-transform duration-200 ${
              isExpanded ? "rotate-180" : ""
            }`}
          />
        </button>
      </div>

      {/* ── Expanded options ── */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="bg-[#141736] rounded-xl border border-white/[0.06] p-4 space-y-4">
              {/* Format toggle */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-[#5e6388] uppercase tracking-wider">
                  Formato
                </label>
                <div className="flex gap-2">
                  {(["png", "jpg"] as const).map((fmt) => (
                    <button
                      key={fmt}
                      onClick={() => setExportFormat(fmt)}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                        exportFormat === fmt
                          ? "bg-[#4ecdc4]/15 text-[#4ecdc4] border border-[#4ecdc4]/30"
                          : "bg-white/5 text-[#5e6388] border border-transparent hover:text-[#8b8fb8]"
                      }`}
                    >
                      <ImageIcon size={13} />
                      {fmt.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quality slider (JPG only) */}
              <AnimatePresence>
                {exportFormat === "jpg" && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-semibold text-[#5e6388] uppercase tracking-wider">
                        Qualidade
                      </label>
                      <span className="text-xs font-mono text-[#4ecdc4]">
                        {quality}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={70}
                      max={100}
                      value={quality}
                      onChange={(e) => setQuality(Number(e.target.value))}
                      className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#4ecdc4] [&::-webkit-slider-thumb]:shadow-lg"
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Resolution */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-[#5e6388] uppercase tracking-wider">
                  Resolucao
                </label>
                <div className="flex gap-2">
                  {RESOLUTIONS.map((res) => (
                    <button
                      key={res.value}
                      onClick={() => setResolution(res.value)}
                      className={`flex-1 flex flex-col items-center gap-0.5 py-2 rounded-lg text-xs transition-all ${
                        resolution === res.value
                          ? "bg-[#6c5ce7]/15 text-[#6c5ce7] border border-[#6c5ce7]/30"
                          : "bg-white/5 text-[#5e6388] border border-transparent hover:text-[#8b8fb8]"
                      }`}
                    >
                      <Monitor size={13} />
                      <span className="font-semibold">{res.label}</span>
                      <span className="text-[10px] opacity-60">
                        {res.sublabel}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Dimensions display */}
              <div className="flex items-center justify-center py-1.5">
                <span className="text-[10px] text-[#5e6388] font-mono">
                  {displayDims}
                </span>
              </div>

              {/* Secondary actions */}
              <div className="flex gap-2 pt-1 border-t border-white/[0.04]">
                {/* Copy to clipboard */}
                <button
                  onClick={handleCopy}
                  disabled={isCopying}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium bg-white/5 text-[#e8eaff] hover:bg-white/10 disabled:opacity-50 transition-all"
                >
                  {copied ? (
                    <Check size={13} className="text-[#4ecdc4]" />
                  ) : isCopying ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <Copy size={13} />
                  )}
                  {copied
                    ? "Copiado!"
                    : isCopying
                      ? "Copiando..."
                      : "Copiar imagem"}
                </button>

                {/* Save as template */}
                {onSaveAsTemplate && (
                  <button
                    onClick={() => setShowSaveInput(!showSaveInput)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all ${
                      showSaveInput
                        ? "bg-[#4ecdc4]/10 text-[#4ecdc4] border border-[#4ecdc4]/20"
                        : "bg-white/5 text-[#e8eaff] hover:bg-white/10"
                    }`}
                  >
                    <Save size={13} />
                    Salvar template
                  </button>
                )}
              </div>

              {/* Save as template input */}
              <AnimatePresence>
                {showSaveInput && onSaveAsTemplate && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={templateName}
                        onChange={(e) => setTemplateName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveTemplate();
                        }}
                        placeholder="Nome do template..."
                        className="flex-1 px-3 py-2 bg-[#080b1e] border border-white/[0.06] rounded-lg text-xs text-[#e8eaff] placeholder:text-[#5e6388] focus:outline-none focus:border-[#4ecdc4]/40 transition-colors"
                        autoFocus
                      />
                      <button
                        onClick={handleSaveTemplate}
                        disabled={!templateName.trim()}
                        className="px-3 py-2 rounded-lg text-xs font-semibold bg-[#4ecdc4]/15 text-[#4ecdc4] hover:bg-[#4ecdc4]/25 disabled:opacity-40 transition-all"
                      >
                        Salvar
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
