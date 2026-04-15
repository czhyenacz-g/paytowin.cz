"use client";

/**
 * FieldEditorPanel — editor jednoho pole herní desky.
 *
 * Zobrazí se po kliknutí na pole v BoardEditorPreview.
 * Změny se šíří nahoru přes onChange — panel sám nic neukládá.
 *
 * Dvě vrstvy:
 *   Formulář — přívětivé inputy pro label, emoji, type, amount
 *   JSON      — raw editor celého BoardFieldConfig objektu
 *
 * Budoucí fáze:
 *   - sekce Assets: override fieldTextures / racerImages per pole
 *   - upload obrázku přímo z panelu
 */

import React from "react";
import type { BoardFieldConfig, BoardFieldType } from "@/lib/board/types";

// ─── Konstanty ────────────────────────────────────────────────────────────────

const FIELD_TYPES: BoardFieldType[] = [
  "start",
  "coins_gain",
  "coins_lose",
  "gamble",
  "racer",
  "neutral",
  "chance",
  "finance",
];

const FIELD_TYPE_LABELS: Record<BoardFieldType, string> = {
  start:      "START — začátek kola",
  coins_gain: "Zisk coinů",
  coins_lose: "Ztráta coinů",
  gamble:     "Hazard",
  racer:      "Závodník (racer slot)",
  neutral:    "Neutrální",
  chance:     "Náhoda (karta)",
  finance:    "Finance (karta)",
};

/** Typy polí kde amount dává smysl */
const AMOUNT_TYPES: BoardFieldType[] = ["start", "coins_gain", "coins_lose"];

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  field: BoardFieldConfig;
  /** Voláno okamžitě při každé změně. Parent drží stav. */
  onChange: (updated: BoardFieldConfig) => void;
}

type Tab = "form" | "json";

// ─── Komponenta ───────────────────────────────────────────────────────────────

