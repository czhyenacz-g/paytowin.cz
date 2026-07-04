"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { generateGameCode, PLAYER_COLORS } from "@/lib/game";
import { THEMES } from "@/lib/themes";
import { BOARD_PRESETS } from "@/lib/board";
import MapMenuStrip from "./MapMenuStrip";
import JoinableGamesList from "./landing/JoinableGamesList";
import RotatingBenefitStrip from "./RotatingBenefitStrip";
import { logEvent } from "@/lib/analytics";
import { useAudioUnlock } from "@/app/hooks/useAudioUnlock";
import { playMusic, stopMusic } from "@/lib/audio/audio-manager";
import {
  requestJoinAction,
  approveJoinRequestAction,
  rejectJoinRequestAction,
  reinstateJoinRequestAction,
  checkJoinRequestStatusAction,
} from "@/app/game/join-actions";
import { notifyDiscordNewGameAction } from "@/app/game/discord-actions";
import { STARTING_COINS, DEFAULT_STARTING_COINS, STARTING_COINS_HARD, STARTING_COINS_NORMAL, STARTING_COINS_RICH } from "@/lib/game-constants";

interface DiscordUser {
  id: string;
  name: string;
  avatar: string | null;
}

interface JoinRequest {
  id: string;
  name: string;
  discord_id: string | null;
  discord_avatar_url: string | null;
  status: "pending" | "approved" | "rejected";
}

