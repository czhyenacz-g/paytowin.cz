"use client";

import React from "react";
import { applyTick, createInitialState, getJumpHeight } from "@/lib/legendary/simulate";
import type { LegendaryConfig, LegendaryInput, LegendaryState } from "@/lib/legendary/types";

// ── Visual constants ──────────────────────────────────────────────────────────

const P1_COLOR     = "#00ff88";
const P2_COLOR     = "#c084fc";
const OBS_COLOR    = "#ff4060";
const BG_COLOR     = "#030712";
const GRID_ALPHA   = "rgba(255,255,255,0.03)";

const PLAYER_X     = 70;    // fixed screen X of player circle
const JUMP_MAX_PX  = 38;    // max pixels above ground at jump peak
const PX_PER_DIST  = 2.8;   // pixels per distance unit (obstacle scroll speed)
const PLAYER_R     = 9;     // player circle radius
const OBS_W        = 13;
const OBS_H        = 26;

// ── SVG helpers ───────────────────────────────────────────────────────────────

function NeonFilters() {
  return (
    <defs>
      <filter id="lg-p1" x="-80%" y="-80%" width="260%" height="260%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="b" />
        <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>
      <filter id="lg-p2" x="-80%" y="-80%" width="260%" height="260%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="b" />
        <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>
      <filter id="lg-obs" x="-60%" y="-60%" width="220%" height="220%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="b" />
        <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>
    </defs>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  config: LegendaryConfig;
  autoStart?: boolean;
  showDebug?: boolean;
  onResult?: (winner: 1 | 2 | "draw") => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function LegendaryHorseRaceArena({
  config,
  autoStart = false,
  showDebug = false,
  onResult,
}: Props) {
  const [state, setState] = React.useState<LegendaryState>(() => {
    const s = createInitialState(config);
    return autoStart ? { ...s, status: "running" as const } : s;
  });
  const [running, setRunning] = React.useState(autoStart);

  const stateRef  = React.useRef<LegendaryState>(state);
  const keysRef   = React.useRef<Set<string>>(new Set());
  stateRef.current = state;

  // Config changes → full reset
  React.useEffect(() => {
    const fresh = createInitialState(config);
    setState(autoStart ? { ...fresh, status: "running" as const } : fresh);
    stateRef.current = fresh;
    setRunning(autoStart);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  // onResult callback
  const onResultRef = React.useRef(onResult);
  React.useEffect(() => { onResultRef.current = onResult; });
  React.useEffect(() => {
    if (state.status === "finished") {
      const w = state.winner;
      onResultRef.current?.(w === 1 ? 1 : w === 2 ? 2 : "draw");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status]);

  // Keyboard
  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      keysRef.current.add(e.code);
      if (e.code === "Space" || e.code === "KeyS") e.preventDefault();
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
      const cur = stateRef.current;
      if (cur.status !== "running") {
        setRunning(false);
        clearInterval(id);
        return;
      }
      const keys = keysRef.current;
      const input: LegendaryInput = { p1Jump: keys.has("Space"), p2Jump: keys.has("KeyS") };
      const next = applyTick(cur, input, config);
      stateRef.current = next;
      setState(next);
    }, config.tickMs);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  const handleStart = () => {
    if (state.status === "idle") {
      setState(s => ({ ...s, status: "running" as const }));
      stateRef.current = { ...stateRef.current, status: "running" };
      setRunning(true);
    } else if (state.status === "running") {
      setRunning(r => !r);
    }
  };

  const handleReset = () => {
    const fresh = createInitialState(config);
    setState(fresh);
    stateRef.current = fresh;
    setRunning(false);
  };

  // ── Layout geometry ─────────────────────────────────────────────────────────

  const AW  = config.arenaW;
  const AH  = config.arenaH;
  const laneH   = Math.floor(AH / 2) - 6;
  const groundY = laneH - 14;            // ground Y within a lane
  const lane2Y  = laneH + 12;            // top of lane 2

  const tick = state.tick;

  const playerScreenY = (jumpStart: number): number => {
    if (jumpStart < 0) return groundY;
    const h = getJumpHeight({ jumpStartTick: jumpStart } as Parameters<typeof getJumpHeight>[0], tick, config);
    return groundY - h * JUMP_MAX_PX;
  };

  // Render obstacles for one lane
  const renderObstacles = (dist: number, pKey: "p1Cleared" | "p2Cleared", laneOY: number) =>
    state.obstacles
      .filter(o => !o[pKey])
      .map(o => {
        const sx = PLAYER_X + (o.distance - dist) * PX_PER_DIST;
        if (sx < -OBS_W || sx > AW + OBS_W) return null;
        return (
          <rect
            key={o.id}
            x={sx - OBS_W / 2}
            y={laneOY + groundY - OBS_H}
            width={OBS_W}
            height={OBS_H}
            rx={2}
            fill={OBS_COLOR}
            filter="url(#lg-obs)"
            opacity={0.95}
          />
        );
      });

  // Render player circle
  const renderPlayer = (
    jumpStart: number,
    stumbleUntil: number,
    laneOY: number,
    color: string,
    filterId: string
  ) => {
    const py = laneOY + playerScreenY(jumpStart);
    const stumbling = tick < stumbleUntil;
    return (
      <circle
        cx={PLAYER_X}
        cy={py}
        r={PLAYER_R}
        fill={color}
        filter={`url(#${filterId})`}
        opacity={stumbling ? 0.45 : 1}
      />
    );
  };

  const isDone   = state.status === "finished";
  const isPaused = !running && state.status === "running";

  const progressPct = config.maxTicks > 0 ? state.tick / config.maxTicks : 0;

  return (
    <div className="flex flex-col items-center gap-2 select-none">

      {/* Score bar */}
      <div className="flex w-full justify-between text-[11px] font-mono" style={{ width: AW }}>
        <span style={{ color: P1_COLOR }}>
          P1 &nbsp;{state.p1.score}pt · {state.p1.obstaclesCleared}✓ · {state.p1.crashes}✗
          {tick < state.p1.stumbleUntilTick && <span className="text-amber-400"> ZAKOPL</span>}
        </span>
        <span className="text-slate-600 tabular-nums">{state.tick}/{config.maxTicks}</span>
        <span style={{ color: P2_COLOR }}>
          {state.p2.crashes}✗ · {state.p2.obstaclesCleared}✓ · {state.p2.score}pt &nbsp;P2
          {tick < state.p2.stumbleUntilTick && <span className="text-amber-400"> ZAKOPL</span>}
        </span>
      </div>

      {/* Progress bar */}
      <div className="rounded-full overflow-hidden" style={{ width: AW, height: 3, background: "rgba(255,255,255,0.06)" }}>
        <div style={{ width: `${progressPct * 100}%`, height: "100%", background: "rgba(255,255,255,0.25)", transition: "width 0.08s linear" }} />
      </div>

      {/* Arena SVG */}
      <div
        className="relative rounded-lg overflow-hidden"
        style={{ boxShadow: "0 0 0 1px rgba(255,255,255,0.07), 0 0 28px rgba(0,255,136,0.06)" }}
      >
        <svg width={AW} height={AH} style={{ display: "block", background: BG_COLOR }}>
          <NeonFilters />

          {/* Grid dots */}
          {Array.from({ length: Math.floor(AW / 40) }, (_, i) => (
            <React.Fragment key={i}>
              <circle cx={(i + 1) * 40} cy={groundY}       r={1} fill={GRID_ALPHA} />
              <circle cx={(i + 1) * 40} cy={lane2Y + groundY} r={1} fill={GRID_ALPHA} />
            </React.Fragment>
          ))}

          {/* Lane separator */}
          <line x1={0} y1={laneH + 6} x2={AW} y2={laneH + 6}
            stroke="rgba(255,255,255,0.07)" strokeWidth={1} />

          {/* ── Lane 1 (P1) ── */}
          <line x1={0} y1={groundY} x2={AW} y2={groundY}
            stroke={`${P1_COLOR}40`} strokeWidth={1.5} />
          <text x={8} y={12} fontSize={9} fill={`${P1_COLOR}88`} fontFamily="monospace" fontWeight="bold">P1</text>
          {renderObstacles(state.p1.distance, "p1Cleared", 0)}
          {renderPlayer(state.p1.jumpStartTick, state.p1.stumbleUntilTick, 0, P1_COLOR, "lg-p1")}

          {/* ── Lane 2 (P2) ── */}
          <line x1={0} y1={lane2Y + groundY} x2={AW} y2={lane2Y + groundY}
            stroke={`${P2_COLOR}40`} strokeWidth={1.5} />
          <text x={8} y={lane2Y + 12} fontSize={9} fill={`${P2_COLOR}88`} fontFamily="monospace" fontWeight="bold">P2</text>
          {renderObstacles(state.p2.distance, "p2Cleared", lane2Y)}
          {renderPlayer(state.p2.jumpStartTick, state.p2.stumbleUntilTick, lane2Y, P2_COLOR, "lg-p2")}

          {/* Overlay: idle / paused / finished */}
          {(state.status === "idle" || isPaused || isDone) && (
            <g>
              <rect x={0} y={0} width={AW} height={AH} fill="rgba(3,7,18,0.72)" />
              {state.status === "idle" && (
                <>
                  <text x={AW / 2} y={AH / 2 - 10} textAnchor="middle" fontSize={20}
                    fill="white" fontFamily="monospace" fontWeight="900">
                    LEGENDARY RACE
                  </text>
                  <text x={AW / 2} y={AH / 2 + 14} textAnchor="middle" fontSize={11}
                    fill="#94a3b8" fontFamily="monospace">
                    P1: SPACE · P2: S — skok
                  </text>
                </>
              )}
              {isPaused && (
                <text x={AW / 2} y={AH / 2 + 6} textAnchor="middle" fontSize={20}
                  fill="#fbbf24" fontFamily="monospace" fontWeight="900">
                  PAUZA
                </text>
              )}
              {isDone && (
                <>
                  <text x={AW / 2} y={AH / 2 - 12} textAnchor="middle" fontSize={22}
                    fill={state.winner === 1 ? P1_COLOR : state.winner === 2 ? P2_COLOR : "#94a3b8"}
                    fontFamily="monospace" fontWeight="900">
                    {state.winner === "draw" ? "REMÍZA" : `🏆 P${state.winner} VYHRÁL`}
                  </text>
                  <text x={AW / 2} y={AH / 2 + 10} textAnchor="middle" fontSize={10}
                    fill="#64748b" fontFamily="monospace">
                    P1: {state.p1.score}pt · {state.p1.obstaclesCleared}✓ · {state.p1.crashes}✗
                    {"   "}
                    P2: {state.p2.score}pt · {state.p2.obstaclesCleared}✓ · {state.p2.crashes}✗
                  </text>
                </>
              )}
            </g>
          )}
        </svg>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2">
        {state.status === "running" && (
          <button
            onClick={handleStart}
            className="rounded-lg bg-amber-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-amber-500 transition"
          >
            ⏸ Pauza
          </button>
        )}
        {state.status === "idle" && (
          <button
            onClick={handleStart}
            className="rounded-lg bg-emerald-500 px-5 py-2 text-sm font-black text-white hover:bg-emerald-400 active:scale-95 transition-all"
          >
            ▶ Start
          </button>
        )}
        <button
          onClick={handleReset}
          className="rounded-lg bg-slate-700 border border-slate-600 px-4 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-600 transition"
        >
          ↺ Reset
        </button>
      </div>

      {/* Debug panel */}
      {showDebug && (
        <div
          className="rounded-lg bg-slate-900 border border-slate-700 p-3 font-mono text-[10px] text-slate-400 space-y-0.5"
          style={{ width: AW }}
        >
          <div>
            <span className="text-slate-600">status</span> {state.status}
            <span className="text-slate-600 ml-3">tick</span> {state.tick}/{config.maxTicks}
            <span className="text-slate-600 ml-3">obstacles</span> {state.obstacles.length}
          </div>
          <div style={{ color: P1_COLOR }}>
            P1 dist={state.p1.distance} score={state.p1.score} cleared={state.p1.obstaclesCleared} crashes={state.p1.crashes}
            {" "}jump={state.p1.jumpStartTick >= 0 ? `t${state.p1.jumpStartTick}` : "—"}
            {" "}stumble={state.p1.stumbleUntilTick > tick ? state.p1.stumbleUntilTick - tick : 0}
          </div>
          <div style={{ color: P2_COLOR }}>
            P2 dist={state.p2.distance} score={state.p2.score} cleared={state.p2.obstaclesCleared} crashes={state.p2.crashes}
            {" "}jump={state.p2.jumpStartTick >= 0 ? `t${state.p2.jumpStartTick}` : "—"}
            {" "}stumble={state.p2.stumbleUntilTick > tick ? state.p2.stumbleUntilTick - tick : 0}
          </div>
          {state.winner && <div className="text-amber-400 font-bold">winner: P{state.winner}</div>}
        </div>
      )}
    </div>
  );
}
