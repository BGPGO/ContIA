'use client';

import React, { useMemo } from 'react';
import type { StyleProps } from '@/lib/captions/registry';

export const MrBeast: React.FC<StyleProps> = ({ word, isActive, isKeyword, style, currentSec }) => {
  const framesSinceActive = isActive ? Math.max(0, (currentSec - word.start) * 60) : 0;
  const pulse = isActive ? Math.sin(framesSinceActive / 8) * 0.5 + 0.5 : 0;
  const glowBlur = 6 + pulse * 14;

  const color = isKeyword ? style.color_keyword : style.color_base;
  const keywordScale = isKeyword && style.keyword_emphasis === 'supersize' ? style.supersize_multiplier : 1;

  const displayText = useMemo(() => word.word.toUpperCase(), [word.word]);

  return (
    <span
      style={{
        display: 'inline-block',
        fontFamily: `'${style.font_family}', 'Bangers', 'Komika', 'Impact', sans-serif`,
        fontWeight: style.font_weight,
        fontSize: '52px',
        lineHeight: 1.1,
        letterSpacing: '0.03em',
        color,
        WebkitTextStroke: `${style.stroke_width}px ${style.color_stroke ?? '#000'}`,
        paintOrder: 'stroke fill',
        textShadow: isActive && isKeyword
          ? `0 0 ${glowBlur}px ${style.color_keyword}, 0 0 ${glowBlur * 0.6}px ${style.color_keyword}`
          : '0 4px 0 rgba(0,0,0,0.6)',
        transform: `scale(${keywordScale})`,
        opacity: isActive ? 1 : 0.92,
        margin: '0 8px',
      }}
    >
      {displayText}
    </span>
  );
};
