/**
 * lib/themes/validator.ts — runtime validace ThemeManifest.
 *
 * Přístup:
 * - console.warn pro problémy které lze bezpečně přeskočit (non-fatal)
 * - console.error pro problémy které způsobí chybu za běhu (fatal)
 * - vrací false pokud je manifest rozbitý, true pokud je v pořádku
 * - NEVYHAZUJE exception — loader fallbackne na default theme
 *
 * Tato funkce je jediné autoritativní místo pro ThemeManifest validaci.
 * lib/board/validator.ts re-exportuje crossCheckBoardAndTheme odsud.
 */

import type { ThemeManifest } from "./manifest";
import type { BoardConfig } from "@/lib/board/types";

// ─── Validní hodnoty ──────────────────────────────────────────────────────────

const VALID_EFFECTS = new Set(["coins", "skip_turn", "move", "give_racer", "stamina_debuff"]);
const VALID_BOARD_IDS = new Set(["small", "large"]);
const VALID_TONE_STYLES = new Set(["neutral", "funny", "satirical", "cute", "dark", "retro"]);

// ─── ThemeManifest validator ──────────────────────────────────────────────────

/**
 * validateThemeManifest — ověří úplnost a správnost ThemeManifest.
 *
 * Kontroluje:
 *
 * ### meta
 * - id, name, version jsou neprázdné řetězce
 *
 * ### labels
 * - všechna required pole existují (gameName, start, gain, loss, hazard,
 *   chance, finance, racer, racers, racerField, bankrupt)
 *
 * ### racers
 * - alespoň 1 racer
 * - racer ids jsou unikátní a neprázdné
 * - speed > 0, price >= 0
 * - emoji je neprázdné
 *
 * ### assets (pokud existují)
 * - všechny hodnoty jsou string (ne object, ne null)
 * - racerImages: keys i values jsou strings
 *
 * ### cards (pokud existují)
 * - chance i finance jsou pole
 * - card ids jsou unikátní v rámci decku
 * - effect.kind je validní ("coins" | "skip_turn" | "move")
 * - coins a move mají effect.value !== undefined
 *
 * ### supportedBoards (pokud existuje)
 * - obsahuje jen "small" | "large"
 *
 * ### tone (pokud existuje)
 * - style je validní nebo undefined
 */
