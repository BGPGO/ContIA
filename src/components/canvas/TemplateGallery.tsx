"use client";

import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  Search,
  Layout,
  Type,
  Palette,
  Maximize,
  Layers,
  Smartphone,
  Square,
  RectangleVertical,
  Quote,
  Hash,
  BarChart3,
  SplitSquareVertical,
  GalleryHorizontal,
  Newspaper,
  MessageSquare,
  ListOrdered,
  Copy,
  Trash2,
  Megaphone,
  TrendingUp,
  List,
  MousePointerClick,
  Sparkles,
  Image as ImageIcon,
  PenTool,
  Upload,
  FileImage,
  ChevronRight,
} from "lucide-react";
import type { VisualTemplate, VisualTemplateSummary } from "@/types/canvas";
import type { PsdTemplate } from "@/lib/psd-templates";
import { usePresetPreviews } from "@/hooks/usePresetPreviews";
import { ALL_PRESET_IDS } from "@/lib/preset-templates";

/* ═══════════════════════════════════════════════════════════════════════════
   Preset template metadata
   ═══════════════════════════════════════════════════════════════════════════ */

interface PresetMeta {
  id: string;
  name: string;
  description: string;
  icon: typeof Layout;
  bgColor: string;
  accentColor: string;
}

const PRESETS: PresetMeta[] = [
  { id: "bold-statement", name: "Impactante", description: "Headline bold, visual forte", icon: Type, bgColor: "#080b1e", accentColor: "#4ecdc4" },
  { id: "gradient-wave", name: "Gradiente", description: "Fundo gradiente moderno", icon: Palette, bgColor: "#080b1e", accentColor: "#6c5ce7" },
  { id: "minimal-clean", name: "Minimalista", description: "Clean, muito espaco", icon: Layout, bgColor: "#ffffff", accentColor: "#4ecdc4" },
  { id: "quote-card", name: "Citacao", description: "Card de frase/quote", icon: Quote, bgColor: "#0c0f24", accentColor: "#4ecdc4" },
  { id: "tip-numbered", name: "Dica Numerada", description: "Dica estruturada com numero", icon: ListOrdered, bgColor: "#080b1e", accentColor: "#4ecdc4" },
  { id: "stats-highlight", name: "Destaque Numerico", description: "Numero em destaque", icon: BarChart3, bgColor: "#080b1e", accentColor: "#4ecdc4" },
  { id: "split-content", name: "Dividido", description: "Layout split two-tone", icon: SplitSquareVertical, bgColor: "#080b1e", accentColor: "#4ecdc4" },
  { id: "carousel-slide", name: "Carrossel", description: "Slide de carrossel", icon: GalleryHorizontal, bgColor: "#0c0f24", accentColor: "#4ecdc4" },
  { id: "editorial", name: "Editorial", description: "Artigo estilo editorial", icon: Newspaper, bgColor: "#0c0f24", accentColor: "#4ecdc4" },
  { id: "tweet-quote", name: "Tweet/Quote", description: "Card de tweet destacado", icon: MessageSquare, bgColor: "#0c0f24", accentColor: "#4ecdc4" },
  { id: "vitor-thread", name: "Thread", description: "Slide de thread numerada", icon: Hash, bgColor: "#080b1e", accentColor: "#6c5ce7" },
  { id: "vitor-quote", name: "Frase Autoral", description: "Frase com barra e autor", icon: Quote, bgColor: "#080b1e", accentColor: "#6c5ce7" },
  { id: "brand-hero", name: "Brand Hero", description: "Destaque de marca com gradiente", icon: Megaphone, bgColor: "#080b1e", accentColor: "#6c5ce7" },
  { id: "data-card", name: "Card de Dados", description: "Numeros e metricas em destaque", icon: TrendingUp, bgColor: "#080b1e", accentColor: "#4ecdc4" },
  { id: "list-tips", name: "Lista de Dicas", description: "Layout numerado tipo listicle", icon: List, bgColor: "#080b1e", accentColor: "#4ecdc4" },
  { id: "cta-action", name: "CTA / Acao", description: "Foco em conversao com botao", icon: MousePointerClick, bgColor: "#080b1e", accentColor: "#4ecdc4" },
];

