import type { AbsDir, Dir, DuelConfig, DuelState, PlayerDuelState, Vec2 } from "./types";
import {
  getRopeDuelStartDelayTicks,
  getRopeDuelNitroDashTiles,
  getRopeDuelNitroCooldownTicks,
} from "./helpers";

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

export function createInitialState(config: DuelConfig, p1Speed = 5, p2Speed = 5): DuelState {
  const { gridW, gridH } = config;
  const midY = Math.floor(gridH / 2);
  const p1x  = Math.floor(gridW / 4);
  const p2x  = Math.floor((gridW * 3) / 4);
  return {
    tick:   0,
    status: "idle",
    winner: null,
    p1: {
      pos: { x: p1x, y: midY }, dir: "right", trail: [{ x: p1x, y: midY }],
      alive: true, ticksAlive: 0,
      nitroTicksRemaining: 0, nitroUsed: false, nitroActivations: 0,
      nitroCooldownTicksRemaining: 0,
      nitroCooldownPerUse: getRopeDuelNitroCooldownTicks(p1Speed),
      startDelayTicksRemaining: getRopeDuelStartDelayTicks(p1Speed),
      nitroDashTiles: getRopeDuelNitroDashTiles(p1Speed, gridW),
    },
    p2: {
      pos: { x: p2x, y: midY }, dir: "left",  trail: [{ x: p2x, y: midY }],
      alive: true, ticksAlive: 0,
      nitroTicksRemaining: 0, nitroUsed: false, nitroActivations: 0,
      nitroCooldownTicksRemaining: 0,
      nitroCooldownPerUse: getRopeDuelNitroCooldownTicks(p2Speed),
      startDelayTicksRemaining: getRopeDuelStartDelayTicks(p2Speed),
      nitroDashTiles: getRopeDuelNitroDashTiles(p2Speed, gridW),
    },
  };
}

// ── Tick simulation ───────────────────────────────────────────────────────────

