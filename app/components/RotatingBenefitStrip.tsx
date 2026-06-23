"use client";

import React from "react";

interface BenefitItem {
  label?: string;
  text: string;
  ctaLabel?: string;
  ctaHref?: string;
}

const REGULAR_BENEFITS: BenefitItem[] = [
  { text: "Deskovka, kterou nemusíš tahat s sebou." },
  { text: "Pošli odkaz a hrajte. Bez instalace." },
  { text: "Jedna partie může trvat klidně jen 20 minut." },
  { text: "Začni na počítači, pokračuj z mobilu." },
  { text: "Škodolibost starých deskovek bez celého odpoledne u stolu." },
  { text: "Když odejdeš od počítače, nemusíš odejít ze hry." },
];

const QUICK_GAME_ITEM: BenefitItem = {
  label: "RYCHLÁ HRA",
  text: "Zahraj si proti botům bez registrace.",
  ctaLabel: "Spustit →",
  ctaHref: "/quickgame",
};

// Quick game je první, pak střídá s benefity: quickgame, benefit, quickgame, benefit, …
const BENEFITS: BenefitItem[] = REGULAR_BENEFITS.flatMap(b => [QUICK_GAME_ITEM, b]);

const INTERVAL_MS = 6000;

interface Props {
  /** "amber" = styl /o-nas (výchozí), "slate" = styl titulní strany */
  variant?: "amber" | "slate";
}

export default function RotatingBenefitStrip({ variant = "amber" }: Props) {
  const [index, setIndex] = React.useState(0);
  const [visible, setVisible] = React.useState(true);
  const [paused, setPaused] = React.useState(false);

  React.useEffect(() => {
    if (paused) return;
    const timer = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIndex(i => (i + 1) % BENEFITS.length);
        setVisible(true);
      }, 300);
    }, INTERVAL_MS);
    return () => clearInterval(timer);
  }, [paused]);

  const item = BENEFITS[index];

  if (variant === "slate") {
    return (
      <div
        className="flex items-center gap-2 rounded-2xl border border-slate-700/60 bg-slate-800/30 px-3 py-2"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={() => setPaused(false)}
      >
        <span className="shrink-0 text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">
          {item.label ?? "Proč hrát?"}
        </span>
        <span
          className="min-w-0 flex-1 text-xs font-medium text-slate-200 transition-opacity duration-300"
          style={{ opacity: visible ? 1 : 0 }}
        >
          {item.text}
        </span>
        {item.ctaHref && item.ctaLabel && (
          <a
            href={item.ctaHref}
            className="flex-1 rounded-lg bg-amber-600 px-4 py-1 text-center text-[11px] font-bold text-white transition hover:bg-amber-500"
            style={{ opacity: visible ? 1 : 0 }}
          >
            {item.ctaLabel}
          </a>
        )}
      </div>
    );
  }

  return (
    <div
      className="rounded-[28px] border border-amber-200/15 bg-[#15110e]/92 px-5 py-4 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-sm"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="text-[11px] font-black uppercase tracking-[0.28em] text-amber-200/80 mb-2">
        {item.label ? item.label : "Proč hrát StartovníPole.cz?"}
      </div>
      <p
        className="text-sm font-medium text-stone-200 leading-snug min-h-[1.25rem] transition-opacity duration-300"
        style={{ opacity: visible ? 1 : 0 }}
      >
        {item.text}
        {item.ctaHref && item.ctaLabel && (
          <a
            href={item.ctaHref}
            className="ml-2 inline-block rounded-md bg-amber-600 px-2 py-0.5 text-xs font-bold text-white transition hover:bg-amber-500"
          >
            {item.ctaLabel}
          </a>
        )}
      </p>
    </div>
  );
}
