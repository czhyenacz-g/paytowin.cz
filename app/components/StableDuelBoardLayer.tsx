"use client";

/**
 * StableDuelBoardLayer — Stájový souboj jako overlay uvnitř board surface.
 * Renderuje se jako absolute inset-0 z-[55].
 * Fáze: prestart → arena → result
 * Žádné DB zápisy. V isDev=true výsledek označen jako PREVIEW.
 */

import React from "react";
import DuelArena from "./duel/DuelArena";
import type { DuelConfig } from "@/lib/duel/types";
import type { Horse } from "@/lib/types/game";

export interface DuelContestant {
  name: string;
  horse: Horse | null;
  color: string;
}

interface Props {
  challenger: DuelContestant;
  defender: DuelContestant;
  isDev?: boolean;
  backgroundUrl?: string;
  onFinish: (winner: "challenger" | "defender" | "draw") => void;
}

type Phase = "prestart" | "arena" | "result";

const BOARD_DUEL_CONFIG: DuelConfig = { gridW: 20, gridH: 14, maxTicks: 200, tickMs: 120 };
const DUEL_REWARD = 50;
const PRESTART_TICKS = 5; // sekund na předstartovní obrazovce

// ─── sub-komponenty ────────────────────────────────────────────────────────────

function KeyCap({ label }: { label: string }) {
  return (
    <span
      className="inline-flex items-center justify-center rounded-[5px] border border-b-[3px] bg-slate-700 font-mono font-black text-white px-2 py-0.5 text-sm min-w-[2rem] leading-none shadow-sm"
      style={{ borderColor: "rgba(255,255,255,0.25)", borderBottomColor: "rgba(255,255,255,0.12)" }}
    >
      {label}
    </span>
  );
}

function SideCard({
  contestant,
  keys,
  label,
  align,
}: {
  contestant: DuelContestant;
  keys: React.ReactNode;
  label: string;
  align: "left" | "right";
}) {
  const al = align === "left" ? "items-start text-left" : "items-end text-right";
  return (
    <div className={`flex flex-col gap-1.5 w-28 shrink-0 ${al}`}>
      <div
        className="rounded-xl border-2 p-2.5 bg-black/50 w-full flex flex-col gap-1"
        style={{ borderColor: contestant.color }}
      >
        <div className="text-3xl leading-none text-center">{contestant.horse?.emoji ?? "🐎"}</div>
        <div className="text-[10px] font-bold text-white/90 text-center leading-tight">
          {contestant.horse?.name ?? "Bez koně"}
        </div>
        <div className="text-[9px] font-semibold text-center" style={{ color: contestant.color }}>
          {contestant.name}
        </div>
        <div className="text-[9px] text-slate-400 text-center font-mono">1 : 2.5</div>
        <div className="text-[7px] text-slate-600 text-center uppercase tracking-widest font-bold">{label}</div>
      </div>
      <div className={`flex gap-1 ${align === "right" ? "justify-end" : "justify-start"}`}>{keys}</div>
    </div>
  );
}

function PreStartPhase({
  challenger,
  defender,
  countdown,
  onClick,
}: {
  challenger: DuelContestant;
  defender: DuelContestant;
  countdown: number;
  onClick: () => void;
}) {
  const countColor =
    countdown <= 1 ? "#f87171" : countdown <= 2 ? "#fbbf24" : countdown <= 3 ? "#facc15" : "white";

  return (
    <div
      className="flex flex-1 flex-col items-center justify-center gap-3 px-4 cursor-pointer select-none"
      onClick={onClick}
    >
      {/* Top label */}
      <div className="text-[9px] font-mono tracking-widest text-slate-500 uppercase">Stájový souboj</div>

      {/* Main title + countdown */}
      <div className="flex flex-col items-center gap-0.5">
        <div
          className="text-3xl sm:text-4xl font-black text-white tracking-tight text-center leading-tight"
          style={{ textShadow: "0 0 30px rgba(255,200,0,0.35)" }}
        >
          PŘIPRAVTE SE
        </div>
        <div
          key={countdown}
          className="text-5xl font-black tabular-nums leading-none mt-1"
          style={{ color: countColor, textShadow: `0 0 24px ${countColor}` }}
        >
          {countdown > 0 ? countdown : "GO!"}
        </div>
      </div>

      {/* Game name */}
      <div
        className="text-base font-black tracking-tight"
        style={{ color: "#00ff88", textShadow: "0 0 16px rgba(0,255,136,0.5)" }}
      >
        NEON ROPE DUEL
      </div>

      {/* Players + keys */}
      <div className="flex items-start gap-3 mt-1">
        <SideCard
          contestant={challenger}
          label="Challenger"
          align="left"
          keys={<><KeyCap label="A" /><KeyCap label="D" /></>}
        />
        <div className="flex flex-col items-center justify-center gap-1 pt-4">
          <span className="text-xl">⚔️</span>
          <span className="text-[9px] text-slate-600 font-mono">vs</span>
        </div>
        <SideCard
          contestant={defender}
          label="Defender"
          align="right"
          keys={<><KeyCap label="←" /><KeyCap label="→" /></>}
        />
      </div>

      {/* Instructions */}
      <div className="flex flex-col items-center gap-0.5 mt-1 text-[10px] text-slate-400 text-center leading-snug">
        <div>Zatáčej vlevo a vpravo. Bez klávesy jedeš rovně.</div>
        <div>Nenarážej do zdí ani do světelného provazu.</div>
      </div>

      <div className="text-[9px] text-slate-700 mt-2">klikni pro přeskočení</div>
    </div>
  );
}

