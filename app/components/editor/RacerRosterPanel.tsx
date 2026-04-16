"use client";

/**
 * RacerRosterPanel — přehled a správa celého katalogu závodníků pro board editor.
 *
 * Zobrazuje se v ThemeDevTool pod board+field editorem.
 * Umožňuje:
 *   - vidět celý roster závodníků s přiřazením na slot (1., 2., …)
 *   - přidat nového závodníka (výchozí hodnoty)
 *   - editovat závodníka inline přes RacerEditorPanel
 *   - změnit pořadí (↑ / ↓) — přeskládání slot mappingu
 *   - smazat závodníka (s varováním)
 *   - vidět warning pokud počet závodníků neodpovídá počtu racer polí
 *
 * Props:
 *   racers        — editovatelná kopie katalogu (editableRacers z ThemeDevTool)
 *   racerFieldCount — počet polí type="racer" na boardu (počítá ThemeDevTool)
 *   onChange      — callback s novou verzí pole (ThemeDevTool → setEditableRacers)
 */

import React from "react";
import type { RacerConfig } from "@/lib/themes";
import RacerEditorPanel from "./RacerEditorPanel";

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  racers:          RacerConfig[];
  racerFieldCount: number;
  onChange:        (updated: RacerConfig[]) => void;
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

export default function RacerRosterPanel({ racers, racerFieldCount, onChange }: Props) {
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  const mismatch  = racers.length !== racerFieldCount;
  const shortage  = racerFieldCount > racers.length; // board chce víc racerů

  // ── Akce ──────────────────────────────────────────────────────────────────

  function handleAdd() {
    const newRacer: RacerConfig = {
      id:    generateId(racers),
      name:  "Nový závodník",
      speed: 3,
      price: 150,
      emoji: "🐴",
    };
    onChange([...racers, newRacer]);
    setSelectedId(newRacer.id);
  }

  function handleMoveUp(idx: number) {
    if (idx === 0) return;
    const next = [...racers];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    onChange(next);
  }

  function handleMoveDown(idx: number) {
    if (idx >= racers.length - 1) return;
    const next = [...racers];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    onChange(next);
  }

  function handleDelete(idx: number) {
    const r = racers[idx];
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

  // ── Render ─────────────────────────────────────────────────────────────────

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
            {racers.length} závodníků / {racerFieldCount} {racerFieldCount === 1 ? "pole" : "polí"}
          </span>
        </div>
        <button
          onClick={handleAdd}
          className="rounded-lg bg-amber-500 px-2.5 py-1 text-xs font-medium text-white hover:bg-amber-600 transition-colors"
        >
          + Přidat závodníka
        </button>
      </div>

      {/* Mismatch warning */}
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
              přidej ještě {racerFieldCount - racers.length}.
            </>
          ) : (
            <>
              ℹ️ V katalogu je <strong>{racers.length}</strong> závodníků, ale board
              má jen <strong>{racerFieldCount} racer {racerFieldCount === 1 ? "pole" : "polí"}</strong> —
              posledních {racers.length - racerFieldCount} závodník(ů) nebude nikde přiřazen.
            </>
          )}
        </div>
      )}

      {/* Prázdný stav */}
      {racers.length === 0 && (
        <div className="px-4 py-8 text-center text-sm text-slate-400 italic">
          Žádní závodníci — přidej prvního tlačítkem výše.
        </div>
      )}

      {/* Roster list */}
      <div className="divide-y divide-slate-100">
        {racers.map((r, idx) => {
          const isSelected = selectedId === r.id;
          const isOrphan   = idx >= racerFieldCount; // závodník bez racer pole na boardu

          return (
            <div key={r.id}>

              {/* Row */}
              <div
                className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors select-none ${
                  isSelected ? "bg-amber-50" : "hover:bg-slate-50"
                }`}
                onClick={() => setSelectedId(isSelected ? null : r.id)}
              >
                {/* Slot číslo */}
                <span className={`text-[10px] font-mono w-4 shrink-0 text-center ${
                  isOrphan ? "text-slate-300" : "text-slate-400"
                }`}>
                  {idx + 1}.
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

                {/* Pořadí + smazat — stopPropagation aby neklikl na row */}
                <div
                  className="flex items-center gap-0.5 shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
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
                </div>
              </div>

              {/* Inline RacerEditorPanel — rozbalí se po kliknutí */}
              {isSelected && (
                <div className="px-4 pb-3 bg-amber-50/40">
                  <RacerEditorPanel
                    racer={r}
                    onChange={handleChange}
                  />
                </div>
              )}

            </div>
          );
        })}
      </div>

      {/* Footer nápověda */}
      <div className="border-t border-slate-100 px-4 py-2 text-[10px] text-slate-400">
        Pořadí závodníků odpovídá pořadí racer polí na boardu (slot 1 → pole #1 zleva). ↑↓ přeřadí slot.
      </div>

    </div>
  );
}
