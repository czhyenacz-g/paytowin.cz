import type { AbsDir, Dir, DuelConfig, DuelState, PlayerDuelState, Vec2 } from "./types";

// ── Direction helpers ─────────────────────────────────────────────────────────

const LEFT_TURN: Record<AbsDir, AbsDir> = {
  up: "left", left: "down", down: "right", right: "up",
};
const RIGHT_TURN: Record<AbsDir, AbsDir> = {
  up: "right", right: "down", down: "left", left: "up",
};
const DELTA: Record<AbsDir, Vec2> = {
  up:    { x:  0, y: -1 },
  down:  { x:  0, y:  1 },
  left:  { x: -1, y:  0 },
  right: { x:  1, y:  0 },
};

export function turn(facing: AbsDir, input: Dir): AbsDir {
  if (input === "straight") return facing;
  return input === "left" ? LEFT_TURN[facing] : RIGHT_TURN[facing];
}

export function step(pos: Vec2, facing: AbsDir): Vec2 {
  const d = DELTA[facing];
  return { x: pos.x + d.x, y: pos.y + d.y };
}

export function outOfBounds(pos: Vec2, w: number, h: number): boolean {
  return pos.x < 0 || pos.x >= w || pos.y < 0 || pos.y >= h;
}

export function hits(pos: Vec2, trail: readonly Vec2[]): boolean {
  return trail.some(t => t.x === pos.x && t.y === pos.y);
}

// ── State factory ─────────────────────────────────────────────────────────────

export function createInitialState(config: DuelConfig): DuelState {
  const { gridW, gridH } = config;
  const midY = Math.floor(gridH / 2);
  const p1x  = Math.floor(gridW / 4);
  const p2x  = Math.floor((gridW * 3) / 4);
  return {
    tick:   0,
    status: "idle",
    winner: null,
    p1: { pos: { x: p1x, y: midY }, dir: "right", trail: [{ x: p1x, y: midY }], alive: true, ticksAlive: 0 },
    p2: { pos: { x: p2x, y: midY }, dir: "left",  trail: [{ x: p2x, y: midY }], alive: true, ticksAlive: 0 },
  };
}

// ── Tick simulation ───────────────────────────────────────────────────────────

export function applyTick(
  state: DuelState,
  p1Input: Dir,
  p2Input: Dir,
  config: DuelConfig,
): DuelState {
  if (state.status !== "running") return state;

  const { gridW, gridH, maxTicks } = config;

  const p1dir = turn(state.p1.dir, p1Input);
  const p2dir = turn(state.p2.dir, p2Input);
  const p1next = step(state.p1.pos, p1dir);
  const p2next = step(state.p2.pos, p2dir);

  // Collision checks (trail includes current head position)
  const p1crash =
    outOfBounds(p1next, gridW, gridH) ||
    hits(p1next, state.p1.trail) ||
    hits(p1next, state.p2.trail);
  const p2crash =
    outOfBounds(p2next, gridW, gridH) ||
    hits(p2next, state.p2.trail) ||
    hits(p2next, state.p1.trail);

  // Head-on: both move to the same cell
  const headOn = p1next.x === p2next.x && p1next.y === p2next.y;

  const newTick = state.tick + 1;

  // Determine outcome
  let status: DuelState["status"] = state.status;
  let winner: DuelState["winner"] = state.winner;

  if ((p1crash && p2crash) || headOn) {
    status = "draw";
  } else if (p1crash) {
    status = "p2_win"; winner = 2;
  } else if (p2crash) {
    status = "p1_win"; winner = 1;
  } else if (newTick >= maxTicks) {
    // Time limit: more ticks alive wins; tie = draw
    const diff = state.p1.ticksAlive - state.p2.ticksAlive;
    status = diff > 0 ? "p1_win" : diff < 0 ? "p2_win" : "draw";
    winner = diff > 0 ? 1 : diff < 0 ? 2 : null;
  }

  const p1alive = status === "running" && !p1crash && !headOn;
  const p2alive = status === "running" && !p2crash && !headOn;

  const advancePlayer = (
    p: PlayerDuelState,
    dir: AbsDir,
    next: Vec2,
    alive: boolean,
  ): PlayerDuelState => ({
    pos:       alive ? next : p.pos,
    dir,
    trail:     alive ? [...p.trail, next] : p.trail,
    alive,
    ticksAlive: p.ticksAlive + (alive ? 1 : 0),
  });

  return {
    tick: newTick,
    status,
    winner,
    p1: advancePlayer(state.p1, p1dir, p1next, p1alive),
    p2: advancePlayer(state.p2, p2dir, p2next, p2alive),
  };
}

// ── Bot ───────────────────────────────────────────────────────────────────────

// Simple lookahead bot: picks direction with most open space ahead.
export function getBotInput(state: DuelState, player: 1 | 2, config: DuelConfig): Dir {
  const p   = player === 1 ? state.p1 : state.p2;
  const opp = player === 1 ? state.p2 : state.p1;
  const combined = [...p.trail, ...opp.trail];

  const options: Dir[] = ["straight", "left", "right"];
  let bestDir: Dir = "straight";
  let bestScore = -1;

  for (const d of options) {
    const newFacing = turn(p.dir, d);
    const next = step(p.pos, newFacing);
    if (outOfBounds(next, config.gridW, config.gridH) || hits(next, combined)) continue;

    // Count cells reachable going straight from this new position (simple 1D lookahead)
    let score = 1;
    let pos = next;
    let facing = newFacing;
    for (let i = 0; i < 10; i++) {
      const ahead = step(pos, facing);
      if (outOfBounds(ahead, config.gridW, config.gridH) || hits(ahead, combined)) break;
      score++;
      pos = ahead;
      facing = facing; // keep straight
    }
    if (score > bestScore) { bestScore = score; bestDir = d; }
  }

  return bestDir;
}
