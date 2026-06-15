import type { MinigameResult } from "./types";
import { calculateStableDuelStaminaCost } from "./stamina-costs";

export const STABLE_DUEL_WIN_REWARD_MIN      = 200;
export const STABLE_DUEL_WIN_REWARD_MAX      = 2000;
export const STABLE_DUEL_MAFIA_BONUS_MAX     = 500;
export const STABLE_DUEL_APPLY_BOT_STAMINA_LOSS = true;

export interface PlayerSettlement {
  coinsDelta: number;
  stamina: {
    base:  number;
    nitro: number;
    crash: number;
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
  const stamina = calculateStableDuelStaminaCost({
    nitroUsed: pr.usedNitro,
    crashed: pr.crashed,
    nitroActivations: pr.nitroActivations,
  });
  return { coinsDelta, stamina };
}

/** Základní odměna závisí pouze na cenách koní. Pure, deterministic. */
export function computeBaseDuelReward(p1HorsePrice?: number, p2HorsePrice?: number): number {
  return Math.min(
    STABLE_DUEL_WIN_REWARD_MAX,
    Math.max(
      STABLE_DUEL_WIN_REWARD_MIN,
      Math.floor(Math.max(p1HorsePrice ?? 0, p2HorsePrice ?? 0) / 10),
    ),
  );
}

/** Celková odměna = base + mafiaBonus (max 500). Pure, deterministic. */
export function computeDuelReward(p1HorsePrice?: number, p2HorsePrice?: number, mafiaBonus?: number): number {
  return computeBaseDuelReward(p1HorsePrice, p2HorsePrice) + Math.min(mafiaBonus ?? 0, STABLE_DUEL_MAFIA_BONUS_MAX);
}

/** Pure helper — žádné DB. Volej z ResultPhase (display) i z GameBoard (zápis). */
export function computeMinigameSettlement(
  result: MinigameResult,
  p1HorsePrice?: number,
  p2HorsePrice?: number,
  mafiaBonus?: number,
): MinigameSettlement {
  const r = computeDuelReward(p1HorsePrice, p2HorsePrice, mafiaBonus);
  const p1Coins = result.winner === 1 ? r : result.winner === 2 ? -r : 0;
  const p2Coins = result.winner === 2 ? r : result.winner === 1 ? -r : 0;
  return {
    p1: calcPlayer(result.p1, p1Coins),
    p2: calcPlayer(result.p2, p2Coins),
  };
}
