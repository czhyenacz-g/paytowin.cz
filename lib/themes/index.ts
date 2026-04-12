import { defaultTheme } from "./default";
import { darkTheme } from "./dark";
import { classicRaceTheme } from "./classic-race";
import type { GameCard } from "@/lib/cards";

// Typy polí na desce (musí odpovídat FieldType v engine.ts)
export type FieldStyleKey = "start" | "coins_gain" | "coins_lose" | "gamble" | "horse" | "neutral" | "chance" | "finance";

/** Definice koně v rámci theme — 4 koně v pořadí mapovaném na pevné pozice desky. */
export interface HorseConfig {
  id: string;
  name: string;
  speed: number;
  price: number;
  emoji: string;
}

export interface ThemeColors {
  // Stránka
  pageBackground: string;
  // Karty (board, panel, log)
  cardBackground: string;
  // Herní plocha (ovál)
  boardSurface: string;
  boardSurfaceBorder: string;
  // Střed desky
  centerBackground: string;
  centerBorder: string;
  centerTitle: string;
  centerSubtitle: string;
  // Styl jednotlivých typů polí — celý class string (size + barvy)
  fieldStyles: Record<FieldStyleKey, string>;
  // "Na tahu" badge
  activePlayerBadge: string;
  // Panel s kostkou
  rollPanelIdle: string;
  rollPanelRolling: string;
  // Texty
  textPrimary: string;
  textMuted: string;
  // Karty hráčů v panelu
  playerCardActive: string;
  playerCardNormal: string;
  playerCardHover: string;
}

/**
 * Texty zobrazované v UI — UI nesmí mít hardcoded texty mimo tuto strukturu.
 */
export interface ThemeLabels {
  themeName: string;
  centerTitle: string;
  centerSubtitle: string;
  /** Legenda polí na desce */
  legend: {
    gain: string;    // např. "zisk"
    lose: string;    // např. "ztráta"
    gamble: string;  // např. "hazard"
    horse: string;   // např. "kůň"
  };
}

/**
 * Volitelná obrazová aktiva theme — pro vizuální skiny a theme builder.
 * UI preferuje images před emoji pokud jsou k dispozici.
 */
export interface ThemeAssets {
  /** URL nebo cesta k /public pro pozadí desky */
  boardBgImage?: string;
  /** horseId → image URL; UI fallback na horse.emoji */
  horseImages?: Partial<Record<string, string>>;
  /** fieldLabel nebo fieldType → image/texture URL */
  fieldTextures?: Partial<Record<string, string>>;
}

/**
 * Volitelný herní obsah specifický pro theme.
 * Zatím jen placeholder — nepoužívá se v herní logice.
 * Připraveno pro theme builder a lokalizaci.
 */
export interface ThemeContent {
  cards?: {
    chance?: GameCard[];
    finance?: GameCard[];
  };
}

export interface Theme {
  id: string;
  name: string;
  description: string;
  isPaid: boolean;
  priceCzk: number;
  colors: ThemeColors;
  labels: ThemeLabels;
  horses: HorseConfig[];
  /** Volitelné obrazové assety — theme builder je vyplní. */
  assets?: ThemeAssets;
  /** Volitelný herní obsah (vlastní karty atd.) — zatím nepoužíváno. */
  content?: ThemeContent;
}

// Registr všech dostupných témat
export const THEMES: Theme[] = [defaultTheme, darkTheme, classicRaceTheme];

/** Vrátí theme podle id; pokud není nalezeno nebo id je null, vrátí default. */
export function getThemeById(id: string | null | undefined): Theme {
  return THEMES.find((t) => t.id === id) ?? defaultTheme;
}
