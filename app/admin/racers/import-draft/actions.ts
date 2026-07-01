"use server";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { loadDraftManifest, loadClassicLegendDraftManifest } from "@/lib/racers/import-review";

function normalizeStamina(v: number | null | undefined): number {
  if (v == null) return 80;
  return v <= 20 ? v * 10 : v;
}

// ─── Import race/work koní do tabulky racers ──────────────────────────────────

export type ImportRaceWorkResult =
  | { ok: true; inserted: number; errors: string[] }
  | { ok: false; error: string };

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
      max_stamina:  normalizeStamina(item.maxStamina),
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
      continue;
    }
    templates++;

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

// ─── Import classic legend koní do racer_templates + racer_uniques + racers ──

export type ImportClassicLegendResult =
  | { ok: true; templates: number; uniques: number; errors: string[] }
  | { ok: false; error: string };

export async function importClassicLegendHorsesAction(): Promise<ImportClassicLegendResult> {
  const draft = loadClassicLegendDraftManifest();
  if (!draft) {
    return { ok: false, error: "Classic legend draft neexistuje. Nejdřív ho vygeneruj na /admin/racers/import-review?group=classic-legend." };
  }

  const horses = draft.filter((d) => d.kind === "classic_legend");
  const errors: string[] = [];
  let templates = 0;
  let uniques = 0;

  for (const item of horses) {
    const templateId = "tmpl-cl-" + item.slug;
    const uniqueId   = "uniq-cl-" + item.slug;
    const racerId    = "cl-" + item.slug;

    const templateRow = {
      id:          templateId,
      species_id:  "horse",
      name:        item.displayName,
      slug:        racerId,
      category:    "classic_legend",
      pool_type:   "classic_legend",
      rarity:      item.rarity ?? "legendary_classic",
      description: item.flavorText ?? null,
      is_active:   false,
    };

    const { error: tmplError } = await supabaseAdmin
      .from("racer_templates")
      .upsert(templateRow, { onConflict: "id" });

    if (tmplError) {
      errors.push(`[template] ${item.slug}: ${tmplError.message}`);
      continue;
    }
    templates++;

    const uniqueRow = {
      id:                  uniqueId,
      template_id:         templateId,
      name:                item.displayName,
      slug:                racerId,
      status:              "draft",
      sale_status:         "hidden",
      rarity:              item.rarity ?? "legendary_classic",
      description:         item.story  ?? item.flavorText ?? null,
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

    // Upsert do racers — viditelný v RacerAdminTool (is_public=false = není ve hře)
    const racerRow = {
      id:           racerId,
      name:         item.displayName,
      speed:        item.speed      ?? 7,
      price:        item.price      ?? 3000,
      emoji:        "🏆",
      max_stamina:  normalizeStamina(item.maxStamina),
      is_legendary: true,
      flavor_text:  item.flavorText ?? null,
      image_url:    item.imageUrl   ?? null,
      image_path:   item.imagePath  ?? null,
      type:         "horse",
      is_builtin:   true,
      is_public:    false,
      owner_id:     null,
    };

    const { error: racerError } = await supabaseAdmin
      .from("racers")
      .upsert(racerRow, { onConflict: "id" });

    if (racerError) {
      errors.push(`[racer] ${item.slug}: ${racerError.message}`);
    }
  }

  return { ok: true, templates, uniques, errors };
}
