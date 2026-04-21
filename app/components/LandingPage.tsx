"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { generateGameCode, PLAYER_COLORS } from "@/lib/game";
import { THEMES } from "@/lib/themes";
import { BOARD_PRESETS } from "@/lib/board";
import MapMenuStrip from "./MapMenuStrip";
import BrandLogo from "./BrandLogo";
import { logEvent } from "@/lib/analytics";

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
  view?:     "launcher" | "catalog" | "account" | "placeholder";
  bgImage?:  string;       // background obrázek pro setup view (z /public)
  themeId?:  string;       // theme id automaticky vybrané při kliknutí na panel
  boardId?:  string;       // board preset automaticky vybraný při kliknutí na panel
}

const PANEL_CONFIG: Record<string, PanelConfig> = {
  "mapa-1":  { label: "Denní dostihy", emoji: "🏇", desc: "Denní dostihová varianta s lehčí atmosférou a klasickým flow.", teaser: "",                                                                              bgImage: "/bg_horse_day.webp",     themeId: "horse-day",     boardId: "small-stadium", available: true,  view: "launcher" },
  "mapa-2":  { label: "Klasické dostihy", emoji: "🏇", desc: "Tradiční dostihová varianta s klasickým vizuálním stylem.",  teaser: "Známá dostihová atmosféra v klasickém stylu pro hráče, kteří chtějí tradiční look.", bgImage: "/bg_horse_classic.webp", themeId: "horse-classic", available: true,  view: "launcher" },
  "mapa-3":  { label: "Noční dostihy", emoji: "🌙", desc: "Noční dostihová varianta s tmavší atmosférou a ostřejším kontrastem.", teaser: "Temnější dostihová mapa pro večerní atmosféru, světla a výraznější kontrast.",                     bgImage: "/bg_horse_night.webp",   themeId: "horse-night",   available: true,  view: "launcher" },
  "mapa-4":  { label: "Pouštní sprint", emoji: "🏎️", desc: "Rychlá denní auto varianta s motivem rozpálené trati.",     teaser: "Svižná auto mapa s denní atmosférou, otevřenou tratí a jiným vizuálním rytmem.", bgImage: "/bg_car_day.webp",       themeId: "car-day",       available: true,  view: "launcher" },
  "mapa-5":  { label: "Noční ulice", emoji: "🌃", desc: "Noční auto varianta s městskou atmosférou a ostrými světly.", teaser: "Temnější auto mapa pro noční jízdu mezi světly města a kontrastními barvami.", bgImage: "/bg_car_night.webp",     themeId: "car-night",     available: true,  view: "launcher" },
  "ostatni": { label: "Komunitní mapy", emoji: "📦", desc: "Komunita, user-made a speciální mapy.",                     teaser: "Výběr z dalších map od komunity i od nás. Fan-made, sezónní a event mapy.",      bgImage: "/bg_other_maps.webp",                              available: true,  view: "catalog" },
  "editor":  { label: "Editor",       emoji: "🛠️", desc: "Tvorba a editace vlastních herních map.",                   teaser: "Navrhni vlastní mapu — rozmísti pole, nastav ekonomiku a sdílej s přáteli.",    bgImage: "/bg_builder_yard.webp",                            available: false, view: "placeholder" },
  "profil":  { label: "Tvůj profil",  emoji: "🛡️", desc: "Přehled účtu, dosažené úspěchy a budoucí správa profilu.", teaser: "Osobní sekce pro účet, profil, achievementy a další systémové funkce, které sem postupně přibydou.", bgImage: "/bg_dark_racer.webp", available: true, view: "account" },
};

type CommunityThemeSummary = {
  id: string;
  name: string;
  description: string;
  author: string;
  isOfficial: boolean;
};

