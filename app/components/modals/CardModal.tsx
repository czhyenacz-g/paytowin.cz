"use client";

import type { GameCard } from "@/lib/cards";

interface Props {
  card: GameCard;
  playerName: string;
}

export default function CardModal({ card, playerName }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.55)" }}
    >
      <div
        className="mx-4 w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden"
        style={{ animation: "cardFadeIn 0.25s ease-out both" }}
      >
        <div className={`px-6 pt-6 pb-4 ${card.type === "chance" ? "bg-sky-600" : "bg-teal-700"}`}>
          <div className="text-xs font-bold uppercase tracking-widest text-white/70">
            {card.type === "chance" ? "Náhoda" : "Finance"}
          </div>
          <div className="mt-1 text-3xl">
            {card.type === "chance" ? "🎴" : "💼"}
          </div>
          <div className="mt-2 text-xs font-semibold text-white/80">
            {playerName} lízl kartu:
          </div>
        </div>

        <div className="bg-white px-6 py-5 space-y-4">
          <p className="text-base font-medium text-slate-800 leading-snug">
            {card.text}
          </p>
          <div className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold ${
            card.type === "chance" ? "bg-sky-100 text-sky-800" : "bg-teal-100 text-teal-800"
          }`}>
            {card.effectLabel}
          </div>
          <div className="text-xs text-slate-400">
            Efekt se aplikuje za chvíli…
          </div>
        </div>
      </div>
    </div>
  );
}
