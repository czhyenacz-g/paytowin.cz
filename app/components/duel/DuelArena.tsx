"use client";

import React from "react";
import { applyTick, createInitialState, getBotInput } from "@/lib/duel/simulate";
import type { Dir, DuelConfig, DuelState } from "@/lib/duel/types";

// ── Constants ─────────────────────────────────────────────────────────────────

const P1_COLOR  = "#00ff88"; // neon green
const P2_COLOR  = "#c084fc"; // neon purple
const P1_DIM    = "#005530";
const P2_DIM    = "#4c1d95";
const BG_COLOR  = "#030712";
const GRID_COLOR = "rgba(255,255,255,0.04)";

const CELL_PX = 16; // px per grid cell

// ── SVG neon glow filter ──────────────────────────────────────────────────────

function NeonFilters() {
  return (
    <defs>
      <filter id="glow-p1" x="-60%" y="-60%" width="220%" height="220%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="b1" />
        <feGaussianBlur in="SourceGraphic" stdDeviation="1"   result="b2" />
        <feMerge>
          <feMergeNode in="b1" />
          <feMergeNode in="b2" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter id="glow-p2" x="-60%" y="-60%" width="220%" height="220%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="b1" />
        <feGaussianBlur in="SourceGraphic" stdDeviation="1"   result="b2" />
        <feMerge>
          <feMergeNode in="b1" />
          <feMergeNode in="b2" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter id="glow-head" x="-100%" y="-100%" width="300%" height="300%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
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

function Trail({
  trail, color, dimColor, alive, filterId, cs,
}: {
  trail: readonly { x: number; y: number }[];
  color: string;
  dimColor: string;
  alive: boolean;
  filterId: string;
  cs: number;
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

function Head({
  pos, color, alive, cs,
}: {
  pos: { x: number; y: number };
  color: string;
  alive: boolean;
  cs: number;
}) {
  const cx = pos.x * cs + cs / 2;
  const cy = pos.y * cs + cs / 2;
  return (
    <g filter={alive ? "url(#glow-head)" : undefined} opacity={alive ? 1 : 0.3}>
      <circle cx={cx} cy={cy} r={cs * 0.42} fill={color} />
      <circle cx={cx} cy={cy} r={cs * 0.2} fill="white" opacity={0.7} />
    </g>
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
}

export default function DuelArena({ config, mode, showDebug = false, backgroundUrl, overlayOpacity = 0.68 }: Props) {
  const [state, setState] = React.useState<DuelState>(() => createInitialState(config));
  const [running, setRunning] = React.useState(false);
  const [lastInputs, setLastInputs] = React.useState<{ p1: Dir; p2: Dir }>({ p1: "straight", p2: "straight" });

  const stateRef  = React.useRef<DuelState>(state);
  const keysRef   = React.useRef<Set<string>>(new Set());
  const runningRef = React.useRef(false);

  stateRef.current = state;
  runningRef.current = running;

  // Reset when config or mode changes
  React.useEffect(() => {
    const fresh = createInitialState(config);
    setState(fresh);
    stateRef.current = fresh;
    setRunning(false);
    runningRef.current = false;
    setLastInputs({ p1: "straight", p2: "straight" });
  }, [config, mode]);

  // Keyboard listeners
  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      keysRef.current.add(e.code);
      // Prevent arrow key page scroll when arena is open
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space"].includes(e.code)) {
        e.preventDefault();
      }
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
        runningRef.current = false;
        clearInterval(id);
        return;
      }

      const keys = keysRef.current;
      const p1: Dir = keys.has("KeyA") ? "left" : keys.has("KeyD") ? "right" : "straight";
      const p2: Dir = mode === "pvbot"
        ? getBotInput(cur, 2, config)
        : keys.has("ArrowLeft") ? "left" : keys.has("ArrowRight") ? "right" : "straight";

      setLastInputs({ p1, p2 });
      const next = applyTick(cur, p1, p2, config);
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
    const fresh = createInitialState(config);
    setState(fresh);
    stateRef.current = fresh;
    setRunning(false);
    runningRef.current = false;
    setLastInputs({ p1: "straight", p2: "straight" });
  };

  const w = config.gridW * CELL_PX;
  const h = config.gridH * CELL_PX;
  const isDone = state.status !== "idle" && state.status !== "running";
  const isPaused = !running && state.status === "running";

  return (
    <div className="flex flex-col items-center gap-3 select-none">

      {/* Arena SVG */}
      <div className="relative rounded-lg overflow-hidden" style={{ boxShadow: "0 0 32px rgba(0,255,136,0.08), 0 0 0 1px rgba(255,255,255,0.06)" }}>
        <svg
          width={w}
          height={h}
          style={{ display: "block", background: backgroundUrl ? "transparent" : BG_COLOR }}
        >
          <NeonFilters />

          {/* Theme background */}
          {backgroundUrl && (
            <>
              <filter id="da-bg-blur" x="0" y="0" width="100%" height="100%">
                <feGaussianBlur stdDeviation="1.5" />
              </filter>
              <image
                href={backgroundUrl}
                x={0} y={0} width={w} height={h}
                preserveAspectRatio="xMidYMid slice"
                filter="url(#da-bg-blur)"
              />
              <rect x={0} y={0} width={w} height={h}
                fill={`rgba(3,7,18,${overlayOpacity})`}
              />
            </>
          )}

          <GridLines w={config.gridW} h={config.gridH} cs={CELL_PX} />

          {/* Trails */}
          <Trail trail={state.p1.trail} color={P1_COLOR} dimColor={P1_DIM} alive={state.p1.alive} filterId="glow-p1" cs={CELL_PX} />
          <Trail trail={state.p2.trail} color={P2_COLOR} dimColor={P2_DIM} alive={state.p2.alive} filterId="glow-p2" cs={CELL_PX} />

          {/* Heads */}
          <Head pos={state.p1.pos} color={P1_COLOR} alive={state.p1.alive} cs={CELL_PX} />
          <Head pos={state.p2.pos} color={P2_COLOR} alive={state.p2.alive} cs={CELL_PX} />
        </svg>

        {/* Overlay: idle / paused / done */}
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
                <button
                  onClick={handleStart}
                  className="rounded-lg bg-amber-500 px-5 py-2 text-sm font-black text-white hover:bg-amber-400 transition"
                >
                  ▶ Pokračovat
                </button>
              </>
            )}
            {isDone && (
              <div className="flex flex-col items-center gap-2">
                <div className={`text-3xl font-black ${state.status === "draw" ? "text-slate-300" : state.winner === 1 ? "text-emerald-400" : "text-purple-400"}`} style={{
                  textShadow: state.winner === 1 ? `0 0 16px ${P1_COLOR}` : state.winner === 2 ? `0 0 16px ${P2_COLOR}` : "none",
                }}>
                  {state.status === "draw"    ? "REMÍZA"
                   : state.winner === 1 ? "🏆 P1 VYHRÁL"
                   : "🏆 P2 VYHRÁL"}
                </div>
                <div className="text-xs text-slate-500">tick {state.tick} · P1: {state.p1.ticksAlive} · P2: {state.p2.ticksAlive}</div>
                <button
                  onClick={handleReset}
                  className="rounded-lg bg-slate-700 px-5 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-600 transition"
                >
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
          <button
            onClick={handleStart}
            className="rounded-lg bg-amber-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-amber-500 transition"
          >
            ⏸ Pauza
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
        <div className="w-full rounded-lg bg-slate-900 border border-slate-700 p-3 font-mono text-[10px] text-slate-400 space-y-0.5">
          <div><span className="text-slate-600">status</span>   <span className="text-white">{state.status}</span>   <span className="text-slate-600 ml-3">tick</span> {state.tick}/{config.maxTicks}</div>
          <div><span className="text-slate-600">p1</span>  <span style={{ color: P1_COLOR }}>{state.p1.pos.x},{state.p1.pos.y}</span> <span className="text-slate-600">dir</span> {state.p1.dir} <span className="text-slate-600">trail</span> {state.p1.trail.length} <span className="text-slate-600">input</span> {lastInputs.p1}</div>
          <div><span className="text-slate-600">p2</span>  <span style={{ color: P2_COLOR }}>{state.p2.pos.x},{state.p2.pos.y}</span> <span className="text-slate-600">dir</span> {state.p2.dir} <span className="text-slate-600">trail</span> {state.p2.trail.length} <span className="text-slate-600">input</span> {lastInputs.p2}</div>
          {state.winner && <div className="text-amber-400 font-bold">winner: P{state.winner}</div>}
        </div>
      )}
    </div>
  );
}
