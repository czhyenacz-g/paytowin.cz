/**
 * lib/themes/assets.ts — helper pro odvozování cest k theme assetům.
 *
 * Konvence:
 *   public/themes/{theme-id}/{asset}
 *
 * Použití:
 *   themeAssetPath("horse-day", THEME_ASSETS.boardBg)
 *   // → "/themes/horse-day/board-bg.webp"
 *
 * Fallback: pokud asset fyzicky neexistuje, browser prostě nic nevykreslí —
 * CSS backgroundImage se ignoruje, <img> zůstane prázdný. UI se nerozbije.
 *
 * Komunitní mapy:
 *   themeAssetPath("community/sea-world", THEME_ASSETS.boardBg)
 *   // → "/themes/community/sea-world/board-bg.webp"
 */

// ─── Kanonická jména asset souborů ───────────────────────────────────────────

/**
 * THEME_ASSETS — konzistentní naming konvence pro všechna témata.
 *
 * Soubory se ukládají do:
 *   public/themes/{theme-id}/{hodnota z tohoto objektu}
 *
 * Formát: webp preferovaný (menší, kvalitní). PNG jako fallback při exportu.
 */
export const THEME_ASSETS = {
  /** Pozadí herní desky (board surface, board-bg div). */
  boardBg:      "board-bg.webp",
  /** Pozadí středové arény / infield. */
  centerBg:     "center-bg.webp",
  /** Náhledový obrázek pro theme galerii (budoucí výběr tématu). */
  preview:      "preview.webp",
  /** Pole: START */
  fieldStart:   "field-start.webp",
  /** Pole: zisk coinů (coins_gain) */
  fieldGain:    "field-gain.webp",
  /** Pole: ztráta coinů (coins_lose) */
  fieldLoss:    "field-loss.webp",
  /** Pole: hazard / gamble */
  fieldGamble:  "field-gamble.webp",
  /** Pole: závodník — kůň, auto, nebo cokoli jiného per theme */
  fieldRacer:   "field-racer.webp",
  /** Pole: náhoda (chance karta) */
  fieldChance:  "field-chance.webp",
  /** Pole: finance (finance karta) */
  fieldFinance: "field-finance.webp",
  /** Pole: neutrální */
  fieldNeutral: "field-neutral.webp",
} as const;

export type ThemeAssetKey = keyof typeof THEME_ASSETS;

export const SHARED_THEME_ASSETS = {
  placeholderCard: "placeholder-card.webp",
} as const;

export type SharedThemeAssetKey = keyof typeof SHARED_THEME_ASSETS;

// ─── Path helpers ─────────────────────────────────────────────────────────────

/**
 * themeAssetPath — vrátí absolutní URL cestu k assetu daného theme.
 *
 * @param themeId   ID theme, např. "horse-day" nebo "community/sea-world"
 * @param asset     Název souboru — ideálně hodnota z THEME_ASSETS
 * @returns         Absolutní cesta pro <img src> nebo CSS backgroundImage
 *
 * @example
 *   themeAssetPath("horse-day", THEME_ASSETS.boardBg)
 *   // → "/themes/horse-day/board-bg.webp"
 *
 *   themeAssetPath("community/sea-world", THEME_ASSETS.fieldRacer)
 *   // → "/themes/community/sea-world/field-racer.webp"
 */
export function themeAssetPath(themeId: string, asset: string): string {
  return `/themes/${themeId}/${asset}`;
}

export function sharedThemeAssetPath(asset: string): string {
  return `/themes/_shared/${asset}`;
}

/**
 * racerAssetPath — vrátí cestu k obrázku závodníka podle jeho id.
 *
 * Konvence souboru: racer-{racer.id}.webp
 *
 * @example
 *   racerAssetPath("horse-day", "divoka_ruze")
 *   // → "/themes/horse-day/racer-divoka_ruze.webp"
 */
export function racerAssetPath(themeId: string, racerId: string): string {
  return `/themes/${themeId}/racer-${racerId}.webp`;
}

export function racerAssetFilename(racerId: string): string {
  return `racer-${racerId}.webp`;
}

export function resolveFieldCardImagePath(
  themeId: string,
  fieldType: string,
  override?: string
): string | null {
  if (override) return override;
  const assetKey = fieldAssetKey(fieldType);
  return assetKey ? themeAssetPath(themeId, THEME_ASSETS[assetKey]) : null;
}

/**
 * Priority: 1. profileImage (RacerConfig.image — source of truth)
 *           2. file-based canonical path (/themes/{themeId}/racer-{id}.webp)
 */
export function resolveRacerCardImagePath(
  themeId: string,
  racerId?: string,
  profileImage?: string,
): string | null {
  if (profileImage) return profileImage;
  return racerId ? racerAssetPath(themeId, racerId) : null;
}

export function getSharedCardPlaceholderPath(): string {
  return sharedThemeAssetPath(SHARED_THEME_ASSETS.placeholderCard);
}

export function buildCardBackgroundImageValue(primaryPath: string | null): string {
  return [primaryPath, getSharedCardPlaceholderPath()]
    .filter((path): path is string => Boolean(path))
    .map((path) => `url("${path}")`)
    .join(", ");
}

/**
 * fieldAssetKey — mapuje FieldStyleKey na THEME_ASSETS klíč.
 *
 * Použij pro dynamické odvozování asset path z field.type:
 *   const assetKey = fieldAssetKey(field.type);
 *   if (assetKey) {
 *     const bgPath = themeAssetPath(themeId, THEME_ASSETS[assetKey]);
 *   }
 */
export function fieldAssetKey(fieldType: string): ThemeAssetKey | null {
  const map: Record<string, ThemeAssetKey> = {
    start:      "fieldStart",
    coins_gain: "fieldGain",
    coins_lose: "fieldLoss",
    gamble:     "fieldGamble",
    racer:      "fieldRacer",
    horse:      "fieldRacer",  // legacy alias
    chance:     "fieldChance",
    finance:    "fieldFinance",
    neutral:    "fieldNeutral",
  };
  return map[fieldType] ?? null;
}
