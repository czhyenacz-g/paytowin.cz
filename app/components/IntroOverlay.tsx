"use client";

import React from "react";

interface Props {
  year: number;
  place: string;
  subtitle: string;
  /** Pokud true: zobrazí "Načítám hru…" a nespouští auto-dismiss timer. */
  isLoading?: boolean;
  onDone: () => void;
}

const VISIBLE_MS = 6000;
const FADE_MS = 700;

export default function IntroOverlay({ year, place, subtitle, isLoading = false, onDone }: Props) {
  const [fading, setFading] = React.useState(false);
  const doneRef = React.useRef(false);

  const dismiss = React.useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    setFading(true);
    setTimeout(onDone, FADE_MS);
  }, [onDone]);

  // Auto-dismiss timer — startuje jen po dokončení načítání
  React.useEffect(() => {
    if (isLoading) return;
    const t = setTimeout(dismiss, VISIBLE_MS);
    return () => clearTimeout(t);
  }, [isLoading, dismiss]);

  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center"
      style={{
        background: "rgba(0,0,0,0.80)",
        backdropFilter: "blur(6px)",
        opacity: fading ? 0 : 1,
        transition: `opacity ${FADE_MS}ms ease-out`,
        zIndex: 9999,
      }}
    >
      <div className="text-center space-y-3 px-6">
        {isLoading ? (
          <>
            <div className="text-slate-400 text-sm font-semibold uppercase tracking-[0.22em] animate-pulse">
              Načítám hru…
            </div>
          </>
        ) : (
          <>
            <div className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">
              {place}
            </div>
            <div className="text-8xl font-black tracking-tight text-white" style={{ fontVariantNumeric: "tabular-nums" }}>
              {year}
            </div>
            <div className="text-base text-slate-300 max-w-xs mx-auto leading-relaxed">
              {subtitle}
            </div>
            <button
              onClick={dismiss}
              className="mt-4 rounded-2xl bg-white/10 border border-white/20 px-6 py-2.5 text-sm font-semibold text-white hover:bg-white/20 transition"
            >
              Začít hru →
            </button>
          </>
        )}
      </div>
    </div>
  );
}
