"use client";

/**
 * SpeedDevShell — dev-only testovací shell pro Speed Arena.
 * Žádný game state, žádné DB. Izolovaný component, lze smazat bez dopadu.
 */

import React from "react";
import SpeedArena from "./SpeedArena";
import type { SpeedConfig } from "@/lib/speed/types";
import { SPEED_PRESETS } from "@/lib/speed/presets";
import type { MinigameSkin } from "@/lib/minigame-skin";
import { STANDALONE_PRESETS } from "@/lib/minigame-skin";

interface Props {
  onExit: () => void;
  themeSkin?: MinigameSkin; // předáno z GameBoard; pokud chybí → standalone preset selector
}

const TICK_MS_OPTIONS    = [50, 80, 100, 120, 150] as const;
const MAX_TICKS_OPTIONS  = [100, 150, 200, 300]     as const;
const ACCEL_OPTIONS      = [0.02, 0.04, 0.06, 0.08] as const;
const BOOST_OPTIONS      = [1.0, 1.5, 2.0, 3.0]     as const;
const CRASH_VEL_OPTIONS  = [3.0, 4.0, 4.5, 5.5, 7.0] as const;

type OptionRow<T extends readonly number[]> = {
  label: string;
  options: T;
  key: keyof SpeedConfig;
  fmt?: (v: number) => string;
  color: string;
};

const PRESTART_TICKS = 5;

