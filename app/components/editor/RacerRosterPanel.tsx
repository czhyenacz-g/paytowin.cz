"use client";

/**
 * RacerRosterPanel — přehled a správa katalogu závodníků.
 *
 * Dvě použití:
 *
 * 1. Theme Builder (catalogReadOnly=true, racerFieldCount=N)
 *    — katalog je read-only (add/delete/edit zakázány)
 *    — zobrazí "Editovat závodníky →" odkaz na Racer Admin
 *    — slot assignment a mismatch warning aktivní
 *
 * 2. Racer Admin (catalogReadOnly=false, racerFieldCount=undefined)
 *    — plná editace katalogu
 *    — slot assignment a mismatch warning skryty (není kontext boardu)
 *
 * Props:
 *   racers          — editovatelná kopie katalogu
 *   racerFieldCount — počet polí type="racer" na boardu; pokud undefined → slot UI skryto
 *   onChange        — callback s novou verzí pole
 *   isBuiltInTheme  — zamkne vše včetně slot selects (pro built-in themes v builderu)
 *   catalogReadOnly — zamkne pouze katalog; slot selects zůstávají aktivní (builder mode)
 *   onEditRacers    — callback pro "Editovat závodníky →" tlačítko (jen při catalogReadOnly)
 */

import React from "react";
import type { RacerConfig } from "@/lib/themes";
import RacerEditorPanel from "./RacerEditorPanel";
import RacerDetailCard from "./RacerDetailCard";

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  racers:           RacerConfig[];
  /**
   * Počet polí type="racer" na boardu.
   * Pokud není předáno (Racer Admin), slot assignment sekce a mismatch warning jsou skryty.
   */
  racerFieldCount?: number;
  onChange:         (updated: RacerConfig[]) => void;
  /**
   * True pokud je celé theme vestavěné (source === "built-in").
   * Zamkne katalog i slot assignment — nic nelze měnit.
   */
  isBuiltInTheme?:  boolean;
  /**
   * True = katalog je read-only (builder mode): žádné add/delete/reorder/inline edit.
   * Slot assignment a mismatch warning fungují normálně.
   * Kombinovat s onEditRacers pro odkaz na Racer Admin.
   */
  catalogReadOnly?: boolean;
  /** Callback pro přechod na Racer Admin (zobrazí se jako tlačítko při catalogReadOnly). */
  onEditRacers?:    () => void;
  /** ID aktuálního theme — předáváno do RacerEditorPanel pro built-in asset save. */
  themeId?:         string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Vygeneruje unikátní ID pro nového závodníka — nepřekrývá existující. */
function generateId(racers: RacerConfig[]): string {
  const existing = new Set(racers.map((r) => r.id));
  let i = racers.length + 1;
  while (existing.has(`r${i}`)) i++;
  return `r${i}`;
}

// ─── Komponenta ───────────────────────────────────────────────────────────────

