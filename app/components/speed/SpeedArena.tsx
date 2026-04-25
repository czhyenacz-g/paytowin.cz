"use client";

import React from "react";
import { applyTick, createInitialState, NITRO_SPEED_BOOST } from "@/lib/speed/simulate";
import type { SpeedConfig, SpeedInput, SpeedState } from "@/lib/speed/types";
import { nitroStaminaPreview } from "@/lib/minigame-nitro";

// ── Visual constants ──────────────────────────────────────────────────────────

const BG_COLOR     = "#020617";
const WALL_COLOR   = "#1e3a5f";
const BOOST_COLOR  = "#10b981";
const BOOST_DIM    = "#064e3b";
const SLOW_COLOR   = "#f97316";
const SLOW_DIM     = "#431407";
const PLAYER_COLOR_SLOW = "#22d3ee";
const PLAYER_COLOR_MID  = "#fbbf24";
const PLAYER_COLOR_FAST = "#f87171";

function speedColor(velocity: number, maxVelocity: number): string {
  const t = velocity / maxVelocity;
  if (t < 0.4) return PLAYER_COLOR_SLOW;
  if (t < 0.7) return PLAYER_COLOR_MID;
  return PLAYER_COLOR_FAST;
}

// ── SVG filters ───────────────────────────────────────────────────────────────

function Filters() {
  return (
    <defs>
      <filter id="sa-glow-boost" x="-80%" y="-80%" width="260%" height="260%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="b" />
        <feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <filter id="sa-glow-slow" x="-80%" y="-80%" width="260%" height="260%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="3.5" result="b" />
        <feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <filter id="sa-glow-player" x="-120%" y="-120%" width="340%" height="340%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="b" />
        <feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>
  );
}

// ── Player triangle ───────────────────────────────────────────────────────────

function PlayerToken({ x, y, angle, color }: { x: number; y: number; angle: number; color: string }) {
  const r  = 9;
  const deg = (angle * 180) / Math.PI;
  // Equilateral triangle pointing right at origin
  const pts = `${r},0 ${-r * 0.55},${-r * 0.85} ${-r * 0.55},${r * 0.85}`;
  return (
    <g filter="url(#sa-glow-player)">
      <polygon
        points={pts}
        transform={`translate(${x},${y}) rotate(${deg})`}
        fill={color}
        opacity={0.95}
      />
    </g>
  );
}

// ── Object tokens ─────────────────────────────────────────────────────────────

function ObjectTokens({ objects }: { objects: SpeedState["objects"] }) {
  return (
    <>
      {objects.map(obj => {
        const active = obj.active;
        if (obj.kind === "boost") {
          return (
            <g key={obj.id} filter={active ? "url(#sa-glow-boost)" : undefined} opacity={active ? 1 : 0.2}>
              <circle cx={obj.pos.x} cy={obj.pos.y} r={obj.radius} fill={active ? BOOST_COLOR : BOOST_DIM} />
              <text x={obj.pos.x} y={obj.pos.y + 5} textAnchor="middle" fontSize={13} fill="white" opacity={active ? 0.9 : 0.3} fontWeight="bold">⚡</text>
            </g>
          );
        }
        return (
          <g key={obj.id} filter={active ? "url(#sa-glow-slow)" : undefined} opacity={active ? 1 : 0.2}>
            <circle cx={obj.pos.x} cy={obj.pos.y} r={obj.radius} fill={active ? SLOW_COLOR : SLOW_DIM} />
            <text x={obj.pos.x} y={obj.pos.y + 5} textAnchor="middle" fontSize={12} fill="white" opacity={active ? 0.9 : 0.3} fontWeight="bold">🛢</text>
          </g>
        );
      })}
    </>
  );
}

// ── Speed gauge ───────────────────────────────────────────────────────────────

