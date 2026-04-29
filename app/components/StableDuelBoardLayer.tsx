"use client";

/**
 * StableDuelBoardLayer — Stájový souboj jako overlay uvnitř board surface.
 * Renderuje se jako absolute inset-0 z-[55].
 * Fáze: prestart → arena → result (nebo waiting_result pro defender_remote)
 * Žádné DB zápisy. V isDev=true výsledek označen jako PREVIEW.
 *
 * duelRole:
 *   "challenger_authority" — spouští simulaci, přijímá defender inputy přes Broadcast
 *   "defender_remote"      — renderuje lokální arena, sbírá inputy, posílá přes Broadcast
 *   undefined              — pvbot / preview (původní chování)
 */

import React from "react";
import DuelArena from "./duel/DuelArena";
import SpeedArenaPvp from "./speed/SpeedArenaPvp";
import type { DuelConfig } from "@/lib/duel/types";
import type { Dir } from "@/lib/duel/types";
import type { SpeedConfig } from "@/lib/speed/types";
import type { Horse } from "@/lib/types/game";
import { getRopeDuelSpeedLabel } from "@/lib/duel/helpers";
import { selectStableMinigame, type StableMinigameType } from "@/lib/minigames/selectStableMinigame";
import type { MinigameResult } from "@/lib/minigames/types";
import { computeMinigameSettlement, type MinigameSettlement } from "@/lib/minigames/settlement";
import { supabase } from "@/lib/supabase";
import type { StableDuelInputEvent, StableDuelSnapshotEvent } from "@/lib/duel/broadcastTypes";

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
  // PvP v1
  duelRole?: "challenger_authority" | "defender_remote";
  duelId?: string;
  gameId?: string;
  challengerId?: string;
  defenderId?: string;
  // online_1v1: drive prestart countdown from shared DB startsAt, no manual start button
  useSharedCountdown?: boolean;
  sharedCountdownEndsAt?: number;
  disableManualStart?: boolean;
}

