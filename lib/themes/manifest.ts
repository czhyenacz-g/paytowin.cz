/**
 * lib/themes/manifest.ts — ThemeManifest v1: formalizovaný datový kontrakt pro theme.
 *
 * ThemeManifest je nový, striktní typ určený pro:
 * - budoucí theme builder (UI pro tvorbu témat)
 * - validaci před uložením theme do DB
 * - jasné oddělení meta, labels, colors, racers, assets, cards
 *
 * Stávající `Theme` interface zůstává pro backward kompatibilitu.
 * Adapter `themeToManifest(theme)` převádí Theme → ThemeManifest.
 *
 * Hierarchie:
 *   Theme (legacy, in-memory) → themeToManifest() → ThemeManifest (v1 kontrakt)
 */

import type { ThemeColors, RacerConfig } from "./index";
import type { GameCard } from "@/lib/cards";
import { getThemeRacers } from "./index";
import type { Theme } from "./index";

// ─── ThemeManifest ────────────────────────────────────────────────────────────

export interface ThemeManifest {
  /** Metadata theme — id, jméno, autor, verze, přístupnost */
  meta: {
    id: string;
    name: string;
    description: string;
    /** Verze manifestu, např. "1.0.0". Umožňuje budoucí migrace schématu. */
    version: string;
    author?: string;
    /** true = viditelné v public theme galerii */
    isPublic?: boolean;
    isPaid?: boolean;
    priceCzk?: number;
  };

  /**
   * Herní texty — všechny UI řetězce jsou tady, ne hardcoded.
   *
   * UI komponenty čtou tyto hodnoty místo pevných stringů.
   * Theme může lokalizovat: různé jazyky, různé tóny (humorný, satirický…).
   */
  labels: {
    gameName: string;      // název hry v tomto theme, např. "Dostihy"
    start: string;         // text START pole
    gain: string;          // legenda: typ pole "zisk"
    loss: string;          // legenda: typ pole "ztráta"
    hazard: string;        // legenda: typ pole "hazard"
    chance: string;        // název karty Náhoda
    finance: string;       // název karty Finance
    mafia: string;         // název karty Mafie
    racer: string;         // závodník v jednotném čísle, např. "Kůň"
    racers: string;        // závodníci v množném čísle, např. "Koně"
    racerField: string;    // místo kde závodníci stojí, např. "Stáj"
    bankrupt: string;      // text pro bankrot
  };

  /** Vizuální styl — Tailwind třídy. Stejná struktura jako ThemeColors. */
  colors: ThemeColors;

  /**
   * Závodníci — inline data (legacy / fallback).
   *
   * Nová themes by měly používat racerRefs (reference do globální registry).
   * Pokud jsou přítomny racerRefs, inline racers slouží jen jako fallback
   * při nedostupnosti registry nebo před dokončením async resolution.
   *
   * Stále povinné u built-in themes; u registry-based themes volitelné.
   */
  racers: RacerConfig[];

  /**
   * Racer Registry reference — nový kanonický způsob přiřazení závodníků k theme.
   *
   * Každý záznam říká: "na slotu slotIndex použij závodníka racer_id z globální registry."
   * Pořadí závisí na slotIndex — závodník s nejnižším slotIndex obsadí první racer pole na desce.
   *
   * Pokud přítomno a neprázdné: runtime načte závodníky z tabulky `racers` (globální registry).
   * Pokud chybí nebo prázdné: runtime použije inline racers (backward compatible fallback).
   *
   * Budoucnost: jakmile bude registry-based flow plně stabilní, inline racers bude deprecated.
   */
  racerRefs?: Array<{ slotIndex: number; racer_id: string }>;

