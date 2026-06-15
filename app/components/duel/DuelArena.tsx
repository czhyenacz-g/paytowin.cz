"use client";

import React from "react";
import { applyTick, createInitialState, getBotInput, getBotNitroActivate } from "@/lib/duel/simulate";
import type { AbsDir, Dir, DuelConfig, DuelState } from "@/lib/duel/types";
import { resolveRelativeDir, dirFromHeldKeys } from "@/lib/duel/steeringInput";
import { getRopeDuelStartDelayTicks } from "@/lib/duel/helpers";
import { nitroStaminaPreview } from "@/lib/minigame-nitro";
import type { MinigameResult } from "@/lib/minigames/types";
import TouchBtn from "../ui/TouchBtn";

// ── Constants ─────────────────────────────────────────────────────────────────

const P1_COLOR       = "#00ff88";
const P2_COLOR       = "#c084fc";
const P1_DIM         = "#005530";
const P2_DIM         = "#4c1d95";
const BG_COLOR       = "#030712";
const GRID_COLOR     = "rgba(255,255,255,0.04)";
const LEGENDARY_COLOR = "#fbbf24";

const CELL_PX = 20;
const DOUBLE_TAP_MS = 250;

// ── SVG neon glow filter ──────────────────────────────────────────────────────

function NeonFilters() {
  return (
    <defs>
      <filter id="glow-p1" x="-60%" y="-60%" width="220%" height="220%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="b1" />
        <feGaussianBlur in="SourceGraphic" stdDeviation="1"   result="b2" />
        <feMerge><feMergeNode in="b1" /><feMergeNode in="b2" /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>
      <filter id="glow-p2" x="-60%" y="-60%" width="220%" height="220%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="b1" />
        <feGaussianBlur in="SourceGraphic" stdDeviation="1"   result="b2" />
        <feMerge><feMergeNode in="b1" /><feMergeNode in="b2" /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>
      <filter id="glow-head" x="-100%" y="-100%" width="300%" height="300%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="b" />
        <feMerge><feMergeNode in="b" /><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>
    </defs>
  );
}

// ── Grid lines ────────────────────────────────────────────────────────────────

function GridLines({ w, h, cs }: { w: number; h: number; cs: number }) {
  const lines: React.ReactNode[] = [];
  for (let x = 1; x < w; x++)
    lines.push(<line key={`v${x}`} x1={x*cs} y1={0} x2={x*cs} y2={h*cs} stroke={GRID_COLOR} strokeWidth={0.5} />);
  for (let y = 1; y < h; y++)
    lines.push(<line key={`h${y}`} x1={0} y1={y*cs} x2={w*cs} y2={y*cs} stroke={GRID_COLOR} strokeWidth={0.5} />);
  return <>{lines}</>;
}

// ── Trail polyline ────────────────────────────────────────────────────────────

function Trail({ trail, color, dimColor, alive, filterId, cs }: {
  trail: readonly { x: number; y: number }[];
  color: string; dimColor: string; alive: boolean; filterId: string; cs: number;
}) {
  if (trail.length < 2) return null;
  const pts = trail.map(v => `${v.x * cs + cs / 2},${v.y * cs + cs / 2}`).join(" ");
  return (
    <polyline
      points={pts}
      stroke={alive ? color : dimColor}
      strokeWidth={cs * 0.45}
      fill="none"
      strokeLinejoin="round"
      strokeLinecap="round"
      filter={alive ? `url(#${filterId})` : undefined}
      opacity={alive ? 1 : 0.35}
    />
  );
}

// ── Player head ───────────────────────────────────────────────────────────────

function Head({ pos, color, alive, cs }: { pos: { x: number; y: number }; color: string; alive: boolean; cs: number }) {
  const cx = pos.x * cs + cs / 2;
  const cy = pos.y * cs + cs / 2;
  return (
    <g filter={alive ? "url(#glow-head)" : undefined} opacity={alive ? 1 : 0.3}>
      <circle cx={cx} cy={cy} r={cs * 0.42} fill={color} />
      <circle cx={cx} cy={cy} r={cs * 0.2} fill="white" opacity={0.7} />
    </g>
  );
}

