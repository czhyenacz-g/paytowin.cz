"use client";

/**
 * ThemeAssetInspector — autor/debug panel pro theme asset mapping.
 *
 * Zobrazuje:
 *   - aktivní themeId + base path
 *   - board-bg, center-bg, preview pathy
 *   - field type → asset key → resolved path + stav existence
 *   - závodníci → asset path + stav existence
 *
 * Stav existence: ✓ existuje  ✗ chybí  ⋯ ověřuji
 * Checks se spustí paralelně přes HEAD request při prvním otevření panelu.
 *
 * Zapnutí:  ?isdevelop=1 v URL
 * Vypnutí:  ?isdevelop=0 nebo bez parametru
 *
 * Collapsible — klikni na hlavičku.
 */

import React from "react";
import { themeToManifest } from "@/lib/themes/manifest";
import type { Theme } from "@/lib/themes";
import {
  buildCardBackgroundImageValue,
  getSharedCardPlaceholderPath,
  resolveFieldCardImagePath,
  resolveRacerCardImagePath,
  themeAssetPath,
  THEME_ASSETS,
} from "@/lib/themes/assets";

// ─── Typy polí ────────────────────────────────────────────────────────────────

const FIELD_TYPES: Array<{ type: string }> = [
  { type: "start" },
  { type: "coins_gain" },
  { type: "coins_lose" },
  { type: "gamble" },
  { type: "racer" },
  { type: "chance" },
  { type: "finance" },
  { type: "neutral" },
];

// ─── Asset existence check ────────────────────────────────────────────────────

type AssetStatus = "checking" | "ok" | "missing";

/**
 * useAssetCheck — paralelní HEAD check pro seznam paths.
 *
 * Spustí se jen když active=true (lazy — nespouštíme requesty dokud není panel otevřen).
 * Vrátí mapu path → stav. Paths se znovu checknout jen při změně pathsKey.
 */
function useAssetCheck(
  paths: string[],
  active: boolean
): Record<string, AssetStatus> {
  const [statuses, setStatuses] = React.useState<Record<string, AssetStatus>>({});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const pathsKey = paths.join("|");

  React.useEffect(() => {
    if (!active || paths.length === 0) return;

    // Okamžitě nastav vše na "checking"
    setStatuses(Object.fromEntries(paths.map((p) => [p, "checking" as AssetStatus])));

    // Paralelní HEAD requesty
    Promise.all(
      paths.map(async (path): Promise<[string, AssetStatus]> => {
        try {
          const res = await fetch(path, { method: "HEAD" });
          return [path, res.ok ? "ok" : "missing"];
        } catch {
          return [path, "missing"];
        }
      })
    ).then((results) => {
      setStatuses(Object.fromEntries(results));
    });
    // pathsKey stabilně zastupuje paths array
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, pathsKey]);

  return statuses;
}

// ─── Sub-komponenty ───────────────────────────────────────────────────────────

function StatusDot({ status }: { status: AssetStatus | undefined }) {
  if (!status || status === "checking")
    return <span className="text-slate-600 w-3 inline-block text-center">⋯</span>;
  if (status === "ok")
    return <span className="text-emerald-500 w-3 inline-block text-center">✓</span>;
  return <span className="text-red-500 w-3 inline-block text-center">✗</span>;
}

