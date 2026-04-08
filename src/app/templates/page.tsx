"use client";

import { useState, useEffect } from "react";
import { Layers, Image, Type, Loader2 } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface Template {
  id: string;
  name: string;
  format: "feed" | "story" | "carousel";
  slides: number;
  thumbnail: string;
  fonts: string[];
  colors: string[];
}

const formatLabel: Record<Template["format"], string> = {
  carousel: "Carrossel",
  story: "Story",
  feed: "Feed",
};

function FormatIcon({ format }: { format: Template["format"] }) {
  switch (format) {
    case "carousel":
      return <Layers className="w-3.5 h-3.5" />;
    case "story":
      return <Image className="w-3.5 h-3.5" />;
    case "feed":
      return <Image className="w-3.5 h-3.5" />;
  }
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTemplates() {
      try {
        const res = await fetch("/api/psd-templates");
        if (!res.ok) throw new Error("Erro ao carregar templates");
        const data = await res.json();
        setTemplates(data);
      } catch (err: any) {
        setError(err.message || "Erro desconhecido");
      } finally {
        setLoading(false);
      }
    }
    fetchTemplates();
  }, []);

  return (
    <div className="min-h-screen p-6 md:p-8 lg:p-10">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-text-primary mb-2">
          Templates da Marca
        </h1>
        <p className="text-text-secondary text-sm md:text-base max-w-2xl">
          Templates extraídos dos PSDs da marca. Edite os textos e gere posts
          novos mantendo a identidade visual.
        </p>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-accent animate-spin" />
          <span className="ml-3 text-text-secondary">
            Carregando templates...
          </span>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="rounded-xl border border-danger/30 bg-danger/10 p-6 text-center">
          <p className="text-danger">{error}</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && templates.length === 0 && (
        <div className="rounded-xl border border-border bg-bg-card p-12 text-center">
          <Layers className="w-10 h-10 text-text-muted mx-auto mb-3" />
          <p className="text-text-secondary">Nenhum template encontrado.</p>
        </div>
      )}

      {/* Grid */}
      {!loading && !error && templates.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {templates.map((tpl) => (
            <div
              key={tpl.id}
              className={cn(
                "group rounded-xl border border-border bg-bg-card",
                "hover:border-accent/40 hover:bg-bg-card-hover",
                "transition-all duration-200 overflow-hidden"
              )}
            >
              {/* Thumbnail */}
              <div className="relative aspect-square bg-bg-primary overflow-hidden">
                <img
                  src={tpl.thumbnail}
                  alt={tpl.name}
                  className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                />
                {/* Format badge */}
                <span
                  className={cn(
                    "absolute top-3 right-3 inline-flex items-center gap-1.5",
                    "px-2.5 py-1 rounded-full text-xs font-medium",
                    "bg-accent/20 text-accent backdrop-blur-sm"
                  )}
                >
                  <FormatIcon format={tpl.format} />
                  {formatLabel[tpl.format]}
                  {tpl.format === "carousel" && ` ${tpl.slides} slides`}
                </span>
              </div>

              {/* Info */}
              <div className="p-4">
                <h3 className="text-text-primary font-semibold text-sm mb-3 truncate">
                  {tpl.name}
                </h3>

                {/* Font pills */}
                {tpl.fonts.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {tpl.fonts.map((font) => (
                      <span
                        key={font}
                        className={cn(
                          "inline-flex items-center gap-1 px-2 py-0.5",
                          "rounded-md text-[11px] font-medium",
                          "bg-secondary/15 text-secondary-light"
                        )}
                      >
                        <Type className="w-3 h-3" />
                        {font}
                      </span>
                    ))}
                  </div>
                )}

                {/* Edit button */}
                <Link
                  href={`/templates/${tpl.id}`}
                  className={cn(
                    "block w-full text-center py-2 rounded-lg text-sm font-medium",
                    "bg-accent/15 text-accent",
                    "hover:bg-accent/25 transition-colors duration-150"
                  )}
                >
                  Editar
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
