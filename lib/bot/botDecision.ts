import type { Player } from "@/lib/types/game";
import type { RacerConfig } from "@/lib/themes";
import {
  decideBotHorsePurchaseStrategy,
  type BotPurchaseParams,
  type BotPurchaseDecision,
} from "./botPurchaseStrategy";

/**
 * decideBotHorsePurchase — wrapper pokud pro zpětnou kompatibilitu.
 *
 * Pozor: bez gameYear a alreadyBoughtThisYear vrací konzervativní rozhodnutí.
 * Pro produkční kód použij decideBotHorsePurchaseStrategy s úplnými parametry.
 */
export function decideBotHorsePurchase(
  player: Player,
  racer: RacerConfig,
): "buy" | "skip";
export function decideBotHorsePurchase(
  params: BotPurchaseParams,
): BotPurchaseDecision;
export function decideBotHorsePurchase(
  playerOrParams: Player | BotPurchaseParams,
  racer?: RacerConfig,
): "buy" | "skip" | BotPurchaseDecision {
  // Detect overload: if second arg exists, use old API
  if (racer) {
    const player = playerOrParams as Player;
    // Legacy: no game year context, so use safe default
    const result = decideBotHorsePurchaseStrategy({
      player,
      racer,
      gameYear: 1921,
      alreadyBoughtThisYear: player.horses.length > 0,
      difficulty: "normal",
    });
    return result.decision;
  }

  // New API: return full decision object
  const params = playerOrParams as BotPurchaseParams;
  return decideBotHorsePurchaseStrategy(params);
}
