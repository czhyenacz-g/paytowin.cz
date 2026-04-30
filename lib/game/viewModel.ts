import type { GameCard } from "@/lib/cards";
import type { Player, Horse, RerollOffer } from "@/lib/types/game";
import type { CenterEvent } from "@/lib/types/events";

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
