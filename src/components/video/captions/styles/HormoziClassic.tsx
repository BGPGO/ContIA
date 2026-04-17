'use client';

import React, { useMemo } from 'react';
import type { StyleProps } from '@/lib/captions/registry';
import { spring, interpolate } from '@/lib/captions/animations';

export const HormoziClassic: React.FC<StyleProps> = ({ word, isActive, isKeyword, style, currentSec }) => {
  const framesSinceActive = isActive ? Math.max(0, Math.floor((currentSec - word.start) * 60)) : 0;
  const progress = isActive ? spring(framesSinceActive, 60, { damping: 12, stiffness: 180 }) : 0;

  const scale = isActive ? interpolate(progress, [0, 1], [0.85, 1], { extrapolate: 'clamp' }) : 1;
  const translateY = isActive ? interpolate(progress, [0, 1], [8, 0], { extrapolate: 'clamp' }) : 0;
  const opacity = isActive ? interpolate(progress, [0, 0.3], [0, 1], { extrapolate: 'clamp' }) : 0.9;

  const color = isKeyword ? style.color_keyword : style.color_base;
  const displayText = useMemo(() => word.word.toUpperCase(), [word.word]);

  return (
    <span
      style={{
        display: 'inline-block',
        fontFamily: `'${style.font_family}', 'Montserrat', system-ui, sans-serif`,
        fontWeight: style.font_weight,
        fontSize: '48px',
        lineHeight: 1.05,
        color,
        WebkitTextStroke: `${style.stroke_width}px ${style.color_stroke ?? '#000'}`,
        paintOrder: 'stroke fill',
        textShadow: '0 2px 0 rgba(0,0,0,0.4)',
        transform: `translateY(${translateY}px) scale(${scale})`,
        opacity,
        margin: '0 6px',
      }}
    >
      {displayText}
    </span>
  );
};
