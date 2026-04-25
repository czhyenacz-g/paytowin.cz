/**
 * lib/legendary/types.ts — typy pro Legendary Horse Race minihru.
 */

export interface LegendaryConfig {
  arenaW: number;
  arenaH: number;
  maxTicks: number;
  tickMs: number;
  obstacleInterval: number;   // base vzdálenost mezi překážkami (px)
  obstacleVariance: number;   // max náhodný přídavek k intervalu
  jumpDuration: number;       // ticky ve vzduchu
  jumpCooldown: number;       // min tiky mezi skoky
  stumbleDuration: number;    // tiky zakopnutí po nárazu
  crashPenalty: number;       // ztráta skóre za náraz
  clearBonus: number;         // bonus za překonanou překážku
  distancePerTick: number;    // vzdálenost za tick (při normální rychlosti)
  jumpMaxHeight: number;      // max px výšky skoku
  baseGap: number;            // minimální mezera mezi překážkami (px)
  doubleChance: number;       // pravděpodobnost double překážky 0–1
}

export interface Obstacle {
  readonly id: number;
  readonly distance: number;  // vzdálenost, při které překážka "nastane"
  readonly height: number;    // výška překážky v px
  readonly width: number;     // šířka základny překážky v px
  p1Cleared: boolean;
  p2Cleared: boolean;
}

export interface PlayerRunnerState {
  readonly jumpStartTick: number;    // tick zahájení skoku; -1 = na zemi
  readonly jumpTick: number;         // počet ticků od startu skoku (0-based)
  readonly lastJumpTick: number;     // pro cooldown výpočet
  readonly distance: number;
  readonly score: number;
  readonly obstaclesCleared: number;
  readonly crashes: number;
  readonly stumbleUntilTick: number; // stumbling pokud tick < tento
  readonly hitFlashUntilTick: number; // červený flash po nárazu
}

export interface LegendaryState {
  readonly tick: number;
  readonly status: "idle" | "running" | "finished";
  readonly winner: 1 | 2 | "draw" | null;
  readonly p1: PlayerRunnerState;
  readonly p2: PlayerRunnerState;
  readonly obstacles: readonly Obstacle[];
  readonly seed: number;
}

export interface LegendaryInput {
  readonly p1Jump: boolean;
  readonly p2Jump: boolean;
}
