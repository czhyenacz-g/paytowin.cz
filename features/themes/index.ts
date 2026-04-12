/**
 * features/themes — theme systém.
 *
 * Vstupní bod pro vše kolem témat: registr, typy, helper getThemeById.
 * Interní implementace je v lib/themes/*.
 */

export { THEMES, getThemeById, getThemeRacers, themeToManifest } from "@/lib/themes";
export type {
  Theme,
  ThemeColors,
  ThemeLabels,
  ThemeAssets,
  ThemeContent,
  ThemeManifest,
  RacerConfig,
  HorseConfig,   // @deprecated — legacy alias pro RacerConfig
  FieldStyleKey,
} from "@/lib/themes";
