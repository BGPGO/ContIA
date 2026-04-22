"use client";

import { useState, useMemo, useEffect } from "react";
import { AlertCircle, Sparkles, ChevronLeft, ChevronRight, Download, FileArchive } from "lucide-react";
import JSZip from "jszip";

// ═══════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════

interface PreviewPanelProps {
  currentHtml: string | null;
  currentPngUrl: string | null;
  currentPngUrls?: string[] | null;
  isStreaming: boolean;
  error: string | null;
}

// ═══════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 px-8 text-center">
      <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
        <Sparkles size={24} className="text-[#4ecdc4]/60" />
      </div>
      <div className="space-y-2 max-w-xs">
        <h2 className="text-2xl font-serif text-white leading-snug">
          O que vamos criar hoje?
        </h2>
        <p className="text-sm text-white/40 leading-relaxed">
          Digite um pedido no chat à esquerda. Ex:{" "}
          <em className="text-white/60">
            criativo viral sobre produtividade, fundo preto com vermelho, estilo Gary Vee
          </em>
        </p>
      </div>
    </div>
  );
}

function StatusBadge({ label }: { label: string }) {
  return (
    <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-sm border border-white/10 text-[11px] text-white/70 font-medium z-10">
      {label}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════

export function PreviewPanel({
  currentHtml,
  currentPngUrl,
  currentPngUrls,
  isStreaming,
  error,
}: PreviewPanelProps) {
  const [activeSlide, setActiveSlide] = useState(0);

  // Reset slide index when a new creative is generated
  useEffect(() => {
    setActiveSlide(0);
  }, [currentHtml]);

  // Derive the list of PNGs to display
  const pngs = useMemo<string[]>(() => {
    if (currentPngUrls && currentPngUrls.length > 0) return currentPngUrls;
    if (currentPngUrl) return [currentPngUrl];
    return [];
  }, [currentPngUrls, currentPngUrl]);

  const totalSlides = pngs.length;
  const isCarousel = totalSlides >= 2;
  const currentUrl = pngs[activeSlide] ?? pngs[0] ?? null;

  // Count slides in HTML (for carousel navigation during streaming/rendering phase)
  const htmlSlideCount = useMemo(() => {
    if (!currentHtml) return 0;
    const regex = /<section\s[^>]*class\s*=\s*["'][^"']*creative-slide[^"']*["'][^>]*>/gi;
    return (currentHtml.match(regex) ?? []).length;
  }, [currentHtml]);

  const isCarouselHtml = htmlSlideCount >= 2;

  // Total slides to use for navigation (PNG list takes precedence, fallback to HTML count)
  const navTotal = Math.max(totalSlides, htmlSlideCount);
  const showNav = navTotal >= 2;

  // Download ZIP of all slides
  const downloadZip = async () => {
    const zip = new JSZip();
    for (let i = 0; i < pngs.length; i++) {
      const res = await fetch(pngs[i]);
      const blob = await res.blob();
      zip.file(`slide-${String(i + 1).padStart(2, "0")}.png`, blob);
    }
    const content = await zip.generateAsync({ type: "blob" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(content);
    a.download = "carrossel.zip";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  // Navigation controls (shared between PNG and HTML states)
  function NavControls() {
    if (!showNav) return null;
    const safeTotal = navTotal;
    return (
      <>
        <button
          onClick={() => setActiveSlide((i) => Math.max(0, i - 1))}
          disabled={activeSlide === 0}
          className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center disabled:opacity-30 z-10 transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <button
          onClick={() => setActiveSlide((i) => Math.min(safeTotal - 1, i + 1))}
          disabled={activeSlide >= safeTotal - 1}
          className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center disabled:opacity-30 z-10 transition-colors"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
        <div className="absolute top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-black/60 text-white text-xs font-medium z-10 pointer-events-none">
          {activeSlide + 1} / {safeTotal}
        </div>
      </>
    );
  }

  // ── Estado 4: erro ──
  if (error && !currentHtml && !currentPngUrl) {
    return (
      <div className="flex items-center justify-center h-full px-6">
        <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 max-w-sm">
          <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
          <p className="text-sm text-red-300 leading-relaxed">{error}</p>
        </div>
      </div>
    );
  }

  // ── Estado 1: vazio ──
  if (!currentHtml && !currentPngUrl && !isStreaming) {
    return <EmptyState />;
  }

  // ── Estado 3: PNG(s) prontos ──
  if (currentUrl) {
    return (
      <div className="flex flex-col h-full min-h-0">
        <div className="flex-1 min-h-0 relative flex items-center justify-center p-4 overflow-auto">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={currentUrl}
            alt={`Criativo gerado — slide ${activeSlide + 1}`}
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
          />
          <NavControls />
        </div>

        {/* Barra inferior: download */}
        <div className="shrink-0 px-4 py-3 border-t border-white/10 flex items-center justify-end gap-2">
          {isCarousel && (
            <button
              onClick={downloadZip}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 text-white text-sm font-medium
                hover:bg-white/15 transition-colors cursor-pointer border border-white/10"
            >
              <FileArchive size={14} />
              Baixar ZIP
            </button>
          )}
          <a
            href={currentUrl}
            download={isCarousel ? `slide-${String(activeSlide + 1).padStart(2, "0")}.png` : "criativo.png"}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#4ecdc4] text-black text-sm font-medium
              hover:bg-[#3dbdb4] transition-colors cursor-pointer"
          >
            <Download size={14} />
            {isCarousel ? "Baixar slide atual" : "Baixar PNG"}
          </a>
        </div>

        {/* Erro parcial (PNG entregue, mas com aviso) */}
        {error && (
          <div className="shrink-0 px-4 pb-3">
            <div className="flex items-center gap-2 text-xs text-amber-400/80">
              <AlertCircle size={12} />
              {error}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Estado 2: HTML disponível, PNG ainda não ──
  if (currentHtml) {
    // Para carrossel no HTML: injetar CSS que esconde todos os slides exceto o ativo
    let srcDoc = currentHtml;
    if (isCarouselHtml) {
      const injectedCss = `<style>
.creative-slide { display: none !important; }
.creative-slide:nth-of-type(${activeSlide + 1}) { display: block !important; }
</style>`;
      if (/<\/head>/i.test(srcDoc)) {
        srcDoc = srcDoc.replace(/<\/head>/i, `${injectedCss}</head>`);
      } else if (/<body[^>]*>/i.test(srcDoc)) {
        srcDoc = srcDoc.replace(/(<body[^>]*>)/i, `$1${injectedCss}`);
      } else {
        srcDoc = injectedCss + srcDoc;
      }
    }

    return (
      <div className="relative flex flex-col h-full min-h-0">
        <div className="flex-1 min-h-0 relative">
          <iframe
            srcDoc={srcDoc}
            sandbox=""
            className="w-full h-full border-0"
            title="Preview do criativo"
          />
          {isStreaming ? (
            <StatusBadge label="Gerando…" />
          ) : (
            <StatusBadge label="Renderizando PNG…" />
          )}
          <NavControls />
        </div>
      </div>
    );
  }

  // ── Streaming sem HTML ainda (só texto chegando) ──
  return (
    <div className="flex items-center justify-center h-full">
      <div className="flex flex-col items-center gap-3 text-white/40">
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full bg-[#4ecdc4]/50 animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
        <span className="text-xs">Gerando criativo…</span>
      </div>
    </div>
  );
}
