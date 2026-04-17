'use client';

import React, { useMemo } from 'react';
import type { StyleProps } from '@/lib/captions/registry';

export const KaraokeClassic: React.FC<StyleProps> = ({ word, isActive, isKeyword, style }) => {
  const color = isActive
    ? style.color_keyword
    : (isKeyword ? style.color_keyword : style.color_base);

  const displayText = useMemo(() => word.word.toUpperCase(), [word.word]);

  return (
    <span
      style={{
        display: 'inline-block',
        fontFamily: `'${style.font_family}', 'Bebas Neue', 'Impact', sans-serif`,
        fontWeight: style.font_weight,
        fontSize: '42px',
        lineHeight: 1.1,
        letterSpacing: '0.05em',
        color,
        WebkitTextStroke: `${style.stroke_width}px ${style.color_stroke ?? '#000'}`,
        paintOrder: 'stroke fill',
        textShadow: '0 2px 0 rgba(0,0,0,0.5)',
        margin: '0 6px',
        transition: 'color 80ms linear',
      }}
    >
      {displayText}
    </span>
  );
};
