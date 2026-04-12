"use server";

import { getThemeFromDb, upsertThemeToDb } from "@/lib/repository";
import { validateThemeManifest } from "@/lib/themes/validator";
import type { ThemeManifest } from "@/lib/themes/manifest";

// ─── ThemeMeta — minimální info pro select ────────────────────────────────────

export type ThemeMeta = {
  id: string;
  name: string;
  version: string;
  source: "built-in" | "db";
  isOfficial?: boolean;
};

/**
 * listThemesAction — seznam všech dostupných themes pro select v dev toolu.
 * Pořadí: built-in themes, pak DB themes (nejnovější první).
 */
export async function listThemesAction(): Promise<ThemeMeta[]> {
  const results: ThemeMeta[] = [];

  // Built-in z in-memory registru
  const { loadAllThemeManifests } = await import("@/lib/themes/loader");
  const { valid } = loadAllThemeManifests();
  for (const m of valid) {
    results.push({ id: m.meta.id, name: m.meta.name, version: m.meta.version, source: "built-in" });
  }

  // DB themes
  try {
    const { supabase } = await import("@/lib/supabase");
    const { data } = await supabase
      .from("themes")
      .select("id, manifest, is_official")
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

/**
 * loadThemeAction — načte manifest podle ID.
 * Hledá: DB → built-in registr.
 * Vrátí chybu pokud ID nenalezeno v žádném zdroji.
 */
export async function loadThemeAction(id: string): Promise<ThemeManifest | { error: string }> {
  if (!id.trim()) return { error: "Zadej ID theme." };

  // 1. DB
  const dbManifest = await getThemeFromDb(id.trim());
  if (dbManifest) return dbManifest;

  // 2. Built-in — loadThemeManifestAsync dělá DB→built-in→default chain
  //    ale fallbackne na default pokud id nenajde → proto ověříme shodu id
  const { loadThemeManifestAsync } = await import("@/lib/themes/loader");
  const manifest = await loadThemeManifestAsync(id.trim());
  if (manifest.meta.id === id.trim()) return manifest;

  return { error: `Theme "${id}" nenalezeno (ani v DB ani v registru).` };
}

export async function saveThemeAction(
  manifest: ThemeManifest
): Promise<{ ok: true } | { ok: false; error: string }> {
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
