import type { Player } from "@/lib/types/game";
import type { RacerConfig } from "@/lib/themes";

export type BotDifficulty = "easy" | "normal" | "hard";

export interface BotPurchaseParams {
  player: Player;
  racer: RacerConfig;
  gameYear: number;
  alreadyBoughtThisYear: boolean;
  difficulty?: BotDifficulty;
}

export interface BotPurchaseDecision {
  decision: "buy" | "skip";
  reason?: string;
}

interface StrategyConfig {
  maxRacers: number;
  minReserve: number;
  thresholds: number[];
}

const STRATEGIES: Record<BotDifficulty, StrategyConfig> = {
  easy: {
    maxRacers: 2,
    minReserve: 1500,
    thresholds: [0.7, 1.5],
  },
  normal: {
    maxRacers: 3,
    minReserve: 1500,
    thresholds: [0.5, 1.5, 2.0],
  },
  hard: {
    maxRacers: 4,
    minReserve: 800,
    thresholds: [0.3, 1.0, 0.5, 3.0],
  },
};

export function decideBotHorsePurchaseStrategy(
  params: BotPurchaseParams,
): BotPurchaseDecision {
  const { player, racer, gameYear, alreadyBoughtThisYear, difficulty = "normal" } = params;
  const strategy = STRATEGIES[difficulty];

  // Max 1 racer per game year — hard limit
  if (alreadyBoughtThisYear) {
    return { decision: "skip", reason: `already bought 1 racer this year (${gameYear})` };
  }

  const ownedCount = player.horses.length;

  // Check max racers owned
  if (ownedCount >= strategy.maxRacers) {
    return { decision: "skip", reason: `already owns ${ownedCount} racers (max: ${strategy.maxRacers})` };
  }

  // Check minimum reserve after purchase
  const coinsAfterPurchase = player.coins - racer.price;
  if (coinsAfterPurchase < strategy.minReserve) {
    return { decision: "skip", reason: `insufficient coins: ${player.coins} < ${racer.price} + ${strategy.minReserve}` };
  }

  // Check threshold for this racer count
  const threshold = strategy.thresholds[ownedCount] ?? 0;
  const requiredCoins = threshold * racer.price;

  if (player.coins < requiredCoins) {
    return { decision: "skip", reason: `coins ${player.coins} < threshold ${requiredCoins.toFixed(0)} (${ownedCount + 1}. racer)` };
  }

  return { decision: "buy", reason: `buying racer #${ownedCount + 1}` };
}
