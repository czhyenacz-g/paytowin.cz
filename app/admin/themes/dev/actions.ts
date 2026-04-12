"use server";

import { getThemeFromDb, upsertThemeToDb } from "@/lib/repository";
import { validateThemeManifest } from "@/lib/themes/validator";
import type { ThemeManifest } from "@/lib/themes/manifest";

export async function loadThemeAction(id: string): Promise<ThemeManifest | { error: string }> {
  if (!id.trim()) return { error: "Zadej ID theme." };
  const manifest = await getThemeFromDb(id.trim());
  if (!manifest) return { error: `Theme "${id}" v DB nenalezeno.` };
  return manifest;
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
