/**
 * lib/users/moderation.ts — Admin helpery pro správu uživatelů a moderaci.
 *
 * Používá supabaseAdmin (service role) — volat pouze server-side.
 * NIKDY neimportovat v client komponentách.
 */

import { supabaseAdmin } from "@/lib/supabase-admin";

// ─── Typy ─────────────────────────────────────────────────────────────────────

export type UserModerationStatus = "active" | "banned";

export interface UserModerationRecord {
  user_id: string;
  status: UserModerationStatus;
  ban_reason: string | null;
  banned_at: string | null;
  banned_by: string | null;
  updated_at: string;
}

export interface AdminUserListItem {
  id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  moderation_status: UserModerationStatus;
  perma_racer_count: number;
}

export interface AdminUserDetail {
  id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  moderation: UserModerationRecord | null;
  permaRacers: PermaRacerSummary[];
}

export interface PermaRacerSummary {
  id: string;
  name: string | null;
  slug: string | null;
  status: string | null;
}

// ─── Read ─────────────────────────────────────────────────────────────────────

/**
 * listAdminUsers — seznam všech auth hráčů s moderačním stavem a počtem perma racerů.
 */
export async function listAdminUsers(): Promise<AdminUserListItem[]> {
  // Načti users přes Admin API (vrátí max 1000 — pro MVP dostačující)
  const { data: usersData, error: usersError } = await supabaseAdmin.auth.admin.listUsers({
    perPage: 1000,
  });

  if (usersError) {
    throw new Error(`Nepodařilo se načíst uživatele: ${usersError.message}`);
  }

  const users = usersData.users;

  if (users.length === 0) {
    return [];
  }

  const userIds = users.map((u) => u.id);

  // Moderační záznamy
  const { data: moderationRows } = await supabaseAdmin
    .from("user_moderation")
    .select("user_id, status")
    .in("user_id", userIds);

  const moderationMap = new Map<string, UserModerationStatus>(
    (moderationRows ?? []).map((r) => [r.user_id, r.status as UserModerationStatus])
  );

  // Počty perma racerů
  const { data: racerRows } = await supabaseAdmin
    .from("racer_uniques")
    .select("owner_user_id")
    .in("owner_user_id", userIds)
    .not("owner_user_id", "is", null);

  const racerCountMap = new Map<string, number>();
  for (const row of racerRows ?? []) {
    if (row.owner_user_id) {
      racerCountMap.set(row.owner_user_id, (racerCountMap.get(row.owner_user_id) ?? 0) + 1);
    }
  }

  return users.map((u) => ({
    id: u.id,
    email: u.email ?? null,
    created_at: u.created_at,
    last_sign_in_at: u.last_sign_in_at ?? null,
    moderation_status: moderationMap.get(u.id) ?? "active",
    perma_racer_count: racerCountMap.get(u.id) ?? 0,
  }));
}

/**
 * getAdminUserDetail — detail jednoho hráče včetně moderace a perma racerů.
 */
export async function getAdminUserDetail(userId: string): Promise<AdminUserDetail | null> {
  const { data: userData, error: userError } =
    await supabaseAdmin.auth.admin.getUserById(userId);

  if (userError || !userData?.user) {
    return null;
  }

  const user = userData.user;

  // Moderační záznam
  const { data: modRow } = await supabaseAdmin
    .from("user_moderation")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  // Perma raceři hráče
  const { data: racerRows } = await supabaseAdmin
    .from("racer_uniques")
    .select("id, name, slug, status")
    .eq("owner_user_id", userId);

  return {
    id: user.id,
    email: user.email ?? null,
    created_at: user.created_at,
    last_sign_in_at: user.last_sign_in_at ?? null,
    moderation: modRow
      ? {
          user_id: modRow.user_id,
          status: modRow.status as UserModerationStatus,
          ban_reason: modRow.ban_reason ?? null,
          banned_at: modRow.banned_at ?? null,
          banned_by: modRow.banned_by ?? null,
          updated_at: modRow.updated_at,
        }
      : null,
    permaRacers: (racerRows ?? []).map((r) => ({
      id: r.id,
      name: r.name ?? null,
      slug: r.slug ?? null,
      status: r.status ?? null,
    })),
  };
}

// ─── Moderace ─────────────────────────────────────────────────────────────────

/**
 * getUserModerationStatus — vrátí stav hráče (active/banned).
 */
export async function getUserModerationStatus(userId: string): Promise<UserModerationStatus> {
  const { data } = await supabaseAdmin
    .from("user_moderation")
    .select("status")
    .eq("user_id", userId)
    .maybeSingle();

  return (data?.status as UserModerationStatus) ?? "active";
}

/**
 * banUser — zakáže hráče. Upsertne záznam v user_moderation.
 */
export async function banUser(
  userId: string,
  reason: string,
  adminUserId: string
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("user_moderation")
    .upsert(
      {
        user_id: userId,
        status: "banned",
        ban_reason: reason,
        banned_at: new Date().toISOString(),
        banned_by: adminUserId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

  if (error) {
    throw new Error(`Zákaz hráče selhal: ${error.message}`);
  }
}

/**
 * unbanUser — odblokuje hráče.
 */
export async function unbanUser(userId: string, adminUserId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("user_moderation")
    .upsert(
      {
        user_id: userId,
        status: "active",
        ban_reason: null,
        banned_at: null,
        banned_by: adminUserId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

  if (error) {
    throw new Error(`Odblokování hráče selhalo: ${error.message}`);
  }
}

/**
 * isUserBanned — vrátí true pokud je hráč zakázán.
 */
export async function isUserBanned(userId: string): Promise<boolean> {
  const status = await getUserModerationStatus(userId);
  return status === "banned";
}

/**
 * assertUserNotBanned — vyhodí chybu pokud je hráč zakázán.
 */
export async function assertUserNotBanned(userId: string): Promise<void> {
  const banned = await isUserBanned(userId);
  if (banned) {
    throw new Error("Přístup odepřen: tento hráč byl zakázán.");
  }
}
