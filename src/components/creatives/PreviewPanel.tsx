"use client";

import { AlertCircle, Sparkles, Download } from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════

interface PreviewPanelProps {
  currentHtml: string | null;
  currentPngUrl: string | null;
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
    <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-sm border border-white/10 text-[11px] text-white/70 font-medium">
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
  isStreaming,
  error,
}: PreviewPanelProps) {
  // Estado 4: erro
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

  // Estado 1: vazio
  if (!currentHtml && !currentPngUrl && !isStreaming) {
    return <EmptyState />;
  }

  // Estado 3: PNG pronto
  if (currentPngUrl) {
    return (
      <div className="flex flex-col h-full min-h-0">
        <div className="flex-1 min-h-0 flex items-center justify-center p-4 overflow-auto">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={currentPngUrl}
            alt="Criativo gerado"
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
          />
        </div>
        {/* Botão de download */}
        <div className="shrink-0 px-4 py-3 border-t border-white/10 flex justify-end">
          <a
            href={currentPngUrl}
            download="criativo.png"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#4ecdc4] text-black text-sm font-medium
              hover:bg-[#3dbdb4] transition-colors cursor-pointer"
          >
            <Download size={14} />
            Baixar PNG
          </a>
        </div>
        {/* Erro de render parcial (PNG foi mas houve aviso) */}
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

  // Estado 2: HTML disponível, PNG ainda não
  if (currentHtml) {
    return (
      <div className="relative flex flex-col h-full min-h-0">
        <div className="flex-1 min-h-0 relative">
          <iframe
            srcDoc={currentHtml}
            sandbox=""
            className="w-full h-full border-0"
            title="Preview do criativo"
          />
          {/* Badge de status */}
          {isStreaming ? (
            <StatusBadge label="Gerando…" />
          ) : (
            <StatusBadge label="Renderizando PNG…" />
          )}
        </div>
      </div>
    );
  }

  // Streaming sem HTML ainda (só texto chegando)
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