function SpeedGauge({ velocity, maxVelocity }: { velocity: number; maxVelocity: number }) {
  const pct    = Math.min(1, velocity / maxVelocity);
  const color  = speedColor(velocity, maxVelocity);
  const label  = velocity.toFixed(1);
  return (
    <div className="flex items-center gap-2 w-full">
      <span className="text-[10px] font-mono text-slate-500 w-14 shrink-0">SPEED {label}</span>
      <div className="flex-1 h-2 rounded-full bg-slate-800 overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{
            width: `${pct * 100}%`,
            background: color,
            boxShadow: `0 0 8px ${color}`,
            transition: "width 60ms linear, background 200ms",
          }}
        />
      </div>
      <span className="text-[10px] font-mono w-8 text-right" style={{ color }}>{Math.round(pct * 100)}%</span>
    </div>
  );
}

// ── Main arena component ──────────────────────────────────────────────────────

interface Props {
  config: SpeedConfig;
  showDebug?: boolean;
  backgroundUrl?: string;
  overlayOpacity?: number;
  autoStart?: boolean;
}

export default function SpeedArena({ config, showDebug = false, backgroundUrl, overlayOpacity = 0.20, autoStart = false }: Props) {
  const [state,   setState]  = React.useState<SpeedState>(() => {
    const s = createInitialState(config);
    return autoStart ? { ...s, status: "running" as const } : s;
  });
  const [running, setRunning] = React.useState(autoStart);

  const stateRef   = React.useRef<SpeedState>(state);
  const keysRef    = React.useRef<Set<string>>(new Set());
  stateRef.current = state;

  // Nitro (dev preview, not saved to DB)
  const nitroActivateRef = React.useRef(false);
  const nitroUsedRef     = React.useRef(false);
  const [nitroUsed, setNitroUsed] = React.useState(false);

  // Reset on config change
  React.useEffect(() => {
    const fresh = createInitialState(config);
    setState(autoStart ? { ...fresh, status: "running" as const } : fresh);
    stateRef.current = autoStart ? { ...fresh, status: "running" as const } : fresh;
    setRunning(autoStart);
    nitroActivateRef.current = false;
    nitroUsedRef.current     = false;
    setNitroUsed(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  // Keyboard listeners
  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      keysRef.current.add(e.code);
      if (["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Space"].includes(e.code))
        e.preventDefault();
      if (e.code === "Space" && !nitroUsedRef.current)
        nitroActivateRef.current = true;
    };
    const up = (e: KeyboardEvent) => keysRef.current.delete(e.code);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  // Tick loop
  React.useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      // Consume nitro activation (single-trigger per keypress)
      const nitroActivate = nitroActivateRef.current;
      nitroActivateRef.current = false;

      let cur = stateRef.current;
      if (cur.status !== "running") { setRunning(false); return; }

      // Inject nitro velocity boost once
      if (nitroActivate && !nitroUsedRef.current) {
        nitroUsedRef.current = true;
        setNitroUsed(true);
        cur = {
          ...cur,
          player: { ...cur.player, velocity: Math.min(config.maxVelocity, cur.player.velocity + NITRO_SPEED_BOOST) },
        };
        stateRef.current = cur;
      }

      const keys = keysRef.current;
      const input: SpeedInput =
        keys.has("ArrowLeft") || keys.has("KeyA") ? "left" :
        keys.has("ArrowRight") || keys.has("KeyD") ? "right" : "none";
      const next = applyTick(cur, input, config);
      stateRef.current = next;
      setState(next);
    }, config.tickMs);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  const handleStart = () => {
    if (state.status === "idle") {
      const started = { ...state, status: "running" as const };
      setState(started);
      stateRef.current = started;
      setRunning(true);
    } else if (state.status === "running") {
      setRunning(r => !r); // pause/resume
    }
  };

  const handleReset = () => {
    const fresh = createInitialState(config);
    setState(fresh);
    stateRef.current = fresh;
    setRunning(false);
    nitroActivateRef.current = false;
    nitroUsedRef.current     = false;
    setNitroUsed(false);
  };

  const { arenaW, arenaH, maxVelocity, maxTicks } = config;
  const p       = state.player;
  const pColor  = speedColor(p.velocity, maxVelocity);
  const isDone  = state.status === "crashed" || state.status === "finished";
  const isPaused = !running && state.status === "running";
  const tickPct  = state.tick / maxTicks;

  // Stamina preview (dev display only)
  const staminaPreview = nitroStaminaPreview(nitroUsed, state.status === "crashed");

  return (
    <div className="flex flex-col items-center gap-3 select-none">

      {/* ── Arena SVG ── */}
      <div className="relative rounded-xl overflow-hidden" style={{ boxShadow: `0 0 40px rgba(34,211,238,0.06), 0 0 0 1px ${WALL_COLOR}` }}>
        <svg width={arenaW} height={arenaH} style={{ display: "block", background: backgroundUrl ? "transparent" : BG_COLOR }}>
          <Filters />

          {/* Theme background */}
          {backgroundUrl && (
            <>
              <defs>
                <filter id="sa-bg-blur" x="-2%" y="-2%" width="104%" height="104%">
                  <feGaussianBlur stdDeviation="1.2" />
                </filter>
              </defs>
              <image
                href={backgroundUrl}
                x={0} y={0} width={arenaW} height={arenaH}
                preserveAspectRatio="xMidYMid slice"
                filter="url(#sa-bg-blur)"
              />
              <rect x={0} y={0} width={arenaW} height={arenaH}
                fill={`rgba(2,6,23,${overlayOpacity})`}
              />
            </>
          )}

          {/* Wall border */}
          <rect x={1} y={1} width={arenaW - 2} height={arenaH - 2}
            fill="none" stroke={WALL_COLOR} strokeWidth={3}
            rx={4} ry={4}
          />

          {/* Objects */}
          <ObjectTokens objects={state.objects} />

          {/* Player */}
          {state.status !== "idle" && (
            <PlayerToken x={p.pos.x} y={p.pos.y} angle={p.angle} color={pColor} />
          )}

          {/* Ghost start marker when idle */}
          {state.status === "idle" && (
            <circle cx={arenaW * 0.18} cy={arenaH * 0.5} r={9}
              fill={PLAYER_COLOR_SLOW} opacity={0.35}
            />
          )}
        </svg>

        {/* ── Status overlays ── */}
        {(state.status === "idle" || isPaused || isDone) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/65 backdrop-blur-[2px]">
            {state.status === "idle" && (
              <>
                <div className="text-2xl font-black text-white tracking-tight">SPEED RACE</div>
                <div className="text-[11px] text-slate-400">
                  <span className="text-cyan-400 font-bold">← → </span> nebo{" "}
                  <span className="text-cyan-400 font-bold"> A D </span> — zatočit
                </div>
                <div className="text-[10px] text-slate-600">rychlost roste automaticky · kolize při vysoké rychlosti = crash</div>
                <button
                  onClick={handleStart}
                  className="mt-1 rounded-lg bg-cyan-500 px-6 py-2 text-sm font-black text-white hover:bg-cyan-400 active:scale-95 transition-all"
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
                <div className={`text-3xl font-black ${state.status === "finished" ? "text-emerald-400" : "text-red-400"}`}
                  style={{ textShadow: state.status === "finished" ? "0 0 20px #10b981" : "0 0 20px #ef4444" }}
                >
                  {state.status === "finished" ? "✅ CÍLEM" : "💥 CRASH"}
                </div>
                <div className="text-2xl font-black text-white">{state.score} bodů</div>
                <div className="text-xs text-slate-500">
                  {p.ticksAlive} tiků · ⚡{p.boostsHit} · 🛢{p.slowsHit} · bounces {p.wallBounces}
                </div>
                <div className="text-[10px] font-mono text-slate-600">
                  stamina −{staminaPreview.total}
                  {staminaPreview.nitroCost > 0 && <span className="text-amber-500"> (nitro −{staminaPreview.nitroCost})</span>}
                  {staminaPreview.crashPenalty > 0 && <span className="text-red-500"> (crash −{staminaPreview.crashPenalty})</span>}
                </div>
                <button onClick={handleReset} className="mt-1 rounded-lg bg-slate-700 px-5 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-600 transition">
                  ↺ Reset
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── HUD bar ── */}
      <div className="w-full space-y-1.5 px-1">
        <div className="flex items-center justify-between text-[10px] font-mono text-slate-600">
          <span>tick {state.tick}/{maxTicks}</span>
          <span>⚡ ×{state.player.boostsHit}  🛢 ×{state.player.slowsHit}</span>
          <span className="font-bold text-slate-400">score {state.score}</span>
        </div>

        {/* Nitro indicator */}
        <div className="flex items-center gap-2 text-[10px] font-mono">
          <span className="text-slate-600 w-14 shrink-0">NITRO</span>
          {state.status === "idle" ? (
            <span className="text-slate-600">SPACE (1× za hru, −20 stamina)</span>
          ) : nitroUsed ? (
            <span className="text-slate-500">✓ použito</span>
          ) : (
            <span className="text-amber-300 font-bold">⚡ ready — SPACE</span>
          )}
        </div>

        {/* Speed gauge */}
        <SpeedGauge velocity={p.velocity} maxVelocity={maxVelocity} />

        {/* Time bar */}
        <div className="h-1 w-full rounded-full bg-slate-800 overflow-hidden">
          <div
            className="h-full rounded-full bg-slate-600"
            style={{ width: `${tickPct * 100}%`, transition: "width 60ms linear" }}
          />
        </div>
      </div>

      {/* ── Controls ── */}
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

      {/* ── Debug panel ── */}
      {showDebug && (
        <div className="w-full rounded-lg bg-slate-900 border border-slate-700 p-3 font-mono text-[10px] text-slate-400 space-y-0.5">
          <div><span className="text-slate-600">status</span> <span className="text-white">{state.status}</span>  <span className="text-slate-600 ml-3">tick</span> {state.tick}/{maxTicks}  <span className="text-slate-600 ml-3">input</span> {state.lastInput}</div>
          <div><span className="text-slate-600">pos</span> {p.pos.x.toFixed(1)},{p.pos.y.toFixed(1)}  <span className="text-slate-600 ml-2">angle</span> {(p.angle * 180 / Math.PI).toFixed(1)}°</div>
          <div><span className="text-slate-600">vel</span> <span style={{ color: speedColor(p.velocity, maxVelocity) }}>{p.velocity.toFixed(2)}</span>/{maxVelocity}  <span className="text-slate-600 ml-2">dist</span> {p.distanceTraveled.toFixed(0)}px</div>
          <div><span className="text-slate-600">boosts</span> {p.boostsHit}  <span className="text-slate-600 ml-2">slows</span> {p.slowsHit}  <span className="text-slate-600 ml-2">bounces</span> {p.wallBounces}  <span className="text-slate-600 ml-2">score</span> <span className="text-white">{state.score}</span></div>
          <div>
            <span className="text-slate-600">nitro</span>{" "}
            <span className={nitroUsed ? "text-slate-500" : "text-amber-300"}>{nitroUsed ? "used" : "ready"}</span>
            <span className="text-slate-600 ml-3">stamina preview</span>{" "}
            <span className="text-slate-300">−{staminaPreview.total}</span>
            {staminaPreview.nitroCost > 0 && <span className="text-amber-500"> nitro −{staminaPreview.nitroCost}</span>}
            {staminaPreview.crashPenalty > 0 && <span className="text-red-500"> crash −{staminaPreview.crashPenalty}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
