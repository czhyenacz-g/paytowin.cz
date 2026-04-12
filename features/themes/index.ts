/**
 * features/themes — theme systém.
 *
 * Vstupní bod pro vše kolem témat: registr, typy, helper getThemeById.
 * Interní implementace je v lib/themes/*.
 */

export { THEMES, getThemeById, getThemeRacers } from "@/lib/themes";
export type {
  Theme,
  ThemeColors,
  ThemeLabels,
  ThemeAssets,
  ThemeContent,
  RacerConfig,
  HorseConfig,   // @deprecated — legacy alias pro RacerConfig
  FieldStyleKey,
} from "@/lib/themes";
