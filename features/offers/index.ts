/**
 * features/offers — systém herních nabídek (reroll atd.).
 *
 * Zatím jen re-export typů. Až přibydou nové typy nabídek,
 * logika se rozroste zde — bez dotknutí ostatních domén.
 */

export type { OfferPending } from "@/lib/types/game";
export { REROLL_COST, REROLL_CHANCE } from "@/lib/engine";
