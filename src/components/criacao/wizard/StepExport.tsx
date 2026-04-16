"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import {
  Save,
  Calendar,
  Copy,
  Check,
  BookmarkPlus,
  RefreshCw,
  FileText,
  Layers,
  Video,
  Mail,
  PenTool,
  Download,
  Image as ImageIcon,
  Loader2,
  Send,
  XCircle,
} from "lucide-react";
import type { WizardState } from "@/hooks/useCreationWizard";
import type { CreationTemplate, ContentFormat } from "@/types/ai";
import type { Post } from "@/types";
import { getPlataformaLabel } from "@/lib/utils";
import { submitPostForApproval } from "@/lib/posts";
import { PostCanvas } from "@/components/post-design/PostCanvas";
import type { PostDesignData, PostDesignTemplate } from "@/components/post-design/PostCanvas";

interface StepExportProps {
  state: WizardState;
  setField: <K extends keyof WizardState>(field: K, value: WizardState[K]) => void;
  createPost: (data: Omit<Post, "id" | "created_at" | "metricas">) => Promise<Post | null>;
  saveTemplate: (template: CreationTemplate) => CreationTemplate;
  empresaId: string;
  onReset: () => void;
}

const FORMAT_ICONS: Record<ContentFormat, typeof FileText> = {
  post: FileText,
  carrossel: Layers,
  reels: Video,
  email: Mail,
  copy: PenTool,
};

const FORMAT_LABELS: Record<ContentFormat, string> = {
  post: "Post",
  carrossel: "Carrossel",
  reels: "Reels",
  email: "Email",
  copy: "Copy",
};

