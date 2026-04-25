"use client";

import React from "react";
import { applyPvpTick, createPvpInitialState } from "@/lib/speed/simulate";
import type { SpeedConfig, SpeedInput, SpeedObject, SpeedPvpState } from "@/lib/speed/types";
import { nitroStaminaPreview } from "@/lib/minigame-nitro";

// ── Visual constants ──────────────────────────────────────────────────────────

const BG_COLOR      = "#020617";
const WALL_COLOR    = "#1e3a5f";
const DIVIDER_COLOR = "rgba(255,255,255,0.07)";
const BOOST_COLOR   = "#10b981";
const BOOST_DIM     = "#064e3b";
const SLOW_COLOR    = "#f97316";
const SLOW_DIM      = "#431407";
const P1_COLOR      = "#22d3ee"; // cyan
const P2_COLOR      = "#c084fc"; // purple

// ── SVG filters ───────────────────────────────────────────────────────────────

function PvpFilters() {
  return (
    <defs>
      <filter id="sa-pvp-boost" x="-80%" y="-80%" width="260%" height="260%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="b" />
        <feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <filter id="sa-pvp-slow" x="-80%" y="-80%" width="260%" height="260%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="3.5" result="b" />
        <feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <filter id="sa-pvp-p1" x="-120%" y="-120%" width="340%" height="340%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="b" />
        <feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <filter id="sa-pvp-p2" x="-120%" y="-120%" width="340%" height="340%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="b" />
        <feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>
  );
}

// ── Player triangle ───────────────────────────────────────────────────────────

function PlayerToken({
  x, y, angle, color, filterId, opacity = 0.95,
}: { x: number; y: number; angle: number; color: string; filterId: string; opacity?: number }) {
  const r   = 9;
  const deg = (angle * 180) / Math.PI;
  const pts = `${r},0 ${-r * 0.55},${-r * 0.85} ${-r * 0.55},${r * 0.85}`;
  return (
    <g filter={`url(#${filterId})`} opacity={opacity}>
      <polygon
        points={pts}
        transform={`translate(${x},${y}) rotate(${deg})`}
        fill={color}
      />
    </g>
  );
}

// ── Lane objects ──────────────────────────────────────────────────────────────

function LaneObjects({ objects, yOffset }: { objects: readonly SpeedObject[]; yOffset: number }) {
  return (
    <g transform={`translate(0,${yOffset})`}>
      {objects.map(obj => {
        const active = obj.active;
        if (obj.kind === "boost") {
          return (
            <g key={obj.id} filter={active ? "url(#sa-pvp-boost)" : undefined} opacity={active ? 1 : 0.2}>
              <circle cx={obj.pos.x} cy={obj.pos.y} r={obj.radius} fill={active ? BOOST_COLOR : BOOST_DIM} />
              <text x={obj.pos.x} y={obj.pos.y + 5} textAnchor="middle" fontSize={13} fill="white" opacity={active ? 0.9 : 0.3} fontWeight="bold">⚡</text>
            </g>
          );
        }
        return (
          <g key={obj.id} filter={active ? "url(#sa-pvp-slow)" : undefined} opacity={active ? 1 : 0.2}>
            <circle cx={obj.pos.x} cy={obj.pos.y} r={obj.radius} fill={active ? SLOW_COLOR : SLOW_DIM} />
            <text x={obj.pos.x} y={obj.pos.y + 5} textAnchor="middle" fontSize={12} fill="white" opacity={active ? 0.9 : 0.3} fontWeight="bold">🛢</text>
          </g>
        );
      })}
    </g>
  );
}

// ── Speed gauge ───────────────────────────────────────────────────────────────

