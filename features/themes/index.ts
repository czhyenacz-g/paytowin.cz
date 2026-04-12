/**
 * features/themes — theme systém.
 *
 * Vstupní bod pro vše kolem témat: registr, typy, helper getThemeById.
 * Interní implementace je v lib/themes/*.
 */

export { THEMES, getThemeById } from "@/lib/themes";
export type {
  Theme,
  ThemeColors,
  ThemeLabels,
  ThemeAssets,
  ThemeContent,
  HorseConfig,
  FieldStyleKey,
} from "@/lib/themes";
