"use client";

import React from "react";
import { applyTick, createInitialState, getJumpHeight } from "@/lib/legendary/simulate";
import type { LegendaryConfig, LegendaryInput, LegendaryState } from "@/lib/legendary/types";

// ── Visual constants ──────────────────────────────────────────────────────────

const P1_COLOR   = "#00ff88";
const P2_COLOR   = "#c084fc";
const OBS_COLOR  = "#ff3366";
const BG_COLOR   = "#030712";

const PLAYER_X   = 80;    // fixed screen X
const PX_PER_DIST = 2.4;  // pixels per distance unit
const PLAYER_R   = 14;    // player circle radius

const TRAIL_LEN  = 8;     // trail positions to keep

// ── SVG filters ───────────────────────────────────────────────────────────────

function NeonFilters() {
  return (
    <defs>
      <filter id="lg-p1" x="-100%" y="-100%" width="300%" height="300%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="b" />
        <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>
      <filter id="lg-p2" x="-100%" y="-100%" width="300%" height="300%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="b" />
        <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>
      <filter id="lg-obs" x="-60%" y="-60%" width="220%" height="220%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="b" />
        <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>
      <filter id="lg-flash" x="-100%" y="-100%" width="300%" height="300%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="b" />
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

// ── Trail store ───────────────────────────────────────────────────────────────

interface TrailPos { x: number; y: number; }

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

  const stateRef = React.useRef<LegendaryState>(state);
  const keysRef  = React.useRef<Set<string>>(new Set());
  stateRef.current = state;

  // Trail state (mutable, no re-render needed — updated each tick before setState)
  const p1TrailRef = React.useRef<TrailPos[]>([]);
  const p2TrailRef = React.useRef<TrailPos[]>([]);

  // Config changes → full reset
  React.useEffect(() => {
    const fresh = createInitialState(config);
    setState(autoStart ? { ...fresh, status: "running" as const } : fresh);
    stateRef.current = fresh;
    p1TrailRef.current = [];
    p2TrailRef.current = [];
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
      if (cur.status !== "running") { setRunning(false); clearInterval(id); return; }
      const keys  = keysRef.current;
      const input: LegendaryInput = { p1Jump: keys.has("Space"), p2Jump: keys.has("KeyS") };
      const next  = applyTick(cur, input, config);
      stateRef.current = next;

      // update trails
      const laneH  = Math.floor(config.arenaH / 2) - 6;
      const groundY = laneH - PLAYER_R - 2;
      const p1Y = groundY - getJumpHeight(next.p1, next.tick, config) * config.jumpMaxHeight;
      const p2Y = laneH + 12 + groundY - getJumpHeight(next.p2, next.tick, config) * config.jumpMaxHeight;
      p1TrailRef.current = [{ x: PLAYER_X, y: p1Y }, ...p1TrailRef.current].slice(0, TRAIL_LEN);
      p2TrailRef.current = [{ x: PLAYER_X, y: p2Y }, ...p2TrailRef.current].slice(0, TRAIL_LEN);

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
    p1TrailRef.current = [];
    p2TrailRef.current = [];
    setRunning(false);
  };

  // ── Layout geometry ─────────────────────────────────────────────────────────

  const AW    = config.arenaW;
  const AH    = config.arenaH;
  const laneH = Math.floor(AH / 2) - 6;
  const groundY = laneH - PLAYER_R - 2;  // ground line Y within lane
  const lane2Y  = laneH + 12;

  const tick = state.tick;

  // Player Y given jump state
  const playerY = (p: typeof state.p1, laneOY: number): number => {
    const h = getJumpHeight(p, tick, config) * config.jumpMaxHeight;
    return laneOY + groundY - h;
  };

  // Squeeze during jump
  const playerScale = (p: typeof state.p1): { sx: number; sy: number } => {
    const h = getJumpHeight(p, tick, config);
    if (h < 0.05) return { sx: 1, sy: 1 };
    return { sx: 0.9, sy: 1.1 };
  };

  // Hit flash / stumble color
  const playerFill = (p: typeof state.p1, baseColor: string): string => {
    if (tick < p.hitFlashUntilTick) return "#ff2244";
    if (tick < p.stumbleUntilTick)  return "#ffaa00";
    return baseColor;
  };

  // Hit shake
  const playerShake = (p: typeof state.p1): number => {
    if (tick < p.hitFlashUntilTick) return (tick % 2 === 0 ? 2 : -2);
    return 0;
  };

  // Triangle obstacle polygon points
  const trianglePoints = (sx: number, laneOY: number, obsH: number, obsW: number): string => {
    const base = laneOY + groundY + PLAYER_R;  // ground level (just below player feet)
    return `${sx},${base} ${sx + obsW / 2},${base - obsH} ${sx + obsW},${base}`;
  };

  // Render obstacles for one lane
  const renderObstacles = (dist: number, pKey: "p1Cleared" | "p2Cleared", laneOY: number) =>
    state.obstacles
      .filter(o => !o[pKey])
      .map(o => {
        const sx = PLAYER_X + (o.distance - dist) * PX_PER_DIST;
        if (sx < -o.width * 2 || sx > AW + o.width) return null;
        const pts = trianglePoints(sx - o.width / 2, laneOY, o.height, o.width);
        return (
          <polygon
            key={o.id}
            points={pts}
            fill={OBS_COLOR}
            filter="url(#lg-obs)"
            opacity={0.95}
          />
        );
      });

  // Render trail
  const renderTrail = (trail: TrailPos[], color: string, laneOY: number) =>
    trail.slice(1).map((pos, i) => {
      const idx = i + 1;
      return (
        <circle
          key={idx}
          cx={pos.x + laneOY * 0}  // laneOY already baked in by tick loop
          cy={pos.y}
          r={PLAYER_R * (1 - idx / TRAIL_LEN) * 0.7}
          fill={color}
          opacity={(1 - idx / TRAIL_LEN) * 0.4}
        />
      );
    });

  // Render player
  const renderPlayer = (
    p: typeof state.p1,
    laneOY: number,
    color: string,
    filterId: string,
    trail: TrailPos[]
  ) => {
    const py    = playerY(p, laneOY);
    const fill  = playerFill(p, color);
    const { sx, sy } = playerScale(p);
    const shake = playerShake(p);
    const cx    = PLAYER_X + shake;

    // Shadow ellipse (on ground, shrinks as player rises)
    const jumpFrac = getJumpHeight(p, tick, config);
    const shadowScale = 1 - jumpFrac * 0.7;
    const shadowY = laneOY + groundY + PLAYER_R;

    return (
      <g>
        {/* Trail */}
        {renderTrail(trail, color, laneOY)}
        {/* Ground shadow */}
        <ellipse
          cx={PLAYER_X}
          cy={shadowY}
          rx={PLAYER_R * shadowScale}
          ry={3 * shadowScale}
          fill={color}
          opacity={0.18 * shadowScale}
        />
        {/* Player circle */}
        <circle
          cx={cx}
          cy={py}
          r={PLAYER_R}
          fill={fill}
          filter={`url(#${filterId})`}
          opacity={tick < p.stumbleUntilTick ? 0.55 : 1}
          transform={`translate(${cx},${py}) scale(${sx},${sy}) translate(${-cx},${-py})`}
        />
      </g>
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

          {/* Lane separator */}
          <line x1={0} y1={laneH + 6} x2={AW} y2={laneH + 6}
            stroke="rgba(255,255,255,0.06)" strokeWidth={1} />

          {/* ── Lane 1 (P1) ── */}
          <line x1={0} y1={groundY + PLAYER_R + 2} x2={AW} y2={groundY + PLAYER_R + 2}
            stroke={`${P1_COLOR}30`} strokeWidth={1.5} />
          <text x={8} y={12} fontSize={9} fill={`${P1_COLOR}88`} fontFamily="monospace" fontWeight="bold">P1</text>
          {renderObstacles(state.p1.distance, "p1Cleared", 0)}
          {renderPlayer(state.p1, 0, P1_COLOR, "lg-p1", p1TrailRef.current)}

          {/* ── Lane 2 (P2) ── */}
          <line x1={0} y1={lane2Y + groundY + PLAYER_R + 2} x2={AW} y2={lane2Y + groundY + PLAYER_R + 2}
            stroke={`${P2_COLOR}30`} strokeWidth={1.5} />
          <text x={8} y={lane2Y + 12} fontSize={9} fill={`${P2_COLOR}88`} fontFamily="monospace" fontWeight="bold">P2</text>
          {renderObstacles(state.p2.distance, "p2Cleared", lane2Y)}
          {renderPlayer(state.p2, lane2Y, P2_COLOR, "lg-p2", p2TrailRef.current)}

          {/* Overlay: idle / paused / finished */}
          {(state.status === "idle" || isPaused || isDone) && (
            <g>
              <rect x={0} y={0} width={AW} height={AH} fill="rgba(3,7,18,0.75)" />
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
          <button onClick={handleStart}
            className="rounded-lg bg-amber-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-amber-500 transition">
            ⏸ Pauza
          </button>
        )}
        {state.status === "idle" && (
          <button onClick={handleStart}
            className="rounded-lg bg-emerald-500 px-5 py-2 text-sm font-black text-white hover:bg-emerald-400 active:scale-95 transition-all">
            ▶ Start
          </button>
        )}
        <button onClick={handleReset}
          className="rounded-lg bg-slate-700 border border-slate-600 px-4 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-600 transition">
          ↺ Reset
        </button>
      </div>

      {/* Debug panel */}
      {showDebug && (
        <div className="rounded-lg bg-slate-900 border border-slate-700 p-3 font-mono text-[10px] text-slate-400 space-y-0.5"
          style={{ width: AW }}>
          <div>
            <span className="text-slate-600">status</span> {state.status}
            <span className="text-slate-600 ml-3">tick</span> {state.tick}/{config.maxTicks}
            <span className="text-slate-600 ml-3">obstacles</span> {state.obstacles.length}
          </div>
          <div style={{ color: P1_COLOR }}>
            P1 dist={state.p1.distance} score={state.p1.score} cleared={state.p1.obstaclesCleared} crashes={state.p1.crashes}
            {" "}jumpTick={state.p1.jumpTick} jH={Math.round(getJumpHeight(state.p1, tick, config) * config.jumpMaxHeight)}px
            {" "}stumble={state.p1.stumbleUntilTick > tick ? state.p1.stumbleUntilTick - tick : 0}
          </div>
          <div style={{ color: P2_COLOR }}>
            P2 dist={state.p2.distance} score={state.p2.score} cleared={state.p2.obstaclesCleared} crashes={state.p2.crashes}
            {" "}jumpTick={state.p2.jumpTick} jH={Math.round(getJumpHeight(state.p2, tick, config) * config.jumpMaxHeight)}px
            {" "}stumble={state.p2.stumbleUntilTick > tick ? state.p2.stumbleUntilTick - tick : 0}
          </div>
          {state.winner && <div className="text-amber-400 font-bold">winner: P{state.winner}</div>}
          <div><span className="text-slate-600">boostUsed</span> <span className="text-slate-500">false (nitro v přípravě)</span></div>
          <div className="text-slate-600">
            obstacles: {state.obstacles.slice(0, 5).map(o => `[d=${o.distance} h=${o.height}]`).join(" ")}
          </div>
        </div>
      )}
    </div>
  );
}
