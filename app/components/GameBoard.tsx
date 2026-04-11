"use client";

import React from "react";
import { supabase } from "@/lib/supabase";
import { getThemeById } from "@/lib/themes";
import type { Field } from "@/lib/engine";
import {
  sleep,
  buildFields,
  getStartTax,
  isBankrupt,
  getNextActiveIndex,
  normalizePlayer,
  normalizeState,
  REROLL_COST,
  REROLL_CHANCE,
} from "@/lib/engine";
import { drawCard } from "@/lib/cards";
import type { GameCard } from "@/lib/cards";
import type { Player, Horse, GameState, OfferPending } from "@/lib/types/game";
import CardModal from "./modals/CardModal";
import OfferModal from "./modals/OfferModal";

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
  const [themeId, setThemeId] = React.useState<string>("default");
  const [gameMode, setGameMode] = React.useState<"online" | "local">("online");
  const [isHost, setIsHost] = React.useState(false);
  const [gameStatus, setGameStatus] = React.useState<string>("playing");
  const [players, setPlayers] = React.useState<Player[]>([]);
  const [gameState, setGameState] = React.useState<GameState | null>(null);
  const [loading, setLoading] = React.useState(!!gameCode);
  const [pendingHorse, setPendingHorse] = React.useState<{ horse: Horse; playerIndex: number } | null>(null);
  const [pendingCard, setPendingCard] = React.useState<{ card: GameCard; playerIndex: number } | null>(null);
  const cardAppliedRef = React.useRef<string | null>(null);
  const [pendingOffer, setPendingOffer] = React.useState<OfferPending | null>(null);
  const [canReroll, setCanReroll] = React.useState(false);
  // Ochrana: klíč nabídky, kterou jsme už potvrdili — zabrání dvojímu spuštění
  const offerAcceptedRef = React.useRef<string | null>(null);
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

  // Theme + FIELDS — odvozeno ze stavu themeId, aktualizuje se při každém renderu
  const theme = getThemeById(themeId);
  const FIELDS = buildFields(theme.horses);
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
      setThemeId(game.theme_id ?? "default");
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
      normalized = normalized.map(p =>
        p.id === animatingPlayerIdRef.current
          ? { ...p, position: animPositionRef.current! }
          : p
      );
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
            if (field?.type === "horse" && field.horse) {
              setPendingHorse({ horse: field.horse, playerIndex: freshState.current_player_index });
            }
          } else {
            setPendingHorse(null);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]);

  // ── Herní akce ────────────────────────────────────────────────────────────────

  const rollDice = async () => {
    if (!gameState || pendingHorse || pendingCard || pendingOffer || isRolling || isMoving) return;

    const roll = Math.floor(Math.random() * 6) + 1;
    const currentPlayer = players[gameState.current_player_index];
    if (!currentPlayer) return;

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
    const newPosition = (oldPosition + roll) % 21;

    setIsMoving(true);
    setAnimatingPlayerIdx(gameState.current_player_index);
    setAnimPosition(oldPosition);
    setTrailFields([]);
    // Nastav refs — refreshGame je bude číst i ze stale closure v Realtime handleru
    animatingPlayerIdRef.current = currentPlayer.id;
    animPositionRef.current = oldPosition;

    const trail: number[] = [];
    for (let step = 1; step <= roll; step++) {
      const pos = (oldPosition + step) % 21;
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

    // ── 3. Herní logika + zápis do Supabase ───────────────────────────────────
    const field = FIELDS[newPosition];
    const newLog = gameState.log ?? [];
    const newTurnCount = gameState.turn_count + 1;
    const currentRound = Math.floor(gameState.turn_count / Math.max(1, players.length));

    // Průchod STARTem bez přistání (přeskočení pole 0)
    const passedStart = newPosition !== 0 && (oldPosition + roll) >= 21;

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

    if (field.type === "horse" && field.horse) {
      const alreadyOwned = movedPlayer.horses.some(h => h.name === field.horse!.name);

      if (alreadyOwned) {
        // Hráč už tohoto koně vlastní — přeskočíme nabídku, pokračujeme normálně
        const logLines = [`${currentPlayer.name} přijel ke své stáji: ${field.horse.emoji} ${field.horse.name}`, ...extraLog];
        const updatedPlayers = players.map((p, i) =>
          i === gameState.current_player_index ? movedPlayer : p
        );
        const nextIndex = getNextActiveIndex(gameState.current_player_index, updatedPlayers);
        await supabase.from("players").update({ position: newPosition, coins: movedPlayer.coins }).eq("id", currentPlayer.id);
        await supabase.from("game_state").update({
          current_player_index: nextIndex,
          last_roll: roll,
          turn_count: newTurnCount,
          horse_pending: false,
          card_pending: null,
          log: [...logLines, ...newLog].slice(0, 20),
        }).eq("game_id", gameId);
      } else {
        // Neukazujem tah dál — čekáme na rozhodnutí. horse_pending = true v DB.
        await supabase.from("players").update({ position: newPosition, coins: movedPlayer.coins }).eq("id", currentPlayer.id);
        await supabase.from("game_state").update({
          last_roll: roll,
          turn_count: newTurnCount,
          horse_pending: true,
          card_pending: null,
          log: [`${currentPlayer.name} přišel na stáj: ${field.horse.emoji} ${field.horse.name}`, ...extraLog, ...newLog].slice(0, 20),
        }).eq("game_id", gameId);
        setPendingHorse({ horse: field.horse, playerIndex: gameState.current_player_index });
      }
    } else if (field.type === "chance" || field.type === "finance") {
      // ── Karta: lízni, zobraz všem, efekt se aplikuje automaticky po 2.5 s ──
      const card = drawCard(field.type);
      const cardLabel = field.type === "chance" ? "🎴 Náhoda" : "💼 Finance";
      await supabase.from("players").update({ position: newPosition, coins: movedPlayer.coins }).eq("id", currentPlayer.id);
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
      await supabase.from("players").update({ position: finalPlayer.position, coins: finalPlayer.coins, horses: finalPlayer.horses }).eq("id", currentPlayer.id);

      // Nabídka rerollu: 25 % šance, jen pokud nešel do bankrotu a nejde o reroll
      const triggerOffer = !canReroll && !wentBankrupt && Math.random() < REROLL_CHANCE;

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
        await supabase.from("game_state").update({
          current_player_index: nextIndex,
          last_roll: roll,
          turn_count: newTurnCount,
          horse_pending: false,
          card_pending: null,
          offer_pending: null,
          log: [...logLines, ...newLog].slice(0, 20),
        }).eq("game_id", gameId);
        if (canReroll) setCanReroll(false);
      }
    }

    // ── 4. Vyčisti animační stav, stopa zmizí po 1,5 s ──────────────────────
    setAnimatingPlayerIdx(null);
    animatingPlayerIdRef.current = null;
    animPositionRef.current = null;
    setTimeout(() => setTrailFields([]), 1500);
  };

  const buyHorse = async () => {
    if (!pendingHorse || !gameState) return;
    const { horse, playerIndex } = pendingHorse;
    const player = players[playerIndex];
    if (!player || player.coins < horse.price) return;
    if (player.horses.some(h => h.name === horse.name)) return; // pojistka: už vlastní

    const updatedCoins = player.coins - horse.price;
    const updatedHorses = [...player.horses, horse];
    const newLog = gameState.log ?? [];
    const newTurnCount = gameState.turn_count + 1;

    const wentBankrupt = updatedCoins <= 0;
    const logLines = [`${player.name} koupil ${horse.emoji} ${horse.name} za ${horse.price} 💰`];
    if (wentBankrupt) logLines.push(`💀 ${player.name} zkrachoval!`);

    // nextIndex s aktualizovaným hráčem — aby se přeskočil pokud zkrachoval koupí
    const updatedPlayers = players.map((p, i) =>
      i === playerIndex ? { ...player, coins: updatedCoins } : p
    );
    const nextIndex = getNextActiveIndex(playerIndex, updatedPlayers);

    await supabase.from("players").update({ coins: updatedCoins, horses: updatedHorses }).eq("id", player.id);
    await supabase.from("game_state").update({
      current_player_index: nextIndex,
      turn_count: newTurnCount,
      horse_pending: false,
      log: [...logLines, ...newLog].slice(0, 20),
    }).eq("game_id", gameId);

    setPendingHorse(null);
  };

  const skipHorse = async () => {
    if (!pendingHorse || !gameState) return;
    const player = players[pendingHorse.playerIndex];
    const nextIndex = getNextActiveIndex(pendingHorse.playerIndex, players);
    const newLog = gameState.log ?? [];

    await supabase.from("game_state").update({
      current_player_index: nextIndex,
      turn_count: gameState.turn_count + 1,
      horse_pending: false,
      log: [`${player?.name ?? "?"} přeskočil nákup koně`, ...newLog].slice(0, 20),
    }).eq("game_id", gameId);

    setPendingHorse(null);
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
    await supabase.from("game_state").update({
      offer_pending: null,
      current_player_index: nextIndex,
      turn_count: gameState.turn_count + 1,
      log: [`${pendingOffer.playerName} odmítl nabídku`, ...newLog].slice(0, 20),
    }).eq("game_id", gameId);

    setPendingOffer(null);
  };

  // ── Efekt karty ──────────────────────────────────────────────────────────────

  /**
   * Aplikuje efekt karty — volá POUZE aktivní hráčův klient (isMyTurn).
   * Ochrana cardAppliedRef zabrání dvojímu spuštění při re-renderu.
   */
  const applyCardEffect = React.useCallback(async (card: GameCard, playerIndex: number) => {
    if (!gameState || !gameId) return;
    // Ochrana: karta tohoto ID už byla aplikována
    if (cardAppliedRef.current === card.id + "_" + gameState.turn_count) return;
    cardAppliedRef.current = card.id + "_" + gameState.turn_count;

    const player = players[playerIndex];
    if (!player) return;

    let updatedPlayer = { ...player };
    const logLines: string[] = [];
    const newLog = gameState.log ?? [];

    if (card.effect.kind === "coins" && card.effect.value !== undefined) {
      updatedPlayer = { ...updatedPlayer, coins: updatedPlayer.coins + card.effect.value };
      const sign = card.effect.value > 0 ? "+" : "";
      logLines.push(`${player.name}: ${card.text} (${sign}${card.effect.value} 💰)`);
    } else if (card.effect.kind === "move" && card.effect.value !== undefined) {
      const newPos = ((updatedPlayer.position + card.effect.value) % 21 + 21) % 21;
      updatedPlayer = { ...updatedPlayer, position: newPos };
      const sign = card.effect.value > 0 ? "+" : "";
      logLines.push(`${player.name}: ${card.text} (posun ${sign}${card.effect.value})`);
    } else if (card.effect.kind === "skip_turn") {
      // skip_next_turn uložíme do DB — bude přeskočen při příštím tahu
      logLines.push(`${player.name}: ${card.text} (vynechá příští tah)`);
    }

    const wentBankrupt = updatedPlayer.coins <= 0 && player.coins > 0;
    if (wentBankrupt) logLines.push(`💀 ${player.name} zkrachoval!`);

    // Updatuj hráče v DB
    const playerUpdate: Record<string, unknown> = {
      position: updatedPlayer.position,
      coins: updatedPlayer.coins,
    };
    if (card.effect.kind === "skip_turn") {
      // Příznak se aplikuje na TOHOTO hráče — příští tah ho auto-přeskočí (viz useEffect níže)
      playerUpdate.skip_next_turn = true;
    }
    await supabase.from("players").update(playerUpdate).eq("id", player.id);

    // Urči dalšího hráče
    const updatedPlayers = players.map((p, i) => i === playerIndex ? updatedPlayer : p);
    const nextIndex = getNextActiveIndex(playerIndex, updatedPlayers);

    await supabase.from("game_state").update({
      current_player_index: nextIndex,
      turn_count: gameState.turn_count + 1,
      horse_pending: false,
      card_pending: null,
      log: [...logLines, ...newLog].slice(0, 20),
    }).eq("game_id", gameId);

    setPendingCard(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState, players, gameId]);

  // Automaticky aplikuj efekt karty po 2.5 s — jen aktivní hráčův klient
  React.useEffect(() => {
    if (!pendingCard) return;
    const isActivePlayerClient =
      gameMode === "local"
        ? true // local: aktuální hráč vždy u zařízení
        : (myPlayerId && players[pendingCard.playerIndex]?.id === myPlayerId);
    if (!isActivePlayerClient) return;

    const timer = setTimeout(() => {
      applyCardEffect(pendingCard.card, pendingCard.playerIndex);
    }, 2500);

    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingCard?.card.id, pendingCard?.playerIndex]);

  const cancelGame = async () => {
    if (!gameId) return;
    if (!window.confirm("Opravdu chceš zrušit hru? Ostatní hráči ji ztratí.")) return;
    await supabase.from("games").update({ status: "cancelled" }).eq("id", gameId);
    setGameStatus("cancelled");
  };

  // ── Helpers ──────────────────────────────────────────────────────────────────

  // Po načtení / refresh: obnov pendingHorse a pendingCard ze stavu DB
  React.useEffect(() => {
    if (!gameState || players.length === 0) return;
    if (gameState.horse_pending) {
      const currentP = players[gameState.current_player_index];
      const field = currentP ? fieldsRef.current[currentP.position] : null;
      if (field?.type === "horse" && field.horse) {
        setPendingHorse({ horse: field.horse, playerIndex: gameState.current_player_index });
      }
    } else {
      setPendingHorse(null);
    }
    if (gameState.card_pending) {
      setPendingCard({ card: gameState.card_pending, playerIndex: gameState.current_player_index });
    } else {
      setPendingCard(null);
    }
    if (gameState.offer_pending) {
      setPendingOffer(gameState.offer_pending);
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
  const isSpectator = viewerRole === "spectator";
  // Local: kdokoliv "player" může hodit za aktuálního hráče (hot-seat)
  // Online: jen hráč jehož ID sedí s localStorage
  const isMyTurn = isLocalGame
    ? (viewerRole === "player" && !!currentPlayer && !isBankrupt(currentPlayer) && !isRolling && !isMoving)
    : (!!myPlayerId && currentPlayer?.id === myPlayerId && !isBankrupt(currentPlayer) && !isRolling && !isMoving && !isSpectator);
  const currentRound = gameState ? Math.floor(gameState.turn_count / Math.max(1, players.length)) + 1 : 1;

  // Mapa kůň.name → vlastník (pro zobrazení na herní desce)
  const horseOwnership: Record<string, Player> = {};
  players.forEach(p => p.horses.forEach(h => { horseOwnership[h.name] = p; }));

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

      {/* ── Card Modal ────────────────────────────────────────────────────── */}
      {pendingCard && (
        <CardModal
          card={pendingCard.card}
          playerName={players[pendingCard.playerIndex]?.name ?? "?"}
        />
      )}

      {/* ── Offer Modal ───────────────────────────────────────────────────── */}
      {pendingOffer && (
        <OfferModal
          offer={pendingOffer}
          playerCoins={players.find(p => p.id === pendingOffer.playerId)?.coins ?? 0}
          isActivePlayer={gameMode === "local" ? viewerRole === "player" : myPlayerId === pendingOffer.playerId}
          onAccept={acceptOffer}
          onDecline={declineOffer}
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
                  <button
                    onClick={cancelGame}
                    className="rounded-2xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-100 transition"
                  >
                    Zrušit hru
                  </button>
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
              <span className="rounded-lg bg-emerald-100 px-2 py-1 text-emerald-800">🟢 zisk</span>
              <span className="rounded-lg bg-red-100 px-2 py-1 text-red-800">🔴 ztráta</span>
              <span className="rounded-lg bg-violet-100 px-2 py-1 text-violet-800">🟣 hazard</span>
              <span className="rounded-lg bg-amber-100 px-2 py-1 text-amber-800">🟠 kůň</span>
            </div>

            <div className={`relative mx-auto aspect-square w-full max-w-[760px] rounded-[40px] border ${theme.colors.boardSurfaceBorder} ${theme.colors.boardSurface}`}>
              {FIELDS.map((field) => {
                const pos = FIELD_POSITIONS[field.index];
                const playersHere = fieldPlayers(field.index);
                const isTrail = trailFields.includes(field.index);
                const isHoverHighlight = hoveredPlayerId
                  ? displayPlayers.some(p => p.id === hoveredPlayerId && p.position === field.index && !isBankrupt(p))
                  : false;
                const owner = field.type === "horse" && field.horse ? horseOwnership[field.horse.name] ?? null : null;
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
                    {/* Tooltip pro koňská pole — instant CSS hover, bez delay */}
                    {field.type === "horse" && field.horse && (
                      <div className="pointer-events-none absolute bottom-full left-1/2 mb-2 hidden -translate-x-1/2 group-hover:block z-50 w-40">
                        <div className="rounded-xl bg-slate-900 px-3 py-2 text-left shadow-xl">
                          <div className="text-xs font-bold text-white">{field.horse.emoji} {field.horse.name}</div>
                          <div className="mt-1 text-[10px] text-slate-300">Rychlost: {"⭐".repeat(field.horse.speed)}</div>
                          <div className="text-[10px] text-slate-300">Cena: {field.horse.price} 💰</div>
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
                    )}
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
                ) : pendingHorse ? (
                  <div className="rounded-2xl border-2 border-amber-400 bg-amber-50 p-4 space-y-3">
                    <div className="text-sm font-semibold text-amber-900">Stáj nabízí koně:</div>
                    <div className="flex items-center gap-3">
                      <div className="text-3xl">{pendingHorse.horse.emoji}</div>
                      <div>
                        <div className="font-bold text-slate-800">{pendingHorse.horse.name}</div>
                        <div className="text-sm text-slate-500">Rychlost: {"⭐".repeat(pendingHorse.horse.speed)}</div>
                        <div className="text-sm font-semibold text-amber-700">Cena: {pendingHorse.horse.price} 💰</div>
                        <div className="text-xs text-slate-400">
                          {players[pendingHorse.playerIndex]?.name} má: {players[pendingHorse.playerIndex]?.coins ?? 0} 💰
                        </div>
                      </div>
                    </div>
                    {isMyTurn ? (
                      <div className="flex gap-2">
                        <button
                          onClick={buyHorse}
                          disabled={(players[pendingHorse.playerIndex]?.coins ?? 0) < pendingHorse.horse.price}
                          className="flex-1 rounded-xl bg-amber-500 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:bg-slate-300"
                        >
                          Koupit
                        </button>
                        <button
                          onClick={skipHorse}
                          className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Přeskočit
                        </button>
                      </div>
                    ) : (
                      <div className="rounded-xl bg-slate-100 px-3 py-2 text-center text-sm text-slate-500">
                        Čeká na rozhodnutí {players[pendingHorse.playerIndex]?.name}…
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
                                  <div className="text-xs text-amber-500 mt-0.5">
                                    {player.horses.map((h) => `${h.emoji} ${h.name}`).join(", ")}
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
      <div className="py-4 flex items-center justify-center gap-4 text-xs text-slate-400">
        <a href="/pravidla" className="hover:text-slate-600 underline">Pravidla</a>
        <span>·</span>
        <a href="/o-nas" className="hover:text-slate-600 underline">O nás</a>
        <span>·</span>
        <a href="mailto:info@paytowin.cz" className="hover:text-slate-600 underline">info@paytowin.cz</a>
      </div>
    </div>
  );
}

