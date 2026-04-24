"use client";

/**
 * DuelDevShell — dev-only testovací shell pro Neon Rope Duel.
 * Žádný game state, žádné DB. Izolovaný component, lze smazat bez dopadu.
 */

import React from "react";
import DuelArena, { type DuelMode } from "./DuelArena";
import type { DuelConfig } from "@/lib/duel/types";
import type { MinigameSkin } from "@/lib/minigame-skin";
import { STANDALONE_PRESETS } from "@/lib/minigame-skin";

interface Props {
  onExit: () => void;
  themeSkin?: MinigameSkin; // předáno z GameBoard; pokud chybí → standalone preset selector
}

const DEFAULT_CONFIG: DuelConfig = {
  gridW:    28,
  gridH:    20,
  maxTicks: 200,
  tickMs:   120,
};

const TICK_OPTIONS  = [60, 80, 100, 120, 150, 200, 300];
const GRID_OPTIONS  = [16, 20, 24, 28, 32, 40];
const TICKS_OPTIONS = [100, 150, 200, 300, 500];

export default function DuelDevShell({ onExit, themeSkin }: Props) {
  const [config, setConfig]       = React.useState<DuelConfig>(DEFAULT_CONFIG);
  const [mode, setMode]           = React.useState<DuelMode>("pvp");
  const [showDebug, setDebug]     = React.useState(false);
  const [configKey, setConfigKey] = React.useState(0);
  // Standalone skin state — použito jen když themeSkin prop chybí
  const [localSkin, setLocalSkin] = React.useState<MinigameSkin>({});

  const activeSkin: MinigameSkin = themeSkin ?? localSkin;
  const isStandalone = !themeSkin;

  const applyConfig = (patch: Partial<DuelConfig>) => {
    setConfig(c => ({ ...c, ...patch }));
    setConfigKey(k => k + 1);
  };

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-[#030712] text-white overflow-hidden">

      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-900/80 border-b border-white/5 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-mono font-bold text-emerald-300 bg-emerald-900/60 px-2 py-0.5 rounded tracking-widest uppercase">
            DEV · DUEL
          </span>
          <span className="text-sm font-bold text-slate-200">Neon Rope Duel</span>
          {activeSkin.themeName && (
            <span className="text-xs text-emerald-600/80 font-medium">· {activeSkin.themeName}</span>
          )}
          <span className="hidden sm:inline text-xs text-slate-600">— localhost harness</span>
        </div>
        <button
          onClick={onExit}
          className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-red-600/80 hover:text-white transition"
        >
          ✕ Zavřít
        </button>
      </div>

      {/* ── Main ── */}
      <div className="flex flex-1 gap-4 p-4 overflow-hidden">

        {/* Arena */}
        <div className="flex flex-1 flex-col items-center justify-center overflow-auto">
          <DuelArena
            key={configKey}
            config={config}
            mode={mode}
            showDebug={showDebug}
            backgroundUrl={activeSkin.backgroundUrl}
            overlayOpacity={activeSkin.overlayOpacity}
          />

          {/* Controls legend */}
          <div className="mt-4 flex items-center gap-6 text-[11px] text-slate-600">
            {mode === "pvp" ? (
              <>
                <span><span className="text-emerald-500 font-bold">P1</span> A / D — zatočit</span>
                <span><span className="text-purple-400 font-bold">P2</span> ← / → — zatočit</span>
              </>
            ) : (
              <>
                <span><span className="text-emerald-500 font-bold">P1</span> A / D — zatočit</span>
                <span><span className="text-purple-400 font-bold">Bot</span> automaticky</span>
              </>
            )}
            <span className="text-slate-700">·</span>
            <span className="text-slate-600">výsledek se neukládá</span>
          </div>
        </div>

        {/* ── Sidebar: config ── */}
        <div className="w-52 shrink-0 flex flex-col gap-3 overflow-y-auto">

          {/* Theme / background */}
          {isStandalone ? (
            <div className="rounded-xl bg-slate-900 border border-slate-800 p-3 space-y-1.5">
              <div className="text-[9px] font-bold uppercase tracking-widest text-slate-600">Pozadí (preset)</div>
              <div className="flex flex-col gap-1">
                {STANDALONE_PRESETS.map(p => (
                  <button
                    key={p.label}
                    onClick={() => setLocalSkin({
                      backgroundUrl: p.url,
                      overlayOpacity: p.dark ? 0.20 : 0.20,
                      themeName: p.url ? p.label : undefined,
                    })}
                    className={`rounded-lg px-2 py-1.5 text-[10px] font-semibold text-left transition flex items-center gap-1.5 ${
                      localSkin.backgroundUrl === p.url
                        ? "bg-slate-600 text-white"
                        : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                    }`}
                  >
                    <span>{p.emoji}</span>
                    <span>{p.label}</span>
                    {p.dark && <span className="ml-auto text-[8px] text-slate-500">🌙</span>}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-xl bg-slate-900 border border-slate-800 p-3 space-y-1">
              <div className="text-[9px] font-bold uppercase tracking-widest text-slate-600">Theme z hry</div>
              <div className="text-[10px] text-slate-400 font-medium">
                {activeSkin.themeName ?? "—"}
              </div>
              {activeSkin.backgroundUrl ? (
                <div className="text-[9px] text-emerald-500/80">✓ background aktivní</div>
              ) : (
                <div className="text-[9px] text-slate-600">žádný board background</div>
              )}
            </div>
          )}

          {/* Debug: background info */}
          <div className="rounded-xl bg-slate-900 border border-slate-800 p-3 space-y-1 font-mono">
            <div className="text-[9px] font-bold uppercase tracking-widest text-slate-600">BG Debug</div>
            <div className="text-[9px] text-slate-500">
              <span className="text-slate-600">source: </span>
              <span className={activeSkin.backgroundUrl ? "text-emerald-400" : "text-slate-600"}>
                {isStandalone
                  ? (activeSkin.backgroundUrl ? "standalone preset" : "none")
                  : "game theme"}
              </span>
            </div>
            <div className="text-[9px] text-slate-500 break-all">
              <span className="text-slate-600">url: </span>
              <span className={activeSkin.backgroundUrl ? "text-cyan-400" : "text-slate-700"}>
                {activeSkin.backgroundUrl
                  ? activeSkin.backgroundUrl.replace(/^.+\/([^/]+)$/, "$1")
                  : "—"}
              </span>
            </div>
            <div className="text-[9px] text-slate-500">
              <span className="text-slate-600">overlay: </span>
              <span className="text-amber-400/80">{activeSkin.overlayOpacity ?? 0.20}</span>
            </div>
          </div>

          {/* Mode */}
          <div className="rounded-xl bg-slate-900 border border-slate-800 p-3 space-y-2">
            <div className="text-[9px] font-bold uppercase tracking-widest text-slate-600">Režim</div>
            {(["pvp", "pvbot"] as DuelMode[]).map(m => (
              <button
                key={m}
                onClick={() => { setMode(m); setConfigKey(k => k + 1); }}
                className={`w-full rounded-lg px-3 py-2 text-xs font-semibold text-left transition ${
                  mode === m
                    ? "bg-emerald-800/70 text-emerald-200 border border-emerald-700"
                    : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                }`}
              >
                {m === "pvp" ? "👥 Hráč vs Hráč" : "🤖 Hráč vs Bot"}
              </button>
            ))}
          </div>

          {/* Tick speed */}
          <div className="rounded-xl bg-slate-900 border border-slate-800 p-3 space-y-1.5">
            <div className="text-[9px] font-bold uppercase tracking-widest text-slate-600">Rychlost tiku</div>
            <div className="flex flex-wrap gap-1">
              {TICK_OPTIONS.map(ms => (
                <button
                  key={ms}
                  onClick={() => applyConfig({ tickMs: ms })}
                  className={`rounded px-2 py-1 text-[10px] font-mono font-bold transition ${
                    config.tickMs === ms
                      ? "bg-emerald-700 text-emerald-100"
                      : "bg-slate-800 text-slate-500 hover:bg-slate-700"
                  }`}
                >
                  {ms}ms
                </button>
              ))}
            </div>
          </div>

          {/* Grid size */}
          <div className="rounded-xl bg-slate-900 border border-slate-800 p-3 space-y-1.5">
            <div className="text-[9px] font-bold uppercase tracking-widest text-slate-600">Velikost gridu</div>
            <div className="flex flex-wrap gap-1">
              {GRID_OPTIONS.map(g => (
                <button
                  key={g}
                  onClick={() => applyConfig({ gridW: g, gridH: Math.round(g * 0.72) })}
                  className={`rounded px-2 py-1 text-[10px] font-mono font-bold transition ${
                    config.gridW === g
                      ? "bg-slate-500 text-white"
                      : "bg-slate-800 text-slate-500 hover:bg-slate-700"
                  }`}
                >
                  {g}×{Math.round(g * 0.72)}
                </button>
              ))}
            </div>
          </div>

          {/* Max ticks */}
          <div className="rounded-xl bg-slate-900 border border-slate-800 p-3 space-y-1.5">
            <div className="text-[9px] font-bold uppercase tracking-widest text-slate-600">Max tiků</div>
            <div className="flex flex-wrap gap-1">
              {TICKS_OPTIONS.map(t => (
                <button
                  key={t}
                  onClick={() => applyConfig({ maxTicks: t })}
                  className={`rounded px-2 py-1 text-[10px] font-mono font-bold transition ${
                    config.maxTicks === t
                      ? "bg-indigo-700 text-indigo-100"
                      : "bg-slate-800 text-slate-500 hover:bg-slate-700"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Debug */}
          <div className="rounded-xl bg-slate-900 border border-slate-800 p-3">
            <button
              onClick={() => setDebug(d => !d)}
              className={`w-full rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                showDebug
                  ? "bg-indigo-900/80 text-indigo-300 border border-indigo-800"
                  : "bg-slate-800 text-slate-500 hover:bg-slate-700"
              }`}
            >
              {showDebug ? "🐛 Debug ON" : "🐛 Debug OFF"}
            </button>
          </div>

          <div className="text-[9px] text-slate-700 leading-relaxed space-y-0.5 pt-1">
            <div>Výsledek se neukládá.</div>
            <div>Žádné DB zápisy.</div>
            <div>Pouze dev build.</div>
          </div>

        </div>
      </div>
    </div>
  );
}
