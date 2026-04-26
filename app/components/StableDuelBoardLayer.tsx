"use client";

/**
 * StableDuelBoardLayer — Stájový souboj jako overlay uvnitř board surface.
 * Renderuje se jako absolute inset-0 z-[55].
 * Fáze: prestart → arena → result
 * Žádné DB zápisy. V isDev=true výsledek označen jako PREVIEW.
 */

import React from "react";
import DuelArena from "./duel/DuelArena";
import SpeedArenaPvp from "./speed/SpeedArenaPvp";
import type { DuelConfig } from "@/lib/duel/types";
import type { SpeedConfig } from "@/lib/speed/types";
import type { Horse } from "@/lib/types/game";
import { getRopeDuelSpeedLabel } from "@/lib/duel/helpers";
import { selectStableMinigame, type StableMinigameType } from "@/lib/minigames/selectStableMinigame";
import type { MinigameResult } from "@/lib/minigames/types";
import { computeMinigameSettlement, type MinigameSettlement } from "@/lib/minigames/settlement";

export interface DuelContestant {
  name: string;
  horse: Horse | null;
  color: string;
}

interface Props {
  challenger: DuelContestant;
  defender: DuelContestant;
  isDev?: boolean;  // true = preview mode (dev button), false = live trigger
  themeId?: string;
  backgroundUrl?: string;
  onFinish: (result: MinigameResult) => void;
}

type Phase = "prestart" | "arena" | "result";

const BOARD_DUEL_CONFIG: DuelConfig  = { gridW: 28, gridH: 20, maxTicks: 200, tickMs: 120 };
const BOARD_SPEED_CONFIG: SpeedConfig = {
  arenaW: 480, arenaH: 320,
  maxTicks: 120, tickMs: 80,
  acceleration: 0.04, maxVelocity: 8,
  turnRate: 0.075,
  crashVelocityThreshold: 4.5,
  boostStrength: 1.5, slowStrength: 1.2,
  objectRespawnTicks: 45,
};
const PRESTART_TICKS = 5;

const MINIGAME_META: Record<StableMinigameType, { title: string; image: string; color: string; glowRgb: string }> = {
  neon_rope_duel: { title: "NEON ROPE DUEL",  image: "/minigames/neon_rope.webp",          color: "#00ff88", glowRgb: "0,255,136" },
  neon_speedrace: { title: "NEON SPEEDRACE",  image: "/minigames/neon_speedrace.webp",      color: "#22d3ee", glowRgb: "34,211,238" },
  legendary_race: { title: "LEGENDARY RACE",  image: "/minigames/neon_legendary_race.webp", color: "#fbbf24", glowRgb: "251,191,36" },
};

// ─── sub-komponenty ────────────────────────────────────────────────────────────

/** Tailwind class → CSS hex. Fallback pokud barva není platná CSS barva. */
function toNeonColor(color: string | undefined, fallback: string): string {
  if (!color) return fallback;
  if (color.startsWith("#") || color.startsWith("rgb")) return color;
  return fallback;
}

function NeonKeyCap({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="inline-flex items-center justify-center rounded-[6px] font-mono font-black px-3 py-2 text-base min-w-[3rem] leading-none"
      style={{
        background: "rgba(8,10,20,0.96)",
        border: `2px solid ${color}`,
        borderBottomWidth: "4px",
        borderBottomColor: `${color}aa`,
        boxShadow: `0 0 8px ${color}, 0 0 18px ${color}cc, 0 0 32px ${color}66, inset 0 0 6px ${color}28`,
        color: "white",
        textShadow: `0 0 8px ${color}, 0 0 16px ${color}cc`,
      }}
    >
      {label}
    </span>
  );
}

