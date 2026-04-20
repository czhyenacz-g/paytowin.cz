"use client";

/**
 * DeckEditorPanel — editor balíčků Náhoda a Finance pro board editor.
 *
 * Zobrazuje se v ThemeDevTool pod RacerRosterPanel.
 * Umožňuje:
 *   - vidět karty v obou balíčcích (vlastní nebo globální fallback)
 *   - přidat / smazat / přeřadit vlastní karty
 *   - editovat text, effectLabel, kind, value, racerId inline
 *   - pokud je deck prázdný, hra použije globální karty z lib/cards.ts
 *
 * Export dat: ThemeDevTool → EditorExportPanel záložka "Decky"
 */

import React from "react";
import type { GameCard, CardEffectKind } from "@/lib/cards";
import { CHANCE_CARDS, FINANCE_CARDS } from "@/lib/cards";

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  chanceDeck:    GameCard[];
  financeDeck:   GameCard[];
  onChangeChance:  (cards: GameCard[]) => void;
  onChangeFinance: (cards: GameCard[]) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const KIND_LABELS: Record<CardEffectKind, string> = {
  coins:          "Coins",
  move:           "Posun",
  skip_turn:      "Přeskoč tah",
  give_racer:     "Závodník",
  stamina_debuff: "Stamina debuff",
};

const KIND_COLORS: Record<CardEffectKind, string> = {
  coins:          "bg-emerald-100 text-emerald-700",
  move:           "bg-sky-100 text-sky-700",
  skip_turn:      "bg-amber-100 text-amber-700",
  give_racer:     "bg-violet-100 text-violet-700",
  stamina_debuff: "bg-orange-100 text-orange-700",
};

function generateId(type: "chance" | "finance", existing: GameCard[]): string {
  const prefix = type === "chance" ? "ch" : "fi";
  const ids = new Set(existing.map((c) => c.id));
  let i = existing.length + 1;
  while (ids.has(`${prefix}${i}`)) i++;
  return `${prefix}${i}`;
}

function autoEffectLabel(kind: CardEffectKind, value: string, racerId: string): string {
  if (kind === "coins") {
    const v = Number(value) || 0;
    return `${v >= 0 ? "+" : ""}${v} 💰`;
  }
  if (kind === "move") {
    const v = Number(value) || 0;
    return `Posun ${v >= 0 ? "+" : ""}${v} pole`;
  }
  if (kind === "skip_turn") return "Vynecháš příští tah";
  if (kind === "give_racer") return racerId ? `🐴 ${racerId}` : "🐴 Závodník zdarma";
  return "";
}

// ─── CardEditor — inline editor jedné karty ───────────────────────────────────

