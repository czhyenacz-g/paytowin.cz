/**
 * Centrální herní typy — sdílené mezi GameBoard, engine, repository.
 *
 * Importuj tyto typy místo definování vlastních ve komponentách.
 */

import type { GameCard } from "@/lib/cards";

// Stamina cost per tap during racing minigame.
// Keep in sync with RaceEventOverlay.tsx if defined there separately.
export const STAMINA_PER_TAP = 2;

// ─── Hráč ─────────────────────────────────────────────────────────────────────

export interface Horse {
  id?: string;
  name: string;
  speed: number;
  price: number;
  emoji: string;
  stamina?: number;    // 0–100, výchozí 100; snižuje se závodem (−30), regeneruje se po tahu (+10)
  isPreferred?: boolean; // označen hráčem jako preferovaný pro příští závod
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

export interface RerollOffer {
  type: "reroll";
  playerId: string;
  playerName: string;
  cost: number;
}

export interface RaceOffer {
  type: "race";
  phase: "racing" | "results";
  currentRacerIndex: number;
  playerIds: string[];
  scores: Record<string, number>;
}

export interface BankruptAnnouncement {
  type: "bankrupt_announcement";
  playerName: string;
  playerId: string;
  nextIndex: number;
  turnCount: number;
  lastRoll?: number;
}

/**
 * Výběr závodníků před startem závodu.
 * Každý aktivní hráč postupně vybere svého závodníka (currentSelectorIndex → playerIds[i]).
 * Po výběru posledního se přejde na dalšího hráče (nextIndex/turnCount).
 */
export interface RacePendingEvent {
  type: "race_pending";
  nextIndex: number;
  turnCount: number;
  lastRoll?: number;
  playerIds: string[];
  currentSelectorIndex: number;
  selections: Record<string, string>; // playerId → racerOwnershipKey
  phase?: "selecting" | "countdown" | "racing" | "results";
  currentRacerIndex?: number;         // kdo právě závodí (racing fáze)
  scores?: Record<string, number>;    // playerId → počet tapů
  finalStaminas?: Record<string, number>; // playerId → stamina po závodě (0 = kůň vyřazen)
}

export type OfferPending = RerollOffer | RaceOffer | BankruptAnnouncement | RacePendingEvent;

/**
 * PostTurnEvent — caller-facing payload pro post-turn hook ve finishTurn.
 * Zobrazí se všem klientům po dokončení tahu, před dalším tahem.
 *
 * Aktuálně podporovaný druh:
 *   "announcement" — krátký informační overlay (bankrot, …)
 *
 * Připraveno pro budoucí rozšíření — přidej nový kind do union:
 *   | { kind: "race_pending"; … }
 */
export type PostTurnEvent =
  | { kind: "announcement"; playerName: string; playerId: string }
  | { kind: "race_pending"; playerIds: string[] };

export interface GameState {
  game_id: string;
  current_player_index: number;
  last_roll: number | null;
  log: string[];
  turn_count: number;
  horse_pending: boolean;
  card_pending: GameCard | null;
  offer_pending: OfferPending | null;
  mass_race_done: boolean; // true po prvním automatickém mass race — trigger se pak nepustí znovu
}
