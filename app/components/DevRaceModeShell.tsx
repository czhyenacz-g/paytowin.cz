"use client";

/**
 * DevRaceModeShell — dev-only testovací závodní plocha mimo modal.
 * Žádný game state se nemění. Výsledky se neukládají.
 * Izolovaný component; lze bezpečně smazat bez dopadu na gameplay.
 */

import React from "react";

interface Props {
  playerName: string;
  playerColor: string;
  racingEmoji: string;
  onExit: () => void;
}

type CellType = "normal" | "boost" | "slow" | "obstacle" | "finish";

interface TrackCell {
  index: number;
  type: CellType;
}

const TRACK_LENGTH = 20;
const FINISH = TRACK_LENGTH - 1;

const TRACK: TrackCell[] = (
  ["normal","normal","boost","normal","slow",
   "normal","obstacle","normal","boost","normal",
   "normal","slow","normal","boost","obstacle",
   "normal","boost","normal","slow","finish"] as CellType[]
).map((type, index) => ({ index, type }));

const CELL_CFG: Record<CellType, { bg: string; border: string; emoji: string; label: string; effect: string }> = {
  normal:   { bg: "bg-slate-700",   border: "border-slate-600",  emoji: "⬜", label: "Trať",     effect: "" },
  boost:    { bg: "bg-emerald-800", border: "border-emerald-500",emoji: "⚡", label: "Boost",    effect: "+2 pole navíc!" },
  slow:     { bg: "bg-orange-900",  border: "border-orange-500", emoji: "🐌", label: "Bažina",   effect: "Ztráta 1 pole." },
  obstacle: { bg: "bg-red-900",     border: "border-red-500",    emoji: "🚧", label: "Překážka", effect: "Zastav na místě." },
  finish:   { bg: "bg-amber-700",   border: "border-amber-400",  emoji: "🏁", label: "Cíl",      effect: "V cíli!" },
};

function roll16(): number {
  return Math.floor(Math.random() * 6) + 1;
}

