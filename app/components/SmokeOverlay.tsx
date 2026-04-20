"use client";

/**
 * SmokeOverlay — jemný mlhový/noir haze efekt pro menu panely.
 *
 * Dvě radial-gradient vrstvy s pomalým CSS drift animacemi.
 * pointer-events: none — neblokuje klikání.
 * Fázový offset via `seed` — každý panel má jiný timing.
 */

interface Props {
  /** Index panelu — použit jako fázový offset animací. */
  seed?: number;
}

export default function SmokeOverlay({ seed = 0 }: Props) {
  const delay1 = `${(seed * 3.7) % 9}s`;
  const delay2 = `${(seed * 2.9 + 5) % 11}s`;

  return (
    <>
      {/* Blob 1 — větší, pomalejší, levá polovina */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 170% 130% at 25% 65%, rgba(255,255,255,0.09), transparent 62%)",
          animation: "smoke-a 24s ease-in-out infinite",
          animationDelay: delay1,
          willChange: "transform",
        }}
      />
      {/* Blob 2 — menší, rychlejší, pravá horní */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 130% 110% at 78% 28%, rgba(255,255,255,0.06), transparent 60%)",
          animation: "smoke-b 31s ease-in-out infinite",
          animationDelay: delay2,
          willChange: "transform",
        }}
      />
    </>
  );
}
