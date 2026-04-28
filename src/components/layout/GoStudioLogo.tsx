"use client";

/**
 * Logo GO Studio — quadrado arredondado com gradient teal→purple,
 * monograma "GO" e um spark dourado no canto.
 *
 * Uso:
 *   <GoStudioLogo className="w-8 h-8" />
 *   <GoStudioLogo className="w-7 h-7" withSpark={false} />
 */

interface GoStudioLogoProps {
  className?: string;
  /** Spark dourado no canto superior direito (default true) */
  withSpark?: boolean;
  /** Drop-shadow externo ao redor do quadrado (default true) */
  withShadow?: boolean;
  /** ID único do gradient pra evitar colisão quando múltiplas instâncias renderizam */
  idSuffix?: string;
}

export function GoStudioLogo({
  className = "w-8 h-8",
  withSpark = true,
  withShadow = true,
  idSuffix = "default",
}: GoStudioLogoProps) {
  const gradId = `goLogoGrad-${idSuffix}`;
  const highlightId = `goLogoHighlight-${idSuffix}`;
  const sparkGradId = `goSparkGrad-${idSuffix}`;

  return (
    <svg
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={
        withShadow
          ? { filter: "drop-shadow(0 4px 12px rgba(78, 205, 196, 0.25))" }
          : undefined
      }
      aria-label="GO Studio"
      role="img"
    >
      <defs>
        {/* Gradient principal teal→purple */}
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4ecdc4" />
          <stop offset="100%" stopColor="#6c5ce7" />
        </linearGradient>

        {/* Highlight diagonal pra dar volume */}
        <linearGradient id={highlightId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.22" />
          <stop offset="55%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>

        {/* Spark dourado radial */}
        <radialGradient id={sparkGradId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fde68a" />
          <stop offset="55%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#f59e0b" />
        </radialGradient>
      </defs>

      {/* Background rounded-square */}
      <rect width="64" height="64" rx="14" fill={`url(#${gradId})`} />

      {/* Highlight overlay */}
      <rect width="64" height="64" rx="14" fill={`url(#${highlightId})`} />

      {/* Monograma "GO" — usa font system pra renderizar em qualquer ambiente */}
      <text
        x="32"
        y="44"
        textAnchor="middle"
        fontFamily="ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Plus Jakarta Sans', sans-serif"
        fontSize="30"
        fontWeight="800"
        letterSpacing="-2"
        fill="white"
      >
        GO
      </text>

      {/* Spark dourado no canto superior direito */}
      {withSpark && (
        <>
          {/* Halo */}
          <circle cx="51" cy="13" r="7" fill={`url(#${sparkGradId})`} opacity="0.32" />
          {/* Núcleo */}
          <circle cx="51" cy="13" r="3.2" fill={`url(#${sparkGradId})`} />
          {/* Cross sparkle */}
          <path
            d="M 51 7.5 L 51 18.5 M 45.5 13 L 56.5 13"
            stroke="#fef3c7"
            strokeWidth="1"
            strokeLinecap="round"
            opacity="0.7"
          />
        </>
      )}
    </svg>
  );
}
