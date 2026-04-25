/**
 * lib/legendary/simulate.ts — čisté pure functions bez Reactu ani Supabase.
 */

import type {
  LegendaryConfig,
  LegendaryInput,
  LegendaryState,
  Obstacle,
  PlayerRunnerState,
} from "./types";

// ─── deterministický RNG (mulberry32) ─────────────────────────────────────────

function mulberry32(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── generování překážek ───────────────────────────────────────────────────────

function generateObstacles(config: LegendaryConfig, seed: number): Obstacle[] {
  const rand = mulberry32(seed);
  const totalDistance = config.maxTicks * config.distancePerTick;
  const obstacles: Obstacle[] = [];
  let dist = config.obstacleInterval + Math.floor(rand() * config.obstacleVariance);
  let id = 0;
  while (dist < totalDistance * 0.93) {
    obstacles.push({ id: id++, distance: dist, p1Cleared: false, p2Cleared: false });
    dist += config.obstacleInterval + Math.floor(rand() * config.obstacleVariance);
  }
  return obstacles;
}

// ─── initial state ─────────────────────────────────────────────────────────────

const INIT_PLAYER: PlayerRunnerState = {
  jumpStartTick: -1,
  lastJumpTick: -9999,
  distance: 0,
  score: 0,
  obstaclesCleared: 0,
  crashes: 0,
  stumbleUntilTick: -1,
};

export function createInitialState(config: LegendaryConfig): LegendaryState {
  const seed = Math.floor(Math.random() * 0xffffff);
  return {
    tick: 0,
    status: "idle",
    winner: null,
    p1: { ...INIT_PLAYER },
    p2: { ...INIT_PLAYER },
    obstacles: generateObstacles(config, seed),
    seed,
  };
}

// ─── jump visualisation helper (exportováno pro arena renderer) ───────────────

export function getJumpHeight(player: PlayerRunnerState, tick: number, config: LegendaryConfig): number {
  if (player.jumpStartTick < 0) return 0;
  const progress = (tick - player.jumpStartTick) / config.jumpDuration;
  if (progress <= 0 || progress >= 1) return 0;
  return Math.sin(progress * Math.PI);  // 0–1, peak at 0.5
}

// ─── per-player tick ───────────────────────────────────────────────────────────

function applyPlayerTick(
  player: PlayerRunnerState,
  jumpPressed: boolean,
  obstacles: readonly Obstacle[],
  playerKey: "p1Cleared" | "p2Cleared",
  tick: number,
  config: LegendaryConfig
): { player: PlayerRunnerState; obstacles: Obstacle[] } {
  let p = { ...player };

  const isStumbling = tick < p.stumbleUntilTick;

  // 1. Start new jump?
  const canJump =
    !isStumbling &&
    p.jumpStartTick < 0 &&
    tick - p.lastJumpTick >= config.jumpCooldown;
  if (jumpPressed && canJump) {
    p = { ...p, jumpStartTick: tick, lastJumpTick: tick };
  }

  // 2. Landing?
  if (p.jumpStartTick >= 0 && tick - p.jumpStartTick >= config.jumpDuration) {
    p = { ...p, jumpStartTick: -1 };
  }

  // 3. In air this tick?
  const inAir = p.jumpStartTick >= 0;

  // 4. Distance movement
  const prevDistance = p.distance;
  const distInc = isStumbling ? 1 : config.distancePerTick;
  p = { ...p, distance: p.distance + distInc, score: p.score + distInc };

  // 5. Obstacle crossings: prevDistance < obstacle.distance <= p.distance
  const updatedObstacles = obstacles.map((o): Obstacle => {
    if (o[playerKey]) return o;
    if (o.distance > prevDistance && o.distance <= p.distance) {
      if (inAir) {
        p = { ...p, obstaclesCleared: p.obstaclesCleared + 1, score: p.score + config.clearBonus };
        return { ...o, [playerKey]: true };
      } else {
        p = {
          ...p,
          crashes: p.crashes + 1,
          score: Math.max(0, p.score - config.crashPenalty),
          stumbleUntilTick: tick + config.stumbleDuration,
        };
        return { ...o, [playerKey]: true };
      }
    }
    return o;
  });

  return { player: p, obstacles: updatedObstacles };
}

// ─── main tick ─────────────────────────────────────────────────────────────────

export function applyTick(
  state: LegendaryState,
  input: LegendaryInput,
  config: LegendaryConfig
): LegendaryState {
  if (state.status !== "running") return state;

  const nextTick = state.tick + 1;

  const { player: nextP1, obstacles: obs1 } = applyPlayerTick(
    state.p1, input.p1Jump, state.obstacles, "p1Cleared", nextTick, config
  );
  const { player: nextP2, obstacles: obs2 } = applyPlayerTick(
    state.p2, input.p2Jump, obs1, "p2Cleared", nextTick, config
  );

  const finished = nextTick >= config.maxTicks;
  let winner: LegendaryState["winner"] = null;
  if (finished) {
    if (nextP1.score > nextP2.score) winner = 1;
    else if (nextP2.score > nextP1.score) winner = 2;
    else winner = "draw";
  }

  return {
    ...state,
    tick: nextTick,
    status: finished ? "finished" : "running",
    winner,
    p1: nextP1,
    p2: nextP2,
    obstacles: obs2,
  };
}
