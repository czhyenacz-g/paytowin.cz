/**
 * Centrální herní typy — sdílené mezi GameBoard, engine, repository.
 *
 * Importuj tyto typy místo definování vlastních ve komponentách.
 */

import type { GameCard } from "@/lib/cards";

// ─── Ekonomika hry ────────────────────────────────────────────────────────────

/** Konfigurace herní ekonomiky — ukládá se jako JSONB v games.economy. */
export interface EconomyConfig {
  /** Coins za průchod STARTem (dotace od státu). */
  stateSubsidy: number;
  /** Základ daně za každý průchod STARTem (od 2. průchodu). */
  baseTax: number;
  /** Koeficient růstu daně — baseTax se násobí tímto číslem pro výpočet daně za kolo. */
  lapTaxCoefficient: number;
  /** Stropní hodnota daně. */
  maxTax: number;
}

export const DEFAULT_ECONOMY: EconomyConfig = {
  stateSubsidy: 2000,
  baseTax: 500,
  lapTaxCoefficient: 1,
  maxTax: 5000,
};

// Stamina cost per tap during racing minigame.
// Keep in sync with RaceEventOverlay.tsx if defined there separately.
export const STAMINA_PER_TAP = 2;

// ─── Dočasné efekty ───────────────────────────────────────────────────────────

/**
 * ActiveEffect — dočasný efekt aplikovaný na hráče.
 *
 * turnsLeft se dekrementuje v finishTurn (= počet tahů daného hráče, ne globálních tahů).
 * Po dosažení 0 se efekt odstraní.
 *
 * Rozšiřitelné: přidej nový kind do union (např. "speed_debuff") a příslušnou logiku v GameBoard.
 */
export interface ActiveEffect {
  kind: "stamina_debuff";
  /** Multiplikátor aplikovaný na staminaMultiplier při závodě. 0.5 = poloviční výkon. */
  factor: number;
  /** Kolik hráčových tahů ještě efekt trvá. */
  turnsLeft: number;
}

// ─── Hráč ─────────────────────────────────────────────────────────────────────

/**
 * Horse — runtime reprezentace závodníka.
 *
 * Používán ve třech kontextech — viz komentáře níže:
 *   1. RacerConfig  (lib/themes/index.ts) — katalogová definice v theme; neměnná pravda
 *   2. OwnedRacer   — snapshot při nákupu; uložen v player.horses (DB JSONB)
 *   3. Field.racer  — kopie pro zobrazení na poli; sestaven z RacerConfig přes normalizeRacer()
 *
 * Alias OwnedRacer (níže) zpřesňuje sémantiku pro případ 2.
 * Připraveno pro budoucí Racer Registry — až bude registry hotové, OwnedRacer se stane referencí (racer_id).
 */
export interface Horse {
  id?: string;
  name: string;
  speed: number;
  price: number;
  emoji: string;
  /** Katalogový strop staminy (0–100) — kopíruje se z RacerConfig.maxStamina při nákupu.
   *  Regen se zastaví na této hodnotě. Stará data bez tohoto pole: fallback 100. */
  maxStamina?: number;
  /** Aktuální runtime stamina (0–maxStamina); snižuje se závodem, regeneruje se po tahu. */
  stamina?: number;
  /** Legendární status — kopíruje se z RacerConfig.isLegendary. Ovlivňuje hlášku při ztrátě racera. */
  isLegendary?: boolean;
  isPreferred?: boolean; // označen hráčem jako preferovaný pro příští závod
  /** Volitelná URL obrázku — kopíruje se z RacerConfig.image. Fallback: emoji. */
  image?: string;
}

/**
 * OwnedRacer — závodník vlastněný hráčem (kontexty 2 výše).
 *
 * Strukturou identický s Horse; alias zpřesňuje sémantiku na call-site.
 * Uložen jako DB JSONB v player.horses — obsahuje snapshot katalogových dat
 * (id, speed, price, maxStamina) + runtime stav (stamina, isPreferred).
 *
 * Pozn.: id může chybět u velmi starých dat → racerOwnershipKey() fallbackuje na name.
 * Po Racer Registry migraci: OwnedRacer = { racer_id: string; stamina: number; isPreferred?: boolean }
 */
export type OwnedRacer = Horse;

export interface Player {
  id: string;
  game_id: string;
  name: string;
  position: number;
  color: string;
  coins: number;
  /** Vlastněné závodníky — OwnedRacer snapshoty, uloženy jako JSONB v DB. Viz typ OwnedRacer níže. */
  horses: OwnedRacer[];
  turn_order: number;
  skip_next_turn: boolean;
  /** Discord user ID — null pro hráče bez Discord loginu nebo stará data. */
  discord_id?: string | null;
  /** Discord CDN URL avataru — null pokud hráč nemá Discord nebo URL není k dispozici. */
  discord_avatar_url?: string | null;
  /** Počet průchodů STARTem. Daně začínají od laps=1 (druhý průchod). */
  laps?: number;
  /** Aktuálně aktivní dočasné efekty (debuffs apod.). Uloženy jako JSONB v DB. */
  active_effects?: ActiveEffect[];
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
 * Typ závodu — rozlišuje varianty race flow.
 *
 * mass_race   — všichni aktivní hráči závodí najednou (současná implementace)
 * rivals_race — zatím neimplementováno; vyhrazeno pro budoucí variantu
 */
export type RaceType = "mass_race" | "rivals_race";

/**
 * Výběr závodníků před startem závodu.
 * Každý aktivní hráč postupně vybere svého závodníka (currentSelectorIndex → playerIds[i]).
 * Po výběru posledního se přejde na dalšího hráče (nextIndex/turnCount).
 */
export interface RacePendingEvent {
  type: "race_pending";
  raceType?: RaceType;                // výchozí: "mass_race" (optional pro zpětnou kompatibilitu)
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
  reward?: number;    // výhra pro vítěze; rivals_race = % z ceny pole, mass_race použije RACE_WINNER_REWARD
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
  | { kind: "race_pending"; playerIds: string[]; raceType?: RaceType; reward?: number };

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
