/**
 * lib/board/shuffle.ts — deterministické promíchání non-racer polí herní desky.
 *
 * Shuffle je derivován z gameId (UUID) — stabilní pro celou hru, konzistentní
 * pro všechny klienty, nevyžaduje žádné DB změny.
 *
 * Jeden společný pool: chance, finance, mafia, coins_gain, coins_lose.
 * Přehazuje se celý field payload (type + label + emoji + flavorText + amount).
 * Racer a start zůstávají pevné.
 */

import type { BoardConfig, BoardFieldConfig, BoardFieldType } from "./types";

const CARD_TYPES  = new Set<BoardFieldType>(["chance", "finance", "mafia"]);
const PAYOUT_TYPES = new Set<BoardFieldType>(["coins_gain", "coins_lose"]);

/** FNV-1a hash z UUID řetězce → deterministický seed. */
function seedFromId(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193) | 0;
  }
  return h >>> 0;
}

/** LCG krok — deterministický pseudonáhodný generátor. */
function lcgNext(s: number): number {
  return (Math.imul(1664525, s) + 1013904223) >>> 0;
}

/** Fisher-Yates shuffle na kopii pole, deterministicky podle seedu. */
function seededShuffle<T>(items: T[], seed: number): T[] {
  const arr = [...items];
  let s = seed;
  for (let i = arr.length - 1; i > 0; i--) {
    s = lcgNext(s);
    const j = s % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Celý přenositelný obsah pole — vše kromě index (ten zůstane pevný). */
type ShufflePayload = Pick<BoardFieldConfig, "type" | "label" | "emoji" | "flavorText" | "amount">;

/** Promíchá jeden pool polí a vrátí swapMap index → nový payload. */
function buildSwapMap(
  fields: BoardFieldConfig[],
  types: Set<BoardFieldType>,
  seed: number,
): Map<number, ShufflePayload> {
  const pool = fields.filter(f => types.has(f.type as BoardFieldType));
  if (pool.length <= 1) return new Map();

  const payloads: ShufflePayload[] = pool.map(f => ({
    type:       f.type,
    label:      f.label,
    emoji:      f.emoji,
    flavorText: f.flavorText,
    amount:     f.amount,
  }));

  const shuffled = seededShuffle(payloads, seed);
  return new Map(pool.map((f, i) => [f.index, shuffled[i]]));
}

/**
 * applyBoardShuffle — vrátí kopii BoardConfig se dvěma nezávislými shuffle pooly.
 *
 * Card pool (chance / finance / mafia): mísí se jen mezi card pozicemi.
 * Payout pool (coins_gain / coins_lose): mísí se jen mezi payout pozicemi,
 *   celý payload (type + label + emoji + amount + flavorText) se přesouvá spolu.
 *
 * Racer a start zůstávají pevné. Pokud gameId je null, vrátí board beze změny.
 */
export function applyBoardShuffle(board: BoardConfig, gameId: string | null): BoardConfig {
  if (!gameId) return board;

  const seed = seedFromId(gameId);

  const cardSwap   = buildSwapMap(board.fields, CARD_TYPES,   seed);
  const payoutSwap = buildSwapMap(board.fields, PAYOUT_TYPES, seed);

  const newFields = board.fields.map(f => {
    const swap = cardSwap.get(f.index) ?? payoutSwap.get(f.index);
    return swap ? { ...f, ...swap } : f;
  });

  return { ...board, fields: newFields };
}
