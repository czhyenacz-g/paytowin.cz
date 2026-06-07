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

export default function RotatingBenefitStrip() {
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
