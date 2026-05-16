"use client";

import type { PersonalObjectiveDefinition } from "@/lib/scenarios";

interface Props {
  objective: PersonalObjectiveDefinition;
  onDone: () => void;
}

export default function PersonalObjectiveOverlay({ objective, onDone }: Props) {
  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center px-4"
      style={{ background: "rgba(0,0,0,0.82)", backdropFilter: "blur(6px)" }}
    >
      <div className="w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl">

        {/* Header */}
        <div className="bg-stone-900 px-6 pt-5 pb-4">
          <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-amber-400">
            Tvůj kontrakt
          </div>
          <div className="mt-1.5 text-xl font-black text-white leading-tight">
            {objective.title}
          </div>
          <div className="mt-1 text-xs text-stone-400 italic">
            Ostatní hráči tento úkol nevidí.
          </div>
        </div>

        {/* Body */}
        <div className="bg-white px-6 py-5 space-y-4">
          <p className="text-sm text-slate-600 leading-relaxed italic">
            {objective.story}
          </p>

          <div className="rounded-xl border-2 border-slate-200 bg-slate-50 px-4 py-3">
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">
              Tvůj úkol
            </div>
            <p className="text-sm font-semibold text-slate-800 leading-snug">
              {objective.task}
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs font-medium text-amber-700">
            <span className="text-base leading-none">⭐</span>
            <span>{objective.rewardLabel}</span>
          </div>

          <button
            onClick={onDone}
            className="w-full rounded-xl bg-stone-900 px-4 py-3 text-sm font-semibold text-white hover:bg-stone-800 transition-colors"
          >
            Rozumím →
          </button>
        </div>

      </div>
    </div>
  );
}
