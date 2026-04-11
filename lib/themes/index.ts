import { defaultTheme } from "./default";
import { darkTheme } from "./dark";
import { classicRaceTheme } from "./classic-race";

// Typy polí na desce (musí odpovídat FieldType v GameBoard)
export type FieldStyleKey = "start" | "coins_gain" | "coins_lose" | "gamble" | "horse" | "neutral" | "chance" | "finance";

/** Definice koně v rámci theme — 4 koně v pořadí [speed3, speed4, speed5, speed2]. */
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

/** Volitelná obrazová aktiva theme — pro budoucí vizuální skiny. */
export interface ThemeAssets {
  boardBgImage?: string;   // URL nebo cesta k /public
  fieldImages?: Partial<Record<string, string>>; // fieldLabel → image URL
  horseImages?: Partial<Record<string, string>>; // horseId → image URL
}

export interface Theme {
  id: string;
  name: string;
  description: string;
  isPaid: boolean;
  priceCzk: number;
  colors: ThemeColors;
  labels: {
    themeName: string;
    centerTitle: string;
    centerSubtitle: string;
  };
  horses: HorseConfig[];
  /** Volitelné obrazové assety — zatím nepovinné, placeholder pro theme builder. */
  assets?: ThemeAssets;
}

// Registr všech dostupných témat
export const THEMES: Theme[] = [defaultTheme, darkTheme, classicRaceTheme];

/** Vrátí theme podle id; pokud není nalezeno nebo id je null, vrátí default. */
export function getThemeById(id: string | null | undefined): Theme {
  return THEMES.find((t) => t.id === id) ?? defaultTheme;
}