export function StepExport({
  state,
  setField,
  createPost,
  saveTemplate,
  empresaId,
  onReset,
}: StepExportProps) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [savedPost, setSavedPost] = useState(false);
  const [savedTemplate, setSavedTemplate] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [templateName, setTemplateName] = useState(state.templateName || "");
  const [exporting, setExporting] = useState(false);
  const [submittingApproval, setSubmittingApproval] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);

  function showToast(message: string, type: "success" | "error") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }

  const { result, visualMode, visualLegenda, visualCta } = state;

  const getTitle = () => {
    if (visualMode && state.visualSlides.length > 0) {
      return state.visualSlides[0]?.titulo || "Conteudo visual";
    }
    return result?.titulo || "Conteudo gerado";
  };

  const getContent = () => {
    if (visualMode) return visualLegenda;
    return result?.conteudo || "";
  };

  const FormatIcon = FORMAT_ICONS[state.format];

  /* ── Design data for PostCanvas ── */
  const designData: PostDesignData = {
    headline: getTitle(),
    subheadline: state.topic || undefined,
    body: getContent()?.slice(0, 200) || undefined,
    cta: result?.cta || state.visualCta || undefined,
    brandName: "ContIA",
    brandColor: state.designBrandColor || "#4ecdc4",
    hashtags: result?.hashtags || state.visualHashtags || [],
  };

  /* ── Export image handler ── */
  const handleExportImage = async () => {
    if (!canvasRef.current) return;
    setExporting(true);
    try {
      const html2canvas = (await import("html2canvas-pro")).default;
      const canvas = await html2canvas(canvasRef.current, {
        scale: 3,
        useCORS: true,
        backgroundColor: null,
      });
      const url = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      a.download = `post-${state.topic.slice(0, 20).replace(/\s+/g, "-")}.png`;
      a.click();
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setExporting(false);
    }
  };

  const handleSaveDraft = async () => {
    setField("saving", true);
    const post = await createPost({
      empresa_id: empresaId,
      titulo: getTitle(),
      conteudo: getContent(),
      midia_url: state.generatedImageUrl || null,
      plataformas: state.platforms,
      status: "rascunho",
      agendado_para: null,
      publicado_em: null,
      tematica: state.topic,
    });
    setField("saving", false);
    if (post) {
      setSavedPost(true);
      setField("saved", true);
    }
  };

  const handleSubmitApproval = async () => {
    setSubmittingApproval(true);
    try {
      // 1. Salvar o post como rascunho primeiro para obter o postId
      const post = await createPost({
        empresa_id: empresaId,
        titulo: getTitle(),
        conteudo: getContent(),
        midia_url: state.generatedImageUrl || null,
        plataformas: state.platforms,
        status: "rascunho",
        agendado_para: null,
        publicado_em: null,
        tematica: state.topic,
      });

      if (!post) {
        throw new Error(
          "Falha ao salvar o post. O fluxo de aprovacao requer conexao com Supabase."
        );
      }

      // 2. Enviar para aprovação
      await submitPostForApproval(post.id);

      showToast("Post enviado para aprovação!", "success");

      // 3. Redirecionar para /aprovacao após breve delay para o toast ser visto
      setTimeout(() => {
        router.push("/aprovacao");
      }, 1200);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao enviar para aprovação";
      showToast(msg, "error");
    } finally {
      setSubmittingApproval(false);
    }
  };

  const handleSchedule = async () => {
    if (!scheduleDate) return;
    setField("saving", true);
    const post = await createPost({
      empresa_id: empresaId,
      titulo: getTitle(),
      conteudo: getContent(),
      midia_url: state.generatedImageUrl || null,
      plataformas: state.platforms,
      status: "agendado",
      agendado_para: new Date(scheduleDate).toISOString(),
      publicado_em: null,
      tematica: state.topic,
    });
    setField("saving", false);
    if (post) {
      setSavedPost(true);
      setField("saved", true);
    }
  };

  const handleCopy = async () => {
    const text = [
      getTitle(),
      "",
      getContent(),
      "",
      result?.hashtags?.map((h) => `#${h.replace("#", "")}`).join(" ") || "",
    ]
      .filter(Boolean)
      .join("\n");

    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveTemplate = () => {
    if (!templateName.trim()) return;

    const template: CreationTemplate = {
      id: state.templateId || crypto.randomUUID(),
      empresa_id: empresaId,
      name: templateName.trim(),
      tone: state.tone,
      platforms: state.platforms,
      site_url: state.siteUrl || undefined,
      instagram_username: state.igUsername || undefined,
      site_analysis: state.siteAnalysis,
      ig_analysis: state.fullIgAnalysis,
      visual_style: state.fullIgAnalysis?.visual_style || null,
      brand_colors: state.fullIgAnalysis?.visual_style?.background?.colors || [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    saveTemplate(template);
    setSavedTemplate(true);
  };

  /* ══════════════════════════════════════════════════════════════════════════
     Success state (after save)
     ══════════════════════════════════════════════════════════════════════════ */
  if (state.saved && savedPost) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 20 }}
        className="flex flex-col items-center justify-center min-h-[400px] gap-6"
      >
        <div className="w-16 h-16 rounded-2xl bg-success/10 flex items-center justify-center">
          <Check size={32} className="text-success" />
        </div>
        <div className="text-center space-y-2">
          <h3 className="text-lg font-semibold text-text-primary">Conteudo salvo!</h3>
          <p className="text-sm text-text-secondary">
            Seu conteudo foi salvo com sucesso.
          </p>
        </div>
        <button
          onClick={onReset}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold bg-accent text-white hover:bg-accent/90 transition-all"
        >
          <RefreshCw size={14} />
          Criar outro conteudo
        </button>
      </motion.div>
    );
  }

  /* ══════════════════════════════════════════════════════════════════════════
     Main export UI
     ══════════════════════════════════════════════════════════════════════════ */
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-text-primary text-center">
        Finalizar
      </h2>

      {/* Summary card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="bg-bg-card border border-border rounded-xl p-5"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
            <FormatIcon size={22} className="text-accent-light" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-text-primary truncate">
              {getTitle()}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent-light font-medium">
                {FORMAT_LABELS[state.format]}
              </span>
              <span className="text-xs text-text-muted">
                {state.platforms.map(getPlataformaLabel).join(", ")}
              </span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Visual Post Preview */}
      {state.designTemplate && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.05 }}
          className="bg-bg-card border border-border rounded-xl p-6 flex flex-col items-center gap-4"
        >
          <h3 className="text-sm font-semibold text-text-secondary">Preview Final</h3>
          <PostCanvas
            ref={canvasRef}
            data={designData}
            template={state.designTemplate}
            aspectRatio={state.designAspectRatio}
            brandColor={state.designBrandColor}
          />
        </motion.div>
      )}

      {/* Action buttons */}
      <div className="space-y-3">
        {/* Save as draft */}
        <motion.button
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          onClick={handleSaveDraft}
          disabled={state.saving}
          className="w-full flex items-center gap-4 bg-bg-card border border-border rounded-xl p-4 hover:border-accent/40 hover:bg-bg-card-hover transition-all text-left group"
        >
          <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center group-hover:bg-accent/20 transition-colors">
            <Save size={18} className="text-accent-light" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-text-primary">Salvar como Rascunho</p>
            <p className="text-xs text-text-muted mt-0.5">Salvar para editar depois</p>
          </div>
        </motion.button>

        {/* Send for approval */}
        <motion.button
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.13 }}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          onClick={handleSubmitApproval}
          disabled={state.saving || submittingApproval}
          className="w-full flex items-center gap-4 bg-bg-card border border-border rounded-xl p-4 hover:border-secondary/40 hover:bg-bg-card-hover transition-all text-left group"
        >
          <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center group-hover:bg-secondary/20 transition-colors">
            {submittingApproval ? (
              <Loader2 size={18} className="text-secondary animate-spin" />
            ) : (
              <Send size={18} className="text-secondary" />
            )}
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-text-primary">
              {submittingApproval ? "Enviando..." : "Enviar para Aprovação"}
            </p>
            <p className="text-xs text-text-muted mt-0.5">Solicitar revisão antes de publicar</p>
          </div>
        </motion.button>

        {/* Schedule */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.15 }}
        >
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={() => setShowSchedule(!showSchedule)}
            className="w-full flex items-center gap-4 bg-bg-card border border-border rounded-xl p-4 hover:border-accent/40 hover:bg-bg-card-hover transition-all text-left group"
          >
            <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center group-hover:bg-warning/20 transition-colors">
              <Calendar size={18} className="text-warning" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-text-primary">Agendar Publicacao</p>
              <p className="text-xs text-text-muted mt-0.5">Escolha data e horario</p>
            </div>
          </motion.button>
          <AnimatePresence>
            {showSchedule && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="mt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 bg-bg-card border border-border rounded-xl p-3 sm:p-4">
                  <input
                    type="datetime-local"
                    value={scheduleDate}
                    onChange={(e) => setScheduleDate(e.target.value)}
                    className="flex-1 bg-bg-input border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent/50"
                  />
                  <button
                    onClick={handleSchedule}
                    disabled={!scheduleDate || state.saving}
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-warning text-bg-primary hover:bg-warning/90 disabled:opacity-40 transition-all w-full sm:w-auto"
                  >
                    Agendar
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Download as Image */}
        {state.designTemplate && (
          <motion.button
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={handleExportImage}
            disabled={exporting}
            className="w-full flex items-center gap-4 bg-gradient-to-r from-[#6c5ce7]/10 to-[#4ecdc4]/10 border border-accent/30 rounded-xl p-4 hover:border-accent/50 transition-all text-left group"
          >
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#6c5ce7] to-[#4ecdc4] flex items-center justify-center">
              {exporting ? (
                <Loader2 size={18} className="text-white animate-spin" />
              ) : (
                <Download size={18} className="text-white" />
              )}
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-text-primary">
                {exporting ? "Exportando..." : "Baixar como Imagem"}
              </p>
              <p className="text-xs text-text-muted mt-0.5">Download PNG em alta resolucao (3x)</p>
            </div>
          </motion.button>
        )}

        {/* Copy text */}
        <motion.button
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: state.designTemplate ? 0.25 : 0.2 }}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          onClick={handleCopy}
          className="w-full flex items-center gap-4 bg-bg-card border border-border rounded-xl p-4 hover:border-accent/40 hover:bg-bg-card-hover transition-all text-left group"
        >
          <div className="w-10 h-10 rounded-lg bg-info/10 flex items-center justify-center group-hover:bg-info/20 transition-colors">
            {copied ? (
              <Check size={18} className="text-success" />
            ) : (
              <Copy size={18} className="text-info" />
            )}
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-text-primary">
              {copied ? "Copiado!" : "Copiar Texto"}
            </p>
            <p className="text-xs text-text-muted mt-0.5">Copiar conteudo para a area de transferencia</p>
          </div>
        </motion.button>
      </div>

      {/* Divider */}
      <div className="border-t border-border" />

      {/* Save as template */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: state.designTemplate ? 0.3 : 0.25 }}
        className="bg-bg-card border border-border rounded-xl p-5 space-y-4"
      >
        <div className="flex items-center gap-2.5">
          <BookmarkPlus size={16} className="text-accent-light" />
          <h3 className="text-sm font-semibold text-text-primary">Salvar como Template</h3>
        </div>

        {savedTemplate ? (
          <div className="flex items-center gap-2 text-sm text-success">
            <Check size={14} />
            Template salvo!
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
            <input
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="Nome do template..."
              className="flex-1 bg-bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 transition-colors"
            />
            <button
              onClick={handleSaveTemplate}
              disabled={!templateName.trim()}
              className="px-4 py-2.5 rounded-lg text-sm font-medium bg-accent/10 text-accent-light hover:bg-accent/20 disabled:opacity-40 transition-all shrink-0 w-full sm:w-auto"
            >
              {state.templateId ? "Atualizar" : "Salvar"}
            </button>
          </div>
        )}
      </motion.div>

      {/* Toast notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className={`fixed bottom-6 right-6 z-[60] flex items-center gap-3 px-5 py-3 rounded-xl border shadow-xl backdrop-blur-xl ${
              toast.type === "success"
                ? "bg-[#0c0f24]/95 border-[#34d399]/30 text-[#34d399]"
                : "bg-[#0c0f24]/95 border-[#f87171]/30 text-[#f87171]"
            }`}
          >
            {toast.type === "success" ? (
              <Check size={16} className="shrink-0" />
            ) : (
              <XCircle size={16} className="shrink-0" />
            )}
            <span className="text-sm font-medium text-[#e8eaff]">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
