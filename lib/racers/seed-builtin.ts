/**
 * lib/racers/seed-builtin.ts — seed / reset helper pro built-in závodníky.
 *
 * Extrahuje závodníky z vestavěných theme souborů a připraví je pro import
 * do globální Racer Registry (tabulka `racers`).
 *
 * Použití:
 *   // Jen přečíst co by bylo seedováno (suché spuštění):
 *   const profiles = getBuiltinRacerProfiles();
 *
 *   // Zapsat do DB (spustit manuálně z admin akce nebo scripts/):
 *   const result = await seedBuiltinRacers();
 *
 * Reset model:
 *   Pokud jsou stará per-theme data nekonzistentní, je přijatelné zavolat
 *   resetBuiltinRacers() — smaže existující built-in záznamy a seeduje znovu.
 *   User-created závodníci (is_builtin=false) zůstanou nedotčeni.
 *
 * Deduplication:
 *   Pokud stejné racer.id existuje ve více themes (horse-day i horse-night),
 *   zachová se jen PRVNÍ výskyt (podle pořadí BUILTIN_SEED_THEMES).
 *   Důvod: racer je globální entita, ne per-theme kopie.
 *   Pokud jsou staty různé, built-in data lze resetovat a zadat znovu čistě.
 */

import { THEMES }    from "@/lib/themes";
import { getThemeRacers } from "@/lib/themes";
import type { RacerProfile, RacerProfileInsert, RacerType } from "./types";
import { upsertRacer, listRacers } from "./repository";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Odvodí typ závodníka z ID theme.
 * horse-day / horse-night / horse-classic → 'horse'
 * car-day / car-night → 'car'
 * Ostatní → 'custom'
 */
function inferRacerType(themeId: string): RacerType {
  if (themeId.startsWith("horse")) return "horse";
  if (themeId.startsWith("car"))   return "car";
  return "unset";
}

// ─── Extrakce profilů ─────────────────────────────────────────────────────────

/**
 * getBuiltinRacerProfiles — vrátí deduplikovaný seznam RacerProfile ze všech built-in themes.
 *
 * Nerekviruje DB. Bezpečné pro dry-run / preview.
 */
export function getBuiltinRacerProfiles(): RacerProfile[] {
  const seen  = new Set<string>();
  const profiles: RacerProfile[] = [];

  for (const theme of THEMES) {
    const type   = inferRacerType(theme.id);
    const racers = getThemeRacers(theme);

    for (const rc of racers) {
      if (seen.has(rc.id)) continue; // deduplication: první výskyt vyhrává
      seen.add(rc.id);

      profiles.push({
        id:          rc.id,
        name:        rc.name,
        speed:       rc.speed,
        price:       rc.price,
        emoji:       rc.emoji,
        maxStamina:  rc.maxStamina ?? rc.stamina ?? 100,
        isLegendary: rc.isLegendary ?? false,
        flavorText:  rc.flavorText ?? rc.heroText,
        imageUrl:    rc.image,
        imagePath:   undefined,
        type,
        isBuiltin:   true,
        ownerId:     undefined,
        isPublic:    true,
      });
    }
  }

  return profiles;
}

// ─── Seed (zapsat do DB) ──────────────────────────────────────────────────────

/**
 * seedBuiltinRacers — zapíše built-in závodníky do tabulky `racers`.
 *
 * Bezpečný pro opakované spuštění — používá upsert (nemazat existující).
 * Nepřepisuje user-created závodníky.
 *
 * Vrátí počet úspěšně upsertnutých záznamů a seznam chyb.
 */
export async function seedBuiltinRacers(): Promise<{
  inserted: number;
  errors: Array<{ id: string; error: string }>;
}> {
  const profiles = getBuiltinRacerProfiles();
  let inserted = 0;
  const errors: Array<{ id: string; error: string }> = [];

  for (const profile of profiles) {
    const result = await upsertRacer(profile as RacerProfileInsert);
    if (result.ok) {
      inserted++;
    } else {
      errors.push({ id: profile.id, error: result.error });
    }
  }

  return { inserted, errors };
}

// ─── Reset (smazat built-in a seedovat znovu) ─────────────────────────────────

/**
 * resetBuiltinRacers — smaže všechny is_builtin=true záznamy a seeduje znovu.
 *
 * DESTRUKTIVNÍ — používej jen tehdy, kdy chceš čistě přepsat built-in data.
 * User-created závodníci (is_builtin=false) zůstanou nedotčeni.
 *
 * Přijatelné použití (jak je uvedeno v task):
 *   Pokud stará per-theme data jsou nekonzistentní nebo nevyhovují novému modelu,
 *   je čistší je resetovat a zadat znovu než budovat složitou zpětnou kompatibilitu.
 */
export async function resetBuiltinRacers(): Promise<{
  deleted: number;
  inserted: number;
  errors: Array<{ id: string; error: string }>;
}> {
  // Načti stávající built-in záznamy
  const existing = await listRacers({ isBuiltin: true });

  // Smaž je (přímé volání supabase — deleteRacer blokuje built-in, takže jdeme přímo)
  const { supabase: sb } = await import("@/lib/supabase");
  const ids = existing.map((r) => r.id);

  let deleted = 0;
  if (ids.length > 0) {
    const { error } = await sb.from("racers").delete().in("id", ids);
    if (!error) deleted = ids.length;
  }

  // Seed znovu
  const { inserted, errors } = await seedBuiltinRacers();
  return { deleted, inserted, errors };
}
