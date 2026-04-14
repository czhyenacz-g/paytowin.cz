"use client";

import React from "react";
import { supabase } from "@/lib/supabase";
import { getThemeById, getThemeRacers } from "@/lib/themes";
import { loadThemeManifestAsync } from "@/lib/themes/loader";
import { getBoardById } from "@/lib/board";
import type { Field } from "@/lib/engine";
import {
  sleep,
  buildFields,
  getStartTax,
  isBankrupt,
  getNextActiveIndex,
  normalizePlayer,
  normalizeState,
  playerOwnsRacer,
  racerOwnershipKey,
  REROLL_COST,
  REROLL_CHANCE,
} from "@/lib/engine";

const RACE_WINNER_REWARD = 50; // fixní odměna za 1. místo v mass_race

/** Vrátí true pokud oba hráči mají aspoň jednoho závodníka — stejná podmínka jako race flow. */
function canTriggerRivalsRace(p1: Player, p2: Player): boolean {
  return p1.horses.length > 0 && p2.horses.length > 0;
}
import { drawCard } from "@/lib/cards";
import type { GameCard } from "@/lib/cards";
import type { Player, Horse, GameState, OfferPending, RerollOffer, RaceOffer, BankruptAnnouncement, RacePendingEvent, PostTurnEvent, RaceType } from "@/lib/types/game";
import type { CenterEvent } from "@/lib/types/events";
import CenterEventModal from "./modals/CenterEventModal";
import RaceModal from "./RaceModal";
import RaceEventOverlay from "./RaceEventOverlay";
import BuildInfoBar from "./BuildInfoBar";

// Styly polí jsou součástí theme systému (lib/themes/*)
// Přistupuj přes: theme.colors.fieldStyles[field.type]

const FIELD_POSITIONS: React.CSSProperties[] = [
  { top: "50%", left: "8%",  transform: "translate(-50%, -50%)" },
  { top: "35%", left: "10%", transform: "translate(-50%, -50%)" },
  { top: "22%", left: "15%", transform: "translate(-50%, -50%)" },
  { top: "12%", left: "24%", transform: "translate(-50%, -50%)" },
  { top: "8%",  left: "38%", transform: "translate(-50%, -50%)" },
  { top: "8%",  left: "50%", transform: "translate(-50%, -50%)" },
  { top: "8%",  left: "62%", transform: "translate(-50%, -50%)" },
  { top: "12%", left: "76%", transform: "translate(-50%, -50%)" },
  { top: "22%", left: "85%", transform: "translate(-50%, -50%)" },
  { top: "35%", left: "90%", transform: "translate(-50%, -50%)" },
  { top: "50%", left: "92%", transform: "translate(-50%, -50%)" },
  { top: "65%", left: "90%", transform: "translate(-50%, -50%)" },
  { top: "78%", left: "85%", transform: "translate(-50%, -50%)" },
  { top: "88%", left: "76%", transform: "translate(-50%, -50%)" },
  { top: "92%", left: "62%", transform: "translate(-50%, -50%)" },
  { top: "92%", left: "50%", transform: "translate(-50%, -50%)" },
  { top: "92%", left: "38%", transform: "translate(-50%, -50%)" },
  { top: "88%", left: "24%", transform: "translate(-50%, -50%)" },
  { top: "78%", left: "15%", transform: "translate(-50%, -50%)" },
  { top: "65%", left: "10%", transform: "translate(-50%, -50%)" },
  { top: "50%", left: "16%", transform: "translate(-50%, -50%)" },
];

// ─── Kostka ───────────────────────────────────────────────────────────────────

// Souřadnice teček pro každou stranu kostky [cx, cy] v SVG viewBox 0–100
const DICE_DOTS: [number, number][][] = [
  [[50, 50]],                                                          // 1
  [[28, 28], [72, 72]],                                                // 2
  [[28, 28], [50, 50], [72, 72]],                                      // 3
  [[28, 28], [72, 28], [28, 72], [72, 72]],                            // 4
  [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],                  // 5
  [[28, 28], [72, 28], [28, 50], [72, 50], [28, 72], [72, 72]],        // 6
];

function DiceFace({ value, size = 80, rolling = false }: { value: number | null; size?: number; rolling?: boolean }) {
  if (value === null) {
    // Prázdná kostka před prvním hodem
    return (
      <svg width={size} height={size} viewBox="0 0 100 100" style={{ filter: "drop-shadow(0 3px 6px rgba(0,0,0,0.12))" }}>
        <rect x="6" y="6" width="88" height="88" rx="18" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="3"/>
      </svg>
    );
  }
  const dots = DICE_DOTS[(value - 1 + 6) % 6];
  return (
    <svg
      width={size} height={size} viewBox="0 0 100 100"
      className={rolling ? "animate-spin" : "transition-transform duration-150"}
      style={{ filter: "drop-shadow(0 3px 8px rgba(0,0,0,0.18))" }}
    >
      <rect x="6" y="6" width="88" height="88" rx="18" fill="white" stroke="#e2e8f0" strokeWidth="2.5"/>
      {/* Lehký 3D highlight */}
      <rect x="6" y="6" width="88" height="44" rx="18" fill="rgba(255,255,255,0.55)"/>
      {dots.map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="9" fill="#1e293b"/>
      ))}
    </svg>
  );
}

// Pozice figurek — každé pole posunuté o ~10 % směrem ke středu desky (50 %, 50 %)
const FIGURINE_POSITIONS: React.CSSProperties[] = FIELD_POSITIONS.map((pos) => {
  const left = parseFloat(pos.left as string);
  const top  = parseFloat(pos.top  as string);
  const dx = 50 - left;
  const dy = 50 - top;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const offset = 10; // % směrem ke středu
  return {
    left: `${left + (dx / len) * offset}%`,
    top:  `${top  + (dy / len) * offset}%`,
    transform: "translate(-50%, -50%)",
  };
});

// ─── Komponenta ───────────────────────────────────────────────────────────────

interface Props {
  gameCode?: string;
}

