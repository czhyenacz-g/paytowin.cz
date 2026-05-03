import type { RacerConfig } from "@/lib/themes";
import { RACER_TYPE_LABELS } from "@/lib/racers/types";
import type { RacerType } from "@/lib/racers/types";

interface Props {
  racer: RacerConfig;
}

function SpeedBar({ speed }: { speed: number }) {
  const color =
    speed >= 8 ? "bg-amber-400" :
    speed >= 5 ? "bg-emerald-400" :
                 "bg-slate-300";
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 10 }, (_, i) => (
        <div
          key={i}
          className={`h-2 flex-1 rounded-sm transition-colors ${i < speed ? color : "bg-slate-100"}`}
        />
      ))}
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 shrink-0">
        {label}
      </span>
      <span>{value}</span>
    </div>
  );
}

export default function RacerDetailCard({ racer }: Props) {
  const typeLabel =
    racer.racerType && racer.racerType !== "unset"
      ? RACER_TYPE_LABELS[racer.racerType as RacerType]
      : null;
  const flavorText = racer.flavorText ?? (racer as { heroText?: string }).heroText ?? null;

  return (
    <div className="flex flex-col">

      {/* Hero image */}
      <div
        className="relative bg-gradient-to-br from-slate-100 to-slate-200 overflow-hidden"
        style={{ aspectRatio: "4 / 4.31" }}
      >
        {racer.image ? (
          <img
            src={racer.image}
            alt={racer.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-7xl select-none">
            {racer.emoji}
          </div>
        )}

        {racer.isLegendary && (
          <div className="absolute top-2 right-2 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-slate-900 shadow-sm">
            ✦ LEGENDÁRNÍ
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-4 space-y-4">

        {/* Name + type */}
        <div>
          {typeLabel && (
            <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-0.5">
              {typeLabel}
            </div>
          )}
          <h3 className="text-xl font-black text-slate-900 leading-tight">{racer.name}</h3>
        </div>

        {/* Stats */}
        <div className="space-y-2.5">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Rychlost
              </span>
              <span className="text-xs font-bold text-slate-600">{racer.speed} / 10</span>
            </div>
            <SpeedBar speed={racer.speed} />
          </div>
          <StatRow
            label="Cena"
            value={
              <span className="text-sm font-bold text-slate-700">
                {racer.price.toLocaleString("cs-CZ")} 💰
              </span>
            }
          />
          <StatRow
            label="Max. stamina"
            value={
              <span className="text-sm font-semibold text-slate-600">
                {racer.maxStamina ?? 100}
              </span>
            }
          />
        </div>

        {/* Flavor text */}
        {flavorText && (
          <p className="text-xs text-slate-500 italic leading-relaxed border-t border-slate-100 pt-3">
            „{flavorText}"
          </p>
        )}

        {/* ID */}
        <div className="border-t border-slate-100 pt-2">
          <span className="text-[10px] font-mono text-slate-300">{racer.id}</span>
        </div>

      </div>
    </div>
  );
}
