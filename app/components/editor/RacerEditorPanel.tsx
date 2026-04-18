"use client";

/**
 * RacerEditorPanel — editor jednoho závodníka (RacerConfig).
 *
 * Zobrazuje se v ThemeDevTool vedle FieldEditorPanel, pokud je vybráno racer pole.
 * Umožňuje upravit: name (label), speed, stamina, flavorText (flavor text).
 *
 * Neovlivňuje GameBoard, herní logiku ani jiné komponenty.
 * Data žijí v editableRacers local state ThemeDevTool → liveManifest.racers.
 */

import React from "react";
import type { RacerConfig } from "@/lib/themes";

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  racer: RacerConfig;
  onChange: (updated: RacerConfig) => void;
  /** Pokud true, editor je jen pro čtení — built-in racer nelze editovat. */
  readOnly?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clampInt(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(val)));
}

/** Sanitizuje ID na slug: lowercase, jen a-z 0-9 _ - */
function sanitizeId(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 40) || "r_new";
}

// ─── Komponenta ───────────────────────────────────────────────────────────────

export default function RacerEditorPanel({ racer, onChange, readOnly = false }: Props) {
  // Flash "uloženo" po každém commitu
  const [saved, setSaved] = React.useState(false);
  const savedTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  function flashSaved() {
    setSaved(true);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSaved(false), 1500);
  }
  React.useEffect(() => () => { if (savedTimer.current) clearTimeout(savedTimer.current); }, []);

  // Lokální stav — synchronizován s prop při změně racerId
  const [idVal, setIdVal] = React.useState(racer.id);
  const [name, setName] = React.useState(racer.name);
  const [speed, setSpeed] = React.useState(String(racer.speed));
  const [price, setPrice] = React.useState(String(racer.price));
  // maxStamina: čteme z nového pole; fallback na deprecated stamina pro starší data
  const [maxStamina, setMaxStamina] = React.useState(String(racer.maxStamina ?? racer.stamina ?? 100));
  const [isLegendary, setIsLegendary] = React.useState(racer.isLegendary ?? false);
  // flavorText: preferuj flavorText, fallback na deprecated heroText pro compat
  const [flavorText, setFlavorText] = React.useState(racer.flavorText ?? racer.heroText ?? "");

  // Sync: pokud parent změní racera (jiný racer slot), resetuj lokální stav
  React.useEffect(() => {
    setIdVal(racer.id);
    setName(racer.name);
    setSpeed(String(racer.speed));
    setPrice(String(racer.price));
    setMaxStamina(String(racer.maxStamina ?? racer.stamina ?? 100));
    setIsLegendary(racer.isLegendary ?? false);
    setFlavorText(racer.flavorText ?? racer.heroText ?? "");
  }, [racer.id]);

  // Zavolá onChange jen tehdy, kdy jsou hodnoty platné a lišící se
  function commit(overrides: Partial<{ name: string; speed: number; price: number; maxStamina: number; isLegendary: boolean; flavorText: string }>) {
    const parsedSpeed      = clampInt(Number(overrides.speed      ?? speed),      1, 10);
    const parsedPrice      = clampInt(Number(overrides.price      ?? price),      0, 99999);
    const parsedMaxStamina = clampInt(Number(overrides.maxStamina ?? maxStamina),  0, 100);
    onChange({
      ...racer,
      name:        overrides.name        ?? name,
      speed:       parsedSpeed,
      price:       parsedPrice,
      maxStamina:  parsedMaxStamina,
      isLegendary: (overrides.isLegendary ?? isLegendary) || undefined, // false → undefined (čistší data)
      stamina:     undefined, // vynuluj deprecated pole po první editaci
      flavorText:  (overrides.flavorText ?? flavorText) || undefined, // prázdný string → undefined
      heroText:    undefined, // explicitně vynuluj deprecated pole po první editaci
    });
    flashSaved();
  }

  return (
    <div className={`rounded-xl border overflow-hidden ${readOnly ? "border-slate-200 bg-slate-50" : "border-amber-200 bg-amber-50"}`}>

      {/* Header */}
      <div className={`flex items-center gap-2 border-b px-4 py-2.5 ${readOnly ? "border-slate-200 bg-slate-100/60" : "border-amber-200 bg-amber-100/60"}`}>
        <span className="text-base">{racer.emoji}</span>
        <span className={`text-xs font-semibold ${readOnly ? "text-slate-500" : "text-amber-800"}`}>Závodník</span>
        <span className={`font-mono text-[10px] rounded px-1.5 py-0.5 ${readOnly ? "text-slate-400 bg-slate-200" : "text-amber-600 bg-amber-100"}`}>
          {racer.id}
        </span>
        {readOnly ? (
          <span className="ml-auto text-[10px] font-medium text-slate-400 flex items-center gap-1">
            🔒 vestavěný · nelze editovat
          </span>
        ) : (
          <span
            className="ml-auto text-[10px] font-medium text-emerald-600 transition-opacity duration-300"
            style={{ opacity: saved ? 1 : 0 }}
          >
            ✓ uloženo
          </span>
        )}
      </div>

      {/* Formulář */}
      <div className={`px-4 py-3 space-y-3 ${readOnly ? "opacity-60 pointer-events-none select-none" : ""}`}>

        {/* ID + Jméno — 2 sloupce */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-amber-700">
              ID
              <span className="ml-1 font-normal text-amber-500">— slug, jen a-z 0-9 _-</span>
            </label>
            <input
              type="text"
              value={idVal}
              onChange={(e) => setIdVal(e.target.value)}
              onBlur={() => {
                const sanitized = sanitizeId(idVal);
                setIdVal(sanitized);
                onChange({ ...racer, id: sanitized });
                flashSaved();
              }}
              placeholder="zeleznik"
              className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm text-slate-900 font-mono placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-300"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-medium text-amber-700">Jméno</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => commit({ name })}
              placeholder="Divoká růže"
              className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-300"
            />
          </div>
        </div>

        {/* Speed + Price + Stamina — 3 sloupce */}
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-amber-700">
              Speed
              <span className="ml-1 font-normal text-amber-500">(1–10)</span>
            </label>
            <input
              type="number"
              min={1}
              max={10}
              value={speed}
              onChange={(e) => setSpeed(e.target.value)}
              onBlur={() => {
                const v = clampInt(Number(speed), 1, 10);
                setSpeed(String(v));
                commit({ speed: v });
              }}
              className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-amber-300"
            />
            {/* Vizuální indikátor */}
            <div className="flex gap-0.5 mt-1">
              {Array.from({ length: 10 }).map((_, i) => (
                <div
                  key={i}
                  className={`h-1 flex-1 rounded-sm ${i < Number(speed) ? "bg-amber-400" : "bg-amber-100"}`}
                />
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-amber-700">
              Cena
              <span className="ml-1 font-normal text-amber-500">(coins)</span>
            </label>
            <input
              type="number"
              min={0}
              max={99999}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              onBlur={() => {
                const v = clampInt(Number(price), 0, 99999);
                setPrice(String(v));
                commit({ price: v });
              }}
              className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-amber-300"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-amber-700">
              Max stamina
              <span className="ml-1 font-normal text-amber-500">(0–100)</span>
            </label>
            <input
              type="number"
              min={0}
              max={100}
              value={maxStamina}
              onChange={(e) => setMaxStamina(e.target.value)}
              onBlur={() => {
                const v = clampInt(Number(maxStamina), 0, 100);
                setMaxStamina(String(v));
                commit({ maxStamina: v });
              }}
              className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-amber-300"
            />
            {/* Max stamina bar */}
            <div className="h-1 rounded-sm bg-amber-100 mt-1 overflow-hidden">
              <div
                className="h-full rounded-sm bg-emerald-400 transition-all"
                style={{ width: `${Math.min(100, Math.max(0, Number(maxStamina)))}%` }}
              />
            </div>
          </div>
        </div>

        {/* Legendary flag */}
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={isLegendary}
            onChange={(e) => {
              setIsLegendary(e.target.checked);
              commit({ isLegendary: e.target.checked });
            }}
            className="h-4 w-4 rounded border-amber-300 text-amber-500 focus:ring-amber-300"
          />
          <span className="text-xs font-medium text-amber-700">
            Legendární
            <span className="ml-1 font-normal text-amber-500">— speciální hláška při ztrátě racera</span>
          </span>
        </label>

        {/* Flavor text */}
        <div className="space-y-1">
          <label className="block text-xs font-medium text-amber-700">
            Flavor text
            <span className="ml-1 font-normal text-amber-500">— příběh / popis, zobrazí se při hoveru na kartu</span>
          </label>
          <textarea
            value={flavorText}
            onChange={(e) => setFlavorText(e.target.value)}
            onBlur={() => commit({ flavorText })}
            rows={3}
            placeholder="Veterán závodního okruhu, který ještě neřekl své poslední slovo…"
            className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-amber-300"
          />
          <div className="text-[10px] text-amber-400 text-right">
            {flavorText.length > 0 ? `${flavorText.length} znaků` : "prázdné — popis nebude zobrazen"}
          </div>
        </div>

      </div>
    </div>
  );
}
