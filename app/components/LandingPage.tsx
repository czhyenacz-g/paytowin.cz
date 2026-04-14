"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { generateGameCode, PLAYER_COLORS } from "@/lib/game";
import { THEMES } from "@/lib/themes";
import { BOARD_PRESETS } from "@/lib/board";
import MapMenuStrip from "./MapMenuStrip";

interface DiscordUser {
  id: string;
  name: string;
  avatar: string | null;
}

interface PanelConfig {
  label:     string;
  emoji:     string;
  desc:      string;       // krátký popis pod headerem setup view
  teaser:    string;       // text v placeholder kartě (co panel bude)
  available: boolean;
  bgImage?:  string;       // background obrázek pro setup view (z /public)
  themeId?:  string;       // theme id automaticky vybrané při kliknutí na panel
}

const PANEL_CONFIG: Record<string, PanelConfig> = {
  "mapa-1":  { label: "Klasika",      emoji: "🏇", desc: "Klasická mapa s 21 poli. Dostihy, sázky a finanční chaos.", teaser: "",                                                                              bgImage: "/bg_horse_day.webp",     themeId: "horse-day",     available: true  },
  "mapa-2":  { label: "Mapa 2",       emoji: "🗺️", desc: "Druhá herní mapa — nové rozvržení polí a jiná ekonomika.",  teaser: "Nová mapa s odlišným rozvržením polí, více hazardními událostmi a jinými koňmi.", bgImage: "/bg_horse_classic.webp", themeId: "horse-classic", available: true  },
  "mapa-3":  { label: "Mapa 3",       emoji: "🗺️", desc: "Třetí herní mapa — experimentální pravidla.",               teaser: "Experimentální mapa s upravenými pravidly a vyšším rizikem.",                     bgImage: "/bg_horse_night.webp",   themeId: "horse-night",   available: true  },
  "mapa-4":  { label: "Pouštní sprint", emoji: "🏎️", desc: "Rychlá denní auto varianta s motivem rozpálené trati.",     teaser: "Svižná auto mapa s denní atmosférou, otevřenou tratí a jiným vizuálním rytmem.", bgImage: "/bg_car_day.webp",       themeId: "car-day",       available: true  },
  "mapa-5":  { label: "Noční ulice", emoji: "🌃", desc: "Noční auto varianta s městskou atmosférou a ostrými světly.", teaser: "Temnější auto mapa pro noční jízdu mezi světly města a kontrastními barvami.", bgImage: "/bg_car_night.webp",     themeId: "car-night",     available: true  },
  "ostatni": { label: "Komunitní mapy", emoji: "📦", desc: "Komunita, user-made a speciální mapy.",                     teaser: "Výběr z dalších map od komunity i od nás. Fan-made, sezónní a event mapy.",      bgImage: "/bg_other_maps.webp",                              available: false },
  "editor":  { label: "Editor",       emoji: "🛠️", desc: "Tvorba a editace vlastních herních map.",                   teaser: "Navrhni vlastní mapu — rozmísti pole, nastav ekonomiku a sdílej s přáteli.",    bgImage: "/bg_builder_yard.webp",                            available: false },
};

