export type Dir = "left" | "right" | "straight";
export type AbsDir = "up" | "down" | "left" | "right";
export type DuelStatus = "idle" | "running" | "p1_win" | "p2_win" | "draw";

export interface Vec2 {
  readonly x: number;
  readonly y: number;
}

export interface PlayerDuelState {
  readonly pos: Vec2;
  readonly dir: AbsDir;
  readonly trail: readonly Vec2[];
  readonly alive: boolean;
  readonly ticksAlive: number;
  readonly nitroTicksRemaining: number;         // ticks of extra step left (>0 = boost active)
  readonly nitroUsed: boolean;                  // ever activated; kept for UI compat
  readonly nitroActivations: number;            // total count of activations this game
  readonly nitroCooldownTicksRemaining: number; // ticks until next activation allowed
  readonly nitroCooldownPerUse: number;         // cooldown to reset after each activation (speed-based)
  readonly startDelayTicksRemaining: number;    // ticks of immobility at game start
  readonly nitroDashTiles: number;              // extra tiles per nitro activation (speed-based)
}

export interface DuelState {
  readonly tick: number;
  readonly p1: PlayerDuelState;
  readonly p2: PlayerDuelState;
  readonly status: DuelStatus;
  readonly winner: 1 | 2 | null;
}

export interface DuelConfig {
  readonly gridW: number;
  readonly gridH: number;
  readonly maxTicks: number;
  readonly tickMs: number;
}
