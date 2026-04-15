"use client";

import React from "react";
import { supabase } from "@/lib/supabase";

type AuthState = "loading" | "unauthenticated" | "unauthorized" | "authorized";

/**
 * WithAdminAuth — generický auth gate pro admin stránky.
 * Renderuje children místo AdminPanel (jinak identický s AdminAuth).
 */
export default function WithAdminAuth({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<AuthState>("loading");
  const [userName, setUserName] = React.useState<string>("");

  const checkAuth = React.useCallback(async () => {
    if (typeof window !== "undefined") {
      const isLocalhost =
        window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1";
      const isDev = process.env.NODE_ENV !== "production";

      // Dev-only bypass for the local theme builder/editor.
      if (isDev && isLocalhost) {
        setState("authorized");
        return;
      }
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setState("unauthenticated");
        return;
      }

      const discordId = user.user_metadata?.provider_id as string | undefined;
      const adminId = process.env.NEXT_PUBLIC_ADMIN_DISCORD_ID;

      if (!adminId || discordId !== adminId) {
        setState("unauthorized");
        setUserName(user.user_metadata?.full_name ?? user.email ?? "?");
        return;
      }

      setState("authorized");
    } catch {
      setState("unauthenticated");
    }
  }, []);

  React.useEffect(() => {
    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      checkAuth();
    });

    return () => subscription.unsubscribe();
  }, [checkAuth]);

  const login = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "discord",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/admin/themes/dev`,
      },
    });
  };

  if (state === "loading") return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center">
      <div className="text-slate-500">Načítám…</div>
    </div>
  );

  if (state === "unauthenticated") return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div className="text-4xl">🔒</div>
        <h1 className="text-2xl font-bold text-slate-800">Přístup jen pro admin</h1>
        <p className="text-sm text-slate-500">Přihlás se přes Discord.</p>
        <button
          onClick={login}
          className="w-full rounded-2xl bg-indigo-600 px-4 py-4 text-lg font-semibold text-white shadow hover:bg-indigo-700"
        >
          🎮 Přihlásit přes Discord
        </button>
        <a href="/" className="block text-xs text-slate-400 hover:text-slate-600 underline">
          Zpět na úvod
        </a>
      </div>
    </div>
  );

  if (state === "unauthorized") return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-4 text-center">
        <div className="text-4xl">⛔</div>
        <h1 className="text-xl font-bold text-slate-800">Přístup zamítnut</h1>
        <p className="text-sm text-slate-500">
          Přihlášen jako <span className="font-semibold">{userName}</span>,
          ale tento účet nemá přístup.
        </p>
        <button
          onClick={() => supabase.auth.signOut()}
          className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
        >
          Odhlásit
        </button>
        <a href="/" className="block text-xs text-slate-400 hover:text-slate-600 underline">
          Zpět na úvod
        </a>
      </div>
    </div>
  );

  return <>{children}</>;
}
