"use client";

import React from "react";
import type { Horse } from "@/lib/types/game";

export type RacerCategory = "animal" | "car" | "generic" | "legendary";

interface Props {
  horse: Horse;
  playerName: string;
  racerCategory: RacerCategory;
  onDismiss: () => void;
}

function getTitle(category: RacerCategory): string {
  if (category === "legendary") return "Legenda odešla";
  return "Státní zabavení";
}

function getBodyText(name: string, category: RacerCategory): string {
  if (category === "legendary") {
    return `${name} odvedl všechno, co měl. Legendy se nedrží — zmizely dřív, než si to stačíš uvědomit.`;
  }
  if (category === "car") {
    return `${name} byl kvůli vyčerpání odstaven z provozu a odtažen mimo trať. Papírově jde o bezpečnostní opatření. Prakticky: už není tvůj.`;
  }
  if (category === "animal") {
    return `${name} byl kvůli vyčerpání odebrán ze stáje. Papírově jde o ochranu závodníka. Prakticky: už není tvůj.`;
  }
  return `${name} byl kvůli vyčerpání odebrán z provozu. Papírově jde o ochranné opatření. Prakticky: už není tvůj.`;
}

export default function RacerLostModal({ horse, playerName, racerCategory, onDismiss }: Props) {
  React.useEffect(() => {
    const t = setTimeout(onDismiss, 10_000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.65)" }}
    >
      <div
        className="mx-4 w-full max-w-xs rounded-3xl bg-slate-900 px-6 py-7 text-center shadow-2xl"
        style={{ animation: "cardFadeIn 0.3s ease-out both" }}
      >
        {horse.image ? (
          <img
            src={horse.image}
            alt={horse.name}
            className="mx-auto mb-3 h-20 w-20 rounded-2xl object-cover bg-slate-800"
            onError={(e) => { e.currentTarget.style.display = "none"; }}
          />
        ) : (
          <div className="text-5xl mb-3">{horse.emoji}</div>
        )}

        <div className={`text-xs font-bold uppercase tracking-widest mb-1 ${racerCategory === "legendary" ? "text-amber-400" : "text-red-400"}`}>
          {getTitle(racerCategory)}
        </div>
        <div className="text-lg font-black text-white mb-3">{horse.name}</div>

        <p className="text-sm text-slate-400 leading-relaxed mb-1">
          {getBodyText(horse.name, racerCategory)}
        </p>
        <p className="text-xs text-slate-600 mb-5">
          {racerCategory === "legendary"
            ? "Možná se jednou vrátí. Možná ne."
            : "Až se dá znovu dohromady, vrátí se do aukce."}
        </p>

        <div className="text-[10px] text-slate-600 mb-3">
          {playerName}
        </div>

        <button
          onClick={onDismiss}
          className="w-full rounded-xl bg-slate-700 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-600 transition"
        >
          Rozumím
        </button>
      </div>
    </div>
  );
}
