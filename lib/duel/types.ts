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
  readonly nitroTicksRemaining: number; // ticks of extra step left (>0 = active)
  readonly nitroUsed: boolean;          // true once activated; for stamina preview
  readonly startDelayTicksRemaining: number; // ticks of immobility at game start
  readonly nitroDashTiles: number;           // extra tiles per nitro activation (speed-based)
  readonly legendaryDashRemaining: number;   // ticks of extra step from legendary ability (reusable)
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
