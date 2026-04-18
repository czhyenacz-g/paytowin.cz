/**
 * lib/racers/types.ts — Globální Racer Registry typy.
 *
 * RacerProfile je kanonický typ globální registry.
 * Nahrazuje per-theme RacerConfig (lib/themes/index.ts) jako cílový datový model.
 *
 * Vztah k existujícím typům:
 *   RacerConfig  — per-theme embedded typ; dočasný; bude odstraněn po dokončení migrace
 *   Horse        — runtime snapshot při nákupu; zůstane (runtime state je jiný než profil)
 *   OwnedRacer   — alias pro Horse; bude nahrazen referencí { racer_id, stamina } po fázi 4
 */

// ─── RacerProfile ─────────────────────────────────────────────────────────────

/**
 * RacerProfile — závodník jako globální entita v Racer Registry.
 *
 * Mapuje 1:1 na sloupce tabulky `racers` v Supabase.
 * Theme si závodníka vybírá přes `id` — žádné kopírování dat do manifestu.
 */
export interface RacerProfile {
  /** Slug, globálně unikátní. Příklad: "divoka_ruze". Odpovídá racers.id v DB. */
  id:          string;
  name:        string;
  speed:       number;   // 1–10
  price:       number;   // >= 0
  emoji:       string;
  maxStamina:  number;   // 0–100, výchozí 100
  isLegendary: boolean;
  flavorText?: string;
  /** Veřejná URL obrázku (CDN nebo ext.). Null = žádný obrázek. */
  imageUrl?:   string;
  /** Storage path v Supabase bucket "racers". Null = není nahráno. */
  imagePath?:  string;
  /**
   * Typ závodníka — odpovídá "identitě" theme světa.
   * Příklady: 'horse' | 'car' | 'boat' | 'custom'
   * Theme filtry mohou zobrazit jen závodníky relevantního typu.
   */
  type:        string;
  /** True = zabudovaný závodník; nelze smazat, jen admin může editovat. */
  isBuiltin:   boolean;
  /** Discord ID vlastníka. Null = globální/systémový závodník, dostupný všem. */
  ownerId?:    string;
  /** True = viditelný ve veřejné galerii závodníků. */
  isPublic:    boolean;
  createdAt?:  string;
  updatedAt?:  string;
}

// ─── Insert/Update helpers ────────────────────────────────────────────────────

/**
 * RacerProfileInsert — minimální data pro vytvoření nového závodníka.
 * Pole s výchozími hodnotami jsou volitelná.
 */
export type RacerProfileInsert = Pick<RacerProfile, "id" | "name" | "speed" | "price" | "emoji"> &
  Partial<Omit<RacerProfile, "id" | "name" | "speed" | "price" | "emoji" | "createdAt" | "updatedAt">>;

/**
 * RacerProfileUpdate — editovatelná pole; id nelze měnit.
 */
export type RacerProfileUpdate = Partial<Omit<RacerProfile, "id" | "createdAt" | "updatedAt">>;
