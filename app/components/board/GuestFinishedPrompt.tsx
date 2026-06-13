"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { createQuickGame } from "@/lib/quickGame";

export default function GuestFinishedPrompt() {
  const router = useRouter();
  const [replayLoading, setReplayLoading] = React.useState(false);
  const [replayError, setReplayError] = React.useState("");

  const handleDiscordLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "discord",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/`,
      },
    });
  };

  const handlePlayAgain = async () => {
    setReplayLoading(true);
    setReplayError("");
    const result = await createQuickGame();
    if (!result.ok) {
      setReplayError("Nepodařilo se spustit hru. Zkus to znovu.");
      setReplayLoading(false);
      return;
    }
    router.push(`/game/${result.gameCode}`);
  };

  return (
    <div className="px-[18%] py-5 border-t-2 border-stone-500 bg-indigo-50/80 space-y-3">
      <div className="text-[9px] font-bold uppercase tracking-[0.22em] text-indigo-800">
        Uložit výsledek
      </div>
      <p className="text-xs text-stone-700 leading-relaxed">
        Tenhle výsledek nemusí zmizet. Přihlas se přes Discord a ukládej si výhry, XP a historii závodů.
      </p>
      <button
        onClick={handleDiscordLogin}
        className="w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 active:scale-[0.98]"
      >
        🎮 Uložit přes Discord
      </button>
      <button
        onClick={handlePlayAgain}
        disabled={replayLoading}
        className="w-full rounded-xl border-2 border-stone-400 bg-white px-4 py-2.5 text-sm font-semibold text-stone-700 transition hover:border-stone-600 hover:bg-stone-50 disabled:opacity-60 active:scale-[0.98]"
      >
        {replayLoading ? "Zakládám hru…" : "🔄 Hrát znovu jako host"}
      </button>
      {replayError && (
        <p className="text-xs text-red-600">{replayError}</p>
      )}
    </div>
  );
}
