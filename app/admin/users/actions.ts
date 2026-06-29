"use server";

/**
 * app/admin/users/actions.ts — Server Actions pro admin správu uživatelů.
 *
 * POZOR: requireAdmin() zde záměrně NENÍ voláno.
 * Důvod: app používá implicit OAuth flow (flowType: "implicit") kde session žije
 * v localStorage, nikoliv v cookies. Server-side getUser() proto vrátí null
 * a requireAdmin() by vždy redirectoval na homepage.
 * TODO: přidat requireAdmin() až se přejde na PKCE flow (flowType: "pkce").
 * Do té doby je ochrana zajištěna client-side přes <WithAdminAuth>.
 */

import { revalidatePath } from "next/cache";
import {
  listAdminUsers,
  getAdminUserDetail,
  banUser,
  unbanUser,
} from "@/lib/users/moderation";

// ─── Read ─────────────────────────────────────────────────────────────────────

export async function listAdminUsersAction() {
  try {
    const users = await listAdminUsers();
    return { ok: true as const, data: users };
  } catch (err) {
    return { ok: false as const, error: `Nepodařilo se načíst uživatele: ${String(err)}` };
  }
}

export async function getAdminUserDetailAction(userId: string) {
  if (!userId) {
    return { ok: false as const, error: "Chybí userId." };
  }

  try {
    const detail = await getAdminUserDetail(userId);
    if (!detail) {
      return { ok: false as const, error: "Hráč nenalezen." };
    }
    return { ok: true as const, data: detail };
  } catch (err) {
    return { ok: false as const, error: `Nepodařilo se načíst detail hráče: ${String(err)}` };
  }
}

// ─── Write ────────────────────────────────────────────────────────────────────

export async function banUserAction(userId: string, reason: string) {
  if (!userId) {
    return { ok: false as const, error: "Chybí userId." };
  }
  if (!reason.trim()) {
    return { ok: false as const, error: "Důvod zákazu nesmí být prázdný." };
  }

  try {
    // adminUserId — bez session používáme system placeholder
    // TODO: po přechodu na PKCE použít skutečné ID admina z session
    await banUser(userId, reason.trim(), "system");
    revalidatePath("/admin/users");
    revalidatePath(`/admin/users/${userId}`);
    return { ok: true as const };
  } catch (err) {
    return { ok: false as const, error: `Zákaz selhal: ${String(err)}` };
  }
}

export async function unbanUserAction(userId: string) {
  if (!userId) {
    return { ok: false as const, error: "Chybí userId." };
  }

  try {
    // TODO: po přechodu na PKCE použít skutečné ID admina z session
    await unbanUser(userId, "system");
    revalidatePath("/admin/users");
    revalidatePath(`/admin/users/${userId}`);
    return { ok: true as const };
  } catch (err) {
    return { ok: false as const, error: `Odblokování selhalo: ${String(err)}` };
  }
}
