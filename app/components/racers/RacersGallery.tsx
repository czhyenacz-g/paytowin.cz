"use client";

import { useState } from "react";
import type { RacerConfig } from "@/lib/themes";
import type { RacerType } from "@/lib/racers/types";
import { RACER_TYPE_ORDER, RACER_TYPE_LABELS } from "@/lib/racers/types";
import RacerDetailCard from "@/app/components/editor/RacerDetailCard";

interface Props {
  racers: RacerConfig[];
}

function RacerGridCard({ racer, selected, onClick }: { racer: RacerConfig; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-xl border-2 transition-all overflow-hidden ${
        selected
          ? "border-amber-400 shadow-md shadow-amber-100"
          : "border-slate-200 hover:border-slate-300 hover:shadow-sm"
      }`}
    >
      <div className="bg-slate-100 flex items-center justify-center" style={{ aspectRatio: "1 / 1" }}>
        {racer.image ? (
          <img src={racer.image} alt={racer.name} className="w-full h-full object-cover" />
        ) : (
          <span className="text-4xl select-none">{racer.emoji}</span>
        )}
      </div>
      <div className="px-2.5 py-2">
        <div className="text-xs font-bold text-slate-800 truncate">{racer.name}</div>
        <div className="flex items-center gap-1 mt-0.5">
          <span className="text-[10px] text-slate-400">Rychlost</span>
          <span className="text-[10px] font-semibold text-slate-600">{racer.speed}</span>
          {racer.isLegendary && (
            <span className="ml-auto text-[9px] font-bold text-amber-500">✦</span>
          )}
        </div>
      </div>
    </button>
  );
}

export default function RacersGallery({ racers }: Props) {
  const [selectedId, setSelectedId] = useState<string>(racers[0]?.id ?? "");
  const [activeType, setActiveType] = useState<RacerType | "all">("all");

  const typesPresent = RACER_TYPE_ORDER.filter((t) =>
    t !== "unset" && racers.some((r) => r.racerType === t)
  );

  const filtered = activeType === "all"
    ? racers
    : racers.filter((r) => r.racerType === activeType);

  const selectedRacer = racers.find((r) => r.id === selectedId) ?? filtered[0] ?? null;

  function handleFilterChange(type: RacerType | "all") {
    setActiveType(type);
    const first = type === "all" ? racers[0] : racers.find((r) => r.racerType === type);
    if (first) setSelectedId(first.id);
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6">

      {/* Left: filters + grid */}
      <div className="flex-1 min-w-0">

        {/* Type filter pills */}
        {typesPresent.length > 1 && (
          <div className="flex flex-wrap gap-2 mb-5">
            <button
              onClick={() => handleFilterChange("all")}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                activeType === "all"
                  ? "bg-slate-800 text-white"
                  : "bg-white border border-slate-200 text-slate-600 hover:border-slate-300"
              }`}
            >
              Všichni ({racers.length})
            </button>
            {typesPresent.map((t) => {
              const count = racers.filter((r) => r.racerType === t).length;
              return (
                <button
                  key={t}
                  onClick={() => handleFilterChange(t)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                    activeType === t
                      ? "bg-slate-800 text-white"
                      : "bg-white border border-slate-200 text-slate-600 hover:border-slate-300"
                  }`}
                >
                  {RACER_TYPE_LABELS[t]} ({count})
                </button>
              );
            })}
          </div>
        )}

        {/* Grid */}
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
          {filtered.map((r) => (
            <RacerGridCard
              key={r.id}
              racer={r}
              selected={r.id === selectedId}
              onClick={() => setSelectedId(r.id)}
            />
          ))}
        </div>
      </div>

      {/* Right: detail card */}
      <div className="w-full lg:w-72 xl:w-80 shrink-0">
        <div className="sticky top-6 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          {selectedRacer ? (
            <RacerDetailCard racer={selectedRacer} />
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-slate-300">
              <span className="text-5xl mb-3">🏁</span>
              <span className="text-sm font-medium">Vyber závodníka</span>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
