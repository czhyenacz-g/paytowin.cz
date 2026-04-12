/**
 * features/cards — systém karet Náhoda / Finance.
 *
 * Přímý vstupní bod pro kód pracující s kartami.
 * Interní implementace je v lib/cards.ts.
 */

export { CHANCE_CARDS, FINANCE_CARDS, drawCard } from "@/lib/cards";
export type { GameCard, CardEffect, CardEffectKind } from "@/lib/cards";
