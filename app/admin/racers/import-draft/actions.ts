"use server";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { loadDraftManifest } from "@/lib/racers/import-review";

// ─── Import race/work koní do tabulky racers ──────────────────────────────────

export type ImportRaceWorkResult =
  | { ok: true; inserted: number; errors: string[] }
  | { ok: false; error: string };

/**
 * importRaceWorkHorsesAction — upsertuje game_pool + work koně do tabulky `racers`.
 *
 * Bezpečné pro opakované spuštění (ON CONFLICT (id) DO UPDATE).
 * Nastavuje is_builtin=true, is_public=true, owner_id=null.
 */
export async function importRaceWorkHorsesAction(): Promise<ImportRaceWorkResult> {
  const draft = loadDraftManifest();
  if (!draft) {
    return { ok: false, error: "Draft manifest neexistuje. Nejdřív ho vygeneruj na /admin/racers/import-review." };
  }

  const horses = draft.filter((d) => d.kind === "game_pool" || d.kind === "work");
  const errors: string[] = [];
  let inserted = 0;

  for (const item of horses) {
    const row = {
      id:           item.slug,
      name:         item.displayName,
      speed:        item.speed         ?? 5,
      price:        item.price         ?? 100,
      emoji:        "🐴",
      max_stamina:  item.maxStamina    ?? 8,
      is_legendary: false,
      flavor_text:  item.flavorText    ?? null,
      image_url:    item.imageUrl      ?? null,
      image_path:   item.imagePath     ?? null,
      type:         "horse",
      is_builtin:   true,
      is_public:    true,
      owner_id:     null,
    };

    const { error } = await supabaseAdmin
      .from("racers")
      .upsert(row, { onConflict: "id" });

    if (error) {
      errors.push(`${item.slug}: ${error.message}`);
    } else {
      inserted++;
    }
  }

  return { ok: true, inserted, errors };
}

// ─── Import perma koní do racer_templates + racer_uniques ────────────────────

export type ImportPermaResult =
  | { ok: true; templates: number; uniques: number; errors: string[] }
  | { ok: false; error: string };

/**
 * importPermaHorsesAction — upsertuje perma_unique koně do `racer_templates` a `racer_uniques`.
 *
 * Bezpečné pro opakované spuštění (ON CONFLICT DO UPDATE).
 * Nastavuje status=draft, sale_status=hidden, availability_status=draft, owner_user_id=null.
 */
export async function importPermaHorsesAction(): Promise<ImportPermaResult> {
  const draft = loadDraftManifest();
  if (!draft) {
    return { ok: false, error: "Draft manifest neexistuje. Nejdřív ho vygeneruj na /admin/racers/import-review." };
  }

  const horses = draft.filter((d) => d.kind === "perma_unique");
  const errors: string[] = [];
  let templates = 0;
  let uniques = 0;

  for (const item of horses) {
    const templateId = "tmpl-" + item.slug;
    const uniqueId   = "uniq-" + item.slug;

    // 1. Upsert do racer_templates
    const templateRow = {
      id:          templateId,
      species_id:  "horse",
      name:        item.displayName,
      slug:        item.slug,
      category:    "perma",
      pool_type:   "perma",
      rarity:      item.rarity ?? "unique",
      description: item.flavorText ?? null,
      is_active:   true,
    };

    const { error: tmplError } = await supabaseAdmin
      .from("racer_templates")
      .upsert(templateRow, { onConflict: "id" });

    if (tmplError) {
      errors.push(`[template] ${item.slug}: ${tmplError.message}`);
      // Přeskoč unique pokud template selhal — FK by selhala
      continue;
    }
    templates++;

    // 2. Upsert do racer_uniques
    const uniqueRow = {
      id:                  uniqueId,
      template_id:         templateId,
      name:                item.displayName,
      slug:                item.slug,
      status:              "draft",
      sale_status:         "hidden",
      rarity:              item.rarity ?? "unique",
      description:         item.story  ?? null,
      owner_user_id:       null,
      availability_status: "draft",
    };

    const { error: uniqError } = await supabaseAdmin
      .from("racer_uniques")
      .upsert(uniqueRow, { onConflict: "id" });

    if (uniqError) {
      errors.push(`[unique] ${item.slug}: ${uniqError.message}`);
    } else {
      uniques++;
    }
  }

  return { ok: true, templates, uniques, errors };
}