export default function DevRaceModeShell({ playerName, playerColor, racingEmoji, onExit }: Props) {
  const [playerPos, setPlayerPos] = React.useState(0);
  const [ghostPos,  setGhostPos]  = React.useState(0);
  const [log,       setLog]       = React.useState<string[]>(["Závod začíná! Klikni Hodit kostku."]);
  const [finished,  setFinished]  = React.useState<"player" | "ghost" | null>(null);
  const trackRef = React.useRef<HTMLDivElement>(null);

  const pushLog = (msg: string) => setLog(prev => [msg, ...prev].slice(0, 10));

  const scrollTo = (pos: number) => {
    if (trackRef.current) {
      const cellW = 76;
      trackRef.current.scrollLeft = Math.max(0, pos * cellW - 120);
    }
  };

  const applyCell = (pos: number, base: number, name: string): [number, string] => {
    const cell = TRACK[Math.min(pos, FINISH)];
    let next = pos;
    let note = "";
    if (cell?.type === "boost")    { next += 2; note = ` ⚡ Boost! +2`; }
    if (cell?.type === "slow")     { next -= 1; note = ` 🐌 Bažina! -1`; }
    if (cell?.type === "obstacle") { next = base; note = ` 🚧 Překážka! Stopu.`; }
    return [Math.max(0, Math.min(next, FINISH)), note];
  };

  const handleRoll = () => {
    if (finished) return;

    // Hráč
    const r = roll16();
    const rawPlayer = playerPos + r;
    const [np, pNote] = applyCell(rawPlayer, playerPos, playerName);
    setPlayerPos(np);
    pushLog(`${racingEmoji} ${playerName}: hod ${r} → pole ${np + 1}${pNote}`);
    scrollTo(np);

    if (np >= FINISH) {
      setFinished("player");
      pushLog(`🏆 ${playerName} dorazil do cíle!`);
      return;
    }

    // Ghost
    const gr = Math.floor(Math.random() * 3) + 2;
    const rawGhost = ghostPos + gr;
    const [ng, gNote] = applyCell(rawGhost, ghostPos, "Ghost");
    setGhostPos(ng);
    pushLog(`👻 Ghost: +${gr} → pole ${ng + 1}${gNote}`);

    if (ng >= FINISH) {
      setFinished("ghost");
      pushLog(`💨 Ghost dorazil do cíle!`);
    }
  };

  const handleReset = () => {
    setPlayerPos(0);
    setGhostPos(0);
    setFinished(null);
    setLog(["Reset. Závod znovu!"]);
  };

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-slate-900 text-white overflow-hidden">

      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-slate-700 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono font-bold text-purple-300 bg-purple-900/50 px-2 py-0.5 rounded">
            DEV
          </span>
          <span className="text-sm font-bold text-slate-200">Race Mode Shell</span>
          <span className="text-xs text-slate-500 hidden sm:inline">
            — testovací plocha, žádný game state
          </span>
        </div>
        <button
          onClick={onExit}
          className="rounded-lg bg-slate-700 px-3 py-1.5 text-sm font-semibold text-slate-200 hover:bg-red-600 transition"
        >
          ✕ Zavřít
        </button>
      </div>

      {/* ── Main area ── */}
      <div className="flex flex-1 flex-col gap-4 p-4 overflow-hidden">

        {/* Status strip */}
        <div className="flex items-center gap-3 text-sm shrink-0">
          <div
            className="flex items-center gap-2 rounded-lg px-3 py-2 font-semibold"
            style={{ backgroundColor: playerColor + "33", border: `1.5px solid ${playerColor}66` }}
          >
            <span>{racingEmoji}</span>
            <span style={{ color: playerColor }}>{playerName}</span>
            <span className="text-slate-400 font-normal">pole {playerPos + 1}/{TRACK_LENGTH}</span>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 opacity-60">
            <span>👻</span>
            <span className="text-slate-400 font-semibold">Ghost</span>
            <span className="text-slate-500 font-normal">pole {ghostPos + 1}/{TRACK_LENGTH}</span>
          </div>
          {finished && (
            <div className={`ml-auto rounded-lg px-3 py-2 text-sm font-bold ${finished === "player" ? "bg-emerald-800 text-emerald-200" : "bg-red-900 text-red-200"}`}>
              {finished === "player" ? "🏆 Vyhrál jsi!" : "💨 Ghost vyhrál!"}
            </div>
          )}
        </div>

        {/* ── Track ── */}
        <div
          ref={trackRef}
          className="flex gap-1.5 overflow-x-auto rounded-xl bg-slate-800/80 p-3 shrink-0"
          style={{ scrollBehavior: "smooth" }}
        >
          {TRACK.map((cell, i) => {
            const cfg = CELL_CFG[cell.type];
            const isPlayer = i === playerPos;
            const isGhost  = i === ghostPos && !isPlayer;
            const bothHere = i === playerPos && i === ghostPos;
            return (
              <div
                key={i}
                className={`
                  relative flex-shrink-0 w-[68px] h-[68px] rounded-lg flex flex-col items-center justify-center gap-0.5
                  border-2 transition-all duration-200
                  ${cfg.bg} ${cfg.border}
                  ${isPlayer ? "scale-110 ring-2 ring-white ring-offset-1 ring-offset-slate-900" : ""}
                  ${isGhost  ? "ring-2 ring-slate-400 ring-offset-1 ring-offset-slate-900" : ""}
                `}
              >
                <span className="text-xl leading-none select-none">
                  {bothHere ? `${racingEmoji}` : isPlayer ? racingEmoji : isGhost ? "👻" : cfg.emoji}
                </span>
                <span className="text-[9px] text-white/50 font-bold tabular-nums">{i + 1}</span>
                {cell.type !== "normal" && cell.type !== "finish" && !isPlayer && !isGhost && (
                  <span className="text-[8px] text-white/40 font-semibold uppercase tracking-tight leading-none">
                    {cfg.label}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Log + Controls ── */}
        <div className="flex gap-4 flex-1 min-h-0">

          {/* Log */}
          <div className="flex-1 rounded-xl bg-slate-800 border border-slate-700 p-3 overflow-y-auto text-xs font-mono space-y-1">
            {log.map((entry, i) => (
              <div key={i} className={i === 0 ? "text-slate-100" : "text-slate-500"}>
                {entry}
              </div>
            ))}
          </div>

          {/* Controls */}
          <div className="w-40 flex flex-col gap-2 shrink-0">
            <button
              onClick={handleRoll}
              disabled={!!finished}
              className="w-full rounded-xl bg-amber-500 px-4 py-5 text-base font-black text-white hover:bg-amber-400 active:scale-95 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              🎲 Hodit
            </button>
            <button
              onClick={handleReset}
              className="w-full rounded-xl bg-slate-700 border border-slate-600 px-4 py-2.5 text-sm font-semibold text-slate-300 hover:bg-slate-600 transition"
            >
              ↺ Reset
            </button>
            {/* Legend */}
            <div className="mt-2 space-y-1 text-[10px] text-slate-500">
              <div className="font-bold text-slate-600 uppercase tracking-wide mb-1">Prvky</div>
              {(["boost","slow","obstacle","finish"] as CellType[]).map(t => (
                <div key={t} className="flex items-center gap-1.5">
                  <span>{CELL_CFG[t].emoji}</span>
                  <span>{CELL_CFG[t].label}</span>
                  <span className="text-slate-600 truncate">{CELL_CFG[t].effect}</span>
                </div>
              ))}
            </div>
            <div className="text-[10px] text-slate-600 text-center pt-1">
              Výsledek se neukládá.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
