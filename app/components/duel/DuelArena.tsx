"use client";

import React from "react";
import { applyTick, createInitialState, getBotInput } from "@/lib/duel/simulate";
import type { Dir, DuelConfig, DuelState } from "@/lib/duel/types";
import { getRopeDuelStartDelayTicks } from "@/lib/duel/helpers";
import { nitroStaminaPreview } from "@/lib/minigame-nitro";
import type { MinigameResult } from "@/lib/minigames/types";

// ── Constants ─────────────────────────────────────────────────────────────────

const P1_COLOR       = "#00ff88";
const P2_COLOR       = "#c084fc";
const P1_DIM         = "#005530";
const P2_DIM         = "#4c1d95";
const BG_COLOR       = "#030712";
const GRID_COLOR     = "rgba(255,255,255,0.04)";
const LEGENDARY_COLOR = "#fbbf24";

const CELL_PX = 20;
const LEGENDARY_COOLDOWN_MS = 2000;

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

type LegDisplay = "ready" | number; // number = cooldown seconds remaining

function LegendaryBadge({ display, flash, side }: { display: LegDisplay; side: "left" | "right"; flash: boolean }) {
  const ready = display === "ready";
  return (
    <span
      style={{
        color: ready ? LEGENDARY_COLOR : "#475569",
        textShadow: flash ? `0 0 12px ${LEGENDARY_COLOR}, 0 0 24px ${LEGENDARY_COLOR}` : "none",
        transition: "text-shadow 0.4s ease-out, color 0.3s",
        fontWeight: 700,
      }}
    >
      {side === "left"
        ? `⭐ ${ready ? "LEGENDARY · SPACE" : `${display}s`} · P1`
        : `P2 · ${ready ? "LEGENDARY · S" : `${display}s`} ⭐`
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
  p1Speed?: number;
  p2Speed?: number;
  /** challenger_authority: P2 dir/nitro/legendary from Broadcast ref instead of keyboard. */
  remoteP2Ref?: React.MutableRefObject<{ dir: Dir; nitroActivate: boolean; legendaryActivate: boolean } | null>;
  /** If true, P1 uses legendary ability (cooldown) instead of one-shot nitro. */
  p1IsLegendary?: boolean;
  /** If true, P2 uses legendary ability (cooldown) instead of one-shot nitro. */
  p2IsLegendary?: boolean;
}

export default function DuelArena({
  config, mode, showDebug = false, backgroundUrl, overlayOpacity = 0.20,
  autoStart = false, onResult, p1Speed = 5, p2Speed = 5,
  remoteP2Ref, p1IsLegendary = false, p2IsLegendary = false,
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

  // One-shot nitro flags (regular racers)
  const p1BoostActivateRef = React.useRef(false);
  const p2BoostActivateRef = React.useRef(false);

  // One-shot legendary flags (local keyboard)
  const p1LegActivateRef = React.useRef(false);
  const p2LegActivateRef = React.useRef(false);

  // Legendary cooldown tracking (real-time ms)
  const p1LegCooldownUntilRef = React.useRef<number | null>(null);
  const p2LegCooldownUntilRef = React.useRef<number | null>(null);

  // Legendary UI state
  const [p1LegDisplay, setP1LegDisplay] = React.useState<LegDisplay>("ready");
  const [p2LegDisplay, setP2LegDisplay] = React.useState<LegDisplay>("ready");
  const [p1LegFlash, setP1LegFlash]     = React.useState(false);
  const [p2LegFlash, setP2LegFlash]     = React.useState(false);

  stateRef.current  = state;
  runningRef.current = running;

  // Reset when config / mode / speeds change
  React.useEffect(() => {
    const fresh = createInitialState(config, p1Speed, p2Speed);
    setState(fresh);
    stateRef.current = fresh;
    setRunning(false);
    runningRef.current = false;
    setLastInputs({ p1: "straight", p2: "straight" });
    p1BoostActivateRef.current = false;
    p2BoostActivateRef.current = false;
    p1LegActivateRef.current = false;
    p2LegActivateRef.current = false;
    p1LegCooldownUntilRef.current = null;
    p2LegCooldownUntilRef.current = null;
    setP1LegDisplay("ready");
    setP2LegDisplay("ready");
    setP1LegFlash(false);
    setP2LegFlash(false);
  }, [config, mode, p1Speed, p2Speed]);

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
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space"].includes(e.code)) {
        e.preventDefault();
      }
      // P1: legendary OR nitro depending on racer type
      if (e.code === "Space") {
        if (p1IsLegendary) p1LegActivateRef.current = true;
        else               p1BoostActivateRef.current = true;
      }
      // P2: legendary OR nitro depending on racer type
      if (e.code === "KeyS") {
        if (p2IsLegendary) p2LegActivateRef.current = true;
        else               p2BoostActivateRef.current = true;
      }
    };
    const up = (e: KeyboardEvent) => keysRef.current.delete(e.code);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [p1IsLegendary, p2IsLegendary]);

  // Tick loop
  React.useEffect(() => {
    if (!running) return;

    const id = setInterval(() => {
      const cur = stateRef.current;
      if (cur.status !== "running") {
        setRunning(false);
        runningRef.current = false;
        clearInterval(id);
        return;
      }

      const keys = keysRef.current;
      const now  = Date.now();

      // ── Nitro (regular racers) ───────────────────────────────────────────────
      const p1Activate = p1BoostActivateRef.current;
      const p2Activate = p2BoostActivateRef.current;
      p1BoostActivateRef.current = false;
      p2BoostActivateRef.current = false;

      // ── P2 direction (remote or keyboard or bot) ─────────────────────────────
      const remoteP2 = remoteP2Ref?.current ?? null;
      const p1: Dir = keys.has("KeyA") ? "left" : keys.has("KeyD") ? "right" : "straight";
      const p2: Dir = mode === "pvbot"
        ? getBotInput(cur, 2, config)
        : remoteP2 !== null
          ? remoteP2.dir
          : keys.has("ArrowLeft") ? "left" : keys.has("ArrowRight") ? "right" : "straight";

      const effectiveP2Activate = mode === "pvp"
        ? (remoteP2Ref ? (remoteP2?.nitroActivate ?? false) : p2Activate)
        : false;
      if (remoteP2Ref?.current?.nitroActivate) {
        remoteP2Ref.current = { ...remoteP2Ref.current, nitroActivate: false };
      }

      // ── Legendary ability ────────────────────────────────────────────────────
      // P1 legendary: check cooldown, read local flag
      let p1LegFire = false;
      if (p1IsLegendary) {
        // Check if cooldown expired → restore charge
        const cdu1 = p1LegCooldownUntilRef.current;
        if (cdu1 !== null && now >= cdu1) {
          p1LegCooldownUntilRef.current = null;
          setP1LegDisplay("ready");
          setP1LegFlash(true);
          setTimeout(() => setP1LegFlash(false), 500);
        }
        // Update cooldown display
        const remaining1 = p1LegCooldownUntilRef.current ? p1LegCooldownUntilRef.current - now : 0;
        const sec1 = remaining1 > 0 ? Math.ceil(remaining1 / 1000) : 0;
        if (remaining1 > 0) {
          setP1LegDisplay(prev => prev !== sec1 ? sec1 : prev);
        }
        // Attempt activation
        if (p1LegActivateRef.current && p1LegCooldownUntilRef.current === null) {
          p1LegFire = true;
          p1LegCooldownUntilRef.current = now + LEGENDARY_COOLDOWN_MS;
          setP1LegDisplay(2);
        }
        p1LegActivateRef.current = false;
      }

      // P2 legendary: remote or local keyboard
      let p2LegFire = false;
      if (p2IsLegendary) {
        // Remote legendary (challenger_authority mode)
        const remoteP2LegActivate = remoteP2Ref
          ? (remoteP2?.legendaryActivate ?? false)
          : p2LegActivateRef.current;
        if (remoteP2Ref?.current?.legendaryActivate) {
          remoteP2Ref.current = { ...remoteP2Ref.current, legendaryActivate: false };
        }
        p2LegActivateRef.current = false;

        const cdu2 = p2LegCooldownUntilRef.current;
        if (cdu2 !== null && now >= cdu2) {
          p2LegCooldownUntilRef.current = null;
          setP2LegDisplay("ready");
          setP2LegFlash(true);
          setTimeout(() => setP2LegFlash(false), 500);
        }
        const remaining2 = p2LegCooldownUntilRef.current ? p2LegCooldownUntilRef.current - now : 0;
        const sec2 = remaining2 > 0 ? Math.ceil(remaining2 / 1000) : 0;
        if (remaining2 > 0) {
          setP2LegDisplay(prev => prev !== sec2 ? sec2 : prev);
        }
        if (remoteP2LegActivate && p2LegCooldownUntilRef.current === null) {
          p2LegFire = true;
          p2LegCooldownUntilRef.current = now + LEGENDARY_COOLDOWN_MS;
          setP2LegDisplay(2);
        }
      }

      setLastInputs({ p1, p2 });
      const next = applyTick(
        cur, p1, p2, config,
        p1Activate,
        effectiveP2Activate,
        p1LegFire,
        p2LegFire,
      );
      stateRef.current = next;
      setState(next);
    }, config.tickMs);

    return () => clearInterval(id);
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
    p1LegActivateRef.current = false;
    p2LegActivateRef.current = false;
    p1LegCooldownUntilRef.current = null;
    p2LegCooldownUntilRef.current = null;
    setP1LegDisplay("ready");
    setP2LegDisplay("ready");
    setP1LegFlash(false);
    setP2LegFlash(false);
  };

  const w = config.gridW * CELL_PX;
  const h = config.gridH * CELL_PX;
  const isDone   = state.status !== "idle" && state.status !== "running";
  const isPaused = !running && state.status === "running";

  const p1Crashed  = state.status === "p2_win" || state.status === "draw";
  const p2Crashed  = state.status === "p1_win" || state.status === "draw";
  const p1Preview  = nitroStaminaPreview(state.p1.nitroUsed, p1Crashed);
  const p2Preview  = nitroStaminaPreview(state.p2.nitroUsed, p2Crashed);

  const nitroLabel = (nitroUsed: boolean, nitroTicksRemaining: number, key: string) =>
    nitroUsed ? (nitroTicksRemaining > 0 ? `⚡ NITRO (${nitroTicksRemaining})` : "⚡ použito") : `⚡ ${key}`;
  const nitroColor = (nitroUsed: boolean, nitroTicksRemaining: number, base: string) =>
    nitroUsed ? (nitroTicksRemaining > 0 ? "#fbbf24" : "#475569") : base;

  return (
    <div className="flex flex-col items-center gap-3 select-none">

      {/* Ability HUD */}
      {state.status !== "idle" && (
        <div className="flex justify-between font-mono text-[10px] items-center" style={{ width: w }}>
          {p1IsLegendary
            ? <LegendaryBadge display={p1LegDisplay} flash={p1LegFlash} side="left" />
            : <span style={{ color: nitroColor(state.p1.nitroUsed, state.p1.nitroTicksRemaining, P1_COLOR) }}>
                {nitroLabel(state.p1.nitroUsed, state.p1.nitroTicksRemaining, "SPACE")} P1
              </span>
          }
          {mode === "pvp" && (p2IsLegendary
            ? <LegendaryBadge display={p2LegDisplay} flash={p2LegFlash} side="right" />
            : <span style={{ color: nitroColor(state.p2.nitroUsed, state.p2.nitroTicksRemaining, P2_COLOR) }}>
                P2 {nitroLabel(state.p2.nitroUsed, state.p2.nitroTicksRemaining, "S")}
              </span>
          )}
        </div>
      )}

      {/* Arena SVG */}
      <div className="relative rounded-lg overflow-hidden" style={{ boxShadow: "0 0 32px rgba(0,255,136,0.08), 0 0 0 1px rgba(255,255,255,0.06)" }}>
        <svg
          width={w}
          height={h}
          style={{ display: "block", background: backgroundUrl ? "transparent" : BG_COLOR }}
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
                    ? <>P1: <span style={{ color: P1_COLOR }}>A / D</span> &nbsp;·&nbsp; P2: <span style={{ color: P2_COLOR }}>← / →</span></>
                    : <>P1: <span style={{ color: P1_COLOR }}>A / D</span> &nbsp;·&nbsp; <span style={{ color: P2_COLOR }}>Bot</span></>
                  }
                </div>
                {(p1IsLegendary || p2IsLegendary) && (
                  <div className="text-[10px] font-mono text-center leading-snug" style={{ color: LEGENDARY_COLOR }}>
                    {p1IsLegendary && <div>⭐ P1 legendary ability → SPACE (cooldown {LEGENDARY_COOLDOWN_MS / 1000}s)</div>}
                    {p2IsLegendary && mode === "pvp" && <div>⭐ P2 legendary ability → S (cooldown {LEGENDARY_COOLDOWN_MS / 1000}s)</div>}
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

      {/* Controls bar */}
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
            {p1IsLegendary
              ? <span style={{ color: LEGENDARY_COLOR }}>leg {state.p1.legendaryDashRemaining} cd:{p1LegCooldownUntilRef.current ? Math.ceil((p1LegCooldownUntilRef.current - Date.now()) / 1000) + "s" : "ready"}</span>
              : <span style={{ color: nitroColor(state.p1.nitroUsed, state.p1.nitroTicksRemaining, P1_COLOR) }}>
                  nitro {state.p1.nitroUsed ? (state.p1.nitroTicksRemaining > 0 ? `active(${state.p1.nitroTicksRemaining})` : "used") : "ready"}
                </span>
            }
          </div>
          <div>
            <span className="text-slate-600">p2</span> spd {p2Speed}{" "}
            delay {state.p2.startDelayTicksRemaining}/{getRopeDuelStartDelayTicks(p2Speed)}{" "}
            dashTiles {state.p2.nitroDashTiles}{" "}
            {mode === "pvp" && (p2IsLegendary
              ? <span style={{ color: LEGENDARY_COLOR }}>leg {state.p2.legendaryDashRemaining} cd:{p2LegCooldownUntilRef.current ? Math.ceil((p2LegCooldownUntilRef.current - Date.now()) / 1000) + "s" : "ready"}</span>
              : <span style={{ color: nitroColor(state.p2.nitroUsed, state.p2.nitroTicksRemaining, P2_COLOR) }}>
                  nitro {state.p2.nitroUsed ? (state.p2.nitroTicksRemaining > 0 ? `active(${state.p2.nitroTicksRemaining})` : "used") : "ready"}
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
        </div>
      )}
    </div>
  );
}
