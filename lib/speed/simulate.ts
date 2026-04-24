import type {
  SpeedConfig, SpeedInput, SpeedObject, SpeedPlayerState, SpeedState,
} from "./types";

// ── Constants ─────────────────────────────────────────────────────────────────

const PLAYER_RADIUS = 9;

// ── Helpers ───────────────────────────────────────────────────────────────────

function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// Deterministic pseudo-random in [0, 1) — no Math.random() for pure function
function prng(seed: number): number {
  const x = Math.sin(seed * 9301.0 + 49297.0) * 233280.0;
  return x - Math.floor(x);
}

function normalizeAngle(a: number): number {
  while (a >  Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

function computeScore(p: SpeedPlayerState, finished: boolean): number {
  return Math.round(
    p.ticksAlive
    + p.boostsHit * 30
    - p.slowsHit * 10
    - p.wallBounces * 5
    + (finished ? 60 : 0),
  );
}

// ── Object layout ─────────────────────────────────────────────────────────────

function createObjects(w: number, h: number): SpeedObject[] {
  const boosts: Array<[number, number]> = [
    [0.2, 0.25], [0.8, 0.25],
    [0.5, 0.50],
    [0.2, 0.75], [0.8, 0.75],
  ];
  const slows: Array<[number, number]> = [
    [0.5, 0.20],
    [0.35, 0.50], [0.65, 0.50],
    [0.5, 0.80],
  ];

  const objects: SpeedObject[] = [];
  boosts.forEach(([rx, ry], i) => objects.push({
    id: `boost_${i}`, kind: "boost",
    pos: { x: rx * w, y: ry * h }, radius: 20,
    active: true, cooldownTick: null,
  }));
  slows.forEach(([rx, ry], i) => objects.push({
    id: `slow_${i}`, kind: "slow",
    pos: { x: rx * w, y: ry * h }, radius: 18,
    active: true, cooldownTick: null,
  }));
  return objects;
}

// ── State factory ─────────────────────────────────────────────────────────────

export function createInitialState(config: SpeedConfig): SpeedState {
  const { arenaW, arenaH } = config;
  return {
    tick:   0,
    status: "idle",
    score:  0,
    lastInput: "none",
    objects: createObjects(arenaW, arenaH),
    player: {
      pos:             { x: arenaW * 0.18, y: arenaH * 0.5 },
      angle:           0,            // facing right
      velocity:        2.0,
      ticksAlive:      0,
      distanceTraveled: 0,
      boostsHit:       0,
      slowsHit:        0,
      wallBounces:     0,
    },
  };
}

// ── Tick ──────────────────────────────────────────────────────────────────────

export function applyTick(state: SpeedState, input: SpeedInput, config: SpeedConfig): SpeedState {
  if (state.status !== "running") return state;

  const { arenaW, arenaH, acceleration, maxVelocity, turnRate,
          crashVelocityThreshold, boostStrength, slowStrength,
          objectRespawnTicks, maxTicks } = config;

  const p = state.player;
  const newTick = state.tick + 1;

  // 1. Turn
  const turn = input === "left" ? -turnRate : input === "right" ? turnRate : 0;
  let angle = normalizeAngle(p.angle + turn);

  // 2. Accelerate
  const velocity = Math.min(maxVelocity, p.velocity + acceleration);

  // 3. Move
  let px = p.pos.x + Math.cos(angle) * velocity;
  let py = p.pos.y + Math.sin(angle) * velocity;

  // 4. Wall collision
  let reflectX = false;
  let reflectY = false;
  let crashed  = false;

  if (px <= PLAYER_RADIUS) {
    if (velocity >= crashVelocityThreshold) { crashed = true; }
    else { px = PLAYER_RADIUS; reflectX = true; }
  } else if (px >= arenaW - PLAYER_RADIUS) {
    if (velocity >= crashVelocityThreshold) { crashed = true; }
    else { px = arenaW - PLAYER_RADIUS; reflectX = true; }
  }
  if (py <= PLAYER_RADIUS) {
    if (velocity >= crashVelocityThreshold) { crashed = true; }
    else { py = PLAYER_RADIUS; reflectY = true; }
  } else if (py >= arenaH - PLAYER_RADIUS) {
    if (velocity >= crashVelocityThreshold) { crashed = true; }
    else { py = arenaH - PLAYER_RADIUS; reflectY = true; }
  }

  if (crashed) {
    const crashedPlayer: SpeedPlayerState = { ...p, ticksAlive: p.ticksAlive + 1 };
    return {
      ...state,
      tick: newTick,
      status: "crashed",
      score: computeScore(crashedPlayer, false),
      player: crashedPlayer,
      lastInput: input,
    };
  }

  const wallBounce = reflectX || reflectY;
  if (reflectX) angle = normalizeAngle(Math.PI - angle);
  if (reflectY) angle = normalizeAngle(-angle);
  const bouncedVelocity = wallBounce ? velocity * 0.55 : velocity;

  // 5. Object interactions
  let currentVelocity = bouncedVelocity;
  let boostsHit = p.boostsHit;
  let slowsHit  = p.slowsHit;
  const pos = { x: px, y: py };

  const updatedObjects: SpeedObject[] = state.objects.map(obj => {
    // Respawn check
    if (!obj.active && obj.cooldownTick !== null
        && newTick - obj.cooldownTick >= objectRespawnTicks) {
      return { ...obj, active: true, cooldownTick: null };
    }

    // Collision check
    if (obj.active && dist(pos, obj.pos) <= PLAYER_RADIUS + obj.radius) {
      if (obj.kind === "boost") {
        currentVelocity = Math.min(maxVelocity, currentVelocity + boostStrength);
        boostsHit += 1;
      } else {
        currentVelocity = Math.max(1.0, currentVelocity - slowStrength);
        // Deterministic wobble — avoids Math.random() in pure function
        const wobble = (prng(newTick + slowsHit * 7) - 0.5) * 0.28;
        angle = normalizeAngle(angle + wobble);
        slowsHit += 1;
      }
      return { ...obj, active: false, cooldownTick: newTick };
    }

    return obj;
  });

  // 6. Update player
  const distance = dist({ x: p.pos.x, y: p.pos.y }, pos);
  const updatedPlayer: SpeedPlayerState = {
    pos:              { x: px, y: py },
    angle,
    velocity:         currentVelocity,
    ticksAlive:       p.ticksAlive + 1,
    distanceTraveled: p.distanceTraveled + distance,
    boostsHit,
    slowsHit,
    wallBounces:      p.wallBounces + (wallBounce ? 1 : 0),
  };

  // 7. Check time limit
  const finished = newTick >= maxTicks;
  const status = finished ? "finished" : "running";
  const score = finished ? computeScore(updatedPlayer, true) : computeScore(updatedPlayer, false);

  return {
    tick:      newTick,
    status,
    score,
    lastInput: input,
    objects:   updatedObjects,
    player:    updatedPlayer,
  };
}
