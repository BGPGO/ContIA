'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import type { CaptionStyle, WordTimestamp, Keyword } from '@/types/captions';
import { getStyleComponent } from '@/lib/captions/registry';

const DEMO_PHRASE = ['Isso', 'vai', 'mudar', 'tudo', 'para', 'sempre', 'agora', 'mesmo'];
const DEMO_KEYWORDS: Keyword[] = [
  { word: 'mudar', importance: 2 },
  { word: 'sempre', importance: 2 },
];

interface CaptionPreviewProps {
  videoUrl?: string;
  words?: WordTimestamp[];
  keywords?: Keyword[];
  style: CaptionStyle;
  loop?: boolean;
  width?: number;
  startTime?: number;
  durationSeconds?: number;
}

export const CaptionPreview: React.FC<CaptionPreviewProps> = ({
  videoUrl,
  words,
  keywords,
  style,
  loop = true,
  width = 270,
  startTime = 0,
  durationSeconds = 2.5,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const startTsRef = useRef<number | null>(null);
  const [currentSec, setCurrentSec] = useState(0);

  const effectiveWords: WordTimestamp[] = useMemo(() => {
    if (words && words.length > 0) return words;
    const per = durationSeconds / DEMO_PHRASE.length;
    return DEMO_PHRASE.map((w, i) => ({
      word: w,
      start: i * per,
      end: (i + 1) * per,
    }));
  }, [words, durationSeconds]);

  const effectiveKeywords = keywords && keywords.length > 0 ? keywords : DEMO_KEYWORDS;

  useEffect(() => {
    const tick = (ts: number) => {
      if (startTsRef.current == null) startTsRef.current = ts;
      const elapsed = (ts - startTsRef.current) / 1000;
      const t = loop ? elapsed % durationSeconds : Math.min(elapsed, durationSeconds);
      setCurrentSec(t);

      if (videoRef.current && videoUrl) {
        try { videoRef.current.currentTime = startTime + t; } catch { /* ignore */ }
      }

      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      startTsRef.current = null;
    };
  }, [loop, durationSeconds, videoUrl, startTime]);

  const height = Math.round((width * 16) / 9);
  const StyleComp = getStyleComponent(style.slug);

  const positionStyle: React.CSSProperties =
    style.position === 'top' ? { top: '8%' }
    : style.position === 'upper-third' ? { top: '22%' }
    : style.position === 'center' ? { top: '50%', transform: 'translate(-50%, -50%)', left: '50%' }
    : style.position === 'lower-third' ? { bottom: '22%' }
    : { bottom: '8%' };

  const keywordSet = useMemo(
    () => new Set(effectiveKeywords.map(k => k.word.toLowerCase())),
    [effectiveKeywords]
  );

  return (
    <div
      style={{
        width,
        height,
        position: 'relative',
        background: videoUrl ? '#000' : 'linear-gradient(180deg,#1a1a1a,#333)',
        borderRadius: 12,
        overflow: 'hidden',
      }}
    >
      {videoUrl ? (
        <video
          ref={videoRef}
          src={videoUrl}
          muted
          playsInline
          autoPlay
          loop={loop}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#555',
            fontSize: 12,
          }}
        >
          preview
        </div>
      )}

      <div
        style={{
          position: 'absolute',
          left: style.position === 'center' ? undefined : 0,
          right: style.position === 'center' ? undefined : 0,
          textAlign: 'center',
          padding: '0 12px',
          pointerEvents: 'none',
          ...positionStyle,
        }}
      >
        {effectiveWords
          .filter(w => currentSec >= w.start - 0.05 && currentSec <= w.end + 0.4)
          .map((w, idx) => {
            const isActive = currentSec >= w.start && currentSec <= w.end;
            const isKeyword = keywordSet.has(w.word.toLowerCase());
            const keyword = effectiveKeywords.find(
              k => k.word.toLowerCase() === w.word.toLowerCase()
            );
            return (
              <StyleComp
                key={`${w.word}-${idx}-${w.start}`}
                word={w}
                isActive={isActive}
                isKeyword={isKeyword}
                keyword={keyword}
                style={style}
                currentSec={currentSec}
              />
            );
          })}
      </div>
    </div>
  );
};
