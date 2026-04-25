/**
 * lib/minigame-nitro.ts — sdílená konstanta a preview helper pro nitro/stamina boost.
 * Dev-only, žádný DB zápis.
 */

export const NITRO_COST        = 20;  // stamina cena za použití nitro
export const BASE_STAMINA_COST = 20;  // základní stamina cost za odehrání minihry
export const CRASH_PENALTY     = 15;  // extra penalizace za crash

export interface NitroStaminaPreview {
  baseCost: number;
  nitroCost: number;
  crashPenalty: number;
  total: number;
}

export function nitroStaminaPreview(nitroUsed: boolean, crashed: boolean): NitroStaminaPreview {
  const baseCost     = BASE_STAMINA_COST;
  const nitroCost    = nitroUsed ? NITRO_COST    : 0;
  const crashPenalty = crashed   ? CRASH_PENALTY : 0;
  return { baseCost, nitroCost, crashPenalty, total: baseCost + nitroCost + crashPenalty };
}
