'use client';

import React from 'react';
import type { CaptionStyle, WordTimestamp, Keyword } from '@/types/captions';
import { CAPTION_CATEGORIES } from '@/types/captions';
import { CaptionPreview } from './CaptionPreview';

interface CaptionStyleGalleryProps {
  styles: CaptionStyle[];
  selectedId: string | null;
  onSelect: (style: CaptionStyle) => void;
  previewVideoUrl?: string;
  previewWords?: WordTimestamp[];
  previewKeywords?: Keyword[];
}

export const CaptionStyleGallery: React.FC<CaptionStyleGalleryProps> = ({
  styles,
  selectedId,
  onSelect,
  previewVideoUrl,
  previewWords,
  previewKeywords,
}) => {
  if (styles.length === 0) {
    return (
      <div className="text-sm text-zinc-500 py-4">
        Nenhum estilo disponível.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {styles.map(style => {
        const isSelected = style.id === selectedId;
        return (
          <button
            key={style.id}
            type="button"
            onClick={() => onSelect(style)}
            className={`group relative rounded-xl border bg-zinc-900 p-3 text-left cursor-pointer transition ${
              isSelected
                ? 'ring-2 ring-yellow-400 border-transparent'
                : 'border-white/10 hover:border-white/30'
            }`}
          >
            <div className="flex justify-center">
              <CaptionPreview
                style={style}
                videoUrl={previewVideoUrl}
                words={previewWords}
                keywords={previewKeywords}
                width={220}
                loop
              />
            </div>

            <div className="mt-3">
              <div className="flex items-center justify-between">
                <span className="text-white font-semibold text-sm">{style.name}</span>
                <span className="text-[10px] uppercase tracking-wide text-zinc-400">
                  {CAPTION_CATEGORIES[style.category]}
                </span>
              </div>
              {style.description && (
                <p className="text-xs text-zinc-500 mt-1 line-clamp-2">
                  {style.description}
                </p>
              )}
            </div>

            {!isSelected && (
              <div className="absolute inset-0 rounded-xl bg-black/0 group-hover:bg-black/30 transition flex items-center justify-center opacity-0 group-hover:opacity-100">
                <span className="bg-yellow-400 text-black text-xs font-bold px-3 py-1.5 rounded-full">
                  Usar este estilo
                </span>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
};
