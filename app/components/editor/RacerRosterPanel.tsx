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
}: Props) {
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  // Slot UI a mismatch jsou dostupné jen pokud je znám počet racer polí boardu.
  const hasSlotContext = racerFieldCount !== undefined;
  const mismatch = hasSlotContext && racers.length !== racerFieldCount;
  const shortage = hasSlotContext && (racerFieldCount as number) > racers.length;

  /** True pokud je konkrétní racer locked — buď theme je built-in, nebo racer má isBuiltIn flag. */
  const isRacerLocked = (r: RacerConfig) => isBuiltInTheme || r.isBuiltIn === true;

  // ── Akce ──────────────────────────────────────────────────────────────────

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
    if (
      !window.confirm(
        `Smazat závodníka "${r.name}" (${r.id})?\n\n` +
        `Pozor: odstraněním ${idx + 1}. závodníka se posune přiřazení racerů na ` +
        `všech následujících racer polích boardu.`,
      )
    ) return;
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
   */
  function handleSlotAssign(targetSlot: number, pickedId: string) {
    if (!pickedId) return;
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

  // Badge text v headeru
  const badgeText = hasSlotContext
    ? `${racers.length} závodníků / ${racerFieldCount} ${racerFieldCount === 1 ? "pole" : "polí"}`
    : `${racers.length} závodník${racers.length === 1 ? "" : "ů"}`;

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">

      {/* Header */}
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

        {/* Header action */}
        {isBuiltInTheme ? (
          <span className="text-[10px] text-slate-400 flex items-center gap-1">
            🔒 vestavěné
          </span>
        ) : catalogReadOnly ? (
          <button
            onClick={onEditRacers}
            className="rounded-lg bg-indigo-500 px-2.5 py-1 text-xs font-medium text-white hover:bg-indigo-600 transition-colors"
          >
            Editovat závodníky →
          </button>
        ) : (
          <button
            onClick={handleAdd}
            className="rounded-lg bg-amber-500 px-2.5 py-1 text-xs font-medium text-white hover:bg-amber-600 transition-colors"
          >
            + Přidat závodníka
          </button>
        )}
      </div>

      {/* Mismatch warning — jen pokud je znám počet racer polí */}
      {mismatch && (
        <div className={`px-4 py-2 text-xs font-medium border-b ${
          shortage
            ? "bg-amber-50 border-amber-200 text-amber-700"
            : "bg-sky-50 border-sky-200 text-sky-700"
        }`}>
          {shortage ? (
            <>
              ⚠️ Board má <strong>{racerFieldCount} racer {racerFieldCount === 1 ? "pole" : "polí"}</strong>, ale
              katalog obsahuje jen <strong>{racers.length}</strong> závodníků —
              přidej ještě {(racerFieldCount as number) - racers.length}.
            </>
          ) : (
            <>
              ℹ️ V katalogu je <strong>{racers.length}</strong> závodníků, ale board
              má jen <strong>{racerFieldCount} racer {racerFieldCount === 1 ? "pole" : "polí"}</strong> —
              posledních {racers.length - (racerFieldCount as number)} závodník(ů) nebude nikde přiřazen.
            </>
          )}
        </div>
      )}

      {/* Slot Assignment — jen pokud je znám počet racer polí */}
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

      {/* Roster list */}
      <div className="divide-y divide-slate-100">
        {racers.map((r, idx) => {
          const isSelected = selectedId === r.id;
          // isOrphan: závodník bez racer pole na boardu (jen pokud znám počet polí)
          const isOrphan = hasSlotContext && idx >= (racerFieldCount as number);
          const locked   = isRacerLocked(r);

          return (
            <div key={r.id}>

              {/* Row */}
              <div
                className={`flex items-center gap-3 px-4 py-2.5 transition-colors select-none ${
                  catalogReadOnly
                    ? "cursor-default"
                    : "cursor-pointer " + (isSelected ? (locked ? "bg-slate-100" : "bg-amber-50") : "hover:bg-slate-50")
                }`}
                onClick={() => {
                  if (!catalogReadOnly) setSelectedId(isSelected ? null : r.id);
                }}
              >
                {/* Slot číslo */}
                <span className={`text-[10px] font-mono w-4 shrink-0 text-center ${
                  isOrphan ? "text-slate-300" : "text-slate-400"
                }`}>
                  {(r.slotIndex ?? idx) + 1}.
                </span>

                <span className="text-xl leading-none shrink-0">{r.emoji}</span>

                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-800 truncate">{r.name}</div>
                  <div className="text-[10px] text-slate-400 font-mono space-x-1.5">
                    <span className="font-mono text-slate-300">{r.id}</span>
                    <span>·</span>
                    <span>⚡ {r.speed}</span>
                    <span>·</span>
                    <span>{r.price} 💰</span>
                    {r.isLegendary && <span className="text-amber-500">· leg</span>}
                    {isOrphan && <span className="text-slate-300">· bez pole</span>}
                  </div>
                </div>

                {/* Akce — skryty v catalogReadOnly módu */}
                {!catalogReadOnly && (
                  <div
                    className="flex items-center gap-0.5 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {locked ? (
                      <span className="text-[11px] text-slate-300 px-1" title="Vestavěný závodník — nelze editovat ani smazat">🔒</span>
                    ) : (
                      <>
                        <button
                          onClick={() => handleMoveUp(idx)}
                          disabled={idx === 0}
                          title="Posunout nahoru (přeřadit slot)"
                          className="rounded p-1 text-xs text-slate-400 hover:text-slate-700 disabled:opacity-20 transition-colors"
                        >
                          ↑
                        </button>
                        <button
                          onClick={() => handleMoveDown(idx)}
                          disabled={idx === racers.length - 1}
                          title="Posunout dolů (přeřadit slot)"
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

              {/* Inline RacerEditorPanel — jen v plném módu (ne catalogReadOnly) */}
              {isSelected && !catalogReadOnly && (
                <div className={`px-4 pb-3 ${locked ? "bg-slate-50/60" : "bg-amber-50/40"}`}>
                  <RacerEditorPanel
                    racer={r}
                    onChange={handleChange}
                    readOnly={locked}
                  />
                </div>
              )}

            </div>
          );
        })}
      </div>

      {/* Footer nápověda */}
      <div className="border-t border-slate-100 px-4 py-2 text-[10px] text-slate-400">
        {catalogReadOnly
          ? "Závodníky edituj v Racer Adminu — v builderu lze měnit jen přiřazení slotů."
          : hasSlotContext
            ? "Slot 1 → 1. racer pole zleva. Přiřaď závodníka přes select výše nebo přeřaď pořadí ↑↓ v seznamu."
            : "Závodníci v katalogu — uložením se změní v theme souboru / DB."
        }
      </div>

    </div>
  );
}
