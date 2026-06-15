import type { Horse } from "@/lib/types/game";
import { racerOwnershipKey, normalizeFavoriteHorse } from "@/lib/engine";
import { STABLE_DUEL_APPLY_BOT_STAMINA_LOSS } from "./settlement";

export interface HorseSettlementResult {
  horses: Horse[];
  /** true pokud byl racer identifikovaný klíčem odstraněn kvůli stamina <= 0 */
  racerLost: boolean;
}

/**
 * Odečte stamina loss od konkrétního racera v seznamu.
 * - Pokud nová stamina = 0 (nebo pod), racer je odstraněn.
 * - Pokud klíč neexistuje v seznamu, seznam se vrátí beze změny.
 * - Výsledek je vždy normalizovaný přes normalizeFavoriteHorse.
 */
export function applyStaminaLossToHorseList(
  horses: Horse[],
  racerKey: string | null,
  staminaLoss: number,
): HorseSettlementResult {
  if (!racerKey) return { horses, racerLost: false };

  const target = horses.find(h => racerOwnershipKey(h) === racerKey);
  if (!target) return { horses, racerLost: false };

  const currentStamina = target.stamina ?? target.maxStamina ?? 100;
  const newStamina = Math.max(0, currentStamina - staminaLoss);

  if (newStamina === 0) {
    return {
      horses: normalizeFavoriteHorse(horses.filter(h => racerOwnershipKey(h) !== racerKey)),
      racerLost: true,
    };
  }

  return {
    horses: horses.map(h => racerOwnershipKey(h) === racerKey ? { ...h, stamina: newStamina } : h),
    racerLost: false,
  };
}

export interface StableDuelSettlementHorseResult {
  updatedCHorses: Horse[];
  updatedDHorses: Horse[];
  challengerRacerLost: boolean;
  defenderRacerLost: boolean;
}

/**
 * Aplikuje stamina loss z Stable Duel výsledku na oba hráče.
 * Challenger vždy dostane stamina loss.
 * Defender dostane stamina loss jen pokud STABLE_DUEL_APPLY_BOT_STAMINA_LOSS === true.
 */
export function applyStableDuelSettlementHorses(
  challengerHorses: Horse[],
  defenderHorses: Horse[],
  cKey: string | null,
  dKey: string | null,
  cStaminaLoss: number,
  dStaminaLoss: number,
): StableDuelSettlementHorseResult {
  const cResult = applyStaminaLossToHorseList(challengerHorses, cKey, cStaminaLoss);

  const dResult = STABLE_DUEL_APPLY_BOT_STAMINA_LOSS
    ? applyStaminaLossToHorseList(defenderHorses, dKey, dStaminaLoss)
    : { horses: defenderHorses, racerLost: false };

  return {
    updatedCHorses: cResult.horses,
    updatedDHorses: dResult.horses,
    challengerRacerLost: cResult.racerLost,
    defenderRacerLost: dResult.racerLost,
  };
}
