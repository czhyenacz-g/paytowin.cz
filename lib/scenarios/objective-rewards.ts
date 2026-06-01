import type { ScenarioDefinition } from "./types";
import type { Player } from "@/lib/types/game";

/**
 * XP udělené do profilu za splnění sdíleného objective.
 * Odpovídá ~90 % XP_WINNER (100) definovaného v app/game/actions.ts.
 */
export const XP_OBJECTIVE = 90;

/** Reward config pro jeden objective. */
export interface ObjectiveRewardConfig {
  objectiveId: string;
  /** Coins přidané hráči okamžitě v průběhu hry při prvním splnění. */
  inGameCoins: number;
  /** XP přidané do profilu na konci hry. */
  profileXp: number;
  /** Profilové XP dostane hráč pouze ve hře s alespoň 2 hráči s Discord identitou. */
  profileXpRequiresHumanOpponent: boolean;
}

/**
 * Centrální registr odměn za sdílené objectives.
 * Přidat nový objective = přidat jeden záznam sem.
 */
const REWARD_CONFIGS: ObjectiveRewardConfig[] = [
  {
    objectiveId: "first-stable-collector",
    inGameCoins: 2000,
    profileXp: XP_OBJECTIVE,
    profileXpRequiresHumanOpponent: true,
  },
];

export function getObjectiveRewardConfig(objectiveId: string): ObjectiveRewardConfig | null {
  return REWARD_CONFIGS.find(r => r.objectiveId === objectiveId) ?? null;
}

/**
 * Zkontroluje, zda hráč právě splnil libovolný sdílený objective, který má herní reward.
 *
 * Volá se okamžitě po změně stavu hráče (nákup racera) — volající garantuje,
 * že player.horses již obsahuje právě zakoupené koně.
 *
 * Vrátí první dosud neudělený objective, jehož podmínku hráč splňuje.
 */
export function checkSharedObjectiveInGameReward(
  scenario: ScenarioDefinition,
  player: Player,
  alreadyAwardedIds: string[],
): { config: ObjectiveRewardConfig; objectiveId: string } | null {
  for (const obj of scenario.sharedObjectives ?? []) {
    if (!obj.condition) continue;
    if (alreadyAwardedIds.includes(obj.id)) continue;
    const config = getObjectiveRewardConfig(obj.id);
    if (!config) continue;

    if (obj.condition.type === "owns_at_least_racers") {
      if (player.horses.length >= obj.condition.count) {
        return { config, objectiveId: obj.id };
      }
    }
  }
  return null;
}
