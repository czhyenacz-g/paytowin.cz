"use client";

import React from "react";

const BENEFITS = [
  "Deskovka, kterou nemusíš tahat s sebou.",
  "Pošli odkaz a hrajte. Bez instalace.",
  "Jedna partie může trvat klidně jen 20 minut.",
  "Začni na počítači, pokračuj z mobilu.",
  "Škodolibost starých deskovek bez celého odpoledne u stolu.",
  "Když odejdeš od počítače, nemusíš odejít ze hry.",
];

const INTERVAL_MS = 5000;

interface Props {
  /** "amber" = styl /o-nas (výchozí), "slate" = styl titulní strany */
  variant?: "amber" | "slate";
}

export default function RotatingBenefitStrip({ variant = "amber" }: Props) {
  const [index, setIndex] = React.useState(0);
  const [visible, setVisible] = React.useState(true);

  React.useEffect(() => {
    const timer = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIndex(i => (i + 1) % BENEFITS.length);
        setVisible(true);
      }, 350);
    }, INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  if (variant === "slate") {
    return (
      <div className="rounded-2xl border border-slate-700/60 bg-slate-800/30 px-3 py-2.5">
        <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400 mr-2">
          Proč hrát?
        </span>
        <span
          className="text-xs font-medium text-slate-200 transition-opacity duration-300"
          style={{ opacity: visible ? 1 : 0 }}
        >
          {BENEFITS[index]}
        </span>
      </div>
    );
  }

  return (
    <div className="rounded-[28px] border border-amber-200/15 bg-[#15110e]/92 px-5 py-4 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-sm">
      <div className="text-[11px] font-black uppercase tracking-[0.28em] text-amber-200/80 mb-2">
        Proč hrát PayToWin?
      </div>
      <p
        className="text-sm font-medium text-stone-200 leading-snug min-h-[1.25rem] transition-opacity duration-300"
        style={{ opacity: visible ? 1 : 0 }}
      >
        {BENEFITS[index]}
      </p>
    </div>
  );
}