export default function FieldEditorPanel({ field, onChange }: Props) {
  const [tab, setTab] = React.useState<Tab>("form");
  const [rawJson, setRawJson] = React.useState(() => JSON.stringify(field, null, 2));
  const [jsonError, setJsonError] = React.useState<string | null>(null);

  // Sync rawJson při přepnutí na nové pole (nebo změně zvenčí)
  // Reaguje na změnu index — každé pole má unikátní index
  React.useEffect(() => {
    setRawJson(JSON.stringify(field, null, 2));
    setJsonError(null);
    setTab("form"); // reset na form tab při výběru nového pole
  }, [field.index]); // eslint-disable-line react-hooks/exhaustive-deps
  // ^ záměrně pouze field.index — nechceme přepisovat rawJson při každé dílčí změně z formu

  // Sync rawJson při přepnutí na JSON tab (aby odrážel aktuální stav formu)
  function handleTabSwitch(next: Tab) {
    if (next === "json") {
      setRawJson(JSON.stringify(field, null, 2));
      setJsonError(null);
    }
    setTab(next);
  }

  function handleFormChange(patch: Partial<BoardFieldConfig>) {
    onChange({ ...field, ...patch });
  }

  function handleJsonApply() {
    try {
      const parsed = JSON.parse(rawJson) as BoardFieldConfig;

      // Bezpečnostní kontroly — index musí zůstat stejný
      if (typeof parsed.index !== "number") {
        setJsonError("index musí být číslo");
        return;
      }
      if (parsed.index !== field.index) {
        setJsonError(`index musí zůstat ${field.index} — nelze přesunout pole`);
        return;
      }
      if (!FIELD_TYPES.includes(parsed.type)) {
        setJsonError(`neplatný type: "${parsed.type}" — povolené: ${FIELD_TYPES.join(", ")}`);
        return;
      }
      if (typeof parsed.label !== "string" || !parsed.label.trim()) {
        setJsonError("label nesmí být prázdný string");
        return;
      }
      if (typeof parsed.emoji !== "string") {
        setJsonError("emoji musí být string");
        return;
      }
      if (parsed.amount !== undefined && typeof parsed.amount !== "number") {
        setJsonError("amount musí být číslo nebo undefined");
        return;
      }

      setJsonError(null);
      onChange(parsed);
    } catch (e) {
      setJsonError("JSON chyba: " + (e instanceof Error ? e.message : String(e)));
    }
  }

  const amountRelevant = AMOUNT_TYPES.includes(field.type);

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2.5">
        <span className="text-xl leading-none">{field.emoji}</span>
        <span className="font-semibold text-slate-700 text-sm">{field.label}</span>
        <span className="font-mono text-xs text-slate-400">
          #{field.index} · {field.type}
        </span>

        {/* Tab switcher */}
        <div className="ml-auto flex rounded-lg border border-slate-200 bg-white overflow-hidden text-xs">
          <button
            onClick={() => handleTabSwitch("form")}
            className={`px-3 py-1.5 font-medium transition-colors ${
              tab === "form" ? "bg-slate-800 text-white" : "text-slate-500 hover:bg-slate-50"
            }`}
          >
            Formulář
          </button>
          <button
            onClick={() => handleTabSwitch("json")}
            className={`px-3 py-1.5 font-medium transition-colors border-l border-slate-200 ${
              tab === "json" ? "bg-slate-800 text-white" : "text-slate-500 hover:bg-slate-50"
            }`}
          >
            JSON
          </button>
        </div>
      </div>

      <div className="p-4">

        {/* ── Formulář ── */}
        {tab === "form" && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">

              {/* Label */}
              <div className="col-span-2 space-y-1">
                <label className="block text-xs font-medium text-slate-500">Label</label>
                <input
                  type="text"
                  value={field.label}
                  onChange={(e) => handleFormChange({ label: e.target.value })}
                  placeholder="Název pole"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>

              {/* Emoji */}
              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-500">Emoji</label>
                <input
                  type="text"
                  value={field.emoji}
                  onChange={(e) => handleFormChange({ emoji: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>

              {/* Type */}
              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-500">Type</label>
                <select
                  value={field.type}
                  onChange={(e) => handleFormChange({ type: e.target.value as BoardFieldType })}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                >
                  {FIELD_TYPES.map((t) => (
                    <option key={t} value={t}>{FIELD_TYPE_LABELS[t]}</option>
                  ))}
                </select>
              </div>

              {/* Amount — jen pro relevantní typy polí */}
              {amountRelevant && (
                <div className="col-span-2 space-y-1">
                  <label className="block text-xs font-medium text-slate-500">
                    Amount (coins)
                    {field.type === "coins_lose" && (
                      <span className="ml-1 text-red-500">— záporné číslo (např. −60)</span>
                    )}
                    {field.type === "coins_gain" && (
                      <span className="ml-1 text-emerald-600">— kladné číslo (např. 100)</span>
                    )}
                    {field.type === "start" && (
                      <span className="ml-1 text-slate-400">— start bonus (např. 200)</span>
                    )}
                  </label>
                  <input
                    type="number"
                    value={field.amount ?? ""}
                    onChange={(e) =>
                      handleFormChange({
                        amount: e.target.value === "" ? undefined : parseInt(e.target.value, 10),
                      })
                    }
                    placeholder={
                      field.type === "coins_lose" ? "-60" : field.type === "start" ? "200" : "100"
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                </div>
              )}
            </div>

            {/* Index — pouze info, nelze měnit */}
            <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-500">
              <span className="font-mono font-medium">index: {field.index}</span>
              <span className="mx-2 text-slate-300">·</span>
              pozice pole na desce — read-only
            </div>
          </div>
        )}

        {/* ── JSON editor ── */}
        {tab === "json" && (
          <div className="space-y-2">
            <textarea
              value={rawJson}
              onChange={(e) => {
                setRawJson(e.target.value);
                setJsonError(null);
              }}
              spellCheck={false}
              rows={10}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 text-slate-100 px-3 py-2 font-mono text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-y"
            />

            {jsonError && (
              <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700 font-mono">
                {jsonError}
              </div>
            )}

            <div className="flex items-center gap-2">
              <button
                onClick={handleJsonApply}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                Aplikovat JSON
              </button>
              <button
                onClick={() => {
                  setRawJson(JSON.stringify(field, null, 2));
                  setJsonError(null);
                }}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Reset
              </button>
              <span className="ml-auto text-xs text-slate-400">
                index musí zůstat {field.index}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
