"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { generateGameCode, PLAYER_COLORS } from "@/lib/game";
import { THEMES } from "@/lib/themes";
import { BOARD_PRESETS } from "@/lib/board";

type AuthState = "loading" | "unauthenticated" | "ready";

const THEME_BACKGROUNDS: Record<string, string> = {
  "horse-day": "/bg_horse_day.webp",
  "horse-classic": "/bg_horse_classic.webp",
  "horse-night": "/bg_horse_night.webp",
  "car-day": "/bg_car_day.webp",
  "car-night": "/bg_car_night.webp",
};

export default function LocalNewPage() {
  const router = useRouter();
  const [authState, setAuthState] = React.useState<AuthState>("loading");
  const [discordId, setDiscordId] = React.useState("");
  const [discordName, setDiscordName] = React.useState("");
  const [discordAvatarUrl, setDiscordAvatarUrl] = React.useState<string | null>(null);

  const [playerCount, setPlayerCount] = React.useState(2);
  const [playerNames, setPlayerNames] = React.useState<string[]>(["", ""]);
  const [selectedThemeId, setSelectedThemeId] = React.useState("horse-day");
  const [selectedBoardId, setSelectedBoardId] = React.useState("small-stadium");
  const [stateSubsidy, setStateSubsidy] = React.useState(2000);
  const [baseTax, setBaseTax] = React.useState(500);
  const [lapTaxCoefficient, setLapTaxCoefficient] = React.useState(1);
  const [maxTax, setMaxTax] = React.useState(5000);
  const [economyOpen, setEconomyOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    const themeId = new URLSearchParams(window.location.search).get("theme");
    if (!themeId) return;

    const matchedTheme = THEMES.find((theme) => theme.id === themeId);
    if (matchedTheme) {
      setSelectedThemeId(matchedTheme.id);
    }
  }, []);

  React.useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      const did = user?.user_metadata?.provider_id as string | undefined;
      if (!did) { setAuthState("unauthenticated"); return; }
      setDiscordId(did);
      setDiscordName((user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? "") as string);
      setDiscordAvatarUrl((user?.user_metadata?.avatar_url as string | null) ?? null);
      setAuthState("ready");
    });
  }, []);

  const updatePlayerCount = (count: number) => {
    setPlayerCount(count);
    setPlayerNames((prev) => {
      const next = [...prev];
      while (next.length < count) next.push("");
      return next.slice(0, count);
    });
  };

  const updateName = (index: number, value: string) => {
    const next = [...playerNames];
    next[index] = value;
    setPlayerNames(next);
  };

  const createLocalGame = async () => {
    const trimmed = playerNames.map((n) => n.trim());
    if (trimmed.some((n) => !n)) return setError("Zadej jméno pro každého hráče.");
    setLoading(true);
    setError("");

    const code = generateGameCode();

    const { data: game, error: gameErr } = await supabase
      .from("games")
      .insert({
        code,
        status: "waiting",
        theme_id: selectedThemeId,
        board_id: selectedBoardId,
        game_mode: "local",
        owner_discord_id: discordId,
        max_players: playerCount,
        economy: { stateSubsidy, baseTax, lapTaxCoefficient, maxTax },
      })
      .select()
      .single();

    if (gameErr || !game) {
      setError("Nepodařilo se vytvořit hru.");
      setLoading(false);
      return;
    }

    // Batch insert hráčů bez discord polí — funguje bez ohledu na RLS nebo stav migrace.
    // RLS policy typicky vyžaduje discord_id = auth.uid(), což by blokovalo null hodnoty
    // pro hráče 2-N. Discord identitu přidáme separátním UPDATE níže (best effort).
    const { data: insertedPlayers, error: playersErr } = await supabase
      .from("players")
      .insert(
        trimmed.map((name, i) => ({
          game_id: game.id,
          name,
          color: PLAYER_COLORS[i % PLAYER_COLORS.length],
          position: 0,
          coins: 10000,
          horses: [],
          turn_order: i,
        }))
      )
      .select();

    if (playersErr || !insertedPlayers?.length) {
      console.error("[createLocalGame] players insert failed:", playersErr);
      setError("Nepodařilo se přidat hráče.");
      setLoading(false);
      return;
    }

    // Discord identita pro hosta (první hráč) — best effort, neblokuje flow pokud selže.
    // Vyžaduje spuštěnou migraci 20260417_players_add_discord_identity.sql.
    if (discordId && insertedPlayers[0]) {
      await supabase
        .from("players")
        .update({ discord_id: discordId, discord_avatar_url: discordAvatarUrl })
        .eq("id", insertedPlayers[0].id);
    }

    await supabase.from("game_state").insert({
      game_id: game.id,
      current_player_index: 0,
      last_roll: null,
      log: [],
    });

    // Lokální session: první hráč jako "vlastník zařízení" — GameBoard pozná local mode
    localStorage.setItem(`paytowin_player_${code}`, insertedPlayers[0].id);
    router.push(`/game/${code}`);
  };

  const selectedTheme = THEMES.find((theme) => theme.id === selectedThemeId);
  const pageBackgroundImage = THEME_BACKGROUNDS[selectedThemeId] ?? THEME_BACKGROUNDS["horse-day"];
  const loginRedirectPath =
    typeof window === "undefined"
      ? "/local/new"
      : `${window.location.pathname}${window.location.search}`;

  if (authState === "loading") {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center text-slate-400">
        Načítám…
      </div>
    );
  }

  if (authState === "unauthenticated") {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-6"
        style={{
          backgroundImage: `linear-gradient(rgba(15, 23, 42, 0.72), rgba(15, 23, 42, 0.72)), url(${pageBackgroundImage})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="w-full max-w-sm text-center space-y-4">
          <div className="text-4xl">🔒</div>
          <h2 className="text-xl font-bold text-white">Přihlášení nutné</h2>
          <p className="text-sm text-white/75">
            Pro vytvoření lokální hry se přihlas přes Discord.
          </p>
          <button
            onClick={() =>
              supabase.auth.signInWithOAuth({
                provider: "discord",
                options: {
                  redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(loginRedirectPath)}`,
                },
              })
            }
            className="w-full rounded-2xl bg-indigo-600 px-4 py-3 font-semibold text-white hover:bg-indigo-700"
          >
            🎮 Přihlásit přes Discord
          </button>
          <a href="/" className="block text-xs text-white/60 underline hover:text-white">
            ← Zpět na úvod
          </a>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen"
      style={{
        backgroundImage: `linear-gradient(rgba(15, 23, 42, 0.68), rgba(15, 23, 42, 0.68)), url(${pageBackgroundImage})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="bg-amber-100 border-b border-amber-300 px-4 py-2 text-center text-sm text-amber-800">
        Experimentální projekt ·{" "}
        <a href="mailto:info@paytowin.cz" className="underline hover:text-amber-900">
          info@paytowin.cz
        </a>
      </div>

      <div className="flex min-h-[calc(100vh-40px)] items-center justify-center p-6">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center">
            <div className="text-4xl">🖥️</div>
            <h1 className="mt-2 text-2xl font-bold text-slate-800">Lokální hra</h1>
            <p className="mt-1 text-sm text-slate-500">
              Hot-seat — více hráčů u jednoho počítače
            </p>
          </div>

          <div className="rounded-3xl bg-white p-6 shadow-lg space-y-5">
            {/* Hostitel */}
            <div className="rounded-xl bg-indigo-50 border border-indigo-100 px-4 py-3 text-sm">
              <span className="font-semibold text-indigo-800">Hostitel:</span>{" "}
              <span className="text-indigo-700">{discordName}</span>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Aktivní theme
              </div>
              <div className="mt-1 text-sm font-semibold text-slate-800">
                {selectedTheme?.name ?? selectedThemeId}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {selectedTheme?.description ?? "Theme byl vybrán z horního menu."}
              </div>
            </div>

            {/* Počet hráčů */}
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Počet hráčů
              </label>
              <div className="flex flex-wrap gap-2">
                {[2, 3, 4, 5, 6, 7, 8].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => updatePlayerCount(n)}
                    className={`h-9 w-9 rounded-xl border-2 text-sm font-bold transition ${
                      playerCount === n
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 text-slate-700 hover:border-slate-400"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {/* Jména hráčů */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">Jména hráčů</label>
              {playerNames.map((pname, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className={`h-3 w-3 shrink-0 rounded-full ${PLAYER_COLORS[i]}`} />
                  <input
                    type="text"
                    value={pname}
                    onChange={(e) => updateName(i, e.target.value)}
                    placeholder={`Hráč ${i + 1}`}
                    className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-500"
                  />
                </div>
              ))}
            </div>

            {/* Herní deska */}
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Herní deska</label>
              <div className="grid grid-cols-2 gap-2">
                {BOARD_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    disabled={!preset.available}
                    onClick={() => preset.available && setSelectedBoardId(preset.id)}
                    className={`rounded-xl border-2 px-3 py-2.5 text-left transition ${
                      !preset.available
                        ? "border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed"
                        : selectedBoardId === preset.id
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"
                    }`}
                  >
                    <div className="text-sm font-semibold">{preset.name}</div>
                    <div className={`mt-0.5 text-xs ${
                      !preset.available ? "text-slate-300" : selectedBoardId === preset.id ? "text-slate-300" : "text-slate-400"
                    }`}>
                      {preset.available ? preset.description : "Brzy k dispozici"}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Ekonomická nastavení */}
            <div className="rounded-xl border border-slate-200 bg-slate-50">
              <button
                type="button"
                onClick={() => setEconomyOpen(o => !o)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-100 transition rounded-xl"
              >
                <span>Ekonomická nastavení</span>
                <span className="text-slate-400 text-xs">{economyOpen ? "▲ Skrýt" : "▼ Upravit"}</span>
              </button>
              {economyOpen && (
                <div className="border-t border-slate-200 px-4 pb-4 pt-3 grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Dotace od státu (START)</label>
                    <input type="number" min={0} step={100} value={stateSubsidy} onChange={e => setStateSubsidy(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Daň za průchod STARTem</label>
                    <input type="number" min={0} step={100} value={baseTax} onChange={e => setBaseTax(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Koeficient růstu daně za každé kolo</label>
                    <input type="number" min={0.1} step={0.1} value={lapTaxCoefficient} onChange={e => setLapTaxCoefficient(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Stropní daň</label>
                    <input type="number" min={0} step={500} value={maxTax} onChange={e => setMaxTax(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-500" />
                  </div>
                </div>
              )}
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              onClick={createLocalGame}
              disabled={loading}
              className="w-full rounded-2xl bg-slate-900 px-4 py-4 text-lg font-semibold text-white shadow transition hover:bg-slate-800 disabled:bg-slate-400"
            >
              {loading ? "Zakládám…" : "Spustit lokální hru →"}
            </button>

            <a
              href="/"
              className="block text-center text-xs text-slate-400 underline hover:text-slate-600"
            >
              ← Zpět na úvod
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