function PlayerCard({ contestant, label }: { contestant: DuelContestant; label: string }) {
  const [imgErr, setImgErr] = React.useState(false);
  const imgSrc = contestant.horse?.image ?? null;
  const showImg = !!imgSrc && !imgErr;
  const speed = contestant.horse?.speed ?? 5;
  const speedLabel = getRopeDuelSpeedLabel(speed);

  return (
    <div
      className="rounded-2xl overflow-hidden flex flex-col w-44 shrink-0"
      style={{
        background: `linear-gradient(170deg, ${contestant.color}22 0%, rgba(4,6,16,0.97) 55%)`,
        border: `3px solid ${contestant.color}`,
        boxShadow: `0 0 8px ${contestant.color}, 0 0 22px ${contestant.color}cc, 0 0 48px ${contestant.color}88, 0 0 80px ${contestant.color}44, inset 0 0 14px ${contestant.color}28`,
      }}
    >
      {/* Hero image */}
      <div className="relative h-32 flex items-center justify-center overflow-hidden bg-black/50">
        {showImg ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imgSrc}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            onError={() => setImgErr(true)}
          />
        ) : (
          <div className="text-6xl leading-none">{contestant.horse?.emoji ?? "🐎"}</div>
        )}
        <div
          className="absolute inset-x-0 bottom-0 h-10 pointer-events-none"
          style={{ background: "linear-gradient(to top, rgba(4,6,16,0.95), transparent)" }}
        />
      </div>

      {/* Text section */}
      <div className="flex flex-col items-center gap-1 px-3 py-2.5">
        <div
          className="text-base font-black text-center leading-tight"
          style={{ color: "#fef3c7", textShadow: "0 0 12px rgba(251,191,36,0.3)" }}
        >
          {contestant.horse?.name ?? "Bez koně"}
        </div>
        <div className="text-sm font-semibold text-center" style={{ color: contestant.color }}>
          {contestant.name}
        </div>
        <div
          className="rounded-full px-3 py-1 text-xs font-mono font-bold mt-0.5"
          style={{
            background: `${contestant.color}18`,
            border: `1.5px solid ${contestant.color}`,
            color: contestant.color,
            boxShadow: `0 0 8px ${contestant.color}cc, 0 0 16px ${contestant.color}55`,
          }}
        >
          1 : 2.5
        </div>
        <div
          className="rounded-md px-2 py-1 mt-1 text-[8px] font-mono text-center leading-snug w-full"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)" }}
        >
          <div style={{ color: `${contestant.color}bb` }}>
            start: <span className="text-white">{speedLabel.start}</span>
            {" · "}
            nitro: <span className="text-white">{speedLabel.nitro}</span>
          </div>
          {contestant.horse && (
            <div className="text-slate-400 mt-0.5">
              stamina: <span className="text-white">{contestant.horse.stamina ?? contestant.horse.maxStamina ?? "?"}</span>
              {" / "}
              <span className="text-slate-300">{contestant.horse.maxStamina ?? "?"}</span>
            </div>
          )}
        </div>
        <div className="text-[7px] text-slate-600 uppercase tracking-widest font-bold mt-0.5">{label}</div>
      </div>
    </div>
  );
}

