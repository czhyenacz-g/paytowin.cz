"use client";

import React from "react";
import { supabase } from "@/lib/supabase";

interface Game {
  id: string;
  code: string;
  status: string;
  created_at: string;
  players?: Player[];
}

interface Player {
  id: string;
  game_id: string;
  name: string;
  color: string;
  position: number;
  coins: number;
  horses: unknown;
  turn_order: number;
}

interface Horse {
  id: string;
  name: string;
  speed: number;
  price: number;
  emoji: string;
}

export default function AdminPanel() {
  const [games, setGames] = React.useState<Game[]>([]);
  const [selectedGame, setSelectedGame] = React.useState<Game | null>(null);
  const [players, setPlayers] = React.useState<Player[]>([]);
  const [horses, setHorses] = React.useState<Horse[]>([]);
  const [editingHorse, setEditingHorse] = React.useState<Horse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [bulkDeleteMsg, setBulkDeleteMsg] = React.useState<string | null>(null);

  React.useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [{ data: gamesData }, { data: horsesData }] = await Promise.all([
      supabase.from("games").select().order("created_at", { ascending: false }),
      supabase.from("horse_catalog").select().order("price"),
    ]);
    setGames(gamesData ?? []);
    setHorses(horsesData ?? []);
    setLoading(false);
  };

  const loadPlayers = async (gameId: string) => {
    const { data } = await supabase
      .from("players")
      .select()
      .eq("game_id", gameId)
      .order("turn_order");
    setPlayers(data ?? []);
  };

  const selectGame = (game: Game) => {
    setSelectedGame(game);
    loadPlayers(game.id);
  };

  const saveHorse = async (horse: Horse) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("horse_catalog") as any)
      .update({ name: horse.name, speed: horse.speed, price: horse.price, emoji: horse.emoji })
      .eq("id", horse.id);
    setEditingHorse(null);
    loadData();
  };

  const deleteGame = async (id: string) => {
    if (!confirm("Smazat hru i všechny hráče?")) return;
    await supabase.from("players").delete().eq("game_id", id);
    await supabase.from("game_state").delete().eq("game_id", id);
    await supabase.from("games").delete().eq("id", id);
    if (selectedGame?.id === id) {
      setSelectedGame(null);
      setPlayers([]);
    }
    loadData();
  };

  const deleteUnfinishedGames = async () => {
    const UNFINISHED = ["waiting", "playing", "cancelled"] as const;
    const count = games.filter((g) => UNFINISHED.includes(g.status as typeof UNFINISHED[number])).length;
    if (count === 0) {
      setBulkDeleteMsg("Žádné nedokončené hry k smazání.");
      return;
    }
    if (!confirm(`Smazat ${count} nedokončených her (waiting / playing / cancelled)? Finished hry zůstanou.`)) return;
    setBulkDeleteMsg(null);

    const { data: toDelete, error: fetchErr } = await supabase
      .from("games")
      .select("id")
      .in("status", UNFINISHED);

    if (fetchErr || !toDelete) {
      setBulkDeleteMsg(`Chyba při načítání her: ${fetchErr?.message ?? "neznámá chyba"}`);
      return;
    }

    const ids = toDelete.map((g) => g.id);
    if (ids.length === 0) {
      setBulkDeleteMsg("Žádné nedokončené hry k smazání.");
      loadData();
      return;
    }

    const [{ error: e1 }, { error: e2 }, { error: e3 }] = await Promise.all([
      supabase.from("players").delete().in("game_id", ids),
      supabase.from("game_state").delete().in("game_id", ids),
    ]).then(async ([r1, r2]) => {
      const r3 = await supabase.from("games").delete().in("id", ids);
      return [r1, r2, r3];
    });

    if (e1 || e2 || e3) {
      setBulkDeleteMsg(`Chyba při mazání: ${e1?.message ?? e2?.message ?? e3?.message}`);
    } else {
      setBulkDeleteMsg(`Smazáno ${ids.length} nedokončených her.`);
      if (selectedGame && ids.includes(selectedGame.id)) {
        setSelectedGame(null);
        setPlayers([]);
      }
    }
    loadData();
  };

  if (loading) return <div className="min-h-screen bg-slate-100 flex items-center justify-center text-slate-500">Načítám...</div>;

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-slate-800">Admin panel</h1>
          <a href="/" className="text-sm text-slate-500 underline hover:text-slate-700">← zpět na hru</a>
        </div>

        {/* Hry */}
        <div className="rounded-3xl bg-white p-6 shadow-lg">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-xl font-bold text-slate-800">Hry</h2>
            <button
              onClick={deleteUnfinishedGames}
              className="rounded-xl border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-500 hover:bg-red-50 transition"
            >
              Smazat nedokončené hry
            </button>
          </div>
          {bulkDeleteMsg && (
            <div className={`mb-3 rounded-xl px-4 py-2 text-xs font-medium ${bulkDeleteMsg.startsWith("Chyba") ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>
              {bulkDeleteMsg}
            </div>
          )}
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="pb-2 pr-4">Kód</th>
                <th className="pb-2 pr-4">Status</th>
                <th className="pb-2 pr-4">Vytvořeno</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {games.length === 0 && (
                <tr><td colSpan={4} className="py-4 text-slate-400">Žádné hry</td></tr>
              )}
              {games.map((game) => (
                <tr
                  key={game.id}
                  className={`border-b border-slate-100 cursor-pointer hover:bg-slate-50 ${selectedGame?.id === game.id ? "bg-amber-50" : ""}`}
                  onClick={() => selectGame(game)}
                >
                  <td className="py-2 pr-4 font-mono font-bold text-slate-800">{game.code}</td>
                  <td className="py-2 pr-4">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      game.status === "playing" ? "bg-emerald-100 text-emerald-700" :
                      game.status === "finished" ? "bg-slate-100 text-slate-500" :
                      "bg-amber-100 text-amber-700"
                    }`}>
                      {game.status}
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-slate-500">
                    {new Date(game.created_at).toLocaleString("cs-CZ")}
                  </td>
                  <td className="py-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteGame(game.id); }}
                      className="text-xs text-red-400 hover:text-red-600"
                    >
                      Smazat
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Hráči vybrané hry */}
        {selectedGame && (
          <div className="rounded-3xl bg-white p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-800">
                Hráči — hra <span className="font-mono text-amber-600">{selectedGame.code}</span>
              </h2>
              <a
                href={`/game/${selectedGame.code}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-indigo-500 hover:text-indigo-700 underline"
              >
                Otevřít hru →
              </a>
            </div>
            <div className="mb-4 rounded-xl bg-amber-50 border border-amber-200 px-4 py-2.5 text-xs text-amber-800">
              <strong>Impersonace:</strong> Tlačítko &quot;Hrát jako&quot; nastaví tvůj prohlížeč tak, aby tě hra poznala jako daného hráče.
              Otevře se nová záložka. Funguje jen v tomto prohlížeči — ostatní hráče neovlivní.
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="pb-2 pr-4">Jméno</th>
                  <th className="pb-2 pr-4">Pořadí</th>
                  <th className="pb-2 pr-4">Pozice</th>
                  <th className="pb-2 pr-4">Coins</th>
                  <th className="pb-2 pr-4">Koně</th>
                  <th className="pb-2"></th>
                </tr>
              </thead>
              <tbody>
                {players.length === 0 && (
                  <tr><td colSpan={6} className="py-4 text-slate-400">Žádní hráči</td></tr>
                )}
                {players.map((player) => (
                  <tr key={player.id} className="border-b border-slate-100">
                    <td className="py-2 pr-4">
                      <div className="flex items-center gap-2">
                        <div className={`h-3 w-3 rounded-full ${player.color}`} />
                        <span className="font-medium text-slate-800">{player.name}</span>
                      </div>
                    </td>
                    <td className="py-2 pr-4 text-slate-500">{player.turn_order + 1}</td>
                    <td className="py-2 pr-4 text-slate-500">pole {player.position}</td>
                    <td className="py-2 pr-4 font-semibold text-slate-800">{player.coins} 💰</td>
                    <td className="py-2 pr-4 text-slate-500">
                      {Array.isArray(player.horses) && player.horses.length > 0
                        ? (player.horses as { emoji: string; name: string }[]).map((h) => `${h.emoji} ${h.name}`).join(", ")
                        : "—"}
                    </td>
                    <td className="py-2">
                      <button
                        onClick={() => {
                          localStorage.setItem(`paytowin_player_${selectedGame.code}`, player.id);
                          window.open(`/game/${selectedGame.code}`, "_blank");
                        }}
                        className="rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-600 hover:bg-indigo-100 transition"
                      >
                        Hrát jako →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Katalog koní */}
        <div className="rounded-3xl bg-white p-6 shadow-lg">
          <h2 className="mb-4 text-xl font-bold text-slate-800">Katalog koní</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="pb-2 pr-4">Emoji</th>
                <th className="pb-2 pr-4">Jméno</th>
                <th className="pb-2 pr-4">Rychlost</th>
                <th className="pb-2 pr-4">Cena</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {horses.map((horse) => (
                <tr key={horse.id} className="border-b border-slate-100">
                  {editingHorse?.id === horse.id ? (
                    <>
                      <td className="py-2 pr-4">
                        <input value={editingHorse.emoji} onChange={(e) => setEditingHorse({ ...editingHorse, emoji: e.target.value })}
                          className="w-12 rounded border border-slate-300 px-2 py-1 text-center" />
                      </td>
                      <td className="py-2 pr-4">
                        <input value={editingHorse.name} onChange={(e) => setEditingHorse({ ...editingHorse, name: e.target.value })}
                          className="w-full rounded border border-slate-300 px-2 py-1" />
                      </td>
                      <td className="py-2 pr-4">
                        <input type="number" min={1} max={5} value={editingHorse.speed} onChange={(e) => setEditingHorse({ ...editingHorse, speed: Number(e.target.value) })}
                          className="w-16 rounded border border-slate-300 px-2 py-1" />
                      </td>
                      <td className="py-2 pr-4">
                        <input type="number" value={editingHorse.price} onChange={(e) => setEditingHorse({ ...editingHorse, price: Number(e.target.value) })}
                          className="w-20 rounded border border-slate-300 px-2 py-1" />
                      </td>
                      <td className="py-2 flex gap-2">
                        <button onClick={() => saveHorse(editingHorse)} className="text-xs text-emerald-600 hover:text-emerald-800 font-semibold">Uložit</button>
                        <button onClick={() => setEditingHorse(null)} className="text-xs text-slate-400 hover:text-slate-600">Zrušit</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="py-2 pr-4 text-xl">{horse.emoji}</td>
                      <td className="py-2 pr-4 font-medium text-slate-800">{horse.name}</td>
                      <td className="py-2 pr-4 text-slate-500">{"⭐".repeat(horse.speed)}</td>
                      <td className="py-2 pr-4 text-slate-500">{horse.price} 💰</td>
                      <td className="py-2">
                        <button onClick={() => setEditingHorse(horse)} className="text-xs text-blue-500 hover:text-blue-700">Upravit</button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
              {horses.length === 0 && (
                <tr><td colSpan={5} className="py-4 text-slate-400">Žádní koně v katalogu</td></tr>
              )}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}
