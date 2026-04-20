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
      {/* Blob 1 — velký, pomalý, levá dolní */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 200% 160% at 20% 75%, rgba(255,255,255,0.22), transparent 58%)",
          animation: "smoke-a 24s ease-in-out infinite",
          animationDelay: delay1,
          willChange: "transform",
        }}
      />
      {/* Blob 2 — střední, pravá horní */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 160% 130% at 80% 25%, rgba(255,255,255,0.16), transparent 56%)",
          animation: "smoke-b 31s ease-in-out infinite",
          animationDelay: delay2,
          willChange: "transform",
        }}
      />
      {/* Blob 3 — středový tah */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 120% 90% at 55% 50%, rgba(255,255,255,0.10), transparent 55%)",
          animation: "smoke-a 19s ease-in-out infinite reverse",
          animationDelay: `${(seed * 1.6 + 2) % 7}s`,
          willChange: "transform",
        }}
      />
    </>
  );
}
