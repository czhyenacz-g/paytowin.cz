/**
 * lib/themes/loader.ts — single safe entry point pro theme data.
 *
 * loadThemeManifest() je jediné místo kde se theme "sestaví" pro zbytek aplikace.
 * Vnitřní postup:
 *   1. Najde theme source z in-memory registru (budoucí: z DB / JSON)
 *   2. Převede ho přes themeToManifest() adapter
 *   3. Validuje přes validateThemeManifest()
 *   4. Vrátí validní ThemeManifest
 *   5. Pokud validace selže, fallbackne na default theme
 *
 * IMPORT POZNÁMKA:
 * Importuj loadThemeManifest přímo z tohoto souboru, ne přes lib/themes/index.
 * Důvod: loader importuje z index → přidání re-exportu by vytvořilo circular dep.
 *
 * Správně:  import { loadThemeManifest } from "@/lib/themes/loader"
 * Špatně:   import { loadThemeManifest } from "@/lib/themes"   ← circular
 */

import { getThemeById, THEMES } from "./index";
import type { Theme } from "./index";
import { themeToManifest } from "./manifest";
import { validateThemeManifest } from "./validator";
import type { ThemeManifest } from "./manifest";

// ─── Loader ───────────────────────────────────────────────────────────────────

/**
 * loadThemeManifest — vrátí validní ThemeManifest pro dané theme id.
 *
 * Fallback řetěz při chybě:
 *   1. Pokud theme nenalezeno → použije default (getThemeById fallback)
 *   2. Pokud manifest nevalidní a theme není default → fallback na default
 *   3. Pokud i default nevalidní → vrátí manifest stejně (app musí běžet)
 *
 * Nikdy nevyhazuje výjimku.
 */
export function loadThemeManifest(id: string | null | undefined): ThemeManifest {
  const theme = getThemeById(id);          // interně fallbackne na defaultTheme
  const manifest = themeToManifest(theme);

  if (validateThemeManifest(manifest)) {
    return manifest;
  }

  // Validace selhala — fallback na default pokud to není already default
  if (theme.id !== "default") {
    console.warn(`[loadThemeManifest] Theme "${theme.id}" neprojde validací, fallback na default.`);
    const fallbackTheme = getThemeById("default");
    const fallbackManifest = themeToManifest(fallbackTheme);
    validateThemeManifest(fallbackManifest); // loguj případné problémy i s defaultem
    return fallbackManifest;
  }

  // I default selhal — vrátíme manifest tak jak je, hra musí mít šanci nastartovat
  console.error(`[loadThemeManifest] Default theme neprojde validací. Vrací se nevalidovaný manifest.`);
  return manifest;
}

/**
 * loadAllThemeManifests — načte a validuje všechny registrované themes.
 *
 * Používej v dev buildu nebo testech pro smoke-test celého registru.
 * Vrátí { valid: ThemeManifest[], invalid: string[] }.
 */
export function loadAllThemeManifests(): { valid: ThemeManifest[]; invalid: string[] } {
  const valid: ThemeManifest[] = [];
  const invalid: string[] = [];

  for (const theme of THEMES as Theme[]) {
    const manifest = themeToManifest(theme);
    if (validateThemeManifest(manifest)) {
      valid.push(manifest);
    } else {
      console.warn(`[loadAllThemeManifests] Theme "${theme.id}" přeskočeno — nevalidní manifest.`);
      invalid.push(theme.id);
    }
  }

  return { valid, invalid };
}