export default function RacerRosterPanel({
  racers,
  racerFieldCount,
  onChange,
  isBuiltInTheme  = false,
  catalogReadOnly = false,
  onEditRacers,
  themeId,
}: Props) {
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  // Slot UI a mismatch jsou dostupné jen pokud je znám počet racer polí boardu.
  const hasSlotContext = racerFieldCount !== undefined;
  const mismatch = hasSlotContext && racers.length !== racerFieldCount;
  const shortage = hasSlotContext && (racerFieldCount as number) > racers.length;

  /** True pokud je konkrétní racer locked — buď theme je built-in, nebo racer má isBuiltIn flag.
   *  Na localhostu (dev) se isBuiltIn ignoruje — built-in racery jdou editovat. */
  const isRacerLocked = (r: RacerConfig) =>
    isBuiltInTheme || (r.isBuiltIn === true && process.env.NODE_ENV === "production");

  // ── Akce ────────────────────────────────���──────────────────────────────���──

  function handleAdd() {
    if (catalogReadOnly || isBuiltInTheme) return;
    const newRacer: RacerConfig = {
      id:        generateId(racers),
      name:      "Nový závodník",
      speed:     3,
      price:     150,
      emoji:     "🐴",
      slotIndex: racers.length,
    };
    onChange([...racers, newRacer]);
    setSelectedId(newRacer.id);
  }

  /** Po přeskládání arrayi přepočítá slotIndex dle nového pořadí. */
  function reassignSlots(reordered: RacerConfig[]): RacerConfig[] {
    return reordered.map((r, i) => ({ ...r, slotIndex: i }));
  }

  function handleMoveUp(idx: number) {
    if (idx === 0) return;
    const next = [...racers];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    onChange(reassignSlots(next));
  }

  function handleMoveDown(idx: number) {
    if (idx >= racers.length - 1) return;
    const next = [...racers];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    onChange(reassignSlots(next));
  }

  function handleDelete(idx: number) {
    const r = racers[idx];
    if (isRacerLocked(r)) return;
    const rSlot = r.slotIndex ?? idx;
    const onBoard = hasSlotContext && rSlot < (racerFieldCount as number);
    const confirmMsg = onBoard
      ? `Odebrat "${r.name}" (${r.id}) z theme membership?\n\nRacer má board slot ${rSlot + 1} — odebráním ztratí i přiřazení na board.`
      : `Odebrat "${r.name}" (${r.id}) z theme membership?\n\nRacer je off-board — bude odstraněn z membership, v globálním katalogu zůstane.`;
    if (!window.confirm(confirmMsg)) return;
    const next = racers.filter((_, i) => i !== idx);
    onChange(next);
    if (selectedId === r.id) setSelectedId(null);
  }

  function handleChange(updated: RacerConfig) {
    onChange(racers.map((r) => (r.id === updated.id ? updated : r)));
  }

  /**
   * Přiřadí závodníka k danému slotu — swap:
   * Vybraný racer dostane targetSlot, racer co v slotu seděl dostane jeho starý slot.
   *
   * Prázdný výběr ("prázdný") odebere racera ze slotu a přesune ho do off-board membership
   * (slotIndex >= racerFieldCount) — racer ZŮSTANE v theme, jen bez board přiřazení.
   */
  function handleSlotAssign(targetSlot: number, pickedId: string) {
    if (!pickedId) {
      // "prázdný" → odeber racera ze slotu, ponech v membership jako off-board
      const inSlot = racers.find((r, i) => (r.slotIndex ?? i) === targetSlot);
      if (!inSlot) return;
      const usedSlots = new Set(
        racers.filter((r) => r.id !== inSlot.id).map((r, i) => r.slotIndex ?? i)
      );
      let offSlot = racerFieldCount as number;
      while (usedSlots.has(offSlot)) offSlot++;
      onChange(racers.map((r) => r.id === inSlot.id ? { ...r, slotIndex: offSlot } : r));
      return;
    }
    const picked = racers.find((r) => r.id === pickedId);
    if (!picked) return;
    const pickedOldSlot = picked.slotIndex ?? racers.indexOf(picked);
    const next = racers.map((r, i) => {
      const rSlot = r.slotIndex ?? i;
      if (r.id === pickedId) return { ...r, slotIndex: targetSlot };
      if (rSlot === targetSlot) return { ...r, slotIndex: pickedOldSlot };
      return r;
    });
    onChange(next);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const badgeText = hasSlotContext
    ? `${racers.length} závodníků / ${racerFieldCount} ${racerFieldCount === 1 ? "pole" : "polí"}`
    : `${racers.length} závodník${racers.length === 1 ? "" : "ů"}`;

  const selectedRacer = selectedId ? (racers.find((r) => r.id === selectedId) ?? null) : null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">

      {/* Header — full width */}
      <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            Roster závodníků
          </span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
            mismatch
              ? "bg-amber-100 text-amber-700"
              : "bg-emerald-100 text-emerald-700"
          }`}>
            {badgeText}
          </span>
        </div>

        {isBuiltInTheme ? (
          <span className="text-[10px] text-slate-400 flex items-center gap-1">🔒 vestavěné</span>
        ) : catalogReadOnly ? (
          <button
            onClick={onEditRacers}
            className="rounded-lg bg-indigo-500 px-2.5 py-1 text-xs font-medium text-white hover:bg-indigo-600 transition-colors"
          >
            Editovat závodníky →
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={handleAdd}
              className="rounded-lg bg-amber-500 px-2.5 py-1 text-xs font-medium text-white hover:bg-amber-600 transition-colors"
            >
              + Přidat závodníka
            </button>
            {onEditRacers && (
              <button
                onClick={onEditRacers}
                className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors"
              >
                Racer Admin →
              </button>
            )}
          </div>
        )}
      </div>

      {/* Body: left list + right detail */}
      <div className="flex flex-col md:flex-row">

        {/* ── Left: list ──────────────────────────────────────────── */}
        <div className="flex-1 min-w-0">

          {/* Mismatch warning */}
          {mismatch && (
            <div className={`px-4 py-2 text-xs font-medium border-b ${
              shortage
                ? "bg-amber-50 border-amber-200 text-amber-700"
                : "bg-slate-50 border-slate-200 text-slate-500"
            }`}>
              {shortage ? (
                <>
                  ⚠️ Board má <strong>{racerFieldCount} racer {racerFieldCount === 1 ? "pole" : "polí"}</strong>, ale
                  katalog obsahuje jen <strong>{racers.length}</strong> závodníků —
                  přidej ještě {(racerFieldCount as number) - racers.length}.
                </>
              ) : (
                <>
                  {racers.length - (racerFieldCount as number)} závodník(ů) bez slotu na boardu —
                  mohou být dáni přes chance kartu nebo jiný herní mechanismus.
                </>
              )}
            </div>
          )}

          {/* Slot Assignment */}
          {hasSlotContext && (racerFieldCount as number) > 0 && (
            <div className="border-b border-slate-100 px-4 py-3">
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                Přiřazení slotů
              </div>
              <div className="space-y-1.5">
                {Array.from({ length: racerFieldCount as number }, (_, slotIdx) => {
                  const assigned = racers.find((r) => (r.slotIndex ?? racers.indexOf(r)) === slotIdx);
                  return (
                    <div key={slotIdx} className="flex items-center gap-2">
                      <span className="w-5 shrink-0 text-right font-mono text-[10px] text-slate-400">
                        {slotIdx + 1}.
                      </span>
                      {isBuiltInTheme ? (
                        <span className="text-xs text-slate-600">
                          {assigned
                            ? <>{assigned.emoji} {assigned.name}</>
                            : <span className="italic text-slate-300">— prázdný —</span>
                          }
                        </span>
                      ) : (
                        <select
                          value={assigned?.id ?? ""}
                          onChange={(e) => handleSlotAssign(slotIdx, e.target.value)}
                          className="flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-300"
                        >
                          <option value="">— prázdný —</option>
                          {racers.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.emoji} {r.name} · ⚡{r.speed} · {r.price} 💰
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Prázdný stav */}
          {racers.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-slate-400 italic">
              {catalogReadOnly
                ? "Žádní závodníci — přidej je v Racer Adminu."
                : "Žádní závodníci — přidej prvního tlačítkem výše."
              }
            </div>
          )}

          {/* Roster rows */}
          <div className="divide-y divide-slate-100">
            {racers.map((r, idx) => {
              const isSelected = selectedId === r.id;
              const rSlot      = r.slotIndex ?? idx;
              const isOrphan   = hasSlotContext && rSlot >= (racerFieldCount as number);
              const locked     = isRacerLocked(r);

              return (
                <div
                  key={r.id}
                  className={`flex items-center gap-3 px-4 py-2.5 transition-colors select-none cursor-pointer ${
                    isSelected
                      ? locked ? "bg-slate-100" : "bg-amber-50"
                      : "hover:bg-slate-50"
                  }`}
                  onClick={() => setSelectedId(isSelected ? null : r.id)}
                >
                  <span className={`text-[10px] font-mono w-4 shrink-0 text-center ${
                    isOrphan ? "text-slate-300" : "text-slate-400"
                  }`}>
                    {isOrphan ? "–" : `${rSlot + 1}.`}
                  </span>

                  <span className="text-xl leading-none shrink-0">{r.emoji}</span>

                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-800 truncate">{r.name}</div>
                    <div className="text-[10px] text-slate-400 font-mono space-x-1.5">
                      <span className="text-slate-300">{r.id}</span>
                      <span>·</span>
                      <span>⚡ {r.speed}</span>
                      <span>·</span>
                      <span>{r.price} 💰</span>
                      {r.isLegendary && <span className="text-amber-500">· leg</span>}
                    </div>
                  </div>

                  {hasSlotContext && (
                    <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${
                      isOrphan
                        ? "bg-slate-100 text-slate-400"
                        : "bg-emerald-100 text-emerald-700"
                    }`}>
                      {isOrphan ? "off-board" : "na boardu"}
                    </span>
                  )}

                  {!catalogReadOnly && (
                    <div
                      className="flex items-center gap-0.5 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {locked ? (
                        <span
                          className="text-[11px] text-slate-300 px-1"
                          title="Vestavěný závodník — nelze editovat ani smazat"
                        >
                          🔒
                        </span>
                      ) : (
                        <>
                          <button
                            onClick={() => handleMoveUp(idx)}
                            disabled={idx === 0}
                            title="Posunout nahoru"
                            className="rounded p-1 text-xs text-slate-400 hover:text-slate-700 disabled:opacity-20 transition-colors"
                          >
                            ↑
                          </button>
                          <button
                            onClick={() => handleMoveDown(idx)}
                            disabled={idx >= racers.length - 1}
                            title="Posunout dolů"
                            className="rounded p-1 text-xs text-slate-400 hover:text-slate-700 disabled:opacity-20 transition-colors"
                          >
                            ↓
                          </button>
                          <button
                            onClick={() => handleDelete(idx)}
                            title="Smazat závodníka"
                            className="ml-1 rounded p-1 text-xs text-slate-400 hover:text-red-500 transition-colors"
                          >
                            ✕
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="border-t border-slate-100 px-4 py-2 text-[10px] text-slate-400">
            {catalogReadOnly
              ? "Závodníky edituj v Racer Adminu — v builderu lze měnit jen přiřazení slotů."
              : hasSlotContext
                ? "Slot 1 → 1. racer pole zleva. Výběrem \"prázdný\" odebereš ze slotu (racer zůstane v membership)."
                : "Závodníci v katalogu — uložením se změní v theme souboru / DB."
            }
          </div>

        </div>

        {/* ── Right: detail panel ──────────────────────────────────── */}
        <div className="w-full md:w-72 xl:w-80 shrink-0 border-t border-slate-100 md:border-t-0 md:border-l">
          {selectedRacer ? (
            <div>
              <RacerDetailCard racer={selectedRacer} />
              {!catalogReadOnly && (
                <div className="border-t border-slate-100 px-4 pb-4 pt-3">
                  <div className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                    Editace
                  </div>
                  <RacerEditorPanel
                    racer={selectedRacer}
                    onChange={handleChange}
                    readOnly={isRacerLocked(selectedRacer)}
                    themeId={themeId}
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center min-h-[220px] h-full text-center px-6 py-10">
              <div className="text-5xl mb-3 select-none opacity-30">🏁</div>
              <div className="text-sm font-semibold text-slate-600">Vyber závodníka</div>
              <div className="mt-1 text-xs text-slate-400">Klikni na položku vlevo pro zobrazení detailu</div>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
