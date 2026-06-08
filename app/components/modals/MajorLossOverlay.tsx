"use client";

import React from "react";

const MESSAGES = [
  "To bolelo.",
  "Skill issue.",
  "Rip peněženka.",
  "Drahá chyba.",
  "Tak určitě.",
  "Certified chudoba moment.",
];

const AUTO_DISMISS_MS = 2000;

interface Props {
  amount: number;
  onDismiss: () => void;
}

export default function MajorLossOverlay({ amount, onDismiss }: Props) {
  const [msgIdx] = React.useState(() => Math.floor(Math.random() * MESSAGES.length));

  React.useEffect(() => {
    const t = setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div
      className="fixed inset-0 z-[55] flex items-center justify-center cursor-pointer"
      style={{ background: "rgba(0,0,0,0.62)" }}
      onClick={onDismiss}
    >
      <div
        className="flex flex-col items-center gap-3 rounded-3xl bg-slate-900/95 px-8 py-7 text-center shadow-2xl"
        style={{ animation: "cardFadeIn 0.22s ease-out both" }}
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src="/loss_laugh.avif"
          alt=""
          className="w-24 h-24 rounded-2xl object-cover bg-slate-800"
          onError={(e) => { e.currentTarget.style.display = "none"; }}
        />
        <div className="text-base font-black text-white">{MESSAGES[msgIdx]}</div>
        <div className="text-2xl font-black text-red-400 tabular-nums">−{amount} 💰</div>
      </div>
    </div>
  );
}