function PreStartPhase({
  challenger,
  defender,
  countdown,
  minigameType,
  isDev,
  onClick,
}: {
  challenger: DuelContestant;
  defender: DuelContestant;
  countdown: number;
  minigameType: StableMinigameType;
  isDev: boolean;
  onClick: () => void;
}) {
  const meta = MINIGAME_META[minigameType];
  const countColor =
    countdown <= 1 ? "#f87171" : countdown <= 2 ? "#fbbf24" : countdown <= 3 ? "#facc15" : "white";
  const challengerColor = toNeonColor(challenger.color, "#00ff88");
  const defenderColor   = toNeonColor(defender.color,   "#c084fc");
  const cWithColor = { ...challenger, color: challengerColor };
  const dWithColor = { ...defender,   color: defenderColor };

  return (
    <div
      className="flex flex-1 flex-col items-center justify-center gap-1.5 px-4 cursor-pointer select-none"
      onClick={onClick}
    >
      <style>{`
        @keyframes vs-pulse {
          0%, 100% { text-shadow: 0 0 22px rgba(220,38,38,0.9), 0 4px 0 rgba(127,29,29,0.75); }
          50% { text-shadow: 0 0 48px rgba(220,38,38,1), 0 0 80px rgba(220,38,38,0.55), 0 4px 0 rgba(127,29,29,0.75); transform: scale(1.08); }
        }
      `}</style>

      {/* Top label */}
      <div className="flex items-center gap-2">
        <div className="text-[9px] font-mono tracking-widest text-slate-500 uppercase">Stájový souboj</div>
        {isDev && (
          <div className="rounded px-1.5 py-0.5 text-[8px] font-mono font-bold uppercase tracking-wider bg-slate-800 border border-slate-700 text-slate-500">
            {minigameType}
          </div>
        )}
      </div>

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
        style={{ color: meta.color, textShadow: `0 0 16px rgba(${meta.glowRgb},0.5)` }}
      >
        {meta.title}
      </div>

      {/* Artwork */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={meta.image}
        alt=""
        width={176}
        height={235}
        className="rounded-lg object-cover"
        style={{ maxWidth: 176 }}
        onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
      />

      {/* Cards + VS + keycaps */}
      <div className="flex items-start gap-2">
        {/* Challenger card + keys */}
        <div className="flex flex-col items-center gap-1.5">
          <PlayerCard contestant={cWithColor} label="Challenger" />
          <div className="flex flex-col items-center gap-1">
            <div className="flex gap-1.5">
              <NeonKeyCap label="A" color={challengerColor} />
              <NeonKeyCap label="D" color={challengerColor} />
            </div>
            <div className="text-[8px] font-mono font-bold uppercase tracking-widest" style={{ color: `${challengerColor}cc` }}>
              ZATOČIT
            </div>
          </div>
        </div>

        {/* VS */}
        <div
          className="text-5xl font-black tracking-tighter shrink-0 leading-none px-1 self-center mt-6"
          style={{
            color: "#dc2626",
            animation: "vs-pulse 1.2s ease-in-out infinite",
          }}
        >
          VS
        </div>

        {/* Defender card + keys */}
        <div className="flex flex-col items-center gap-1.5">
          <PlayerCard contestant={dWithColor} label="Defender" />
          <div className="flex flex-col items-center gap-1">
            <div className="flex gap-1.5">
              <NeonKeyCap label="←" color={defenderColor} />
              <NeonKeyCap label="→" color={defenderColor} />
            </div>
            <div className="text-[8px] font-mono font-bold uppercase tracking-widest" style={{ color: `${defenderColor}cc` }}>
              ZATOČIT
            </div>
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="text-[10px] text-slate-600 text-center leading-snug">
        Zatáčej vlevo a vpravo · nenarážej do zdí ani do provazu
      </div>

      <div className="text-[9px] text-slate-700">klikni pro přeskočení</div>
    </div>
  );
}

function ArenaPhase({
  backgroundUrl,
  p1Speed = 5,
  p2Speed = 5,
  minigameType,
  onResult,
}: {
  backgroundUrl?: string;
  p1Speed?: number;
  p2Speed?: number;
  minigameType: StableMinigameType;
  onResult: (result: MinigameResult) => void;
}) {
  if (minigameType === "neon_speedrace") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center overflow-auto">
        <SpeedArenaPvp
          config={BOARD_SPEED_CONFIG}
          autoStart
          backgroundUrl={backgroundUrl}
          overlayOpacity={0.20}
          onResult={onResult}
        />
      </div>
    );
  }

  // neon_rope_duel + legendary_race fallback
  // TODO: legendary_race gets its own LegendaryArena component
  return (
    <div className="flex flex-1 flex-col items-center justify-center overflow-hidden">
      <DuelArena
        config={BOARD_DUEL_CONFIG}
        mode="pvbot"
        autoStart
        backgroundUrl={backgroundUrl}
        overlayOpacity={0.20}
        p1Speed={p1Speed}
        p2Speed={p2Speed}
        onResult={onResult}
      />
    </div>
  );
}