  /** Obrazové assety theme. Normalizovaný tvar (bez legacy horseImages). */
  assets?: {
    /** Náhledový obrázek pro výběr theme (budoucí theme galerie) */
    previewImage?: string;
    /** Pozadí herní desky */
    boardBackgroundImage?: string;
    /** Logo theme */
    logoImage?: string;
    /** racer.id → URL obrázku závodníka */
    racerImages?: Record<string, string>;
    /**
     * Obrázková pozadí pro typy polí. Klíče odpovídají FieldStyleKey.
     * Konvence cest: /themes/{themeId}/field-{type}.webp
     * Pokud klíč chybí, pole se vykreslí s fallbackem na CSS barvy z colors.fieldStyles.
     *
     * @example { racer: "/themes/horse-day/field-racer.webp", coins_gain: "/themes/horse-day/field-gain.webp" }
     */
    fieldTextures?: Record<string, string>;
  };

  /**
   * Per-theme karty — volitelné.
   * Pokud není vyplněno, drawCard() použije globální balíčky z lib/cards.ts.
   * Obě pole musí být neprázdná pokud jsou zadána.
   */
  cards?: {
    chance: GameCard[];
    finance: GameCard[];
    mafia?: GameCard[];
  };

  /**
   * Board presety které tento theme podporuje.
   * Prázdné / undefined = podporuje všechny dostupné presety.
   * Budoucí theme builder použije toto pole při nabídce board selectoru.
   */
  supportedBoards?: Array<"small" | "large">;

  /**
   * Tón / styl theme — metadata pro budoucí filtrování v theme galerii.
   */
  tone?: {
    style?: "neutral" | "funny" | "satirical" | "cute" | "dark" | "retro";
  };
}

// ─── Adapter: Theme → ThemeManifest ──────────────────────────────────────────

/**
 * themeToManifest — adaptuje stávající Theme na ThemeManifest v1.
 *
 * Umožňuje používat ThemeManifest API bez nutnosti přepisovat stávající theme soubory.
 * Mapuje:
 *   theme.id/name/description → meta
 *   theme.labels.* → labels (s rozumnými defaulty pro nová pole)
 *   theme.colors → colors
 *   getThemeRacers(theme) → racers (respektuje horses fallback)
 *   theme.assets → assets (normalizuje horseImages → racerImages)
 *   theme.content?.cards → cards
 */
export function themeToManifest(theme: Theme): ThemeManifest {
  // Normalizuj assets: slouč horseImages (legacy) + racerImages (kanonické)
  // Filtrujeme undefined hodnoty aby výsledek odpovídal Record<string, string>
  const racerImages: Record<string, string> | undefined = (() => {
    const legacy = theme.assets?.horseImages;
    const canonical = theme.assets?.racerImages;
    if (!legacy && !canonical) return undefined;
    const merged: Record<string, string> = {};
    for (const [k, v] of Object.entries({ ...(legacy ?? {}), ...(canonical ?? {}) })) {
      if (v !== undefined) merged[k] = v;
    }
    return merged;
  })();

  return {
    meta: {
      id: theme.id,
      name: theme.name,
      description: theme.description,
      version: "1.0.0",
      isPaid: theme.isPaid,
      priceCzk: theme.priceCzk,
    },
    labels: {
      gameName:   theme.labels.themeName,
      start:      "START",
      gain:       theme.labels.legend.gain,
      loss:       theme.labels.legend.lose,
      hazard:     theme.labels.legend.gamble,
      chance:     "Osud",
      finance:    "Finance",
      mafia:      "Mafie",
      racer:      theme.labels.racer,
      racers:     theme.labels.racers,
      racerField: theme.labels.racerField,
      bankrupt:   "Bankrot",
    },
    colors: theme.colors,
    racers: getThemeRacers(theme),
    racerRefs: theme.racerRefs,
    assets: (theme.assets || racerImages)
      ? {
          boardBackgroundImage: theme.assets?.boardBgImage,
          racerImages,
          fieldTextures: theme.assets?.fieldTextures
            ? Object.fromEntries(
                Object.entries(theme.assets.fieldTextures).filter(([, v]) => v !== undefined)
              ) as Record<string, string>
            : undefined,
        }
      : undefined,
    cards: theme.content?.cards
      ? {
          chance:  theme.content.cards.chance  ?? [],
          finance: theme.content.cards.finance ?? [],
          mafia:   theme.content.cards.mafia   ?? [],
        }
      : undefined,
    supportedBoards: ["small"],
  };
}
