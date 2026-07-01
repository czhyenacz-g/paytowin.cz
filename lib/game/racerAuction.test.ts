import { describe, it, expect } from "vitest";
import {
  getAuctionStartPrice,
  getNextBidAmount,
  canPlayerBid,
  buildRacerAuctionOffer,
  hasAuctionBid,
  canBotPlaceSingleBid,
  isAuctionExpired,
  isBidStale,
  AUCTION_BID_STEP,
  AUCTION_DURATION_MS,
} from "./racerAuction";
import type { RacerAuctionOffer } from "@/lib/types/game";
import type { RacerProfile } from "@/lib/racers/types";
import type { Player } from "@/lib/types/game";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const mockRacer: RacerProfile = {
  id: "cl-dostinec",
  name: "Dostinec",
  emoji: "🐴",
  speed: 8,
  price: 8500,
  maxStamina: 110,
  isLegendary: true,
  type: "horse",
  isBuiltin: false,
  isPublic: false,
};

const now = 1_700_000_000_000;

function makeOffer(overrides: Partial<RacerAuctionOffer> = {}): RacerAuctionOffer {
  return {
    type: "racer_auction",
    phase: "running",
    cardId: "ch13",
    racerId: "cl-dostinec",
    racerName: "Dostinec",
    racerEmoji: "🐴",
    racerSpeed: 8,
    racerMaxStamina: 110,
    price: 8500,
    startPrice: 4300,
    currentBid: null,
    currentBidderPlayerId: null,
    bidStep: 100,
    endsAt: now + 10_000,
    createdAt: now,
    revealedByPlayerId: "player-a",
    ...overrides,
  };
}

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: "player-b",
    game_id: "game-1",
    name: "Ferda",
    position: 0,
    color: "#ff0000",
    coins: 10_000,
    horses: [],
    turn_order: 1,
    skip_next_turn: false,
    ...overrides,
  };
}

// ─── getAuctionStartPrice ─────────────────────────────────────────────────────

describe("getAuctionStartPrice", () => {
  it("1500 → 800", () => expect(getAuctionStartPrice(1500)).toBe(800));
  it("8500 → 4300", () => expect(getAuctionStartPrice(8500)).toBe(4300));
  it("10000 → 5000", () => expect(getAuctionStartPrice(10000)).toBe(5000));
  it("výsledek nikdy není pod nulu", () => expect(getAuctionStartPrice(0)).toBe(0));
  it("necelé půlení se zaokrouhlí nahoru", () => expect(getAuctionStartPrice(1100)).toBe(600));
});

// ─── getNextBidAmount ─────────────────────────────────────────────────────────

describe("getNextBidAmount", () => {
  it("vrátí startPrice pokud currentBid je null", () => {
    const offer = makeOffer({ currentBid: null, startPrice: 4300 });
    expect(getNextBidAmount(offer)).toBe(4300);
  });
  it("vrátí currentBid + bidStep", () => {
    const offer = makeOffer({ currentBid: 4300, bidStep: 100 });
    expect(getNextBidAmount(offer)).toBe(4400);
  });
});

// ─── canPlayerBid ─────────────────────────────────────────────────────────────

describe("canPlayerBid", () => {
  it("povolí hráče s dost penězi", () => {
    const offer = makeOffer({ startPrice: 4300 });
    const player = makePlayer({ coins: 5000 });
    expect(canPlayerBid(player, offer, now).ok).toBe(true);
  });

  it("zakáže hráče bez peněz", () => {
    const offer = makeOffer({ startPrice: 4300 });
    const player = makePlayer({ coins: 1000 });
    const result = canPlayerBid(player, offer, now);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/peněz/);
  });

  it("povolí currentBidderPlayerId přihodit znovu (navýšení vlastní nabídky)", () => {
    const offer = makeOffer({ currentBidderPlayerId: "player-b", currentBid: 4300 });
    const player = makePlayer({ id: "player-b", coins: 10000 });
    expect(canPlayerBid(player, offer, now).ok).toBe(true);
  });

  it("zakáže příhoz po endsAt", () => {
    const offer = makeOffer({ endsAt: now - 1 });
    const player = makePlayer({ coins: 10000 });
    const result = canPlayerBid(player, offer, now);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/skončila/);
  });

  it("zakáže příhoz pokud phase není running (neočekávaný stav)", () => {
    // Typ phase je nyní jen "running", ale canPlayerBid hlídá interně
    const offer = makeOffer({ endsAt: now - 1 }); // expired = not running
    const player = makePlayer({ coins: 10000 });
    expect(canPlayerBid(player, offer, now).ok).toBe(false);
  });
});