export function applyTick(
  state: DuelState,
  p1Input: Dir,
  p2Input: Dir,
  config: DuelConfig,
  p1ActivateNitro = false,
  p2ActivateNitro = false,
): DuelState {
  if (state.status !== "running") return state;

  const { gridW, gridH, maxTicks } = config;
  const newTick = state.tick + 1;

  // ── Start delay ──────────────────────────────────────────────────────────────
  const p1InDelay = state.p1.startDelayTicksRemaining > 0;
  const p2InDelay = state.p2.startDelayTicksRemaining > 0;

  // ── Nitro / boost activation (reusable, guarded by active dash + cooldown) ──
  // Works identically for regular and legendary racers; speed-based values baked
  // into nitroDashTiles and nitroCooldownPerUse at state creation.

  const p1CanActivate = p1ActivateNitro
    && !p1InDelay
    && state.p1.nitroTicksRemaining === 0
    && state.p1.nitroCooldownTicksRemaining === 0;

  const p2CanActivate = p2ActivateNitro
    && !p2InDelay
    && state.p2.nitroTicksRemaining === 0
    && state.p2.nitroCooldownTicksRemaining === 0;

  const p1NitroActive = p1CanActivate || state.p1.nitroTicksRemaining > 0;
  const p2NitroActive = p2CanActivate || state.p2.nitroTicksRemaining > 0;

  const p1NitroNext = p1CanActivate
    ? state.p1.nitroDashTiles - 1
    : Math.max(0, state.p1.nitroTicksRemaining - 1);
  const p2NitroNext = p2CanActivate
    ? state.p2.nitroDashTiles - 1
    : Math.max(0, state.p2.nitroTicksRemaining - 1);

  // Cooldown counts down every tick regardless of dash state.
  const p1CooldownNext = p1CanActivate
    ? state.p1.nitroCooldownPerUse
    : Math.max(0, state.p1.nitroCooldownTicksRemaining - 1);
  const p2CooldownNext = p2CanActivate
    ? state.p2.nitroCooldownPerUse
    : Math.max(0, state.p2.nitroCooldownTicksRemaining - 1);

  // ── Step 1: standard simultaneous movement ──────────────────────────────────
  const p1dir  = p1InDelay ? state.p1.dir : turn(state.p1.dir, p1Input);
  const p2dir  = p2InDelay ? state.p2.dir : turn(state.p2.dir, p2Input);
  const p1next = p1InDelay ? state.p1.pos : step(state.p1.pos, p1dir);
  const p2next = p2InDelay ? state.p2.pos : step(state.p2.pos, p2dir);

  const p1crash1 = !p1InDelay && (
    outOfBounds(p1next, gridW, gridH) ||
    hits(p1next, state.p1.trail) ||
    hits(p1next, state.p2.trail)
  );
  const p2crash1 = !p2InDelay && (
    outOfBounds(p2next, gridW, gridH) ||
    hits(p2next, state.p2.trail) ||
    hits(p2next, state.p1.trail)
  );
  const headOn = !p1InDelay && !p2InDelay && p1next.x === p2next.x && p1next.y === p2next.y;

  let p1alive = !p1crash1 && !headOn;
  let p2alive = !p2crash1 && !headOn;

  let newP1: PlayerDuelState = {
    pos:   p1alive ? p1next : state.p1.pos,
    dir:   p1dir,
    trail: p1alive && !p1InDelay ? [...state.p1.trail, p1next] : state.p1.trail,
    alive: p1alive,
    ticksAlive: state.p1.ticksAlive + (p1alive ? 1 : 0),
    nitroTicksRemaining: p1NitroNext,
    nitroUsed: state.p1.nitroUsed || p1CanActivate,
    nitroActivations: state.p1.nitroActivations + (p1CanActivate ? 1 : 0),
    nitroCooldownTicksRemaining: p1CooldownNext,
    nitroCooldownPerUse: state.p1.nitroCooldownPerUse,
    startDelayTicksRemaining: p1InDelay ? state.p1.startDelayTicksRemaining - 1 : 0,
    nitroDashTiles: state.p1.nitroDashTiles,
  };
  let newP2: PlayerDuelState = {
    pos:   p2alive ? p2next : state.p2.pos,
    dir:   p2dir,
    trail: p2alive && !p2InDelay ? [...state.p2.trail, p2next] : state.p2.trail,
    alive: p2alive,
    ticksAlive: state.p2.ticksAlive + (p2alive ? 1 : 0),
    nitroTicksRemaining: p2NitroNext,
    nitroUsed: state.p2.nitroUsed || p2CanActivate,
    nitroActivations: state.p2.nitroActivations + (p2CanActivate ? 1 : 0),
    nitroCooldownTicksRemaining: p2CooldownNext,
    nitroCooldownPerUse: state.p2.nitroCooldownPerUse,
    startDelayTicksRemaining: p2InDelay ? state.p2.startDelayTicksRemaining - 1 : 0,
    nitroDashTiles: state.p2.nitroDashTiles,
  };

  // ── Early exit when normal step already decided winner ──────────────────────
  if (!p1alive || !p2alive) {
    const status: DuelState["status"] = (!p1alive && !p2alive) ? "draw" : !p1alive ? "p2_win" : "p1_win";
    const winner: DuelState["winner"] = (!p1alive && !p2alive) ? null : !p1alive ? 2 : 1;
    return { tick: newTick, status, winner, p1: newP1, p2: newP2 };
  }

  // ── Extra step for P1 (nitro/boost active) ───────────────────────────────────
  if (p1alive && p1NitroActive) {
    const extra = step(newP1.pos, newP1.dir);
    if (
      outOfBounds(extra, gridW, gridH) ||
      hits(extra, newP1.trail) ||
      hits(extra, newP2.trail)
    ) {
      p1alive = false;
      newP1 = { ...newP1, alive: false };
    } else {
      newP1 = { ...newP1, pos: extra, trail: [...newP1.trail, extra] };
    }
  }

  // ── Extra step for P2 (checks P1 trail after P1 extra step) ────────────────
  if (p2alive && p2NitroActive) {
    const extra = step(newP2.pos, newP2.dir);
    if (
      outOfBounds(extra, gridW, gridH) ||
      hits(extra, newP2.trail) ||
      hits(extra, newP1.trail)
    ) {
      p2alive = false;
      newP2 = { ...newP2, alive: false };
    } else {
      newP2 = { ...newP2, pos: extra, trail: [...newP2.trail, extra] };
    }
  }

  // ── Determine outcome ───────────────────────────────────────────────────────
  let status: DuelState["status"] = "running";
  let winner: DuelState["winner"] = null;

  if (!p1alive && !p2alive) {
    status = "draw";
  } else if (!p1alive) {
    status = "p2_win"; winner = 2;
  } else if (!p2alive) {
    status = "p1_win"; winner = 1;
  } else if (newTick >= maxTicks) {
    const diff = newP1.ticksAlive - newP2.ticksAlive;
    status = diff > 0 ? "p1_win" : diff < 0 ? "p2_win" : "draw";
    winner = diff > 0 ? 1 : diff < 0 ? 2 : null;
  }

  return { tick: newTick, status, winner, p1: newP1, p2: newP2 };
}

// ── Bot direction ─────────────────────────────────────────────────────────────

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

    let score = 1;
    let pos = next;
    let facing = newFacing;
    for (let i = 0; i < 10; i++) {
      const ahead = step(pos, facing);
      if (outOfBounds(ahead, config.gridW, config.gridH) || hits(ahead, combined)) break;
      score++;
      pos = ahead;
      facing = facing;
    }
    if (score > bestScore) { bestScore = score; bestDir = d; }
  }

  return bestDir;
}

// ── Bot nitro activation ──────────────────────────────────────────────────────

export function getBotNitroActivate(state: DuelState, player: 1 | 2, config: DuelConfig): boolean {
  const p   = player === 1 ? state.p1 : state.p2;
  const opp = player === 1 ? state.p2 : state.p1;

  if (!p.alive) return false;
  if (p.startDelayTicksRemaining > 0) return false;
  if (p.nitroTicksRemaining > 0) return false;
  if (p.nitroCooldownTicksRemaining > 0) return false;
  if (p.nitroActivations >= 1) return false; // bot smí nitro použít max 1× za duel

  // Only boost if there are at least nitroDashTiles clear cells straight ahead.
  const combined = [...p.trail, ...opp.trail];
  let pos = p.pos;
  let clearAhead = 0;
  for (let i = 0; i < p.nitroDashTiles + 2; i++) {
    const next = step(pos, p.dir);
    if (outOfBounds(next, config.gridW, config.gridH) || hits(next, combined)) break;
    clearAhead++;
    pos = next;
  }
  if (clearAhead < p.nitroDashTiles) return false;

  return Math.random() < 0.6;
}
