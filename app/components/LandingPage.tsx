"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { generateGameCode, PLAYER_COLORS } from "@/lib/game";

export default function LandingPage() {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [joinCode, setJoinCode] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [shareCode, setShareCode] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

  // Předvyplň kód z URL parametru ?join=KOD
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const join = params.get("join");
    if (join) setJoinCode(join.toUpperCase());
  }, []);

  const createGame = async () => {
    if (!name.trim()) return setError("Zadej své jméno.");
    setLoading(true);
    setError("");

    const code = generateGameCode();

    const { data: game, error: gameErr } = await supabase
      .from("games")
      .insert({ code, status: "waiting" })
      .select()
      .single();

    if (gameErr || !game) {
      setError("Nepodařilo se vytvořit hru.");
      setLoading(false);
      return;
    }

    const { data: newPlayer, error: playerErr } = await supabase.from("players").insert({
      game_id: game.id,
      name: name.trim(),
      color: PLAYER_COLORS[0],
      position: 0,
      coins: 500,
      horses: [],
      turn_order: 0,
    }).select().single();

    if (playerErr || !newPlayer) {
      setError("Nepodařilo se přidat hráče.");
      setLoading(false);
      return;
    }

    await supabase.from("game_state").insert({
      game_id: game.id,
      current_player_index: 0,
      last_roll: null,
      log: [],
    });

    localStorage.setItem(`paytowin_player_${code}`, newPlayer.id);
    setShareCode(code);
    setLoading(false);
  };

  const joinGame = async () => {
    if (!name.trim()) return setError("Zadej své jméno.");
    if (!joinCode.trim()) return setError("Zadej kód hry.");
    setLoading(true);
    setError("");

    const { data: game, error: gameErr } = await supabase
      .from("games")
      .select()
      .eq("code", joinCode.trim().toUpperCase())
      .single();

    if (gameErr || !game) {
      setError("Hra s tímto kódem neexistuje.");
      setLoading(false);
      return;
    }

    const { data: existingPlayers } = await supabase
      .from("players")
      .select()
      .eq("game_id", game.id);

    const turnOrder = existingPlayers?.length ?? 0;
    const color = PLAYER_COLORS[turnOrder % PLAYER_COLORS.length];

    const { data: newPlayer } = await supabase.from("players").insert({
      game_id: game.id,
      name: name.trim(),
      color,
      position: 0,
      coins: 500,
      horses: [],
      turn_order: turnOrder,
    }).select().single();

    if (newPlayer) {
      localStorage.setItem(`paytowin_player_${game.code}`, newPlayer.id);
    }
    router.push(`/game/${game.code}`);
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="bg-amber-100 border-b border-amber-300 px-4 py-2 text-center text-sm text-amber-800">
        Experimentální projekt · kontakt:{" "}
        <a href="mailto:hynek@darbujan.cz" className="underline hover:text-amber-900">
          hynek@darbujan.cz
        </a>
      </div>

      <div className="flex min-h-[calc(100vh-40px)] items-center justify-center p-6">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center">
            <div className="text-5xl">🐎</div>
            <h1 className="mt-3 text-4xl font-bold text-slate-800">Pay-to-Win</h1>
            <p className="mt-2 text-slate-500">Dostihy, sázky a finanční chaos.</p>
          </div>

          <div className="rounded-3xl bg-white p-6 shadow-lg space-y-4">

            {shareCode ? (
              <div className="space-y-4">
                <div className="rounded-2xl border-2 border-emerald-400 bg-emerald-50 p-4 space-y-3">
                  <div className="text-sm font-semibold text-emerald-800">✅ Hra vytvořena! Pošli kamarádům odkaz:</div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 rounded-xl bg-white border border-emerald-200 px-3 py-2 font-mono text-sm text-slate-700 truncate select-all">
                      {typeof window !== "undefined" ? `${window.location.origin}/?join=${shareCode}` : `/?join=${shareCode}`}
                    </div>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}/?join=${shareCode}`);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }}
                      className="shrink-0 rounded-xl bg-emerald-500 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-600"
                    >
                      {copied ? "✓" : "Kopírovat"}
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => router.push(`/game/${shareCode}`)}
                  className="w-full rounded-2xl bg-slate-900 px-4 py-4 text-lg font-semibold text-white shadow transition hover:bg-slate-800"
                >
                  Vstoupit do hry →
                </button>
              </div>
            ) : (
              <>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Tvoje jméno</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="např. Hynek"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-800 outline-none focus:border-slate-500"
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              onClick={createGame}
              disabled={loading}
              className="w-full rounded-2xl bg-slate-900 px-4 py-4 text-lg font-semibold text-white shadow transition hover:bg-slate-800 disabled:bg-slate-400"
            >
              Vytvořit novou hru
            </button>

            <div className="relative flex items-center gap-3">
              <div className="flex-1 border-t border-slate-200" />
              <span className="text-sm text-slate-400">nebo</span>
              <div className="flex-1 border-t border-slate-200" />
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="Kód hry (např. XK9F2)"
                maxLength={5}
                className="flex-1 rounded-xl border border-slate-300 px-4 py-3 text-slate-800 uppercase tracking-widest outline-none focus:border-slate-500"
              />
              <button
                onClick={joinGame}
                disabled={loading}
                className="rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white hover:bg-emerald-700 disabled:bg-slate-400"
              >
                Připojit
              </button>
            </div>
              </>
            )}
          </div>

          <div className="text-center text-xs text-slate-400">
            <a href="mailto:info@paytowin.cz" className="hover:text-slate-600 underline">info@paytowin.cz</a>
          </div>
        </div>
      </div>
    </div>
  );
}
