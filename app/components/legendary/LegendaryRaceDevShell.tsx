"use client";

/**
 * LegendaryRaceDevShell — dev-only harness pro Legendary Horse Race.
 * Žádný game state, žádné DB. Izolovaný component, lze smazat bez dopadu.
 */

import React from "react";
import LegendaryHorseRaceArena from "./LegendaryHorseRaceArena";
import { LEGENDARY_PRESETS } from "@/lib/legendary/presets";

interface Props {
  onExit?: () => void;
}

const PRESTART_TICKS = 5;

export default function LegendaryRaceDevShell({ onExit }: Props) {
  const [presetId, setPresetId]       = React.useState(LEGENDARY_PRESETS[0].id);
  const [showDebug, setDebug]         = React.useState(false);
  const [configKey, setConfigKey]     = React.useState(0);
  const [preStartCount, setCount]     = React.useState(PRESTART_TICKS);
  const [preStartDone, setDone]       = React.useState(false);

  const activePreset = LEGENDARY_PRESETS.find(p => p.id === presetId) ?? LEGENDARY_PRESETS[0];

  // Reset prestart when preset changes
  React.useEffect(() => {
    setDone(false);
    setCount(PRESTART_TICKS);
  }, [configKey]);

  // Countdown
  React.useEffect(() => {
    if (preStartDone) return;
    if (preStartCount <= 0) { setDone(true); return; }
    const id = setTimeout(() => setCount(c => c - 1), 1000);
    return () => clearTimeout(id);
  }, [preStartDone, preStartCount]);

  const selectPreset = (id: string) => {
    setPresetId(id);
    setConfigKey(k => k + 1);
  };

  const countColor =
    preStartCount <= 1 ? "#f87171" :
    preStartCount <= 2 ? "#fbbf24" :
    preStartCount <= 3 ? "#facc15" : "white";

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-[#030712] text-white overflow-hidden">

      {/* ── Prestart overlay ── */}
      {!preStartDone && (
        <div
          className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 cursor-pointer select-none"
          style={{ background: "rgba(3,7,18,0.97)", backdropFilter: "blur(2px)" }}
          onClick={() => setDone(true)}
        >
          <div className="text-[9px] font-mono tracking-widest text-slate-500 uppercase">Minihra</div>

          {/* PŘIPRAVTE SE + countdown */}
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

          {/* Game title */}
          <div
            className="text-base font-black tracking-tight"
            style={{ color: "#facc15", textShadow: "0 0 16px rgba(250,204,21,0.55)" }}
          >
            LEGENDARY RACE
          </div>
          <div
            className="text-xs font-bold tracking-widest uppercase"
            style={{ color: "#fb923c", textShadow: "0 0 10px rgba(251,146,60,0.4)" }}
          >
            NEON JUMP RUN
          </div>

          {/* Artwork */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/minigames/neon_legendary_race.webp"
            alt=""
            width={200}
            height={267}
            className="rounded-lg object-cover"
            style={{ maxWidth: 200 }}
            onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />

          {/* Controls */}
          <div className="flex flex-col items-center gap-0.5 mt-1 text-[10px] text-slate-400 text-center leading-snug">
            <div>
              <span className="text-emerald-400 font-bold">P1 SPACE</span>
              {" · "}
              <span className="text-purple-400 font-bold">P2 S</span>
              {" — skok"}
            </div>
            <div>Skoč přes neonovou překážku.</div>
            <div>Legenda běží jen jednou. Chyba bolí.</div>
          </div>

          <div className="text-[9px] text-slate-700 mt-1">klikni pro přeskočení</div>
        </div>
      )}

      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-900/80 border-b border-white/5 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-mono font-bold text-yellow-300 bg-yellow-900/60 px-2 py-0.5 rounded tracking-widest uppercase">
            DEV · LEGENDARY
          </span>
          <span className="text-sm font-bold text-slate-200">Legendary Race</span>
          <span className="hidden sm:inline text-xs text-slate-600">— localhost harness</span>
        </div>
        {onExit && (
          <button
            onClick={onExit}
            className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-red-600/80 hover:text-white transition"
          >
            ✕ Zavřít
          </button>
        )}
      </div>

      {/* ── Main content ── */}
      <div className="flex flex-1 gap-4 p-4 overflow-hidden">

        {/* Arena */}
        <div className="flex flex-1 flex-col items-center justify-center overflow-auto">
          <LegendaryHorseRaceArena
            key={configKey}
            config={activePreset.config}
            showDebug={showDebug}
            autoStart={preStartDone}
          />

          {/* Controls legend */}
          <div className="mt-3 flex items-center gap-6 text-[11px] text-slate-600">
            <span><span className="text-emerald-500 font-bold">SPACE</span> — P1 skok</span>
            <span><span className="text-purple-400 font-bold">S</span> — P2 skok</span>
          </div>
        </div>

        {/* Sidebar */}
        <div className="flex flex-col gap-3 w-60 shrink-0 overflow-y-auto">

          {/* Preset selector */}
          <div className="rounded-lg bg-slate-900 border border-slate-700 p-3 space-y-2">
            <div className="text-[9px] font-mono font-bold text-slate-500 uppercase tracking-widest">Preset</div>
            {LEGENDARY_PRESETS.map(p => (
              <button
                key={p.id}
                onClick={() => selectPreset(p.id)}
                className={`w-full text-left rounded px-2.5 py-1.5 text-xs transition ${
                  presetId === p.id
                    ? "bg-yellow-900/60 border border-yellow-600 text-yellow-300"
                    : "bg-slate-800 border border-transparent text-slate-400 hover:bg-slate-700"
                }`}
              >
                <div className="font-bold">{p.label}</div>
                <div className="text-[10px] opacity-70 mt-0.5 leading-snug">{p.description}</div>
              </button>
            ))}
          </div>

          {/* Config overview */}
          <div className="rounded-lg bg-slate-900 border border-slate-700 p-3 font-mono text-[10px] text-slate-500 space-y-0.5">
            <div className="text-[9px] font-bold text-slate-600 uppercase tracking-widest mb-1">Config</div>
            <div>maxTicks <span className="text-slate-300">{activePreset.config.maxTicks}</span></div>
            <div>tickMs <span className="text-slate-300">{activePreset.config.tickMs}</span></div>
            <div>jumpDuration <span className="text-slate-300">{activePreset.config.jumpDuration}</span></div>
            <div>jumpMaxHeight <span className="text-slate-300">{activePreset.config.jumpMaxHeight}px</span></div>
            <div>baseGap <span className="text-slate-300">{activePreset.config.baseGap}</span></div>
            <div>doubleChance <span className="text-slate-300">{(activePreset.config.doubleChance * 100).toFixed(0)}%</span></div>
            <div>stumble <span className="text-slate-300">{activePreset.config.stumbleDuration}</span></div>
            <div>crashPenalty <span className="text-slate-300">{activePreset.config.crashPenalty}</span></div>
            <div>clearBonus <span className="text-slate-300">{activePreset.config.clearBonus}</span></div>
            <div>distPerTick <span className="text-slate-300">{activePreset.config.distancePerTick}</span></div>
          </div>

          {/* Debug toggle */}
          <button
            onClick={() => setDebug(d => !d)}
            className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
              showDebug
                ? "border-amber-500 bg-amber-900/40 text-amber-300"
                : "border-slate-700 bg-slate-800 text-slate-400 hover:bg-slate-700"
            }`}
          >
            {showDebug ? "🐛 Debug ON" : "🐛 Debug OFF"}
          </button>

        </div>
      </div>
    </div>
  );
}
