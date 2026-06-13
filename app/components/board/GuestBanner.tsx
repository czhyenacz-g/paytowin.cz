"use client";

import React from "react";
import { supabase } from "@/lib/supabase";

interface GuestBannerProps {
  gameCode: string;
}

export default function GuestBanner({ gameCode }: GuestBannerProps) {
  const [dismissed, setDismissed] = React.useState(false);

  const handleDiscordLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "discord",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/game/${gameCode}`,
      },
    });
  };

  if (dismissed) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-between gap-3 border-t border-slate-700/80 bg-slate-900/95 px-4 py-2.5 backdrop-blur-sm">
      <p className="min-w-0 flex-1 text-xs text-slate-300">
        Hraješ bez přihlášení. Výsledek si můžeš uložit po přihlášení přes Discord.
      </p>
      <div className="flex shrink-0 items-center gap-2">
        <button
          onClick={handleDiscordLogin}
          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-500"
        >
          Přihlásit přes Discord
        </button>
        <button
          onClick={() => setDismissed(true)}
          aria-label="Zavřít"
          className="rounded-lg border border-slate-600 px-2 py-1.5 text-xs text-slate-400 transition hover:text-slate-200"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