/* ═══════════════════════════════════════════════════════════════════════════
   Source badge component
   ═══════════════════════════════════════════════════════════════════════════ */

function SourceBadge({ source }: { source: string }) {
  const config: Record<string, { label: string; icon: typeof PenTool; color: string }> = {
    manual: { label: "Manual", icon: PenTool, color: "#4ecdc4" },
    ai_chat: { label: "IA", icon: Sparkles, color: "#6c5ce7" },
    image_extraction: { label: "Imagem", icon: ImageIcon, color: "#f59e0b" },
    psd: { label: "PSD", icon: Layers, color: "#ec4899" },
    import: { label: "Importado", icon: Copy, color: "#3b82f6" },
    preset: { label: "Preset", icon: Layout, color: "#10b981" },
  };
  const c = config[source] || config.manual;
  const Icon = c.icon;

  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium"
      style={{ backgroundColor: `${c.color}15`, color: c.color }}
    >
      <Icon size={10} />
      {c.label}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Props
   ═══════════════════════════════════════════════════════════════════════════ */

interface TemplateGalleryProps {
  onSelect: (template: VisualTemplate) => void;
  onSelectPreset: (presetId: string) => void;
  onSelectPsd?: (template: PsdTemplate, slideIndex: number) => void;
  empresaId: string;
  aspectRatio?: "1:1" | "4:5" | "9:16";
  isOpen: boolean;
  onClose: () => void;
  brandTemplates?: VisualTemplateSummary[];
  onDuplicate?: (id: string) => void;
  onDelete?: (id: string) => void;
  onCreateFromImage?: () => void;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Filter types
   ═══════════════════════════════════════════════════════════════════════════ */

type FormatFilter = "todos" | "post" | "carousel" | "story";
type RatioFilter = "todos" | "1:1" | "4:5" | "9:16";

/* ═══════════════════════════════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════════════════════════════ */

export function TemplateGallery({
  onSelect,
  onSelectPreset,
  onSelectPsd,
  empresaId,
  aspectRatio,
  isOpen,
  onClose,
  brandTemplates = [],
  onDuplicate,
  onDelete,
  onCreateFromImage,
}: TemplateGalleryProps) {
  const [search, setSearch] = useState("");
  const [formatFilter, setFormatFilter] = useState<FormatFilter>("todos");
  const [ratioFilter, setRatioFilter] = useState<RatioFilter>("todos");
  const [hoveredPreset, setHoveredPreset] = useState<string | null>(null);

  // Generate real canvas previews for presets
  const presetPreviews = usePresetPreviews(
    isOpen ? ALL_PRESET_IDS : [],
    aspectRatio || "1:1"
  );
  const [hoveredBrand, setHoveredBrand] = useState<string | null>(null);
  const [loadingBrandId, setLoadingBrandId] = useState<string | null>(null);
  const [psdTemplates, setPsdTemplates] = useState<PsdTemplate[]>([]);
  const [hoveredPsd, setHoveredPsd] = useState<string | null>(null);
  const [psdSlideSelection, setPsdSlideSelection] = useState<Record<string, number>>({});

  // Fetch PSD templates
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    async function fetchPsd() {
      try {
        const res = await fetch("/api/psd-templates");
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setPsdTemplates(data);
      } catch {
        // silently fail
      }
    }
    fetchPsd();
    return () => { cancelled = true; };
  }, [isOpen]);

  // ── Filter presets by search ──
  const filteredPresets = useMemo(() => {
    if (!search) return PRESETS;
    const q = search.toLowerCase();
    return PRESETS.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q)
    );
  }, [search]);

  // ── Filter brand templates ──
  const filteredBrandTemplates = useMemo(() => {
    let result = brandTemplates;

    if (search) {
      const q = search.toLowerCase();
      result = result.filter((t) => t.name.toLowerCase().includes(q));
    }

    if (formatFilter !== "todos") {
      result = result.filter((t) => t.format === formatFilter);
    }

    if (ratioFilter !== "todos") {
      result = result.filter((t) => t.aspect_ratio === ratioFilter);
    }

    return result;
  }, [brandTemplates, search, formatFilter, ratioFilter]);

  // ── Filter PSD templates ──
  const filteredPsdTemplates = useMemo(() => {
    let result = psdTemplates;

    if (search) {
      const q = search.toLowerCase();
      result = result.filter((t) => t.name.toLowerCase().includes(q));
    }

    if (formatFilter !== "todos") {
      const formatMap: Record<string, string> = {
        post: "feed",
        carousel: "carousel",
        story: "story",
      };
      result = result.filter((t) => t.format === formatMap[formatFilter]);
    }

    return result;
  }, [psdTemplates, search, formatFilter]);

  const FORMAT_OPTIONS: { value: FormatFilter; label: string }[] = [
    { value: "todos", label: "Todos" },
    { value: "post", label: "Post" },
    { value: "carousel", label: "Carrossel" },
    { value: "story", label: "Story" },
  ];

  const RATIO_OPTIONS: { value: RatioFilter; label: string; icon: typeof Square }[] = [
    { value: "todos", label: "Todos", icon: Layout },
    { value: "1:1", label: "1:1", icon: Square },
    { value: "4:5", label: "4:5", icon: RectangleVertical },
    { value: "9:16", label: "9:16", icon: Smartphone },
  ];

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed inset-4 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-4xl md:max-h-[85vh] bg-[#0c0f24] rounded-2xl border border-white/[0.06] shadow-2xl z-50 flex flex-col overflow-hidden"
          >
            {/* ── Header ── */}
            <div className="flex items-center justify-between p-5 border-b border-white/[0.06]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#6c5ce7] to-[#4ecdc4] flex items-center justify-center">
                  <Layout size={18} className="text-white" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-[#e8eaff]">
                    Templates
                  </h2>
                  <p className="text-xs text-[#5e6388]">
                    Escolha um template para comecar
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
              >
                <X size={16} className="text-[#5e6388]" />
              </button>
            </div>

            {/* ── Filters bar ── */}
            <div className="px-5 py-3 border-b border-white/[0.06] space-y-3">
              {/* Search */}
              <div className="relative">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5e6388]"
                />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar template..."
                  className="w-full pl-9 pr-4 py-2 bg-[#141736] border border-white/[0.06] rounded-lg text-sm text-[#e8eaff] placeholder:text-[#5e6388] focus:outline-none focus:border-[#4ecdc4]/40 transition-colors"
                />
              </div>

              {/* Format + Ratio filters */}
              <div className="flex items-center gap-4">
                {/* Format */}
                <div className="flex items-center gap-1.5">
                  {FORMAT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setFormatFilter(opt.value)}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                        formatFilter === opt.value
                          ? "bg-[#4ecdc4]/15 text-[#4ecdc4]"
                          : "text-[#5e6388] hover:text-[#8b8fb8] hover:bg-white/5"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                <div className="w-px h-4 bg-white/[0.06]" />

                {/* Ratio */}
                <div className="flex items-center gap-1.5">
                  {RATIO_OPTIONS.map((opt) => {
                    const Icon = opt.icon;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => setRatioFilter(opt.value)}
                        className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-all ${
                          ratioFilter === opt.value
                            ? "bg-[#6c5ce7]/15 text-[#6c5ce7]"
                            : "text-[#5e6388] hover:text-[#8b8fb8] hover:bg-white/5"
                        }`}
                      >
                        <Icon size={12} />
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* ── Body (scrollable) ── */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
              {/* ── A) Preset Templates ── */}
              <section>
                <h3 className="text-xs font-semibold text-[#5e6388] uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Sparkles size={13} />
                  Templates prontos
                </h3>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {/* ── Create from Image card (always first) ── */}
                  <motion.button
                    onClick={() => onCreateFromImage?.()}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    className="group relative bg-[#141736] rounded-xl overflow-hidden border-2 border-dashed border-white/20 hover:border-[#4ecdc4]/50 cursor-pointer transition-all duration-200"
                  >
                    {/* Thumbnail area */}
                    <div className="aspect-square flex flex-col items-center justify-center gap-2 bg-[#080b1e]">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-[#4ecdc4]/10 group-hover:bg-[#4ecdc4]/20 transition-colors duration-200">
                        <Upload size={20} className="text-[#4ecdc4]" />
                      </div>
                    </div>

                    {/* Label */}
                    <div className="p-2.5">
                      <p className="text-[11px] font-semibold text-[#e8eaff] truncate">
                        Criar de Imagem
                      </p>
                      <p className="text-[10px] text-[#5e6388] truncate mt-0.5">
                        Faca upload de um post e a IA cria o template
                      </p>
                    </div>
                  </motion.button>

                  {filteredPresets.map((preset) => {
                    const Icon = preset.icon;
                    const isHovered = hoveredPreset === preset.id;
                    const previewUrl = presetPreviews.get(preset.id);

                    return (
                      <motion.button
                        key={preset.id}
                        onClick={() => onSelectPreset(preset.id)}
                        onMouseEnter={() => setHoveredPreset(preset.id)}
                        onMouseLeave={() => setHoveredPreset(null)}
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        className="group relative bg-[#141736] rounded-xl overflow-hidden hover:ring-2 hover:ring-[#4ecdc4]/50 cursor-pointer transition-all duration-200"
                      >
                        {/* Thumbnail area — real preview or icon fallback */}
                        {previewUrl ? (
                          <img
                            src={previewUrl}
                            alt={preset.name}
                            className="w-full aspect-square object-cover rounded-t-lg bg-[#080b1e]"
                          />
                        ) : (
                          <div
                            className="aspect-square flex flex-col items-center justify-center gap-2 relative"
                            style={{ backgroundColor: preset.bgColor }}
                          >
                            {/* Accent bar */}
                            <div
                              className="absolute top-0 left-0 right-0 h-1 opacity-80"
                              style={{ backgroundColor: preset.accentColor }}
                            />

                            {/* Icon */}
                            <div
                              className="w-10 h-10 rounded-lg flex items-center justify-center transition-transform duration-200"
                              style={{
                                backgroundColor: `${preset.accentColor}20`,
                                transform: isHovered ? "scale(1.1)" : "scale(1)",
                              }}
                            >
                              <Icon
                                size={20}
                                style={{ color: preset.accentColor }}
                              />
                            </div>

                            {/* Loading shimmer */}
                            <div className="flex flex-col items-center gap-1 px-4 w-full">
                              <div
                                className="h-2 rounded-full w-3/4 animate-pulse"
                                style={{
                                  backgroundColor:
                                    preset.bgColor === "#ffffff"
                                      ? "#1a1a2e"
                                      : "#e8eaff",
                                  opacity: 0.15,
                                }}
                              />
                              <div
                                className="h-1.5 rounded-full w-1/2 animate-pulse"
                                style={{
                                  backgroundColor:
                                    preset.bgColor === "#ffffff"
                                      ? "#1a1a2e"
                                      : "#e8eaff",
                                  opacity: 0.1,
                                }}
                              />
                            </div>
                          </div>
                        )}

                        {/* Label */}
                        <div className="p-2.5">
                          <p className="text-[11px] font-semibold text-[#e8eaff] truncate">
                            {preset.name}
                          </p>
                          <p className="text-[10px] text-[#5e6388] truncate mt-0.5">
                            {preset.description}
                          </p>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              </section>

              {/* ── B) PSD Brand Templates ── */}
              {filteredPsdTemplates.length > 0 && onSelectPsd && (
                <section>
                  <h3 className="text-xs font-semibold text-[#5e6388] uppercase tracking-wider mb-3 flex items-center gap-2">
                    <FileImage size={13} />
                    Templates da Marca ({filteredPsdTemplates.length})
                  </h3>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {filteredPsdTemplates.map((psd) => {
                      const isHovered = hoveredPsd === psd.id;
                      const selectedSlide = psdSlideSelection[psd.id] ?? 0;
                      const formatLabels: Record<string, string> = {
                        feed: "Feed",
                        story: "Story",
                        carousel: "Carrossel",
                      };

                      return (
                        <motion.div
                          key={psd.id}
                          onMouseEnter={() => setHoveredPsd(psd.id)}
                          onMouseLeave={() => setHoveredPsd(null)}
                          whileHover={{ scale: 1.03 }}
                          className="group relative bg-[#141736] rounded-xl overflow-hidden hover:ring-2 hover:ring-[#ec4899]/50 cursor-pointer transition-all duration-200"
                        >
                          {/* Thumbnail */}
                          <button
                            onClick={() => onSelectPsd(psd, selectedSlide)}
                            className="w-full"
                          >
                            <div className="aspect-square bg-[#080b1e] flex items-center justify-center overflow-hidden">
                              {psd.thumbnail ? (
                                <img
                                  src={psd.thumbnail}
                                  alt={psd.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <FileImage
                                  size={24}
                                  className="text-[#5e6388] opacity-40"
                                />
                              )}
                            </div>
                          </button>

                          {/* Info */}
                          <div className="p-2.5 space-y-1.5">
                            <p className="text-[11px] font-semibold text-[#e8eaff] truncate">
                              {psd.name}
                            </p>

                            <div className="flex items-center gap-1.5 flex-wrap">
                              <SourceBadge source="psd" />
                              <span
                                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium"
                                style={{ backgroundColor: "rgba(236,72,153,0.1)", color: "#ec4899" }}
                              >
                                {formatLabels[psd.format] || psd.format}
                                {psd.format === "carousel" && ` ${psd.slides}`}
                              </span>
                            </div>

                            {/* Color swatches */}
                            <div className="flex items-center gap-1">
                              {psd.colors.slice(0, 4).map((color, i) => (
                                <span
                                  key={i}
                                  className="w-3 h-3 rounded-full border border-white/10"
                                  style={{ backgroundColor: color }}
                                />
                              ))}
                              {psd.fonts.length > 0 && (
                                <span className="text-[9px] text-[#5e6388] ml-1 truncate">
                                  {psd.fonts[0].replace(/-/g, " ")}
                                </span>
                              )}
                            </div>

                            {/* Carousel slide selector */}
                            {psd.format === "carousel" && psd.slides > 1 && (
                              <div className="flex items-center gap-1 pt-0.5">
                                {Array.from({ length: psd.slides }, (_, i) => (
                                  <button
                                    key={i}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setPsdSlideSelection((prev) => ({
                                        ...prev,
                                        [psd.id]: i,
                                      }));
                                    }}
                                    className={`w-5 h-5 rounded text-[9px] font-medium transition-all ${
                                      selectedSlide === i
                                        ? "bg-[#ec4899]/20 text-[#ec4899] border border-[#ec4899]/40"
                                        : "bg-white/5 text-[#5e6388] border border-white/5 hover:bg-white/10"
                                    }`}
                                  >
                                    {i + 1}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* ── C) Brand Templates ── */}
              {brandTemplates.length > 0 && (
                <section>
                  <h3 className="text-xs font-semibold text-[#5e6388] uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Layers size={13} />
                    Meus templates ({filteredBrandTemplates.length})
                  </h3>

                  {filteredBrandTemplates.length === 0 ? (
                    <div className="py-8 text-center">
                      <p className="text-sm text-[#5e6388]">
                        Nenhum template encontrado com os filtros atuais.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {filteredBrandTemplates.map((tpl) => {
                        const isHovered = hoveredBrand === tpl.id;

                        return (
                          <motion.div
                            key={tpl.id}
                            onMouseEnter={() => setHoveredBrand(tpl.id)}
                            onMouseLeave={() => setHoveredBrand(null)}
                            whileHover={{ scale: 1.03 }}
                            className="group relative bg-[#141736] rounded-xl overflow-hidden hover:ring-2 hover:ring-[#4ecdc4]/50 cursor-pointer transition-all duration-200"
                          >
                            {/* Thumbnail */}
                            <button
                              onClick={async () => {
                                if (loadingBrandId) return;
                                setLoadingBrandId(tpl.id);
                                try {
                                  const res = await fetch(`/api/visual-templates/${tpl.id}`);
                                  if (!res.ok) throw new Error("Resposta inválida do servidor");
                                  const fullTemplate: VisualTemplate = await res.json();
                                  onSelect(fullTemplate);
                                } catch {
                                  alert("Erro ao carregar template. Tente novamente.");
                                } finally {
                                  setLoadingBrandId(null);
                                }
                              }}
                              disabled={loadingBrandId === tpl.id}
                              className="w-full relative"
                            >
                              <div className="aspect-square bg-[#080b1e] flex items-center justify-center">
                                {tpl.thumbnail_url ? (
                                  <img
                                    src={tpl.thumbnail_url}
                                    alt={tpl.name}
                                    className={`w-full h-full object-cover transition-opacity duration-200 ${loadingBrandId === tpl.id ? "opacity-40" : "opacity-100"}`}
                                  />
                                ) : (
                                  <Layout
                                    size={24}
                                    className="text-[#5e6388] opacity-40"
                                  />
                                )}
                                {loadingBrandId === tpl.id && (
                                  <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="w-6 h-6 border-2 border-[#4ecdc4] border-t-transparent rounded-full animate-spin" />
                                  </div>
                                )}
                              </div>
                            </button>

                            {/* Info */}
                            <div className="p-2.5 space-y-1">
                              <p className="text-[11px] font-semibold text-[#e8eaff] truncate">
                                {tpl.name}
                              </p>
                              <div className="flex items-center gap-1.5">
                                <SourceBadge source={tpl.source} />
                                <span className="text-[10px] text-[#5e6388]">
                                  {tpl.aspect_ratio}
                                </span>
                              </div>
                            </div>

                            {/* Hover actions */}
                            <AnimatePresence>
                              {isHovered && (onDuplicate || onDelete) && (
                                <motion.div
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  exit={{ opacity: 0 }}
                                  className="absolute top-2 right-2 flex items-center gap-1"
                                >
                                  {onDuplicate && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onDuplicate(tpl.id);
                                      }}
                                      className="w-7 h-7 rounded-md bg-black/60 backdrop-blur-sm flex items-center justify-center hover:bg-black/80 transition-colors"
                                      title="Duplicar"
                                    >
                                      <Copy
                                        size={13}
                                        className="text-[#e8eaff]"
                                      />
                                    </button>
                                  )}
                                  {onDelete && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onDelete(tpl.id);
                                      }}
                                      className="w-7 h-7 rounded-md bg-black/60 backdrop-blur-sm flex items-center justify-center hover:bg-red-900/60 transition-colors"
                                      title="Excluir"
                                    >
                                      <Trash2
                                        size={13}
                                        className="text-red-400"
                                      />
                                    </button>
                                  )}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </motion.div>
                        );
                      })}
                    </div>
                  )}
                </section>
              )}

              {/* Empty state when no brand templates */}
              {brandTemplates.length === 0 && (
                <section>
                  <div className="border border-dashed border-white/[0.08] rounded-xl p-6 text-center">
                    <Layers
                      size={28}
                      className="mx-auto text-[#5e6388] opacity-40 mb-2"
                    />
                    <p className="text-sm text-[#5e6388]">
                      Nenhum template personalizado ainda
                    </p>
                    <p className="text-xs text-[#5e6388]/60 mt-1">
                      Crie um design e salve como template para reutilizar
                    </p>
                  </div>
                </section>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