type Phase = "prestart" | "arena" | "result" | "waiting_result";

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
  duelRole,
  p2IsLegendary,
  disableManualStart,
  onClick,
}: {
  challenger: DuelContestant;
  defender: DuelContestant;
  countdown: number;
  minigameType: StableMinigameType;
  isDev: boolean;
  duelRole?: "challenger_authority" | "defender_remote";
  p2IsLegendary?: boolean;
  disableManualStart?: boolean;
  onClick: () => void;
}) {
  const meta = MINIGAME_META[minigameType];
  const countColor =
    countdown <= 1 ? "#f87171" : countdown <= 2 ? "#fbbf24" : countdown <= 3 ? "#facc15" : "white";
  const challengerColor = toNeonColor(challenger.color, "#00ff88");
  const defenderColor   = toNeonColor(defender.color,   "#c084fc");
  const cWithColor = { ...challenger, color: challengerColor };
  const dWithColor = { ...defender,   color: defenderColor };

  // Defender: klávesy ArrowLeft/Right; Challenger: A/D
  const cKeys = duelRole === "defender_remote"
    ? null  // challenger klávesy nepotřebujeme zobrazovat
    : <><NeonKeyCap label="A" color={challengerColor} /><NeonKeyCap label="D" color={challengerColor} /></>;
  const dKeys = <><NeonKeyCap label="←" color={defenderColor} /><NeonKeyCap label="→" color={defenderColor} /></>;

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
        {duelRole === "defender_remote" && (
          <div className="rounded px-1.5 py-0.5 text-[8px] font-mono font-bold uppercase tracking-wider bg-violet-900/60 border border-violet-700/50 text-violet-400">
            DEFENDER
          </div>
        )}
        {duelRole === "challenger_authority" && (
          <div className="rounded px-1.5 py-0.5 text-[8px] font-mono font-bold uppercase tracking-wider bg-emerald-900/60 border border-emerald-700/50 text-emerald-400">
            CHALLENGER
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
          {cKeys && (
            <div className="flex flex-col items-center gap-1">
              <div className="flex gap-1.5">{cKeys}</div>
              <div className="text-[8px] font-mono font-bold uppercase tracking-widest" style={{ color: `${challengerColor}cc` }}>
                ZATOČIT
              </div>
            </div>
          )}
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
            <div className="flex gap-1.5">{dKeys}</div>
            <div className="text-[8px] font-mono font-bold uppercase tracking-widest" style={{ color: `${defenderColor}cc` }}>
              ZATOČIT
            </div>
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="text-[10px] text-slate-600 text-center leading-snug">
        {duelRole === "defender_remote"
          ? `Hraješ jako defender: ← → pro zatáčení · S pro ${p2IsLegendary ? "legendary (cooldown 2s) ⭐" : "nitro"} · inputy se posílají challengerovi`
          : "Zatáčej vlevo a vpravo · nenarážej do zdí ani do provazu"
        }
      </div>

      {!disableManualStart && <div className="text-[9px] text-slate-700">klikni pro přeskočení</div>}
    </div>
  );
}

function ArenaPhase({
  backgroundUrl,
  p1Speed = 5,
  p2Speed = 5,
  minigameType,
  onResult,
  onStateSnapshot,
  remoteP2Ref,
  p1IsLegendary = false,
  p2IsLegendary = false,
  duelRole,
}: {
  backgroundUrl?: string;
  p1Speed?: number;
  p2Speed?: number;
  minigameType: StableMinigameType;
  onResult: (result: MinigameResult) => void;
  onStateSnapshot?: (snapshot: any) => void;
  remoteP2Ref?: React.MutableRefObject<{ dir: Dir; nitroActivate: boolean; legendaryActivate: boolean } | null>;
  p1IsLegendary?: boolean;
  p2IsLegendary?: boolean;
  duelRole?: "challenger_authority" | "defender_remote";
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
        mode={duelRole ? "pvp" : "pvbot"}
        autoStart={duelRole === "challenger_authority" || duelRole === "defender_remote"}
        backgroundUrl={backgroundUrl}
        overlayOpacity={0.20}
        p1Speed={p1Speed}
        p2Speed={p2Speed}
        onResult={onResult}
        onStateSnapshot={onStateSnapshot}
        remoteP2Ref={remoteP2Ref}
        p1IsLegendary={p1IsLegendary}
        p2IsLegendary={p2IsLegendary}
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
    <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 select-none overflow-y-auto">
      {isDev && (
        <div className="rounded bg-amber-900/60 px-3 py-1 text-[9px] font-mono text-amber-400 uppercase tracking-wider border border-amber-700 shrink-0">
          DEV PREVIEW — nic se neukládá
        </div>
      )}

      {/* Headline */}
      {winner === "draw" ? (
        <div className="text-2xl font-black text-slate-300 text-center tracking-wide">REMÍZA</div>
      ) : (
        <div className="text-center shrink-0">
          <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">VÍTĚZ</div>
          <div
            className="text-3xl font-black leading-tight"
            style={{
              color: winnerC?.color ?? "#4ade80",
              textShadow: `0 0 28px ${winnerC?.color ?? "#4ade80"}99, 0 2px 0 rgba(0,0,0,0.5)`,
            }}
          >
            🏆 {winnerC?.name ?? "?"}
          </div>
        </div>
      )}

      {/* Settlement cards */}
      <div className="flex gap-2 items-stretch shrink-0">
        {sides.map(({ contestant, ps, pr, isWinner }, idx) => {
          const isDraw = winner === "draw";
          const coinColor = ps.coinsDelta > 0 ? "#4ade80" : ps.coinsDelta < 0 ? "#f87171" : "#64748b";
          return (
            <div
              key={idx === 0 ? "challenger" : "defender"}
              className="rounded-xl flex flex-col items-center gap-1 px-3 py-2.5 min-w-[130px]"
              style={{
                background: isWinner ? `${contestant.color}1a` : "rgba(10,14,28,0.65)",
                border: `2px solid ${contestant.color}${isDraw ? "88" : isWinner ? "" : "28"}`,
                boxShadow: isWinner ? `0 0 24px ${contestant.color}55, 0 0 8px ${contestant.color}33` : "none",
                opacity: isDraw ? 1 : isWinner ? 1 : 0.45,
                filter: !isDraw && !isWinner ? "grayscale(0.25)" : "none",
                transition: "opacity 0.2s",
              }}
            >
              {/* Badge */}
              {!isDraw && (
                <div className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${
                  isWinner
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                    : "bg-red-900/30 text-red-500 border border-red-800/40"
                }`}>
                  {isWinner ? "VÍTĚZ ✓" : "PROHRA"}
                </div>
              )}

              {/* Jméno */}
              <div className="text-sm font-black text-center leading-tight" style={{ color: contestant.color }}>
                {contestant.name}
              </div>
              <div className="text-[9px] text-slate-500 text-center leading-tight">
                {contestant.horse?.emoji ?? "🐎"} {contestant.horse?.name ?? "Bez koně"}
              </div>

              {/* Coins — hlavní číslo */}
              <div
                className="text-2xl font-black tabular-nums leading-none mt-1"
                style={{
                  color: coinColor,
                  textShadow: ps.coinsDelta !== 0 ? `0 0 18px ${coinColor}88` : "none",
                }}
              >
                {ps.coinsDelta > 0 ? "+" : ""}{ps.coinsDelta} 💰
              </div>

              {/* Stamina souhrn */}
              <div className="text-[11px] font-bold text-red-400 mt-1 leading-none">
                −{ps.stamina.total} stamina
              </div>

              {/* Stamina breakdown */}
              <div className="text-[8px] font-mono text-center leading-snug mt-0.5">
                <div className="text-slate-700">závod −{ps.stamina.base}</div>
                {pr.usedNitro && <div className="text-amber-500">nitro −{ps.stamina.nitro}</div>}
                {pr.crashed   && <div className="text-red-600">crash −{ps.stamina.crash}</div>}
              </div>
            </div>
          );
        })}
      </div>

      <button
        onClick={onContinue}
        className="mt-1 shrink-0 rounded-xl bg-slate-700 border border-slate-600 px-6 py-2.5 text-sm font-bold text-slate-200 hover:bg-slate-600 hover:border-slate-500 hover:shadow-[0_0_14px_rgba(148,163,184,0.25)] active:scale-95 transition-all"
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
  duelRole,
  duelId,
  gameId,
  challengerId,
  defenderId,
  useSharedCountdown = false,
  sharedCountdownEndsAt,
  disableManualStart = false,
}: Props) {
  const [phase, setPhase]         = React.useState<Phase>("prestart");
  const [countdown, setCountdown] = React.useState(() => {
    if (useSharedCountdown && sharedCountdownEndsAt) {
      return Math.max(1, Math.ceil((sharedCountdownEndsAt - Date.now()) / 1000));
    }
    return PRESTART_TICKS;
  });
  const [duelKey, setDuelKey]     = React.useState(0);
  const [duelResult, setDuelResult] = React.useState<MinigameResult | null>(null);
  const [broadcastError, setBroadcastError] = React.useState(false);

  // Snapshot sync debug layer
  const [lastSnapshot, setLastSnapshot] = React.useState<StableDuelSnapshotEvent | null>(null);
  const lastLocalStateRef = React.useRef<any>(null);

  // challenger_authority: ref pro remote P2 (defender) inputy
  const remoteP2Ref = React.useRef<{ dir: Dir; nitroActivate: boolean; legendaryActivate: boolean } | null>(null);
  // Broadcast channel lifecycle
  const channelRef = React.useRef<ReturnType<typeof supabase.channel> | null>(null);
  const receivedSeqsRef = React.useRef<Set<number>>(new Set());
  const inputSeqRef = React.useRef(0);

  const p1Speed = challenger.horse?.speed ?? 5;
  const p2Speed = defender.horse?.speed ?? 5;
  const p1IsLegendary = !!(challenger.horse?.isLegendary);
  const p2IsLegendary = !!(defender.horse?.isLegendary);
  const minigameType = selectStableMinigame({
    themeId,
    challengerHorse: challenger.horse,
    defenderHorse:   defender.horse,
  });

  const startArena = React.useCallback(() => {
    setPhase("arena");
    setDuelKey(k => k + 1);
  }, []);

  // Internal tick countdown — only for pvbot/preview (not shared countdown)
  React.useEffect(() => {
    if (phase !== "prestart" || useSharedCountdown) return;
    if (countdown <= 0) { startArena(); return; }
    const id = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(id);
  }, [phase, countdown, startArena, useSharedCountdown]);

  // Shared countdown — driven by startsAt from DB, no per-tick DB writes
  React.useEffect(() => {
    if (!useSharedCountdown || !sharedCountdownEndsAt || phase !== "prestart") return;
    const update = () => {
      const remaining = sharedCountdownEndsAt - Date.now();
      if (remaining <= 0) { startArena(); return; }
      setCountdown(Math.ceil(remaining / 1000));
    };
    update();
    const id = setInterval(update, 250);
    return () => clearInterval(id);
  }, [useSharedCountdown, sharedCountdownEndsAt, phase, startArena]);

  const handleSkip = () => { if (phase === "prestart" && !disableManualStart) startArena(); };

  const handleDuelResult = (result: MinigameResult) => {
    // defender_remote: lokální výsledek není autoritativní — čekej na challenger
    if (duelRole === "defender_remote") {
      setPhase("waiting_result");
      return;
    }
    setDuelResult(result);
    setPhase("result");
  };

  // ── Broadcast: challenger_authority — přijímá defender inputy + posílá snapshoty ──────────────
  React.useEffect(() => {
    if (duelRole !== "challenger_authority" || !duelId || !gameId || !defenderId) return;
    const ch = supabase.channel(`stable-duel:${gameId}:${duelId}`);
    channelRef.current = ch;

    ch
      .on("broadcast", { event: "stable_duel_input" }, ({ payload }: { payload: StableDuelInputEvent }) => {
        if (payload.duelId !== duelId) return;
        if (payload.playerId !== defenderId) return;
        if (receivedSeqsRef.current.has(payload.seq)) return;
        receivedSeqsRef.current.add(payload.seq);

        if (payload.input.action === "turn") {
          const dir: Dir = payload.input.direction === "left" ? "left"
            : payload.input.direction === "right" ? "right"
            : "straight";
          remoteP2Ref.current = {
            dir,
            nitroActivate: remoteP2Ref.current?.nitroActivate ?? false,
            legendaryActivate: remoteP2Ref.current?.legendaryActivate ?? false
          };
        } else if (payload.input.action === "nitro" && payload.input.pressed) {
          remoteP2Ref.current = {
            dir: remoteP2Ref.current?.dir ?? "straight",
            nitroActivate: true,
            legendaryActivate: remoteP2Ref.current?.legendaryActivate ?? false
          };
        } else if (payload.input.action === "legendary" && payload.input.pressed) {
          remoteP2Ref.current = {
            dir: remoteP2Ref.current?.dir ?? "straight",
            nitroActivate: remoteP2Ref.current?.nitroActivate ?? false,
            legendaryActivate: true
          };
        }
      })
      .subscribe();

    // Snapshot broadcaster (5 Hz)
    const interval = setInterval(() => {
      const state = lastLocalStateRef.current;
      if (!state || !channelRef.current) return;
      channelRef.current.send({
        type: "broadcast",
        event: "stable_duel_snapshot",
        payload: {
          type: "stable_duel_snapshot",
          duelId,
          tick: state.tick,
          at: Date.now(),
          p1: state.p1,
          p2: state.p2,
          status: state.status,
        } satisfies StableDuelSnapshotEvent,
      });
    }, 200);

    return () => {
      clearInterval(interval);
      ch.unsubscribe();
      channelRef.current = null;
    };
  }, [duelRole, duelId, gameId, defenderId]);

  // ── Broadcast: defender_remote — sbírá a posílá inputy + přijímá snapshoty ────────────────────
  React.useEffect(() => {
    if (duelRole !== "defender_remote" || !duelId || !gameId || !defenderId) return;
    const dId = duelId;
    const pId = defenderId;

    const ch = supabase.channel(`stable-duel:${gameId}:${dId}`);
    channelRef.current = ch;

    ch
      .on("broadcast", { event: "stable_duel_snapshot" }, ({ payload }: { payload: StableDuelSnapshotEvent }) => {
        if (payload.duelId !== dId) return;
        setLastSnapshot(payload);
      })
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setBroadcastError(true);
        }
      });

    let currentDir: "left" | "right" | "straight" = "straight";

    const sendInput = (input: StableDuelInputEvent["input"]) => {
      channelRef.current?.send({
        type: "broadcast",
        event: "stable_duel_input",
        payload: {
          type: "stable_duel_input",
          duelId: dId,
          playerId: pId,
          seq: ++inputSeqRef.current,
          at: Date.now(),
          input,
        } satisfies StableDuelInputEvent,
      });
    };

    const down = (e: KeyboardEvent) => {
      if (e.code === "ArrowLeft" && currentDir !== "left") {
        currentDir = "left";
        sendInput({ action: "turn", pressed: true, direction: "left" });
      } else if (e.code === "ArrowRight" && currentDir !== "right") {
        currentDir = "right";
        sendInput({ action: "turn", pressed: true, direction: "right" });
      } else if (e.code === "KeyS") {
        sendInput(p2IsLegendary ? { action: "legendary", pressed: true } : { action: "nitro", pressed: true });
      }
      if (["ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
    };

    const up = (e: KeyboardEvent) => {
      if (
        (e.code === "ArrowLeft" && currentDir === "left") ||
        (e.code === "ArrowRight" && currentDir === "right")
      ) {
        currentDir = "straight";
        sendInput({ action: "turn", pressed: false });
      }
    };

    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);

    return () => {
      ch.unsubscribe();
      channelRef.current = null;
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [duelRole, duelId, gameId, defenderId]);

  return (
    <div
      className="absolute inset-0 z-[55] flex flex-col overflow-hidden"
      style={{ background: "rgba(5,8,20,0.92)", backdropFilter: "blur(2px)" }}
    >
      {/* Broadcast error banner */}
      {broadcastError && (
        <div className="shrink-0 bg-amber-900/60 border-b border-amber-700/50 px-4 py-1.5 text-center text-[11px] text-amber-300">
          ⚠ Spojení se soupeřem může být nestabilní
        </div>
      )}

      {/* Sync debug info (defender only) */}
      {duelRole === "defender_remote" && lastSnapshot && phase === "arena" && (
        <div className="absolute left-2 top-2 z-[60] flex flex-col gap-0.5 rounded bg-black/60 px-2 py-1 font-mono text-[9px] text-slate-400 backdrop-blur-sm border border-white/5">
          <div className="flex items-center gap-1.5">
            <span className="h-1 w-1 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-emerald-400 font-bold">SYNC OK</span>
            <span>tick {lastSnapshot.tick}</span>
          </div>
          {lastLocalStateRef.current && (
            <div className="text-slate-500">
              Δ {Math.sqrt(
                Math.pow(lastSnapshot.p2.x - lastLocalStateRef.current.p2.x, 2) +
                Math.pow(lastSnapshot.p2.y - lastLocalStateRef.current.p2.y, 2)
              ).toFixed(2)}px
              {" · "}
              {Date.now() - lastSnapshot.at}ms ago
            </div>
          )}
        </div>
      )}

      {phase === "prestart" && (
        <PreStartPhase
          challenger={challenger}
          defender={defender}
          countdown={countdown}
          minigameType={minigameType}
          isDev={isDev}
          duelRole={duelRole}
          p2IsLegendary={p2IsLegendary}
          disableManualStart={disableManualStart}
          onClick={handleSkip}
        />
      )}
      {phase === "arena" && (
        <ArenaPhase
          key={duelKey}
          backgroundUrl={backgroundUrl}
          p1Speed={p1Speed}
          p2Speed={p2Speed}
          minigameType={minigameType}
          onResult={handleDuelResult}
          onStateSnapshot={(s) => { lastLocalStateRef.current = s; }}
          remoteP2Ref={duelRole === "challenger_authority" ? remoteP2Ref : undefined}
          p1IsLegendary={p1IsLegendary}
          p2IsLegendary={p2IsLegendary}
          duelRole={duelRole}
        />
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
      {phase === "waiting_result" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 select-none">
          <div className="text-4xl">⚔️</div>
          <div className="text-base font-semibold text-slate-300">Souboj odeslán</div>
          <div className="text-sm text-slate-400 text-center max-w-xs">
            Čekám na potvrzení výsledku od challengera…
          </div>
          <div className="mt-2 h-1 w-32 overflow-hidden rounded-full bg-slate-800">
            <div className="h-full w-full animate-pulse rounded-full bg-violet-500/60" />
          </div>
        </div>
      )}
    </div>
  );
}