function CardEditor({ card, onUpdate }: { card: GameCard; onUpdate: (updated: GameCard) => void }) {
  const [text, setText]               = React.useState(card.text);
  const [effectLabel, setEffectLabel] = React.useState(card.effectLabel);
  const [kind, setKind]               = React.useState<CardEffectKind>(card.effect.kind);
  const [value, setValue]             = React.useState(String(card.effect.value ?? ""));
  const [racerId, setRacerId]         = React.useState(card.effect.racerId ?? "");
  const [imagePath, setImagePath]     = React.useState(card.imagePath ?? "");

  // Sync při přepnutí karty
  React.useEffect(() => {
    setText(card.text);
    setEffectLabel(card.effectLabel);
    setKind(card.effect.kind);
    setValue(String(card.effect.value ?? ""));
    setRacerId(card.effect.racerId ?? "");
    setImagePath(card.imagePath ?? "");
  }, [card.id]);

  function buildEffect(): GameCard["effect"] {
    const e: GameCard["effect"] = { kind };
    if ((kind === "coins" || kind === "move") && value !== "") e.value = Number(value);
    if (kind === "give_racer" && racerId.trim()) e.racerId = racerId.trim();
    return e;
  }

  function commit() {
    onUpdate({ ...card, text, effectLabel, effect: buildEffect(), imagePath: imagePath.trim() || undefined });
  }

  function handleAutoLabel() {
    const generated = autoEffectLabel(kind, value, racerId);
    setEffectLabel(generated);
    onUpdate({ ...card, text, effectLabel: generated, effect: buildEffect() });
  }

  const showValue   = kind === "coins" || kind === "move";
  const showRacerId = kind === "give_racer";

  return (
    <div className="space-y-2.5 px-4 pb-3 pt-2 bg-slate-50/70 border-t border-slate-100">

      {/* Text */}
      <div className="space-y-1">
        <label className="block text-[11px] font-medium text-slate-500">Text karty</label>
        <textarea
          value={text}
          rows={2}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300"
        />
      </div>

      {/* Kind + params */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="block text-[11px] font-medium text-slate-500">Efekt</label>
          <select
            value={kind}
            onChange={(e) => {
              const k = e.target.value as CardEffectKind;
              setKind(k);
              if (k !== "coins" && k !== "move") setValue("");
              if (k !== "give_racer") setRacerId("");
            }}
            onBlur={commit}
            className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          >
            <option value="coins">Coins (±)</option>
            <option value="move">Posun (pole)</option>
            <option value="skip_turn">Přeskoč tah</option>
            <option value="give_racer">Závodník zdarma</option>
          </select>
        </div>

        {showValue && (
          <div className="space-y-1">
            <label className="block text-[11px] font-medium text-slate-500">
              {kind === "coins" ? "Coins (±, např. 100 nebo −80)" : "Polí (±, např. 2 nebo −3)"}
            </label>
            <input
              type="number"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onBlur={commit}
              placeholder={kind === "coins" ? "100" : "2"}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>
        )}

        {showRacerId && (
          <div className="space-y-1">
            <label className="block text-[11px] font-medium text-slate-500">Racer ID (prázdné = náhodný volný)</label>
            <input
              type="text"
              value={racerId}
              onChange={(e) => setRacerId(e.target.value)}
              onBlur={commit}
              placeholder="legendary_racer"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>
        )}
      </div>

      {/* Image path */}
      <div className="space-y-1">
        <label className="block text-[11px] font-medium text-slate-500">
          Art obrázek
          <span className="ml-1 font-normal text-slate-400">— cesta do /public, např. /cards/zeleznik.webp (prázdné = žádný obrázek)</span>
        </label>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={imagePath}
            onChange={(e) => setImagePath(e.target.value)}
            onBlur={commit}
            placeholder="/cards/zeleznik-reveal.webp"
            className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
          {imagePath.trim() && (
            <button
              onClick={() => { setImagePath(""); onUpdate({ ...card, text, effectLabel, effect: buildEffect(), imagePath: undefined }); }}
              className="shrink-0 rounded-lg border border-slate-200 px-2 py-2 text-[11px] text-slate-400 hover:text-red-500"
              title="Smazat obrázek"
            >
              ✕
            </button>
          )}
        </div>
        {imagePath.trim() && (
          <div className="mt-1 overflow-hidden rounded-lg border border-slate-200 bg-slate-100" style={{ maxHeight: "80px" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imagePath.trim()} alt="" className="w-full object-cover" style={{ maxHeight: "80px" }} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          </div>
        )}
      </div>

      {/* Effect label */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <label className="block text-[11px] font-medium text-slate-500">Zkratka (effectLabel) — zobrazí se v modálu</label>
          <button
            onClick={handleAutoLabel}
            className="text-[10px] text-indigo-500 hover:text-indigo-700 underline"
          >
            Auto
          </button>
        </div>
        <input
          type="text"
          value={effectLabel}
          onChange={(e) => setEffectLabel(e.target.value)}
          onBlur={commit}
          placeholder="+100 💰"
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-300"
        />
      </div>

      <div className="text-[10px] text-slate-300 font-mono">id: {card.id}</div>
    </div>
  );
}

// ─── DeckPanel — jeden balíček (Náhoda nebo Finance) ──────────────────────────

function DeckPanel({
  type, label, emoji, accentBg,
  cards, globalCards,
  onChange,
}: {
  type:        "chance" | "finance";
  label:       string;
  emoji:       string;
  accentBg:    string;
  cards:       GameCard[];
  globalCards: GameCard[];
  onChange:    (cards: GameCard[]) => void;
}) {
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const isUsingGlobal = cards.length === 0;
  const displayCards  = isUsingGlobal ? globalCards : cards;

  function handleAdd() {
    const newCard: GameCard = {
      id:          generateId(type, cards),
      type,
      text:        "Nová karta.",
      effect:      { kind: "coins", value: 0 },
      effectLabel: "+0 💰",
    };
    onChange([...cards, newCard]);
    setSelectedId(newCard.id);
  }

  function handleDelete(id: string) {
    if (!window.confirm("Smazat kartu?")) return;
    onChange(cards.filter((c) => c.id !== id));
    if (selectedId === id) setSelectedId(null);
  }

  function handleMoveUp(idx: number) {
    if (idx === 0) return;
    const next = [...cards];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    onChange(next);
  }

  function handleMoveDown(idx: number) {
    if (idx >= cards.length - 1) return;
    const next = [...cards];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    onChange(next);
  }

  function handleUpdate(updated: GameCard) {
    onChange(cards.map((c) => (c.id === updated.id ? updated : c)));
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">

      {/* Header */}
      <div className={`flex items-center justify-between px-4 py-2.5 border-b border-slate-100 ${accentBg}`}>
        <div className="flex items-center gap-2">
          <span className="text-base">{emoji}</span>
          <span className="text-xs font-semibold text-slate-700">{label}</span>
          <span className="rounded-full px-2 py-0.5 text-[10px] font-bold bg-white/60 text-slate-500">
            {isUsingGlobal
              ? `${globalCards.length} karet (globální)`
              : `${cards.length} karet (vlastní)`}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {isUsingGlobal && (
            <button
              onClick={() => { onChange([...globalCards]); }}
              className="rounded-lg bg-white/70 hover:bg-white px-2.5 py-1 text-xs font-medium text-slate-700 border border-slate-200 transition-colors"
              title="Zkopíruje globální karty do vlastního decku pro editaci"
            >
              Importovat globální
            </button>
          )}
          <button
            onClick={handleAdd}
            className="rounded-lg bg-white/70 hover:bg-white px-2.5 py-1 text-xs font-medium text-slate-700 border border-slate-200 transition-colors"
          >
            + Přidat
          </button>
        </div>
      </div>

      {/* Global fallback note */}
      {isUsingGlobal && (
        <div className="px-4 py-2 text-[11px] text-slate-400 border-b border-slate-100 bg-white italic">
          Prázdný deck — hra používá globální karty z <code className="font-mono">lib/cards.ts</code>.
          Klikni <strong>Importovat globální</strong> pro editaci, nebo <strong>+ Přidat</strong> pro novou kartu.
        </div>
      )}

      {/* List */}
      <div className="divide-y divide-slate-100">
        {displayCards.map((card, idx) => {
          const isEditable = !isUsingGlobal;
          const isSelected = isEditable && selectedId === card.id;

          return (
            <div key={card.id}>
              <div
                className={`flex items-center gap-3 px-4 py-2.5 transition-colors ${
                  isEditable ? "cursor-pointer" : "cursor-default"
                } ${isSelected ? "bg-indigo-50" : isEditable ? "hover:bg-slate-50" : "opacity-55"}`}
                onClick={() => isEditable && setSelectedId(isSelected ? null : card.id)}
              >
                {/* Kind badge */}
                <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${KIND_COLORS[card.effect.kind]}`}>
                  {KIND_LABELS[card.effect.kind]}
                </span>

                {/* Text */}
                <span className="flex-1 min-w-0 text-xs text-slate-700 truncate">{card.text}</span>

                {/* Effect label */}
                <span className="shrink-0 text-[10px] font-mono text-slate-400 hidden sm:block">{card.effectLabel}</span>

                {/* Actions */}
                {isEditable && (
                  <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => handleMoveUp(idx)} disabled={idx === 0}
                      className="rounded p-1 text-[10px] text-slate-400 hover:text-slate-700 disabled:opacity-20">↑</button>
                    <button onClick={() => handleMoveDown(idx)} disabled={idx >= cards.length - 1}
                      className="rounded p-1 text-[10px] text-slate-400 hover:text-slate-700 disabled:opacity-20">↓</button>
                    <button onClick={() => handleDelete(card.id)}
                      className="ml-1 rounded p-1 text-[10px] text-slate-400 hover:text-red-500">✕</button>
                  </div>
                )}
              </div>

              {/* Inline editor */}
              {isSelected && <CardEditor card={card} onUpdate={handleUpdate} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export default function DeckEditorPanel({ chanceDeck, financeDeck, onChangeChance, onChangeFinance }: Props) {
  return (
    <div className="space-y-3">
      <DeckPanel
        type="chance" label="Osud" emoji="🎴" accentBg="bg-sky-50"
        cards={chanceDeck} globalCards={CHANCE_CARDS} onChange={onChangeChance}
      />
      <DeckPanel
        type="finance" label="Finance" emoji="💼" accentBg="bg-teal-50"
        cards={financeDeck} globalCards={FINANCE_CARDS} onChange={onChangeFinance}
      />
    </div>
  );
}
