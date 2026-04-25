import type { StableMinigameType } from "./selectStableMinigame";

/** Jednotný výstup z každé stable minihry. */
export interface MinigameResult {
  winner: 1 | 2 | "draw";

  p1: {
    usedNitro: boolean;
    crashed:   boolean;
    /** Skóre závislé na minihře: ticksAlive (duel) nebo score/distance (speed). */
    score?: number;
  };

  p2: {
    usedNitro: boolean;
    crashed:   boolean;
    score?: number;
  };

  meta?: {
    minigameType: StableMinigameType;
  };
}
