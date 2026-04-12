"use server";

import { supabase } from "@/lib/supabase";
import { THEMES } from "@/lib/themes";
import { getThemeFromDb, upsertThemeToDb } from "@/lib/repository";
import { validateThemeManifest } from "@/lib/themes/validator";
import type { ThemeManifest } from "@/lib/themes/manifest";

/** IDs zabudovaných themes — chráněny před přepsáním a archivací. */
const BUILTIN_IDS = new Set(THEMES.map((t) => t.id));

// ─── ThemeMeta ────────────────────────────────────────────────────────────────

export type ThemeMeta = {
  id: string;
  name: string;
  version: string;
  source: "built-in" | "db";
  isOfficial?: boolean;
};

// ─── List ─────────────────────────────────────────────────────────────────────

/**
 * listThemesAction — seznam všech dostupných themes.
 * Pořadí: built-in, pak DB (nejnovější první).
 * Archivované DB themes jsou vynechány.
 */
export async function listThemesAction(): Promise<ThemeMeta[]> {
  const results: ThemeMeta[] = [];

  // Built-in z in-memory registru
  const { loadAllThemeManifests } = await import("@/lib/themes/loader");
  const { valid } = loadAllThemeManifests();
  for (const m of valid) {
    results.push({ id: m.meta.id, name: m.meta.name, version: m.meta.version, source: "built-in" });
  }

  // DB themes (bez archivovaných)
  try {
    const { data } = await supabase
      .from("themes")
      .select("id, manifest, is_official")
      .eq("is_archived", false)
      .order("created_at", { ascending: false });

    for (const row of data ?? []) {
      const meta = (row.manifest as Record<string, unknown>)?.meta as Record<string, string> | undefined;
      results.push({
        id: row.id,
        name: meta?.name ?? row.id,
        version: meta?.version ?? "?",
        source: "db",
        isOfficial: row.is_official,
      });
    }
  } catch {
    // DB nedostupná — vrátíme jen built-ins
  }

  return results;
}

// ─── Load ─────────────────────────────────────────────────────────────────────

/**
 * loadThemeAction — načte manifest podle ID.
 * Priorita: DB → built-in registr.
 */
export async function loadThemeAction(id: string): Promise<ThemeManifest | { error: string }> {
  if (!id.trim()) return { error: "Zadej ID theme." };

  // 1. DB
  const dbManifest = await getThemeFromDb(id.trim());
  if (dbManifest) return dbManifest;

  // 2. Built-in (loadThemeManifestAsync dělá DB→built-in chain, ověříme shodu id)
  const { loadThemeManifestAsync } = await import("@/lib/themes/loader");
  const manifest = await loadThemeManifestAsync(id.trim());
  if (manifest.meta.id === id.trim()) return manifest;

  return { error: `Theme "${id}" nenalezeno (ani v DB ani v registru).` };
}

// ─── Save (upsert) ────────────────────────────────────────────────────────────

/**
 * saveThemeAction — uloží nebo přepíše DB theme.
 * Blokuje přepsání built-in themes.
 */
export async function saveThemeAction(
  manifest: ThemeManifest
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (BUILTIN_IDS.has(manifest.meta.id)) {
    return {
      ok: false,
      error: `Theme "${manifest.meta.id}" je zabudovaný — nelze přepsat. Použij Duplikovat a změň meta.id.`,
    };
  }
  if (!validateThemeManifest(manifest)) {
    return { ok: false, error: "Manifest neprojde validací — oprav chyby a zkus znovu." };
  }
  try {
    await upsertThemeToDb(manifest, { isOfficial: false, isPublic: false });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

// ─── Save as new (insert only) ────────────────────────────────────────────────

/**
 * saveAsNewAction — uloží manifest jako NOVÝ záznam v DB.
 * Selže pokud ID je built-in nebo již existuje v DB.
 */
export async function saveAsNewAction(
  manifest: ThemeManifest
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (BUILTIN_IDS.has(manifest.meta.id)) {
    return {
      ok: false,
      error: `ID "${manifest.meta.id}" patří zabudovanému theme. Změň meta.id na jiné.`,
    };
  }
  if (!validateThemeManifest(manifest)) {
    return { ok: false, error: "Manifest neprojde validací — oprav chyby a zkus znovu." };
  }
  // Zkontroluj zda ID již existuje v DB
  const existing = await getThemeFromDb(manifest.meta.id);
  if (existing) {
    return {
      ok: false,
      error: `Theme "${manifest.meta.id}" v DB již existuje. Změň meta.id nebo použij "Uložit" pro update.`,
    };
  }
  try {
    await upsertThemeToDb(manifest, { isOfficial: false, isPublic: false });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

// ─── Archive ──────────────────────────────────────────────────────────────────

/**
 * archiveThemeAction — označí DB theme jako archivovaný (is_archived=true).
 * Built-in themes archivovat nelze.
 */
export async function archiveThemeAction(
  id: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (BUILTIN_IDS.has(id)) {
    return { ok: false, error: `Theme "${id}" je zabudovaný — nelze archivovat.` };
  }
  const { error } = await supabase
    .from("themes")
    .update({ is_archived: true })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
