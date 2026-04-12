/**
 * features/game — herní logika (domain re-exports).
 *
 * Přímý vstupní bod pro kód pracující s herní mechanikou.
 * Interní implementace je v lib/engine.ts.
 */

export {
  buildFields,
  getStartTax,
  isBankrupt,
  getNextActiveIndex,
  normalizePlayer,
  normalizeState,
  sleep,
  REROLL_COST,
  REROLL_CHANCE,
} from "@/lib/engine";

export type { Field, FieldType } from "@/lib/engine";
export type { Player, Horse, GameState, OfferPending } from "@/lib/types/game";
