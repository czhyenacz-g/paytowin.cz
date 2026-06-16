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

function formatRelativeTime(dateString: string | null | undefined): string {
  if (!dateString) return "neznámé";
  const diff = Date.now() - new Date(dateString).getTime();
  if (diff < 60_000)              return "teď";
  if (diff < 60 * 60_000)         return `před ${Math.floor(diff / 60_000)} min`;
  if (diff < 24 * 60 * 60_000)    return `před ${Math.floor(diff / 3_600_000)} h`;
  return `před ${Math.floor(diff / 86_400_000)} d`;
}

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
  game_state: { updated_at: string }[] | null;
};

interface Props {
  onJoin: (code: string) => void;
  playerName: string;
  isDiscordLoggedIn: boolean;
  onCountChange?: (count: number) => void;
}

export default function JoinableGamesList({ onJoin, playerName: _playerName, isDiscordLoggedIn, onCountChange }: Props) {
  const [games, setGames] = React.useState<LobbyGame[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [fetchError, setFetchError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    const { data, error: qErr } = await supabase
      .from("games")
      .select("id, code, status, theme_id, board_id, max_players, require_approval, created_at, players(id, is_bot), game_state(updated_at)")
      .eq("game_mode", "online")
      .in("status", ["waiting", "playing"])
      .order("created_at", { ascending: false })
      .limit(20);

    if (qErr) {
      setFetchError("Nepodařilo se načíst hry.");
    } else {
      const loaded = (data ?? []) as unknown as LobbyGame[];
      setGames(loaded);
      onCountChange?.(loaded.length);
    }
    setLoading(false);
  }, [onCountChange]);

  React.useEffect(() => { load(); }, [load]);

  const now = Date.now();

  const freshGames = games.filter(g => {
    const lastAction = g.game_state?.[0]?.updated_at ?? null;
    if (g.status === "waiting") {
      return now - new Date(g.created_at).getTime() < MAX_WAITING_GAME_AGE_MS;
    }
    if (g.status === "playing") {
      const activityTs = lastAction ?? g.created_at;
      return now - new Date(activityTs).getTime() < MAX_PLAYING_GAME_AGE_MS;
    }
    return false;
  });

  return (
    <div className="space-y-1.5 pt-0.5">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          Hry k připojení
          {!loading && freshGames.length > 0 && (
            <span className="ml-1.5 rounded-full bg-slate-700 px-1.5 py-px text-[10px] font-semibold text-slate-300 tabular-nums">
              {freshGames.length}
            </span>
          )}
        </span>
        <button
          onClick={load}
          disabled={loading}
          className="text-[10px] text-slate-500 hover:text-slate-300 underline disabled:opacity-40 transition"
        >
          {loading ? "Načítám…" : "Obnovit"}
        </button>
      </div>

      {fetchError && (
        <p className="text-xs text-red-400">{fetchError}</p>
      )}

      {!loading && !fetchError && freshGames.length === 0 && (
        <p className="text-[10px] text-slate-500 py-0.5">
          🏁 Žádné otevřené hry. Založ vlastní nebo přidej bota.
        </p>
      )}

      {/* Internal scroll list — stránka neroste */}
      {!loading && freshGames.length > 0 && (
        <div className="max-h-[148px] overflow-y-auto space-y-1 pr-0.5">
          {freshGames.map(game => {
            const playerCount = game.players.length;
            const maxP = game.max_players ?? 32;
            const isFull = playerCount >= maxP;
            const hasBot = game.players.some(p => !!p.is_bot);
            const isApproval = game.require_approval;
            const isPlaying = game.status === "playing";
            const themeName = THEME_LABELS[game.theme_id ?? ""] ?? (game.theme_id ?? "—");
            const boardName = BOARD_LABELS[game.board_id ?? ""] ?? (game.board_id ?? "—");
            const lastActionAt = game.game_state?.[0]?.updated_at ?? null;

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
                  <div className="text-[10px] text-slate-600 space-x-2">
                    <span>Zal. {formatRelativeTime(game.created_at)}</span>
                    {isPlaying && lastActionAt && (
                      <>
                        <span>·</span>
                        <span>Akt. {formatRelativeTime(lastActionAt)}</span>
                      </>
                    )}
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
      )}
    </div>
  );
}
