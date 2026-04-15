"use client";

/**
 * FieldEditorPanel — editor jednoho pole herní desky.
 *
 * Zobrazí se po kliknutí na pole v BoardEditorPreview.
 * Změny se šíří nahoru přes onChange — panel sám nic neukládá.
 *
 * Vrstvy:
 *   Formulář — přívětivé inputy pro label, emoji, type, amount
 *   JSON      — raw editor celého BoardFieldConfig objektu
 *   Assets    — vždy viditelná sekce s asset/texture mappingem pro dané pole
 *
 * Budoucí fáze:
 *   - upload obrázku přímo z asset sekce
 */

import React from "react";
import type { BoardFieldConfig, BoardFieldType } from "@/lib/board/types";

// ─── AssetSection config ──────────────────────────────────────────────────────

/**
 * AssetSectionConfig — informace o asset vrstvě pro jedno pole.
 *
 * Počítá ThemeDevTool z liveManifest + editableTextures/Images.
 * FieldEditorPanel jen zobrazí a předá změny nahoru přes onOverrideChange.
 */
export interface AssetSectionConfig {
  /** Asset klíč dle THEME_ASSETS, např. "fieldGain". null = neznámý typ. */
  assetKey: string | null;
  /** Kanonický název souboru, např. "field-gain.webp" nebo "racer-divoka_ruze.webp" */
  canonicalFile: string | null;
  /** Aktuálně resolved cesta (override ? override : canonical path) */
  resolvedPath: string | null;
  /** Momentální override z editovatelného manifestu. undefined = není nastaven. */
  override: string | undefined;
  /**
   * Voláno při změně override.
   * undefined = odeber override, použij canonical fallback.
   */
  onOverrideChange: (override: string | undefined) => void;
  /** Pro racer pole: id závodníka pro zobrazení v UI */
  racerId?: string;
}

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
  /** Asset vrstva — computed ThemeDevToolem. Pokud undefined, sekce se nezobrazí. */
  assetSection?: AssetSectionConfig;
}

type Tab = "form" | "json";

// ─── Komponenta ───────────────────────────────────────────────────────────────

export default function FieldEditorPanel({ field, onChange, assetSection }: Props) {
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

      {/* ── Asset sekce — vždy viditelná, nezávislá na tabu ── */}
      {assetSection && <AssetSection section={assetSection} fieldType={field.type} />}
    </div>
  );
}

// ─── AssetSection subkomponenta ───────────────────────────────────────────────

function AssetSection({
  section,
  fieldType,
}: {
  section: AssetSectionConfig;
  fieldType: string;
}) {
  const [imgOk, setImgOk] = React.useState(false);
  const [overrideInput, setOverrideInput] = React.useState(section.override ?? "");

  // Sync input při výběru nového pole (section se změní)
  React.useEffect(() => {
    setOverrideInput(section.override ?? "");
    setImgOk(false);
  }, [section.assetKey, section.racerId]); // klíče identifikující konkrétní asset slot

  const isOverrideActive = Boolean(section.override);
  const isUsingFallback = !section.resolvedPath;

  function handleApplyOverride() {
    const trimmed = overrideInput.trim();
    section.onOverrideChange(trimmed || undefined);
  }

  function handleClearOverride() {
    setOverrideInput("");
    section.onOverrideChange(undefined);
  }

  return (
    <div className="border-t border-slate-100 px-4 py-3 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
          Texture / Asset
        </span>
        {isOverrideActive && (
          <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-medium text-violet-700">
            override aktivní
          </span>
        )}
        {!isOverrideActive && !isUsingFallback && (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">
            canonical
          </span>
        )}
        {isUsingFallback && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] text-amber-700">
            fallback placeholder
          </span>
        )}
      </div>

      <div className="flex gap-3 items-start">
        {/* Miniatura — ukáže se jen pokud asset fyzicky existuje */}
        <div className="relative shrink-0 h-14 w-10 rounded border border-slate-200 bg-slate-50 overflow-hidden">
          {section.resolvedPath && (
            <img
              src={section.resolvedPath}
              alt=""
              className={`h-full w-full object-cover transition-opacity ${imgOk ? "opacity-100" : "opacity-0"}`}
              onLoad={() => setImgOk(true)}
              onError={() => setImgOk(false)}
            />
          )}
          {!imgOk && (
            <div className="absolute inset-0 flex items-center justify-center text-[16px]">
              🖼
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 space-y-1 min-w-0">
          {/* Asset key + canonical */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            {section.assetKey && (
              <span className="font-mono text-[10px] text-slate-400">{section.assetKey}</span>
            )}
            {section.racerId && (
              <span className="font-mono text-[10px] text-slate-400">racer: {section.racerId}</span>
            )}
            {section.canonicalFile && (
              <span className="font-mono text-[10px] text-slate-500 bg-slate-100 px-1 rounded">
                {section.canonicalFile}
              </span>
            )}
          </div>

          {/* Resolved path */}
          <div
            className="font-mono text-[10px] break-all leading-relaxed text-slate-500"
            title={section.resolvedPath ?? "—"}
          >
            {section.resolvedPath
              ? <span className={isOverrideActive ? "text-violet-600" : ""}>{section.resolvedPath}</span>
              : <span className="italic text-slate-400">— žádná cesta</span>}
          </div>

          {/* Field type info — výsledek platí pro všechna pole tohoto type */}
          {fieldType !== "racer" && (
            <div className="text-[10px] text-amber-600">
              Platí pro všechna pole type <code className="font-mono">{fieldType}</code> v tomto tématu
            </div>
          )}
        </div>
      </div>

      {/* Override input */}
      <div className="space-y-1.5">
        <label className="block text-xs font-medium text-slate-500">
          Override cesta{" "}
          <span className="font-normal text-slate-400">(prázdné = canonical)</span>
        </label>
        <div className="flex gap-1.5">
          <input
            type="text"
            value={overrideInput}
            onChange={(e) => setOverrideInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleApplyOverride(); }}
            placeholder={section.canonicalFile ? `/themes/moje-theme/${section.canonicalFile}` : "/themes/moje-theme/..."}
            className="flex-1 min-w-0 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-300 placeholder:text-slate-400"
          />
          <button
            onClick={handleApplyOverride}
            className="shrink-0 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-700"
          >
            Použít
          </button>
          {isOverrideActive && (
            <button
              onClick={handleClearOverride}
              className="shrink-0 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
              title="Odeber override, vrátit na canonical"
            >
              ✕
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
