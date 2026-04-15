"use client";

/**
 * ThemeAssetInspector — autor/debug panel pro theme asset mapping.
 *
 * Zobrazuje:
 *   - aktivní themeId + base path
 *   - board-bg, center-bg, preview pathy
 *   - field type → asset key → resolved path (nebo manifest override)
 *   - závodníci → asset path (nebo manifest override)
 *
 * Zapnutí:  přidej ?isdevelop=1 do URL (nebo &isdevelop=1)
 * Vypnutí:  ?isdevelop=0 nebo odstraň parametr
 *
 * Collapsible — klikni na hlavičku.
 */

import React from "react";
import { themeToManifest } from "@/lib/themes/manifest";
import type { Theme } from "@/lib/themes";
import {
  themeAssetPath,
  racerAssetPath,
  THEME_ASSETS,
  fieldAssetKey,
} from "@/lib/themes/assets";

// ─── Typy polí pro výpis ──────────────────────────────────────────────────────

const FIELD_TYPES: Array<{ type: string; label: string }> = [
  { type: "start",      label: "START" },
  { type: "coins_gain", label: "Zisk" },
  { type: "coins_lose", label: "Ztráta" },
  { type: "gamble",     label: "Hazard" },
  { type: "racer",      label: "Závodník" },
  { type: "chance",     label: "Náhoda" },
  { type: "finance",    label: "Finance" },
  { type: "neutral",    label: "Neutrální" },
];

// ─── Sub-komponenty ───────────────────────────────────────────────────────────

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="grid grid-cols-[100px_1fr] gap-2">
      <span className="text-slate-500 shrink-0">{label}</span>
      <span className={highlight ? "text-amber-400" : "text-slate-300 break-all"}>{value}</span>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-t border-slate-700 pt-2 mt-1">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">{children}</span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  themeId: string;
  theme: Theme;
}

export default function ThemeAssetInspector({ themeId, theme }: Props) {
  const [enabled, setEnabled] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  // Čte ?isdevelop=1 z URL — bezpečně jen na klientu
  React.useEffect(() => {
    const param = new URLSearchParams(window.location.search).get("isdevelop");
    setEnabled(param === "1");
  }, []);

  const manifest = themeToManifest(theme);

  // Pokud parametr není aktivní, nerenderujeme nic
  if (!enabled) return null;
  const basePath = `/themes/${themeId}/`;

  // Board assety — manifest override bere přednost (kompatibilita s DB themes)
  const boardBgPath  = manifest.assets?.boardBackgroundImage ?? themeAssetPath(themeId, THEME_ASSETS.boardBg);
  const centerBgPath = themeAssetPath(themeId, THEME_ASSETS.centerBg);
  const previewPath  = themeAssetPath(themeId, THEME_ASSETS.preview);

  const hasBoardOverride = !!manifest.assets?.boardBackgroundImage;

  return (
    <div className="mx-auto max-w-[760px] font-mono text-xs select-none">
      {/* Toggle button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full text-left px-3 py-1.5 rounded-lg bg-slate-800/50 text-slate-400 hover:text-slate-200 hover:bg-slate-700/60 transition-colors"
      >
        {open ? "▾" : "▸"}{" "}
        <span className="text-slate-500">Asset Inspector</span>{" — "}
        theme: <span className="text-amber-400">{themeId}</span>
      </button>

      {/* Panel */}
      {open && (
        <div className="mt-1 rounded-lg border border-slate-700 bg-slate-900/95 p-3 space-y-1 text-slate-300 leading-relaxed">

          {/* Identita */}
          <Row label="themeId"   value={themeId} highlight />
          <Row label="basePath"  value={basePath} />

          {/* Board assety */}
          <SectionLabel>Board assety</SectionLabel>
          <Row
            label="board-bg"
            value={boardBgPath + (hasBoardOverride ? "  ← manifest override" : "")}
            highlight={hasBoardOverride}
          />
          <Row label="center-bg" value={centerBgPath} />
          <Row label="preview"   value={previewPath} />

          {/* Pole */}
          <SectionLabel>Pole — field type → asset key → path</SectionLabel>
          {FIELD_TYPES.map(({ type, label }) => {
            const key  = fieldAssetKey(type);
            const path = key ? themeAssetPath(themeId, THEME_ASSETS[key]) : "—";
            const override = manifest.assets?.fieldTextures?.[type];
            return (
              <div key={type} className="grid grid-cols-[90px_100px_1fr] gap-1 items-baseline">
                <span className="text-slate-500">{type}</span>
                <span className="text-slate-400">{key ?? "—"}</span>
                <span className={override ? "text-emerald-400" : "text-slate-400"}>
                  {override ?? path}
                  {override && <span className="ml-1 text-emerald-700">← manifest override</span>}
                </span>
              </div>
            );
          })}

          {/* Závodníci */}
          <SectionLabel>Závodníci — racer.id → path</SectionLabel>
          {manifest.racers.map((r) => {
            const override  = manifest.assets?.racerImages?.[r.id];
            const path      = override ?? racerAssetPath(themeId, r.id);
            const hasOverride = !!override;
            return (
              <div key={r.id} className="grid grid-cols-[130px_1fr] gap-1 items-baseline">
                <span className="text-slate-500">
                  {r.emoji} {r.id}
                </span>
                <span className={hasOverride ? "text-emerald-400" : "text-slate-400"}>
                  {path}
                  {hasOverride && <span className="ml-1 text-emerald-700">← manifest override</span>}
                </span>
              </div>
            );
          })}

          {/* Fallback note */}
          <div className="border-t border-slate-800 pt-2 text-[10px] text-slate-600 leading-relaxed">
            Pathy jsou konvenční — soubory zatím nemusí existovat.
            Pokud soubor chybí, UI fallbackuje na CSS barvy z theme.colors.
          </div>
        </div>
      )}
    </div>
  );
}
