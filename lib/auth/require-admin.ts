"use server";

import { createSupabaseServerClient } from "@/lib/supabase-server";

export type AdminContext = {
  userId: string;
  email: string | null;
};

export async function isAdminUser(userId: string): Promise<boolean> {
  const { supabaseAdmin } = await import("@/lib/supabase-admin");
  const { data, error } = await supabaseAdmin
    .from("admin_users")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Admin lookup selhal: ${error.message}`);
  }

  return !!data;
}

export async function requireAuthenticatedUser(): Promise<AdminContext> {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error) {
    throw new Error("Přihlášení je vyžadováno.");
  }
  if (!user) {
    throw new Error("Přihlášení je vyžadováno.");
  }

  return {
    userId: user.id,
    email: user.email ?? null,
  };
}

export async function requireAdminWithResolvers(
  getUser: () => Promise<AdminContext | null>,
  checkAdmin: (userId: string) => Promise<boolean>,
): Promise<AdminContext> {
  const user = await getUser();
  if (!user) {
    throw new Error("Přihlášení je vyžadováno.");
  }

  const admin = await checkAdmin(user.userId);
  if (!admin) {
    throw new Error("Přístup zamítnut.");
  }

  return user;
}

export async function requireAdmin(): Promise<AdminContext> {
  return requireAdminWithResolvers(requireAuthenticatedUser, isAdminUser);
}