function AssetRow({
  label,
  path,
  status,
  override,
  highlight,
}: {
  label: string;
  path: string;
  status: AssetStatus | undefined;
  override?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className="grid grid-cols-[100px_16px_1fr] gap-1 items-baseline">
      <span className="text-slate-500 shrink-0">{label}</span>
      <StatusDot status={status} />
      <span className={`break-all ${highlight ? "text-amber-400" : override ? "text-emerald-400" : "text-slate-400"}`}>
        {path}
        {override && <span className="ml-1 text-emerald-700">← override</span>}
      </span>
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

  // URL param — bezpečně jen na klientu
  React.useEffect(() => {
    const param = new URLSearchParams(window.location.search).get("isdevelop");
    setEnabled(param === "1");
  }, []);

  // Manifest + resolved pathy — nutné před hooky
  const manifest = themeToManifest(theme);
  const basePath  = `/themes/${themeId}/`;

  const boardBgPath   = manifest.assets?.boardBackgroundImage ?? themeAssetPath(themeId, THEME_ASSETS.boardBg);
  const centerBgPath  = themeAssetPath(themeId, THEME_ASSETS.centerBg);
  const previewPath   = themeAssetPath(themeId, THEME_ASSETS.preview);
  const hasBoardOverride = !!manifest.assets?.boardBackgroundImage;

  const sharedPlaceholderPath = getSharedCardPlaceholderPath();

  const fieldRows = FIELD_TYPES.map(({ type }) => {
    const override = manifest.assets?.fieldTextures?.[type];
    const path = resolveFieldCardImagePath(themeId, type, override);
    return {
      type,
      path,
      hasOverride: !!override,
      backgroundChain: `${buildCardBackgroundImageValue(path)} -> CSS fallback`,
    };
  });

  const racerRows = manifest.racers.map((r) => {
    const override = manifest.assets?.racerImages?.[r.id];
    const path = resolveRacerCardImagePath(themeId, r.id, override);
    return {
      id: r.id,
      emoji: r.emoji,
      path,
      hasOverride: !!override,
      backgroundChain: `${buildCardBackgroundImageValue(path)} -> CSS fallback`,
    };
  });

  // Všechny pathy pro paralelní check — spustí se jen při open && enabled
  const allPaths = [
    boardBgPath, centerBgPath, previewPath,
    sharedPlaceholderPath,
    ...fieldRows.map((f) => f.path).filter((p): p is string => Boolean(p)),
    ...racerRows.map((r) => r.path).filter((p): p is string => Boolean(p)),
  ];

  const statuses = useAssetCheck(allPaths, enabled && open);

  // Souhrn pro toggle button
  const checkedCount  = Object.keys(statuses).length;
  const okCount       = Object.values(statuses).filter((s) => s === "ok").length;
  const missingCount  = Object.values(statuses).filter((s) => s === "missing").length;
  const summaryLabel  = checkedCount > 0
    ? ` — ${okCount}✓ ${missingCount}✗`
    : "";

  if (!enabled) return null;

  return (
    <div className="mx-auto max-w-[760px] font-mono text-xs select-none">
      {/* Toggle */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full text-left px-3 py-1.5 rounded-lg bg-slate-800/50 text-slate-400 hover:text-slate-200 hover:bg-slate-700/60 transition-colors"
      >
        {open ? "▾" : "▸"}{" "}
        <span className="text-slate-500">Asset Inspector</span>{" — "}
        theme: <span className="text-amber-400">{themeId}</span>
        {summaryLabel && (
          <span className={missingCount > 0 ? "text-red-500" : "text-emerald-500"}>
            {summaryLabel}
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div className="mt-1 rounded-lg border border-slate-700 bg-slate-900/95 p-3 space-y-1 text-slate-300 leading-relaxed">

          {/* Identita */}
          <div className="grid grid-cols-[100px_16px_1fr] gap-1">
            <span className="text-slate-500">themeId</span>
            <span />
            <span className="text-amber-400">{themeId}</span>
          </div>
          <div className="grid grid-cols-[100px_16px_1fr] gap-1">
            <span className="text-slate-500">basePath</span>
            <span />
            <span className="text-slate-300">{basePath}</span>
          </div>

          {/* Board */}
          <SectionLabel>Board assety</SectionLabel>
          <AssetRow label="board-bg"  path={boardBgPath}  status={statuses[boardBgPath]}  override={hasBoardOverride} />
          <AssetRow label="center-bg" path={centerBgPath} status={statuses[centerBgPath]} />
          <AssetRow label="preview"   path={previewPath}  status={statuses[previewPath]} />

          <SectionLabel>Shared fallbacky</SectionLabel>
          <AssetRow label="card-ph" path={sharedPlaceholderPath} status={statuses[sharedPlaceholderPath]} highlight />

          {/* Pole */}
          <SectionLabel>Pole — type → resolved path</SectionLabel>
          {fieldRows.map(({ type, path, hasOverride, backgroundChain }) => (
            <div key={type} className="grid grid-cols-[90px_16px_1fr] gap-1 items-baseline">
              <span className="text-slate-500">{type}</span>
              <StatusDot status={path ? statuses[path] : undefined} />
              <span className={`break-all ${hasOverride ? "text-emerald-400" : "text-slate-400"}`}>
                {path ?? "—"}
                {hasOverride && <span className="ml-1 text-emerald-700">← override</span>}
                <span className="ml-1 text-slate-600">{backgroundChain}</span>
              </span>
            </div>
          ))}

          {/* Závodníci */}
          <SectionLabel>Závodníci — racer.id → path</SectionLabel>
          {racerRows.map(({ id, emoji, path, hasOverride, backgroundChain }) => (
            <div key={id} className="grid grid-cols-[130px_16px_1fr] gap-1 items-baseline">
              <span className="text-slate-500">{emoji} {id}</span>
              <StatusDot status={path ? statuses[path] : undefined} />
              <span className={`break-all ${hasOverride ? "text-emerald-400" : "text-slate-400"}`}>
                {path ?? "—"}
                {hasOverride && <span className="ml-1 text-emerald-700">← override</span>}
                <span className="ml-1 text-slate-600">{backgroundChain}</span>
              </span>
            </div>
          ))}

          {/* Legenda */}
          <div className="border-t border-slate-800 pt-2 flex gap-4 text-[10px] text-slate-600">
            <span><span className="text-emerald-500">✓</span> soubor existuje</span>
            <span><span className="text-red-500">✗</span> chybí → fallback CSS</span>
            <span><span className="text-slate-600">⋯</span> ověřuji</span>
          </div>
        </div>
      )}
    </div>
  );
}
