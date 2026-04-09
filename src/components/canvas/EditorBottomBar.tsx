"use client";

import { useState } from "react";
import {
  ArrowLeft,
  LayoutTemplate,
  Save,
  Download,
  Copy,
  Check,
  Loader2,
  ImagePlus,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════════════════ */

interface EditorBottomBarProps {
  onOpenTemplates: () => void;
  onSaveTemplate: () => void;
  onExport: () => void;
  onCopyToClipboard: () => void;
  onBack: () => void;
  onCreateFromImage?: () => void;
  hasUnsavedChanges: boolean;
  isSaving?: boolean;
  sessionId?: string | null;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════════════════════════════ */

export function EditorBottomBar({
  onOpenTemplates,
  onSaveTemplate,
  onExport,
  onCopyToClipboard,
  onBack,
  onCreateFromImage,
  hasUnsavedChanges,
  isSaving = false,
  sessionId,
}: EditorBottomBarProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    onCopyToClipboard();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="shrink-0 flex items-center justify-between px-6 py-3 bg-[#0c0f24] border-t border-white/10">
      {/* Left: Back */}
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium
          text-[#8b8fb0] hover:text-[#e8eaff] hover:bg-white/5 transition-all cursor-pointer"
      >
        <ArrowLeft size={16} />
        <span className="hidden sm:inline">Voltar</span>
      </button>

      {/* Center: Templates + Create from Image + Save */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onOpenTemplates}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
            text-[#e8eaff] bg-[#141736] border border-white/10
            hover:border-[#4ecdc4]/30 hover:bg-[#141736]/80 transition-all cursor-pointer"
        >
          <LayoutTemplate size={16} />
          <span className="hidden sm:inline">Templates</span>
        </button>

        {onCreateFromImage && (
          <button
            type="button"
            onClick={onCreateFromImage}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
              text-[#e8eaff] bg-[#141736] border border-white/10
              hover:border-[#6c5ce7]/30 hover:bg-[#141736]/80 transition-all cursor-pointer"
          >
            <ImagePlus size={16} />
            <span className="hidden sm:inline">Criar de Imagem</span>
          </button>
        )}

        <button
          type="button"
          onClick={onSaveTemplate}
          disabled={isSaving}
          className="relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
            text-[#e8eaff] bg-[#141736] border border-white/10
            hover:border-[#6c5ce7]/30 hover:bg-[#141736]/80 transition-all cursor-pointer
            disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Save size={16} />
          )}
          <span className="hidden sm:inline">Salvar template</span>
          {hasUnsavedChanges && !isSaving && (
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#f59e0b] border-2 border-[#0c0f24]" />
          )}
        </button>
      </div>

      {/* Right: Export actions */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium
            text-[#8b8fb0] hover:text-[#e8eaff] hover:bg-white/5 transition-all cursor-pointer"
        >
          {copied ? <Check size={16} className="text-[#34d399]" /> : <Copy size={16} />}
          <span className="hidden sm:inline">{copied ? "Copiado!" : "Copiar"}</span>
        </button>

        <button
          type="button"
          onClick={onExport}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white
            transition-all cursor-pointer hover:shadow-lg hover:shadow-[#4ecdc4]/20 active:scale-[0.98]"
          style={{
            background: "linear-gradient(135deg, #6c5ce7 0%, #4ecdc4 100%)",
          }}
        >
          <Download size={16} />
          <span className="hidden sm:inline">Download</span>
        </button>
      </div>
    </div>
  );
}
