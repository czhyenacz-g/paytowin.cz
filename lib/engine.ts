/**
 * Herní engine — čisté funkce bez závislosti na Reactu nebo Supabase.
 *
 * Pravidla:
 * - žádné importy z Reactu
 * - žádné importy ze Supabase
 * - každá funkce je testovatelná izolovaně
 * - logika hry patří sem, ne do komponent
 */

import type { Player, Horse, GameState, OfferPending } from "./types/game";
import type { HorseConfig } from "./themes";
import type { GameCard } from "./cards";

// ─── Konstanty ────────────────────────────────────────────────────────────────

export const REROLL_COST = 250;
export const REROLL_CHANCE = 0.25;

const BANKRUPTCY_TAX_PER_ROUND = 50;
const BANKRUPTCY_TAX_CAP = 500;

// ─── Typy polí ────────────────────────────────────────────────────────────────

export type FieldType =
  | "start"
  | "coins_gain"
  | "coins_lose"
  | "gamble"
  | "horse"
  | "neutral"
  | "chance"
  | "finance";

export interface Field {
  index: number;
  type: FieldType;
  label: string;
  emoji: string;
  description: string;
  horse?: Horse;
  action: (player: Player) => { player: Player; log: string };
}

// ─── Utility ──────────────────────────────────────────────────────────────────

export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

// ─── Daň za START ─────────────────────────────────────────────────────────────

/** Kolo 1 = 0, každé další kolo +50 coins, strop 500. */
export function getStartTax(round: number): number {
  return Math.min((round - 1) * BANKRUPTCY_TAX_PER_ROUND, BANKRUPTCY_TAX_CAP);
}

// ─── Bankrot ──────────────────────────────────────────────────────────────────

export function isBankrupt(player: Player): boolean {
  return player.coins <= 0;
}

/** Vrátí index dalšího aktivního (neozkrachovalého) hráče. */
export function getNextActiveIndex(currentIndex: number, players: Player[]): number {
  if (players.length === 0) return 0;
  let next = (currentIndex + 1) % players.length;
  let attempts = 0;
  while (isBankrupt(players[next]) && attempts < players.length) {
    next = (next + 1) % players.length;
    attempts++;
  }
  return next;
}

// ─── Normalizace dat ze Supabase ──────────────────────────────────────────────

export function normalizePlayer(raw: unknown): Player {
  const r = raw as Record<string, unknown>;
  return {
    id: r.id as string,
    game_id: r.game_id as string,
    name: r.name as string,
    position: Number(r.position),
    color: r.color as string,
    coins: Number(r.coins),
    horses: Array.isArray(r.horses) ? (r.horses as Horse[]) : [],
    turn_order: Number(r.turn_order),
    skip_next_turn: Boolean(r.skip_next_turn ?? false),
  };
}

export function normalizeState(raw: unknown): GameState {
  const r = raw as Record<string, unknown>;
  return {
    game_id: r.game_id as string,
    current_player_index: Number(r.current_player_index),
    last_roll: r.last_roll != null ? Number(r.last_roll) : null,
    log: Array.isArray(r.log) ? (r.log as string[]) : [],
    turn_count: Number(r.turn_count ?? 0),
    horse_pending: Boolean(r.horse_pending ?? false),
    card_pending: (r.card_pending as GameCard | null) ?? null,
    offer_pending: (r.offer_pending as OfferPending | null) ?? null,
  };
}

// ─── Deska ────────────────────────────────────────────────────────────────────

/**
 * Sestaví 21 polí desky z konfigurace koní daného theme.
 * Koně jsou mapováni na fixní pozice: horses[0]→3, horses[1]→10, horses[2]→17, horses[3]→19.
 */
