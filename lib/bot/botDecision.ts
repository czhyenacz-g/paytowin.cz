import type { Player } from "@/lib/types/game";
import type { RacerConfig } from "@/lib/themes";

/**
 * decideBotHorsePurchase — rozhodne, zda bot koupí závodníka.
 *
 * MVP pravidla:
 *  - Bot nemá žádného závodníka → kup pokud má dost coinů.
 *  - Bot má závodníka → přeskočit (nezahlcuj stáj).
 */
export function decideBotHorsePurchase(
  player: Player,
  racer: RacerConfig,
): "buy" | "skip" {
  if (player.horses.length > 0) return "skip";
  if (player.coins < racer.price) return "skip";
  return "buy";
}
