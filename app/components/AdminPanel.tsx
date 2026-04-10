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
          <h2 className="mb-4 text-xl font-bold text-slate-800">Hry</h2>
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
            <h2 className="mb-4 text-xl font-bold text-slate-800">
              Hráči — hra <span className="font-mono text-amber-600">{selectedGame.code}</span>
            </h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="pb-2 pr-4">Jméno</th>
                  <th className="pb-2 pr-4">Pořadí</th>
                  <th className="pb-2 pr-4">Pozice</th>
                  <th className="pb-2 pr-4">Coins</th>
                  <th className="pb-2">Koně</th>
                </tr>
              </thead>
              <tbody>
                {players.length === 0 && (
                  <tr><td colSpan={5} className="py-4 text-slate-400">Žádní hráči</td></tr>
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
                    <td className="py-2 text-slate-500">
                      {Array.isArray(player.horses) && player.horses.length > 0
                        ? (player.horses as { emoji: string; name: string }[]).map((h) => `${h.emoji} ${h.name}`).join(", ")
                        : "—"}
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
