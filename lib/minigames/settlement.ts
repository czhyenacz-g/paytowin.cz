import type { MinigameResult } from "./types";

export const STABLE_DUEL_WIN_REWARD         = 50;
export const STABLE_DUEL_BASE_STAMINA_COST  = 20;
export const STABLE_DUEL_NITRO_STAMINA_COST = 30;
export const STABLE_DUEL_CRASH_STAMINA_COST = 15;

export interface PlayerSettlement {
  coinsDelta: number;
  stamina: {
    base:  number;  // vždy BASE_STAMINA_COST
    nitro: number;  // 0 nebo NITRO_STAMINA_COST
    crash: number;  // 0 nebo CRASH_STAMINA_COST
    total: number;
  };
}

export interface MinigameSettlement {
  p1: PlayerSettlement;
  p2: PlayerSettlement;
}

function calcPlayer(
  pr: MinigameResult["p1"] | MinigameResult["p2"],
  coinsDelta: number,
): PlayerSettlement {
  const base  = STABLE_DUEL_BASE_STAMINA_COST;
  const nitro = pr.usedNitro ? STABLE_DUEL_NITRO_STAMINA_COST : 0;
  const crash = pr.crashed   ? STABLE_DUEL_CRASH_STAMINA_COST : 0;
  return { coinsDelta, stamina: { base, nitro, crash, total: base + nitro + crash } };
}

/** Pure helper — žádné DB. Volej z ResultPhase (display) i z GameBoard (zápis). */
export function computeMinigameSettlement(result: MinigameResult): MinigameSettlement {
  const r = STABLE_DUEL_WIN_REWARD;
  const p1Coins = result.winner === 1 ? r : result.winner === 2 ? -r : 0;
  const p2Coins = result.winner === 2 ? r : result.winner === 1 ? -r : 0;
  return {
    p1: calcPlayer(result.p1, p1Coins),
    p2: calcPlayer(result.p2, p2Coins),
  };
}
