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

// ─── deterministic inline RNG (no mulberry32 needed for obstacle gen) ─────────

function detRand(seed: number): number {
  const s = ((seed * 9301 + 49297) % 233280);
  return s / 233280;
}

// ─── obstacle height tier ─────────────────────────────────────────────────────

const OBS_HEIGHTS = { low: 25, mid: 45, high: 65 } as const;
const OBS_WIDTH   = 26; // base of triangle

function obstacleHeight(r: number): number {
  if (r < 0.33) return OBS_HEIGHTS.low;
  if (r < 0.66) return OBS_HEIGHTS.mid;
  return OBS_HEIGHTS.high;
}

// ─── obstacle generation ──────────────────────────────────────────────────────

export function generateObstacles(config: LegendaryConfig, seed: number): Obstacle[] {
  const obstacles: Obstacle[] = [];
  const totalDistance = config.maxTicks * config.distancePerTick;
  const doubleGap = config.baseGap * 2;
  const spacingSmall = 40;

  let dist = config.baseGap;
  let id   = 0;

  while (dist < totalDistance * 0.93) {
    const r1 = detRand(seed + id * 7);
    const h  = obstacleHeight(r1);

    const r2 = detRand(seed + id * 7 + 3);
    const isDouble = r2 < config.doubleChance;

    if (isDouble) {
      // gap before double pair is doubleGap (already positioned)
      obstacles.push({ id: id++, distance: dist,                  height: h,                    width: OBS_WIDTH, p1Cleared: false, p2Cleared: false });
      const h2 = obstacleHeight(detRand(seed + id * 7));
      obstacles.push({ id: id++, distance: dist + spacingSmall,   height: h2,                   width: OBS_WIDTH, p1Cleared: false, p2Cleared: false });
      dist += doubleGap + spacingSmall;
    } else {
      obstacles.push({ id: id++, distance: dist, height: h, width: OBS_WIDTH, p1Cleared: false, p2Cleared: false });
      dist += config.baseGap + Math.floor(detRand(seed + id * 13) * config.obstacleVariance);
    }
  }

  return obstacles;
}

// ─── initial state ─────────────────────────────────────────────────────────────

const INIT_PLAYER: PlayerRunnerState = {
  jumpStartTick:    -1,
  jumpTick:          0,
  lastJumpTick:     -9999,
  distance:          0,
  score:             0,
  obstaclesCleared:  0,
  crashes:           0,
  stumbleUntilTick: -1,
  hitFlashUntilTick: -1,
};

export function createInitialState(config: LegendaryConfig): LegendaryState {
  const seed = Math.floor(Math.random() * 0xffffff);
  return {
    tick:      0,
    status:    "idle",
    winner:    null,
    p1:        { ...INIT_PLAYER },
    p2:        { ...INIT_PLAYER },
    obstacles: generateObstacles(config, seed),
    seed,
  };
}

// ─── jump height (exported for renderer) ──────────────────────────────────────
// Returns 0-1 parabola. Scale by config.jumpMaxHeight in renderer.

export function getJumpHeight(
  player: Pick<PlayerRunnerState, "jumpStartTick" | "jumpTick">,
  _tick: number,
  config: LegendaryConfig
): number {
  if (player.jumpStartTick < 0) return 0;
  const progress = player.jumpTick / config.jumpDuration;
  if (progress <= 0 || progress >= 1) return 0;
  return 4 * progress * (1 - progress); // 0 → 1 → 0
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

  // 1. Jump start
  const canJump =
    !isStumbling &&
    p.jumpStartTick < 0 &&
    tick - p.lastJumpTick >= config.jumpCooldown;
  if (jumpPressed && canJump) {
    p = { ...p, jumpStartTick: tick, jumpTick: 0, lastJumpTick: tick };
  }

  // 2. Advance jumpTick + landing
  if (p.jumpStartTick >= 0) {
    const nextJumpTick = p.jumpTick + 1;
    if (nextJumpTick >= config.jumpDuration) {
      p = { ...p, jumpStartTick: -1, jumpTick: 0 };
    } else {
      p = { ...p, jumpTick: nextJumpTick };
    }
  }

  // 3. In air this tick?
  const inAir = p.jumpStartTick >= 0;
  const jumpHeightFrac = inAir ? 4 * (p.jumpTick / config.jumpDuration) * (1 - p.jumpTick / config.jumpDuration) : 0;
  const jumpHeightPx   = jumpHeightFrac * config.jumpMaxHeight;

  // 4. Distance movement
  const prevDistance = p.distance;
  const distInc = isStumbling ? 1 : config.distancePerTick;
  p = { ...p, distance: p.distance + distInc, score: p.score + distInc };

  // 5. Obstacle crossings: prevDistance < obstacle.distance <= p.distance
  const clearanceMargin = 5;
  const updatedObstacles = (obstacles as Obstacle[]).map((o): Obstacle => {
    if (o[playerKey]) return o;
    if (o.distance > prevDistance && o.distance <= p.distance) {
      // playerHeight = how high the BOTTOM of the player is above ground
      const playerHeightAboveGround = jumpHeightPx;
      if (playerHeightAboveGround >= o.height - clearanceMargin) {
        // cleared
        p = { ...p, obstaclesCleared: p.obstaclesCleared + 1, score: p.score + config.clearBonus };
        return { ...o, [playerKey]: true };
      } else {
        // crash
        p = {
          ...p,
          crashes:           p.crashes + 1,
          score:             Math.max(0, p.score - config.crashPenalty),
          stumbleUntilTick:  tick + config.stumbleDuration,
          hitFlashUntilTick: tick + 4, // ~4 ticks ≈ 150ms at 40ms tick
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
    tick:      nextTick,
    status:    finished ? "finished" : "running",
    winner,
    p1:        nextP1,
    p2:        nextP2,
    obstacles: obs2,
  };
}
