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
