/**
 * lib/board/types.ts — datový kontrakt pro konfiguraci herní desky.
 *
 * BoardConfig odděluje STRUKTURU hry (počet polí, jejich typy, coin amounts)
 * od VIZUÁLU (ThemeManifest) a od HERNÍ LOGIKY (lib/engine.ts).
 *
 * Tok:
 *   BoardConfig + RacerConfig[] → buildFields() → Field[] → herní runtime
 */

// ─── Identifikátor presetu ────────────────────────────────────────────────────

/** Dostupné board presety. "small" = kruhový layout. "small-stadium" = stadionový layout. "large" připraveno pro budoucí preset. */
export type BoardPresetId = "small" | "large" | "small-stadium";

// ─── Typy polí ────────────────────────────────────────────────────────────────

/**
 * BoardFieldType — platné typy polí v board konfiguraci.
 *
 * Neobsahuje "horse" — to je pouze runtime alias v engine, ne validní config hodnota.
 * "gamble" a "neutral" jsou připraveny pro budoucí presety; SMALL_BOARD je nepoužívá.
 */
export type BoardFieldType =
  | "start"
  | "coins_gain"
  | "coins_lose"
  | "gamble"
  | "racer"
  | "neutral"
  | "chance"
  | "finance";

// ─── Konfigurace pole ─────────────────────────────────────────────────────────

/**
 * BoardFieldConfig — statická konfigurace jednoho pole herní desky.
 *
 * Pro racer pole: label a emoji jsou placeholdery — buildFields() je přepíše daty z RacerConfig.
 * Pro coins_gain / coins_lose: amount je coin delta (kladné = zisk, záporné = ztráta).
 * Pro start: amount = start bonus (typicky 200).
 * Pro ostatní typy: amount není relevantní.
 */
export interface BoardFieldConfig {
  index: number;
  type: BoardFieldType;
  label: string;
  emoji: string;
  /**
   * Coin delta pro toto pole.
   * - coins_gain: kladné číslo (+100 = hráč dostane 100 coins)
   * - coins_lose: záporné číslo (-60 = hráč přijde o 60 coins)
   * - start: kladné číslo (bonus za přistání na START)
   * - ostatní typy: undefined
   */
  amount?: number;
  /**
   * Flavor text / příběh pole — zobrazí se při hoveru jako detail karty.
   * Volitelné pro všechny typy polí.
   * Pro racer pole: zobrazí se místo (nebo vedle) flavor textu závodníka z RacerConfig.flavorText.
   * Příklad: "Toto místo skrývá nebezpečné sázky, ale i velké příležitosti…"
   */
  flavorText?: string;
}

// ─── Board preset ─────────────────────────────────────────────────────────────

/**
 * BoardConfig — kompletní konfigurace jednoho presetu herní desky.
 *
 * Obsahuje vše potřebné pro buildFields() kromě závodníků (ti přicházejí z ThemeManifest).
 * fieldCount MUSÍ odpovídat fields.length — ověřuje validateBoardConfig().
 *
 * racerSlotIndexes: indexy polí kde sedí závodníci, v pořadí 1:1 mapovaném na theme.racers[].
 * Tj. první hodnota v racerSlotIndexes odpovídá theme.racers[0], druhá theme.racers[1] atd.
 */
export interface BoardConfig {
  id: BoardPresetId;
  fieldCount: number;
  fields: BoardFieldConfig[];
  /**
   * Indexy polí která jsou racer sloty, v pořadí.
   * Musí odpovídat poli type:"racer" v fields.
   * buildFields() mapuje: racerSlotIndexes[0] → racers[0], racerSlotIndexes[1] → racers[1], …
   */
  racerSlotIndexes: number[];
  /**
   * Tvar herní desky — určuje layout pozic polí a SVG tratě.
   * "circle" (výchozí): 21 polí rovnoměrně na kružnici.
   * "stadium": 21 polí na stadionovém okruhu (rovné strany + zaoblené konce).
   */
  shape?: "circle" | "stadium";
}
