"use client";

import React from "react";
import { supabase } from "@/lib/supabase";

const THEME_LABELS: Record<string, string> = {
  "horse-day":     "Dostihy — Den",
  "horse-night":   "Dostihy — Noc",
  "horse-classic": "Dostihy — Klasika",
  "car-day":       "Závody aut — Den",
  "car-night":     "Závody aut — Noc",
};

const BOARD_LABELS: Record<string, string> = {
  "small":         "Klasická deska",
  "small-stadium": "Stadion",
};

type LobbyGame = {
  id: string;
  code: string;
  status: string;
  theme_id: string | null;
  board_id: string | null;
  max_players: number | null;
  require_approval: boolean;
  created_at: string;
  players: { id: string; is_bot: boolean | null }[];
};

interface Props {
  onJoin: (code: string) => void;
  playerName: string;
  isDiscordLoggedIn: boolean;
}

export default function JoinableGamesList({ onJoin, playerName, isDiscordLoggedIn }: Props) {
  const [games, setGames] = React.useState<LobbyGame[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [fetchError, setFetchError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    const { data, error: qErr } = await supabase
      .from("games")
      .select("id, code, status, theme_id, board_id, max_players, require_approval, created_at, players(id, is_bot)")
      .eq("game_mode", "online")
      .in("status", ["waiting", "playing"])
      .order("created_at", { ascending: false })
      .limit(20);

    if (qErr) {
      setFetchError("Nepodařilo se načíst hry.");
    } else {
      setGames((data ?? []) as unknown as LobbyGame[]);
    }
    setLoading(false);
  }, []);

  React.useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-slate-200">Hry, ke kterým se můžeš připojit</div>
          <div className="text-xs text-slate-400 mt-0.5">Vyber otevřenou online hru nebo požádej zakladatele o vstup.</div>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="text-xs text-slate-400 hover:text-slate-200 transition underline disabled:opacity-40"
        >
          {loading ? "Načítám…" : "Obnovit"}
        </button>
      </div>

      {fetchError && (
        <p className="text-center text-sm text-red-400">{fetchError}</p>
      )}

      {!loading && !fetchError && games.length === 0 && (
        <div className="rounded-2xl border border-slate-700 bg-slate-800/40 px-4 py-6 text-center">
          <div className="text-slate-400 text-sm">🏁 Zatím tu nejsou žádné otevřené hry.</div>
          <div className="text-slate-500 text-xs mt-1">Založ vlastní hru nebo přidej bota.</div>
        </div>
      )}

      {!loading && games.length > 0 && (
        <div className="space-y-2">
          {games.map(game => {
            const playerCount = game.players.length;
            const maxP = game.max_players ?? 32;
            const isFull = playerCount >= maxP;
            const hasBot = game.players.some(p => !!p.is_bot);
            const isApproval = game.require_approval;
            const isPlaying = game.status === "playing";
            const themeName = THEME_LABELS[game.theme_id ?? ""] ?? game.theme_id ?? "—";
            const boardName = BOARD_LABELS[game.board_id ?? ""] ?? game.board_id ?? "—";

            return (
              <div key={game.id} className="rounded-2xl border border-slate-700 bg-slate-800/60 px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-slate-100 tracking-widest text-sm">{game.code}</span>
                      {hasBot && (
                        <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
                          🤖 S botem
                        </span>
                      )}
                      {isApproval && (
                        <span className="rounded-full bg-slate-700 px-2 py-0.5 text-[10px] font-semibold text-slate-300">
                          🔐 Schvalování
                        </span>
                      )}
                      {isPlaying && (
                        <span className="rounded-full bg-emerald-900/60 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                          ▶ Probíhá
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400">
                      {themeName} · {boardName}
                    </div>
                    <div className="text-xs text-slate-400">
                      👤 {playerCount} / {maxP} hráčů
                    </div>
                  </div>

                  <div className="shrink-0 pt-0.5">
                    {isFull ? (
                      <button
                        disabled
                        className="rounded-xl bg-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-500 cursor-not-allowed"
                      >
                        Plná
                      </button>
                    ) : isApproval && !isDiscordLoggedIn ? (
                      <button
                        disabled
                        title="Tato hra vyžaduje schválení zakladatelem — přihlas se přes Discord."
                        className="rounded-xl bg-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-500 cursor-not-allowed"
                      >
                        Vyžaduje Discord
                      </button>
                    ) : (
                      <button
                        onClick={() => onJoin(game.code)}
                        className="rounded-xl bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-emerald-400 transition"
                      >
                        {isApproval ? "Požádat →" : "Připojit →"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
