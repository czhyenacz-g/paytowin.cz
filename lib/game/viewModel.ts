import type { GameCard } from "@/lib/cards";
import type { Player, Horse, RerollOffer, OfferPending, HistoricalStableOffer } from "@/lib/types/game";
import type { CenterEvent } from "@/lib/types/events";
import type { Field } from "@/lib/engine";
import { ROLL_CORRECTION_COST } from "@/lib/engine";

/**
 * Mapuje herní stav na CenterEvent view model pro CenterEventModal.
 * Priorita: card_pending > offer_pending.
 */
export function mapToCenterEvent(
  pendingCard: { card: GameCard; playerIndex: number } | null,
  pendingOffer: RerollOffer | null,
  players: Player[],
  gameMode: "online" | "local",
  viewerRole: string,
  myPlayerId: string | null
): CenterEvent | null {
  if (pendingCard) {
    const { card, playerIndex } = pendingCard;
    return {
      type: "card",
      cardType: card.type,
      category: card.type === "chance" ? "Osud" : card.type === "mafia" ? "Mafie" : "Finance",
      emoji: card.type === "chance" ? "🎴" : card.type === "mafia" ? "🎭" : "💼",
      playerName: players[playerIndex]?.name ?? "?",
      text: card.text,
      effectLabel: card.effectLabel,
      imagePath: card.imagePath,
      isActivePlayer: gameMode === "local" ? true : (myPlayerId !== null && (players[playerIndex]?.id === myPlayerId)),
    };
  }
  if (pendingOffer) {
    const offerPlayer = players.find(p => p.id === pendingOffer.playerId);
    const playerCoins = offerPlayer?.coins ?? 0;
    return {
      type: "offer",
      playerName: pendingOffer.playerName,
      playerCoins,
      cost: pendingOffer.cost,
      canConfirm: playerCoins >= pendingOffer.cost,
      isActivePlayer: gameMode === "local"
        ? viewerRole === "player"
        : myPlayerId === pendingOffer.playerId,
    };
  }
  return null;
}

/** Sestaví možnosti výběru finálního hodu pro pendingRollDecision overlay. */
export function buildRollDecisionOptions(
  decision: { baseRoll: number; basePosition: number },
  fields: readonly Field[],
  playerCoins: number
): Array<{
  adjustment: -1 | 0 | 1;
  finalRoll: number;
  cost: number;
  isDisabled: boolean;
  targetField: Field | null;
}> {
  return ([-1, 0, 1] as Array<-1 | 0 | 1>).map((adjustment) => {
    const finalRoll = decision.baseRoll + adjustment;
    const isAffordable = adjustment === 0 || playerCoins >= ROLL_CORRECTION_COST;
    const isValid = finalRoll >= 1;
    const targetField = isValid ? fields[(decision.basePosition + finalRoll) % fields.length] : null;
    return {
      adjustment,
      finalRoll,
      cost: adjustment === 0 ? 0 : ROLL_CORRECTION_COST,
      isDisabled: !isValid || !isAffordable,
      targetField,
    };
  });
}

/**
 * Vrátí důvod, proč hráč nemůže hodit kostkou, nebo null pokud může.
 * Pokryje pouze offer_pending-based blokátory — ostatní stavy (pendingCard, isRolling…)
 * mají vlastní UI, které kostku nahradí nebo zakryje.
 */
export function getRollBlockedReason(
  offerPending: OfferPending | null | undefined,
): string | null {
  if (!offerPending) return null;
  switch (offerPending.type) {
    case "stable_duel_pending":
      return offerPending.phase !== "finished" ? "Probíhá stájový souboj" : null;
    case "race":
      return "Probíhá dostih";
    case "bankrupt_announcement":
      return "Pokračujeme za chvíli…";
    case "race_pending":
      return "Připravuje se dostih";
    case "historical_stable":
      return (offerPending as HistoricalStableOffer).phase === "revealed" ? "Čeká se na rozhodnutí o historickém závodníkovi" : null;
    default:
      return null;
  }
}

/**
 * Vrátí zobrazitelný identifikátor závodníka.
 *
 * Priorita fallbacků:
 *   1. racerImages[racer.id] — z theme.assets.racerImages (nový kanonický zdroj)
 *   2. racer.image — přímý obrázek v RacerConfig (theme builder ho vyplní)
 *   3. racer.emoji — vždy k dispozici
 *
 * Pozn.: horseImages je legacy název; volající předává `racerImages ?? horseImages`.
 */
export function resolveRacerDisplay(
  racer: Horse,
  racerImages?: Partial<Record<string, string>>
): { type: "emoji"; value: string } | { type: "image"; src: string; alt: string } {
  const key = racer.id ?? racer.name;
  const src = racerImages?.[key];
  if (src) return { type: "image", src, alt: racer.name };
  return { type: "emoji", value: racer.emoji };
}