// ── Legendary ability badge ───────────────────────────────────────────────────

function LegendaryBadge({ cooldownTicks, tickMs, side }: { cooldownTicks: number; tickMs: number; side: "left" | "right" }) {
  const ready = cooldownTicks === 0;
  const secDisplay = ready ? null : Math.max(1, Math.ceil(cooldownTicks * tickMs / 1000));
  return (
    <span
      style={{
        color: ready ? LEGENDARY_COLOR : "#475569",
        transition: "color 0.2s",
        fontWeight: 700,
      }}
    >
      {side === "left"
        ? `⭐ ${ready ? "LEGENDARY · Q" : `${secDisplay}s`} · P1`
        : `P2 · ${ready ? "LEGENDARY · SPACE" : `${secDisplay}s`} ⭐`
      }
    </span>
  );
}

// ── DuelArena ─────────────────────────────────────────────────────────────────

export type DuelMode = "pvp" | "pvbot";

interface Props {
  config: DuelConfig;
  mode: DuelMode;
  showDebug?: boolean;
  backgroundUrl?: string;
  overlayOpacity?: number;
  autoStart?: boolean;
  onResult?: (result: MinigameResult) => void;
  onStateSnapshot?: (snapshot: {
    tick: number;
    p1: { x: number; y: number; dir: AbsDir };
    p2: { x: number; y: number; dir: AbsDir };
    status: string;
  }) => void;
  p1Speed?: number;
  p2Speed?: number;
  /** pvbot: P1 dir/nitro/legendary from external touch ref instead of keyboard.
   *  Pokud ref obsahuje `keys` (Set<string> s WASD kódy), použije se dirFromHeldKeys stejně jako keyboard. */
  remoteP1Ref?: React.MutableRefObject<{ dir: Dir; keys?: Set<string>; nitroActivate: boolean; legendaryActivate: boolean } | null>;
  /** challenger_authority: P2 dir/nitro/legendary from Broadcast ref instead of keyboard. */
  remoteP2Ref?: React.MutableRefObject<{ dir: Dir; nitroActivate: boolean; legendaryActivate: boolean } | null>;
  /** If true, P1 is a legendary racer (badge shown in HUD). */
  p1IsLegendary?: boolean;
  /** If true, P2 is a legendary racer (badge shown in HUD). */
  p2IsLegendary?: boolean;
  /** When true, suppresses the built-in mobile touch controls (parent manages them). */
  hideTouchControls?: boolean;
}