function ResultPhase({
  challenger,
  defender,
  result,
  settlement,
  isDev,
  onContinue,
}: {
  challenger:  DuelContestant;
  defender:    DuelContestant;
  result:      MinigameResult;
  settlement:  MinigameSettlement;
  isDev:       boolean;
  onContinue:  () => void;
}) {
  const winner  = result.winner === 1 ? "challenger" : result.winner === 2 ? "defender" : "draw";
  const winnerC = winner === "challenger" ? challenger : winner === "defender" ? defender : null;

  const sides = [
    { contestant: challenger, ps: settlement.p1, pr: result.p1, isWinner: winner === "challenger" },
    { contestant: defender,   ps: settlement.p2, pr: result.p2, isWinner: winner === "defender"   },
  ] as const;

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 select-none">
      {isDev && (
        <div className="rounded bg-amber-900/60 px-3 py-1 text-[9px] font-mono text-amber-400 uppercase tracking-wider border border-amber-700">
          DEV PREVIEW — nic se neukládá
        </div>
      )}

      {/* Headline */}
      <div
        className={`text-2xl font-black text-center ${winner === "draw" ? "text-slate-300" : "text-emerald-400"}`}
        style={winnerC ? { textShadow: `0 0 24px ${winnerC.color}` } : {}}
      >
        {winner === "draw" ? "REMÍZA" : `🏆 VÍTĚZÍ ${winnerC?.name ?? "?"}`}
      </div>

      {/* Settlement cards */}
      <div className="flex gap-3 items-stretch">
        {sides.map(({ contestant, ps, pr, isWinner }) => (
          <div
            key={contestant.name}
            className="rounded-xl flex flex-col items-center gap-1.5 px-4 py-3 min-w-[140px]"
            style={{
              background: `${contestant.color}12`,
              border: `2px solid ${contestant.color}${isWinner ? "" : "55"}`,
              boxShadow: isWinner ? `0 0 18px ${contestant.color}66` : "none",
            }}
          >
            <div className="text-sm font-black text-center" style={{ color: contestant.color }}>
              {contestant.name}
            </div>
            <div className="text-[10px] text-slate-400 text-center leading-tight">
              {contestant.horse?.emoji ?? "🐎"} {contestant.horse?.name ?? "Bez koně"}
            </div>

            {/* Coins */}
            <div
              className="text-base font-black tabular-nums mt-0.5"
              style={{
                color: ps.coinsDelta > 0 ? "#4ade80" : ps.coinsDelta < 0 ? "#f87171" : "#64748b",
              }}
            >
              {ps.coinsDelta > 0 ? "+" : ""}{ps.coinsDelta} 💰
            </div>

            {/* Stamina total */}
            <div className="text-[11px] font-bold text-red-400">
              −{ps.stamina.total} stamina
            </div>

            {/* Breakdown */}
            <div className="text-[9px] font-mono text-slate-600 text-center space-y-0.5 leading-relaxed">
              <div>závod −{ps.stamina.base}</div>
              {pr.usedNitro && <div className="text-amber-600">nitro −{ps.stamina.nitro}</div>}
              {pr.crashed   && <div className="text-red-600">crash −{ps.stamina.crash}</div>}
            </div>

            {isWinner && (
              <div className="text-[9px] font-bold text-emerald-400 uppercase tracking-wide mt-0.5">VÍTĚZ ✓</div>
            )}
          </div>
        ))}
      </div>

      <button
        onClick={onContinue}
        className="mt-1 rounded-xl bg-slate-700 border border-slate-600 px-6 py-2.5 text-sm font-bold text-slate-200 hover:bg-slate-600 active:scale-95 transition-all"
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
  themeId = "horse-day",
  backgroundUrl,
  onFinish,
}: Props) {
  const [phase, setPhase]         = React.useState<Phase>("prestart");
  const [countdown, setCountdown] = React.useState(PRESTART_TICKS);
  const [duelKey, setDuelKey]     = React.useState(0);
  const [duelResult, setDuelResult] = React.useState<MinigameResult | null>(null);

  const p1Speed = challenger.horse?.speed ?? 5;
  const p2Speed = defender.horse?.speed ?? 5;
  const minigameType = selectStableMinigame({
    themeId,
    challengerHorse: challenger.horse,
    defenderHorse:   defender.horse,
  });

  const startArena = React.useCallback(() => {
    setPhase("arena");
    setDuelKey(k => k + 1);
  }, []);

  React.useEffect(() => {
    if (phase !== "prestart") return;
    if (countdown <= 0) { startArena(); return; }
    const id = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(id);
  }, [phase, countdown, startArena]);

  const handleSkip = () => { if (phase === "prestart") startArena(); };

  const handleDuelResult = (result: MinigameResult) => {
    setDuelResult(result);
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
          minigameType={minigameType}
          isDev={isDev}
          onClick={handleSkip}
        />
      )}
      {phase === "arena" && (
        <ArenaPhase key={duelKey} backgroundUrl={backgroundUrl} p1Speed={p1Speed} p2Speed={p2Speed} minigameType={minigameType} onResult={handleDuelResult} />
      )}
      {phase === "result" && duelResult && (
        <ResultPhase
          challenger={challenger}
          defender={defender}
          result={duelResult}
          settlement={computeMinigameSettlement(duelResult, challenger.horse?.price, defender.horse?.price)}
          isDev={isDev}
          onContinue={() => onFinish(duelResult)}
        />
      )}
    </div>
  );
}
