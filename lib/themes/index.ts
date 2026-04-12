import { defaultTheme } from "./default";
import { darkTheme } from "./dark";
import { classicRaceTheme } from "./classic-race";
import type { GameCard } from "@/lib/cards";

// ─── Field style keys ─────────────────────────────────────────────────────────

/**
 * "racer" je nový kanonický typ racerového pole.
 * "horse" je zachován jako legacy — starý field type z dob kdy engine znal jen koně.
 * Nové theme soubory definují oboje; buildFields generuje "racer".
 */
export type FieldStyleKey =
  | "start"
  | "coins_gain"
  | "coins_lose"
  | "gamble"
  | "racer"    // nový kanonický typ
  | "horse"    // @deprecated legacy alias — zachováno pro kompatibilitu
  | "neutral"
  | "chance"
  | "finance";

// ─── RacerConfig ──────────────────────────────────────────────────────────────

/**
 * RacerConfig — kanonický typ pro entitu závodníka v theme.
 *
 * Může reprezentovat koně, auto, mořského koníka nebo cokoliv jiného.
 * Theme určuje, jak se racer v UI nazývá (viz ThemeLabels.racer).
 */
export interface RacerConfig {
  id: string;
  name: string;
  speed: number;
  price: number;
  emoji: string;
  /** Volitelná přímá URL obrázku — theme builder ji vyplní. Fallback: emoji. */
  image?: string;
}

/**
 * HorseConfig — @deprecated legacy alias pro RacerConfig.
 * Existující theme soubory používající `horses: HorseConfig[]` stále fungují.
 * Nové theme soubory by měly používat `racers: RacerConfig[]`.
 */
export type HorseConfig = RacerConfig;

// ─── ThemeColors ──────────────────────────────────────────────────────────────

export interface ThemeColors {
  pageBackground: string;
  cardBackground: string;
  boardSurface: string;
  boardSurfaceBorder: string;
  centerBackground: string;
  centerBorder: string;
  centerTitle: string;
  centerSubtitle: string;
  /** Tailwind class string pro každý typ pole. Musí obsahovat "racer" i "horse" (legacy). */
  fieldStyles: Record<FieldStyleKey, string>;
  activePlayerBadge: string;
  rollPanelIdle: string;
  rollPanelRolling: string;
  textPrimary: string;
  textMuted: string;
  playerCardActive: string;
  playerCardNormal: string;
  playerCardHover: string;
}

// ─── ThemeLabels ──────────────────────────────────────────────────────────────

/**
 * ThemeLabels — všechny UI texty theme.
 * UI nesmí mít hardcoded texty — čte je odsud.
 *
 * racer / racers / racerField dovoluje theme nazývat závodníka libovolně:
 *   dostihy:  racer="Kůň",  racers="Koně",  racerField="Stáj"
 *   auta:     racer="Auto", racers="Auta",  racerField="Garáž"
 */
export interface ThemeLabels {
  themeName: string;
  centerTitle: string;
  centerSubtitle: string;
  /** Legenda typů polí na desce */
  legend: {
    gain: string;
    lose: string;
    gamble: string;
    horse: string;  // TODO: přejmenovat na "racer" v příštím čištění labels
  };
  /** Jak theme nazývá jednoho závodníka, např. "Kůň" nebo "Auto" */
  racer: string;
  /** Jak theme nazývá závodníky v množném čísle, např. "Koně" nebo "Auta" */
  racers: string;
  /** Jak theme nazývá místo kde závodníci stojí, např. "Stáj" nebo "Garáž" */
  racerField: string;
}

// ─── ThemeAssets ──────────────────────────────────────────────────────────────

/**
 * ThemeAssets — volitelné obrazové assety theme.
 *
 * racerImages je nový kanonický název.
 * horseImages je @deprecated — zachováno pro zpětnou kompatibilitu.
 * resolveRacerDisplay() zkusí nejprve racerImages, pak horseImages, pak emoji.
 */
export interface ThemeAssets {
  boardBgImage?: string;
  /** Kanonický: racer.id → image URL */
  racerImages?: Partial<Record<string, string>>;
  /** @deprecated použij racerImages */
  horseImages?: Partial<Record<string, string>>;
  fieldTextures?: Partial<Record<string, string>>;
}

// ─── ThemeContent ─────────────────────────────────────────────────────────────

/** Volitelný herní obsah per theme — připraveno pro theme builder, zatím nepoužíváno. */
export interface ThemeContent {
  cards?: {
    chance?: GameCard[];
    finance?: GameCard[];
  };
}

// ─── Theme ────────────────────────────────────────────────────────────────────

export interface Theme {
  id: string;
  name: string;
  description: string;
  isPaid: boolean;
  priceCzk: number;
  colors: ThemeColors;
  labels: ThemeLabels;
  /** Kanonický seznam závodníků — nové theme soubory vyplňují toto. */
  racers?: RacerConfig[];
  /**
   * @deprecated Legacy — staré theme soubory, které ještě nebyly migrovány.
   * Engine čte přes getThemeRacers(), ne přímo.
   */
  horses?: RacerConfig[];
  assets?: ThemeAssets;
  content?: ThemeContent;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * getThemeRacers — kompatibilitní most horses → racers.
 *
 * Vrací závodníky z theme. Pořadí fallbacků:
 *   1. theme.racers (nový kanonický zdroj)
 *   2. theme.horses (legacy fallback)
 *   3. [] (prázdné — theme není správně nakonfigurovaný)
 *
 * Engine a UI NIKDY nečtou theme.horses přímo — vždy přes tuto funkci.
 */
export function getThemeRacers(theme: Theme): RacerConfig[] {
  return theme.racers ?? theme.horses ?? [];
}

// ─── Registr témat ────────────────────────────────────────────────────────────

export const THEMES: Theme[] = [defaultTheme, darkTheme, classicRaceTheme];

/** Vrátí theme podle id; pokud není nalezeno nebo id je null, vrátí default. */
export function getThemeById(id: string | null | undefined): Theme {
  return THEMES.find((t) => t.id === id) ?? defaultTheme;
}
