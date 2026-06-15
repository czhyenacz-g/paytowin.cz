/**
 * lib/minigame-nitro.ts — UI preview helper pro nitro/stamina boost.
 * Konstanty importovány ze stamina-costs.ts — jediná zdrojová pravda.
 */
import { calculateStableDuelStaminaCost } from "./minigames/stamina-costs";

export interface NitroStaminaPreview {
  baseCost: number;
  nitroCost: number;
  crashPenalty: number;
  total: number;
}

export function nitroStaminaPreview(nitroUsed: boolean, crashed: boolean): NitroStaminaPreview {
  const s = calculateStableDuelStaminaCost({ nitroUsed, crashed });
  return { baseCost: s.base, nitroCost: s.nitro, crashPenalty: s.crash, total: s.total };
}
