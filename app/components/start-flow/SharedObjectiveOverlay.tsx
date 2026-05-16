"use client";

import type { SharedObjectiveDefinition } from "@/lib/scenarios";

interface Props {
  objective: SharedObjectiveDefinition;
  onDone: () => void;
}

export default function SharedObjectiveOverlay({ objective, onDone }: Props) {
  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center px-4"
      style={{ background: "rgba(0,0,0,0.82)", backdropFilter: "blur(6px)" }}
    >
      <div className="w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl">

        {/* Header */}
        <div className="bg-emerald-900 px-6 pt-5 pb-4">
          <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-emerald-400">
            Společný kontrakt
          </div>
          <div className="mt-1.5 text-xl font-black text-white leading-tight">
            {objective.title}
          </div>
          <div className="mt-1 text-xs text-emerald-300/70 italic">
            Tento kontrakt vidí všichni hráči.
          </div>
        </div>

        {/* Body */}
        <div className="bg-white px-6 py-5 space-y-4">
          <p className="text-sm text-slate-600 leading-relaxed italic">
            {objective.story}
          </p>

          <div className="rounded-xl border-2 border-slate-200 bg-slate-50 px-4 py-3">
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">
              Společný úkol
            </div>
            <p className="text-sm font-semibold text-slate-800 leading-snug">
              {objective.task}
            </p>
          </div>

          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 flex items-start gap-2">
            <span className="text-base leading-none mt-0.5">💰</span>
            <span className="text-sm font-semibold text-emerald-800 leading-snug">
              {objective.rewardLabel}
            </span>
          </div>

          <button
            onClick={onDone}
            className="w-full rounded-xl bg-emerald-800 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors"
          >
            Rozumím →
          </button>
        </div>

      </div>
    </div>
  );
}