export default function DuelArena({
  config, mode, showDebug = false, backgroundUrl, overlayOpacity = 0.20,
  autoStart = false, onResult, onStateSnapshot, p1Speed = 5, p2Speed = 5,
  remoteP1Ref, remoteP2Ref, p1IsLegendary = false, p2IsLegendary = false,
  hideTouchControls = false,
}: Props) {
  const [state, setState] = React.useState<DuelState>(() => {
    const s = createInitialState(config, p1Speed, p2Speed);
    return autoStart ? { ...s, status: "running" as const } : s;
  });
  const [running, setRunning] = React.useState(autoStart);
  const [lastInputs, setLastInputs] = React.useState<{ p1: Dir; p2: Dir }>({ p1: "straight", p2: "straight" });

  const stateRef   = React.useRef<DuelState>(state);
  const keysRef    = React.useRef<Set<string>>(new Set());
  const runningRef = React.useRef(false);

  // Cross-platform timing stability: track last actual tick wall-clock time and
  // number of concurrent setInterval loops. On Windows/Chrome, setInterval can
  // fire earlier than requested (high-resolution timer) or — in edge-cases around
  // React effect ordering with autoStart — multiple intervals can stack.
  const lastTickTimeRef  = React.useRef(0);
  const loopCountRef     = React.useRef(0);
  // Debug metrics — populated only when showDebug=true; read at render time.
  const observedTickMsRef = React.useRef<number | null>(null);
  const skippedTicksRef   = React.useRef(0);
  // Sustained ticks-per-second: count real ticks in a rolling 2s window.
  const tickCountRef    = React.useRef(0);
  const tpsWindowRef    = React.useRef(0);
  const tpsRef          = React.useRef<number | null>(null);

  // Keep showDebug accessible inside setInterval without adding it to effect deps
  const showDebugRef = React.useRef(showDebug);
  showDebugRef.current = showDebug;

  // Boost activate flags (regular and legendary share same path)
  const p1BoostActivateRef = React.useRef(false);
  const p2BoostActivateRef = React.useRef(false);

  // Double-tap straight-key boost tracking
  const p1LastStraightTapRef = React.useRef<{ keyCode: string; time: number } | null>(null);
  const p2LastStraightTapRef = React.useRef<{ keyCode: string; time: number } | null>(null);

  stateRef.current  = state;
  runningRef.current = running;

  // Reset when config / mode / speeds change (also on mount — respects autoStart)
  React.useEffect(() => {
    const fresh = createInitialState(config, p1Speed, p2Speed);
    const initState = autoStart ? { ...fresh, status: "running" as const } : fresh;
    setState(initState);
    stateRef.current = initState;
    setRunning(autoStart);
    runningRef.current = autoStart;
    setLastInputs({ p1: "straight", p2: "straight" });
    p1BoostActivateRef.current = false;
    p2BoostActivateRef.current = false;
    p1LastStraightTapRef.current = null;
    p2LastStraightTapRef.current = null;
  }, [config, mode, p1Speed, p2Speed, autoStart]);

  // onResult — fired once when game ends
  const onResultRef = React.useRef(onResult);
  React.useEffect(() => { onResultRef.current = onResult; });
  React.useEffect(() => {
    if (state.status !== "idle" && state.status !== "running") {
      const w: 1 | 2 | "draw" = state.winner === 1 ? 1 : state.winner === 2 ? 2 : "draw";
      onResultRef.current?.({
        winner: w,
        p1: { usedNitro: state.p1.nitroUsed, crashed: !state.p1.alive, score: state.p1.ticksAlive },
        p2: { usedNitro: state.p2.nitroUsed, crashed: !state.p2.alive, score: state.p2.ticksAlive },
        meta: { minigameType: "neon_rope_duel" },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status]);

  // Keyboard listeners
  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      keysRef.current.add(e.code);

      // Prevent browser scroll/shortcuts for game keys
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space", "KeyQ"].includes(e.code)) {
        e.preventDefault();
      }

      // P1 boost key (Q) — legendary and regular share same activate path
      if (e.code === "KeyQ") p1BoostActivateRef.current = true;
      // P2 boost key (Space)
      if (e.code === "Space") p2BoostActivateRef.current = true;

      // Double-tap straight-key boost — only on fresh press, only when running
      if (!e.repeat && runningRef.current) {
        const now = Date.now();

        // P1 double-tap (WASD)
        if (["KeyW", "KeyA", "KeyS", "KeyD"].includes(e.code)) {
          const rel = resolveRelativeDir(e.code, stateRef.current.p1.dir, "wasd");
          if (rel === "straight") {
            const last = p1LastStraightTapRef.current;
            if (last && last.keyCode === e.code && now - last.time <= DOUBLE_TAP_MS) {
              p1BoostActivateRef.current = true;
              p1LastStraightTapRef.current = null;
            } else {
              p1LastStraightTapRef.current = { keyCode: e.code, time: now };
            }
          }
        }

        // P2 double-tap (arrows) — local pvp only (not pvbot, not remote)
        if (mode !== "pvbot" && !remoteP2Ref &&
            ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.code)) {
          const rel = resolveRelativeDir(e.code, stateRef.current.p2.dir, "arrows");
          if (rel === "straight") {
            const last = p2LastStraightTapRef.current;
            if (last && last.keyCode === e.code && now - last.time <= DOUBLE_TAP_MS) {
              p2BoostActivateRef.current = true;
              p2LastStraightTapRef.current = null;
            } else {
              p2LastStraightTapRef.current = { keyCode: e.code, time: now };
            }
          }
        }
      }
    };
    const up = (e: KeyboardEvent) => keysRef.current.delete(e.code);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [p1IsLegendary, p2IsLegendary, mode, remoteP1Ref, remoteP2Ref]);

  // Tick loop
  React.useEffect(() => {
    if (!running) return;

    loopCountRef.current += 1;
    const startNow = Date.now();
    lastTickTimeRef.current = startNow;
    tickCountRef.current    = 0;
    tpsWindowRef.current    = startNow;
    tpsRef.current          = null;

    if (loopCountRef.current > 1 && process.env.NODE_ENV === "development") {
      console.error(`[DuelArena] ${loopCountRef.current} parallel tick loops — game will run ${loopCountRef.current}× fast!`);
    }

    const id = setInterval(() => {
      const now     = Date.now();
      const elapsed = now - lastTickTimeRef.current;

      // Skip if interval fired too early (< 80 % of tickMs).
      // Windows/Chrome high-res timers can fire setInterval ahead of schedule;
      // without this guard the game advances 2× per intended tick period.
      if (elapsed < config.tickMs * 0.8) {
        skippedTicksRef.current += 1;
        if (process.env.NODE_ENV === "development") {
          console.warn(`[DuelArena] early tick skipped: elapsed=${elapsed}ms, threshold=${Math.round(config.tickMs * 0.8)}ms`);
        }
        return;
      }

      // Warn if gap is very large — likely tab was hidden and timer fired catch-up.
      if (elapsed > config.tickMs * 4 && process.env.NODE_ENV === "development") {
        console.warn(`[DuelArena] large tick gap: ${elapsed}ms — tab hidden/resumed?`);
      }

      lastTickTimeRef.current = now;
      observedTickMsRef.current = elapsed;

      // Sustained tps: count ticks in a rolling 2-second window.
      tickCountRef.current += 1;
      const tpsElapsed = now - tpsWindowRef.current;
      if (tpsElapsed >= 2000) {
        tpsRef.current = (tickCountRef.current / tpsElapsed) * 1000;
        tickCountRef.current = 0;
        tpsWindowRef.current = now;
      }

      const cur = stateRef.current;
      if (cur.status !== "running") {
        setRunning(false);
        runningRef.current = false;
        clearInterval(id);
        return;
      }

      const keys = keysRef.current;

      // ── Nitro / boost activate (regular + legendary share same path) ────────
      const remoteP1 = remoteP1Ref?.current ?? null;
      const remoteP2 = remoteP2Ref?.current ?? null;

      // P1: remote (nitro or legendary) + local keyboard/touch
      const remoteP1Activate = (remoteP1?.nitroActivate ?? false) || (remoteP1?.legendaryActivate ?? false);
      if (remoteP1Ref?.current && (remoteP1?.nitroActivate || remoteP1?.legendaryActivate)) {
        remoteP1Ref.current = { ...remoteP1Ref.current, nitroActivate: false, legendaryActivate: false };
      }
      const p1Activate = remoteP1Ref
        ? (remoteP1Activate || p1BoostActivateRef.current)
        : p1BoostActivateRef.current;
      p1BoostActivateRef.current = false;

      // P2: depends on mode
      const remoteP2Activate = (remoteP2?.nitroActivate ?? false) || (remoteP2?.legendaryActivate ?? false);
      if (remoteP2Ref?.current && (remoteP2?.nitroActivate || remoteP2?.legendaryActivate)) {
        remoteP2Ref.current = { ...remoteP2Ref.current, nitroActivate: false, legendaryActivate: false };
      }
      const botP2Activate  = mode === "pvbot" ? getBotNitroActivate(cur, 2, config) : false;
      const effectiveP2Activate = mode === "pvp"
        ? (remoteP2Ref ? remoteP2Activate : p2BoostActivateRef.current)
        : botP2Activate;
      p2BoostActivateRef.current = false;

      // ── P1/P2 direction ──────────────────────────────────────────────────────
      const p1: Dir = remoteP1 !== null
        ? (remoteP1.keys
            ? dirFromHeldKeys(remoteP1.keys, cur.p1.dir, "wasd")
            : remoteP1.dir)
        : dirFromHeldKeys(keys, cur.p1.dir, "wasd");
      const p2: Dir = mode === "pvbot"
        ? getBotInput(cur, 2, config)
        : remoteP2 !== null
          ? remoteP2.dir
          : dirFromHeldKeys(keys, cur.p2.dir, "arrows");

      setLastInputs({ p1, p2 });
      const next = applyTick(
        cur, p1, p2, config,
        p1Activate,
        effectiveP2Activate,
      );
      stateRef.current = next;
      setState(next);

      onStateSnapshot?.({
        tick: next.tick,
        p1: { x: next.p1.pos.x, y: next.p1.pos.y, dir: next.p1.dir },
        p2: { x: next.p2.pos.x, y: next.p2.pos.y, dir: next.p2.dir },
        status: next.status,
      });
    }, config.tickMs);

    return () => {
      clearInterval(id);
      loopCountRef.current = Math.max(0, loopCountRef.current - 1);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  const handleStart = () => {
    if (state.status === "idle" || state.status === "running") {
      if (!running) {
        setState(s => s.status === "idle" ? { ...s, status: "running" } : s);
        stateRef.current = { ...stateRef.current, status: "running" };
        setRunning(true);
      } else {
        setRunning(false);
      }
    }
  };

  const handleReset = () => {
    const fresh = createInitialState(config, p1Speed, p2Speed);
    setState(fresh);
    stateRef.current = fresh;
    setRunning(false);
    runningRef.current = false;
    setLastInputs({ p1: "straight", p2: "straight" });
    p1BoostActivateRef.current = false;
    p2BoostActivateRef.current = false;
    p1LastStraightTapRef.current = null;
    p2LastStraightTapRef.current = null;
  };

  const w = config.gridW * CELL_PX;
  const h = config.gridH * CELL_PX;
  const isDone   = state.status !== "idle" && state.status !== "running";
  const isPaused = !running && state.status === "running";

  const p1Crashed  = state.status === "p2_win" || state.status === "draw";
  const p2Crashed  = state.status === "p1_win" || state.status === "draw";
  const p1Preview  = nitroStaminaPreview(state.p1.nitroUsed, p1Crashed);
  const p2Preview  = nitroStaminaPreview(state.p2.nitroUsed, p2Crashed);

  const nitroLabel = (nitroTicksRemaining: number, nitroCooldown: number, key: string) => {
    if (nitroTicksRemaining > 0) return `⚡ NITRO (${nitroTicksRemaining})`;
    if (nitroCooldown > 0) return `⚡ ${nitroCooldown}`;
    return `⚡ ${key}`;
  };
  const nitroColor = (nitroTicksRemaining: number, nitroCooldown: number, base: string) => {
    if (nitroTicksRemaining > 0) return "#fbbf24";
    if (nitroCooldown > 0) return "#475569";
    return base;
  };

  return (
    <div className="flex flex-col items-center gap-3 select-none">

      {/* Ability HUD */}
      {state.status !== "idle" && (
        <div className="flex justify-between font-mono text-[10px] items-center w-full" style={{ maxWidth: w }}>
          {p1IsLegendary
            ? <LegendaryBadge cooldownTicks={state.p1.nitroCooldownTicksRemaining} tickMs={config.tickMs} side="left" />
            : <span style={{ color: nitroColor(state.p1.nitroTicksRemaining, state.p1.nitroCooldownTicksRemaining, P1_COLOR) }}>
                {nitroLabel(state.p1.nitroTicksRemaining, state.p1.nitroCooldownTicksRemaining, "Q")} P1
              </span>
          }
          {mode === "pvp" && (p2IsLegendary
            ? <LegendaryBadge cooldownTicks={state.p2.nitroCooldownTicksRemaining} tickMs={config.tickMs} side="right" />
            : <span style={{ color: nitroColor(state.p2.nitroTicksRemaining, state.p2.nitroCooldownTicksRemaining, P2_COLOR) }}>
                P2 {nitroLabel(state.p2.nitroTicksRemaining, state.p2.nitroCooldownTicksRemaining, "SPACE")}
              </span>
          )}
        </div>
      )}

      {/* Arena SVG */}
      <div className="relative rounded-lg overflow-hidden w-full" style={{ maxWidth: w, boxShadow: "0 0 32px rgba(0,255,136,0.08), 0 0 0 1px rgba(255,255,255,0.06)" }}>
        <svg
          viewBox={`0 0 ${w} ${h}`}
          style={{ display: "block", width: "100%", height: "auto", background: backgroundUrl ? "transparent" : BG_COLOR, pointerEvents: "none" }}
        >
          <NeonFilters />
          {backgroundUrl && (
            <>
              <defs>
                <filter id="da-bg-blur" x="-2%" y="-2%" width="104%" height="104%">
                  <feGaussianBlur stdDeviation="1.5" />
                </filter>
              </defs>
              <image href={backgroundUrl} x={0} y={0} width={w} height={h} preserveAspectRatio="xMidYMid slice" filter="url(#da-bg-blur)" />
              <rect x={0} y={0} width={w} height={h} fill={`rgba(3,7,18,${overlayOpacity})`} />
            </>
          )}
          <GridLines w={config.gridW} h={config.gridH} cs={CELL_PX} />
          <Trail trail={state.p1.trail} color={P1_COLOR} dimColor={P1_DIM} alive={state.p1.alive} filterId="glow-p1" cs={CELL_PX} />
          <Trail trail={state.p2.trail} color={P2_COLOR} dimColor={P2_DIM} alive={state.p2.alive} filterId="glow-p2" cs={CELL_PX} />
          <Head pos={state.p1.pos} color={P1_COLOR} alive={state.p1.alive} cs={CELL_PX} />
          <Head pos={state.p2.pos} color={P2_COLOR} alive={state.p2.alive} cs={CELL_PX} />
        </svg>

        {(state.status === "idle" || isPaused || isDone) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60 backdrop-blur-[2px]">
            {state.status === "idle" && (
              <>
                <div className="text-2xl font-black text-white tracking-tight">NEON ROPE DUEL</div>
                <div className="text-[11px] text-slate-400 text-center leading-relaxed">
                  {mode === "pvp"
                    ? <>P1: <span style={{ color: P1_COLOR }}>WASD</span> &nbsp;·&nbsp; P2: <span style={{ color: P2_COLOR }}>← ↑ ↓ →</span></>
                    : <>P1: <span style={{ color: P1_COLOR }}>WASD</span> &nbsp;·&nbsp; <span style={{ color: P2_COLOR }}>Bot</span></>
                  }
                </div>
                <div className="text-[10px] text-slate-500 text-center">
                  double-tap straight key = boost
                </div>
                {(p1IsLegendary || p2IsLegendary) && (
                  <div className="text-[10px] font-mono text-center leading-snug" style={{ color: LEGENDARY_COLOR }}>
                    {p1IsLegendary && <div>⭐ P1 legendary ability → Q (reusable boost)</div>}
                    {p2IsLegendary && mode === "pvp" && <div>⭐ P2 legendary ability → SPACE (reusable boost)</div>}
                  </div>
                )}
                <button
                  onClick={handleStart}
                  className="mt-1 rounded-lg bg-emerald-500 px-5 py-2 text-sm font-black text-white hover:bg-emerald-400 active:scale-95 transition-all"
                >
                  ▶ Start
                </button>
              </>
            )}
            {isPaused && (
              <>
                <div className="text-xl font-black text-amber-400">PAUZA</div>
                <button onClick={handleStart} className="rounded-lg bg-amber-500 px-5 py-2 text-sm font-black text-white hover:bg-amber-400 transition">
                  ▶ Pokračovat
                </button>
              </>
            )}
            {isDone && (
              <div className="flex flex-col items-center gap-2">
                <div className={`text-3xl font-black ${state.status === "draw" ? "text-slate-300" : state.winner === 1 ? "text-emerald-400" : "text-purple-400"}`} style={{
                  textShadow: state.winner === 1 ? `0 0 16px ${P1_COLOR}` : state.winner === 2 ? `0 0 16px ${P2_COLOR}` : "none",
                }}>
                  {state.status === "draw" ? "REMÍZA" : state.winner === 1 ? "🏆 P1 VYHRÁL" : "🏆 P2 VYHRÁL"}
                </div>
                <div className="text-xs text-slate-500">tick {state.tick} · P1: {state.p1.ticksAlive} · P2: {state.p2.ticksAlive}</div>
                <div className="text-[10px] font-mono text-slate-600">
                  stamina P1 −{p1Preview.total}{mode === "pvp" ? ` · P2 −${p2Preview.total}` : ""}
                </div>
                <button onClick={handleReset} className="rounded-lg bg-slate-700 px-5 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-600 transition">
                  ↺ Reset
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Touch controls (mobile/tablet) — suppressed when parent manages them */}
      {!hideTouchControls && state.status === "running" && (
        <div className="flex items-center justify-center gap-6 select-none">
          <div className="flex items-center gap-3">
            <TouchBtn label="←" color={P1_COLOR} ariaLabel="P1 doleva"
              onPressStart={() => keysRef.current.add("KeyA")}
              onPressEnd={() => keysRef.current.delete("KeyA")}
            />
            <TouchBtn label="BOOST" color={P1_COLOR} ariaLabel="P1 akce"
              onPressStart={() => { p1BoostActivateRef.current = true; }}
            />
            <TouchBtn label="→" color={P1_COLOR} ariaLabel="P1 doprava"
              onPressStart={() => keysRef.current.add("KeyD")}
              onPressEnd={() => keysRef.current.delete("KeyD")}
            />
          </div>
          {mode === "pvp" && !remoteP2Ref && (
            <div className="flex items-center gap-3">
              <TouchBtn label="←" color={P2_COLOR} ariaLabel="P2 doleva"
                onPressStart={() => keysRef.current.add("ArrowLeft")}
                onPressEnd={() => keysRef.current.delete("ArrowLeft")}
              />
              <TouchBtn label="BOOST" color={P2_COLOR} ariaLabel="P2 akce"
                onPressStart={() => { p2BoostActivateRef.current = true; }}
              />
              <TouchBtn label="→" color={P2_COLOR} ariaLabel="P2 doprava"
                onPressStart={() => keysRef.current.add("ArrowRight")}
                onPressEnd={() => keysRef.current.delete("ArrowRight")}
              />
            </div>
          )}
        </div>
      )}

      {/* Controls bar — hidden when parent manages the overlay (hideTouchControls) */}
      {!hideTouchControls && (
        <div className="flex items-center gap-2">
          {state.status === "running" && (
            <button onClick={handleStart} className="rounded-lg bg-amber-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-amber-500 transition">
              ⏸ Pauza
            </button>
          )}
          <button onClick={handleReset} className="rounded-lg bg-slate-700 border border-slate-600 px-4 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-600 transition">
            ↺ Reset
          </button>
        </div>
      )}

      {/* Debug panel */}
      {showDebug && (
        <div className="w-full rounded-lg bg-slate-900 border border-slate-700 p-3 font-mono text-[10px] text-slate-400 space-y-0.5">
          <div><span className="text-slate-600">status</span> <span className="text-white">{state.status}</span> <span className="text-slate-600 ml-3">tick</span> {state.tick}/{config.maxTicks}</div>
          <div>
            <span className="text-slate-600">p1</span> <span style={{ color: P1_COLOR }}>{state.p1.pos.x},{state.p1.pos.y}</span> dir {state.p1.dir} trail {state.p1.trail.length} input {lastInputs.p1}
            {state.p1.startDelayTicksRemaining > 0 && <span className="text-amber-400 ml-2">delay {state.p1.startDelayTicksRemaining}</span>}
          </div>
          <div>
            <span className="text-slate-600">p2</span> <span style={{ color: P2_COLOR }}>{state.p2.pos.x},{state.p2.pos.y}</span> dir {state.p2.dir} trail {state.p2.trail.length} input {lastInputs.p2}
            {state.p2.startDelayTicksRemaining > 0 && <span className="text-amber-400 ml-2">delay {state.p2.startDelayTicksRemaining}</span>}
          </div>
          <div>
            <span className="text-slate-600">p1</span> spd {p1Speed}{" "}
            delay {state.p1.startDelayTicksRemaining}/{getRopeDuelStartDelayTicks(p1Speed)}{" "}
            dashTiles {state.p1.nitroDashTiles}{" "}
            <span style={{ color: state.p1.nitroTicksRemaining > 0 ? "#fbbf24" : state.p1.nitroCooldownTicksRemaining > 0 ? "#475569" : P1_COLOR }}>
              nitro {state.p1.nitroTicksRemaining > 0 ? `active(${state.p1.nitroTicksRemaining})` : state.p1.nitroCooldownTicksRemaining > 0 ? `cd(${state.p1.nitroCooldownTicksRemaining})` : "ready"}
            </span>
          </div>
          <div>
            <span className="text-slate-600">p2</span> spd {p2Speed}{" "}
            delay {state.p2.startDelayTicksRemaining}/{getRopeDuelStartDelayTicks(p2Speed)}{" "}
            dashTiles {state.p2.nitroDashTiles}{" "}
            {mode === "pvp" && (
              <span style={{ color: state.p2.nitroTicksRemaining > 0 ? "#fbbf24" : state.p2.nitroCooldownTicksRemaining > 0 ? "#475569" : P2_COLOR }}>
                nitro {state.p2.nitroTicksRemaining > 0 ? `active(${state.p2.nitroTicksRemaining})` : state.p2.nitroCooldownTicksRemaining > 0 ? `cd(${state.p2.nitroCooldownTicksRemaining})` : "ready"}
              </span>
            )}
          </div>
          {state.winner && <div className="text-amber-400 font-bold">winner: P{state.winner}</div>}
          {isDone && (
            <div className="text-slate-500">
              stamina P1 −{p1Preview.total} (base −{p1Preview.baseCost}{p1Preview.nitroCost > 0 ? ` nitro −${p1Preview.nitroCost}` : ""}{p1Preview.crashPenalty > 0 ? ` crash −${p1Preview.crashPenalty}` : ""})
              {mode === "pvp" && ` · P2 −${p2Preview.total}`}
            </div>
          )}
          <div className="border-t border-slate-800 pt-0.5 mt-0.5">
            <span className="text-slate-600">tickMs</span> {config.tickMs}{" "}
            <span className="text-slate-600 ml-2">observed</span>{" "}
            <span className={observedTickMsRef.current !== null && observedTickMsRef.current > config.tickMs * 1.5 ? "text-amber-400" : "text-white"}>
              {observedTickMsRef.current !== null ? `${observedTickMsRef.current}ms` : "—"}
            </span>{" "}
            <span className="text-slate-600 ml-2">tps</span>{" "}
            <span className={
              tpsRef.current !== null && tpsRef.current > (1000 / config.tickMs) * 1.15
                ? "text-red-400 font-bold"
                : "text-white"
            }>
              {tpsRef.current !== null ? tpsRef.current.toFixed(1) : "—"}
            </span>
            <span className="text-slate-600"> / {(1000 / config.tickMs).toFixed(1)} target</span>{" "}
            <span className="text-slate-600 ml-2">skip</span> {skippedTicksRef.current}{" "}
            <span className="text-slate-600 ml-2">loops</span>{" "}
            <span className={loopCountRef.current > 1 ? "text-red-400 font-bold" : "text-white"}>
              {loopCountRef.current}
            </span>
            {loopCountRef.current > 1 && <span className="text-red-400 font-bold ml-1">⚠ MULTI-LOOP</span>}
          </div>
        </div>
      )}
    </div>
  );
}
