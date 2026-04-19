"use client";

import React from "react";

interface Props {
  year: number;
  place: string;
  subtitle: string;
  onDone: () => void;
}

const VISIBLE_MS = 2800;
const FADE_MS = 700;

export default function IntroOverlay({ year, place, subtitle, onDone }: Props) {
  const [fading, setFading] = React.useState(false);

  React.useEffect(() => {
    const t1 = setTimeout(() => setFading(true), VISIBLE_MS);
    const t2 = setTimeout(onDone, VISIBLE_MS + FADE_MS);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="pointer-events-none fixed inset-0 z-50 flex flex-col items-center justify-center"
      style={{
        background: "rgba(0,0,0,0.80)",
        backdropFilter: "blur(6px)",
        opacity: fading ? 0 : 1,
        transition: `opacity ${FADE_MS}ms ease-out`,
      }}
    >
      <div className="text-center space-y-3 px-6">
        <div className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">
          {place}
        </div>
        <div className="text-8xl font-black tracking-tight text-white" style={{ fontVariantNumeric: "tabular-nums" }}>
          {year}
        </div>
        <div className="text-base text-slate-300 max-w-xs mx-auto leading-relaxed">
          {subtitle}
        </div>
      </div>
    </div>
  );
}
