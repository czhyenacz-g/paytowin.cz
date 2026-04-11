"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { generateGameCode, PLAYER_COLORS } from "@/lib/game";
import { THEMES } from "@/lib/themes";

interface DiscordUser {
  id: string;
  name: string;
  avatar: string | null;
}

export default function LandingPage() {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [joinCode, setJoinCode] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [shareCode, setShareCode] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [discordUser, setDiscordUser] = React.useState<DiscordUser | null>(null);
  const [selectedThemeId, setSelectedThemeId] = React.useState("default");

  // Načti session + předvyplň ?join=KOD z URL
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const join = params.get("join");
    if (join) setJoinCode(join.toUpperCase());

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      const discordId = user.user_metadata?.provider_id as string | undefined;
      if (!discordId) return;

      const fullName = (user.user_metadata?.full_name ?? user.user_metadata?.name ?? "") as string;
      const avatarUrl = user.user_metadata?.avatar_url as string | null ?? null;

      // Ulož Discord ID do localStorage pro budoucí napojení
      localStorage.setItem("paytowin_discord_id", discordId);
      localStorage.setItem("paytowin_discord_name", fullName);

      setDiscordUser({ id: discordId, name: fullName, avatar: avatarUrl });
      // Předvyplň jméno jen pokud ho hráč ještě nezadal
      setName((prev) => prev || fullName);
    });
  }, []);

  const loginWithDiscord = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "discord",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/`,
      },
    });
  };

  const logoutDiscord = async () => {
    await supabase.auth.signOut();
    setDiscordUser(null);
    localStorage.removeItem("paytowin_discord_id");
    localStorage.removeItem("paytowin_discord_name");
  };

  const createGame = async () => {
    if (!name.trim()) return setError("Zadej své jméno.");
    setLoading(true);
    setError("");

    const code = generateGameCode();

    const { data: game, error: gameErr } = await supabase
      .from("games")
      .insert({ code, status: "waiting", theme_id: selectedThemeId })
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
            <a href="/hry" className="mt-3 inline-block rounded-xl bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100">
              👀 Sledovat aktivní hry
            </a>
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
                {/* Discord session info / login */}
                {discordUser ? (
                  <div className="flex items-center justify-between rounded-2xl bg-indigo-50 border border-indigo-200 px-4 py-3">
                    <div className="flex items-center gap-3">
                      {discordUser.avatar ? (
                        <img src={discordUser.avatar} alt="" className="h-8 w-8 rounded-full" />
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-indigo-300 flex items-center justify-center text-white text-sm font-bold">
                          {discordUser.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div className="text-sm font-semibold text-indigo-900">{discordUser.name}</div>
                        <div className="text-xs text-indigo-400">přihlášen přes Discord</div>
                      </div>
                    </div>
                    <button onClick={logoutDiscord} className="text-xs text-indigo-400 hover:text-indigo-700 underline">
                      Odhlásit
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={loginWithDiscord}
                    className="w-full rounded-2xl border-2 border-indigo-200 bg-indigo-50 px-4 py-3 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100"
                  >
                    🎮 Přihlásit přes Discord <span className="font-normal text-indigo-400">(vyplní jméno automaticky)</span>
                  </button>
                )}

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

                {/* Výběr tématu — pouze při vytváření nové hry */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Vzhled hry</label>
                  <div className="grid grid-cols-2 gap-2">
                    {THEMES.map((theme) => (
                      <button
                        key={theme.id}
                        type="button"
                        onClick={() => setSelectedThemeId(theme.id)}
                        className={`rounded-xl border-2 px-3 py-2.5 text-left transition ${
                          selectedThemeId === theme.id
                            ? "border-slate-900 bg-slate-900 text-white"
                            : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"
                        }`}
                      >
                        <div className="text-sm font-semibold">{theme.name}</div>
                        <div className={`text-xs mt-0.5 ${selectedThemeId === theme.id ? "text-slate-300" : "text-slate-400"}`}>
                          {theme.description}
                        </div>
                      </button>
                    ))}
                  </div>
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
                    Připojit jako hráč
                  </button>
                </div>
                <button
                  onClick={() => {
                    if (!joinCode.trim()) return setError("Zadej kód hry.");
                    if (discordUser) {
                      router.push(`/game/${joinCode.trim().toUpperCase()}`);
                    } else {
                      supabase.auth.signInWithOAuth({
                        provider: "discord",
                        options: { redirectTo: `${window.location.origin}/auth/callback?next=/game/${joinCode.trim().toUpperCase()}` },
                      });
                    }
                  }}
                  disabled={loading}
                  className="w-full rounded-xl border-2 border-indigo-200 bg-indigo-50 px-4 py-3 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
                >
                  👀 Sledovat jako divák
                  {!discordUser && <span className="ml-1 font-normal text-indigo-400">(vyžaduje Discord)</span>}
                </button>
              </>
            )}
          </div>

          <div className="flex items-center justify-center gap-4 text-xs text-slate-400">
            <a href="/pravidla" className="hover:text-slate-600 underline">Pravidla</a>
            <span>·</span>
            <a href="/o-nas" className="hover:text-slate-600 underline">O nás</a>
            <span>·</span>
            <a href="mailto:info@paytowin.cz" className="hover:text-slate-600 underline">info@paytowin.cz</a>
          </div>
        </div>
      </div>
    </div>
  );
}