// ─── buildRacerAuctionOffer ───────────────────────────────────────────────────

describe("buildRacerAuctionOffer", () => {
  it("vytvoří phase = running", () => {
    const offer = buildRacerAuctionOffer(mockRacer, "ch13", "player-a", now);
    expect(offer.phase).toBe("running");
  });

  it("nastaví bidStep = 100", () => {
    const offer = buildRacerAuctionOffer(mockRacer, "ch13", "player-a", now);
    expect(offer.bidStep).toBe(AUCTION_BID_STEP);
  });

  it("nastaví endsAt = now + 10 000", () => {
    const offer = buildRacerAuctionOffer(mockRacer, "ch13", "player-a", now);
    expect(offer.endsAt).toBe(now + AUCTION_DURATION_MS);
  });

  it("currentBid je null na začátku", () => {
    const offer = buildRacerAuctionOffer(mockRacer, "ch13", "player-a", now);
    expect(offer.currentBid).toBeNull();
  });

  it("startPrice je správně vypočítaná", () => {
    const offer = buildRacerAuctionOffer(mockRacer, "ch13", "player-a", now);
    expect(offer.startPrice).toBe(getAuctionStartPrice(mockRacer.price));
  });
});

// ─── hasAuctionBid ────────────────────────────────────────────────────────────

describe("hasAuctionBid", () => {
  it("vrátí false pokud currentBid je null (no-bid aukce)", () => {
    const offer = makeOffer({ currentBid: null, currentBidderPlayerId: null });
    expect(hasAuctionBid(offer)).toBe(false);
  });

  it("vrátí true pokud currentBid je nastaven", () => {
    const offer = makeOffer({ currentBid: 4300, currentBidderPlayerId: "player-b" });
    expect(hasAuctionBid(offer)).toBe(true);
  });

  it("no-bid aukce → kůň zmizí, nikdo nic nezíská", () => {
    const offer = makeOffer({ currentBid: null, currentBidderPlayerId: null });
    expect(hasAuctionBid(offer)).toBe(false);
  });
});

// ─── isAuctionExpired ─────────────────────────────────────────────────────────

describe("isAuctionExpired", () => {
  it("vrátí true pokud now >= endsAt a phase = running", () => {
    const offer = makeOffer({ endsAt: now - 1 });
    expect(isAuctionExpired(offer, now)).toBe(true);
  });

  it("vrátí false pokud now < endsAt", () => {
    const offer = makeOffer({ endsAt: now + 5000 });
    expect(isAuctionExpired(offer, now)).toBe(false);
  });

  it("vrátí false pokud endsAt je v budoucnu", () => {
    const offer = makeOffer({ endsAt: now + 1 });
    expect(isAuctionExpired(offer, now)).toBe(false);
  });
});

// ─── canBotPlaceSingleBid ─────────────────────────────────────────────────────

function makeBot(overrides: Partial<Player> = {}): Player {
  return makePlayer({ id: "bot-1", is_bot: true, coins: 10_000, ...overrides });
}

describe("canBotPlaceSingleBid", () => {
  it("povolí bota s coins >= startPrice × 1.6", () => {
    const offer = makeOffer({ startPrice: 4300 }); // threshold = 6880
    const bot = makeBot({ coins: 7000 });
    expect(canBotPlaceSingleBid(bot, offer, now).ok).toBe(true);
  });

  it("zakáže bota s coins < startPrice × 1.6", () => {
    const offer = makeOffer({ startPrice: 4300 }); // threshold = 6880
    const bot = makeBot({ coins: 6000 });
    const result = canBotPlaceSingleBid(bot, offer, now);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/startPrice/);
  });

  it("zakáže bota bez peněz na nextBidAmount", () => {
    const offer = makeOffer({ startPrice: 4300, currentBid: 9000 }); // next = 9100
    const bot = makeBot({ coins: 9000 }); // < 9100
    expect(canBotPlaceSingleBid(bot, offer, now).ok).toBe(false);
  });

  it("zakáže bota který je currentBidderPlayerId", () => {
    const offer = makeOffer({ currentBidderPlayerId: "bot-1", currentBid: 4300 });
    const bot = makeBot({ id: "bot-1", coins: 10_000 });
    const result = canBotPlaceSingleBid(bot, offer, now);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/vede/);
  });

  it("zakáže bota v botBidderIds (už přihodil)", () => {
    const offer = makeOffer({ botBidderIds: ["bot-1"] });
    const bot = makeBot({ id: "bot-1", coins: 10_000 });
    const result = canBotPlaceSingleBid(bot, offer, now);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/přihodil/);
  });

  it("zakáže bota po endsAt", () => {
    const offer = makeOffer({ endsAt: now - 1 });
    const bot = makeBot({ coins: 10_000 });
    expect(canBotPlaceSingleBid(bot, offer, now).ok).toBe(false);
  });

  it("bot příhoz použije getNextBidAmount — startPrice pokud nikdo nepřihodil", () => {
    const offer = makeOffer({ startPrice: 4300, currentBid: null });
    expect(getNextBidAmount(offer)).toBe(4300);
  });

  it("jiný bot smí přihodit i když bot-1 je v botBidderIds", () => {
    const offer = makeOffer({ botBidderIds: ["bot-1"] });
    const bot2 = makeBot({ id: "bot-2", coins: 10_000 });
    expect(canBotPlaceSingleBid(bot2, offer, now).ok).toBe(true);
  });
});

