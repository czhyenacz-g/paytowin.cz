import { horseDayTheme } from "./horse-day";
import { horseNightTheme } from "./horse-night";
import { horseClassicTheme } from "./horse-classic";
import { carDayTheme } from "./car-day";
import { carNightTheme } from "./car-night";
import type { GameCard, CardThemeTag } from "@/lib/cards";
import type { MusicSource } from "@/lib/audio/music";
import type { RacerType } from "@/lib/racers/types";
import type { YearEventOverrides } from "@/lib/year-events";
import type { BoardConfig } from "@/lib/board";

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
  | "finance"
  | "mafia";

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
  /**
   * Maximální / výchozí stamina závodníka — katalogová vlastnost (0–100, výchozí 100).
   * Při zakoupení se zkopíruje do Horse.stamina (runtime aktuální hodnota).
   * Regen se zastaví na této hodnotě — racer nemůže přesáhnout svůj vlastní strop.
   * Pokud není uvedena, použije se fallback 100.
   */
  maxStamina?: number;
  /**
   * @deprecated Použij maxStamina.
   * Zachováno pro backward kompatibilitu se staršími daty.
   * engine.ts aplikuje fallback: maxStamina ?? stamina.
   */
  stamina?: number;
  /**
   * Legendární status racera — identita / flavor kategorie, NEZÁVISLÁ na maxStamina.
   * Pokud true, při ztrátě racera (stamina = 0) se zobrazí speciální flavor hláška.
   * Vhodné pro racery s unikátním příběhem nebo záměrně jednorázovým designem.
   */
  isLegendary?: boolean;
  /**
   * Flavor text / příběh závodníka — zobrazuje se při hoveru na racer kartu.
   * Volitelné — pokud chybí, karta neukáže popis.
   * Příklad: "Veterán závodního okruhu, který ještě neřekl své poslední slovo…"
   */
  flavorText?: string;
  /**
   * @deprecated Použij flavorText.
   * Zachováno pro backward kompatibilitu se staršími daty.
   * buildFields() aplikuje fallback: flavorText ?? heroText.
   */
  heroText?: string;
  /**
   * Označení vestavěného závodníka — nelze editovat ani smazat v builder UI.
   * Nastaveno automaticky: v ThemeDevTool když je theme.source === "built-in".
   * Neperzistuje do DB při exportu — je to UI-level signalizace.
   */
  isBuiltIn?: boolean;
  /**
   * Explicitní přiřazení na slot (index racer pole na boardu).
   * Zatím nepoužíváno v buildFields() — slot je stále implicitní (pořadí v arrayi).
   * Groundwork pro budoucí Racer Registry: po zavedení registry bude toto pole
   * nahrazovat implicitní pořadí a umožní selectbox výběr.
   */
  slotIndex?: number;
  /**
   * Skupina závodníka — přenáší se z RacerProfile.type přes adaptér.
   * Používá se v Racer Admin pro seskupení a filtrování.
   * Nemá vliv na herní logiku.
   */
  racerType?: RacerType;
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
  /**
   * Volitelný CSS gradient pro backdrop celé herní obrazovky (min-h-screen div).
   * Pokud není uveden, použije se flat `pageBackground`.
   * Vytváří "venue atmosphere" kolem boardu — tráva, beton, aréna.
   */
  arenaGradient?: string;
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
    racer: string;
  };
  /** Jak theme nazývá jednoho závodníka, např. "Kůň" nebo "Auto" */
  racer: string;
  /** Jak theme nazývá závodníky v množném čísle, např. "Koně" nebo "Auta" */
  racers: string;
  /** Jak theme nazývá místo kde závodníci stojí, např. "Stáj" nebo "Garáž" */
  racerField: string;
  /** Emoji závodníka pro pohybové stavy UI, např. "🐎" nebo "🏎️" */
  racingEmoji: string;
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

// ─── MapMeta ──────────────────────────────────────────────────────────────────

/** Příběhové metadata mapy — rok startu, místo závodu, flavor subtitle. */
export interface MapMeta {
  /** Rok, ve kterém tato mapa začíná. Rok se zvyšuje o 1 za každé odehrané kolo. */
  yearStart: number;
  /** Název místa závodu, např. "Connecticut" nebo "Chicago". */
  place: string;
  /** Krátký flavor text zobrazený v intro overlayi. */
  subtitle: string;
}

// ─── ThemeContent ─────────────────────────────────────────────────────────────

/** Volitelný herní obsah per theme — připraveno pro theme builder, zatím nepoužíváno. */
export interface ThemeContent {
  cards?: {
    chance?: GameCard[];
    finance?: GameCard[];
    mafia?: GameCard[];
  };
}

// ─── Theme ────────────────────────────────────────────────────────────────────

export interface Theme {
  id: string;
  name: string;
  description: string;
  version?: string;
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
  /**
   * Racer Registry reference — nový kanonický způsob přiřazení závodníků k theme.
   *
   * Pokud přítomno: runtime načte závodníky z globální registry (`racers` tabulky).
   * Pokud chybí: runtime použije inline `racers` (backward compatible fallback).
   *
   * Propagováno do ThemeManifest.racerRefs přes themeToManifest().
   * Inline `racers` zůstává jako fallback (+ off-board legendary lookup pro give_racer).
   */
  racerRefs?: Array<{ slotIndex: number; racer_id: string }>;
  assets?: ThemeAssets;
  content?: ThemeContent;
  mapMeta?: MapMeta;
  /** Tematický tag pro filtrování karetního balíčku. Pokud chybí, losují se jen "common" karty. */
  cardThemeTag?: CardThemeTag;
  /** Background music pro tuto mapu/theme. Pokud není definováno, hraje ticho. */
  music?: MusicSource;
  /**
   * Volitelné přetížení year eventů pro toto theme.
   * Partial — theme definuje jen eventy které chce změnit, zbytek se vezme z globalů.
   * Viz YearEventOverrides v lib/year-events.ts.
   */
  yearEvents?: YearEventOverrides;
  /**
   * Volitelné přetížení board konfiguraci pro toto theme.
   * Pokud přítomno: runtime i editor použijí tuto desku místo sdíleného presetu.
   * Pokud chybí: fallback na SMALL_BOARD (výchozí preset).
   */
  board?: BoardConfig;
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

// ─── ThemeManifest + validator ────────────────────────────────────────────────

export type { ThemeManifest } from "./manifest";
export { themeToManifest } from "./manifest";
// Validátor — importuj z lib/themes/validator pro přímé použití
// nebo z lib/themes (zde) pro convenience
export { validateThemeManifest, crossCheckBoardAndTheme } from "./validator";
// Loader — POZOR: importuj přímo z lib/themes/loader, ne odsud (circular dep)
// import { loadThemeManifest } from "@/lib/themes/loader"

// ─── Registr témat ────────────────────────────────────────────────────────────

export const THEMES: Theme[] = [horseDayTheme, horseNightTheme, horseClassicTheme, carDayTheme, carNightTheme];

/** Vrátí theme podle id; pokud není nalezeno nebo id je null, vrátí horse-day. */
export function getThemeById(id: string | null | undefined): Theme {
  return THEMES.find((t) => t.id === id) ?? horseDayTheme;
}