export function validateThemeManifest(manifest: ThemeManifest): boolean {
  if (!manifest || typeof manifest !== "object") {
    console.error(`[validateThemeManifest] Manifest není objekt.`);
    return false;
  }

  let ok = true;
  const tag = `[ThemeManifest "${manifest?.meta?.id ?? "?"}"]`;

  // ── meta ────────────────────────────────────────────────────────────────────
  if (!manifest.meta || typeof manifest.meta !== "object") {
    console.error(`${tag} Chybí meta sekce.`);
    return false; // Nelze pokračovat bez meta
  }

  if (!manifest.meta.id || typeof manifest.meta.id !== "string") {
    console.error(`${tag} meta.id musí být neprázdný string.`);
    ok = false;
  }

  if (!manifest.meta.name || typeof manifest.meta.name !== "string") {
    console.error(`${tag} meta.name musí být neprázdný string.`);
    ok = false;
  }

  if (!manifest.meta.version || typeof manifest.meta.version !== "string") {
    console.error(`${tag} meta.version musí být neprázdný string (např. "1.0.0").`);
    ok = false;
  }

  // ── labels ──────────────────────────────────────────────────────────────────
  const requiredLabels: Array<keyof ThemeManifest["labels"]> = [
    "gameName", "start", "gain", "loss", "hazard",
    "chance", "finance", "racer", "racers", "racerField", "bankrupt",
  ];

  if (!manifest.labels || typeof manifest.labels !== "object") {
    console.error(`${tag} Chybí labels sekce.`);
    ok = false;
  } else {
    for (const key of requiredLabels) {
      if (!manifest.labels[key] || typeof manifest.labels[key] !== "string") {
        console.error(`${tag} labels.${key} musí být neprázdný string.`);
        ok = false;
      }
    }
  }

  // ── racers ──────────────────────────────────────────────────────────────────
  if (!Array.isArray(manifest.racers) || manifest.racers.length < 1) {
    console.error(`${tag} Musí existovat alespoň 1 racer.`);
    ok = false;
  } else {
    const racerIds = manifest.racers.map((r) => r.id);
    if (new Set(racerIds).size !== racerIds.length) {
      console.error(`${tag} Racer ids nejsou unikátní.`);
      ok = false;
    }

    for (const r of manifest.racers) {
      if (!r.id || typeof r.id !== "string") {
        console.error(`${tag} Racer má neplatné id.`);
        ok = false;
      }
      if (typeof r.speed !== "number" || r.speed <= 0) {
        console.error(`${tag} Racer "${r.id}" má speed <= 0.`);
        ok = false;
      }
      if (typeof r.price !== "number" || r.price < 0) {
        console.error(`${tag} Racer "${r.id}" má price < 0.`);
        ok = false;
      }
      if (!r.emoji || typeof r.emoji !== "string") {
        console.warn(`${tag} Racer "${r.id}" nemá emoji — UI fallback nemusí fungovat.`);
      }
    }
  }

  // ── assets (pokud existují) ─────────────────────────────────────────────────
  if (manifest.assets !== undefined) {
    const assetScalars = ["previewImage", "boardBackgroundImage", "logoImage"] as const;
    for (const key of assetScalars) {
      const val = manifest.assets[key];
      if (val !== undefined && typeof val !== "string") {
        console.error(`${tag} assets.${key} musí být string nebo undefined.`);
        ok = false;
      }
    }

    if (manifest.assets.racerImages !== undefined) {
      if (typeof manifest.assets.racerImages !== "object" || Array.isArray(manifest.assets.racerImages)) {
        console.error(`${tag} assets.racerImages musí být objekt Record<string, string>.`);
        ok = false;
      } else {
        for (const [k, v] of Object.entries(manifest.assets.racerImages)) {
          if (typeof k !== "string" || typeof v !== "string") {
            console.error(`${tag} assets.racerImages["${k}"] musí být string.`);
            ok = false;
          }
        }
      }
    }
  }

  // ── cards (pokud existují) ──────────────────────────────────────────────────
  if (manifest.cards !== undefined) {
    for (const deckName of ["chance", "finance"] as const) {
      const deck = manifest.cards[deckName];
      if (!Array.isArray(deck)) {
        console.error(`${tag} cards.${deckName} musí být pole.`);
        ok = false;
        continue;
      }

      const ids = deck.map((c) => c.id);
      if (new Set(ids).size !== ids.length) {
        console.error(`${tag} cards.${deckName} obsahují duplicitní card ids.`);
        ok = false;
      }

      for (const card of deck) {
        if (!card.id || typeof card.id !== "string") {
          console.error(`${tag} cards.${deckName}: karta nemá platné id.`);
          ok = false;
        }
        if (!card.effect || !VALID_EFFECTS.has(card.effect.kind)) {
          console.error(`${tag} Karta "${card.id}": neplatný effect.kind "${card.effect?.kind}".`);
          ok = false;
        }
        // "coins" a "move" musí mít value
        if ((card.effect?.kind === "coins" || card.effect?.kind === "move") &&
            card.effect.value === undefined) {
          console.error(`${tag} Karta "${card.id}": effect.kind "${card.effect.kind}" musí mít value.`);
          ok = false;
        }
      }
    }
  }

  // ── supportedBoards (pokud existuje) ────────────────────────────────────────
  if (manifest.supportedBoards !== undefined) {
    if (!Array.isArray(manifest.supportedBoards)) {
      console.error(`${tag} supportedBoards musí být pole.`);
      ok = false;
    } else {
      const invalid = manifest.supportedBoards.filter((b) => !VALID_BOARD_IDS.has(b));
      if (invalid.length > 0) {
        console.error(`${tag} supportedBoards obsahují neplatné hodnoty: ${invalid.join(", ")}.`);
        ok = false;
      }
    }
  }

  // ── tone (pokud existuje) ────────────────────────────────────────────────────
  if (manifest.tone?.style !== undefined && !VALID_TONE_STYLES.has(manifest.tone.style)) {
    console.warn(`${tag} tone.style "${manifest.tone.style}" není rozpoznaný. Bude ignorován.`);
  }

  return ok;
}

// ─── Cross-check board + theme ────────────────────────────────────────────────

/**
 * crossCheckBoardAndTheme — ověří kompatibilitu board + theme.
 *
 * Kontroluje:
 * - theme má dost závodníků pro racer sloty na desce
 */
export function crossCheckBoardAndTheme(board: BoardConfig, manifest: ThemeManifest): boolean {
  let ok = true;
  const tag = `[CrossCheck board:"${board.id}" theme:"${manifest.meta.id}"]`;

  if (manifest.racers.length < board.racerSlotIndexes.length) {
    console.error(
      `${tag} Theme má ${manifest.racers.length} závodníků, ale board potřebuje ${board.racerSlotIndexes.length}.`
    );
    ok = false;
  }

  return ok;
}