function EconomyFields({
  stateSubsidy, setStateSubsidy,
  baseTax, setBaseTax,
  lapTaxCoefficient, setLapTaxCoefficient,
  maxTax, setMaxTax,
  fogOfWar, setFogOfWar,
}: {
  stateSubsidy: number; setStateSubsidy: (v: number) => void;
  baseTax: number; setBaseTax: (v: number) => void;
  lapTaxCoefficient: number; setLapTaxCoefficient: (v: number) => void;
  maxTax: number; setMaxTax: (v: number) => void;
  fogOfWar: boolean; setFogOfWar: (v: boolean) => void;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-100 transition rounded-xl"
      >
        <span>Nastavení hry</span>
        <span className="text-slate-400 text-xs">{open ? "▲ Skrýt" : "▼ Upravit"}</span>
      </button>
      {open && (
        <div className="border-t border-slate-200 px-4 pb-4 pt-3 space-y-3">
          <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5">
            <input
              type="checkbox"
              checked={fogOfWar}
              onChange={(e) => setFogOfWar(e.target.checked)}
              className="h-4 w-4 rounded accent-slate-800"
            />
            <span className="text-sm font-medium text-slate-700">🌫️ Fog of War — pole jsou skrytá dokud na ně nevstoupíš</span>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Příspěvek od podporovatelů (START)</label>
              <input type="number" min={0} step={100} value={stateSubsidy} onChange={e => setStateSubsidy(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Výpalné (daně) za průchod STARTem</label>
              <input type="number" min={0} step={100} value={baseTax} onChange={e => setBaseTax(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Koeficient růstu výpalného za každé kolo</label>
              <input type="number" min={0.1} step={0.1} value={lapTaxCoefficient} onChange={e => setLapTaxCoefficient(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Stropní výpalné (daně)</label>
              <input type="number" min={0} step={500} value={maxTax} onChange={e => setMaxTax(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-500" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
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
  const [selectedThemeId, setSelectedThemeId] = React.useState("horse-day");
  const [selectedBoardId, setSelectedBoardId] = React.useState("small-stadium");
  const [maxPlayers, setMaxPlayers] = React.useState(6);
  const [fogOfWar, setFogOfWar] = React.useState(true);
  const [stateSubsidy, setStateSubsidy] = React.useState(2000);
  const [baseTax, setBaseTax] = React.useState(500);
  const [lapTaxCoefficient, setLapTaxCoefficient] = React.useState(1);
  const [maxTax, setMaxTax] = React.useState(5000);
  const [activePanel, setActivePanel] = React.useState<string | null>(null);
  const [communityThemes, setCommunityThemes] = React.useState<CommunityThemeSummary[]>([]);
  const [communityLoading, setCommunityLoading] = React.useState(false);
  const [hostedGamesCount, setHostedGamesCount] = React.useState<number | null>(null);
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

  React.useEffect(() => {
    let isMounted = true;

    const loadCommunityThemes = async () => {
      setCommunityLoading(true);

      try {
        const { data } = await supabase
          .from("themes")
          .select("id, manifest, created_by, is_official")
          .eq("is_archived", false)
          .or("is_public.eq.true,is_official.eq.true");

        if (!isMounted) return;

        if (!data) {
          setCommunityThemes([]);
          return;
        }

        const builtinIds = new Set(THEMES.map((theme) => theme.id));
        const nextThemes = data
          .filter((row) => !builtinIds.has(row.id))
          .map((row) => {
            const manifest = row.manifest as Record<string, unknown>;
            const meta = manifest.meta as Record<string, unknown> | undefined;
            return {
              id: row.id,
              name: typeof meta?.name === "string" ? meta.name : row.id,
              description: typeof meta?.description === "string" ? meta.description : "Komunitní mapa bez doplněného popisu.",
              author: typeof row.created_by === "string" && row.created_by.trim() ? row.created_by : "Komunita",
              isOfficial: row.is_official,
            };
          });

        setCommunityThemes(nextThemes);
      } catch {
        if (!isMounted) return;
        setCommunityThemes([]);
      } finally {
        if (!isMounted) return;
        setCommunityLoading(false);
      }
    };

    loadCommunityThemes();

    return () => {
      isMounted = false;
    };
  }, []);

  // Načti statistiky profilu při otevření panelu
  React.useEffect(() => {
    if (activePanel !== "profil" || !discordUser?.id) return;
    supabase
      .from("games")
      .select("id", { count: "exact", head: true })
      .eq("owner_discord_id", discordUser.id)
      .then(({ count }) => setHostedGamesCount(count ?? 0));
  }, [activePanel, discordUser?.id]);

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
        economy: { stateSubsidy, baseTax, lapTaxCoefficient, maxTax },
        fog_of_war: fogOfWar,
      })
      .select()
      .single();

    if (gameErr || !game) {
      console.error("[createGame] games insert failed:", gameErr?.message, gameErr?.details, gameErr?.hint);
      logEvent({ name: "create_game_fail", reason: gameErr?.message ?? "insert_failed" });
      setError(`Nepodařilo se vytvořit hru. (${gameErr?.message ?? "neznámá chyba"})`);
      setLoading(false);
      return;
    }

    const { data: newPlayer, error: playerErr } = await supabase.from("players").insert({
      game_id: game.id,
      name: name.trim(),
      color: PLAYER_COLORS[0],
      position: 0,
      coins: 10000,
      horses: [],
      turn_order: 0,
      discord_id: discordUser?.id ?? null,
      discord_avatar_url: discordUser?.avatar ?? null,
    }).select().single();

    if (playerErr || !newPlayer) {
      console.error("[createGame] players insert failed:", playerErr?.message, playerErr?.details);
      setError("Nepodařilo se vytvořit hráče. Zkus to znovu.");
      setLoading(false);
      return;
    }

    await supabase.from("game_state").insert({
      game_id: game.id,
      current_player_index: 0,
      last_roll: null,
      log: [],
    });

    logEvent({ name: "create_game_success", game_code: code, theme_id: selectedThemeId, board_id: selectedBoardId });
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
      if (!game && gameErr?.code === "PGRST116") {
        logEvent({ name: "join_game_fail", reason: "not_found" });
        setError("Hra s tímto kódem neexistuje.");
      } else {
        console.error("[joinGame] game lookup failed:", gameErr?.message, gameErr?.details);
        logEvent({ name: "join_game_fail", reason: "lookup_error" });
        setError("Nepodařilo se načíst hru. Zkontroluj připojení a zkus to znovu.");
      }
      setLoading(false);
      return;
    }

    if ((game.game_mode ?? "online") === "local") {
      logEvent({ name: "join_game_fail", reason: "local_game" });
      setError("Tato hra je lokální (hot-seat) a nelze se k ní připojit online.");
      setLoading(false);
      return;
    }

    if (game.status === "cancelled") {
      logEvent({ name: "join_game_fail", reason: "cancelled" });
      setError("Tato hra byla zrušena hostitelem.");
      setLoading(false);
      return;
    }
    if (game.status === "finished") {
      logEvent({ name: "join_game_fail", reason: "finished" });
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
      logEvent({ name: "join_game_fail", reason: "full" });
      setError(`Hra je plná (max. ${maxP} hráčů).`);
      setLoading(false);
      return;
    }

    const turnCount = stateData?.turn_count ?? 0;
    const currentPlayerCount = existingPlayers?.length ?? 0;
    if (currentPlayerCount > 0 && turnCount >= currentPlayerCount) {
      logEvent({ name: "join_game_fail", reason: "too_late" });
      setError("Do této hry se již nelze připojit — první kolo už skončilo.");
      setLoading(false);
      return;
    }

    const turnOrder = existingPlayers?.length ?? 0;
    const color = PLAYER_COLORS[turnOrder % PLAYER_COLORS.length];

    const { data: newPlayer, error: joinPlayerErr } = await supabase.from("players").insert({
      game_id: game.id,
      name: name.trim(),
      color,
      position: 0,
      coins: 10000,
      horses: [],
      turn_order: turnOrder,
      discord_id: discordUser?.id ?? null,
      discord_avatar_url: discordUser?.avatar ?? null,
    }).select().single();

    if (!newPlayer) {
      console.error("[joinGame] players insert failed:", joinPlayerErr?.message, joinPlayerErr?.details);
      logEvent({ name: "join_game_fail", reason: "player_insert_failed" });
      setError("Nepodařilo se připojit ke hře. Zkus to znovu.");
      setLoading(false);
      return;
    }
    logEvent({ name: "join_game_success", game_code: game.code });
    localStorage.setItem(`paytowin_player_${game.code}`, newPlayer.id);
    router.push(`/game/${game.code}`);
  };

  const utilityDiscordBlock = discordUser ? (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-700 bg-slate-800 px-3 py-2.5 shadow-inner">
      <div className="flex min-w-0 items-center gap-3">
        {discordUser.avatar ? (
          <img src={discordUser.avatar} alt="" className="h-8 w-8 rounded-full" />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-400 text-sm font-bold text-white">
            {discordUser.name.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-slate-100">{discordUser.name}</div>
          <div className="text-[11px] text-slate-400">Discord připojen</div>
        </div>
      </div>
      <button onClick={logoutDiscord} className="shrink-0 text-xs font-medium text-slate-400 transition hover:text-white">
        Odhlásit
      </button>
    </div>
  ) : (
    <button
      onClick={loginWithDiscord}
      className="rounded-2xl border border-indigo-500/40 bg-indigo-500/18 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500/28"
    >
      🎮 Přihlásit přes Discord
    </button>
  );

  const activeConfig = activePanel ? PANEL_CONFIG[activePanel] : null;
  const isCommunityPanel = activePanel === "ostatni";
  const isProfilePanel = activePanel === "profil";
  const isLauncherPanel = !!(activeConfig?.available && activeConfig?.view === "launcher");
  const selectedBuiltinTheme = THEMES.find((theme) => theme.id === selectedThemeId);
  const selectedCommunityTheme = communityThemes.find((theme) => theme.id === selectedThemeId);
  const selectedThemeLabel = selectedBuiltinTheme?.name ?? selectedCommunityTheme?.name ?? selectedThemeId;
  const selectedCommunityCountLabel = `${communityThemes.length} map${communityThemes.length === 1 ? "a" : communityThemes.length < 5 ? "y" : ""}`;

  return (
    <div className="flex flex-col bg-slate-900 overflow-hidden" style={{ height: "100dvh" }}>
      {/* Amber banner — shrink-0, bere svou přirozenou výšku */}
      <div className="shrink-0 bg-amber-100 border-b border-amber-300 px-4 py-2 text-center text-sm text-amber-800">
        Experimentální projekt · kontakt:{" "}
        <a href="mailto:info@paytowin.cz" className="underline hover:text-amber-900">
          info@paytowin.cz
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
          <div className="flex flex-1 min-h-0 overflow-y-auto">
            <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-6 py-8">

              <div className="mb-6 text-center">
                <BrandLogo
                  variant="hero"
                  className="mx-auto"
                  onClick={() => window.open("/", "_blank")}
                />
                <p className="mt-2 text-slate-400">Závody, sázky a finanční chaos.</p>
              </div>

              <MapMenuStrip onPanelClick={(id) => {
                if (id === "editor") {
                  router.push("/admin/themes/dev");
                  return;
                }

                setActivePanel(id);
                setShareCode(null);
                setError("");
                const themeId = PANEL_CONFIG[id]?.themeId;
                if (themeId) setSelectedThemeId(themeId);
                const boardId = PANEL_CONFIG[id]?.boardId;
                if (boardId) setSelectedBoardId(boardId);
                if (id === "ostatni") {
                  const firstCommunityTheme = communityThemes[0];
                  if (firstCommunityTheme) setSelectedThemeId(firstCommunityTheme.id);
                }
              }} />

              <div className="mx-auto mt-5 w-full max-w-5xl space-y-3">
                <div className="rounded-[28px] border border-slate-800 bg-slate-900/95 p-3 shadow-2xl">
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
                    <div className="xl:w-[280px]">
                      {utilityDiscordBlock}
                    </div>

                    <div className="flex flex-1 flex-col gap-2 lg:flex-row">
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Tvoje jméno"
                        className="h-11 min-w-0 rounded-2xl border border-slate-700 bg-slate-800 px-4 text-sm text-slate-100 outline-none placeholder:text-slate-400 focus:border-slate-500"
                      />

                      <div className="flex flex-1 gap-2">
                        <input
                          type="text"
                          value={joinCode}
                          onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                          placeholder="Kód hry"
                          maxLength={5}
                          className="h-11 min-w-0 flex-1 rounded-2xl border border-slate-700 bg-slate-800 px-4 text-sm uppercase tracking-[0.2em] text-slate-100 outline-none placeholder:tracking-normal placeholder:text-slate-400 focus:border-slate-500"
                        />
                        <button
                          onClick={joinGame}
                          disabled={loading}
                          className="h-11 shrink-0 rounded-2xl bg-emerald-500 px-4 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:bg-slate-600 disabled:text-white/50"
                        >
                          Připojit
                        </button>
                      </div>
                    </div>

                    <a
                      href="/hry"
                      className="inline-flex h-11 shrink-0 items-center justify-center rounded-2xl border border-slate-700 bg-slate-800 px-4 text-sm font-semibold text-slate-100 transition hover:bg-slate-700"
                    >
                      👀 Sledovat aktivní hry
                    </a>
                  </div>
                </div>

                {error && (
                  <p className="text-center text-sm text-red-600">{error}</p>
                )}

                <div className="flex items-center justify-center gap-4 text-xs text-slate-400">
                  <a href="/pravidla" className="hover:text-slate-200 underline">Pravidla</a>
                  <span>·</span>
                  <a href="/o-nas" className="hover:text-slate-200 underline">O nás</a>
                  <span>·</span>
                  <a href="mailto:info@paytowin.cz" className="hover:text-slate-200 underline">info@paytowin.cz</a>
                </div>
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
            } : { backgroundColor: "#0f172a" /* slate-900 fallback */ }),
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
                    {isCommunityPanel ? "Komunitní výběr" : isProfilePanel ? "Osobní sekce" : activePanel && PANEL_CONFIG[activePanel]?.available ? "Nová hra" : "Připravujeme"}
                  </div>
                  <div className="text-base font-bold text-white leading-tight truncate">
                    {activePanel ? (PANEL_CONFIG[activePanel]?.label ?? activePanel) : ""}
                  </div>
                </div>
                {isLauncherPanel && (
                  <div className="shrink-0 rounded-full border border-white/25 bg-white/15 px-3 py-1 text-xs font-medium text-white/80">
                    {selectedThemeLabel}
                  </div>
                )}
                {isCommunityPanel && (
                  <div className="shrink-0 rounded-full border border-white/25 bg-white/15 px-3 py-1 text-xs font-medium text-white/80">
                    {communityLoading ? "Načítám" : selectedCommunityCountLabel}
                  </div>
                )}
                {isProfilePanel && (
                  <div className="shrink-0 rounded-full border border-white/25 bg-white/20 px-3 py-1 text-xs font-medium text-white/85">
                    Přehled účtu
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

                {activePanel && activeConfig?.view === "placeholder" ? (
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
                ) : isCommunityPanel ? (
                  <div className="space-y-4">
                    <div className="rounded-2xl bg-slate-50 border border-slate-200 px-5 py-4">
                      <div className="text-sm font-semibold text-slate-800">Další veřejné mapy</div>
                      <p className="mt-1 text-sm leading-relaxed text-slate-500">
                        Tady jsou community a speciální mapy mimo hlavní pětici launcherů. Vyber jednu z nich a pak ji spusť online nebo lokálně.
                      </p>
                    </div>

                    {communityLoading ? (
                      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-5 text-sm text-slate-500">
                        Načítám komunitní mapy…
                      </div>
                    ) : communityThemes.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                        Zatím tu nejsou žádné veřejné komunitní mapy. Jakmile se nějaké objeví, půjdou spouštět odsud.
                      </div>
                    ) : (
                      <>
                        <div className="space-y-3">
                          {communityThemes.map((theme) => {
                            const isSelected = selectedThemeId === theme.id;
                            return (
                              <button
                                key={theme.id}
                                type="button"
                                onClick={() => setSelectedThemeId(theme.id)}
                                className={`w-full rounded-2xl border-2 p-4 text-left transition ${
                                  isSelected
                                    ? "border-slate-900 bg-slate-900 text-white"
                                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"
                                }`}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="text-sm font-semibold">{theme.name}</div>
                                    <div className={`mt-1 text-xs ${isSelected ? "text-slate-300" : "text-slate-500"}`}>
                                      {theme.description}
                                    </div>
                                  </div>
                                  <div className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold ${
                                    isSelected
                                      ? "bg-white/15 text-white"
                                      : theme.isOfficial
                                      ? "bg-indigo-50 text-indigo-700"
                                      : "bg-emerald-50 text-emerald-700"
                                  }`}>
                                    {theme.isOfficial ? "Official" : "Komunita"}
                                  </div>
                                </div>
                                <div className={`mt-3 text-[11px] ${isSelected ? "text-slate-300" : "text-slate-400"}`}>
                                  ID: {theme.id} · Autor: {theme.author}
                                </div>
                              </button>
                            );
                          })}
                        </div>

                        {selectedCommunityTheme && (
                          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-4">
                            <div>
                              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Vybraná mapa
                              </div>
                              <div className="mt-1 text-sm font-semibold text-slate-800">
                                {selectedCommunityTheme.name}
                              </div>
                              <div className="mt-1 text-xs text-slate-500">
                                {selectedCommunityTheme.description}
                              </div>
                            </div>

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

                            <EconomyFields
                              stateSubsidy={stateSubsidy} setStateSubsidy={setStateSubsidy}
                              baseTax={baseTax} setBaseTax={setBaseTax}
                              lapTaxCoefficient={lapTaxCoefficient} setLapTaxCoefficient={setLapTaxCoefficient}
                              maxTax={maxTax} setMaxTax={setMaxTax}
                              fogOfWar={fogOfWar} setFogOfWar={setFogOfWar}
                            />

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
                              className="w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:border-slate-400 hover:bg-slate-50 transition"
                            >
                              🖥️ Lokální hra s vybranou mapou
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ) : isProfilePanel ? (
                  <div className="space-y-4">
                    {/* Identity block */}
                    <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 flex items-center gap-4">
                      <div className="relative shrink-0">
                        {discordUser?.avatar ? (
                          <img src={discordUser.avatar} alt="" className="h-14 w-14 rounded-2xl object-cover" />
                        ) : (
                          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-white text-xl font-bold">
                            {discordUser?.name?.charAt(0).toUpperCase() ?? "?"}
                          </div>
                        )}
                        <span className="absolute bottom-0.5 right-0.5 h-3 w-3 rounded-full bg-emerald-400 ring-2 ring-white" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-base font-bold text-slate-900 truncate">
                          {discordUser?.name || "Nepřihlášený hráč"}
                        </div>
                        {discordUser?.id && (
                          <div className="mt-0.5 font-mono text-[11px] text-slate-400 truncate">
                            Discord ID: {discordUser.id}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Stats grid */}
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {[
                        { label: "Odehrané hry", value: hostedGamesCount !== null ? String(hostedGamesCount) : "…" },
                        { label: "Výhry",         value: "–" },
                        { label: "Závody",        value: "–" },
                        { label: "Ztracení raceři", value: "–" },
                      ].map((s) => (
                        <div key={s.label} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-center">
                          <div className="text-2xl font-black text-slate-900">{s.value}</div>
                          <div className="mt-0.5 text-[11px] text-slate-500 leading-tight">{s.label}</div>
                        </div>
                      ))}
                    </div>
                    <p className="text-[11px] text-slate-400 -mt-1 px-1">
                      Výhry, závody a ztracení raceři se budou sledovat od příštích her.
                    </p>

                    {/* Achievements */}
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Achievementy</div>
                      <div className="grid grid-cols-4 gap-2">
                        {[
                          { emoji: "🏁", label: "První závod" },
                          { emoji: "🏆", label: "První výhra" },
                          { emoji: "🐴", label: "První racer" },
                          { emoji: "💀", label: "Ztracený racer" },
                          { emoji: "⚡", label: "Legendární racer" },
                          { emoji: "💰", label: "Boháč" },
                          { emoji: "🎲", label: "Hazardér" },
                          { emoji: "👑", label: "Šampion" },
                        ].map((a) => (
                          <div
                            key={a.label}
                            className="flex flex-col items-center gap-1 rounded-xl border border-slate-100 bg-slate-50 px-2 py-3 opacity-45 grayscale"
                            title={a.label}
                          >
                            <span className="text-2xl">{a.emoji}</span>
                            <span className="text-center text-[10px] leading-tight text-slate-600">{a.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <button
                        onClick={() => router.push("/hry")}
                        className="flex-1 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                      >
                        👀 Přehled aktivních her
                      </button>
                      <button
                        onClick={handleBack}
                        className="flex-1 rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                      >
                        ← Zpět na menu
                      </button>
                    </div>
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

                    <EconomyFields
                      stateSubsidy={stateSubsidy} setStateSubsidy={setStateSubsidy}
                      baseTax={baseTax} setBaseTax={setBaseTax}
                      lapTaxCoefficient={lapTaxCoefficient} setLapTaxCoefficient={setLapTaxCoefficient}
                      maxTax={maxTax} setMaxTax={setMaxTax}
                      fogOfWar={fogOfWar} setFogOfWar={setFogOfWar}
                    />

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