export default function LandingPage() {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [joinCode, setJoinCode] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [shareCode, setShareCode] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [discordUser, setDiscordUser] = React.useState<DiscordUser | null>(null);
  const [selectedThemeId, setSelectedThemeId] = React.useState("horse-day");
  const [selectedBoardId, setSelectedBoardId] = React.useState("small");
  const [maxPlayers, setMaxPlayers] = React.useState(6);
  const [activePanel, setActivePanel] = React.useState<string | null>(null);
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

      localStorage.setItem("paytowin_discord_id", discordId);
      localStorage.setItem("paytowin_discord_name", fullName);

      setDiscordUser({ id: discordId, name: fullName, avatar: avatarUrl });
      setName((prev) => prev || fullName);
    });
  }, []);

  const handleBack = () => {
    setActivePanel(null);
    setShareCode(null);
    setError("");
  };

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
      .insert({
        code,
        status: "waiting",
        theme_id: selectedThemeId,
        board_id: selectedBoardId,
        game_mode: "online",
        owner_discord_id: discordUser?.id ?? null,
        max_players: maxPlayers,
      })
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

    if ((game.game_mode ?? "online") === "local") {
      setError("Tato hra je lokální (hot-seat) a nelze se k ní připojit online.");
      setLoading(false);
      return;
    }

    if (game.status === "cancelled") {
      setError("Tato hra byla zrušena hostitelem.");
      setLoading(false);
      return;
    }
    if (game.status === "finished") {
      setError("Tato hra již skončila.");
      setLoading(false);
      return;
    }

    const [{ data: existingPlayers }, { data: stateData }] = await Promise.all([
      supabase.from("players").select().eq("game_id", game.id),
      supabase.from("game_state").select("turn_count").eq("game_id", game.id).single(),
    ]);

    const maxP = game.max_players ?? 32;
    if ((existingPlayers?.length ?? 0) >= maxP) {
      setError(`Hra je plná (max. ${maxP} hráčů).`);
      setLoading(false);
      return;
    }

    const turnCount = stateData?.turn_count ?? 0;
    const currentPlayerCount = existingPlayers?.length ?? 0;
    if (currentPlayerCount > 0 && turnCount >= currentPlayerCount) {
      setError("Do této hry se již nelze připojit — první kolo už skončilo.");
      setLoading(false);
      return;
    }

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

  /* ── Discord block — sdílený mezi oběma view ── */
  const discordBlock = discordUser ? (
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
  );

  return (
    <div className="flex flex-col bg-slate-100 overflow-hidden" style={{ height: "100dvh" }}>
      {/* Amber banner — shrink-0, bere svou přirozenou výšku */}
      <div className="shrink-0 bg-amber-100 border-b border-amber-300 px-4 py-2 text-center text-sm text-amber-800">
        Experimentální projekt · kontakt:{" "}
        <a href="mailto:hynek@darbujan.cz" className="underline hover:text-amber-900">
          hynek@darbujan.cz
        </a>
      </div>

      {/* Sliding container — flex-1 vyplní zbytek viewportu po banneru */}
      <div
        className="flex-1 flex min-h-0 transition-transform duration-500 ease-in-out"
        style={{
          width: "200%",
          transform: activePanel ? "translateX(-50%)" : "translateX(0%)",
        }}
      >

        {/* ── LEFT: landing view (50% = 100vw) ── */}
        <div style={{ width: "50%" }} className="flex flex-col min-h-0">
          <MapMenuStrip onPanelClick={(id) => {
            setActivePanel(id);
            const themeId = PANEL_CONFIG[id]?.themeId;
            if (themeId) setSelectedThemeId(themeId);
          }} />

          <div className="flex flex-1 min-h-0 items-center justify-center p-6 overflow-y-auto">
            <div className="w-full max-w-md space-y-6">

              {/* Titulek */}
              <div className="text-center">
                <div className="text-5xl">🐎</div>
                <h1
                  className="mt-3 text-4xl font-bold text-slate-900 cursor-pointer hover:opacity-75 transition-opacity"
                  onClick={() => window.open("/", "_blank")}
                >PayToWin.cz</h1>
                <p className="mt-2 text-slate-500">Dostihy, sázky a finanční chaos.</p>
                <a href="/hry" className="mt-3 inline-block rounded-xl bg-indigo-50 border border-indigo-200 px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100">
                  👀 Sledovat aktivní hry
                </a>
              </div>

              {/* Join sekce */}
              <div className="rounded-3xl bg-white p-6 shadow-lg space-y-4">
                {discordBlock}

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Tvoje jméno</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="např. Hynek"
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-800 outline-none focus:border-slate-500 placeholder:text-slate-400"
                  />
                </div>

                <div className="relative flex items-center gap-3">
                  <div className="flex-1 border-t border-slate-200" />
                  <span className="text-sm text-slate-400">Připojit se ke hře</span>
                  <div className="flex-1 border-t border-slate-200" />
                </div>

                {error && <p className="text-sm text-red-600">{error}</p>}

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    placeholder="Kód hry (např. XK9F2)"
                    maxLength={5}
                    className="flex-1 rounded-xl border border-slate-300 px-4 py-3 text-slate-800 uppercase tracking-widest outline-none focus:border-slate-500 placeholder:text-slate-400"
                  />
                  <button
                    onClick={joinGame}
                    disabled={loading}
                    className="rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white hover:bg-emerald-700 disabled:bg-slate-400"
                  >
                    Připojit
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
              </div>

              <div className="flex items-center justify-center gap-4 text-xs text-slate-500">
                <a href="/pravidla" className="hover:text-slate-700 underline">Pravidla</a>
                <span>·</span>
                <a href="/o-nas" className="hover:text-slate-700 underline">O nás</a>
                <span>·</span>
                <a href="mailto:info@paytowin.cz" className="hover:text-slate-700 underline">info@paytowin.cz</a>
              </div>
            </div>
          </div>
        </div>

        {/* ── RIGHT: setup view (50% = 100vw) ── */}
        {/* Background = obrázek vybraného panelu s tmavým overlay přes CSS gradient */}
        <div
          style={{
            width: "50%",
            ...(activePanel && PANEL_CONFIG[activePanel]?.bgImage ? {
              backgroundImage: `linear-gradient(rgba(0,0,0,0.62), rgba(0,0,0,0.62)), url(${PANEL_CONFIG[activePanel].bgImage})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            } : { backgroundColor: "#f1f5f9" /* slate-100 fallback */ }),
          }}
          className="overflow-y-auto"
        >
          <div className="flex min-h-full items-start justify-center p-6 pt-10">
            <div className="w-full max-w-md space-y-6">

              {/* Zpět + název panelu + aktivní theme */}
              <div className="flex items-center gap-3">
                <button
                  onClick={handleBack}
                  className="flex items-center gap-2 rounded-xl border border-white/30 bg-white/15 backdrop-blur-sm px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/25 transition"
                >
                  ← Zpět
                </button>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-white/55 uppercase tracking-wider">
                    {activePanel && PANEL_CONFIG[activePanel]?.available ? "Nová hra" : "Připravujeme"}
                  </div>
                  <div className="text-base font-bold text-white leading-tight truncate">
                    {activePanel ? (PANEL_CONFIG[activePanel]?.label ?? activePanel) : ""}
                  </div>
                </div>
                {activePanel && PANEL_CONFIG[activePanel]?.available && (
                  <div className="shrink-0 rounded-full border border-white/25 bg-white/15 px-3 py-1 text-xs font-medium text-white/80">
                    {THEMES.find(t => t.id === selectedThemeId)?.name ?? selectedThemeId}
                  </div>
                )}
              </div>

              {activePanel && PANEL_CONFIG[activePanel]?.desc && (
                <p className="text-sm text-white/65 px-1">
                  {PANEL_CONFIG[activePanel].desc}
                </p>
              )}

              {/* Formulář — vytvoření hry nebo Brzy placeholder */}
              <div className="rounded-3xl bg-white p-6 shadow-lg space-y-4">

                {activePanel && !PANEL_CONFIG[activePanel]?.available ? (
                  <div className="space-y-4">
                    {/* Vizuální hlavička panelu */}
                    <div className="rounded-2xl bg-slate-50 border border-slate-200 px-5 py-6 flex items-center gap-4">
                      <span className="text-5xl leading-none shrink-0">{PANEL_CONFIG[activePanel]?.emoji}</span>
                      <div>
                        <div className="text-base font-bold text-slate-800">{PANEL_CONFIG[activePanel]?.label}</div>
                        <div className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                          🚧 Připravujeme
                        </div>
                      </div>
                    </div>

                    {/* Teaser popis */}
                    {PANEL_CONFIG[activePanel]?.teaser && (
                      <p className="text-sm text-slate-500 leading-relaxed">
                        {PANEL_CONFIG[activePanel].teaser}
                      </p>
                    )}

                    <button
                      onClick={handleBack}
                      className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-white hover:border-slate-300 transition"
                    >
                      ← Zpět na menu
                    </button>
                  </div>
                ) : shareCode ? (
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
                          className="shrink-0 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
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
                        className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-800 outline-none focus:border-slate-500 placeholder:text-slate-400"
                      />
                    </div>

                    {/* Výběr herní desky */}
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
                            <div className={`text-xs mt-0.5 ${!preset.available ? "text-slate-300" : selectedBoardId === preset.id ? "text-slate-300" : "text-slate-400"}`}>
                              {preset.available ? preset.description : "Brzy k dispozici"}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Max počet hráčů */}
                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">Max. hráčů</label>
                      <select
                        value={maxPlayers}
                        onChange={(e) => setMaxPlayers(Number(e.target.value))}
                        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-800 outline-none focus:border-slate-500"
                      >
                        {[2,3,4,5,6,8,10,12,16,20,24,32].map(n => (
                          <option key={n} value={n}>{n} hráčů</option>
                        ))}
                      </select>
                    </div>

                    {error && <p className="text-sm text-red-600">{error}</p>}

                    <button
                      onClick={createGame}
                      disabled={loading}
                      className="w-full rounded-2xl bg-slate-900 px-4 py-4 text-lg font-semibold text-white shadow transition hover:bg-slate-800 disabled:bg-slate-400"
                    >
                      🌐 Vytvořit online hru
                    </button>

                    <button
                      onClick={() => router.push(`/local/new?theme=${selectedThemeId}`)}
                      className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 hover:border-slate-400 hover:bg-white transition"
                    >
                      🖥️ Lokální hra (hot-seat)
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
