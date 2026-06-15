/**
 * Jediná zdrojová pravda pro stamina costy Stable Duelu.
 * Importuj odsud — nikde jinde nevytvářej duplicitní konstanty.
 *
 * TODO: per-use nitro tracking bude vyžadovat nitroActivations: number v MinigameResult.
 * Zatím: usedNitro je boolean → flat cost jednou za závod bez ohledu na počet aktivací.
 */

export const STABLE_DUEL_BASE_STAMINA_COST   = 30;
export const STABLE_DUEL_NITRO_STAMINA_COST  = 20;
export const STABLE_DUEL_CRASH_STAMINA_COST  = 10;

export interface StaminaCost {
  base:  number;
  nitro: number;
  crash: number;
  total: number;
}

export function calculateStableDuelStaminaCost(
  { nitroUsed, crashed }: { nitroUsed: boolean; crashed: boolean },
): StaminaCost {
  const base  = STABLE_DUEL_BASE_STAMINA_COST;
  const nitro = nitroUsed ? STABLE_DUEL_NITRO_STAMINA_COST : 0;
  const crash = crashed   ? STABLE_DUEL_CRASH_STAMINA_COST : 0;
  return { base, nitro, crash, total: base + nitro + crash };
}
