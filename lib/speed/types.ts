export type SpeedInput  = "left" | "right" | "none";
export type SpeedStatus = "idle" | "running" | "crashed" | "finished";

export interface Vec2 {
  readonly x: number;
  readonly y: number;
}

export interface SpeedObject {
  readonly id: string;
  readonly kind: "boost" | "slow";
  readonly pos: Vec2;
  readonly radius: number;
  readonly active: boolean;
  readonly cooldownTick: number | null; // tick when consumed; null = never consumed
}

export interface SpeedPlayerState {
  readonly pos: Vec2;
  readonly angle: number;           // radians, 0 = right, π/2 = down (SVG y-axis)
  readonly velocity: number;        // units per tick
  readonly ticksAlive: number;
  readonly distanceTraveled: number;
  readonly boostsHit: number;
  readonly slowsHit: number;
  readonly wallBounces: number;
}

export interface SpeedState {
  readonly tick: number;
  readonly player: SpeedPlayerState;
  readonly objects: readonly SpeedObject[];
  readonly status: SpeedStatus;
  readonly score: number;
  readonly lastInput: SpeedInput;
}

export interface SpeedConfig {
  readonly arenaW: number;
  readonly arenaH: number;
  readonly maxTicks: number;
  readonly tickMs: number;
  readonly acceleration: number;           // velocity gain per tick
  readonly maxVelocity: number;
  readonly turnRate: number;               // radians per tick
  readonly crashVelocityThreshold: number; // wall hit at >= this speed → crash
  readonly boostStrength: number;          // velocity added by boost pad
  readonly slowStrength: number;           // velocity removed by slow patch
  readonly objectRespawnTicks: number;     // ticks until inactive object reactivates
}
