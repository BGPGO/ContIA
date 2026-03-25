"use client";

import { useState } from "react";
import {
  ImageIcon,
  Loader2,
  RefreshCw,
  Hash,
  X,
} from "lucide-react";
import type { WizardState } from "@/hooks/useCreationWizard";
import { PostCarouselPreview } from "@/components/criacao/PostPreview";

interface StepPreviewProps {
  state: WizardState;
  setField: <K extends keyof WizardState>(field: K, value: WizardState[K]) => void;
  setSlideImage: (idx: number, url: string) => void;
  setGeneratedImage: (url: string) => void;
  onRegenerate: () => void;
}

export function StepPreview({
  state,
  setField,
  setSlideImage,
  setGeneratedImage,
  onRegenerate,
}: StepPreviewProps) {
  const [generatingSlide, setGeneratingSlide] = useState<number | null>(null);
  const [generatingMain, setGeneratingMain] = useState(false);

  const generateSlideImage = async (slideIndex: number, prompt: string) => {
    setGeneratingSlide(slideIndex);
    try {
      const res = await fetch("/api/ai/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      if (!res.ok) throw new Error("Falha ao gerar imagem");
      const data = await res.json();
      setSlideImage(slideIndex, data.url);
    } catch {
      // silent fail
    } finally {
      setGeneratingSlide(null);
    }
  };

  const generateMainImage = async (prompt: string) => {
    setGeneratingMain(true);
    setField("generatingImage", true);
    try {
      const res = await fetch("/api/ai/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      if (!res.ok) throw new Error("Falha ao gerar imagem");
      const data = await res.json();
      setGeneratedImage(data.url);
    } catch {
      // silent fail
    } finally {
      setGeneratingMain(false);
      setField("generatingImage", false);
    }
  };

  const { result, visualSlides, visualMode } = state;

  // Visual mode with slides
  if (visualMode && visualSlides.length > 0) {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-semibold text-text-primary text-center">
          Preview do conteudo
        </h2>

        <div className="flex justify-center">
          <PostCarouselPreview slides={visualSlides} size="large" />
        </div>

        {/* Editable fields */}
        <div className="space-y-4 bg-bg-card border border-border rounded-xl p-5">
          <div className="space-y-2">
            <label className="text-xs font-medium text-text-muted uppercase tracking-wider">Legenda</label>
            <textarea
              value={state.visualLegenda}
              onChange={(e) => setField("visualLegenda", e.target.value)}
              rows={3}
              className="w-full bg-bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary resize-none focus:outline-none focus:border-accent/50 transition-colors"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-text-muted uppercase tracking-wider">Hashtags</label>
            <div className="flex flex-wrap gap-1.5">
              {state.visualHashtags.map((tag, i) => (
                <span
                  key={i}
                  className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-accent/10 text-accent-light"
                >
                  <Hash size={10} />
                  {tag.replace("#", "")}
                  <button
                    onClick={() =>
                      setField("visualHashtags", state.visualHashtags.filter((_, idx) => idx !== i))
                    }
                    className="hover:text-danger transition-colors"
                  >
                    <X size={10} />
                  </button>
                </span>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-text-muted uppercase tracking-wider">CTA</label>
            <input
              value={state.visualCta}
              onChange={(e) => setField("visualCta", e.target.value)}
              className="w-full bg-bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent/50 transition-colors"
            />
          </div>
        </div>

        {/* Slide image prompts */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-text-secondary">Imagens dos slides</h3>
          {visualSlides.map((slide: any, i: number) => (
            <div
              key={i}
              className="flex items-center gap-3 bg-bg-card border border-border rounded-xl p-3"
            >
              <span className="text-xs text-text-muted shrink-0">Slide {i + 1}</span>
              <p className="flex-1 text-xs text-text-secondary truncate">
                {slide.background?.image_prompt || "Sem prompt de imagem"}
              </p>
              {state.slideImages[i] ? (
                <img
                  src={state.slideImages[i]}
                  alt={`Slide ${i + 1}`}
                  className="w-10 h-10 rounded-lg object-cover"
                />
              ) : (
                <button
                  onClick={() =>
                    slide.background?.image_prompt &&
                    generateSlideImage(i, slide.background.image_prompt)
                  }
                  disabled={generatingSlide === i || !slide.background?.image_prompt}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-accent/10 text-accent-light hover:bg-accent/20 disabled:opacity-40 transition-all shrink-0"
                >
                  {generatingSlide === i ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <ImageIcon size={12} />
                  )}
                  Gerar
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="flex justify-center">
          <button
            onClick={onRegenerate}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-text-secondary hover:text-text-primary border border-border hover:border-border-light transition-all"
          >
            <RefreshCw size={14} />
            Regenerar
          </button>
        </div>
      </div>
    );
  }

  // Text mode
  if (!result) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <p className="text-text-muted text-sm">Nenhum conteudo gerado.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-text-primary text-center">
        Preview do conteudo
      </h2>

      <div className="bg-bg-card border border-border rounded-xl p-5 space-y-5">
        {/* Post */}
        {state.format === "post" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-text-muted uppercase tracking-wider">Titulo</label>
              <input
                value={result.titulo}
                onChange={(e) =>
                  setField("result", { ...result, titulo: e.target.value } as any)
                }
                className="w-full bg-bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary font-semibold focus:outline-none focus:border-accent/50 transition-colors"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-text-muted uppercase tracking-wider">Conteudo</label>
              <textarea
                value={result.conteudo}
                onChange={(e) =>
                  setField("result", { ...result, conteudo: e.target.value } as any)
                }
                rows={6}
                className="w-full bg-bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary resize-none focus:outline-none focus:border-accent/50 transition-colors"
              />
            </div>
          </div>
        )}

        {/* Carrossel */}
        {state.format === "carrossel" && result.slides && (
          <div className="space-y-4">
            <label className="text-xs font-medium text-text-muted uppercase tracking-wider">Slides</label>
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none" style={{ scrollbarWidth: "none" }}>
              {result.slides.map((slide, i) => (
                <div
                  key={i}
                  className="shrink-0 w-56 bg-bg-input border border-border rounded-xl p-4 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-text-muted">SLIDE {slide.slideNumber}</span>
                  </div>
                  <h4 className="text-sm font-semibold text-text-primary">{slide.titulo}</h4>
                  <p className="text-xs text-text-secondary leading-relaxed">{slide.conteudo}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Reels */}
        {state.format === "reels" && result.reelsScript && (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-text-muted uppercase tracking-wider">Hook</label>
              <p className="text-sm text-text-primary font-medium bg-bg-input border border-border rounded-lg px-3 py-2.5">
                {result.reelsScript.hook}
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-text-muted uppercase tracking-wider">Roteiro</label>
              <ol className="space-y-2">
                {result.reelsScript.corpo.map((step, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                    <span className="shrink-0 w-5 h-5 rounded-full bg-accent/10 text-accent-light text-[10px] font-bold flex items-center justify-center mt-0.5">
                      {i + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-text-muted uppercase tracking-wider">Duracao</label>
                <p className="text-sm text-text-secondary">{result.reelsScript.duracao}</p>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-text-muted uppercase tracking-wider">Musica sugerida</label>
                <p className="text-sm text-text-secondary">{result.reelsScript.musica_sugerida}</p>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-text-muted uppercase tracking-wider">CTA</label>
              <p className="text-sm text-text-primary">{result.reelsScript.cta}</p>
            </div>
          </div>
        )}

        {/* Email */}
        {state.format === "email" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-text-muted uppercase tracking-wider">Assunto</label>
              <p className="text-sm text-text-primary font-semibold bg-bg-input border border-border rounded-lg px-3 py-2.5">
                {result.emailSubject}
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-text-muted uppercase tracking-wider">Corpo</label>
              <div
                className="text-sm text-text-secondary bg-bg-input border border-border rounded-lg px-4 py-3 prose prose-invert prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: result.emailBody || result.conteudo }}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-text-muted uppercase tracking-wider">CTA</label>
              <p className="text-sm text-accent-light font-medium">{result.cta}</p>
            </div>
          </div>
        )}

        {/* Copy */}
        {state.format === "copy" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-text-muted uppercase tracking-wider">Headline</label>
              <p className="text-lg font-bold text-text-primary">{result.titulo}</p>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-text-muted uppercase tracking-wider">Corpo</label>
              <textarea
                value={result.conteudo}
                onChange={(e) =>
                  setField("result", { ...result, conteudo: e.target.value } as any)
                }
                rows={5}
                className="w-full bg-bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary resize-none focus:outline-none focus:border-accent/50 transition-colors"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-text-muted uppercase tracking-wider">CTA</label>
              <p className="text-sm text-accent-light font-semibold">{result.cta}</p>
            </div>
          </div>
        )}

        {/* Hashtags (for post/carrossel/copy) */}
        {result.hashtags.length > 0 && (
          <div className="space-y-2">
            <label className="text-xs font-medium text-text-muted uppercase tracking-wider">Hashtags</label>
            <div className="flex flex-wrap gap-1.5">
              {result.hashtags.map((tag, i) => (
                <span
                  key={i}
                  className="text-xs px-2.5 py-1 rounded-full bg-accent/10 text-accent-light"
                >
                  #{tag.replace("#", "")}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Image generation */}
      {result.imagePrompt && (
        <div className="bg-bg-card border border-border rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-text-secondary">Imagem</h3>
          <p className="text-xs text-text-muted">{result.imagePrompt}</p>

          {state.generatedImageUrl ? (
            <img
              src={state.generatedImageUrl}
              alt="Generated"
              className="w-full max-w-md rounded-xl border border-border"
            />
          ) : (
            <button
              onClick={() => generateMainImage(result.imagePrompt)}
              disabled={generatingMain}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-accent/10 text-accent-light hover:bg-accent/20 disabled:opacity-40 transition-all"
            >
              {generatingMain ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <ImageIcon size={14} />
              )}
              Gerar Imagem
            </button>
          )}
        </div>
      )}

      <div className="flex justify-center">
        <button
          onClick={onRegenerate}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-text-secondary hover:text-text-primary border border-border hover:border-border-light transition-all"
        >
          <RefreshCw size={14} />
          Regenerar
        </button>
      </div>
    </div>
  );
}
