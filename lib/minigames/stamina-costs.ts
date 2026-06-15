/**
 * Jediná zdrojová pravda pro stamina costy Stable Duelu.
 * Importuj odsud — nikde jinde nevytvářej duplicitní konstanty.
 *
 * Nitro cost je per-use: každá aktivace stojí STABLE_DUEL_NITRO_STAMINA_COST.
 * Fallback: pokud nitroActivations chybí (starší data) a nitroUsed===true, použij 1 aktivaci.
 */

export const STABLE_DUEL_BASE_STAMINA_COST   = 30;
export const STABLE_DUEL_NITRO_STAMINA_COST  = 10;  // per aktivaci
export const STABLE_DUEL_CRASH_STAMINA_COST  = 10;

export interface StaminaCost {
  base:  number;
  nitro: number;
  crash: number;
  total: number;
}

export function calculateStableDuelStaminaCost(
  { nitroUsed, crashed, nitroActivations }: { nitroUsed: boolean; crashed: boolean; nitroActivations?: number },
): StaminaCost {
  const base  = STABLE_DUEL_BASE_STAMINA_COST;
  const activations = nitroActivations !== undefined ? nitroActivations : (nitroUsed ? 1 : 0);
  const nitro = activations * STABLE_DUEL_NITRO_STAMINA_COST;
  const crash = crashed ? STABLE_DUEL_CRASH_STAMINA_COST : 0;
  return { base, nitro, crash, total: base + nitro + crash };
}