function PvpSpeedGauge({
  velocity, maxVelocity, label, color,
}: { velocity: number; maxVelocity: number; label: string; color: string }) {
  const pct = Math.min(1, velocity / maxVelocity);
  return (
    <div className="flex items-center gap-2 w-full">
      <span className="text-[10px] font-mono w-16 shrink-0" style={{ color }}>
        {label} {velocity.toFixed(1)}
      </span>
      <div className="flex-1 h-1.5 rounded-full bg-slate-800 overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${pct * 100}%`, background: color, boxShadow: `0 0 6px ${color}`, transition: "width 60ms linear" }}
        />
      </div>
      <span className="text-[10px] font-mono w-8 text-right" style={{ color }}>{Math.round(pct * 100)}%</span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  config: SpeedConfig;
  showDebug?: boolean;
  backgroundUrl?: string;
  overlayOpacity?: number;
  autoStart?: boolean;
}

export default function SpeedArenaPvp({
  config, showDebug = false, backgroundUrl, overlayOpacity = 0.20, autoStart = false,
}: Props) {
  const laneH    = Math.floor(config.arenaH / 2) - 4;
  const p2Offset = laneH + 8;

  const [pvpState, setPvpState] = React.useState<SpeedPvpState>(() => {
    const s = createPvpInitialState(config);
    if (autoStart) {
      return {
        ...s,
        p1: { ...s.p1, status: "running" as const },
        p2: { ...s.p2, status: "running" as const },
        overallStatus: "running" as const,
      };
    }
    return s;
  });
  const [running, setRunning]       = React.useState(autoStart);
  const [lastInputs, setLastInputs] = React.useState<{ p1: SpeedInput; p2: SpeedInput }>({ p1: "none", p2: "none" });

  const pvpStateRef = React.useRef(pvpState);
  const keysRef     = React.useRef<Set<string>>(new Set());
  pvpStateRef.current = pvpState;

  const p1NitroActivateRef = React.useRef(false);
  const p2NitroActivateRef = React.useRef(false);

  // Reset on config change
  React.useEffect(() => {
    const fresh = createPvpInitialState(config);
    const s = autoStart
      ? { ...fresh, p1: { ...fresh.p1, status: "running" as const }, p2: { ...fresh.p2, status: "running" as const }, overallStatus: "running" as const }
      : fresh;
    setPvpState(s);
    pvpStateRef.current = s;
    setRunning(autoStart);
    p1NitroActivateRef.current = false;
    p2NitroActivateRef.current = false;
    setLastInputs({ p1: "none", p2: "none" });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  // Keyboard
  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      keysRef.current.add(e.code);
      if (["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Space","KeyS"].includes(e.code))
        e.preventDefault();
      if (e.code === "Space") p1NitroActivateRef.current = true;
      if (e.code === "KeyS")  p2NitroActivateRef.current = true;
    };
    const up = (e: KeyboardEvent) => keysRef.current.delete(e.code);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup",   up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup",   up);
    };
  }, []);

  // Tick loop
  React.useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const cur = pvpStateRef.current;
      if (cur.overallStatus !== "running") { setRunning(false); return; }

      const p1Activate = p1NitroActivateRef.current;
      const p2Activate = p2NitroActivateRef.current;
      p1NitroActivateRef.current = false;
      p2NitroActivateRef.current = false;

      const keys    = keysRef.current;
      const p1Input: SpeedInput = keys.has("ArrowLeft")  ? "left" : keys.has("ArrowRight") ? "right" : "none";
      const p2Input: SpeedInput = keys.has("KeyA") ? "left" : keys.has("KeyD") ? "right" : "none";
      setLastInputs({ p1: p1Input, p2: p2Input });

      const next = applyPvpTick(cur, p1Input, p2Input, config, p1Activate, p2Activate);
      pvpStateRef.current = next;
      setPvpState(next);
    }, config.tickMs);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  const handleStart = () => {
    const cur = pvpStateRef.current;
    if (cur.overallStatus === "idle") {
      const started: SpeedPvpState = {
        ...cur,
        p1: { ...cur.p1, status: "running" },
        p2: { ...cur.p2, status: "running" },
        overallStatus: "running",
      };
      setPvpState(started);
      pvpStateRef.current = started;
      setRunning(true);
    } else if (cur.overallStatus === "running") {
      setRunning(r => !r);
    }
  };

  const handleReset = () => {
    const fresh = createPvpInitialState(config);
    setPvpState(fresh);
    pvpStateRef.current = fresh;
    setRunning(false);
    p1NitroActivateRef.current = false;
    p2NitroActivateRef.current = false;
    setLastInputs({ p1: "none", p2: "none" });
  };

  const { arenaW, arenaH, maxVelocity, maxTicks } = config;
  const isDone   = pvpState.overallStatus === "finished";
  const isPaused = !running && pvpState.overallStatus === "running";
  const tickPct  = pvpState.tick / maxTicks;
  const p1 = pvpState.p1;
  const p2 = pvpState.p2;

  const p1Preview = nitroStaminaPreview(pvpState.p1NitroUsed, p1.status === "crashed");
  const p2Preview = nitroStaminaPreview(pvpState.p2NitroUsed, p2.status === "crashed");

  return (
    <div className="flex flex-col items-center gap-3 select-none">

      {/* ── Arena SVG ── */}
      <div className="relative rounded-xl overflow-hidden" style={{ boxShadow: `0 0 40px rgba(34,211,238,0.06), 0 0 0 1px ${WALL_COLOR}` }}>
        <svg
          width={arenaW}
          height={arenaH}
          style={{ display: "block", background: backgroundUrl ? "transparent" : BG_COLOR }}
        >
          <PvpFilters />

          {/* Theme background */}
          {backgroundUrl && (
            <>
              <defs>
                <filter id="sa-pvp-bg-blur" x="-2%" y="-2%" width="104%" height="104%">
                  <feGaussianBlur stdDeviation="1.2" />
                </filter>
              </defs>
              <image
                href={backgroundUrl}
                x={0} y={0} width={arenaW} height={arenaH}
                preserveAspectRatio="xMidYMid slice"
                filter="url(#sa-pvp-bg-blur)"
              />
              <rect x={0} y={0} width={arenaW} height={arenaH}
                fill={`rgba(2,6,23,${overlayOpacity})`}
              />
            </>
          )}

          {/* Lane borders */}
          <rect x={1} y={1} width={arenaW - 2} height={laneH - 2}
            fill="none" stroke={WALL_COLOR} strokeWidth={2} rx={3}
          />
          <rect x={1} y={p2Offset + 1} width={arenaW - 2} height={laneH - 2}
            fill="none" stroke={WALL_COLOR} strokeWidth={2} rx={3}
          />

          {/* Divider */}
          <line x1={0} y1={laneH + 4} x2={arenaW} y2={laneH + 4}
            stroke={DIVIDER_COLOR} strokeWidth={1} strokeDasharray="6 4"
          />

          {/* Lane labels */}
          <text x={8} y={16} fontSize={9} fontFamily="monospace" fill={P1_COLOR} opacity={0.55}>P1</text>
          <text x={8} y={p2Offset + 16} fontSize={9} fontFamily="monospace" fill={P2_COLOR} opacity={0.55}>P2</text>

          {/* Objects */}
          <LaneObjects objects={p1.objects} yOffset={0} />
          <LaneObjects objects={p2.objects} yOffset={p2Offset} />

          {/* Players */}
          {pvpState.overallStatus !== "idle" && (
            <>
              <PlayerToken
                x={p1.player.pos.x} y={p1.player.pos.y}
                angle={p1.player.angle} color={P1_COLOR} filterId="sa-pvp-p1"
                opacity={p1.status === "crashed" ? 0.3 : 0.95}
              />
              <PlayerToken
                x={p2.player.pos.x} y={p2.player.pos.y + p2Offset}
                angle={p2.player.angle} color={P2_COLOR} filterId="sa-pvp-p2"
                opacity={p2.status === "crashed" ? 0.3 : 0.95}
              />
            </>
          )}

          {/* Ghost start markers when idle */}
          {pvpState.overallStatus === "idle" && (
            <>
              <circle cx={arenaW * 0.18} cy={laneH * 0.5} r={9} fill={P1_COLOR} opacity={0.22} />
              <circle cx={arenaW * 0.18} cy={laneH * 0.5 + p2Offset} r={9} fill={P2_COLOR} opacity={0.22} />
            </>
          )}

          {/* Crash X markers */}
          {pvpState.overallStatus !== "idle" && p1.status === "crashed" && (
            <text x={p1.player.pos.x} y={p1.player.pos.y + 5} textAnchor="middle" fontSize={15} fill="#ef4444" opacity={0.9}>✕</text>
          )}
          {pvpState.overallStatus !== "idle" && p2.status === "crashed" && (
            <text x={p2.player.pos.x} y={p2.player.pos.y + p2Offset + 5} textAnchor="middle" fontSize={15} fill="#ef4444" opacity={0.9}>✕</text>
          )}
        </svg>

        {/* ── Status overlays ── */}
        {(pvpState.overallStatus === "idle" || isPaused || isDone) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/65 backdrop-blur-[2px]">

            {pvpState.overallStatus === "idle" && (
              <>
                <div className="text-2xl font-black text-white tracking-tight">SPEED RACE</div>
                <div className="text-[10px] font-bold tracking-widest uppercase" style={{ color: P2_COLOR }}>Local PvP</div>
                <div className="flex flex-col items-center gap-0.5 mt-1 text-[10px] text-center">
                  <div>
                    <span className="font-bold" style={{ color: P1_COLOR }}>P1:</span>
                    {" "}← → zatočit · <span className="text-amber-300 font-bold">SPACE</span> nitro
                  </div>
                  <div>
                    <span className="font-bold" style={{ color: P2_COLOR }}>P2:</span>
                    {" "}A D zatočit · <span className="text-amber-300 font-bold">S</span> nitro
                  </div>
                </div>
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
                <div
                  className="text-3xl font-black"
                  style={{
                    color: pvpState.winner === "draw" ? "#94a3b8" : pvpState.winner === 1 ? P1_COLOR : P2_COLOR,
                    textShadow: pvpState.winner === 1 ? `0 0 20px ${P1_COLOR}` : pvpState.winner === 2 ? `0 0 20px ${P2_COLOR}` : "none",
                  }}
                >
                  {pvpState.winner === "draw" ? "REMÍZA"
                    : pvpState.winner === 1 ? "🏆 P1 VYHRÁL"
                    : "🏆 P2 VYHRÁL"}
                </div>
                <div className="flex gap-6 font-mono text-sm">
                  <span style={{ color: P1_COLOR }}>
                    P1: {p1.score} bodů {p1.status === "crashed" ? "💥" : "✅"}
                  </span>
                  <span style={{ color: P2_COLOR }}>
                    P2: {p2.score} bodů {p2.status === "crashed" ? "💥" : "✅"}
                  </span>
                </div>
                <div className="text-[10px] font-mono text-slate-500 text-center space-y-0.5">
                  <div>
                    stamina P1 −{p1Preview.total}
                    {p1Preview.nitroCost > 0 && <span className="text-amber-500"> (nitro −{p1Preview.nitroCost})</span>}
                    {p1Preview.crashPenalty > 0 && <span className="text-red-500"> (crash −{p1Preview.crashPenalty})</span>}
                  </div>
                  <div>
                    stamina P2 −{p2Preview.total}
                    {p2Preview.nitroCost > 0 && <span className="text-amber-500"> (nitro −{p2Preview.nitroCost})</span>}
                    {p2Preview.crashPenalty > 0 && <span className="text-red-500"> (crash −{p2Preview.crashPenalty})</span>}
                  </div>
                </div>
                <button
                  onClick={handleReset}
                  className="mt-1 rounded-lg bg-slate-700 px-5 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-600 transition"
                >
                  ↺ Reset
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── HUD ── */}
      <div className="w-full space-y-1.5 px-1">
        <div className="flex items-center justify-between text-[10px] font-mono text-slate-600">
          <span>tick {pvpState.tick}/{maxTicks}</span>
          <span>⚡×{p1.player.boostsHit} 🛢×{p1.player.slowsHit} P1 · P2 ⚡×{p2.player.boostsHit} 🛢×{p2.player.slowsHit}</span>
          <span className="font-bold text-slate-400">P1 {p1.score} · P2 {p2.score}</span>
        </div>

        {/* P1 nitro + speed */}
        <div className="flex items-center gap-2 text-[10px] font-mono">
          <span className="w-6 shrink-0" style={{ color: P1_COLOR }}>P1</span>
          {pvpState.overallStatus === "idle" ? (
            <span className="text-slate-600">SPACE (1× za hru, −20 stamina)</span>
          ) : pvpState.p1NitroUsed ? (
            <span className="text-slate-500">⚡ použito</span>
          ) : (
            <span className="text-amber-300 font-bold">⚡ ready — SPACE</span>
          )}
        </div>
        <PvpSpeedGauge velocity={p1.player.velocity} maxVelocity={maxVelocity} label="SPEED" color={P1_COLOR} />

        {/* P2 nitro + speed */}
        <div className="flex items-center gap-2 text-[10px] font-mono">
          <span className="w-6 shrink-0" style={{ color: P2_COLOR }}>P2</span>
          {pvpState.overallStatus === "idle" ? (
            <span className="text-slate-600">S (1× za hru, −20 stamina)</span>
          ) : pvpState.p2NitroUsed ? (
            <span className="text-slate-500">⚡ použito</span>
          ) : (
            <span className="text-amber-300 font-bold">⚡ ready — S</span>
          )}
        </div>
        <PvpSpeedGauge velocity={p2.player.velocity} maxVelocity={maxVelocity} label="SPEED" color={P2_COLOR} />

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
        {pvpState.overallStatus === "running" && (
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

      {/* ── Debug ── */}
      {showDebug && (
        <div className="w-full rounded-lg bg-slate-900 border border-slate-700 p-3 font-mono text-[10px] text-slate-400 space-y-0.5">
          <div>
            <span className="text-slate-600">status</span> <span className="text-white">{pvpState.overallStatus}</span>
            <span className="text-slate-600 ml-3">tick</span> {pvpState.tick}/{maxTicks}
            {isDone && <span className="text-amber-400 ml-3">winner: {pvpState.winner === "draw" ? "draw" : `P${pvpState.winner}`}</span>}
          </div>
          <div>
            <span className="text-slate-600">p1</span> <span style={{ color: P1_COLOR }}>{p1.status}</span>{" "}
            pos {p1.player.pos.x.toFixed(1)},{p1.player.pos.y.toFixed(1)}{" "}
            vel <span style={{ color: P1_COLOR }}>{p1.player.velocity.toFixed(2)}</span>{" "}
            <span className="text-slate-600">input</span> {lastInputs.p1}{" "}
            score <span className="text-white">{p1.score}</span>
          </div>
          <div>
            <span className="text-slate-600">p2</span> <span style={{ color: P2_COLOR }}>{p2.status}</span>{" "}
            pos {p2.player.pos.x.toFixed(1)},{p2.player.pos.y.toFixed(1)}{" "}
            vel <span style={{ color: P2_COLOR }}>{p2.player.velocity.toFixed(2)}</span>{" "}
            <span className="text-slate-600">input</span> {lastInputs.p2}{" "}
            score <span className="text-white">{p2.score}</span>
          </div>
          <div>
            <span className="text-slate-600">p1 nitro</span>{" "}
            <span className={pvpState.p1NitroUsed ? "text-slate-500" : "text-amber-300"}>{pvpState.p1NitroUsed ? "used" : "ready"}</span>
            <span className="text-slate-600 ml-3">p2 nitro</span>{" "}
            <span className={pvpState.p2NitroUsed ? "text-slate-500" : "text-amber-300"}>{pvpState.p2NitroUsed ? "used" : "ready"}</span>
          </div>
          {isDone && (
            <div className="text-slate-500">
              P1 stamina −{p1Preview.total} · P2 stamina −{p2Preview.total}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
