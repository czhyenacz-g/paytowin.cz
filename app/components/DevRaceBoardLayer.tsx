"use client";

/**
 * DevRaceBoardLayer — dev-only race layer uvnitř boardu (ne fullscreen).
 * Renderuje se jako absolute inset-0 z-[50] uvnitř board surface divu.
 * Board zůstává vizuálně přítomný za poloprůhledným overlay.
 * Žádný game state se nemění. Výsledky se neukládají.
 */

import React from "react";

interface Props {
  playerName: string;
  playerColor: string;
  racingEmoji: string;
  onExit: () => void;
}

type CellType = "start" | "normal" | "boost" | "slow" | "obstacle" | "finish";

interface Cell {
  idx: number;
  type: CellType;
}

const TRACK: Cell[] = (
  ["start","normal","boost","normal","slow","normal","obstacle","normal","boost","normal","slow","finish"] as CellType[]
).map((type, idx) => ({ idx, type }));

const FINISH = TRACK.length - 1;

const CFG: Record<CellType, { bg: string; ring: string; emoji: string; label: string }> = {
  start:    { bg: "bg-slate-600",   ring: "ring-slate-400",   emoji: "🏁", label: "Start" },
  normal:   { bg: "bg-slate-700",   ring: "ring-slate-600",   emoji: "",   label: "" },
  boost:    { bg: "bg-emerald-800", ring: "ring-emerald-400", emoji: "⚡", label: "Boost" },
  slow:     { bg: "bg-orange-900",  ring: "ring-orange-400",  emoji: "🐌", label: "Bažina" },
  obstacle: { bg: "bg-red-900",     ring: "ring-red-400",     emoji: "🚧", label: "Stop" },
  finish:   { bg: "bg-amber-700",   ring: "ring-amber-300",   emoji: "🏁", label: "Cíl" },
};

function rollD6() { return Math.floor(Math.random() * 6) + 1; }

export default function DevRaceBoardLayer({ playerName, playerColor, racingEmoji, onExit }: Props) {
  const [playerPos, setPlayerPos] = React.useState(0);
  const [ghostPos,  setGhostPos]  = React.useState(0);
  const [log,       setLog]       = React.useState<string>("Start!");
  const [done,      setDone]      = React.useState<"player" | "ghost" | null>(null);

  const move = (pos: number, base: number): [number, string] => {
    const cell = TRACK[Math.min(pos, FINISH)];
    if (cell?.type === "boost")    return [Math.min(pos + 2, FINISH), "⚡+2"];
    if (cell?.type === "slow")     return [Math.max(pos - 1, 0),      "🐌-1"];
    if (cell?.type === "obstacle") return [base,                       "🚧Stop"];
    return [Math.min(pos, FINISH), ""];
  };

  const handleRoll = () => {
    if (done) return;

    const r = rollD6();
    const [np, pFx] = move(playerPos + r, playerPos);
    setPlayerPos(np);

    if (np >= FINISH) {
      setLog(`${racingEmoji} hod ${r}${pFx ? " "+pFx : ""} → 🏆`);
      setDone("player");
      return;
    }

    const gr = Math.floor(Math.random() * 3) + 2;
    const [ng, gFx] = move(ghostPos + gr, ghostPos);
    setGhostPos(ng);

    if (ng >= FINISH) {
      setLog(`${racingEmoji} +${r}${pFx ? " "+pFx : ""} | 👻 +${gr}${gFx ? " "+gFx : ""} → 💨`);
      setDone("ghost");
    } else {
      setLog(`${racingEmoji} +${r}${pFx ? " "+pFx : ""} | 👻 +${gr}${gFx ? " "+gFx : ""}`);
    }
  };

  const handleReset = () => {
    setPlayerPos(0); setGhostPos(0); setDone(null); setLog("Reset!");
  };

  return (
    /* Overlay — vyplní celý board surface, board viditelný skrz */
    <div className="absolute inset-0 z-[50] flex flex-col overflow-hidden"
         style={{ background: "rgba(10,10,20,0.72)", backdropFilter: "blur(3px)" }}>

      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-black/30 shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-mono font-bold text-purple-300 bg-purple-900/60 px-1.5 py-0.5 rounded">
            DEV
          </span>
          <span className="text-[11px] font-semibold text-slate-300">Race Layer</span>
        </div>
        <button
          onClick={onExit}
          className="rounded-md bg-white/10 px-2 py-1 text-[11px] font-bold text-slate-300 hover:bg-red-600/70 hover:text-white transition"
        >
          ✕
        </button>
      </div>

      {/* ── Center content ── */}
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4">

        {/* Status */}
        <div className="flex items-center gap-4 text-[11px]">
          <span className="font-semibold" style={{ color: playerColor }}>
            {racingEmoji} {playerName} · {playerPos + 1}/{TRACK.length}
          </span>
          <span className="text-slate-500">·</span>
          <span className="text-slate-500">👻 Ghost · {ghostPos + 1}/{TRACK.length}</span>
        </div>

        {/* Track strip */}
        <div className="flex items-end gap-1 overflow-x-auto max-w-full pb-1">
          {TRACK.map((cell, i) => {
            const cfg = CFG[cell.type];
            const isPlayer = i === playerPos;
            const isGhost  = i === ghostPos && !isPlayer;
            const both     = i === playerPos && i === ghostPos;
            return (
              <div
                key={i}
                className={`
                  relative flex-shrink-0 w-10 h-10 rounded-lg flex flex-col items-center justify-center
                  text-xs transition-all duration-150
                  ${cfg.bg}
                  ${isPlayer ? `ring-2 ${cfg.ring} ring-white scale-110 shadow-lg` : ""}
                  ${isGhost  ? `ring-1 ring-slate-400` : ""}
                `}
              >
                <span className="text-base leading-none select-none">
                  {both ? racingEmoji : isPlayer ? racingEmoji : isGhost ? "👻" : cfg.emoji || <span className="w-1 h-1 rounded-full bg-slate-500 block" />}
                </span>
                <span className="text-[7px] text-white/40 tabular-nums font-bold leading-none mt-0.5">{i + 1}</span>
              </div>
            );
          })}
        </div>

        {/* Log line */}
        <div className="text-[11px] font-mono text-slate-400 h-4 text-center">
          {log}
        </div>

        {/* Result */}
        {done && (
          <div className={`rounded-xl px-4 py-2 text-sm font-black ${done === "player" ? "bg-emerald-700 text-emerald-100" : "bg-red-800 text-red-100"}`}>
            {done === "player" ? `🏆 ${playerName} vyhrál!` : "💨 Ghost vyhrál!"}
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleRoll}
            disabled={!!done}
            className="rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-black text-white hover:bg-amber-400 active:scale-95 transition disabled:opacity-30 disabled:cursor-not-allowed"
          >
            🎲 Hodit
          </button>
          <button
            onClick={handleReset}
            className="rounded-xl bg-white/10 px-3 py-2.5 text-sm font-semibold text-slate-300 hover:bg-white/20 transition"
          >
            ↺
          </button>
        </div>

        {/* Legend strip */}
        <div className="flex items-center gap-3 text-[9px] text-slate-500 mt-1">
          <span>⚡ Boost +2</span>
          <span>🐌 Bažina −1</span>
          <span>🚧 Stop</span>
          <span className="text-slate-600">· neukládá se</span>
        </div>

      </div>
    </div>
  );
}
