"use server";

import { supabase } from "@/lib/supabase";
import { THEMES } from "@/lib/themes";
import type { RacerConfig } from "@/lib/themes";
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
  isPublic?: boolean;
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
      .select("id, manifest, is_official, is_public")
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
        isPublic: row.is_public,
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
 *
 * Built-in themes se vždy načítají z registru — DB lookup je přeskočen.
 * Důvod: saveThemeAction blokuje zápis built-in IDs, takže DB verze built-in
 * je vždy stará (nevalidní) a způsobuje nekonzistence v Theme Builderu.
 */
export async function loadThemeAction(id: string): Promise<ThemeManifest | { error: string }> {
  if (!id.trim()) return { error: "Zadej ID theme." };

  const trimmed = id.trim();

  // 1. DB — jen pro non-built-in themes (built-in nelze uložit → DB verze je stará)
  if (!BUILTIN_IDS.has(trimmed)) {
    const dbManifest = await getThemeFromDb(trimmed);
    if (dbManifest) return dbManifest;
  }

  // 2. Built-in registr
  const { loadThemeManifestAsync } = await import("@/lib/themes/loader");
  const manifest = await loadThemeManifestAsync(trimmed);
  if (manifest.meta.id === trimmed) return manifest;

  return { error: `Theme "${trimmed}" nenalezeno (ani v DB ani v registru).` };
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

// ─── Set public ───────────────────────────────────────────────────────────────

/**
 * setPublicAction — nastaví is_public na DB theme.
 * Built-in themes nelze zveřejnit (jsou dostupné vždy jinak).
 */
export async function setPublicAction(
  id: string,
  isPublic: boolean
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (BUILTIN_IDS.has(id)) {
    return { ok: false, error: `Theme "${id}" je zabudovaný — is_public nelze měnit.` };
  }
  const { error } = await supabase
    .from("themes")
    .update({ is_public: isPublic })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ─── Patch racers in source file (dev-only) ───────────────────────────────────
// Pomocné funkce kopírují logiku z app/api/dev/save-editor-state/route.ts.
// Pracují jen s built-in themes — lib/themes/{themeId}.ts musí existovat.

function _esc(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function _findClose(src: string, pos: number): number {
  const open = src[pos];
  const close = open === "{" ? "}" : open === "[" ? "]" : null;
  if (!close) throw new Error(`Not a bracket at pos ${pos}: "${open}"`);
  let depth = 0;
  let i = pos;
  while (i < src.length) {
    const ch = src[i];
    if (ch === '"' || ch === "'") {
      i++;
      while (i < src.length) {
        if (src[i] === "\\") { i += 2; continue; }
        if (src[i] === ch) break;
        i++;
      }
    } else if (ch === "`") {
      i++;
      while (i < src.length) {
        if (src[i] === "\\") { i += 2; continue; }
        if (src[i] === "`") break;
        i++;
      }
    } else if (ch === open) { depth++;
    } else if (ch === close) { depth--; if (depth === 0) return i; }
    i++;
  }
  throw new Error(`No matching "${close}" for "${open}" at pos ${pos}`);
}

function _addIndent(text: string, indent: string): string {
  return text.split("\n").map((l, i) => (i === 0 ? l : indent + l)).join("\n");
}

function _replaceStringKey(src: string, key: string, val: string): string {
  const re = new RegExp(`([ \\t]*${_esc(key)}:\\s*)("(?:[^"\\\\]|\\\\.)*"|'(?:[^'\\\\]|\\\\.)*'|\`(?:[^\`\\\\]|\\\\.)*\`)`);
  const m = re.exec(src);
  if (!m) throw new Error(`String key "${key}" not found in source`);
  const quoted = JSON.stringify(val);
  return src.slice(0, m.index + m[1].length) + quoted + src.slice(m.index + m[1].length + m[2].length);
}

function _upsertStringKey(src: string, key: string, val: string): string {
  const existing = new RegExp(`[ \\t]*${_esc(key)}:\\s*(?:"[^"]*"|'[^']*')`);
  if (existing.test(src)) return _replaceStringKey(src, key, val);
  // Vlož za description — spotřebuj trailing čárku a znovu ji přidej, aby nevzniklo ,,
  return src.replace(
    /([ \t]*description:\s*(?:"[^"]*"|'[^']*')),?/,
    `$1,\n  ${key}: ${JSON.stringify(val)},`,
  );
}

function _replaceObjectKey(src: string, key: string, val: unknown, baseIndent: string): string {
  const re = new RegExp(`([ \\t]*${_esc(key)}:\\s*)([\\[{])`);
  const m = re.exec(src);
  if (!m) throw new Error(`Key "${key}" not found in source`);
  const prefixEnd = m.index + m[1].length;
  const closeIdx = _findClose(src, prefixEnd);
  const hasComma = src[closeIdx + 1] === ",";
  const endIdx = closeIdx + 1 + (hasComma ? 1 : 0);
  const serialized = _addIndent(JSON.stringify(val, null, 2), baseIndent);
  return src.slice(0, prefixEnd) + serialized + (hasComma ? "," : "") + src.slice(endIdx);
}

/**
 * patchRacersInFileAction — zapíše racery přímo do lib/themes/{themeId}.ts.
 * Dev-only. Funguje jen pro built-in themes kde soubor existuje.
 */
export async function patchRacersInFileAction(
  themeId: string,
  racers: RacerConfig[],
  racerRefs?: Array<{ slotIndex: number; racer_id: string }>,
  meta?: { name?: string; description?: string; version?: string },
): Promise<{ ok: true; written: string[] } | { ok: false; error: string }> {
  if (typeof themeId !== "string" || !/^[a-z0-9][a-z0-9_-]*$/.test(themeId)) {
    return { ok: false, error: `Neplatné themeId: "${themeId}"` };
  }

  const fs   = await import("fs");
  const path = await import("path");
  const cwd  = process.cwd();
  const rel  = `lib/themes/${themeId}.ts`;
  const abs  = path.join(cwd, rel);

  const allowedDir = path.join(cwd, "lib", "themes") + path.sep;
  if (!abs.startsWith(allowedDir)) return { ok: false, error: "Path traversal detected" };
  if (!fs.existsSync(abs)) {
    return {
      ok: false,
      error: `Soubor nenalezen: ${rel}. patchRacersInFileAction funguje jen pro built-in themes.`,
    };
  }

  try {
    let src = fs.readFileSync(abs, "utf-8");
    src = _replaceObjectKey(src, "racers", racers, "  ");
    if (racerRefs !== undefined) {
      src = _replaceObjectKey(src, "racerRefs", racerRefs, "  ");
    }
    if (meta?.name !== undefined)        src = _replaceStringKey(src, "name", meta.name);
    if (meta?.description !== undefined) src = _replaceStringKey(src, "description", meta.description);
    if (meta?.version !== undefined)     src = _upsertStringKey(src, "version", meta.version);
    fs.writeFileSync(abs, src, "utf-8");
    return { ok: true, written: [rel] };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}
