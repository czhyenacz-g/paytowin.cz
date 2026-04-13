"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface GameRow {
  id: string;
  code: string;
  status: string;
  created_at: string;
  players: { id: string; name: string; coins: number }[];
}

type AuthState = "loading" | "unauthenticated" | "authenticated";

export default function GamesList() {
  const router = useRouter();
  const [authState, setAuthState] = React.useState<AuthState>("loading");
  const [games, setGames] = React.useState<GameRow[]>([]);
  const [loadingGames, setLoadingGames] = React.useState(false);

  // Zjisti Discord session
  React.useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      const isDiscord = !!user?.user_metadata?.provider_id;
      setAuthState(isDiscord ? "authenticated" : "unauthenticated");
    });
  }, []);

  // Načti hry jen po přihlášení
  React.useEffect(() => {
    if (authState !== "authenticated") return;
    setLoadingGames(true);

    const load = async () => {
      const { data } = await supabase
        .from("games")
        .select("id, code, status, created_at, players(id, name, coins)")
        .neq("status", "finished")
        .neq("status", "cancelled")
        .neq("game_mode", "local")
        .order("created_at", { ascending: false });

      setGames((data ?? []) as GameRow[]);
      setLoadingGames(false);
    };

    load();

    // Realtime — obnov při změně her
    const channel = supabase
      .channel("games_list")
      .on("postgres_changes", { event: "*", schema: "public", table: "games" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "players" }, load)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [authState]);

  const loginWithDiscord = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "discord",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=/hry` },
    });
  };

  if (authState === "loading") {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">Načítám…</div>
    );
  }

  if (authState === "unauthenticated") {
    return (
      <div className="mx-auto max-w-md py-20 text-center space-y-4">
        <div className="text-4xl">🔒</div>
        <p className="text-slate-600">Pro sledování her se přihlas přes Discord.</p>
        <button
          onClick={loginWithDiscord}
          className="rounded-2xl bg-indigo-600 px-6 py-3 font-semibold text-white hover:bg-indigo-700"
        >
          🎮 Přihlásit přes Discord
        </button>
      </div>
    );
  }

  if (loadingGames) {
    return <div className="flex items-center justify-center py-20 text-slate-400">Načítám hry…</div>;
  }

  if (games.length === 0) {
    return (
      <div className="mx-auto max-w-md py-20 text-center space-y-3">
        <div className="text-4xl">🏁</div>
        <p className="text-slate-500">Žádné aktivní hry. Vytvoř novou na úvodní stránce.</p>
        <a href="/" className="inline-block text-sm text-indigo-600 underline hover:text-indigo-800">
          Zpět na úvod
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {games.map((game) => {
        const activePlayers = game.players.filter((p) => p.coins > 0);
        const statusLabel: Record<string, string> = {
          waiting: "Čeká na hráče",
          playing: "Probíhá",
          finished: "Dokončeno",
          cancelled: "Zrušena",
        };
        const statusColor: Record<string, string> = {
          waiting: "bg-amber-100 text-amber-800",
          playing: "bg-emerald-100 text-emerald-800",
          finished: "bg-slate-100 text-slate-500",
          cancelled: "bg-red-100 text-red-500",
        };

        return (
          <div key={game.id} className="flex items-center justify-between rounded-2xl bg-white p-4 shadow-sm">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <span className="font-mono font-bold text-slate-800 tracking-widest">{game.code}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusColor[game.status] ?? statusColor.waiting}`}>
                  {statusLabel[game.status] ?? game.status}
                </span>
              </div>
              <div className="text-sm text-slate-500">
                {game.players.length} hráčů
                {game.players.length > 0 && (
                  <span className="ml-1 text-slate-400">
                    ({game.players.map((p) => p.name).join(", ")})
                  </span>
                )}
                {activePlayers.length < game.players.length && (
                  <span className="ml-2 text-red-400 text-xs">
                    {game.players.length - activePlayers.length} zkrachovalých
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={() => router.push(`/game/${game.code}`)}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              Sledovat →
            </button>
          </div>
        );
      })}
    </div>
  );
}