// ─── isBidStale ───────────────────────────────────────────────────────────────

describe("isBidStale", () => {
  it("vrátí false pokud fresh odpovídá očekávanému stavu (no-bid)", () => {
    const fresh = makeOffer({ currentBid: null, currentBidderPlayerId: null });
    expect(isBidStale(fresh, null, null)).toBe(false);
  });

  it("vrátí false pokud fresh odpovídá očekávanému stavu (s příhozem)", () => {
    const fresh = makeOffer({ currentBid: 4300, currentBidderPlayerId: "player-b" });
    expect(isBidStale(fresh, 4300, "player-b")).toBe(false);
  });

  it("vrátí true pokud currentBid se liší", () => {
    const fresh = makeOffer({ currentBid: 4400, currentBidderPlayerId: "player-b" });
    expect(isBidStale(fresh, 4300, "player-b")).toBe(true);
  });

  it("vrátí true pokud currentBidderPlayerId se liší", () => {
    const fresh = makeOffer({ currentBid: 4300, currentBidderPlayerId: "player-c" });
    expect(isBidStale(fresh, 4300, "player-b")).toBe(true);
  });

  it("vrátí true pokud fresh má bid ale expected byl null (soupeř přihodil první)", () => {
    const fresh = makeOffer({ currentBid: 4300, currentBidderPlayerId: "player-b" });
    expect(isBidStale(fresh, null, null)).toBe(true);
  });
});

// ─── Bot winner scénáře ───────────────────────────────────────────────────────

describe("bot winner (settlement logic)", () => {
  it("hasAuctionBid vrátí true pokud currentBidderPlayerId je bot", () => {
    const offer = makeOffer({ currentBid: 4300, currentBidderPlayerId: "bot-1" });
    expect(hasAuctionBid(offer)).toBe(true);
  });

  it("winner se určuje výhradně podle currentBidderPlayerId, ne podle is_bot flagu", () => {
    const botOffer = makeOffer({ currentBid: 4300, currentBidderPlayerId: "bot-1" });
    const humanOffer = makeOffer({ currentBid: 4300, currentBidderPlayerId: "player-a" });
    expect(hasAuctionBid(botOffer)).toBe(true);
    expect(hasAuctionBid(humanOffer)).toBe(true);
  });

  it("lidský hráč bez příhozu neblokuje settlement — hasAuctionBid závisí jen na currentBid", () => {
    // Aukce kde bot přihodil, lidský ne
    const offer = makeOffer({ currentBid: 4300, currentBidderPlayerId: "bot-1" });
    expect(hasAuctionBid(offer)).toBe(true);
    // Expirovaná aukce s bot bidderem = vyhrál bot
    expect(isAuctionExpired(offer, now + 15_000)).toBe(true);
  });

  it("isAuctionExpired vrátí true po endsAt bez ohledu na to kdo přihodil", () => {
    const offerBotWinner = makeOffer({ currentBid: 4300, currentBidderPlayerId: "bot-1", endsAt: now - 1 });
    expect(isAuctionExpired(offerBotWinner, now)).toBe(true);
  });

  it("isBidStale vrátí false pokud fresh stav souhlasí s bot bidderem", () => {
    const fresh = makeOffer({ currentBid: 4300, currentBidderPlayerId: "bot-1" });
    expect(isBidStale(fresh, 4300, "bot-1")).toBe(false);
  });

  it("isBidStale vrátí true pokud bot přihodil mezi snapshot a zápisem", () => {
    const fresh = makeOffer({ currentBid: 4300, currentBidderPlayerId: "bot-1" });
    // Player viděl null → bot mezitím přihodil → stale
    expect(isBidStale(fresh, null, null)).toBe(true);
  });
});
