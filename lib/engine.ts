/**
 * Herní engine — čisté funkce bez závislosti na Reactu nebo Supabase.
 *
 * Pravidla:
 * - žádné importy z Reactu
 * - žádné importy ze Supabase
 * - každá funkce je testovatelná izolovaně
 * - logika hry patří sem, ne do komponent
 *
 * Terminologie:
 * - "racer" = obecný závodník (kůň, auto, …); theme určuje UI název via labels.racer
 * - "horse" v FieldType je @deprecated; buildFields generuje type "racer"
 */

import type { Player, Horse, GameState, OfferPending } from "./types/game";
import type { RacerConfig } from "./themes";
import type { GameCard } from "./cards";
import type { BoardConfig } from "./board";

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
  | "racer"    // nový kanonický typ racerového pole
  | "horse"    // @deprecated legacy — zachováno pro zpětnou kompatibilitu
  | "neutral"
  | "chance"
  | "finance";

export interface Field {
  index: number;
  type: FieldType;
  label: string;
  emoji: string;
  description: string;
  /**
   * Závodník nabízený na tomto poli.
   * Nové pole: `racer` — kanonický název.
   * Legacy alias: `horse` — pro starší kód který ještě nemigroval.
   */
  racer?: Horse;
  /** @deprecated použij racer */
  horse?: Horse;
  /**
   * Flavor text / příběh pole nebo závodníka.
   * Pro racer pole: přenesen z RacerConfig.flavorText (fallback: RacerConfig.heroText pro compat).
   * Pro ostatní pole: přenesen z BoardFieldConfig.flavorText.
   * Použij pro hover detail na kartě. Undefined pokud theme ani board text nedefinují.
   */
  flavorText?: string;
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

// ─── Racer ownership ──────────────────────────────────────────────────────────

/**
 * playerOwnsRacer — zkontroluje, zda hráč vlastní daného závodníka.
 *
 * Lookup priorita:
 *   1. id-based   — když mají oba (horse v player.horses i racer) id → porovnání přes id
 *   2. name-based — fallback pro stará data bez id (zakoupeno před přidáním id do modelu)
 *
 * Poznámka: `player.horses` je kanonické pole vlastnictví — žádné `player.racers` neexistuje.
 */
export function playerOwnsRacer(player: Player, racer: Horse): boolean {
  return player.horses.some(h =>
    (racer.id && h.id) ? h.id === racer.id : h.name === racer.name
  );
}

/**
 * racerOwnershipKey — vrátí klíč pro racerOwnership mapu: id ?? name.
 * Konzistentní pro build i lookup.
 */
export function racerOwnershipKey(racer: Pick<Horse, "id" | "name">): string {
  return racer.id ?? racer.name;
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
    mass_race_done: Boolean(r.mass_race_done ?? false),
  };
}

// ─── Deska ────────────────────────────────────────────────────────────────────

/**
 * buildFields — sestaví herní pole z BoardConfig + závodníků theme.
 *
 * Vstup:
 *   board   — konfigurace desky (typy polí, pořadí, coin amounts, racer sloty)
 *   racers  — závodníci theme (RacerConfig[]), mapováni 1:1 na board.racerSlotIndexes
 *
 * Výstup: Field[] ve stejném runtime tvaru jako dříve — GameBoard.tsx se nemění.
 *
 * Coin amounts, typy polí a racer sloty jsou nyní v BoardConfig, ne hardcoded tady.
 * Engine zůstává čistý — žádná data, jen transformace.
 */
export function buildFields(board: BoardConfig, racers: RacerConfig[]): Field[] {
  let racerSlotCount = 0;

  return board.fields.map((fc): Field => {
    // ── Racer pole ──────────────────────────────────────────────────────────
    if (fc.type === "racer") {
      const rc = racers[racerSlotCount++];
      if (!rc) {
        // Board má víc racer slotů než theme poskytuje závodníků — bezpečný fallback
        console.warn(`[buildFields] Board "${board.id}" slot ${fc.index}: chybí závodník (theme má jen ${racers.length}).`);
        return {
          index: fc.index, type: "racer", label: fc.label, emoji: fc.emoji,
          description: fc.label,
          action: (p) => ({ player: p, log: "" }),
        };
      }
      // maxStamina: katalogový strop; fallback na deprecated rc.stamina → undefined
      // stamina: runtime inicializovaná z maxStamina; fallback 100 aplikuje herní logika
      const catalogMaxStamina = rc.maxStamina ?? rc.stamina;
      const r: Horse = {
        id:         rc.id,
        name:       rc.name,
        speed:      rc.speed,
        price:      rc.price,
        emoji:      rc.emoji,
        maxStamina: catalogMaxStamina,
        stamina:    catalogMaxStamina,
      };
      return {
        index:       fc.index,
        type:        "racer",
        label:       rc.name,
        emoji:       rc.emoji,
        description: `${rc.name} na prodej (rychlost ${rc.speed}) za ${rc.price} coins.`,
        racer:       r,
        horse:       r, // @deprecated legacy alias
        // flavorText: preferuj rc.flavorText; fallback na rc.heroText (deprecated, backward compat)
        flavorText:  rc.flavorText ?? rc.heroText,
        action:      (p) => ({ player: p, log: "" }),
      };
    }

    // ── START pole ──────────────────────────────────────────────────────────
    if (fc.type === "start") {
      const bonus = fc.amount ?? 200;
      return {
        index:       fc.index,
        type:        "start",
        label:       fc.label,
        emoji:       fc.emoji,
        description: `Průchod = +${bonus} coins.`,
        flavorText:  fc.flavorText,
        action:      (p) => ({
          player: { ...p, coins: p.coins + bonus },
          log:    `${p.name} prošel STARTem — +${bonus} 💰`,
        }),
      };
    }

    // ── Coins gain ──────────────────────────────────────────────────────────
    if (fc.type === "coins_gain") {
      const amount = fc.amount ?? 0;
      return {
        index:       fc.index,
        type:        "coins_gain",
        label:       fc.label,
        emoji:       fc.emoji,
        description: `+${amount} coins.`,
        flavorText:  fc.flavorText,
        action:      (p) => ({
          player: { ...p, coins: p.coins + amount },
          log:    `${p.name}: ${fc.label} — +${amount} 💰`,
        }),
      };
    }

    // ── Coins lose ──────────────────────────────────────────────────────────
    if (fc.type === "coins_lose") {
      const amount = fc.amount ?? 0; // záporné číslo, např. -60
      return {
        index:       fc.index,
        type:        "coins_lose",
        label:       fc.label,
        emoji:       fc.emoji,
        description: `${amount} coins.`,
        flavorText:  fc.flavorText,
        action:      (p) => ({
          player: { ...p, coins: p.coins + amount },
          log:    `${p.name}: ${fc.label} — ${amount} 💰`,
        }),
      };
    }

    // ── Ostatní typy (chance, finance, gamble, neutral) — no-op action ─────
    return {
      index:       fc.index,
      type:        fc.type as FieldType,
      label:       fc.label,
      emoji:       fc.emoji,
      description: fc.label,
      flavorText:  fc.flavorText,
      action:      (p) => ({ player: p, log: "" }),
    };
  });
}
