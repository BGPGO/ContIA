"use client";

/**
 * Logo GO Studio — minimalista e moderna.
 *
 * Composição:
 *  - Quadrado preto carbono com border-radius pequeno (referência: Vercel/Linear)
 *  - Monograma "G" desenhado em path SVG (anel aberto + traço interno),
 *    branco puro, stroke uniforme com cantos arredondados sutis
 *  - Detalhe accent: pequeno underline em gradient teal→purple bem discreto,
 *    apenas como hint cromático (não dominante)
 *
 * Uso:
 *   <GoStudioLogo className="w-9 h-9" />
 *   <GoStudioLogo className="w-7 h-7" idSuffix="mobile" />
 */

interface GoStudioLogoProps {
  className?: string;
  /** Drop-shadow externo (default false — moderna fica mais flat) */
  withShadow?: boolean;
  /** ID único do gradient pra evitar colisão entre múltiplas instâncias */
  idSuffix?: string;
}

export function GoStudioLogo({
  className = "w-8 h-8",
  withShadow = false,
  idSuffix = "default",
}: GoStudioLogoProps) {
  const accentGradId = `goAccentGrad-${idSuffix}`;

  return (
    <svg
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={
        withShadow
          ? { filter: "drop-shadow(0 2px 8px rgba(0, 0, 0, 0.25))" }
          : undefined
      }
      aria-label="GO Studio"
      role="img"
    >
      <defs>
        <linearGradient id={accentGradId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#4ecdc4" />
          <stop offset="100%" stopColor="#6c5ce7" />
        </linearGradient>
      </defs>

      {/* Background quadrado preto carbono, border-radius pequeno */}
      <rect width="64" height="64" rx="10" fill="#0a0a0a" />

      {/*
        Monograma "G" desenhado em path:
        - Anel aberto à direita (arc de ~330°, sweep=0 indo anti-horário)
        - Traço interno horizontal curto (a "perninha" do G)
        Centro: (32, 32). Raio: 17.5. Stroke: 5.5.
        Pontos da abertura: 30° acima e abaixo da horizontal direita.
      */}
      <path
        d="
          M 47.16 23.25
          A 17.5 17.5 0 1 0 47.16 40.75
          L 38.5 40.75
          L 38.5 36
        "
        fill="none"
        stroke="white"
        strokeWidth="5.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Underline accent gradient — hint de cor, bem discreto */}
      <rect
        x="14"
        y="51"
        width="36"
        height="2.5"
        rx="1.25"
        fill={`url(#${accentGradId})`}
      />
    </svg>
  );
}
