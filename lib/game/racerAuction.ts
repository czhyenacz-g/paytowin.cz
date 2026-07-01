import type { RacerAuctionOffer } from "@/lib/types/game";
import type { RacerProfile } from "@/lib/racers/types";
import type { Player } from "@/lib/types/game";

export const AUCTION_BID_STEP = 100;
export const AUCTION_DURATION_MS = 10_000;

/** Startovní cena = 1/2 ceny koně, zaokrouhleno nahoru na stovky. */
export function getAuctionStartPrice(price: number): number {
  return Math.ceil((price / 2) / 100) * 100;
}

/** Výše dalšího příhozu. Pokud nikdo ještě nepřihodil, vrátí startPrice. */
export function getNextBidAmount(offer: RacerAuctionOffer): number {
  return offer.currentBid === null ? offer.startPrice : offer.currentBid + offer.bidStep;
}

/** Ověří, zda může hráč přihodit. Vrátí { ok, reason }. */
export function canPlayerBid(
  player: Player,
  offer: RacerAuctionOffer,
  now: number,
): { ok: boolean; reason?: string } {
  if (offer.phase !== "running") return { ok: false, reason: "Aukce není aktivní." };
  if (now >= offer.endsAt) return { ok: false, reason: "Aukce už skončila." };
  if (offer.currentBidderPlayerId === player.id) return { ok: false, reason: "Už vedeš." };
  const next = getNextBidAmount(offer);
  if (player.coins < next) return { ok: false, reason: "Nemáš dost peněz na další příhoz." };
  return { ok: true };
}

/** Sestaví nový RacerAuctionOffer ze závodníka a kontextu. */
export function buildRacerAuctionOffer(
  racer: RacerProfile,
  cardId: string,
  revealedByPlayerId: string,
  now: number,
): RacerAuctionOffer {
  return {
    type: "racer_auction",
    phase: "running",
    cardId,
    racerId: racer.id,
    racerName: racer.name,
    racerEmoji: racer.emoji,
    racerImageUrl: racer.imageUrl,
    racerSpeed: racer.speed,
    racerMaxStamina: racer.maxStamina,
    racerFlavorText: racer.flavorText,
    price: racer.price,
    startPrice: getAuctionStartPrice(racer.price),
    currentBid: null,
    currentBidderPlayerId: null,
    bidStep: AUCTION_BID_STEP,
    endsAt: now + AUCTION_DURATION_MS,
    createdAt: now,
    revealedByPlayerId,
  };
}

/** Převede skončenou aukci bez příhozů na veřejnou nabídku za plnou cenu. */
export function convertAuctionToPublicOffer(offer: RacerAuctionOffer): RacerAuctionOffer {
  return { ...offer, phase: "public", currentBid: null, currentBidderPlayerId: null };
}

/** Vrátí true, pokud countdown pro aktivní aukci vypršel. */
export function isAuctionExpired(offer: RacerAuctionOffer, now: number): boolean {
  return offer.phase === "running" && now >= offer.endsAt;
}
