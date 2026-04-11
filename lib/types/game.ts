/**
 * Centrální herní typy — sdílené mezi GameBoard, engine, repository.
 *
 * Importuj tyto typy místo definování vlastních ve komponentách.
 */

import type { GameCard } from "@/lib/cards";

// ─── Hráč ─────────────────────────────────────────────────────────────────────

export interface Horse {
  id?: string;
  name: string;
  speed: number;
  price: number;
  emoji: string;
}

export interface Player {
  id: string;
  game_id: string;
  name: string;
  position: number;
  color: string;
  coins: number;
  horses: Horse[];
  turn_order: number;
  skip_next_turn: boolean;
}

// ─── Herní stav ───────────────────────────────────────────────────────────────

export interface OfferPending {
  type: "reroll";
  playerId: string;
  playerName: string;
  cost: number;
}

export interface GameState {
  game_id: string;
  current_player_index: number;
  last_roll: number | null;
  log: string[];
  turn_count: number;
  horse_pending: boolean;
  card_pending: GameCard | null;
  offer_pending: OfferPending | null;
}
