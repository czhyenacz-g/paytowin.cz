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

// UI-only freshness filter; cron cleanup can cancel old games later.
const MAX_WAITING_GAME_AGE_MS = 48 * 60 * 60 * 1000;  // 48 hours
const MAX_PLAYING_GAME_AGE_MS = 7  * 24 * 60 * 60 * 1000; // 7 days

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

const INITIAL_VISIBLE = 3;

export default function JoinableGamesList({ onJoin, playerName, isDiscordLoggedIn }: Props) {
  const [games, setGames] = React.useState<LobbyGame[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [fetchError, setFetchError] = React.useState<string | null>(null);
  const [expanded, setExpanded] = React.useState(false);
  const [showAll, setShowAll] = React.useState(false);

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

  const now = Date.now();
  const freshGames = games.filter(g => {
    const age = now - new Date(g.created_at).getTime();
    if (g.status === "waiting") return age < MAX_WAITING_GAME_AGE_MS;
    if (g.status === "playing") return age < MAX_PLAYING_GAME_AGE_MS;
    return false;
  });

  const visibleGames = showAll ? freshGames : freshGames.slice(0, INITIAL_VISIBLE);
  const hiddenCount = freshGames.length - INITIAL_VISIBLE;

  return (
    <div className="rounded-2xl border border-slate-700/60 overflow-hidden">

      {/* ── Sbalitelná hlavička ── */}
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-slate-800/40 transition"
      >
        <span className="flex items-center gap-2 text-xs font-medium text-slate-400">
          Hry k připojení
          {!loading && freshGames.length > 0 && (
            <span className="rounded-full bg-slate-700 px-1.5 py-px text-[10px] font-semibold text-slate-300 tabular-nums">
              {freshGames.length}
            </span>
          )}
        </span>
        <span className="text-[10px] text-slate-500 select-none">{expanded ? "▲" : "▼"}</span>
      </button>

      {/* ── Rozbalený obsah ── */}
      {expanded && (
        <div className="border-t border-slate-700/60 px-3 pb-3 pt-2 space-y-2">

          {/* Obnovit */}
          <div className="flex justify-end">
            <button
              onClick={load}
              disabled={loading}
              className="text-[10px] text-slate-500 hover:text-slate-300 underline disabled:opacity-40 transition"
            >
              {loading ? "Načítám…" : "Obnovit"}
            </button>
          </div>

          {fetchError && (
            <p className="text-xs text-red-400 text-center">{fetchError}</p>
          )}

          {!loading && !fetchError && freshGames.length === 0 && (
            <p className="text-xs text-slate-500 text-center py-1">
              🏁 Žádné otevřené hry. Založ vlastní nebo přidej bota.
            </p>
          )}

          {!loading && freshGames.length > 0 && (
            <>
              <div className="space-y-1.5">
                {visibleGames.map(game => {
                  const playerCount = game.players.length;
                  const maxP = game.max_players ?? 32;
                  const isFull = playerCount >= maxP;
                  const hasBot = game.players.some(p => !!p.is_bot);
                  const isApproval = game.require_approval;
                  const isPlaying = game.status === "playing";
                  const themeName = THEME_LABELS[game.theme_id ?? ""] ?? (game.theme_id ?? "—");
                  const boardName = BOARD_LABELS[game.board_id ?? ""] ?? (game.board_id ?? "—");

                  return (
                    <div key={game.id} className="flex items-center justify-between gap-2 rounded-xl border border-slate-700 bg-slate-800/50 px-3 py-2">
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono font-bold text-slate-100 tracking-widest text-xs">{game.code}</span>
                          {hasBot && (
                            <span className="rounded-full bg-amber-500/20 px-1.5 py-px text-[9px] font-semibold text-amber-400">🤖 Bot</span>
                          )}
                          {isApproval && (
                            <span className="rounded-full bg-slate-700 px-1.5 py-px text-[9px] font-semibold text-slate-300">🔐</span>
                          )}
                          {isPlaying && (
                            <span className="rounded-full bg-emerald-900/60 px-1.5 py-px text-[9px] font-semibold text-emerald-400">▶</span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500 truncate">
                          {themeName} · {boardName} · 👤 {playerCount}/{maxP}
                        </div>
                      </div>

                      <div className="shrink-0">
                        {isFull ? (
                          <span className="text-[10px] text-slate-500">Plná</span>
                        ) : isApproval && !isDiscordLoggedIn ? (
                          <span
                            className="text-[10px] text-slate-500 cursor-default"
                            title="Vyžaduje přihlášení přes Discord."
                          >
                            Vyžaduje Discord
                          </span>
                        ) : (
                          <button
                            onClick={() => onJoin(game.code)}
                            className="rounded-lg bg-emerald-500 px-2.5 py-1 text-[10px] font-semibold text-slate-950 hover:bg-emerald-400 transition"
                          >
                            {isApproval ? "Požádat →" : "Připojit →"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {hiddenCount > 0 && !showAll && (
                <button
                  onClick={() => setShowAll(true)}
                  className="w-full rounded-xl border border-slate-700 py-1.5 text-[10px] font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 transition"
                >
                  Zobrazit další hry ({hiddenCount})
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