export default function SpeedDevShell({ onExit, themeSkin }: Props) {
  const [config, setConfig]       = React.useState<SpeedConfig>(SPEED_PRESETS[0].config);
  const [presetId, setPresetId]   = React.useState<string>(SPEED_PRESETS[0].id);
  const [showDebug, setDebug]     = React.useState(false);
  const [configKey, setConfigKey] = React.useState(0);
  // Standalone skin state — použito jen když themeSkin prop chybí
  const [localSkin, setLocalSkin] = React.useState<MinigameSkin>({});
  // Prestart countdown
  const [preStartCount, setPreStartCount] = React.useState(PRESTART_TICKS);
  const [preStartDone, setPreStartDone]   = React.useState(false);

  const activeSkin: MinigameSkin = themeSkin ?? localSkin;
  const isStandalone = !themeSkin;

  // Reset prestart when arena config changes
  React.useEffect(() => {
    setPreStartDone(false);
    setPreStartCount(PRESTART_TICKS);
  }, [configKey]);

  // Countdown tick
  React.useEffect(() => {
    if (preStartDone) return;
    if (preStartCount <= 0) { setPreStartDone(true); return; }
    const id = setTimeout(() => setPreStartCount(c => c - 1), 1000);
    return () => clearTimeout(id);
  }, [preStartDone, preStartCount]);

  const skipPreStart = () => { setPreStartDone(true); };

  const selectPreset = (id: string) => {
    const p = SPEED_PRESETS.find(px => px.id === id);
    if (!p) return;
    setConfig(p.config);
    setPresetId(id);
    setConfigKey(k => k + 1);
  };

  const applyConfig = (patch: Partial<SpeedConfig>) => {
    setConfig(c => ({ ...c, ...patch }));
    setPresetId("custom");
    setConfigKey(k => k + 1);
  };

  const activePreset = SPEED_PRESETS.find(p => p.id === presetId);
  const countColor = preStartCount <= 1 ? "#f87171" : preStartCount <= 2 ? "#fbbf24" : preStartCount <= 3 ? "#facc15" : "white";

  const rows: OptionRow<readonly number[]>[] = [
    { label: "Tick (ms)", key: "tickMs",   options: TICK_MS_OPTIONS,   fmt: v => `${v}ms`, color: "bg-cyan-700 text-cyan-100" },
    { label: "Max tiků",  key: "maxTicks", options: MAX_TICKS_OPTIONS,  fmt: v => `${v}`,   color: "bg-indigo-700 text-indigo-100" },
    { label: "Akcelerace",key: "acceleration", options: ACCEL_OPTIONS,  fmt: v => `${v}`,   color: "bg-emerald-700 text-emerald-100" },
    { label: "Boost +",   key: "boostStrength", options: BOOST_OPTIONS, fmt: v => `+${v}`,  color: "bg-green-700 text-green-100" },
    { label: "Crash při", key: "crashVelocityThreshold", options: CRASH_VEL_OPTIONS, fmt: v => `v≥${v}`, color: "bg-red-700 text-red-100" },
  ];

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-[#020617] text-white overflow-hidden">

      {/* ── Pre-start overlay ── */}
      {!preStartDone && (
        <div
          className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 cursor-pointer select-none"
          style={{ background: "rgba(2,6,23,0.96)", backdropFilter: "blur(2px)" }}
          onClick={skipPreStart}
        >
          <div className="text-[9px] font-mono tracking-widest text-slate-500 uppercase">Minihra</div>

          <div className="flex flex-col items-center gap-0.5">
            <div
              className="text-3xl sm:text-4xl font-black text-white tracking-tight text-center leading-tight"
              style={{ textShadow: "0 0 30px rgba(255,200,0,0.35)" }}
            >
              PŘIPRAVTE SE
            </div>
            <div
              key={preStartCount}
              className="text-5xl font-black tabular-nums leading-none mt-1"
              style={{ color: countColor, textShadow: `0 0 24px ${countColor}` }}
            >
              {preStartCount > 0 ? preStartCount : "GO!"}
            </div>
          </div>

          <div
            className="text-base font-black tracking-tight"
            style={{ color: "#22d3ee", textShadow: "0 0 16px rgba(34,211,238,0.5)" }}
          >
            SPEED RACE
          </div>

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/minigames/neon_speedrace.webp"
            alt=""
            width={200}
            height={267}
            className="rounded-lg opacity-80 object-cover"
            style={{ maxWidth: 200 }}
            onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />

          <div className="flex flex-col items-center gap-0.5 mt-1 text-[10px] text-slate-400 text-center leading-snug">
            <div>
              <span className="text-cyan-400 font-bold">← →</span> nebo{" "}
              <span className="text-cyan-400 font-bold">A D</span> — zatočit
            </div>
            <div>Rychlost roste automaticky. Narážení při vysoké rychlosti = crash.</div>
          </div>

          <div className="text-[9px] text-slate-700 mt-2">klikni pro přeskočení</div>
        </div>
      )}

      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-900/80 border-b border-white/5 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-mono font-bold text-cyan-300 bg-cyan-900/60 px-2 py-0.5 rounded tracking-widest uppercase">
            DEV · SPEED
          </span>
          <span className="text-sm font-bold text-slate-200">Speed Race</span>
          {activeSkin.themeName && (
            <span className="text-xs text-cyan-600/80 font-medium">· {activeSkin.themeName}</span>
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

        {/* ── Arena ── */}
        <div className="flex flex-1 flex-col items-center justify-center overflow-auto">
          <SpeedArena
            key={configKey}
            config={config}
            showDebug={showDebug}
            backgroundUrl={activeSkin.backgroundUrl}
            overlayOpacity={activeSkin.overlayOpacity}
            autoStart={preStartDone}
          />

          <div className="mt-4 flex items-center gap-5 text-[11px] text-slate-600">
            <span><span className="text-cyan-400 font-bold">← →</span> nebo <span className="text-cyan-400 font-bold">A D</span> — zatočit</span>
            <span className="text-slate-700">·</span>
            <span className="text-emerald-500/70">⚡ boost</span>
            <span className="text-orange-500/70">🛢 slow</span>
            <span className="text-slate-700">·</span>
            <span className="text-slate-600">výsledek se neukládá</span>
          </div>
        </div>

        {/* ── Sidebar ── */}
        <div className="w-52 shrink-0 flex flex-col gap-3 overflow-y-auto">

          {/* Preset selector */}
          <div className="rounded-xl bg-slate-900 border border-slate-800 p-3 space-y-2">
            <div className="text-[9px] font-bold uppercase tracking-widest text-slate-600">Preset</div>
            <select
              value={presetId}
              onChange={e => selectPreset(e.target.value)}
              className="w-full rounded bg-slate-800 border border-slate-700 px-2 py-1.5 text-[10px] font-mono font-semibold text-slate-200 cursor-pointer"
            >
              {SPEED_PRESETS.map(p => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
              {presetId === "custom" && <option value="custom">— custom —</option>}
            </select>
            <div className="text-[9px] leading-relaxed">
              {presetId === "custom"
                ? <span className="text-amber-400/80">manuálně upraveno</span>
                : <span className="text-slate-500">{activePreset?.description}</span>}
            </div>
            <div className="text-[9px] font-mono text-slate-700">{presetId}</div>
          </div>

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

          {/* Config rows */}
          {rows.map(row => (
            <div key={row.key} className="rounded-xl bg-slate-900 border border-slate-800 p-3 space-y-1.5">
              <div className="text-[9px] font-bold uppercase tracking-widest text-slate-600">{row.label}</div>
              <div className="flex flex-wrap gap-1">
                {row.options.map(v => (
                  <button
                    key={v}
                    onClick={() => applyConfig({ [row.key]: v } as Partial<SpeedConfig>)}
                    className={`rounded px-2 py-1 text-[10px] font-mono font-bold transition ${
                      config[row.key] === v
                        ? row.color
                        : "bg-slate-800 text-slate-500 hover:bg-slate-700"
                    }`}
                  >
                    {row.fmt ? row.fmt(v) : v}
                  </button>
                ))}
              </div>
            </div>
          ))}

          {/* Arena size */}
          <div className="rounded-xl bg-slate-900 border border-slate-800 p-3 space-y-1.5">
            <div className="text-[9px] font-bold uppercase tracking-widest text-slate-600">Aréna</div>
            <div className="flex flex-wrap gap-1">
              {([
                [320, 220] as [number, number],
                [440, 300] as [number, number],
                [560, 380] as [number, number],
              ]).map(([w, h]) => (
                <button
                  key={w}
                  onClick={() => applyConfig({ arenaW: w, arenaH: h })}
                  className={`rounded px-2 py-1 text-[10px] font-mono font-bold transition ${
                    config.arenaW === w
                      ? "bg-slate-500 text-white"
                      : "bg-slate-800 text-slate-500 hover:bg-slate-700"
                  }`}
                >
                  {w}×{h}
                </button>
              ))}
            </div>
          </div>

          {/* Debug toggle */}
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

          {/* Legend */}
          <div className="rounded-xl bg-slate-900 border border-slate-800 p-3 space-y-1.5 text-[10px]">
            <div className="text-[9px] font-bold uppercase tracking-widest text-slate-600 mb-1">Mechanika</div>
            <div className="flex items-center gap-1.5 text-slate-500"><span className="text-emerald-400">⚡</span> boost — zrychlí</div>
            <div className="flex items-center gap-1.5 text-slate-500"><span className="text-orange-400">🛢</span> olej — zpomalí + zakolísá</div>
            <div className="flex items-center gap-1.5 text-slate-500"><span className="text-cyan-400">↔</span> nízká rychlost — bounces</div>
            <div className="flex items-center gap-1.5 text-slate-500"><span className="text-red-400">💥</span> vysoká rychlost — crash</div>
          </div>

          <div className="text-[9px] text-slate-700 text-center pt-1">Výsledek se neukládá.</div>
        </div>
      </div>
    </div>
  );
}
