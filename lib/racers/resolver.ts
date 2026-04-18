/**
 * lib/racers/resolver.ts — resolver pro racerRefs → RacerConfig[].
 *
 * Použití:
 *   // Přímý lookup podle refs:
 *   const racers = await resolveRacerRefs(refs);
 *
 *   // Nebo s manifestem (automatický fallback na inline racers):
 *   const racers = await resolveManifestRacers(manifest);
 *
 * Fallback model:
 *   Pokud registry vrátí prázdný výsledek nebo není dostupná,
 *   resolveManifestRacers() vrátí manifest.racers (inline data).
 *   resolveRacerRefs() vrátí [] — volající musí fallback řešit sám.
 */

import type { ThemeManifest } from "@/lib/themes/manifest";
import type { RacerConfig } from "@/lib/themes";
import { listRacers } from "./repository";
import { profileToConfig } from "./adapters";

// ─── Typy ─────────────────────────────────────────────────────────────────────

export type RacerRef = { slotIndex: number; racer_id: string };

// ─── Core resolver ────────────────────────────────────────────────────────────

/**
 * resolveRacerRefs — přeloží seznam RacerRef na RacerConfig[] z globální registry.
 *
 * Seřadí výsledky podle slotIndex.
 * Chybějící závodníci (id nenalezeno v registry) jsou přeskočeni s varováním.
 *
 * @returns RacerConfig[] seřazené podle slotIndex; prázdné [] pokud registry není dostupná.
 */
export async function resolveRacerRefs(refs: RacerRef[]): Promise<RacerConfig[]> {
  if (refs.length === 0) return [];

  const profiles = await listRacers();
  if (profiles.length === 0) {
    console.warn("[resolveRacerRefs] Registry je prázdná nebo nedostupná.");
    return [];
  }

  const byId = new Map(profiles.map((p) => [p.id, profileToConfig(p)]));

  const resolved: RacerConfig[] = [];
  for (const ref of [...refs].sort((a, b) => a.slotIndex - b.slotIndex)) {
    const config = byId.get(ref.racer_id);
    if (!config) {
      console.warn(`[resolveRacerRefs] Závodník "${ref.racer_id}" nenalezen v registry — slot ${ref.slotIndex} přeskočen.`);
      continue;
    }
    resolved.push({ ...config, slotIndex: ref.slotIndex });
  }

  return resolved;
}

// ─── Manifest-level convenience wrapper ───────────────────────────────────────

/**
 * resolveManifestRacers — vrátí racery pro daný ThemeManifest.
 *
 * Pokud manifest obsahuje racerRefs → načte z registry (async).
 * Pokud ne (nebo registry selhala) → vrátí manifest.racers (inline fallback).
 *
 * Nikdy nevyhazuje výjimku — vždy vrátí aspoň prázdné [].
 */
export async function resolveManifestRacers(manifest: ThemeManifest): Promise<RacerConfig[]> {
  const refs = manifest.racerRefs;
  if (!refs || refs.length === 0) {
    return manifest.racers ?? [];
  }

  try {
    const resolved = await resolveRacerRefs(refs);
    // Pokud registry lookup selhala nebo vrátila prázdno → fallback na inline
    return resolved.length > 0 ? resolved : (manifest.racers ?? []);
  } catch (e) {
    console.warn("[resolveManifestRacers] Chyba při lookup z registry, fallback na inline:", e);
    return manifest.racers ?? [];
  }
}