export function buildFields(horses: HorseConfig[]): Field[] {
  const h = (i: number): Horse => ({
    id: horses[i].id,
    name: horses[i].name,
    speed: horses[i].speed,
    price: horses[i].price,
    emoji: horses[i].emoji,
  });
  return [
    { index: 0,  type: "start",      label: "START",           emoji: "🏁", description: "Průchod = +200 coins.",
      action: (p) => ({ player: { ...p, coins: p.coins + 200 }, log: `${p.name} prošel STARTem — +200 💰` }) },
    { index: 1,  type: "coins_gain", label: "Sponzor",         emoji: "🤝", description: "+100 coins.",
      action: (p) => ({ player: { ...p, coins: p.coins + 100 }, log: `${p.name}: Sponzor — +100 💰` }) },
    { index: 2,  type: "coins_lose", label: "Veterinář",       emoji: "🩺", description: "-60 coins.",
      action: (p) => ({ player: { ...p, coins: p.coins - 60 },  log: `${p.name}: Veterinář — -60 💰` }) },
    { index: 3,  type: "horse",      label: horses[0].name,    emoji: horses[0].emoji, description: `Kůň na prodej (rychlost ${horses[0].speed}) za ${horses[0].price} coins.`, horse: h(0),
      action: (p) => ({ player: p, log: "" }) },
    { index: 4,  type: "coins_gain", label: "Vítěz dostihu",   emoji: "🏆", description: "+150 coins.",
      action: (p) => ({ player: { ...p, coins: p.coins + 150 }, log: `${p.name}: Vítěz dostihu — +150 💰` }) },
    { index: 5,  type: "coins_lose", label: "Daňový úřad",     emoji: "🏛️", description: "-80 coins.",
      action: (p) => ({ player: { ...p, coins: p.coins - 80 },  log: `${p.name}: Daňový úřad — -80 💰` }) },
    { index: 6,  type: "coins_gain", label: "Zlaté podkůvky",  emoji: "🥇", description: "+80 coins.",
      action: (p) => ({ player: { ...p, coins: p.coins + 80 },  log: `${p.name}: Zlaté podkůvky — +80 💰` }) },
    { index: 7,  type: "coins_lose", label: "Korupce",         emoji: "💸", description: "-120 coins.",
      action: (p) => ({ player: { ...p, coins: p.coins - 120 }, log: `${p.name}: Korupce — -120 💰` }) },
    { index: 8,  type: "chance",     label: "Náhoda",          emoji: "🎴", description: "Líznout kartu Náhoda.",
      action: (p) => ({ player: p, log: "" }) },
    { index: 9,  type: "coins_gain", label: "Dobrá sezona",    emoji: "🌟", description: "+90 coins.",
      action: (p) => ({ player: { ...p, coins: p.coins + 90 },  log: `${p.name}: Dobrá sezona — +90 💰` }) },
    { index: 10, type: "horse",      label: horses[1].name,    emoji: horses[1].emoji, description: `Kůň na prodej (rychlost ${horses[1].speed}) za ${horses[1].price} coins.`, horse: h(1),
      action: (p) => ({ player: p, log: "" }) },
    { index: 11, type: "coins_lose", label: "Krize na trhu",   emoji: "📉", description: "-50 coins.",
      action: (p) => ({ player: { ...p, coins: p.coins - 50 },  log: `${p.name}: Krize na trhu — -50 💰` }) },
    { index: 12, type: "coins_gain", label: "Bankéř",          emoji: "🏦", description: "+40 coins.",
      action: (p) => ({ player: { ...p, coins: p.coins + 40 },  log: `${p.name}: Bankéř — +40 💰` }) },
    { index: 13, type: "coins_lose", label: "Zákeřný soupeř",  emoji: "😈", description: "-70 coins.",
      action: (p) => ({ player: { ...p, coins: p.coins - 70 },  log: `${p.name}: Zákeřný soupeř — -70 💰` }) },
    { index: 14, type: "finance",    label: "Finance",          emoji: "💼", description: "Líznout kartu Finance.",
      action: (p) => ({ player: p, log: "" }) },
    { index: 15, type: "coins_gain", label: "Věrnostní bonus", emoji: "🎁", description: "+50 coins.",
      action: (p) => ({ player: { ...p, coins: p.coins + 50 },  log: `${p.name}: Věrnostní bonus — +50 💰` }) },
    { index: 16, type: "coins_lose", label: "Zloděj",          emoji: "🦹", description: "-70 coins.",
      action: (p) => ({ player: { ...p, coins: p.coins - 70 },  log: `${p.name}: Zloděj — -70 💰` }) },
    { index: 17, type: "horse",      label: horses[2].name,    emoji: horses[2].emoji, description: `Kůň na prodej (rychlost ${horses[2].speed}) za ${horses[2].price} coins.`, horse: h(2),
      action: (p) => ({ player: p, log: "" }) },
    { index: 18, type: "coins_lose", label: "Veterinář",       emoji: "💊", description: "-60 coins.",
      action: (p) => ({ player: { ...p, coins: p.coins - 60 },  log: `${p.name}: Veterinář — -60 💰` }) },
    { index: 19, type: "horse",      label: horses[3].name,    emoji: horses[3].emoji, description: `Kůň na prodej (rychlost ${horses[3].speed}) za ${horses[3].price} coins.`, horse: h(3),
      action: (p) => ({ player: p, log: "" }) },
    { index: 20, type: "chance",     label: "Náhoda",          emoji: "🎴", description: "Líznout kartu Náhoda.",
      action: (p) => ({ player: p, log: "" }) },
  ];
}
