/**
 * lib/racers/adapters.ts — konverze mezi RacerProfile (registry) a RacerConfig (per-theme legacy).
 *
 * Tyto adaptéry jsou přechodová vrstva.
 * Existují proto, že UI komponenty (RacerRosterPanel, RacerEditorPanel) pracují s RacerConfig.
 * Jakmile budou přepsány na RacerProfile přímo, adaptéry lze odstranit.
 *
 * Klíčové rozdíly:
 *   RacerConfig.image      ↔  RacerProfile.imageUrl
 *   RacerConfig.isBuiltIn  ↔  RacerProfile.isBuiltin  (různý case)
 *   RacerConfig.slotIndex     není v RacerProfile (slot je theme-specific)
 *   RacerProfile.type         není v RacerConfig (type je global-registry-specific)
 */

import type { RacerConfig } from "@/lib/themes";
import type { RacerProfile, RacerProfileInsert } from "./types";

// ─── Profile → Config ─────────────────────────────────────────────────────────

/**
 * profileToConfig — převede RacerProfile na RacerConfig pro UI komponenty.
 *
 * slotIndex není součástí globálního profilu — volající (`withSlotIndexes`) ho přiřadí zvlášť.
 */
export function profileToConfig(p: RacerProfile): RacerConfig {
  return {
    id:          p.id,
    name:        p.name,
    speed:       p.speed,
    price:       p.price,
    emoji:       p.emoji,
    maxStamina:  p.maxStamina,
    isLegendary: p.isLegendary || undefined,   // false → undefined (čistší data)
    flavorText:  p.flavorText,
    image:       p.imageUrl,
    isBuiltIn:   p.isBuiltin || undefined,     // false → undefined
    // slotIndex: záměrně vynecháno — přiřazuje se per-theme, ne z globálního profilu
  };
}

// ─── Config → ProfileInsert ───────────────────────────────────────────────────

/**
 * configToProfile — převede RacerConfig na RacerProfileInsert pro uložení do registry.
 *
 * @param c        zdrojový RacerConfig z UI editoru
 * @param defaults doplní pole která v RacerConfig chybí (type, isBuiltin, isPublic)
 */
export function configToProfile(
  c: RacerConfig,
  defaults: { type?: string; isBuiltin?: boolean; isPublic?: boolean } = {},
): RacerProfileInsert {
  return {
    id:          c.id,
    name:        c.name,
    speed:       c.speed,
    price:       c.price,
    emoji:       c.emoji,
    maxStamina:  c.maxStamina ?? c.stamina ?? 100,
    isLegendary: c.isLegendary ?? false,
    flavorText:  c.flavorText ?? c.heroText,   // heroText je deprecated fallback
    imageUrl:    c.image,
    type:        defaults.type     ?? "horse",
    isBuiltin:   defaults.isBuiltin ?? (c.isBuiltIn ?? false),
    isPublic:    defaults.isPublic  ?? true,
  };
}
