'use client';

import React, { useMemo } from 'react';
import type { StyleProps } from '@/lib/captions/registry';
import { interpolate } from '@/lib/captions/animations';

export const AliMinimal: React.FC<StyleProps> = ({ word, isActive, isKeyword, style, currentSec }) => {
  const timeSinceActive = isActive ? (currentSec - word.start) : 0;
  const opacity = isActive
    ? interpolate(timeSinceActive, [0, 0.15], [0, 1], { extrapolate: 'clamp' })
    : 0.35;

  const color = isKeyword ? style.color_keyword : style.color_base;

  const displayText = useMemo(() => {
    const w = word.word;
    return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  }, [word.word]);

  return (
    <span
      style={{
        display: 'inline-block',
        fontFamily: `'${style.font_family}', 'Inter', system-ui, sans-serif`,
        fontWeight: style.font_weight,
        fontSize: '32px',
        lineHeight: 1.25,
        color,
        opacity,
        textShadow: '0 2px 8px rgba(0,0,0,0.6)',
        margin: '0 5px',
        transition: 'opacity 120ms linear',
      }}
    >
      {displayText}
    </span>
  );
};
