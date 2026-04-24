"use client";

/**
 * DevRaceFlipLayer — dev-only závodní vrstva pro flip efekt.
 * Umístěná jako sourozenec board surface (ne uvnitř), takže se nerotuje spolu s boardem.
 * Má vlastní entering animaci (rotateY 90→0deg), která navazuje na flip boardu.
 * Žádný game state, žádné DB. Lze smazat bez dopadu.
 */

import React from "react";

interface Props {
  playerName: string;
  playerColor: string;
  racingEmoji: string;
  onExit: () => void;
}

type CellType = "start" | "normal" | "boost" | "slow" | "obstacle" | "finish";

interface Cell { idx: number; type: CellType; }

const TRACK: Cell[] = (
  ["start","boost","normal","slow","normal","obstacle","normal","boost","normal","slow","normal","finish"] as CellType[]
).map((type, idx) => ({ idx, type }));

const FINISH = TRACK.length - 1;

const CFG: Record<CellType, { bg: string; ring: string; emoji: string }> = {
  start:    { bg: "bg-slate-600",   ring: "ring-slate-300",   emoji: "🏁" },
  normal:   { bg: "bg-slate-800",   ring: "ring-slate-600",   emoji: "" },
  boost:    { bg: "bg-emerald-900", ring: "ring-emerald-400", emoji: "⚡" },
  slow:     { bg: "bg-orange-950",  ring: "ring-orange-400",  emoji: "🐌" },
  obstacle: { bg: "bg-red-950",     ring: "ring-red-500",     emoji: "🚧" },
  finish:   { bg: "bg-amber-800",   ring: "ring-amber-300",   emoji: "🏁" },
};

function rollD6() { return Math.floor(Math.random() * 6) + 1; }

export default function DevRaceFlipLayer({ playerName, playerColor, racingEmoji, onExit }: Props) {
  // Entering animation: starts at rotateY(90deg), enters to rotateY(0deg)
  const [entered, setEntered] = React.useState(false);
  React.useEffect(() => {
    const id1 = requestAnimationFrame(() => {
      const id2 = requestAnimationFrame(() => setEntered(true));
      return () => cancelAnimationFrame(id2);
    });
    return () => cancelAnimationFrame(id1);
  }, []);

  const [playerPos, setPlayerPos] = React.useState(0);
  const [ghostPos,  setGhostPos]  = React.useState(0);
  const [log,       setLog]       = React.useState("Závod! Hoď kostkou.");
  const [done,      setDone]      = React.useState<"player"|"ghost"|null>(null);

  const applyCell = (pos: number, base: number): [number, string] => {
    const t = TRACK[Math.min(pos, FINISH)]?.type;
    if (t === "boost")    return [Math.min(pos + 2, FINISH), " ⚡+2"];
    if (t === "slow")     return [Math.max(pos - 1, 0),      " 🐌−1"];
    if (t === "obstacle") return [base,                       " 🚧stop"];
    return [Math.min(pos, FINISH), ""];
  };

  const handleRoll = () => {
    if (done) return;
    const r = rollD6();
    const [np, pfx] = applyCell(playerPos + r, playerPos);
    setPlayerPos(np);
    if (np >= FINISH) { setDone("player"); setLog(`${racingEmoji} hod ${r}${pfx} → 🏆 Cíl!`); return; }

    const gr = Math.floor(Math.random() * 3) + 2;
    const [ng, gfx] = applyCell(ghostPos + gr, ghostPos);
    setGhostPos(ng);
    if (ng >= FINISH) { setDone("ghost"); setLog(`${racingEmoji} +${r}${pfx} | 👻 +${gr}${gfx} → 💨`); return; }
    setLog(`${racingEmoji} +${r}${pfx} | 👻 +${gr}${gfx}`);
  };

  const handleReset = () => {
    setPlayerPos(0); setGhostPos(0); setDone(null); setLog("Restart!");
  };

  return (
    <div
      className="absolute inset-0 z-[50] overflow-hidden rounded-[4px] flex flex-col"
      style={{
        background: "linear-gradient(160deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)",
        transform: entered ? "perspective(900px) rotateY(0deg)" : "perspective(900px) rotateY(90deg)",
        transition: entered ? "transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)" : "none",
        transformOrigin: "left center",
      }}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-black/20 border-b border-white/5 shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-mono font-bold text-purple-300 bg-purple-900/70 px-1.5 py-0.5 rounded tracking-widest">
            DEV · FLIP
          </span>
          <span className="text-xs font-semibold text-slate-300">Race Board</span>
        </div>
        <button
          onClick={onExit}
          className="rounded-md bg-white/10 px-2.5 py-1 text-xs font-bold text-slate-300 hover:bg-red-600/80 hover:text-white transition-colors"
        >
          ✕ Zpět
        </button>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 overflow-hidden">

        {/* Players */}
        <div className="flex items-center gap-4 text-xs font-medium">
          <span style={{ color: playerColor }}>
            {racingEmoji} {playerName} · {playerPos + 1}/{TRACK.length}
          </span>
          <span className="text-indigo-400/60">vs</span>
          <span className="text-slate-500">
            👻 Ghost · {ghostPos + 1}/{TRACK.length}
          </span>
        </div>

        {/* Track */}
        <div className="flex items-center gap-1 overflow-x-auto max-w-full pb-1">
          {TRACK.map((cell, i) => {
            const cfg = CFG[cell.type];
            const isPlayer = i === playerPos;
            const isGhost  = i === ghostPos && !isPlayer;
            const both     = i === playerPos && i === ghostPos;
            return (
              <div
                key={i}
                className={`
                  relative flex-shrink-0 w-9 h-9 rounded-lg flex flex-col items-center justify-center
                  border border-white/5 transition-all duration-150 select-none
                  ${cfg.bg}
                  ${isPlayer ? `ring-2 ${cfg.ring} ring-white scale-110` : ""}
                  ${isGhost  ? `ring-1 ring-slate-500` : ""}
                `}
              >
                <span className="text-sm leading-none">
                  {both
                    ? racingEmoji
                    : isPlayer
                      ? racingEmoji
                      : isGhost
                        ? "👻"
                        : cfg.emoji
                          ? cfg.emoji
                          : <span className="block w-1 h-1 rounded-full bg-slate-600" />}
                </span>
                <span className="text-[7px] text-white/25 font-bold leading-none mt-0.5 tabular-nums">{i + 1}</span>
              </div>
            );
          })}
        </div>

        {/* Result */}
        {done && (
          <div className={`rounded-xl px-4 py-2 text-sm font-black ${done === "player" ? "bg-emerald-700/80 text-emerald-100" : "bg-red-800/80 text-red-200"}`}>
            {done === "player" ? `🏆 ${playerName} vyhrál!` : "💨 Ghost vyhrál."}
          </div>
        )}

        {/* Log */}
        <div className="text-[11px] font-mono text-indigo-300/70 text-center h-4">{log}</div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleRoll}
            disabled={!!done}
            className="rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-black text-white hover:bg-amber-400 active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            🎲 Hodit
          </button>
          <button
            onClick={handleReset}
            className="rounded-xl bg-white/10 px-3 py-2.5 text-sm font-semibold text-slate-400 hover:bg-white/20 transition-colors"
          >
            ↺
          </button>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 text-[9px] text-slate-600">
          <span>⚡ +2</span><span>🐌 −1</span><span>🚧 stop</span>
          <span className="text-slate-700">· výsledek se neukládá</span>
        </div>

      </div>
    </div>
  );
}
