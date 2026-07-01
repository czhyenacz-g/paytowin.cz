import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabase-admin";
import type { RacerProfile } from "./types";
import { listRacers } from "./repository";
import {
  canMutatePermaRacerOwnership,
  filterGamePoolRacers,
  filterLegendPoolRacers,
} from "./catalog-logic";
import type {
  RacerCategory,
  RacerSpecies,
  RacerAvailabilityStatus,
  RacerSaleStatus,
  RacerUniqueStatus,
} from "./catalog-logic";
export {
  canMutatePermaRacerOwnership,
  filterGamePoolRacers,
  filterLegendPoolRacers,
  isGamePoolRacerProfile,
  isLegendPoolRacerProfile,
  type RacerCategory,
  type RacerSpecies,
  type RacerAvailabilityStatus,
  type RacerSaleStatus,
  type RacerUniqueStatus,
} from "./catalog-logic";

export type RacerPoolType = RacerCategory;
export type RacerAssetType = "front_image" | "side_image" | "idle_animation" | "token_image" | "badge_icon";

export interface RacerTemplate {
  id: string;
  species_id: RacerSpecies;
  name: string;
  slug: string;
  category: RacerCategory;
  pool_type: RacerPoolType;
  rarity: string;
  description: string | null;
  is_active: boolean;
}

export interface RacerAsset {
  id: string;
  racer_unique_id: string | null;
  racer_template_id: string | null;
  asset_type: RacerAssetType;
  path: string;
  sort_order: number;
  is_primary: boolean;
}

export interface PermaRacer {
  id: string;
  template_id: string;
  owner_user_id: string | null;
  name: string;
  slug: string;
  status: RacerUniqueStatus;
  sale_status: RacerSaleStatus;
  category: RacerCategory;
  species_id: RacerSpecies;
  rarity: string;
  description: string | null;
  stamina_current: number | null;
  stamina_max: number | null;
  availability_status: RacerAvailabilityStatus;
  created_at: string;
  updated_at: string;
}

export interface RacerUniqueDetail extends PermaRacer {
  template_name: string;
  template_description: string | null;
  front_image_path: string | null;
  side_image_path: string | null;
  token_image_path: string | null;
  badge_icon_path: string | null;
}

export interface RacerCatalogSection {
  species: RacerSpecies;
  label: string;
  gameRacers: RacerProfile[];
  legendRacers: RacerProfile[];
  permaForSale: PermaRacer[];
  ownedPerma: PermaRacer[];
  classicLegend: RacerProfile[];
}

export type RacerUnique = PermaRacer;

export const SPECIES_LABELS: Record<RacerSpecies, string> = {
  horse: "Koně",
  lama: "Lamy",
  camel: "Velbloudi",
  car: "Auta",
};

function toSpecies(value: unknown): RacerSpecies {
  return value === "horse" || value === "lama" || value === "camel" || value === "car" ? value : "horse";
}

