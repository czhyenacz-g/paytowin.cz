"use client";

import React from "react";
import { supabase } from "@/lib/supabase";
import AdminPanel from "@/app/components/AdminPanel";

type AuthState = "loading" | "unauthenticated" | "unauthorized" | "authorized";

export default function AdminAuth() {
  const [state, setState] = React.useState<AuthState>("loading");
  const [userName, setUserName] = React.useState<string>("");

  React.useEffect(() => {
    const checkAuth = async () => {
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
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      checkAuth();
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "discord",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  const logout = async () => {
    await supabase.auth.signOut();
  };

  if (state === "loading") {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-slate-500">Načítám…</div>
      </div>
    );
  }

  if (state === "unauthenticated") {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-6 text-center">
          <div>
            <div className="text-4xl">🔒</div>
            <h1 className="mt-3 text-2xl font-bold text-slate-800">Admin panel</h1>
            <p className="mt-2 text-sm text-slate-500">Přihlás se přes Discord.</p>
          </div>
          <button
            onClick={login}
            className="w-full rounded-2xl bg-indigo-600 px-4 py-4 text-lg font-semibold text-white shadow transition hover:bg-indigo-700"
          >
            <span className="mr-2">🎮</span> Přihlásit přes Discord
          </button>
          <a href="/" className="block text-xs text-slate-400 hover:text-slate-600 underline">
            Zpět na úvod
          </a>
        </div>
      </div>
    );
  }

  if (state === "unauthorized") {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-4 text-center">
          <div className="text-4xl">⛔</div>
          <h1 className="text-xl font-bold text-slate-800">Přístup zamítnut</h1>
          <p className="text-sm text-slate-500">
            Přihlášen jako <span className="font-semibold">{userName}</span>,
            ale tento účet nemá přístup do adminu.
          </p>
          <button
            onClick={logout}
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
  }

  // authorized
  return (
    <div>
      <div className="bg-indigo-600 px-4 py-2 flex justify-end">
        <button
          onClick={logout}
          className="text-xs text-indigo-200 hover:text-white underline"
        >
          Odhlásit
        </button>
      </div>
      <AdminPanel />
    </div>
  );
}
