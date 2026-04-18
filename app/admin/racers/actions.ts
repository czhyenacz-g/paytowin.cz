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
import { seedBuiltinRacers, resetBuiltinRacers } from "@/lib/racers/seed-builtin";
import type { RacerProfile, RacerProfileInsert, RacerProfileUpdate } from "@/lib/racers/types";

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