interface OwnerGameRequests {
  gameId:   string;
  gameCode: string;
  requests: JoinRequest[];
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
  "mapa-1":  { label: "Denní dostihy",  emoji: "🏇",  desc: "Connecticut, 1921. Banka udělala chybu — a ty z ní zkusíš udělat titulní příběh.",                                          teaser: "Začni s půjčenými penězi, kup první racery a přežij sezónu, která tě může dostat na titulní stranu.",                                                         bgImage: "/bg_horse_day.webp",     themeId: "horse-day",     boardId: "small-stadium", available: true,  view: "launcher" },
  "mapa-2":  { label: "Noční dostihy",  emoji: "🌙",  desc: "Connecticut, 1925. Přes den se závodí. V noci se vydělává.",                                                                             teaser: "Starý ovál, déšť, doutníky a závody po půlnoci. V noci nestačí vyhrát — musíš získat všechny koně.",                                                          bgImage: "/bg_horse_night.webp",   themeId: "horse-night",   available: true,  view: "launcher" },
  "mapa-3":  { label: "Chuchle",   emoji: "🏇",  desc: "Velká Chuchle, 1930. V Americe jsi přišel o vše. Poslední záchrana mohou být tvé kořeny v Československu.",                        teaser: "Po Černém pátku prodáš, co zbylo, a za poslední peníze utečeš ke kořenům. Ne jako vítěz — spíš jako člověk, který ještě odmítá skončit.",                    bgImage: "/bg_horse_classic.webp", themeId: "horse-classic", available: true,  view: "launcher" },
  "mapa-4":  { label: "Denní auta",     emoji: "🏎️", desc: "Československo, 1934. Od stájí ke garážím, od ovsa k benzínu, od žokejů k řidičům.",                                               teaser: "Koně ti dali druhou šanci, ale svět už burácí motory. Založ garáž a zjisti, jestli se dá prohrát ještě rychleji.",                                             bgImage: "/bg_car_day.webp",       themeId: "car-day",       available: true,  view: "launcher" },
  "mapa-5":  { label: "Noční auta",     emoji: "🌃",  desc: "1936. Skutečné závody začínají až po zavření bran.",                                                                                 teaser: "Motory, mlha, benzín a lidé, kteří tvrdí, že nesází — jen investují do rychlosti. Staré chyby se vrací, jen jedou rychleji.",                                  bgImage: "/bg_car_night.webp",     themeId: "car-night",     available: true,  view: "launcher" },
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

const STARTING_COINS_PRESETS = [
  { value: STARTING_COINS_HARD,   label: "Hard",   sub: "6 000" },
  { value: STARTING_COINS_NORMAL, label: "Normál", sub: "8 000" },
  { value: STARTING_COINS_RICH,   label: "Bohatý", sub: "10 000" },
] as const;

function EconomyFields({
  stateSubsidy, setStateSubsidy,
  baseTax, setBaseTax,
  lapTaxCoefficient, setLapTaxCoefficient,
  maxTax, setMaxTax,
  fogOfWar, setFogOfWar,
  addBotPlayer, setAddBotPlayer,
  requireApproval, setRequireApproval,
  startingCoins, setStartingCoins,
  isDiscordLoggedIn = false,
}: {
  stateSubsidy: number; setStateSubsidy: (v: number) => void;
  baseTax: number; setBaseTax: (v: number) => void;
  lapTaxCoefficient: number; setLapTaxCoefficient: (v: number) => void;
  maxTax: number; setMaxTax: (v: number) => void;
  fogOfWar: boolean; setFogOfWar: (v: boolean) => void;
  addBotPlayer: boolean; setAddBotPlayer: (v: boolean) => void;
  requireApproval: boolean; setRequireApproval: (v: boolean) => void;
  startingCoins: number; setStartingCoins: (v: number) => void;
  isDiscordLoggedIn?: boolean;
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
          <div>
            <div className="text-xs font-medium text-slate-600 mb-1.5">Počáteční peníze</div>
            <div className="flex gap-2">
              {STARTING_COINS_PRESETS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setStartingCoins(p.value)}
                  className={`flex-1 rounded-lg border-2 py-2 text-center text-xs font-semibold transition ${
                    startingCoins === p.value
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"
                  }`}
                >
                  <div>{p.label}</div>
                  <div className={`mt-0.5 text-[10px] font-normal ${startingCoins === p.value ? "text-slate-300" : "text-slate-400"}`}>{p.sub} 💰</div>
                </button>
              ))}
            </div>
            <div className="mt-1.5 text-[10px] text-slate-400">Nižší start víc trestá špatné nákupy. Vyšší start je mírnější pro nové hráče.</div>
          </div>
          <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5">
            <input
              type="checkbox"
              checked={addBotPlayer}
              onChange={(e) => setAddBotPlayer(e.target.checked)}
              className="h-4 w-4 rounded accent-slate-800"
            />
            <span className="text-sm font-medium text-slate-700">🤖 Přidat bota, ať můžeš hrát hned</span>
          </label>
          <label className={`flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 ${isDiscordLoggedIn ? "cursor-pointer" : "cursor-not-allowed opacity-60"}`}>
            <input
              type="checkbox"
              checked={requireApproval}
              disabled={!isDiscordLoggedIn}
              onChange={(e) => isDiscordLoggedIn && setRequireApproval(e.target.checked)}
              className="h-4 w-4 rounded accent-slate-800 disabled:cursor-not-allowed"
            />
            <div className="flex flex-col">
              <span className="text-sm font-medium text-slate-700">🔐 Schvalovat hráče před připojením</span>
              {isDiscordLoggedIn
                ? <span className="text-xs text-slate-500">Zakladatel hry bude nové hráče přijímat nebo odmítat.</span>
                : <span className="text-xs text-slate-400">Vyžaduje přihlášení přes Discord.</span>
              }
            </div>
          </label>
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

  // Audio — unlock při prvním kliku, menu hudba po celou dobu na landing page
  useAudioUnlock();
  React.useEffect(() => {
    playMusic("menu");
    return () => stopMusic();
  }, []);

  const [name, setName] = React.useState("");
  const [joinCode, setJoinCode] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [discordSessionLoading, setDiscordSessionLoading] = React.useState(true);
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
  const [startingCoins, setStartingCoins] = React.useState(DEFAULT_STARTING_COINS);
  const [activePanel, setActivePanel] = React.useState<string | null>(null);
  const [communityThemes, setCommunityThemes] = React.useState<CommunityThemeSummary[]>([]);
  const [communityLoading, setCommunityLoading] = React.useState(false);
  const [playedGamesCount, setPlayedGamesCount] = React.useState<number | null>(null);
  const [xpTotal, setXpTotal] = React.useState<number | null>(null);
  const [winsTotal, setWinsTotal] = React.useState<number | null>(null);
  const [winStarsTotal, setWinStarsTotal] = React.useState<number | null>(null);
  const [moneySpentTotal, setMoneySpentTotal] = React.useState<number | null>(null);
  const [isDevJoin, setIsDevJoin] = React.useState(false);
  const [addBotPlayer, setAddBotPlayer] = React.useState(false);
  const [requireApproval, setRequireApproval] = React.useState(false);
  const [joinApprovalStatus, setJoinApprovalStatus] = React.useState<"pending" | "rejected" | "approved" | null>(null);
  const [joinApprovalMessage, setJoinApprovalMessage] = React.useState<string | null>(null);
  const [pendingGameCode, setPendingGameCode] = React.useState<string | null>(null);
  const [checkingApproval, setCheckingApproval] = React.useState(false);
  const [ownerGameRequests, setOwnerGameRequests] = React.useState<OwnerGameRequests[]>([]);
  const [ownerRequestActionError, setOwnerRequestActionError] = React.useState<Record<string, string>>({});
  const isDiscordConnected = Boolean(discordUser?.id);
  const [showJoinDisabledHint, setShowJoinDisabledHint] = React.useState(false);
  const [joinPanelExpanded, setJoinPanelExpanded] = React.useState(false);
  const [joinableGamesCount, setJoinableGamesCount] = React.useState<number | null>(null);
  const playerNameInputRef = React.useRef<HTMLInputElement | null>(null);
  // Načti session + předvyplň ?join=KOD z URL
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const join = params.get("join");
    if (join) { setJoinCode(join.toUpperCase()); setJoinPanelExpanded(true); }

    // Dev join — pouze localhost / dev build, nikdy produkce
    if (params.get("dev") === "1" && join) {
      const isLocalDev =
        window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1" ||
        process.env.NODE_ENV === "development";
      if (isLocalDev) {
        let devId = localStorage.getItem("devGuestId");
        if (!devId) {
          devId = `dev_${crypto.randomUUID()}`;
          localStorage.setItem("devGuestId", devId);
        }
        setName(`Dev-${devId.slice(-4).toUpperCase()}`);
        setIsDevJoin(true);
        setDiscordSessionLoading(false);
        return;
      }
    }

    supabase.auth.getUser().then(({ data: { user } }) => {
      setDiscordSessionLoading(false);
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

  // Načti XP + statistiky hned po přihlášení Discordem (potřeba pro odemykání map)
  React.useEffect(() => {
    if (!discordUser?.id) return;
    supabase
      .from("user_profiles")
      .select("xp_total, wins_total, win_stars_total, money_spent_total")
      .eq("discord_id", discordUser.id)
      .single()
      .then(({ data }) => {
        setXpTotal(data?.xp_total ?? 0);
        setWinsTotal(data?.wins_total ?? 0);
        setWinStarsTotal(data?.win_stars_total ?? 0);
        setMoneySpentTotal(data?.money_spent_total ?? 0);
      });
  }, [discordUser?.id]);

  // Načti počet odehraných her až při otevření profilu (nákladnější dotaz)
  React.useEffect(() => {
    if (activePanel !== "profil" || !discordUser?.id) return;
    supabase
      .from("players")
      .select("games!inner(status)", { count: "exact", head: true })
      .eq("discord_id", discordUser.id)
      .eq("games.status", "finished")
      .then(({ count }) => setPlayedGamesCount(count ?? 0));
  }, [activePanel, discordUser?.id]);

  const handleBack = () => {
    setActivePanel(null);
    setShareCode(null);
    setError("");
  };

  const fetchOwnerRequests = React.useCallback(async (discordId: string) => {
    // Načti hry, kde jsem owner a require_approval=true
    const { data: games } = await supabase
      .from("games")
      .select("id, code")
      .eq("owner_discord_id", discordId)
      .eq("require_approval", true)
      .in("status", ["waiting", "playing"]);

    if (!games?.length) {
      setOwnerGameRequests([]);
      return;
    }

    const gameIds = games.map(g => g.id);
    const { data: requests } = await supabase
      .from("game_join_requests")
      .select("id, game_id, name, discord_id, discord_avatar_url, status")
      .in("game_id", gameIds)
      .in("status", ["pending", "rejected"]);

    if (!requests?.length) {
      setOwnerGameRequests([]);
      return;
    }

    const grouped: OwnerGameRequests[] = games
      .map(g => ({
        gameId:   g.id,
        gameCode: g.code,
        requests: requests
          .filter(r => r.game_id === g.id)
          .map(r => ({
            id:                 r.id,
            name:               r.name,
            discord_id:         r.discord_id,
            discord_avatar_url: r.discord_avatar_url,
            status:             r.status as "pending" | "rejected",
          })),
      }))
      .filter(g => g.requests.length > 0);

    setOwnerGameRequests(grouped);
  }, []);

  // Načti žádosti vždy po přihlášení Discordem
  React.useEffect(() => {
    if (discordUser?.id) fetchOwnerRequests(discordUser.id);
  }, [discordUser?.id, fetchOwnerRequests]);

  const handleApproveRequest = async (requestId: string) => {
    if (!discordUser?.id) return;
    setOwnerRequestActionError(prev => ({ ...prev, [requestId]: "" }));
    const result = await approveJoinRequestAction(requestId, discordUser.id);
    if (!result.ok) {
      setOwnerRequestActionError(prev => ({ ...prev, [requestId]: result.reason }));
    }
    await fetchOwnerRequests(discordUser.id);
  };

  const handleRejectRequest = async (requestId: string) => {
    if (!discordUser?.id) return;
    setOwnerRequestActionError(prev => ({ ...prev, [requestId]: "" }));
    const result = await rejectJoinRequestAction(requestId, discordUser.id);
    if (!result.ok) {
      setOwnerRequestActionError(prev => ({ ...prev, [requestId]: result.reason }));
    }
    await fetchOwnerRequests(discordUser.id);
  };

  const handleReinstateRequest = async (requestId: string) => {
    if (!discordUser?.id) return;
    setOwnerRequestActionError(prev => ({ ...prev, [requestId]: "" }));
    const result = await reinstateJoinRequestAction(requestId, discordUser.id);
    if (!result.ok) {
      setOwnerRequestActionError(prev => ({ ...prev, [requestId]: result.reason }));
    }
    await fetchOwnerRequests(discordUser.id);
  };

  const handleCheckApproval = async () => {
    if (!pendingGameCode) return;
    if (!discordUser?.id) {
      setJoinApprovalMessage("Pro schválené hry musíš být přihlášen přes Discord.");
      return;
    }
    setCheckingApproval(true);
    const result = await checkJoinRequestStatusAction({
      gameCode:  pendingGameCode,
      discordId: discordUser.id,
    });
    setCheckingApproval(false);

    if (!result.ok) {
      if (result.reason === "not_found") {
        setJoinApprovalMessage("Žádost nenalezena. Zkus se připojit znovu.");
        setJoinApprovalStatus(null);
      } else if (result.reason === "approved_but_player_missing") {
        setJoinApprovalMessage("Žádost je schválena, ale hráčský záznam chybí. Kontaktuj zakladatele.");
      } else {
        setJoinApprovalMessage(`Chyba při kontrole: ${result.reason}`);
      }
      return;
    }

    if (result.status === "pending") {
      setJoinApprovalMessage("Pořád čekáš na schválení zakladatelem.");
    } else if (result.status === "rejected") {
      setJoinApprovalStatus("rejected");
      setJoinApprovalMessage("Tvoje žádost byla odmítnuta. Zakladatel tě může znovu povolit.");
    } else {
      // approved — nastav localStorage a redirect
      localStorage.setItem(`paytowin_player_${result.gameCode}`, result.playerId);
      router.push(`/game/${result.gameCode}`);
    }
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
        economy: { stateSubsidy, baseTax, lapTaxCoefficient, maxTax, startingCoins },
        fog_of_war: fogOfWar,
        require_approval: requireApproval,
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
      coins: startingCoins,
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

    if (addBotPlayer) {
      await supabase.from("players").insert({
        game_id: game.id,
        name: "Stájový bot",
        color: PLAYER_COLORS[1],
        position: 0,
        coins: startingCoins,
        horses: [],
        turn_order: 1,
        is_bot: true,
        discord_id: null,
        discord_avatar_url: null,
      });
    }

    await supabase.from("game_state").insert({
      game_id: game.id,
      current_player_index: 0,
      last_roll: null,
      log: [],
    });

    logEvent({ name: "create_game_success", game_code: code, theme_id: selectedThemeId, board_id: selectedBoardId });
    notifyDiscordNewGameAction({
      gameCode:        code,
      themeId:         selectedThemeId,
      boardId:         selectedBoardId,
      hasBot:          addBotPlayer,
      requireApproval: requireApproval,
      maxPlayers:      maxPlayers,
      ownerName:       name.trim() || null,
    }).then((result) => {
      if (result.ok && result.threadUrl) {
        void supabase.from("games").update({ discord_thread_url: result.threadUrl }).eq("id", game.id);
      } else if (result.ok && result.warning) {
        console.warn("[discord] thread not created:", result.warning);
      }
    }).catch(() => {});
    localStorage.setItem(`paytowin_player_${code}`, newPlayer.id);
    setShareCode(code);
    setLoading(false);
  };

  const handleJoinFromLobby = (code: string) => {
    setJoinCode(code);
    if (!isDiscordConnected && !name.trim()) {
      setError(`Nejdřív zadej jméno. Hra ${code} je připravená k připojení.`);
      playerNameInputRef.current?.focus();
      return;
    }
    void joinGame(code);
  };

  const joinButtonDisabled =
    loading || discordSessionLoading || joinApprovalStatus === "pending" || (!isDiscordConnected && !name.trim()) || !joinCode.trim();

  const handleJoinButtonClick = () => {
    if (joinButtonDisabled) {
      if (!joinCode.trim()) {
        setError("Je nutné nejdříve zadat kod hry");
      }
      return;
    }
    void joinGame();
  };

  const joinGame = async (overrideCode?: string) => {
    const effectivePlayerName = isDiscordConnected ? (discordUser?.name?.trim() ?? "") : name.trim();
    if (!effectivePlayerName) return setError("Zadej své jméno.");
    const effectiveCode = (overrideCode ?? joinCode).trim().toUpperCase();
    if (!effectiveCode) return setError("Zadej kód hry.");
    setLoading(true);
    setError("");

    // Guard 1: hráč už je v téhle hře (localStorage) — nevytvářej duplicitního hráče
    const storedPid = localStorage.getItem(`paytowin_player_${effectiveCode}`);
    if (storedPid) {
      router.push(`/game/${effectiveCode}`);
      return;
    }

    const { data: game, error: gameErr } = await supabase
      .from("games")
      .select()
      .eq("code", effectiveCode)
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

    // Guard 2: Discord reclaim — vrátí existujícího hráče i z jiného zařízení/prohlížeče
    if (discordUser?.id) {
      const existingPlayer = existingPlayers?.find(p => p.discord_id === discordUser.id);
      if (existingPlayer) {
        localStorage.setItem(`paytowin_player_${game.code}`, existingPlayer.id);
        logEvent({ name: "join_game_rejoin", game_code: game.code });
        router.push(`/game/${game.code}`);
        return;
      }
    }

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
      // Hra probíhá a první kolo již skončilo — připoj jako pozorovatel
      logEvent({ name: "spectator_view", game_code: game.code });
      sessionStorage.setItem("paytowin_late_join", game.code);
      router.push(`/game/${game.code}`);
      return;
    }

    // ── Require approval větev ────────────────────────────────────────────────
    if (game.require_approval) {
      if (!discordUser?.id) {
        setError("Tato hra vyžaduje schválení zakladatelem. Pro připojení se přihlas přes Discord.");
        setLoading(false);
        return;
      }
      const result = await requestJoinAction({
        gameCode:          game.code,
        name:              effectivePlayerName,
        discordId:         discordUser?.id ?? null,
        discordAvatarUrl:  discordUser?.avatar ?? null,
      });

      setLoading(false);

      if (result.ok) {
        // pending nebo already_pending
        setJoinApprovalStatus("pending");
        setJoinApprovalMessage("Žádost odeslána. Čekáš na schválení zakladatelem hry.");
        setPendingGameCode(game.code);
      } else if (result.reason === "already_rejected") {
        setJoinApprovalStatus("rejected");
        setJoinApprovalMessage("Tvoje žádost byla odmítnuta. Zakladatel tě může znovu povolit.");
        setPendingGameCode(game.code);
      } else {
        setError(`Nepodařilo se odeslat žádost. (${result.reason})`);
      }
      return;
    }

    // ── Přímý join (require_approval === false) ───────────────────────────────
    const turnOrder = existingPlayers?.length ?? 0;
    const color = PLAYER_COLORS[turnOrder % PLAYER_COLORS.length];
    const joinCoins = (game.economy as { startingCoins?: number } | null)?.startingCoins ?? DEFAULT_STARTING_COINS;

    const { data: newPlayer, error: joinPlayerErr } = await supabase.from("players").insert({
      game_id: game.id,
      name: effectivePlayerName,
      color,
      position: 0,
      coins: joinCoins,
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

  const ticketSectionHeadingClass = "mx-auto w-fit text-center text-[8px] sm:text-[9px] font-black uppercase tracking-[0.32em] sm:tracking-[0.35em] text-amber-400/80 select-none";
  const ticketSectionDividerClass = "mx-auto h-px w-16 sm:w-20 bg-gradient-to-r from-amber-600/0 via-amber-600/30 to-amber-600/0";

  const utilityDiscordBlock = discordUser ? (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-600/25 bg-white/[0.05] px-3 py-2">
      <div className="flex min-w-0 items-center gap-3">
        {discordUser.avatar ? (
          <img src={discordUser.avatar} alt="" className="h-8 w-8 rounded-full" />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-700 text-sm font-bold text-white">
            {discordUser.name.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-amber-100">{discordUser.name}</div>
        </div>
      </div>
      <button onClick={logoutDiscord} className="shrink-0 text-xs font-medium text-amber-400/70 transition hover:text-amber-300">
        Odhlásit
      </button>
    </div>
  ) : (
    <button
      onClick={loginWithDiscord}
      className="w-full rounded-lg border border-amber-600/25 bg-white/[0.05] px-4 py-2.5 text-sm font-semibold text-amber-300 transition hover:bg-white/[0.09] hover:border-amber-500/40"
    >
      <div>🎮 Přihlásit přes Discord</div>
      <div className="mt-0.5 text-[11px] font-normal text-amber-400/50">Rychle. Bez registrace.</div>
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

  if (isDevJoin) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-4">
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-center">
            <div className="text-xs font-bold uppercase tracking-widest text-amber-400">⚙ Dev Join — lokální testování</div>
            <div className="mt-0.5 text-[11px] text-amber-300/70">Funguje jen na localhost / dev buildu</div>
          </div>
          <div className="rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <div>
              <div className="text-base font-bold text-slate-800">Připojit ke hře</div>
              <div className="mt-0.5 text-sm text-slate-500">Kód: <span className="font-mono font-semibold">{joinCode}</span></div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Tvoje jméno</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Dev hráč"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-800 outline-none focus:border-slate-500 placeholder:text-slate-400"
                autoFocus
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            {joinApprovalStatus === "pending" && (
              <div className="space-y-2">
                <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  ⏳ {joinApprovalMessage}
                </div>
                <button
                  onClick={handleCheckApproval}
                  disabled={checkingApproval}
                  className="w-full rounded-xl border border-amber-400 bg-amber-100 px-4 py-2.5 text-sm font-semibold text-amber-800 hover:bg-amber-200 transition disabled:opacity-50"
                >
                  {checkingApproval ? "Kontroluji…" : "🔄 Zkontrolovat schválení"}
                </button>
              </div>
            )}
            {joinApprovalStatus === "rejected" && (
              <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
                🚫 {joinApprovalMessage}
              </div>
            )}
            <button
              onClick={() => joinGame()}
              disabled={loading || joinApprovalStatus === "pending"}
              className="w-full rounded-2xl bg-slate-900 px-4 py-4 text-lg font-semibold text-white shadow transition hover:bg-slate-800 disabled:bg-slate-400"
            >
              {loading ? "Připojuji…" : "Připojit →"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col bg-slate-900 overflow-hidden"
      style={{
        height: "100dvh",
        backgroundImage: "linear-gradient(rgba(15,23,42,0.60) 0%, rgba(15,23,42,0.38) 48%, rgba(15,23,42,0.62) 100%), url('/menu_bckg.webp')",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >

      {/* Sliding container — flex-1 vyplní zbytek viewportu po banneru */}
      <div
        className="flex-1 flex min-h-0 transition-transform duration-500 ease-in-out"
        style={{
          width: "200%",
          transform: activePanel ? "translateX(-50%)" : "translateX(0%)",
        }}
      >

        {/* ── LEFT: landing view (50% = 100vw) ── */}
        <div style={{ width: "50%" }} className="flex flex-col min-h-0 overflow-x-hidden">
          <div className="flex flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
            <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-4 sm:px-6 py-4 sm:py-8">

              <div className="mb-3 sm:mb-6 text-center">
                <h1 className="sr-only">StartovníPole.cz — česká multiplayer závodní deskovka v prohlížeči</h1>

                {/* Hlavní herní titul */}
                <div className="brand-logo brand-logo--hero mx-auto inline-block">
                  <span className="brand-logo__wordmark">
                    <span className="brand-logo__pay">Startovní</span>
                    <span className="brand-logo__win">Pole</span>
                  </span>
                </div>

                {/* Podtitul */}
                <p className="mt-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-200/80">
                  Multiplayer závodní deskovka
                </p>

                <p className="mt-2 text-xs text-amber-100/70">Závody, sázky a finanční chaos.</p>
                <p className="mt-1 text-xs text-amber-100/50">
                  Nenásilná rodinná deskovka pro hráče od 5 do 120 let. Bez krve, bez instalace — jen kostka, náhoda a kamarádi, kteří ti vítězství nedají zadarmo.
                </p>
              </div>

              <MapMenuStrip
                currentXp={xpTotal}
                isLoggedIn={!!discordUser}
                onPanelClick={(id) => {
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
              }}
              />

              <div className="mx-auto mt-2.5 sm:mt-4 w-full max-w-4xl lg:max-w-[82%] xl:max-w-[78%] space-y-1.5 sm:space-y-2">
                {/* ── Benefit / quick-game strip ── */}
                <RotatingBenefitStrip variant="slate" />

              {/* ── Collapsible join + games panel ── */}
              <div className="rounded-2xl border border-slate-700/60 overflow-hidden shadow-xl shadow-black/50">
                {/* Sbalitelná hlavička */}
                <button
                  type="button"
                  onClick={() => setJoinPanelExpanded(e => !e)}
                  className="w-full flex items-center justify-between px-3 py-2 text-left bg-slate-950/90 hover:bg-slate-800/60 transition"
                >
                  <span className="flex items-center gap-2 text-xs font-medium text-slate-400">
                    Hry k připojení
                    {joinableGamesCount !== null && joinableGamesCount > 0 && (
                      <span className="rounded-full bg-slate-700 px-1.5 py-px text-[10px] font-semibold text-slate-300 tabular-nums">
                        {joinableGamesCount}
                      </span>
                    )}
                  </span>
                  <span className="text-[10px] text-slate-500 select-none">{joinPanelExpanded ? "▲" : "▼"}</span>
                </button>

                {/* Rozbalený obsah */}
                {joinPanelExpanded && (
                  <div className="border-t border-slate-700/60">
                    {/* Ticket panel — původní vzhled */}
                    <div className="relative px-5 sm:px-8 py-[10px] sm:py-[14px] overflow-hidden border-b border-slate-700/30 bg-slate-950/90 backdrop-blur-sm">
                      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/25 to-transparent" aria-hidden="true" />
                      <div className="relative grid grid-cols-1 lg:grid-cols-3 gap-3 lg:gap-0 lg:divide-x lg:divide-amber-700/20 lg:items-center">
                        {/* Levá sekce: Discord stav / login */}
                        <div className="min-w-0 space-y-1.5 sm:space-y-2 w-full max-w-sm mx-auto lg:max-w-none lg:justify-self-center lg:flex lg:flex-col lg:items-center lg:px-5">
                          <div className={`${ticketSectionHeadingClass} hidden lg:block`}>Vstupenka do hry</div>
                          <div className={`${ticketSectionDividerClass} hidden lg:block`} />
                          <div className="w-full lg:flex lg:justify-center">
                            <div className="w-full lg:max-w-[13.25rem]">
                              {utilityDiscordBlock}
                            </div>
                          </div>
                        </div>

                        {/* Střední sekce: jméno (jen guest) + kód hry + Připojit */}
                        <div className="min-w-0 flex flex-col gap-1.5 sm:gap-2 w-full max-w-sm mx-auto lg:max-w-none lg:items-center lg:px-5">
                          <div className={`${ticketSectionHeadingClass} hidden lg:block`}>Kód hry</div>
                          <div className={`${ticketSectionDividerClass} hidden lg:block`} />
                          <div className="w-full lg:flex lg:justify-center">
                            <div className="w-full lg:max-w-[13.5rem]">
                              {!isDiscordConnected && (
                                <>
                                  <input
                                    ref={playerNameInputRef}
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Tvoje jméno"
                                    className="w-full h-8 min-w-0 rounded-lg border border-amber-600/25 bg-white/[0.05] px-3 text-sm text-amber-100 outline-none placeholder:text-amber-200/25 focus:border-amber-500/60 focus:bg-white/[0.08]"
                                  />
                                  <div className="my-1.5 h-px bg-slate-700/50" />
                                </>
                              )}
                              <div className="w-full flex flex-col gap-1.5 sm:flex-row sm:items-stretch sm:gap-2">
                                <input
                                  type="text"
                                  value={joinCode}
                                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                                  placeholder="Kód hry"
                                  maxLength={5}
                                  className="h-8 min-w-0 flex-1 rounded-lg border border-amber-600/25 bg-white/[0.05] px-3 text-sm uppercase tracking-[0.18em] sm:tracking-[0.2em] text-amber-100 outline-none placeholder:tracking-normal placeholder:text-amber-200/25 focus:border-amber-500/60 focus:bg-white/[0.08]"
                                />
                                <div
                                  className="relative w-full shrink-0 sm:w-[6rem]"
                                  onMouseEnter={() => joinButtonDisabled && setShowJoinDisabledHint(true)}
                                  onMouseLeave={() => setShowJoinDisabledHint(false)}
                                  onClick={handleJoinButtonClick}
                                >
                                  <button
                                    type="button"
                                    disabled={joinButtonDisabled}
                                    className="h-8 w-full rounded-lg bg-amber-600 px-4 text-[13px] sm:text-sm font-semibold text-white transition hover:bg-amber-500 disabled:border disabled:border-amber-600/20 disabled:bg-white/[0.04] disabled:text-amber-200/30"
                                  >
                                    {discordSessionLoading && joinCode.trim() ? "Načítám…" : "Připojit"}
                                  </button>
                                  {joinButtonDisabled && showJoinDisabledHint && (
                                    <div className="pointer-events-none absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[11px] text-white shadow-sm">
                                      <span aria-hidden="true">⊘</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Pravá sekce: sledovat aktivní hry */}
                        <div className="min-w-0 flex flex-col gap-1.5 sm:gap-2 w-full max-w-sm mx-auto lg:max-w-none lg:items-center lg:px-5">
                          <div className={`${ticketSectionHeadingClass} hidden lg:block`}>Aktivní hry</div>
                          <div className={`${ticketSectionDividerClass} hidden lg:block`} />
                          <div className="w-full lg:flex lg:justify-center">
                            <a
                              href="/hry"
                              className="inline-flex h-8 w-full items-center justify-center whitespace-nowrap rounded-lg border border-amber-600/25 bg-white/[0.05] px-4 text-[13px] sm:text-sm font-semibold text-amber-300 transition hover:bg-white/[0.09] hover:border-amber-500/40 lg:self-center"
                            >
                              👀 Sledovat aktivní hry
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Seznam her — interní scroll, stránka neroste */}
                    <div className="px-3 pb-3 pt-2 bg-slate-950/80">
                      <JoinableGamesList
                        onJoin={handleJoinFromLobby}
                        playerName={name}
                        isDiscordLoggedIn={!!discordUser?.id}
                        onCountChange={setJoinableGamesCount}
                      />
                    </div>
                  </div>
                )}
              </div>

                {error && (
                  <p className="text-center text-sm text-red-600">{error}</p>
                )}
                {joinApprovalStatus === "pending" && (
                  <div className="mx-auto max-w-sm space-y-2">
                    <div className="rounded-xl border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-center text-sm text-amber-300">
                      ⏳ {joinApprovalMessage}
                    </div>
                    <button
                      onClick={handleCheckApproval}
                      disabled={checkingApproval}
                      className="w-full rounded-xl border border-amber-500/40 bg-amber-500/15 px-4 py-2.5 text-sm font-semibold text-amber-300 hover:bg-amber-500/25 transition disabled:opacity-50"
                    >
                      {checkingApproval ? "Kontroluji…" : "🔄 Zkontrolovat schválení"}
                    </button>
                  </div>
                )}
                {joinApprovalStatus === "rejected" && (
                  <div className="mx-auto max-w-sm rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-center text-sm text-red-300">
                    🚫 {joinApprovalMessage}
                  </div>
                )}

                {/* ── Owner panel: žádosti o připojení ── */}
                {ownerGameRequests.length > 0 && (
                  <div className="mx-auto w-full max-w-5xl rounded-2xl border border-slate-700 bg-slate-800/60 p-4 space-y-4">
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">🔐 Žádosti o připojení</div>
                    {ownerGameRequests.map(({ gameCode, requests }) => (
                      <div key={gameCode} className="space-y-2">
                        <div className="text-xs text-slate-500 font-mono">Hra: <span className="text-slate-300 font-semibold">{gameCode}</span></div>
                        {requests.map(req => (
                          <div key={req.id} className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5">
                            {req.discord_avatar_url ? (
                              <img src={req.discord_avatar_url} alt="" className="h-7 w-7 rounded-full shrink-0" />
                            ) : (
                              <div className="h-7 w-7 rounded-full bg-slate-700 shrink-0 flex items-center justify-center text-xs text-slate-400">
                                {req.name[0]?.toUpperCase() ?? "?"}
                              </div>
                            )}
                            <span className="flex-1 truncate text-sm text-slate-200">{req.name}</span>
                            {ownerRequestActionError[req.id] && (
                              <span className="text-xs text-red-400">{ownerRequestActionError[req.id]}</span>
                            )}
                            {req.status === "pending" && (
                              <>
                                <button
                                  onClick={() => handleApproveRequest(req.id)}
                                  className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-500 transition shrink-0"
                                >
                                  Přijmout
                                </button>
                                <button
                                  onClick={() => handleRejectRequest(req.id)}
                                  className="rounded-lg bg-red-700/80 px-3 py-1 text-xs font-semibold text-white hover:bg-red-600 transition shrink-0"
                                >
                                  Odmítnout
                                </button>
                              </>
                            )}
                            {req.status === "rejected" && (
                              <>
                                <span className="text-xs text-red-400 shrink-0">Odmítnuto</span>
                                <button
                                  onClick={() => handleReinstateRequest(req.id)}
                                  className="rounded-lg border border-slate-600 px-3 py-1 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition shrink-0"
                                >
                                  Znovu povolit
                                </button>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-center gap-4 text-xs text-slate-400">
                  <a href="/pravidla" className="hover:text-slate-200 underline">Pravidla hry</a>
                  <span>·</span>
                  <a href="/o-nas" className="hover:text-slate-200 underline">O nás</a>
                  <span>·</span>
                  <a href="/racers" className="hover:text-slate-200 underline">Závodníci</a>
                  <span>·</span>
                  {/* <a href="/bets" className="hover:text-slate-200 underline">Dostihy a sázky 18+</a>
                  <span>·</span> */}
                  <a href="/partners" className="hover:text-slate-200 underline">Partnerství</a>
                  <span>·</span>
                  <a href="/testeri" className="hover:text-slate-200 underline font-semibold">Hledám testery</a>
                  <span>·</span>
                  <a href="/faq" className="hover:text-slate-200 underline">FAQ</a>
                  <span>·</span>
                  <a href="mailto:info@paytowin.cz" className="hover:text-slate-200 underline">info@paytowin.cz</a>
                  <span>·</span>
                  <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-400 tracking-wide">Beta v0.7.93-seno</span>
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
                              addBotPlayer={addBotPlayer} setAddBotPlayer={setAddBotPlayer}
                              requireApproval={requireApproval} setRequireApproval={setRequireApproval}
                              startingCoins={startingCoins} setStartingCoins={setStartingCoins}
                              isDiscordLoggedIn={!!discordUser?.id}
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
                        <div className={`text-base font-bold text-slate-900 ${discordUser?.name ? "truncate" : ""}`}>
                          {discordUser?.name || "Nepřihlášený hráč"}
                        </div>
                        {discordUser?.id && (
                          <div className="mt-0.5 font-mono text-[11px] text-slate-400 truncate">
                            Discord ID: {discordUser.id}
                          </div>
                        )}
                      </div>
                      {!discordUser && (
                        <button
                          onClick={loginWithDiscord}
                          className="shrink-0 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
                        >
                          🎮 Přihlásit přes Discord
                        </button>
                      )}
                    </div>

                    {/* Stats grid */}
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                      {[
                        { label: "Odehrané hry", value: discordUser ? (playedGamesCount !== null ? String(playedGamesCount) : "…") : "–" },
                        { label: "Výhry",        value: discordUser ? (winsTotal !== null ? String(winsTotal) : "…") : "–" },
                        { label: "XP",           value: discordUser ? (xpTotal !== null ? String(xpTotal) : "…") : "–" },
                        { label: "Hvězdy",       value: discordUser ? (winStarsTotal !== null ? String(winStarsTotal) : "…") : "–" },
                        { label: "Utraceno 💰",  value: discordUser ? (moneySpentTotal !== null ? moneySpentTotal.toLocaleString("cs-CZ") : "…") : "–" },
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
                      addBotPlayer={addBotPlayer} setAddBotPlayer={setAddBotPlayer}
                      requireApproval={requireApproval} setRequireApproval={setRequireApproval}
                      startingCoins={startingCoins} setStartingCoins={setStartingCoins}
                      isDiscordLoggedIn={!!discordUser?.id}
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
