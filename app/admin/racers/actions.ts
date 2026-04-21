"use server";

/**
 * app/admin/racers/actions.ts — Server Actions pro globální Racer Registry.
 *
 * Tyto akce jsou primární interface pro Racer Admin UI.
 * Nahrazují per-theme akce (patchRacersInFileAction, saveThemeAction) pro účely editace racerů.
 *
 * Per-theme akce v app/admin/themes/dev/actions.ts zůstávají pro theme save flow
 * (ukládání celého ThemeManifest, board dat apod.) — nejsou dotčeny.
 */

import path from "path";
import fs from "fs/promises";
import {
  listRacers,
  getRacerById,
  upsertRacer,
  updateRacer,
  deleteRacer,
} from "@/lib/racers/repository";
import { uploadRacerImage } from "@/lib/racers/storage";
import { seedBuiltinRacers, resetBuiltinRacers } from "@/lib/racers/seed-builtin";
import { resolveRacerRefs } from "@/lib/racers/resolver";
import type { RacerRef } from "@/lib/racers/resolver";
import type { RacerProfile, RacerProfileInsert, RacerProfileUpdate } from "@/lib/racers/types";
import type { RacerConfig } from "@/lib/themes";

// ─── Read ─────────────────────────────────────────────────────────────────────

export async function listRacersAction(opts?: {
  type?:      string;
  isPublic?:  boolean;
  isBuiltin?: boolean;
}): Promise<RacerProfile[]> {
  return listRacers(opts);
}

export async function getRacerByIdAction(id: string): Promise<RacerProfile | null> {
  return getRacerById(id);
}

// ─── Write ────────────────────────────────────────────────────────────────────

export async function upsertRacerAction(
  racer: RacerProfileInsert,
): Promise<{ ok: true } | { ok: false; error: string }> {
  return upsertRacer(racer);
}

export async function updateRacerAction(
  id: string,
  update: RacerProfileUpdate,
): Promise<{ ok: true } | { ok: false; error: string }> {
  return updateRacer(id, update);
}

export async function deleteRacerAction(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  return deleteRacer(id);
}

// ─── Registry Resolve ─────────────────────────────────────────────────────────

/**
 * resolveRacerRefsAction — přeloží RacerRef[] na RacerConfig[] z globální registry.
 *
 * Určeno pro volání z client komponent (GameBoard, ThemeDevTool apod.).
 * Pokud závodník není v registry, je přeskočen (s console.warn).
 * Volající musí zajistit fallback na inline racers pokud výsledek je [].
 */
export async function resolveRacerRefsAction(refs: RacerRef[]): Promise<RacerConfig[]> {
  return resolveRacerRefs(refs);
}

// ─── Image Upload ─────────────────────────────────────────────────────────────

/**
 * uploadRacerImageAction — nahraje obrázek závodníka do Supabase Storage.
 *
 * FormData musí obsahovat pole 'file' (File/Blob).
 * Server konvertuje soubor do WebP 512×512 přes sharp a uloží do bucketu 'racers'.
 * Po úspěšném uploadu aktualizuje imageUrl a imagePath v profilu závodníka.
 *
 * Vyžaduje SUPABASE_SERVICE_ROLE_KEY v prostředí (viz lib/supabase-admin.ts).
 */
export async function uploadRacerImageAction(
  racerId: string,
  formData: FormData,
): Promise<{ ok: true; imageUrl: string; imagePath: string } | { ok: false; error: string }> {
  const file = formData.get("file");
  if (!file || typeof file === "string") {
    return { ok: false, error: "Chybí soubor — formData musí obsahovat pole 'file'." };
  }

  // Built-in raceři používají sdílené builtin assety, ne per-upload soubory v DB storage.
  // Upload pro is_builtin=true by vytvořil zbytečnou kopii a obešel správu official content.
  const existing = await getRacerById(racerId);
  if (existing?.isBuiltin) {
    return { ok: false, error: "Obrázek built-in závodníka nelze změnit přes upload — použij builtin asset pipeline." };
  }

  const arrayBuffer = await (file as File).arrayBuffer();
  const uploadResult = await uploadRacerImage(racerId, arrayBuffer);
  if (!uploadResult.ok) return uploadResult;

  // Okamžitě propsat do profilu závodníka v registry
  const updateResult = await updateRacer(racerId, {
    imageUrl:  uploadResult.publicUrl,
    imagePath: uploadResult.path,
  });
  if (!updateResult.ok) {
    return {
      ok:    false,
      error: `Soubor nahrán (${uploadResult.path}), ale update profilu selhal: ${updateResult.error}`,
    };
  }

  return { ok: true, imageUrl: uploadResult.publicUrl, imagePath: uploadResult.path };
}

// ─── Built-in asset save (localhost only) ─────────────────────────────────────

/**
 * saveBuiltinRacerImageAction — uloží obrázek built-in závodníka přímo do public/themes/.
 *
 * Funguje POUZE v development prostředí (NODE_ENV !== "production").
 * Přijme soubor, zkonvertuje na WebP 512×512 přes sharp a zapíše na disk.
 *
 * Výsledná cesta: public/themes/<themeId>/racer-<racerId>.webp
 * Vrácená veřejná URL: /themes/<themeId>/racer-<racerId>.webp
 */
export async function saveBuiltinRacerImageAction(
  racerId: string,
  formData: FormData,
  themeId?: string,
): Promise<{ ok: true; imageUrl: string } | { ok: false; error: string }> {
  if (process.env.NODE_ENV === "production") {
    return { ok: false, error: "Tato akce je dostupná pouze na localhostu." };
  }

  const file = formData.get("file");
  if (!file || typeof file === "string") {
    return { ok: false, error: "Chybí soubor." };
  }

  if (!racerId) {
    return { ok: false, error: "Chybí racerId." };
  }

  const targetTheme = themeId || "_shared";

  try {
    const arrayBuffer = await (file as File).arrayBuffer();
    const inputBuffer = Buffer.from(arrayBuffer);

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const sharp = (await import("sharp")).default;
    const webpBuffer = await sharp(inputBuffer)
      .resize(512, 512, { fit: "cover", position: "centre" })
      .webp({ quality: 85 })
      .toBuffer();

    const filename = `racer-${racerId}.webp`;
    const destDir = path.join(process.cwd(), "public", "themes", targetTheme);
    await fs.mkdir(destDir, { recursive: true });
    await fs.writeFile(path.join(destDir, filename), webpBuffer);

    return { ok: true, imageUrl: `/themes/${targetTheme}/${filename}` };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

// ─── Seed / Reset ─────────────────────────────────────────────────────────────

/**
 * seedBuiltinRacersAction — seeduje built-in závodníky do tabulky racers.
 *
 * Bezpečné pro opakované spuštění (upsert).
 * Volej z Racer Admin UI když je registry prázdná, nebo při prvním nasazení.
 */
export async function seedBuiltinRacersAction(): Promise<{
  inserted: number;
  errors: Array<{ id: string; error: string }>;
}> {
  return seedBuiltinRacers();
}

/**
 * resetBuiltinRacersAction — smaže is_builtin=true záznamy a seeduje znovu.
 *
 * DESTRUKTIVNÍ pro built-in závodníky — user-created závodníci zůstanou.
 * Použij pro čistý reset při změně built-in racer dat.
 */
export async function resetBuiltinRacersAction(): Promise<{
  deleted: number;
  inserted: number;
  errors: Array<{ id: string; error: string }>;
}> {
  return resetBuiltinRacers();
}
