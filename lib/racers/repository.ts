/**
 * lib/racers/repository.ts — přístup k tabulce `racers` v Supabase.
 *
 * Pravidla (stejná jako lib/repository.ts):
 *   - UI a Server Actions nevolají Supabase přímo — jde přes tento soubor.
 *   - Žádné React importy.
 *   - Vrací surová data nebo null/error objekt; normalizaci dělá volající.
 *
 * Fáze:
 *   Tato vrstva je první implementační krok globální Racer Registry.
 *   Per-theme RacerConfig (ThemeManifest.racers) zůstává paralelně a zatím
 *   není přepsáno — viz lib/themes/index.ts.
 */

import { supabase } from "@/lib/supabase";
import type { RacerProfile, RacerProfileInsert, RacerProfileUpdate } from "./types";
import { toRacerType } from "./types";

// ─── Row ↔ RacerProfile mapping ───────────────────────────────────────────────

// Pomocná funkce — převádí snake_case DB row na camelCase RacerProfile.
// Odděleno od DB aby typový systém byl na straně app, ne DB schématu.
function rowToProfile(row: Record<string, unknown>): RacerProfile {
  return {
    id:          row.id          as string,
    name:        row.name        as string,
    speed:       row.speed       as number,
    price:       row.price       as number,
    emoji:       row.emoji       as string,
    maxStamina:  row.max_stamina as number,
    isLegendary: row.is_legendary as boolean,
    flavorText:  row.flavor_text  as string | undefined ?? undefined,
    imageUrl:    row.image_url    as string | undefined ?? undefined,
    imagePath:   row.image_path   as string | undefined ?? undefined,
    type:        toRacerType(row.type),
    isBuiltin:   row.is_builtin   as boolean,
    ownerId:     row.owner_id     as string | undefined ?? undefined,
    isPublic:    row.is_public    as boolean,
    createdAt:   row.created_at   as string | undefined,
    updatedAt:   row.updated_at   as string | undefined,
  };
}

function profileToRow(p: RacerProfileInsert | RacerProfileUpdate): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if ("id"          in p && p.id          !== undefined) row.id           = p.id;
  if ("name"        in p && p.name        !== undefined) row.name         = p.name;
  if ("speed"       in p && p.speed       !== undefined) row.speed        = p.speed;
  if ("price"       in p && p.price       !== undefined) row.price        = p.price;
  if ("emoji"       in p && p.emoji       !== undefined) row.emoji        = p.emoji;
  if ("maxStamina"  in p && p.maxStamina  !== undefined) row.max_stamina  = p.maxStamina;
  if ("isLegendary" in p)                                row.is_legendary = p.isLegendary ?? false;
  if ("flavorText"  in p)                                row.flavor_text  = p.flavorText  ?? null;
  if ("imageUrl"    in p)                                row.image_url    = p.imageUrl    ?? null;
  if ("imagePath"   in p)                                row.image_path   = p.imagePath   ?? null;
  if ("type"        in p && p.type        !== undefined) row.type         = p.type;
  if ("isBuiltin"   in p)                                row.is_builtin   = p.isBuiltin   ?? false;
  if ("ownerId"     in p)                                row.owner_id     = p.ownerId     ?? null;
  if ("isPublic"    in p)                                row.is_public    = p.isPublic    ?? true;
  return row;
}

// ─── Read ─────────────────────────────────────────────────────────────────────

/**
 * listRacers — vrátí seznam závodníků z globální registry.
 *
 * Filtry jsou volitelné. Bez filtrů vrátí všechny veřejné závodníky.
 */
export async function listRacers(opts?: {
  type?:      string;
  isPublic?:  boolean;
  isBuiltin?: boolean;
  ownerId?:   string;
}): Promise<RacerProfile[]> {
  let query = supabase.from("racers").select("*").order("name");

  if (opts?.type      !== undefined) query = query.eq("type",       opts.type);
  if (opts?.isPublic  !== undefined) query = query.eq("is_public",  opts.isPublic);
  if (opts?.isBuiltin !== undefined) query = query.eq("is_builtin", opts.isBuiltin);
  if (opts?.ownerId   !== undefined) query = query.eq("owner_id",   opts.ownerId);

  const { data, error } = await query;
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map(rowToProfile);
}

/**
 * getRacerById — načte jeden závodník podle id.
 * Vrátí null pokud neexistuje nebo při chybě.
 */
export async function getRacerById(id: string): Promise<RacerProfile | null> {
  const { data, error } = await supabase
    .from("racers")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) return null;
  return rowToProfile(data as Record<string, unknown>);
}

// ─── Write ────────────────────────────────────────────────────────────────────

/**
 * upsertRacer — vytvoří nebo přepíše závodníka v globální registry.
 *
 * Použij pro seed built-in závodníků nebo pro uložení z Racer Admin UI.
 * Při konfliktu id přepíše existující záznam (upsert).
 */
export async function upsertRacer(
  racer: RacerProfileInsert,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const row = profileToRow(racer);
  // Zajisti povinná pole s výchozími hodnotami pokud chybí
  if (row.max_stamina  === undefined) row.max_stamina  = 100;
  if (row.is_legendary === undefined) row.is_legendary = false;
  if (row.type         === undefined) row.type         = "horse";
  if (row.is_builtin   === undefined) row.is_builtin   = false;
  if (row.is_public    === undefined) row.is_public    = true;

  const { error } = await supabase.from("racers").upsert(row);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * updateRacer — aktualizuje existujícího závodníka (partial update).
 *
 * Nepoužívej pro měnění id — id je immutabilní business key.
 */
export async function updateRacer(
  id: string,
  update: RacerProfileUpdate,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const row = profileToRow(update);
  if (Object.keys(row).length === 0) return { ok: true }; // nic k update

  const { error } = await supabase.from("racers").update(row).eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * deleteRacer — smaže závodníka z registry.
 *
 * Blokováno na úrovni repo pro built-in závodníky — musí projít kontrolou volajícím.
 * Neprovádět bez explicitního potvrzení admina.
 */
export async function deleteRacer(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  // Nejdřív zkontroluj is_builtin — built-in závodníci se nesmažou automaticky
  const existing = await getRacerById(id);
  if (!existing) return { ok: false, error: `Závodník "${id}" neexistuje.` };
  if (existing.isBuiltin) {
    return { ok: false, error: `Závodník "${id}" je built-in — nelze smazat. Použij resetBuiltinRacers() pro čisté znovuzaložení.` };
  }

  const { error } = await supabase.from("racers").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