function rowToPermaRacer(row: Record<string, unknown>): PermaRacer {
  const template = (row.racer_templates as Record<string, unknown> | undefined) ?? {};
  return {
    id: row.id as string,
    template_id: row.template_id as string,
    owner_user_id: (row.owner_user_id as string | null | undefined) ?? null,
    name: row.name as string,
    slug: row.slug as string,
    status: row.status as RacerUniqueStatus,
    sale_status: row.sale_status as RacerSaleStatus,
    category: (template.category as RacerCategory) ?? "perma",
    species_id: toSpecies(template.species_id),
    rarity: row.rarity as string,
    description: (row.description as string | null | undefined) ?? null,
    stamina_current: (row.stamina_current as number | null | undefined) ?? null,
    stamina_max: (row.stamina_max as number | null | undefined) ?? null,
    availability_status: (row.availability_status as RacerAvailabilityStatus) ?? "draft",
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

function rowToUniqueDetail(row: Record<string, unknown>): RacerUniqueDetail {
  const unique = rowToPermaRacer(row);
  const template = (row.racer_templates as Record<string, unknown> | undefined) ?? {};
  const assets = Array.isArray(row.racer_assets) ? row.racer_assets as Array<Record<string, unknown>> : [];
  const pick = (assetType: RacerAssetType) => assets.find((a) => a.asset_type === assetType)?.path as string | null | undefined ?? null;
  return {
    ...unique,
    template_name: (template.name as string) ?? unique.name,
    template_description: (template.description as string | null) ?? null,
    front_image_path: pick("front_image"),
    side_image_path: pick("side_image"),
    token_image_path: pick("token_image"),
    badge_icon_path: pick("badge_icon"),
  };
}

export async function getGamePoolRacers(species?: RacerSpecies): Promise<RacerProfile[]> {
  const racers = await listRacers({ isPublic: true });
  return filterGamePoolRacers(racers, species);
}

export async function getLegendPoolRacers(species?: RacerSpecies): Promise<RacerProfile[]> {
  const racers = await listRacers({ isPublic: true });
  return filterLegendPoolRacers(racers, species);
}

export async function getPermaRacersForSale(species?: RacerSpecies): Promise<PermaRacer[]> {
  const { data } = await supabase
    .from("racer_uniques")
    .select("*, racer_templates(category, species_id)")
    .eq("sale_status", "offered")
    .order("created_at", { ascending: false });
  return ((data ?? []) as Record<string, unknown>[]).map(rowToPermaRacer).filter((u) => !species || u.species_id === species);
}

export async function listAllPermaRacers(): Promise<PermaRacer[]> {
  const { data } = await supabase
    .from("racer_uniques")
    .select("*, racer_templates(category, species_id)")
    .order("created_at", { ascending: false });
  return ((data ?? []) as Record<string, unknown>[]).map(rowToPermaRacer);
}

export async function getOwnedPermaRacers(ownerId: string): Promise<PermaRacer[]> {
  const { data } = await supabase
    .from("racer_uniques")
    .select("*, racer_templates(category, species_id)")
    .eq("owner_user_id", ownerId)
    .eq("status", "owned")
    .order("created_at", { ascending: false });
  return ((data ?? []) as Record<string, unknown>[]).map(rowToPermaRacer);
}

export async function updatePermaRacerDetails(
  uniqueRacerId: string,
  update: Partial<Pick<PermaRacer, "name" | "slug" | "rarity" | "status" | "sale_status" | "owner_user_id" | "description" | "stamina_current" | "stamina_max" | "availability_status">> & {
    front_image_path?: string | null;
    side_image_path?: string | null;
    token_image_path?: string | null;
    badge_icon_path?: string | null;
  },
): Promise<{ ok: true; racer: PermaRacer } | { ok: false; error: string }> {
  const { data, error } = await supabaseAdmin
    .from("racer_uniques")
    .update({
      name: update.name,
      slug: update.slug,
      rarity: update.rarity,
      status: update.status,
      sale_status: update.sale_status,
      owner_user_id: update.owner_user_id,
      description: update.description,
      stamina_current: update.stamina_current,
      stamina_max: update.stamina_max,
      availability_status: update.availability_status,
    })
    .eq("id", uniqueRacerId)
    .select("*, racer_templates(category, species_id)")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Nepodařilo se uložit perma racera." };
  return { ok: true, racer: rowToPermaRacer(data as Record<string, unknown>) };
}

export async function upsertPermaRacerAsset(
  uniqueRacerId: string,
  assetType: RacerAssetType,
  path: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error: deleteError } = await supabaseAdmin
    .from("racer_assets")
    .delete()
    .eq("racer_unique_id", uniqueRacerId)
    .eq("asset_type", assetType);
  if (deleteError) return { ok: false, error: deleteError.message };

  const { error } = await supabaseAdmin.from("racer_assets").insert({
    racer_unique_id: uniqueRacerId,
    racer_template_id: null,
    asset_type: assetType,
    path,
    sort_order: 0,
    is_primary: assetType === "front_image",
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function getPermaRacerBySlug(slug: string): Promise<RacerUniqueDetail | null> {
  const { data } = await supabase
    .from("racer_uniques")
    .select("*, racer_templates(name, slug, species_id, description, category), racer_assets(asset_type, path, is_primary, sort_order)")
    .eq("slug", slug)
    .single();
  if (!data) return null;
  return rowToUniqueDetail(data as Record<string, unknown>);
}

export async function getRacerUniqueBySlug(slug: string): Promise<RacerUniqueDetail | null> {
  return getPermaRacerBySlug(slug);
}

export async function getPermaRacerAssets(uniqueRacerId: string): Promise<RacerAsset[]> {
  const { data } = await supabase
    .from("racer_assets")
    .select("*")
    .eq("racer_unique_id", uniqueRacerId)
    .order("sort_order", { ascending: true });
  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    id: row.id as string,
    racer_unique_id: (row.racer_unique_id as string | null | undefined) ?? null,
    racer_template_id: (row.racer_template_id as string | null | undefined) ?? null,
    asset_type: row.asset_type as RacerAssetType,
    path: row.path as string,
    sort_order: Number(row.sort_order ?? 0),
    is_primary: Boolean(row.is_primary),
  }));
}

async function loadPermaRacerById(uniqueRacerId: string): Promise<PermaRacer | null> {
  const { data } = await supabaseAdmin
    .from("racer_uniques")
    .select("*, racer_templates(category, species_id)")
    .eq("id", uniqueRacerId)
    .maybeSingle();
  return data ? rowToPermaRacer(data as Record<string, unknown>) : null;
}

export async function assignPermaRacerToUser(uniqueRacerId: string, userId: string): Promise<{ ok: true; racer: PermaRacer } | { ok: false; error: string }> {
  const existing = await loadPermaRacerById(uniqueRacerId);
  if (!existing) return { ok: false, error: "Perma racer nenalezen." };
  const canMutate = canMutatePermaRacerOwnership(existing, userId);
  if (!canMutate.ok) return canMutate;

  const { data, error } = await supabaseAdmin
    .from("racer_uniques")
    .update({
      owner_user_id: userId,
      status: "owned",
      sale_status: "sold",
      availability_status: "available",
    })
    .eq("id", uniqueRacerId)
    .or(`owner_user_id.is.null,owner_user_id.eq.${userId}`)
    .select("*, racer_templates(category, species_id)")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Nepodařilo se přiřadit perma racera." };
  return { ok: true, racer: rowToPermaRacer(data as Record<string, unknown>) };
}

export async function reservePermaRacerForUser(uniqueRacerId: string, userId: string): Promise<{ ok: true; racer: PermaRacer } | { ok: false; error: string }> {
  const existing = await loadPermaRacerById(uniqueRacerId);
  if (!existing) return { ok: false, error: "Perma racer nenalezen." };
  const canMutate = canMutatePermaRacerOwnership(existing, userId);
  if (!canMutate.ok) return canMutate;

  const { data, error } = await supabaseAdmin
    .from("racer_uniques")
    .update({
      owner_user_id: userId,
      status: "reserved",
      sale_status: "reserved",
      availability_status: "reserved",
    })
    .eq("id", uniqueRacerId)
    .eq("sale_status", "offered")
    .select("*, racer_templates(category, species_id)")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Nepodařilo se rezervovat perma racera." };
  return { ok: true, racer: rowToPermaRacer(data as Record<string, unknown>) };
}

export async function markPermaRacerSold(uniqueRacerId: string, userId: string): Promise<{ ok: true; racer: PermaRacer } | { ok: false; error: string }> {
  const existing = await loadPermaRacerById(uniqueRacerId);
  if (!existing) return { ok: false, error: "Perma racer nenalezen." };
  const canMutate = canMutatePermaRacerOwnership(existing, userId);
  if (!canMutate.ok) return canMutate;

  const { data, error } = await supabaseAdmin
    .from("racer_uniques")
    .update({
      owner_user_id: userId,
      status: "owned",
      sale_status: "sold",
      availability_status: "available",
    })
    .eq("id", uniqueRacerId)
    .in("sale_status", ["offered", "reserved"])
    .or(`owner_user_id.is.null,owner_user_id.eq.${userId}`)
    .select("*, racer_templates(category, species_id)")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Nepodařilo se označit perma racera jako prodaného." };
  return { ok: true, racer: rowToPermaRacer(data as Record<string, unknown>) };
}

async function getClassicLegendRacers(): Promise<RacerProfile[]> {
  const { data } = await supabase
    .from("racers")
    .select("*")
    .like("id", "cl-%")
    .eq("type", "horse")
    .order("name");
  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    id:          row.id          as string,
    name:        row.name        as string,
    speed:       row.speed       as number,
    price:       row.price       as number,
    emoji:       row.emoji       as string,
    maxStamina:  row.max_stamina as number,
    isLegendary: row.is_legendary as boolean,
    flavorText:  row.flavor_text as string | undefined,
    imageUrl:    row.image_url   as string | undefined,
    imagePath:   row.image_path  as string | undefined,
    type:        "horse" as const,
    isBuiltin:   row.is_builtin  as boolean,
    isPublic:    row.is_public   as boolean,
    ownerId:     row.owner_id    as string | undefined,
  }));
}

export async function getRacerCatalogSections(): Promise<RacerCatalogSection[]> {
  const speciesList: RacerSpecies[] = ["horse", "lama", "camel", "car"];
  const classicLegend = await getClassicLegendRacers();
  return Promise.all(speciesList.map(async (species) => ({
    species,
    label: SPECIES_LABELS[species],
    gameRacers: await getGamePoolRacers(species),
    legendRacers: await getLegendPoolRacers(species),
    permaForSale: await getPermaRacersForSale(species),
    ownedPerma: [],
    classicLegend: species === "horse" ? classicLegend : [],
  })));
}