export default function GameBoard({ gameCode }: Props) {
  const [gameId, setGameId] = React.useState<string | null>(null);
  const [themeId, setThemeId] = React.useState<string>("horse-day");
  const [boardId, setBoardId] = React.useState<string>("small");
  const [gameMode, setGameMode] = React.useState<"online" | "local">("online");
  const [isHost, setIsHost] = React.useState(false);
  const [gameStatus, setGameStatus] = React.useState<string>("playing");
  const [players, setPlayers] = React.useState<Player[]>([]);
  const [gameState, setGameState] = React.useState<GameState | null>(null);
  const [loading, setLoading] = React.useState(!!gameCode);
  const [pendingRacer, setPendingRacer] = React.useState<{ racer: Horse; playerIndex: number } | null>(null);
  const [pendingCard, setPendingCard] = React.useState<{ card: GameCard; playerIndex: number } | null>(null);
  const cardAppliedRef = React.useRef<string | null>(null);
  const [pendingOffer, setPendingOffer] = React.useState<RerollOffer | null>(null);
  const [canReroll, setCanReroll] = React.useState(false);
  // Ochrana: klíč nabídky, kterou jsme už potvrdili — zabrání dvojímu spuštění
  const offerAcceptedRef = React.useRef<string | null>(null);
  const raceSubmittedRef = React.useRef<string | null>(null);
  const selectionSubmittedRef = React.useRef<string | null>(null);
  const pendingRaceScoreRef = React.useRef<string | null>(null);
  const [countdownNum, setCountdownNum] = React.useState<number | null>(null);
  const [myPlayerId, setMyPlayerId] = React.useState<string | null>(null);
  const [viewerRole, setViewerRole] = React.useState<"loading" | "player" | "spectator" | "login_required">("loading");
  const [isRolling, setIsRolling] = React.useState(false);
  const [isMoving, setIsMoving] = React.useState(false);
  const [displayRoll, setDisplayRoll] = React.useState<number | null>(null);
  const [animPosition, setAnimPosition] = React.useState<number | null>(null);
  const [animatingPlayerIdx, setAnimatingPlayerIdx] = React.useState<number | null>(null);
  const [trailFields, setTrailFields] = React.useState<number[]>([]);
  const [hoveredPlayerId, setHoveredPlayerId] = React.useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = React.useState(true);
  const audioCtxRef = React.useRef<AudioContext | null>(null);
  const soundEnabledRef = React.useRef(true);
  // Refs pro ochranu animace před Realtime přepsáním pozice
  const animatingPlayerIdRef = React.useRef<string | null>(null);
  const animPositionRef = React.useRef<number | null>(null);

  const [boardBgUrl, setBoardBgUrl] = React.useState<string>("");

  React.useEffect(() => {
    let cancelled = false;
    loadThemeManifestAsync(themeId).then((manifest) => {
      if (!cancelled) {
        const bgUrl = manifest.assets?.boardBackgroundImage ?? "";
        setBoardBgUrl(bgUrl);
        console.log(`[GameBoard] theme="${themeId}" boardBgUrl="${bgUrl || "none"}"`);
      }
    });
    return () => { cancelled = true; };
  }, [themeId]);

  // Theme + FIELDS — odvozeno ze stavu themeId/boardId, aktualizuje se při každém renderu
  const theme = getThemeById(themeId);
  const board = getBoardById(boardId);
  const FIELDS = buildFields(board, getThemeRacers(theme));
  // Ref aby stale closures (Realtime subscriptions) vždy dostaly aktuální FIELDS
  const fieldsRef = React.useRef<Field[]>(FIELDS);
  fieldsRef.current = FIELDS;

  // Načti preference zvuku z localStorage
  React.useEffect(() => {
    const stored = localStorage.getItem("paytowin_sound");
    const enabled = stored !== "off";
    setSoundEnabled(enabled);
    soundEnabledRef.current = enabled;
  }, []);

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    soundEnabledRef.current = next;
    localStorage.setItem("paytowin_sound", next ? "on" : "off");
  };

  const playStepSound = React.useCallback(() => {
    if (!soundEnabledRef.current) return;
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
      const ctx = audioCtxRef.current;
      // Krátký perkusivní klik — filtrovaný šum
      const bufferSize = Math.floor(ctx.sampleRate * 0.04);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 5);
      }
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = 1400;
      filter.Q.value = 0.6;
      const gain = ctx.createGain();
      gain.gain.value = 0.35;
      source.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      source.start();
    } catch {
      // AudioContext nedostupný (SSR, blokovaný prohlížečem)
    }
  }, []);

  // ── Načtení hry ze Supabase ──────────────────────────────────────────────────
  React.useEffect(() => {
    if (!gameCode) return;

    const loadGame = async () => {
      const { data: game } = await supabase
        .from("games")
        .select()
        .eq("code", gameCode)
        .single();

      if (!game) { setLoading(false); return; }
      setGameId(game.id);
      setThemeId(game.theme_id ?? "horse-day");
      setBoardId(game.board_id ?? "small");
      setGameMode((game.game_mode ?? "online") as "online" | "local");
      setGameStatus(game.status);

      const { data: { user } } = await supabase.auth.getUser();
      const myDiscordId = user?.user_metadata?.provider_id as string | undefined;

      const pid = localStorage.getItem(`paytowin_player_${gameCode}`);
      setMyPlayerId(pid);

      // Urči roli: hráč / pozorovatel / nepřihlášen
      if (pid) {
        setViewerRole("player");
      } else {
        setViewerRole(myDiscordId ? "spectator" : "login_required");
      }

      // Host detekce: Discord ID musí souhlasit s owner_discord_id hry
      if (myDiscordId && game.owner_discord_id && myDiscordId === game.owner_discord_id) {
        setIsHost(true);
      }

      await refreshGame(game.id);
      setLoading(false);

      if (game.status === "waiting") {
        await supabase.from("games").update({ status: "playing" }).eq("id", game.id);
      }
    };

    loadGame();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameCode]);

  const refreshGame = async (id: string) => {
    const [{ data: playersData }, { data: stateData }] = await Promise.all([
      supabase.from("players").select().eq("game_id", id).order("turn_order"),
      supabase.from("game_state").select().eq("game_id", id).single(),
    ]);
    let normalized = (playersData ?? []).map(normalizePlayer);

    // Pojistka: pokud právě animujeme pohyb, nepřepíše Realtime pozici animující figurky
    // (stale closure v Realtime handleru by jinak skočila zpět na DB pozici)
    if (animatingPlayerIdRef.current !== null && animPositionRef.current !== null) {
      normalized = normalized.map(p => {
        if (p.id !== animatingPlayerIdRef.current) return p;
        if (p.position !== animPositionRef.current) {
          console.log(`[turn-flow] refreshGame guard active — DB pos=${p.position} overridden with anim pos=${animPositionRef.current}`);
        }
        return { ...p, position: animPositionRef.current! };
      });
    }

    setPlayers(normalized);
    if (stateData) setGameState(normalizeState(stateData));
    return { players: normalized, state: stateData ? normalizeState(stateData) : null };
  };

  // ── Realtime subscriptions ───────────────────────────────────────────────────
  React.useEffect(() => {
    if (!gameId) return;

    const channel = supabase
      .channel(`game:${gameId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "games", filter: `id=eq.${gameId}` },
        (payload) => {
          const updated = payload.new as { status?: string };
          if (updated.status) setGameStatus(updated.status);
        }
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "players", filter: `game_id=eq.${gameId}` },
        () => { refreshGame(gameId); }
      )
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "game_state", filter: `game_id=eq.${gameId}` },
        async () => {
          const { players: freshPlayers, state: freshState } = await refreshGame(gameId);
          if (!freshState) return;
          // horse_pending v DB je jediný zdroj pravdy — žádné hádání indexů
          if (freshState.horse_pending) {
            const currentP = freshPlayers[freshState.current_player_index];
            const field = currentP ? fieldsRef.current[currentP.position] : null;
            if (field?.type === "racer" && field.racer) {
              setPendingRacer({ racer: field.racer, playerIndex: freshState.current_player_index });
            }
          } else {
            setPendingRacer(null);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]);

  // ── Herní akce ────────────────────────────────────────────────────────────────

  const rollDice = async () => {
    const activePendingRace = gameState?.offer_pending?.type === "race" ? gameState.offer_pending as RaceOffer : null;
    const activePendingBankrupt = gameState?.offer_pending?.type === "bankrupt_announcement";
    const activePendingRacePlaceholder = gameState?.offer_pending?.type === "race_pending";
    if (!gameState || pendingRacer || pendingCard || pendingOffer || activePendingRace || activePendingBankrupt || activePendingRacePlaceholder || isRolling || isMoving) return;

    const roll = Math.floor(Math.random() * 6) + 1;
    const currentPlayer = players[gameState.current_player_index];
    if (!currentPlayer) return;

    console.log(`[turn-flow] roll start — player="${currentPlayer.name}" pos=${currentPlayer.position} roll=${roll}`);

    // ── 1. Animace kostky ─────────────────────────────────────────────────────
    setIsRolling(true);
    setDisplayRoll(null);
    const animDuration = 800 + Math.random() * 400;
    const start = Date.now();
    while (Date.now() - start < animDuration) {
      setDisplayRoll(Math.floor(Math.random() * 6) + 1);
      await sleep(80);
    }
    setDisplayRoll(roll);
    await sleep(300);
    setIsRolling(false);

    // ── 2. Animace pohybu pole po poli ────────────────────────────────────────
    const oldPosition = currentPlayer.position;
    const fieldCount = FIELDS.length;
    const newPosition = (oldPosition + roll) % fieldCount;

    setIsMoving(true);
    setAnimatingPlayerIdx(gameState.current_player_index);
    setAnimPosition(oldPosition);
    setTrailFields([]);
    // Nastav refs — refreshGame je bude číst i ze stale closure v Realtime handleru
    animatingPlayerIdRef.current = currentPlayer.id;
    animPositionRef.current = oldPosition;

    const trail: number[] = [];
    for (let step = 1; step <= roll; step++) {
      const pos = (oldPosition + step) % fieldCount;
      trail.push(pos);
      setAnimPosition(pos);
      animPositionRef.current = pos;
      setTrailFields([...trail]);
      playStepSound();
      await sleep(500);
    }

    setIsMoving(false);
    // animatingPlayerIdx necháme nastavený až po zápisu do DB — jinak figurka
    // problikne na starou pozici (player.position v DB ještě není aktualizované)

    console.log(`[turn-flow] animation done — targetPos=${newPosition} field="${FIELDS[newPosition]?.type}"`);

    // ── 3. Herní logika + zápis do Supabase ───────────────────────────────────
    const field = FIELDS[newPosition];
    const newLog = gameState.log ?? [];
    const newTurnCount = gameState.turn_count + 1;
    const currentRound = Math.floor(gameState.turn_count / Math.max(1, players.length));

    // Průchod STARTem bez přistání (přeskočení pole 0)
    const passedStart = newPosition !== 0 && (oldPosition + roll) >= fieldCount;

    let movedPlayer = { ...currentPlayer, position: newPosition };
    const extraLog: string[] = [];

    if (passedStart) {
      movedPlayer = { ...movedPlayer, coins: movedPlayer.coins + 200 };
      extraLog.push(`${currentPlayer.name} prošel STARTem — +200 💰`);
    }

    // Daň za průchod/přistání na STARTu — roste každé kolo, od kola 2
    const startTax = getStartTax(currentRound);
    if (startTax > 0 && (passedStart || newPosition === 0)) {
      movedPlayer = { ...movedPlayer, coins: movedPlayer.coins - startTax };
      extraLog.push(`${currentPlayer.name}: Daň za průchod STARTem — -${startTax} 💰`);
    }

    if (field.type === "racer" && field.racer) {
      const alreadyOwned = playerOwnsRacer(movedPlayer, field.racer);
      // Vlastník = jiný hráč který má tohoto racera — id-first, name fallback pro stará data
      const ownerPlayer = players.find(
        p => p.id !== currentPlayer.id && playerOwnsRacer(p, field.racer!)
      );
      const lookupSource = (field.racer.id && ownerPlayer?.horses.some(h => h.id)) ? "id" : "name";
      console.log(`[racer-rent] owner lookup via ${lookupSource} for racer "${field.racer.name}" (id=${field.racer.id ?? "none"}) — owner=${ownerPlayer?.name ?? "none"}`);

      if (alreadyOwned) {
        // Hráč tohoto závodníka už vlastní — přeskočíme nabídku, pokračujeme normálně
        console.log(`[racer-rent] ${currentPlayer.name} landed on own racer "${field.racer.name}" — no rent`);
        const logLines = [`${currentPlayer.name} přijel ke své stáji: ${field.racer.emoji} ${field.racer.name}`, ...extraLog];
        const updatedPlayers = players.map((p, i) =>
          i === gameState.current_player_index ? movedPlayer : p
        );
        const nextIndex = getNextActiveIndex(gameState.current_player_index, updatedPlayers);
        await supabase.from("players").update({ position: newPosition, coins: movedPlayer.coins }).eq("id", currentPlayer.id);
        await finishTurn({ nextIndex, turnCount: newTurnCount, log: [...logLines, ...newLog], lastRoll: roll });
      } else if (ownerPlayer) {
        if (canTriggerRivalsRace(movedPlayer, ownerPlayer)) {
          // ── Rivals race: oba hráči mají závodníky → duel místo rentu ──────────
          const reward = Math.round(field.racer.price * 0.2);
          const logLines = [`⚔️ ${currentPlayer.name} vstoupil na stáj ${ownerPlayer.name} — čeká je souboj!`, ...extraLog];
          const updatedPlayersForNext = players.map(p => p.id === currentPlayer.id ? movedPlayer : p);
          const nextIndex = getNextActiveIndex(gameState.current_player_index, updatedPlayersForNext);
          await supabase.from("players").update({ position: newPosition, coins: movedPlayer.coins }).eq("id", currentPlayer.id);
          await finishTurn({
            nextIndex, turnCount: newTurnCount, log: [...logLines, ...newLog], lastRoll: roll,
            postTurnEvent: { kind: "race_pending", raceType: "rivals_race", playerIds: [currentPlayer.id, ownerPlayer.id], reward },
          });
        } else {
          // ── Rent fallback: jeden nebo oba hráči nemají závodníka ──────────────
          const rent = Math.round(field.racer.price * 0.2);
          const rentedPlayer = { ...movedPlayer, coins: movedPlayer.coins - rent };
          const paidOwner = { ...ownerPlayer, coins: ownerPlayer.coins + rent };

          console.log(`[racer-rent] ${currentPlayer.name} (id=${currentPlayer.id}) landed on "${field.racer.name}" (racer.id=${field.racer.id ?? "none"}) owned by ${ownerPlayer.name} (id=${ownerPlayer.id}) → rent=${rent}`);
          console.log(`[racer-rent] transfer: ${currentPlayer.name} ${movedPlayer.coins}→${rentedPlayer.coins}, ${ownerPlayer.name} ${ownerPlayer.coins}→${paidOwner.coins}`);

          const wentBankrupt = rentedPlayer.coins <= 0 && currentPlayer.coins > 0;
          const logLines = [
            `${currentPlayer.name} zaplatil ${rent} 💰 hráči ${ownerPlayer.name} za ${field.racer.emoji} ${field.racer.name}`,
            ...extraLog,
          ];
          if (wentBankrupt) {
            logLines.push(`💀 ${rentedPlayer.name} zkrachoval!`);
            console.log(`[racer-rent] ${rentedPlayer.name} went bankrupt after paying rent`);
          }

          const updatedPlayers = players.map(p => {
            if (p.id === rentedPlayer.id) return rentedPlayer;
            if (p.id === paidOwner.id) return paidOwner;
            return p;
          });
          const nextIndex = getNextActiveIndex(gameState.current_player_index, updatedPlayers);

          // Oba hráči se aktualizují najednou; game_state až potom
          const activeAfterRent = updatedPlayers.filter(p => !isBankrupt(p));
          const rentGameEnds = (updatedPlayers.length >= 2 && activeAfterRent.length === 1) ||
                               (updatedPlayers.length === 1 && activeAfterRent.length === 0);

          await Promise.all([
            supabase.from("players").update({ position: rentedPlayer.position, coins: rentedPlayer.coins }).eq("id", rentedPlayer.id),
            supabase.from("players").update({ coins: paidOwner.coins }).eq("id", paidOwner.id),
          ]);
          await finishTurn({
            nextIndex, turnCount: newTurnCount, log: [...logLines, ...newLog], lastRoll: roll,
            ...(wentBankrupt && !rentGameEnds ? { postTurnEvent: { kind: "announcement" as const, playerId: rentedPlayer.id, playerName: rentedPlayer.name } } : {}),
          });

          if (wentBankrupt) await checkAndFinishGame(updatedPlayers);
        }
      } else {
        // Čekáme na rozhodnutí hráče. horse_pending = true v DB (DB sloupec zachován).
        await supabase.from("players").update({ position: newPosition, coins: movedPlayer.coins }).eq("id", currentPlayer.id);
        await supabase.from("game_state").update({
          last_roll: roll,
          turn_count: newTurnCount,
          horse_pending: true,
          card_pending: null,
          log: [`${currentPlayer.name} přišel na stáj: ${field.racer.emoji} ${field.racer.name}`, ...extraLog, ...newLog].slice(0, 20),
        }).eq("game_id", gameId);
        setPendingRacer({ racer: field.racer, playerIndex: gameState.current_player_index });
      }
    } else if (field.type === "chance" || field.type === "finance") {
      // ── Karta: lízni, zobraz všem, efekt se aplikuje automaticky po 2.5 s ──
      const card = drawCard(field.type, theme.content?.cards);
      const cardLabel = field.type === "chance" ? "🎴 Náhoda" : "💼 Finance";
      // FIX pořadí: nejdřív uložíme finální pozici hráče, pak card_pending.
      // applyCardEffect poběží ze stale closure (timer 2.5s) — position musí být
      // v DB stabilní předtím, než se karta aplikuje.
      console.log(`[turn-flow] card field — persisting position=${newPosition} before card_pending`);
      await supabase.from("players").update({ position: newPosition, coins: movedPlayer.coins }).eq("id", currentPlayer.id);
      console.log(`[turn-flow] card_pending set — card="${card.id}" kind="${card.effect.kind}"`);
      await supabase.from("game_state").update({
        last_roll: roll,
        turn_count: newTurnCount,
        horse_pending: false,
        card_pending: card as unknown as Record<string, unknown>,
        log: [`${currentPlayer.name} lízl kartu ${cardLabel}`, ...extraLog, ...newLog].slice(0, 20),
      }).eq("game_id", gameId);
      // Lokální state — ostatní klienti dostanou přes Realtime
      setPendingCard({ card, playerIndex: gameState.current_player_index });
    } else {
      const { player: afterField, log: fieldLog } = field.action(movedPlayer);
      const finalPlayer = afterField;
      const logLines = [...(fieldLog ? [fieldLog] : []), ...extraLog];

      // Bankrot? — nextIndex počítáme s AKTUALIZOVANÝM hráčem, aby se přeskočil i sám sebe pokud zkrachoval
      const wentBankrupt = finalPlayer.coins <= 0 && currentPlayer.coins > 0;
      if (wentBankrupt) logLines.push(`💀 ${finalPlayer.name} zkrachoval!`);

      const updatedPlayers = players.map((p, i) =>
        i === gameState.current_player_index ? finalPlayer : p
      );
      const nextIndex = getNextActiveIndex(gameState.current_player_index, updatedPlayers);

      // Hráč aktualizován vždy (pozice, coins, koně)
      console.log(`[turn-flow] normal field persist — pos=${finalPlayer.position} coins=${finalPlayer.coins} wentBankrupt=${wentBankrupt}`);
      await supabase.from("players").update({ position: finalPlayer.position, coins: finalPlayer.coins, horses: finalPlayer.horses }).eq("id", currentPlayer.id);

      // Nabídka rerollu: 25 % šance, jen pokud nešel do bankrotu a nejde o reroll
      const triggerOffer = !canReroll && !wentBankrupt && Math.random() < REROLL_CHANCE;

      const activeAfterNormal = updatedPlayers.filter(p => !isBankrupt(p));
      const normalGameEnds = (updatedPlayers.length >= 2 && activeAfterNormal.length === 1) ||
                             (updatedPlayers.length === 1 && activeAfterNormal.length === 0);

      if (triggerOffer) {
        const offer: OfferPending = { type: "reroll", playerId: currentPlayer.id, playerName: currentPlayer.name, cost: REROLL_COST };
        await supabase.from("game_state").update({
          last_roll: roll,
          horse_pending: false,
          card_pending: null,
          offer_pending: offer as unknown as Record<string, unknown>,
          log: [...logLines, `💡 Speciální nabídka pro ${currentPlayer.name}!`, ...newLog].slice(0, 20),
        }).eq("game_id", gameId);
        setPendingOffer(offer);
      } else {
        await finishTurn({
          nextIndex, turnCount: newTurnCount, log: [...logLines, ...newLog], lastRoll: roll,
          ...(wentBankrupt && !normalGameEnds ? { postTurnEvent: { kind: "announcement" as const, playerId: finalPlayer.id, playerName: finalPlayer.name } } : {}),
        });
        if (canReroll) setCanReroll(false);
      }

      if (wentBankrupt) await checkAndFinishGame(updatedPlayers);
    }

    // ── 4. Vyčisti animační stav, stopa zmizí po 1,5 s ──────────────────────
    // Optimistický update pozice: nastav newPosition lokálně PŘED vymazáním refs.
    // Bez toho by displayPlayers přepnulo zpět na starý players[i].position
    // (Realtime refreshGame ještě nedorazil) a figurka by problikla zpět.
    // Nová pozice je ve všech větvích zapsána do DB dřív, než sem dorazíme,
    // takže optimistický update je konzistentní s DB stavem.
    setPlayers(prev => prev.map(p =>
      p.id === currentPlayer.id ? { ...p, position: newPosition } : p
    ));
    setAnimatingPlayerIdx(null);
    animatingPlayerIdRef.current = null;
    animPositionRef.current = null;
    setTimeout(() => setTrailFields([]), 1500);
  };

  /**
   * Vrátí true pokud všichni aktivní hráči vlastní ≥1 racera — trigger pro závod.
   * Voláno jen v buyRacer, protože ownership se mění pouze nákupem.
   */
  const shouldTriggerRacePending = (updatedPlayers: Player[]): boolean => {
    if (gameStatus !== "playing") return false;
    if (gameState?.mass_race_done) return false; // mass race už proběhl, nepouštět znovu
    const activePlayers = updatedPlayers.filter(p => !isBankrupt(p));
    if (activePlayers.length < 2) return false;
    return activePlayers.every(p => p.horses.length > 0);
  };

  const buyRacer = async () => {
    if (!pendingRacer || !gameState) return;
    const { racer, playerIndex } = pendingRacer;
    const player = players[playerIndex];
    if (!player || player.coins < racer.price) return;
    if (playerOwnsRacer(player, racer)) return; // pojistka: už vlastní (id-first)

    const updatedCoins = player.coins - racer.price;
    const updatedHorses = [...player.horses, racer];
    const newLog = gameState.log ?? [];
    const newTurnCount = gameState.turn_count + 1;

    const wentBankrupt = updatedCoins <= 0;
    const logLines = [`${player.name} koupil ${racer.emoji} ${racer.name} za ${racer.price} 💰`];
    if (wentBankrupt) logLines.push(`💀 ${player.name} zkrachoval!`);

    // Zahrnuje nové koně — race trigger potřebuje vidět aktuální ownership
    const updatedPlayers = players.map((p, i) =>
      i === playerIndex ? { ...player, coins: updatedCoins, horses: updatedHorses } : p
    );
    const nextIndex = getNextActiveIndex(playerIndex, updatedPlayers);

    const activeAfterBuy = updatedPlayers.filter(p => !isBankrupt(p));
    const buyGameEnds = (updatedPlayers.length >= 2 && activeAfterBuy.length === 1) ||
                        (updatedPlayers.length === 1 && activeAfterBuy.length === 0);

    // Priorita: bankrot announcement > race trigger
    let postTurnEvent: PostTurnEvent | undefined;
    if (wentBankrupt && !buyGameEnds) {
      postTurnEvent = { kind: "announcement" as const, playerId: player.id, playerName: player.name };
    } else if (shouldTriggerRacePending(updatedPlayers)) {
      postTurnEvent = { kind: "race_pending" as const, playerIds: activeAfterBuy.map(p => p.id) };
      logLines.push("🏁 Závod se připravuje!");
    }

    await supabase.from("players").update({ coins: updatedCoins, horses: updatedHorses }).eq("id", player.id);
    await finishTurn({
      nextIndex, turnCount: newTurnCount, log: [...logLines, ...newLog],
      ...(postTurnEvent ? { postTurnEvent } : {}),
    });

    if (wentBankrupt) await checkAndFinishGame(updatedPlayers);
    setPendingRacer(null);
  };

  // Označí jednoho koně jako preferred (ostatní se odznačí); racerKey=null = zrušit výběr
  const setPreferredRacer = async (playerId: string, racerKey: string | null) => {
    const player = players.find(p => p.id === playerId);
    if (!player) return;
    const updatedHorses = player.horses.map(h => ({
      ...h,
      isPreferred: racerKey !== null && racerOwnershipKey(h) === racerKey,
    }));
    await supabase.from("players").update({ horses: updatedHorses }).eq("id", playerId);
  };

  const skipRacer = async () => {
    if (!pendingRacer || !gameState) return;
    const player = players[pendingRacer.playerIndex];
    const nextIndex = getNextActiveIndex(pendingRacer.playerIndex, players);
    const newLog = gameState.log ?? [];

    await finishTurn({
      nextIndex,
      turnCount: gameState.turn_count + 1,
      log: [`${player?.name ?? "?"} přeskočil nákup`, ...newLog],
    });

    setPendingRacer(null);
  };

  // ── Nabídka rerollu ───────────────────────────────────────────────────────────

  const acceptOffer = async () => {
    if (!pendingOffer || !gameState || !gameId) return;
    // Ochrana: tato nabídka už byla potvrzena
    const key = pendingOffer.playerId + "_" + gameState.turn_count;
    if (offerAcceptedRef.current === key) return;
    offerAcceptedRef.current = key;

    const player = players.find(p => p.id === pendingOffer.playerId);
    if (!player || player.coins < pendingOffer.cost) return;

    const newLog = gameState.log ?? [];
    await supabase.from("players").update({ coins: player.coins - pendingOffer.cost }).eq("id", player.id);
    await supabase.from("game_state").update({
      offer_pending: null,
      log: [`${player.name} zaplatil ${pendingOffer.cost} 💰 za druhý hod`, ...newLog].slice(0, 20),
    }).eq("game_id", gameId);

    setCanReroll(true);
    setPendingOffer(null);
  };

  const declineOffer = async () => {
    if (!pendingOffer || !gameState || !gameId) return;
    const newLog = gameState.log ?? [];
    const nextIndex = getNextActiveIndex(gameState.current_player_index, players);
    await finishTurn({
      nextIndex,
      turnCount: gameState.turn_count + 1,
      log: [`${pendingOffer.playerName} odmítl nabídku`, ...newLog],
    });

    setPendingOffer(null);
  };

  // ── Efekt karty ──────────────────────────────────────────────────────────────

  /**
   * Aplikuje efekt karty — volá POUZE aktivní hráčův klient (isMyTurn).
   * Ochrana cardAppliedRef zabrání dvojímu spuštění při re-renderu.
   *
   * FIX: playerUpdate záměrně NEobsahuje position pro coins/skip_turn karty.
   * Důvod: applyCardEffect může být zavolán ze stale closure timeru (2.5s),
   * kdy players state ještě nemá Realtime-aktualizovanou pozici po tahu.
   * Zápis stale position by resetoval figurku zpět.
   * Position se ukládá pouze tehdy, kdy ji karta skutečně mění (kind==="move").
   */
  const applyCardEffect = React.useCallback(async (card: GameCard, playerIndex: number) => {
    if (!gameState || !gameId) return;
    // Ochrana: karta tohoto ID už byla aplikována
    if (cardAppliedRef.current === card.id + "_" + gameState.turn_count) return;
    cardAppliedRef.current = card.id + "_" + gameState.turn_count;

    const player = players[playerIndex];
    if (!player) return;

    console.log(`[turn-flow] applyCardEffect start — player="${player.name}" pos=${player.position} card="${card.id}" kind="${card.effect.kind}"`);

    let updatedPlayer = { ...player };
    const logLines: string[] = [];
    const newLog = gameState.log ?? [];

    if (card.effect.kind === "coins" && card.effect.value !== undefined) {
      updatedPlayer = { ...updatedPlayer, coins: updatedPlayer.coins + card.effect.value };
      const sign = card.effect.value > 0 ? "+" : "";
      logLines.push(`${player.name}: ${card.text} (${sign}${card.effect.value} 💰)`);
    } else if (card.effect.kind === "move" && card.effect.value !== undefined) {
      const fc = fieldsRef.current.length;
      const newPos = ((updatedPlayer.position + card.effect.value) % fc + fc) % fc;
      console.log(`[turn-flow] card move: from pos=${updatedPlayer.position} by ${card.effect.value} → pos=${newPos}`);
      updatedPlayer = { ...updatedPlayer, position: newPos };
      const sign = card.effect.value > 0 ? "+" : "";
      logLines.push(`${player.name}: ${card.text} (posun ${sign}${card.effect.value})`);
    } else if (card.effect.kind === "skip_turn") {
      // skip_next_turn uložíme do DB — bude přeskočen při příštím tahu
      logLines.push(`${player.name}: ${card.text} (vynechá příští tah)`);
    }

    const wentBankrupt = updatedPlayer.coins <= 0 && player.coins > 0;
    if (wentBankrupt) logLines.push(`💀 ${player.name} zkrachoval!`);

    // FIX: position do DB jen pokud ji karta skutečně změnila (kind==="move").
    // Coins a skip_turn karty pozici nemění — záměrně ji nezapisujeme,
    // aby se nepřepsala správná pozice z rollDice (která mohla být v closure stale).
    const playerUpdate: Record<string, unknown> = { coins: updatedPlayer.coins };
    if (card.effect.kind === "move") playerUpdate.position = updatedPlayer.position;
    if (card.effect.kind === "skip_turn") playerUpdate.skip_next_turn = true;

    console.log(`[turn-flow] applyCardEffect persisting — pos=${updatedPlayer.position} coins=${updatedPlayer.coins} wentBankrupt=${wentBankrupt}`);
    await supabase.from("players").update(playerUpdate).eq("id", player.id);

    // Urči dalšího hráče
    const updatedPlayers = players.map((p, i) => i === playerIndex ? updatedPlayer : p);
    const nextIndex = getNextActiveIndex(playerIndex, updatedPlayers);

    const activeAfterCard = updatedPlayers.filter(p => !isBankrupt(p));
    const cardGameEnds = (updatedPlayers.length >= 2 && activeAfterCard.length === 1) ||
                         (updatedPlayers.length === 1 && activeAfterCard.length === 0);

    await finishTurn({
      nextIndex, turnCount: gameState.turn_count + 1, log: [...logLines, ...newLog],
      ...(wentBankrupt && !cardGameEnds ? { postTurnEvent: { kind: "announcement" as const, playerId: updatedPlayer.id, playerName: updatedPlayer.name } } : {}),
    });

    if (wentBankrupt) await checkAndFinishGame(updatedPlayers);
    setPendingCard(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState, players, gameId]);

  // Ref vždy ukazuje na nejnovější verzi applyCardEffect.
  // Timer v useEffect níže zachytí closure — bez ref by volal stale verzi
  // (players state nemusí mít aktualizovanou pozici v době setPendingCard).
  const applyCardEffectRef = React.useRef(applyCardEffect);
  React.useEffect(() => { applyCardEffectRef.current = applyCardEffect; });

  // Automaticky aplikuj efekt karty po 2.5 s — jen aktivní hráčův klient
  React.useEffect(() => {
    if (!pendingCard) return;
    const isActivePlayerClient =
      gameMode === "local"
        ? true // local: aktuální hráč vždy u zařízení
        : (myPlayerId && players[pendingCard.playerIndex]?.id === myPlayerId);
    if (!isActivePlayerClient) return;

    console.log(`[turn-flow] card pending timer start — card="${pendingCard.card.id}" kind="${pendingCard.card.effect.kind}"`);
    const timer = setTimeout(() => {
      console.log(`[turn-flow] card timer fired — calling applyCardEffect`);
      applyCardEffectRef.current(pendingCard.card, pendingCard.playerIndex);
    }, 2500);

    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingCard?.card.id, pendingCard?.playerIndex]);

  const cancelGame = async () => {
    if (!gameId) return;
    if (!window.confirm("Opravdu chceš zrušit hru? Ostatní hráči ji ztratí.")) return;
    const { error } = await supabase.from("games").update({ status: "cancelled" }).eq("id", gameId);
    if (error) {
      alert(`Nepodařilo se zrušit hru: ${error.message}`);
      return;
    }
    setGameStatus("cancelled");
  };

  // ── Post-turn hook ────────────────────────────────────────────────────────────

  /**
   * finishTurn — centralizuje posun na dalšího hráče po dokončení tahu.
   *
   * Volají všechny handlery, které ukončují tah:
   *   rollDice (normální pole, racer rent, racer own),
   *   buyRacer, skipRacer, declineOffer, applyCardEffect.
   *
   * ┌──────────────────────────────────────────────────────────────────────────┐
   * │  POST-TURN HOOK                                                          │
   * │  Volitelný postTurnEvent (PostTurnEvent) před dalším tahem:              │
   * │    kind="announcement" → zapíše BankruptAnnouncement do offer_pending,  │
   * │      všichni klienti zobrazí overlay, triggerer auto-advance za 3 s.    │
   * │                                                                          │
   * │  Budoucí rozšíření: přidej nový kind do PostTurnEvent a větev sem.      │
   * │    Příklad: kind="race_pending" → spustí závod před dalším tahem.       │
   * └──────────────────────────────────────────────────────────────────────────┘
   */
  const finishTurn = async (params: {
    nextIndex: number;
    turnCount: number;
    log: string[];
    lastRoll?: number;
    postTurnEvent?: PostTurnEvent;
  }) => {
    if (!gameId) return;

    // POST-TURN HOOK — dispatch podle kind
    if (params.postTurnEvent?.kind === "announcement") {
      const announcement: BankruptAnnouncement = {
        type: "bankrupt_announcement",
        playerName: params.postTurnEvent.playerName,
        playerId: params.postTurnEvent.playerId,
        nextIndex: params.nextIndex,
        turnCount: params.turnCount,
        ...(params.lastRoll !== undefined ? { lastRoll: params.lastRoll } : {}),
      };
      const announcementUpdate: Record<string, unknown> = {
        horse_pending: false,
        card_pending: null,
        offer_pending: announcement as unknown as Record<string, unknown>,
        log: params.log.slice(0, 20),
      };
      if (params.lastRoll !== undefined) announcementUpdate.last_roll = params.lastRoll;
      await supabase.from("game_state").update(announcementUpdate).eq("game_id", gameId);
      return;
    }

    // POST-TURN HOOK — race_pending: sekvenční výběr závodníků
    if (params.postTurnEvent?.kind === "race_pending") {
      const raceEvtParam = params.postTurnEvent as { kind: "race_pending"; playerIds: string[]; raceType?: RaceType; reward?: number };
      const evt: RacePendingEvent = {
        type: "race_pending",
        raceType: raceEvtParam.raceType ?? "mass_race",
        nextIndex: params.nextIndex,
        turnCount: params.turnCount,
        playerIds: raceEvtParam.playerIds,
        currentSelectorIndex: 0,
        selections: {},
        ...(params.lastRoll !== undefined ? { lastRoll: params.lastRoll } : {}),
        ...(raceEvtParam.reward !== undefined ? { reward: raceEvtParam.reward } : {}),
      };
      const evtUpdate: Record<string, unknown> = {
        horse_pending: false,
        card_pending: null,
        offer_pending: evt as unknown as Record<string, unknown>,
        log: params.log.slice(0, 20),
      };
      if (params.lastRoll !== undefined) evtUpdate.last_roll = params.lastRoll;
      await supabase.from("game_state").update(evtUpdate).eq("game_id", gameId);
      return;
    }

    const update: Record<string, unknown> = {
      current_player_index: params.nextIndex,
      turn_count: params.turnCount,
      horse_pending: false,
      card_pending: null,
      offer_pending: null,
      log: params.log.slice(0, 20),
    };
    if (params.lastRoll !== undefined) update.last_roll = params.lastRoll;

    // Regen staminy pro aktuálního hráče (+10 za tah, max 100)
    const playerForRegen = gameState ? players[gameState.current_player_index] : null;
    const regenHorses = playerForRegen?.horses?.length
      ? playerForRegen.horses.map(h => ({ ...h, stamina: Math.min(100, (h.stamina ?? 100) + 10) }))
      : null;
    await Promise.all([
      supabase.from("game_state").update(update).eq("game_id", gameId),
      ...(regenHorses
        ? [supabase.from("players").update({ horses: regenHorses }).eq("id", playerForRegen!.id)]
        : []),
    ]);
  };

  const closeBankruptAnnouncement = async () => {
    if (!gameId || !gameState) return;
    const ann = gameState.offer_pending?.type === "bankrupt_announcement"
      ? gameState.offer_pending as BankruptAnnouncement
      : null;
    if (!ann) return;
    const update: Record<string, unknown> = {
      current_player_index: ann.nextIndex,
      turn_count: ann.turnCount,
      offer_pending: null,
    };
    if (ann.lastRoll !== undefined) update.last_roll = ann.lastRoll;
    await supabase.from("game_state").update(update).eq("game_id", gameId);
  };

  const closeBankruptAnnouncementRef = React.useRef(closeBankruptAnnouncement);
  React.useEffect(() => { closeBankruptAnnouncementRef.current = closeBankruptAnnouncement; });

  // Auto-zavři bankrot announcement po 3 s — jen triggerer klient
  React.useEffect(() => {
    if (gameState?.offer_pending?.type !== "bankrupt_announcement") return;
    const ann = gameState.offer_pending as BankruptAnnouncement;
    const isTriggerer = gameMode === "local"
      ? viewerRole === "player"
      : myPlayerId === ann.playerId;
    if (!isTriggerer) return;
    const timer = setTimeout(() => {
      closeBankruptAnnouncementRef.current();
    }, 3000);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState?.offer_pending?.type === "bankrupt_announcement"
      ? (gameState.offer_pending as BankruptAnnouncement).playerId
      : null]);

  // ── Race pending placeholder ─────────────────────────────────────────────

  const closeRacePending = async () => {
    if (!gameId || !gameState) return;
    const evt = gameState.offer_pending?.type === "race_pending"
      ? gameState.offer_pending as RacePendingEvent
      : null;
    if (!evt) return;
    const update: Record<string, unknown> = {
      current_player_index: evt.nextIndex,
      turn_count: evt.turnCount,
      offer_pending: null,
    };
    if (evt.lastRoll !== undefined) update.last_roll = evt.lastRoll;
    await supabase.from("game_state").update(update).eq("game_id", gameId);
  };

  // Uzavře výsledky závodu, vyplatí vítězi reward a posune tah dál
  const closeRaceResult = async () => {
    if (!gameId || !gameState) return;
    const evt = gameState.offer_pending?.type === "race_pending"
      ? gameState.offer_pending as RacePendingEvent
      : null;
    if (!evt || evt.phase !== "results") return;

    // Urči vítěze: effective score = tapy * (finalStamina/100), tiebreak: speed
    const raceEntries = (evt.playerIds ?? []).map(pid => {
      const player = players.find(p => p.id === pid);
      const horseKey = evt.selections?.[pid];
      const horse = player?.horses.find(h => racerOwnershipKey(h) === horseKey);
      const rawScore = evt.scores?.[pid] ?? 0;
      const finalStamina = evt.finalStaminas?.[pid] ?? horse?.stamina ?? 100;
      return { player, horse, horseKey, rawScore, effectiveScore: rawScore * (finalStamina / 100), speed: horse?.speed ?? 0, finalStamina };
    });
    const winnerEntry = [...raceEntries].sort((a, b) => b.effectiveScore - a.effectiveScore || b.speed - a.speed)[0];

    const winner = winnerEntry?.player ?? null;
    const reward = evt.reward ?? RACE_WINNER_REWARD;
    const raceLabel = evt.raceType === "rivals_race" ? "Souboj" : "Závod";
    const logLine = winner
      ? `🏁 ${raceLabel}: ${winner.name} vyhrál! +${reward} 💰 (${winnerEntry.horse?.emoji ?? ""} ${winnerEntry.horse?.name ?? ""})`
      : `🏁 ${raceLabel} skončil.`;

    // Aplikuj finalStamina na závodního koně; kůň s 0 staminou se vyřadí z inventáře
    const staminaUpdates = raceEntries
      .filter(e => e.player && e.horse)
      .map(e => {
        const updatedHorses = e.finalStamina === 0
          ? e.player!.horses.filter(h => racerOwnershipKey(h) !== e.horseKey)
          : e.player!.horses.map(h =>
              racerOwnershipKey(h) === e.horseKey ? { ...h, stamina: e.finalStamina } : h
            );
        return supabase.from("players").update({ horses: updatedHorses }).eq("id", e.player!.id);
      });

    const stateUpdate: Record<string, unknown> = {
      current_player_index: evt.nextIndex,
      turn_count: evt.turnCount,
      offer_pending: null,
      // mass_race_done jen pro mass_race — rivals_race tuto vlajku nemění
      ...(evt.raceType !== "rivals_race" ? { mass_race_done: true } : {}),
      log: [logLine, ...(gameState.log ?? [])].slice(0, 20),
    };
    if (evt.lastRoll !== undefined) stateUpdate.last_roll = evt.lastRoll;

    await Promise.all([
      supabase.from("game_state").update(stateUpdate).eq("game_id", gameId),
      ...(winner
        ? [supabase.from("players").update({ coins: winner.coins + reward }).eq("id", winner.id)]
        : []),
      ...staminaUpdates,
    ]);
  };

  // ── Výběr závodníků před závodem ─────────────────────────────────────────

  const submitRaceSelection = async (racerKey: string) => {
    if (!gameId || !gameState) return;
    const evt = gameState.offer_pending?.type === "race_pending"
      ? gameState.offer_pending as RacePendingEvent
      : null;
    if (!evt?.playerIds?.length) return;
    const key = `${evt.playerIds[evt.currentSelectorIndex]}_${evt.currentSelectorIndex}`;
    if (selectionSubmittedRef.current === key) return;
    selectionSubmittedRef.current = key;

    const currentSelectorId = evt.playerIds[evt.currentSelectorIndex];
    const newSelections = { ...evt.selections, [currentSelectorId]: racerKey };
    const isLast = evt.currentSelectorIndex >= evt.playerIds.length - 1;

    if (isLast) {
      // Všechny výběry hotové — přejdi na countdown fázi závodu
      const updatedEvt: RacePendingEvent = { ...evt, selections: newSelections, phase: "countdown" };
      await supabase.from("game_state").update({
        offer_pending: updatedEvt as unknown as Record<string, unknown>,
      }).eq("game_id", gameId);
    } else {
      const updatedEvt: RacePendingEvent = {
        ...evt,
        selections: newSelections,
        currentSelectorIndex: evt.currentSelectorIndex + 1,
      };
      await supabase.from("game_state").update({
        offer_pending: updatedEvt as unknown as Record<string, unknown>,
      }).eq("game_id", gameId);
    }
  };

  // Zapíše skóre aktuálního závodníka a posune na dalšího (nebo results).
  // finalStamina: stamina závodníka po závodě (0 = kůň bude vyřazen).
  // Pokud není předána (watchdog), zachová aktuální staminu koně (žádný drain).
  const submitPendingRaceScore = async (score: number, finalStamina?: number) => {
    if (!gameId || !gameState) return;
    const evt = gameState.offer_pending?.type === "race_pending"
      ? gameState.offer_pending as RacePendingEvent
      : null;
    if (!evt || evt.phase !== "racing") return;
    const idx = evt.currentRacerIndex ?? 0;
    const currentRacerId = evt.playerIds[idx];
    const key = `${currentRacerId}_${idx}`;
    if (pendingRaceScoreRef.current === key) return;
    if (evt.scores?.[currentRacerId] !== undefined) return; // score už přišlo, nepřepisuj
    pendingRaceScoreRef.current = key;

    // Pokud watchdog nezná finalStamina, zachovej aktuální staminu koně
    const player = players.find(p => p.id === currentRacerId);
    const horseKey = evt.selections?.[currentRacerId];
    const horse = player?.horses.find(h => racerOwnershipKey(h) === horseKey);
    const actualFinalStamina = finalStamina ?? (horse?.stamina ?? 100);

    const newScores = { ...(evt.scores ?? {}), [currentRacerId]: score };
    const newFinalStaminas = { ...(evt.finalStaminas ?? {}), [currentRacerId]: actualFinalStamina };
    const isLast = idx >= evt.playerIds.length - 1;

    const updatedEvt: RacePendingEvent = isLast
      ? { ...evt, scores: newScores, finalStaminas: newFinalStaminas, phase: "results" }
      : { ...evt, scores: newScores, finalStaminas: newFinalStaminas, currentRacerIndex: idx + 1 };
    await supabase.from("game_state").update({
      offer_pending: updatedEvt as unknown as Record<string, unknown>,
    }).eq("game_id", gameId);
  };

  // Ref pro watchdog — vždy ukazuje na nejnovější verzi funkce (čerstvý gameState)
  const submitPendingRaceScoreRef = React.useRef(submitPendingRaceScore);
  React.useEffect(() => { submitPendingRaceScoreRef.current = submitPendingRaceScore; });

  // ── Závod (race miniGame) ──────────────────────────────────────────────────

  const startRace = async () => {
    if (!gameId || !gameState) return;
    if (pendingRacer || pendingCard || pendingOffer) return;
    if (gameState.offer_pending?.type === "race") return; // already running
    const activePlayers = players.filter(p => !isBankrupt(p));
    if (activePlayers.length < 2) return;
    const race: RaceOffer = {
      type: "race",
      phase: "racing",
      currentRacerIndex: 0,
      playerIds: activePlayers.map(p => p.id),
      scores: {},
    };
    await supabase.from("game_state").update({
      offer_pending: race as unknown as Record<string, unknown>,
    }).eq("game_id", gameId);
  };

  const submitRaceScore = async (score: number) => {
    if (!gameId || !gameState) return;
    const race = gameState.offer_pending?.type === "race" ? gameState.offer_pending as RaceOffer : null;
    if (!race || race.phase !== "racing") return;
    const key = `${race.playerIds[race.currentRacerIndex]}_${race.currentRacerIndex}`;
    if (raceSubmittedRef.current === key) return;
    raceSubmittedRef.current = key;

    const currentRacerId = race.playerIds[race.currentRacerIndex];
    const newScores = { ...race.scores, [currentRacerId]: score };
    const isLast = race.currentRacerIndex >= race.playerIds.length - 1;
    const updatedRace: RaceOffer = {
      ...race,
      scores: newScores,
      currentRacerIndex: isLast ? race.currentRacerIndex : race.currentRacerIndex + 1,
      phase: isLast ? "results" : "racing",
    };
    await supabase.from("game_state").update({
      offer_pending: updatedRace as unknown as Record<string, unknown>,
    }).eq("game_id", gameId);
  };

  const closeRace = async () => {
    if (!gameId || !gameState) return;
    const race = gameState.offer_pending?.type === "race" ? gameState.offer_pending as RaceOffer : null;
    if (!race || race.phase !== "results") return;
    const winner = race.playerIds
      .map(id => ({ id, score: race.scores[id] ?? 0 }))
      .sort((a, b) => b.score - a.score)[0];
    const winnerPlayer = winner ? players.find(p => p.id === winner.id) : null;
    const scoreLog = race.playerIds
      .map(id => { const p = players.find(pl => pl.id === id); return `${p?.name ?? id}: ${race.scores[id] ?? 0}`; })
      .join(", ");
    const logLine = winnerPlayer
      ? `🏁 Závod: ${winnerPlayer.name} vyhrál! (${scoreLog})`
      : `🏁 Závod skončil (${scoreLog})`;
    const newLog = gameState.log ?? [];
    await supabase.from("game_state").update({
      offer_pending: null,
      log: [logLine, ...newLog].slice(0, 20),
    }).eq("game_id", gameId);
    raceSubmittedRef.current = null;
  };

  // Zkontroluj podmínky konce hry a nastav status na "finished".
  // Dvě pravidla:
  //   Multiplayer výhra: >=2 hráčů celkem, přesně 1 aktivní zbývá.
  //   Solo prohra:        1 hráč celkem,  0 aktivních (zbankrotoval).
  const checkAndFinishGame = async (updatedPlayers: Player[]) => {
    if (!gameId) return;
    const activePlayers = updatedPlayers.filter(p => !isBankrupt(p));
    const multiplayerWin = updatedPlayers.length >= 2 && activePlayers.length === 1;
    const soloLoss = updatedPlayers.length === 1 && activePlayers.length === 0;
    if (multiplayerWin || soloLoss) {
      await supabase.from("games").update({ status: "finished" }).eq("id", gameId);
      // Okamžitý lokální update — stejný vzor jako cancelGame.
      // Realtime propaguje ostatním klientům, ale tento klient nečeká.
      setGameStatus("finished");
    }
  };

  // ── Helpers ──────────────────────────────────────────────────────────────────

  // Po načtení / refresh: obnov pendingRacer a pendingCard ze stavu DB
  React.useEffect(() => {
    if (!gameState || players.length === 0) return;
    if (gameState.horse_pending) {
      const currentP = players[gameState.current_player_index];
      const field = currentP ? fieldsRef.current[currentP.position] : null;
      if (field?.type === "racer" && field.racer) {
        setPendingRacer({ racer: field.racer, playerIndex: gameState.current_player_index });
      }
    } else {
      setPendingRacer(null);
    }
    if (gameState.card_pending) {
      setPendingCard({ card: gameState.card_pending, playerIndex: gameState.current_player_index });
    } else {
      setPendingCard(null);
    }
    if (gameState.offer_pending?.type === "reroll") {
      setPendingOffer(gameState.offer_pending as RerollOffer);
    } else {
      setPendingOffer(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState?.horse_pending, gameState?.card_pending, gameState?.offer_pending, gameState?.current_player_index]);

  // Auto-skip: pokud má aktuální hráč skip_next_turn = true, přeskočíme jeho tah
  React.useEffect(() => {
    if (!gameState || players.length === 0 || !gameId) return;
    const currentP = players[gameState.current_player_index];
    if (!currentP?.skip_next_turn) return;
    if (gameState.horse_pending || gameState.card_pending) return; // počkej až se vyřeší

    // Jen trigger klient: local = kdokoliv, online = hráč s myPlayerId
    const isActiveClient = gameMode === "local"
      ? viewerRole === "player"
      : myPlayerId === currentP.id;
    if (!isActiveClient) return;

    const doSkip = async () => {
      const newLog = gameState.log ?? [];
      const nextIndex = getNextActiveIndex(gameState.current_player_index, players);
      await supabase.from("players").update({ skip_next_turn: false }).eq("id", currentP.id);
      await supabase.from("game_state").update({
        current_player_index: nextIndex,
        turn_count: gameState.turn_count + 1,
        log: [`${currentP.name} přeskakuje tah (penalizace z karty)`, ...newLog].slice(0, 20),
      }).eq("game_id", gameId);
    };
    doSkip();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState?.current_player_index, players.map(p => p.skip_next_turn).join(",")]);

  // Pro render desky: animující hráč se zobrazuje na animPosition, ne na DB pozici
  const displayPlayers = players.map((p, i) =>
    i === animatingPlayerIdx && animPosition !== null ? { ...p, position: animPosition } : p
  );
  const animatingPlayerId = animatingPlayerIdx !== null ? players[animatingPlayerIdx]?.id : null;

  // Bankrotáři nejsou vidět na desce
  const fieldPlayers = (fieldIndex: number) =>
    displayPlayers.filter((p) => p.position === fieldIndex && !isBankrupt(p));
  const currentPlayer = gameState ? players[gameState.current_player_index] : null;
  // Bankrotář nemůže hrát ani když je na řadě — blokujeme deadlock
  // Pozorovatel nikdy nemůže hrát
  const isLocalGame = gameMode === "local";
  // Závod — odvozeno z DB stavu
  const pendingRace = (gameState?.offer_pending?.type === "race") ? gameState.offer_pending as RaceOffer : null;
  // Bankrot announcement — odvozeno z DB stavu
  const bankruptAnn = (gameState?.offer_pending?.type === "bankrupt_announcement") ? gameState.offer_pending as BankruptAnnouncement : null;
  // Race pending (výběr závodníků) — odvozeno z DB stavu
  const racePendingEvt = (gameState?.offer_pending?.type === "race_pending") ? gameState.offer_pending as RacePendingEvent : null;
  const raceSelectorPlayer = racePendingEvt?.playerIds?.length
    ? players.find(p => p.id === racePendingEvt.playerIds[racePendingEvt.currentSelectorIndex]) ?? null
    : null;
  const isMySelectionTurn = !!(racePendingEvt?.playerIds?.length && (
    isLocalGame ? true : raceSelectorPlayer?.id === myPlayerId
  ));
  // Kdo aktuálně závodí (racing fáze)
  const raceCurrentPlayer = racePendingEvt?.phase === "racing" && racePendingEvt.playerIds?.length
    ? players.find(p => p.id === racePendingEvt.playerIds[racePendingEvt.currentRacerIndex ?? 0]) ?? null
    : null;
  const isMyRacingTurn = !!(racePendingEvt?.phase === "racing" && (
    isLocalGame ? true : raceCurrentPlayer?.id === myPlayerId
  ));
  // Výsledky závodu: effective score = raw tapy × (finalStamina/100), tiebreak speed
  // Řazení odpovídá winner logice v closeRaceResult
  const raceResults = racePendingEvt?.phase === "results"
    ? (racePendingEvt.playerIds ?? []).map(pid => {
        const player = players.find(p => p.id === pid);
        const horseKey = racePendingEvt.selections?.[pid];
        const horse = player?.horses.find(h => racerOwnershipKey(h) === horseKey);
        const score = racePendingEvt.scores?.[pid] ?? 0;
        const finalStamina = racePendingEvt.finalStaminas?.[pid] ?? horse?.stamina ?? 100;
        const effectiveScore = score * (finalStamina / 100);
        return { player, horse, speed: horse?.speed ?? 0, score, effectiveScore, finalStamina };
      }).sort((a, b) => b.effectiveScore - a.effectiveScore || b.speed - a.speed)
    : null;
  const isMyRaceTurn = !!(pendingRace?.phase === "racing" && (
    isLocalGame ? true : myPlayerId === pendingRace?.playerIds[pendingRace?.currentRacerIndex ?? -1]
  ));
  const isSpectator = viewerRole === "spectator";
  // Local: kdokoliv "player" může hodit za aktuálního hráče (hot-seat)
  // Online: jen hráč jehož ID sedí s localStorage
  const isMyTurn = isLocalGame
    ? (viewerRole === "player" && !!currentPlayer && !isBankrupt(currentPlayer) && !isRolling && !isMoving)
    : (!!myPlayerId && currentPlayer?.id === myPlayerId && !isBankrupt(currentPlayer) && !isRolling && !isMoving && !isSpectator);
  const currentRound = gameState ? Math.floor(gameState.turn_count / Math.max(1, players.length)) + 1 : 1;

  // Mapa (racer.id ?? racer.name) → vlastník — id-first, name fallback pro stará data
  const racerOwnership: Record<string, Player> = {};
  players.forEach(p => p.horses.forEach(h => { racerOwnership[racerOwnershipKey(h)] = p; }));

  // Auto-posuň countdown → racing (po 3,5 s) a inicializuj racing stav.
  // Jen triggerer (host / local). Racing → results řídí submitPendingRaceScore.
  React.useEffect(() => {
    if (racePendingEvt?.phase !== "countdown") return;
    if (!isHost && !isLocalGame) return;
    const timer = setTimeout(async () => {
      if (!gameId || !gameState) return;
      const current = gameState.offer_pending?.type === "race_pending"
        ? gameState.offer_pending as RacePendingEvent
        : null;
      if (!current || current.phase !== "countdown") return;
      await supabase.from("game_state").update({
        offer_pending: { ...current, phase: "racing", currentRacerIndex: 0, scores: {} } as unknown as Record<string, unknown>,
      }).eq("game_id", gameId);
    }, 3500);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [racePendingEvt?.phase]);

  // Lokální countdown číslo (kosmetika — každý klient animuje sám)
  React.useEffect(() => {
    if (racePendingEvt?.phase !== "countdown") { setCountdownNum(null); return; }
    setCountdownNum(3);
    const t1 = setTimeout(() => setCountdownNum(2), 1000);
    const t2 = setTimeout(() => setCountdownNum(1), 2000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [racePendingEvt?.phase]);

  // Watchdog: pokud závodník neodešle score do limitu, host zapíše 0 a pokračuje dál.
  // Jen host/local. Resetuje se pro každého závodníka (dependency na currentRacerIndex).
  React.useEffect(() => {
    if (racePendingEvt?.phase !== "racing") return;
    if (!isHost && !isLocalGame) return;
    const timer = setTimeout(() => {
      submitPendingRaceScoreRef.current(0);
    }, 11000); // 8 s minihra + 3 s buffer
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [racePendingEvt?.phase === "racing"
      ? `racing_${racePendingEvt.currentRacerIndex ?? 0}`
      : null]);

  // Auto-confirm preferred racera — pokud má aktuální selektor validního preferred koně,
  // potvrdí ho automaticky bez zobrazení selection overlay.
  // Fallback ruční selection nastane pouze tehdy, když preferred neexistuje / hráč ho nevlastní.
  // Nízká nebo nulová stamina auto-confirm NEBLOKUJE (hráč nese důsledek své volby).
  React.useEffect(() => {
    if (!racePendingEvt || (racePendingEvt.phase && racePendingEvt.phase !== "selecting")) return;
    if (!isMySelectionTurn || !raceSelectorPlayer) return;
    const preferred = raceSelectorPlayer.horses.find(h => h.isPreferred);
    if (!preferred) return;
    submitRaceSelection(racerOwnershipKey(preferred));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [racePendingEvt?.currentSelectorIndex, isMySelectionTurn]);

  // Sestavení CenterEvent view modelu pro sjednocený modal
  const centerEvent = mapToCenterEvent(
    pendingCard,
    pendingOffer,
    players,
    gameMode,
    viewerRole,
    myPlayerId
  );

  // ── Render ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-slate-500">Načítám hru…</div>
      </div>
    );
  }

  if (gameCode && !gameId) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl font-bold text-slate-800">Hra nenalezena</div>
          <a href="/" className="mt-4 block text-sm text-slate-500 underline">Zpět na úvod</a>
        </div>
      </div>
    );
  }

  if (gameStatus === "cancelled") {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
        <div className="text-center space-y-4">
          <div className="text-5xl">🚫</div>
          <h2 className="text-2xl font-bold text-slate-800">Hra byla zrušena</h2>
          <p className="text-slate-500">Hostitel ukončil tuto hru.</p>
          <a href="/" className="block text-sm text-slate-400 underline hover:text-slate-600">← Zpět na úvod</a>
        </div>
      </div>
    );
  }

  if (gameStatus === "finished") {
    const winner = players.find(p => !isBankrupt(p));
    const losers = players.filter(p => isBankrupt(p));
    const isSoloLoss = players.length === 1 && !winner;
    return (
      <div className={`min-h-screen ${theme.colors.pageBackground} flex items-center justify-center p-6`}>
        <div className={`w-full max-w-md rounded-3xl ${theme.colors.cardBackground} p-8 shadow-lg space-y-5`}>

          {isSoloLoss ? (
            /* ── Solo prohra ────────────────────────────────── */
            <div className="text-center space-y-2">
              <div className="text-5xl">💀</div>
              <h2 className={`text-2xl font-bold ${theme.colors.textPrimary}`}>Zkrachoval jsi!</h2>
              <p className={`text-sm ${theme.colors.textMuted}`}>Tréninková hra skončila porážkou.</p>
            </div>
          ) : (
            /* ── Multiplayer výhra ──────────────────────────── */
            <>
              <div className="text-center space-y-1">
                <div className="text-5xl">🏆</div>
                <h2 className={`text-2xl font-bold ${theme.colors.textPrimary}`}>Hra skončila!</h2>
              </div>
              {winner && (
                <div className="rounded-2xl border-2 border-amber-400 bg-amber-50 p-5 text-center space-y-1">
                  <div className="text-3xl">👑</div>
                  <div className="text-xl font-bold text-amber-800">{winner.name}</div>
                  <div className="text-amber-600 text-sm">{winner.coins} 💰 na účtu</div>
                </div>
              )}
              {losers.length > 0 && (
                <div className="space-y-2">
                  <div className={`text-xs font-semibold uppercase tracking-wide ${theme.colors.textMuted}`}>Zkrachovali</div>
                  {losers.map(p => (
                    <div key={p.id} className={`flex items-center justify-between rounded-xl border px-4 py-3 ${theme.colors.playerCardNormal}`}>
                      <span className={`font-medium line-through ${theme.colors.textMuted}`}>{p.name}</span>
                      <span className="text-xs text-red-400">💀 Zkrachoval</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          <a href="/" className="block rounded-2xl bg-slate-900 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-slate-800 transition">
            ← Nová hra
          </a>
        </div>
      </div>
    );
  }

  if (viewerRole === "login_required") {
    // Lokální hra — nemá smysl žádat o Discord login na jiném zařízení
    if (isLocalGame) {
      return (
        <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
          <div className="w-full max-w-sm text-center space-y-4">
            <div className="text-4xl">🖥️</div>
            <h2 className="text-xl font-bold text-slate-800">Lokální hra</h2>
            <p className="text-sm text-slate-500">
              Tato hra je lokální (hot-seat) a lze ji hrát pouze na zařízení, kde byla vytvořena.
            </p>
            <a href="/" className="block text-sm text-slate-400 underline hover:text-slate-600">← Zpět na úvod</a>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
        <div className="w-full max-w-sm text-center space-y-4">
          <div className="text-4xl">👀</div>
          <h2 className="text-xl font-bold text-slate-800">Sleduj hru jako pozorovatel</h2>
          <p className="text-sm text-slate-500">
            Pro sledování hry se přihlas přes Discord.
          </p>
          <button
            onClick={() => supabase.auth.signInWithOAuth({
              provider: "discord",
              options: { redirectTo: `${window.location.origin}/auth/callback?next=/game/${gameCode}` },
            })}
            className="w-full rounded-2xl bg-indigo-600 px-4 py-4 text-lg font-semibold text-white hover:bg-indigo-700"
          >
            🎮 Přihlásit přes Discord
          </button>
          <a href="/" className="block text-xs text-slate-400 underline hover:text-slate-600">Zpět na úvod</a>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${theme.colors.pageBackground}`}>

      {/* ── Center Event Modal (card + offer) ───────────────────────────── */}
      {centerEvent && (
        <CenterEventModal
          event={centerEvent}
          onConfirm={acceptOffer}
          onDecline={declineOffer}
        />
      )}

      {/* ── Race Modal ───────────────────────────────────────────────────── */}
      {pendingRace && (
        <RaceModal
          race={pendingRace}
          players={players}
          isMyRaceTurn={isMyRaceTurn}
          onSubmitScore={submitRaceScore}
          onClose={closeRace}
          isHost={isHost}
        />
      )}

      {/* ── Bankrot announcement ─────────────────────────────────────────── */}
      {bankruptAnn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-2xl text-center space-y-4">
            <div className="text-6xl">💀</div>
            <h2 className="text-2xl font-bold text-slate-800">{bankruptAnn.playerName} zkrachoval!</h2>
            <p className="text-sm text-slate-500">Hra pokračuje bez tohoto hráče.</p>
            <div className="animate-pulse text-xs text-slate-400">Pokračujeme za chvíli…</div>
          </div>
        </div>
      )}

      {/* ── Race flow: výběr → countdown → závod → výsledky ────────────────── */}
      {racePendingEvt && racePendingEvt.playerIds?.length > 0 && (
        <RaceEventOverlay
          event={racePendingEvt}
          players={players}
          countdownNum={countdownNum}
          selectorPlayer={raceSelectorPlayer}
          isMySelectionTurn={isMySelectionTurn}
          racingPlayer={raceCurrentPlayer}
          isMyRacingTurn={isMyRacingTurn}
          raceResults={raceResults}
          isHost={isHost}
          isLocalGame={isLocalGame}
          onSelectRacer={submitRaceSelection}
          onSkip={closeRacePending}
          onSubmitScore={submitPendingRaceScore}
          onCloseResult={closeRaceResult}
        />
      )}

      <div className="bg-amber-100 border-b border-amber-300 px-4 py-2 text-center text-sm text-amber-800">
        Experimentální projekt · kontakt:{" "}
        <a href="mailto:hynek@darbujan.cz" className="underline hover:text-amber-900">hynek@darbujan.cz</a>
        {gameCode && (
          <span className="ml-4 font-mono font-bold tracking-widest">
            🎮 hra: {gameCode}
          </span>
        )}
      </div>
      <div className="p-6">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">

          {/* Herní plocha */}
          <div className={`rounded-3xl p-6 shadow-lg ${theme.colors.cardBackground}`}>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h1
                  className={`text-3xl font-bold cursor-pointer hover:opacity-75 transition-opacity ${theme.colors.textPrimary}`}
                  onClick={() => window.open("/", "_blank")}
                >PayToWin.cz</h1>
                <p className={`text-sm ${theme.colors.textMuted}`}>Dostihy, sázky a finanční chaos.</p>
              </div>
              <div className="flex items-center gap-3">
                {isLocalGame && (
                  <div className="rounded-2xl bg-orange-100 px-3 py-2 text-xs font-semibold text-orange-700">
                    🖥️ Lokální
                  </div>
                )}
                {isSpectator && (
                  <div className="rounded-2xl bg-indigo-100 px-3 py-2 text-xs font-semibold text-indigo-700">
                    👀 Pozorovatel
                  </div>
                )}
                {isHost && gameStatus !== "cancelled" && (
                  <>
                    {!pendingRace && !pendingCard && !pendingRacer && !pendingOffer && players.filter(p => !isBankrupt(p)).length >= 2 && (
                      <button
                        onClick={startRace}
                        className="rounded-2xl bg-amber-500 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-600 transition"
                      >
                        🏁 Závod
                      </button>
                    )}
                    <button
                      onClick={cancelGame}
                      className="rounded-2xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-100 transition"
                    >
                      Zrušit hru
                    </button>
                  </>
                )}
                <div className="rounded-2xl bg-slate-100 px-3 py-2 text-xs font-medium text-slate-500">
                  Kolo <span className="font-bold text-slate-800">{currentRound}</span>
                  {getStartTax(currentRound) > 0 && (
                    <span className="ml-1 text-red-500" title={`Daň za průchod STARTem: -${getStartTax(currentRound)} 💰 (roste každé kolo, max 500)`}>🏛️</span>
                  )}
                </div>
                <div className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700">
                  Na tahu: <span className="font-bold">{currentPlayer?.name ?? "-"}</span>
                </div>
              </div>
            </div>

            <div className="mb-4 flex flex-wrap gap-3 text-xs">
              <span className="rounded-lg bg-emerald-100 px-2 py-1 text-emerald-800">🟢 {theme.labels.legend.gain}</span>
              <span className="rounded-lg bg-red-100 px-2 py-1 text-red-800">🔴 {theme.labels.legend.lose}</span>
              <span className="rounded-lg bg-violet-100 px-2 py-1 text-violet-800">🟣 {theme.labels.legend.gamble}</span>
              <span className="rounded-lg bg-amber-100 px-2 py-1 text-amber-800">🟠 {theme.labels.legend.horse}</span>
            </div>

            <div
              className={`relative mx-auto aspect-square w-full max-w-[760px] rounded-[40px] border ${theme.colors.boardSurfaceBorder} ${theme.colors.boardSurface}`}
              style={boardBgUrl ? { backgroundImage: `url(${boardBgUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
            >
              {FIELDS.map((field) => {
                const pos = FIELD_POSITIONS[field.index];
                const playersHere = fieldPlayers(field.index);
                const isTrail = trailFields.includes(field.index);
                const isHoverHighlight = hoveredPlayerId
                  ? displayPlayers.some(p => p.id === hoveredPlayerId && p.position === field.index && !isBankrupt(p))
                  : false;
                const owner = field.type === "racer" && field.racer ? racerOwnership[racerOwnershipKey(field.racer)] ?? null : null;
                return (
                  <div
                    key={field.index}
                    className={`group absolute flex flex-col items-center justify-center rounded-2xl border-2 shadow-sm transition-all duration-200 hover:z-50 ${theme.colors.fieldStyles[field.type]} ${isTrail ? "ring-2 ring-amber-400 ring-offset-1 brightness-110" : ""} ${isHoverHighlight ? "ring-2 ring-blue-400 ring-offset-2 brightness-110 scale-105" : ""} ${owner ? "ring-2 ring-indigo-500 ring-offset-1" : ""}`}
                    style={pos}
                  >
                    <div className="text-base leading-none">{field.emoji}</div>
                    <div className="text-[9px] font-bold leading-tight text-center px-0.5 mt-0.5">
                      {field.type === "start" ? "START" : field.label}
                    </div>
                    {owner && (
                      <div className={`h-1.5 w-1.5 rounded-full mt-0.5 ${owner.color}`} title={owner.name} />
                    )}
                    {/* Tooltip pro racerová pole — instant CSS hover, bez delay */}
                    {field.type === "racer" && field.racer && (() => {
                      const racerDisplay = resolveRacerDisplay(field.racer, theme.assets?.racerImages ?? theme.assets?.horseImages);
                      return (
                      <div className="pointer-events-none absolute bottom-full left-1/2 mb-2 hidden -translate-x-1/2 group-hover:block z-50 w-40">
                        <div className="rounded-xl bg-slate-900 px-3 py-2 text-left shadow-xl">
                          <div className="text-xs font-bold text-white">
                            {racerDisplay.type === "image"
                              ? <img src={racerDisplay.src} alt={racerDisplay.alt} className="inline h-4 w-4 mr-1 rounded object-cover" />
                              : racerDisplay.value
                            }{" "}{field.racer.name}
                          </div>
                          <div className="mt-1 text-[10px] text-slate-300">Rychlost: {"⭐".repeat(field.racer.speed)}</div>
                          <div className="text-[10px] text-slate-300">Cena: {field.racer.price} 💰</div>
                          {owner ? (
                            <div className="mt-1.5 flex items-center gap-1.5">
                              <div className={`h-3 w-3 rounded-full ${owner.color}`} />
                              <span className="text-[10px] font-semibold text-amber-300">Vlastní: {owner.name}</span>
                            </div>
                          ) : (
                            <div className="mt-1.5 text-[10px] font-semibold text-emerald-400">Na prodej</div>
                          )}
                        </div>
                        {/* Šipka dolů */}
                        <div className="mx-auto h-0 w-0 border-x-4 border-t-4 border-x-transparent border-t-slate-900" />
                      </div>
                      );
                    })()}
                  </div>
                );
              })}
              {/* Figurky hráčů — mimo čtverce polí, posunuté ke středu */}
              {FIELDS.map((field) => {
                const playersHere = fieldPlayers(field.index);
                if (playersHere.length === 0) return null;
                return (
                  <div
                    key={`fig-${field.index}`}
                    className="absolute flex items-center justify-center gap-0.5"
                    style={FIGURINE_POSITIONS[field.index]}
                  >
                    {playersHere.map((player) => {
                      const isAnimatingThis = player.id === animatingPlayerId;
                      return (
                        <div
                          key={player.id}
                          className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-black text-black ring-2 ring-black/20 transition-transform duration-200 ${player.color} ${isAnimatingThis ? "scale-125 animate-bounce" : ""}`}
                          style={{ boxShadow: "0 3px 0 rgba(0,0,0,0.35), 0 4px 6px rgba(0,0,0,0.25)" }}
                          title={player.name}
                        >
                          {player.name.charAt(0).toUpperCase()}
                        </div>
                      );
                    })}
                  </div>
                );
              })}

              <div className={`absolute left-1/2 top-1/2 flex h-[42%] w-[42%] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[36px] border-2 border-dashed p-4 text-center ${theme.colors.centerBorder} ${theme.colors.centerBackground}`}>
                <div>
                  <div className="text-2xl">🐎</div>
                  <div className={`mt-1 text-sm font-semibold ${theme.colors.centerTitle}`}>{theme.labels.centerTitle}</div>
                  <div className={`mt-1 text-xs ${theme.colors.centerSubtitle}`}>{theme.labels.centerSubtitle}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Pravý panel */}
          <div className="flex flex-col gap-4">
            <div className={`rounded-3xl p-6 shadow-lg ${theme.colors.cardBackground}`}>
              <div className="flex items-center justify-between">
                <h2 className={`text-2xl font-bold ${theme.colors.textPrimary}`}>Panel hry</h2>
                <button
                  onClick={toggleSound}
                  title={soundEnabled ? "Vypnout zvuky" : "Zapnout zvuky"}
                  className="rounded-xl px-2 py-1 text-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  {soundEnabled ? "🔊" : "🔇"}
                </button>
              </div>
              <div className="mt-4 space-y-4">

                <div className={`rounded-2xl p-4 transition-colors ${isRolling ? theme.colors.rollPanelRolling : theme.colors.rollPanelIdle}`}>
                  <div className="text-sm text-slate-500 mb-2">Poslední hod</div>
                  <div className="flex items-center gap-3">
                    <DiceFace
                      value={(isRolling || isMoving) && displayRoll !== null ? displayRoll : (gameState?.last_roll ?? null)}
                      size={72}
                      rolling={isRolling}
                    />
                    {((isRolling || isMoving) && displayRoll !== null ? displayRoll : gameState?.last_roll) && (
                      <span className={`text-3xl font-bold ${isRolling ? "text-amber-600" : "text-slate-700"}`}>
                        {(isRolling || isMoving) && displayRoll !== null ? displayRoll : gameState?.last_roll}
                      </span>
                    )}
                  </div>
                </div>

                {pendingCard ? (
                  <div className={`rounded-2xl border-2 p-4 space-y-2 ${
                    pendingCard.card.type === "chance"
                      ? "border-sky-400 bg-sky-50"
                      : "border-teal-400 bg-teal-50"
                  }`}>
                    <div className={`text-xs font-bold uppercase tracking-widest ${
                      pendingCard.card.type === "chance" ? "text-sky-600" : "text-teal-600"
                    }`}>
                      {pendingCard.card.type === "chance" ? "🎴 Náhoda" : "💼 Finance"}
                    </div>
                    <div className="text-sm font-medium text-slate-800 leading-snug">
                      {pendingCard.card.text}
                    </div>
                    <div className={`mt-1 inline-block rounded-full px-3 py-1 text-xs font-bold ${
                      pendingCard.card.type === "chance"
                        ? "bg-sky-100 text-sky-800"
                        : "bg-teal-100 text-teal-800"
                    }`}>
                      {pendingCard.card.effectLabel}
                    </div>
                    <div className="text-xs text-slate-400 pt-1">
                      Lízl: {players[pendingCard.playerIndex]?.name ?? "?"} · efekt se aplikuje za chvíli…
                    </div>
                  </div>
                ) : pendingRacer ? (
                  <div className="rounded-2xl border-2 border-amber-400 bg-amber-50 p-4 space-y-3">
                    <div className="text-sm font-semibold text-amber-900">
                      {/* theme.labels.racerField + racer — UI text z theme */}
                      {theme.labels.racerField} nabízí {theme.labels.racer.toLowerCase()}:
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-3xl">{pendingRacer.racer.emoji}</div>
                      <div>
                        <div className="font-bold text-slate-800">{pendingRacer.racer.name}</div>
                        <div className="text-sm text-slate-500">Rychlost: {"⭐".repeat(pendingRacer.racer.speed)}</div>
                        <div className="text-sm font-semibold text-amber-700">Cena: {pendingRacer.racer.price} 💰</div>
                        <div className="text-xs text-slate-400">
                          {players[pendingRacer.playerIndex]?.name} má: {players[pendingRacer.playerIndex]?.coins ?? 0} 💰
                        </div>
                      </div>
                    </div>
                    {isMyTurn ? (
                      <div className="flex gap-2">
                        <button
                          onClick={buyRacer}
                          disabled={(players[pendingRacer.playerIndex]?.coins ?? 0) < pendingRacer.racer.price}
                          className="flex-1 rounded-xl bg-amber-500 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:bg-slate-300"
                        >
                          Koupit
                        </button>
                        <button
                          onClick={skipRacer}
                          className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Přeskočit
                        </button>
                      </div>
                    ) : (
                      <div className="rounded-xl bg-slate-100 px-3 py-2 text-center text-sm text-slate-500">
                        Čeká na rozhodnutí {players[pendingRacer.playerIndex]?.name}…
                      </div>
                    )}
                  </div>
                ) : isSpectator ? (
                  <div className="w-full rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-4 text-center text-sm text-indigo-600">
                    👀 Sleduješ hru jako pozorovatel
                  </div>
                ) : isRolling ? (
                  <div className="w-full rounded-2xl bg-amber-100 px-4 py-4 text-center text-amber-700 font-semibold animate-pulse">
                    🎲 Háže se…
                  </div>
                ) : isMoving ? (
                  <div className="w-full rounded-2xl bg-slate-100 px-4 py-4 text-center text-slate-600 font-semibold">
                    🐎 Figurka se pohybuje…
                  </div>
                ) : isMyTurn ? (
                  <div className="space-y-2">
                    {canReroll && (
                      <div className="rounded-xl bg-amber-100 px-3 py-2 text-center text-xs font-semibold text-amber-800">
                        🎲 Máš druhý hod zdarma!
                      </div>
                    )}
                    <button
                      onClick={rollDice}
                      disabled={!gameState || players.length === 0}
                      className={`w-full rounded-2xl px-4 py-4 text-lg font-semibold text-white shadow transition disabled:cursor-not-allowed disabled:bg-slate-400 ${canReroll ? "bg-amber-500 hover:bg-amber-600" : "bg-slate-900 hover:bg-slate-800"}`}
                    >
                      {canReroll ? "🎲 Hoď znovu!" : "Hoď kostkou"}
                    </button>
                  </div>
                ) : (
                  <div className="w-full rounded-2xl bg-slate-100 px-4 py-4 text-center text-slate-500">
                    Čekej na tah hráče <span className="font-semibold text-slate-700">{currentPlayer?.name ?? "…"}</span>
                  </div>
                )}

                {/* Hráči */}
                <div>
                  <div className={`mb-3 text-sm font-medium ${theme.colors.textPrimary}`}>Hráči</div>
                  <div className="space-y-2">
                    {players.map((player, index) => {
                      const isCurrent = gameState?.current_player_index === index;
                      const bankrupt = isBankrupt(player);
                      const field = FIELDS[player.position];
                      return (
                        <div
                          key={player.id}
                          onMouseEnter={() => !bankrupt && setHoveredPlayerId(player.id)}
                          onMouseLeave={() => setHoveredPlayerId(null)}
                          className={`rounded-2xl border-2 p-3 transition-colors cursor-default ${
                            bankrupt
                              ? "border-red-300 bg-red-50 opacity-60"
                              : hoveredPlayerId === player.id
                              ? theme.colors.playerCardHover
                              : isCurrent
                              ? theme.colors.playerCardActive
                              : theme.colors.playerCardNormal
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-black text-black ring-2 ring-black/20 shadow ${bankrupt ? "bg-slate-400" : player.color}`}>
                                {player.name.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <div className={`font-semibold text-sm leading-tight ${bankrupt ? "text-slate-400 line-through" : theme.colors.textPrimary}`}>
                                  {player.name}
                                </div>
                                {bankrupt ? (
                                  <div className="text-xs font-semibold text-red-500">💀 Zkrachoval</div>
                                ) : (
                                  <div className={`text-xs truncate ${theme.colors.textMuted}`}>{field?.emoji} {field?.label}</div>
                                )}
                                {!bankrupt && player.horses.length > 0 && (
                                  <div className="mt-1 space-y-0.5">
                                    {[...player.horses]
                                      .sort((a, b) => (b.isPreferred ? 1 : 0) - (a.isPreferred ? 1 : 0))
                                      .map((h) => {
                                        const hKey = racerOwnershipKey(h);
                                        const isOwn = isLocalGame ? viewerRole === "player" : player.id === myPlayerId;
                                        return (
                                          <div
                                            key={hKey}
                                            className={`flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs ${
                                              h.isPreferred
                                                ? "bg-yellow-50 border border-yellow-200"
                                                : "bg-slate-50"
                                            }`}
                                          >
                                            <span>{h.emoji}</span>
                                            <span className={`font-medium truncate ${h.isPreferred ? "text-amber-700" : "text-slate-600"}`}>
                                              {h.name}
                                            </span>
                                            {h.isPreferred && (
                                              <span className="shrink-0 text-[10px] font-semibold text-amber-500 bg-amber-100 rounded px-1">
                                                Hlavní
                                              </span>
                                            )}
                                            <span className="shrink-0 text-slate-300 ml-0.5">
                                              {h.stamina ?? 100}%
                                            </span>
                                            {isOwn ? (
                                              <button
                                                onClick={() => setPreferredRacer(player.id, h.isPreferred ? null : hKey)}
                                                className={`ml-auto shrink-0 text-sm leading-none transition-colors ${
                                                  h.isPreferred
                                                    ? "text-amber-400 hover:text-slate-300"
                                                    : "text-slate-300 hover:text-amber-400"
                                                }`}
                                                title={h.isPreferred ? "Odnastavit hlavního závodníka" : "Nastavit jako hlavního závodníka"}
                                              >
                                                {h.isPreferred ? "★" : "☆"}
                                              </button>
                                            ) : h.isPreferred ? (
                                              <span className="ml-auto shrink-0 text-sm leading-none text-amber-400">★</span>
                                            ) : null}
                                          </div>
                                        );
                                      })}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="text-right shrink-0 space-y-1">
                              <div className={`text-sm font-bold ${bankrupt ? "text-red-400" : theme.colors.textPrimary}`}>
                                {player.coins} 💰
                              </div>
                              {isCurrent && !bankrupt && (
                                <div className={`rounded-full px-2 py-0.5 text-center text-[10px] font-semibold ${theme.colors.activePlayerBadge}`}>
                                  ▶ Na tahu
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>
            </div>

            {/* Log */}
            {(gameState?.log?.length ?? 0) > 0 && (
              <div className={`rounded-3xl p-6 shadow-lg ${theme.colors.cardBackground}`}>
                <div className={`text-sm font-medium mb-3 ${theme.colors.textPrimary}`}>Log tahů</div>
                <div className="space-y-1 max-h-52 overflow-y-auto">
                  {(gameState?.log ?? []).map((entry, i) => (
                    <div key={i} className={`text-xs text-slate-600 ${i === 0 ? "font-semibold text-slate-900" : ""}`}>
                      {entry}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
      <BuildInfoBar theme={theme} boardId={boardId} />
      <div className="py-2 flex items-center justify-center gap-4 text-xs text-slate-400">
        <a href="/pravidla" className="hover:text-slate-600 underline">Pravidla</a>
        <span>·</span>
        <a href="/o-nas" className="hover:text-slate-600 underline">O nás</a>
        <span>·</span>
        <a href="mailto:info@paytowin.cz" className="hover:text-slate-600 underline">info@paytowin.cz</a>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Mapuje herní stav na CenterEvent view model pro CenterEventModal.
 * Priorita: card_pending > offer_pending.
 */
function mapToCenterEvent(
  pendingCard: { card: GameCard; playerIndex: number } | null,
  pendingOffer: RerollOffer | null,
  players: Player[],
  gameMode: "online" | "local",
  viewerRole: string,
  myPlayerId: string | null
): CenterEvent | null {
  if (pendingCard) {
    const { card, playerIndex } = pendingCard;
    return {
      type: "card",
      cardType: card.type,
      category: card.type === "chance" ? "Náhoda" : "Finance",
      emoji: card.type === "chance" ? "🎴" : "💼",
      playerName: players[playerIndex]?.name ?? "?",
      text: card.text,
      effectLabel: card.effectLabel,
    };
  }
  if (pendingOffer) {
    const offerPlayer = players.find(p => p.id === pendingOffer.playerId);
    const playerCoins = offerPlayer?.coins ?? 0;
    return {
      type: "offer",
      playerName: pendingOffer.playerName,
      playerCoins,
      cost: pendingOffer.cost,
      canConfirm: playerCoins >= pendingOffer.cost,
      isActivePlayer: gameMode === "local"
        ? viewerRole === "player"
        : myPlayerId === pendingOffer.playerId,
    };
  }
  return null;
}

/**
 * Vrátí zobrazitelný identifikátor závodníka.
 *
 * Priorita fallbacků:
 *   1. racerImages[racer.id] — z theme.assets.racerImages (nový kanonický zdroj)
 *   2. racer.image — přímý obrázek v RacerConfig (theme builder ho vyplní)
 *   3. racer.emoji — vždy k dispozici
 *
 * Pozn.: horseImages je legacy název; volající předává `racerImages ?? horseImages`.
 */
export function resolveRacerDisplay(
  racer: Horse,
  racerImages?: Partial<Record<string, string>>
): { type: "emoji"; value: string } | { type: "image"; src: string; alt: string } {
  const key = racer.id ?? racer.name;
  const src = racerImages?.[key];
  if (src) return { type: "image", src, alt: racer.name };
  return { type: "emoji", value: racer.emoji };
}