function ArenaPhase({
  backgroundUrl,
  onResult,
}: {
  backgroundUrl?: string;
  onResult: (w: 1 | 2 | "draw") => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center overflow-hidden">
      <DuelArena
        config={BOARD_DUEL_CONFIG}
        mode="pvbot"
        autoStart
        backgroundUrl={backgroundUrl}
        overlayOpacity={0.20}
        onResult={onResult}
      />
    </div>
  );
}

function ResultPhase({
  challenger,
  defender,
  winner,
  isDev,
  onContinue,
}: {
  challenger: DuelContestant;
  defender: DuelContestant;
  winner: "challenger" | "defender" | "draw";
  isDev: boolean;
  onContinue: () => void;
}) {
  const winnerC = winner === "challenger" ? challenger : winner === "defender" ? defender : null;
  const loserC  = winner === "challenger" ? defender  : winner === "defender"  ? challenger : null;

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 select-none">
      {isDev && (
        <div className="rounded bg-amber-900/60 px-3 py-1 text-[9px] font-mono text-amber-400 uppercase tracking-wider border border-amber-700">
          DEV · PREVIEW · bez DB zápisu
        </div>
      )}

      <div
        className={`text-3xl font-black ${winner === "draw" ? "text-slate-300" : "text-emerald-400"}`}
        style={winnerC ? { textShadow: `0 0 24px ${winnerC.color}` } : {}}
      >
        {winner === "draw" ? "REMÍZA" : `🏆 ${winnerC?.name ?? "?"} vyhrál!`}
      </div>

      {winner !== "draw" && winnerC && loserC && (
        <div className="flex items-center gap-4 text-sm font-semibold">
          <span style={{ color: winnerC.color }}>{winnerC.name}</span>
          <span className="text-emerald-400">+{DUEL_REWARD} 💰</span>
          <span className="text-slate-600">·</span>
          <span style={{ color: loserC.color }}>{loserC.name}</span>
          <span className="text-red-400">−{DUEL_REWARD} 💰</span>
        </div>
      )}

      {isDev && (
        <div className="text-[9px] text-slate-600">(peníze se v dev módu nezapisují)</div>
      )}

      <button
        onClick={onContinue}
        className="mt-2 rounded-xl bg-slate-700 border border-slate-600 px-6 py-2.5 text-sm font-bold text-slate-200 hover:bg-slate-600 active:scale-95 transition-all"
      >
        Pokračovat →
      </button>
    </div>
  );
}

// ─── hlavní komponenta ─────────────────────────────────────────────────────────

export default function StableDuelBoardLayer({
  challenger,
  defender,
  isDev = false,
  backgroundUrl,
  onFinish,
}: Props) {
  const [phase, setPhase]   = React.useState<Phase>("prestart");
  const [countdown, setCountdown] = React.useState(PRESTART_TICKS);
  const [duelKey, setDuelKey]     = React.useState(0);
  const [winner, setWinner]       = React.useState<"challenger" | "defender" | "draw" | null>(null);

  const startArena = React.useCallback(() => {
    setPhase("arena");
    setDuelKey(k => k + 1);
  }, []);

  // Countdown tick: PRESTART_TICKS → 1 (each 1 s), then transition
  React.useEffect(() => {
    if (phase !== "prestart") return;
    if (countdown <= 0) {
      startArena();
      return;
    }
    const id = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(id);
  }, [phase, countdown, startArena]);

  const handleSkip = () => {
    if (phase === "prestart") startArena();
  };

  const handleDuelResult = (w: 1 | 2 | "draw") => {
    const mapped = w === 1 ? "challenger" : w === 2 ? "defender" : "draw" as const;
    setWinner(mapped);
    setPhase("result");
  };

  return (
    <div
      className="absolute inset-0 z-[55] flex flex-col overflow-hidden"
      style={{ background: "rgba(5,8,20,0.92)", backdropFilter: "blur(2px)" }}
    >
      {phase === "prestart" && (
        <PreStartPhase
          challenger={challenger}
          defender={defender}
          countdown={countdown}
          onClick={handleSkip}
        />
      )}
      {phase === "arena" && (
        <ArenaPhase key={duelKey} backgroundUrl={backgroundUrl} onResult={handleDuelResult} />
      )}
      {phase === "result" && winner && (
        <ResultPhase
          challenger={challenger}
          defender={defender}
          winner={winner}
          isDev={isDev}
          onContinue={() => onFinish(winner)}
        />
      )}
    </div>
  );
}
