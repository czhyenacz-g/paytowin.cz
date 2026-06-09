"use client";

import type { Field } from "@/lib/engine";

// Ceny za 1., 2. a 3. vybrané pole v jednom tahu
const PLACEMENT_COSTS = [100, 200, 400] as const;

interface Props {
  selectedIndexes: number[];
  FIELDS: Field[];
  playerCoins: number;
  onCancel: () => void;
  onConfirm: () => void;
  loading?: boolean;
  error?: string | null;
}

export default function FieldOwnershipPanel({
  selectedIndexes,
  FIELDS,
  playerCoins,
  onCancel,
  onConfirm,
  loading = false,
  error = null,
}: Props) {
  const totalCost = selectedIndexes.reduce<number>((sum, _, i) => sum + PLACEMENT_COSTS[i], 0);
  const fieldMap = new Map(FIELDS.map(f => [f.index, f]));

  const canConfirm =
    selectedIndexes.length >= 1 &&
    selectedIndexes.length <= 3 &&
    totalCost <= playerCoins &&
    !loading;

  const content = (
    <div className="space-y-3">
      <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
        Výběr polí 🎯
      </div>
      <p className="text-xs text-slate-400 leading-relaxed">
        Klikni na zvýrazněné ztrátové pole na boardu. Vyber 1 až 3 pole.
      </p>

      {selectedIndexes.length > 0 ? (
        <div className="space-y-1">
          {selectedIndexes.map((idx, i) => {
            const field = fieldMap.get(idx);
            return (
              <div key={idx} className="flex items-center justify-between text-xs text-slate-300">
                <span className="truncate max-w-[140px]">
                  {field?.emoji ?? "❓"} {field?.label ?? `Pole ${idx}`}
                </span>
                <span className="shrink-0 text-red-400 tabular-nums">−{PLACEMENT_COSTS[i]} 💰</span>
              </div>
            );
          })}
          <div className="flex items-center justify-between text-xs font-semibold border-t border-slate-700 pt-1.5 mt-1">
            <span className="text-slate-300">Celkem</span>
            <span className={`tabular-nums ${totalCost > playerCoins ? "text-red-400" : "text-amber-400"}`}>
              −{totalCost} 💰
            </span>
          </div>
          {totalCost > playerCoins && (
            <div className="text-[10px] text-red-500">Nedostatek coins.</div>
          )}
        </div>
      ) : (
        <div className="text-xs text-slate-600 italic">Žádné pole nevybráno</div>
      )}

      {error && (
        <div className="rounded-[3px] bg-red-900/50 px-2 py-1.5 text-[11px] text-red-400">
          {error}
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <button
          onClick={onCancel}
          disabled={loading}
          className="flex-1 rounded-[3px] border border-slate-600 px-3 py-2 text-sm font-semibold text-slate-400 hover:bg-slate-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Zrušit
        </button>
        <button
          onClick={onConfirm}
          disabled={!canConfirm}
          className={`flex-1 rounded-[3px] px-3 py-2 text-sm font-semibold transition
            ${canConfirm
              ? "bg-amber-600 hover:bg-amber-500 text-white"
              : "bg-slate-800 text-slate-600 cursor-not-allowed"
            }`}
        >
          {loading ? "Ukládám…" : "Potvrdit"}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobilní bottom sheet — fixní nad boardem */}
      <div className="md:hidden fixed inset-x-0 bottom-0 z-[60] rounded-t-2xl bg-slate-900 border-t border-slate-700 px-4 py-5 shadow-2xl">
        {content}
      </div>
      {/* Desktop — inline v GamePanelu */}
      <div className="hidden md:block rounded-[4px] border border-slate-700 bg-slate-900/80 p-4">
        {content}
      </div>
    </>
  );
}
