"use client";

import React from "react";
import { supabase } from "@/lib/supabase";
import { getThemeById } from "@/lib/themes";

// ─── Typy ─────────────────────────────────────────────────────────────────────

export interface Horse {
  name: string;
  speed: number;
  price: number;
  emoji: string;
}

export interface Player {
  id: string;
  game_id: string;
  name: string;
  position: number;
  color: string;
  coins: number;
  horses: Horse[];
  turn_order: number;
}

interface GameState {
  game_id: string;
  current_player_index: number;
  last_roll: number | null;
  log: string[];
  turn_count: number;
  horse_pending: boolean;
}

const BANKRUPTCY_TAX_PER_ROUND = 50; // daň roste o tuto částku každé kolo (kolo 1 = 0, kolo 2 = 50, kolo 3 = 100, …)
const BANKRUPTCY_TAX_CAP = 500;      // maximální daň za průchod STARTem

/** Vrátí daň za průchod STARTem pro dané kolo. Kolo 1 = 0, každé další +50, max 500. */
function getStartTax(round: number): number {
  return Math.min((round - 1) * BANKRUPTCY_TAX_PER_ROUND, BANKRUPTCY_TAX_CAP);
}

type FieldType = "start" | "coins_gain" | "coins_lose" | "gamble" | "horse" | "neutral";

interface Field {
  index: number;
  type: FieldType;
  label: string;
  emoji: string;
  description: string;
  horse?: Horse;
  action: (player: Player) => { player: Player; log: string };
}

// ─── Statická herní data ───────────────────────────────────────────────────────

const HORSES_FOR_SALE: Horse[] = [
  { name: "Modrý blesk", speed: 3, price: 150, emoji: "🔵" },
  { name: "Zlatá hříva", speed: 4, price: 250, emoji: "🟡" },
  { name: "Rychlý vítr", speed: 5, price: 400, emoji: "🟢" },
  { name: "Divoká růže", speed: 2, price: 80,  emoji: "🌹" },
];

const FIELDS: Field[] = [
  { index: 0,  type: "start",      label: "START",           emoji: "🏁", description: "Průchod = +200 coins.",
    action: (p) => ({ player: { ...p, coins: p.coins + 200 }, log: `${p.name} prošel STARTem — +200 💰` }) },
  { index: 1,  type: "coins_gain", label: "Sponzor",         emoji: "🤝", description: "+100 coins.",
    action: (p) => ({ player: { ...p, coins: p.coins + 100 }, log: `${p.name}: Sponzor — +100 💰` }) },
  { index: 2,  type: "coins_lose", label: "Veterinář",       emoji: "🩺", description: "-60 coins.",
    action: (p) => ({ player: { ...p, coins: p.coins - 60 },  log: `${p.name}: Veterinář — -60 💰` }) },
  { index: 3,  type: "horse",      label: "Divoká růže",     emoji: "🌹", description: "Kůň na prodej (rychlost 2) za 80 coins.", horse: HORSES_FOR_SALE[3],
    action: (p) => ({ player: p, log: "" }) },
  { index: 4,  type: "coins_gain", label: "Vítěz dostihu",   emoji: "🏆", description: "+150 coins.",
    action: (p) => ({ player: { ...p, coins: p.coins + 150 }, log: `${p.name}: Vítěz dostihu — +150 💰` }) },
  { index: 5,  type: "coins_lose", label: "Daňový úřad",     emoji: "🏛️", description: "-80 coins.",
    action: (p) => ({ player: { ...p, coins: p.coins - 80 },  log: `${p.name}: Daňový úřad — -80 💰` }) },
  { index: 6,  type: "coins_gain", label: "Zlaté podkůvky",  emoji: "🥇", description: "+80 coins.",
    action: (p) => ({ player: { ...p, coins: p.coins + 80 },  log: `${p.name}: Zlaté podkůvky — +80 💰` }) },
  { index: 7,  type: "coins_lose", label: "Korupce",         emoji: "💸", description: "-120 coins.",
    action: (p) => ({ player: { ...p, coins: p.coins - 120 }, log: `${p.name}: Korupce — -120 💰` }) },
  { index: 8,  type: "gamble",     label: "Loterie",         emoji: "🎟️", description: "Výhra 300 nebo ztráta 100 (30%).",
    action: (p) => { const w = Math.random() < 0.3; return { player: { ...p, coins: p.coins + (w ? 300 : -100) }, log: `${p.name}: Loterie — ${w ? "+300 💰" : "-100 💰"}` }; } },
  { index: 9,  type: "coins_gain", label: "Dobrá sezona",    emoji: "🌟", description: "+90 coins.",
    action: (p) => ({ player: { ...p, coins: p.coins + 90 },  log: `${p.name}: Dobrá sezona — +90 💰` }) },
  { index: 10, type: "horse",      label: "Modrý blesk",     emoji: "🔵", description: "Kůň na prodej (rychlost 3) za 150 coins.", horse: HORSES_FOR_SALE[0],
    action: (p) => ({ player: p, log: "" }) },
  { index: 11, type: "coins_lose", label: "Krize na trhu",   emoji: "📉", description: "-50 coins.",
    action: (p) => ({ player: { ...p, coins: p.coins - 50 },  log: `${p.name}: Krize na trhu — -50 💰` }) },
  { index: 12, type: "coins_gain", label: "Bankéř",          emoji: "🏦", description: "+40 coins.",
    action: (p) => ({ player: { ...p, coins: p.coins + 40 },  log: `${p.name}: Bankéř — +40 💰` }) },
  { index: 13, type: "coins_lose", label: "Zákeřný soupeř",  emoji: "😈", description: "-70 coins.",
    action: (p) => ({ player: { ...p, coins: p.coins - 70 },  log: `${p.name}: Zákeřný soupeř — -70 💰` }) },
  { index: 14, type: "gamble",     label: "Sázková kancelář",emoji: "📋", description: "Výhra 200 nebo ztráta 80 (40%).",
    action: (p) => { const w = Math.random() < 0.4; return { player: { ...p, coins: p.coins + (w ? 200 : -80) }, log: `${p.name}: Sázkovka — ${w ? "+200 💰" : "-80 💰"}` }; } },
  { index: 15, type: "coins_gain", label: "Věrnostní bonus", emoji: "🎁", description: "+50 coins.",
    action: (p) => ({ player: { ...p, coins: p.coins + 50 },  log: `${p.name}: Věrnostní bonus — +50 💰` }) },
  { index: 16, type: "coins_lose", label: "Zloděj",          emoji: "🦹", description: "-70 coins.",
    action: (p) => ({ player: { ...p, coins: p.coins - 70 },  log: `${p.name}: Zloděj — -70 💰` }) },
  { index: 17, type: "horse",      label: "Zlatá hříva",     emoji: "🟡", description: "Kůň na prodej (rychlost 4) za 250 coins.", horse: HORSES_FOR_SALE[1],
    action: (p) => ({ player: p, log: "" }) },
  { index: 18, type: "coins_lose", label: "Veterinář",       emoji: "💊", description: "-60 coins.",
    action: (p) => ({ player: { ...p, coins: p.coins - 60 },  log: `${p.name}: Veterinář — -60 💰` }) },
  { index: 19, type: "horse",      label: "Rychlý vítr",     emoji: "🟢", description: "Kůň na prodej (rychlost 5) za 400 coins.", horse: HORSES_FOR_SALE[2],
    action: (p) => ({ player: p, log: "" }) },
  { index: 20, type: "gamble",     label: "Ruleta",          emoji: "🎡", description: "Výhra 250 nebo ztráta 150 (45%).",
    action: (p) => { const w = Math.random() < 0.45; return { player: { ...p, coins: p.coins + (w ? 250 : -150) }, log: `${p.name}: Ruleta — ${w ? "+250 💰" : "-150 💰"}` }; } },
];

// Styly polí jsou nyní součástí theme systému (lib/themes/*)
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
            const field = currentP ? FIELDS[currentP.position] : null;
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
    if (!gameState || pendingHorse || isRolling || isMoving) return;

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
          log: [...logLines, ...newLog].slice(0, 20),
        }).eq("game_id", gameId);
      } else {
        // Neukazujem tah dál — čekáme na rozhodnutí. horse_pending = true v DB.
        await supabase.from("players").update({ position: newPosition, coins: movedPlayer.coins }).eq("id", currentPlayer.id);
        await supabase.from("game_state").update({
          last_roll: roll,
          turn_count: newTurnCount,
          horse_pending: true,
          log: [`${currentPlayer.name} přišel na stáj: ${field.horse.emoji} ${field.horse.name}`, ...extraLog, ...newLog].slice(0, 20),
        }).eq("game_id", gameId);
        setPendingHorse({ horse: field.horse, playerIndex: gameState.current_player_index });
      }
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

      await supabase.from("players").update({ position: finalPlayer.position, coins: finalPlayer.coins, horses: finalPlayer.horses }).eq("id", currentPlayer.id);
      await supabase.from("game_state").update({
        current_player_index: nextIndex,
        last_roll: roll,
        turn_count: newTurnCount,
        horse_pending: false,
        log: [...logLines, ...newLog].slice(0, 20),
      }).eq("game_id", gameId);
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

  const cancelGame = async () => {
    if (!gameId) return;
    if (!window.confirm("Opravdu chceš zrušit hru? Ostatní hráči ji ztratí.")) return;
    await supabase.from("games").update({ status: "cancelled" }).eq("id", gameId);
    setGameStatus("cancelled");
  };

  // ── Helpers ──────────────────────────────────────────────────────────────────

  // Po načtení hry obnov pendingHorse ze stavu DB (page refresh survival)
  React.useEffect(() => {
    if (!gameState || players.length === 0) return;
    if (gameState.horse_pending) {
      const currentP = players[gameState.current_player_index];
      const field = currentP ? FIELDS[currentP.position] : null;
      if (field?.type === "horse" && field.horse) {
        setPendingHorse({ horse: field.horse, playerIndex: gameState.current_player_index });
      }
    } else {
      setPendingHorse(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState?.horse_pending, gameState?.current_player_index]);

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

  // Aktivní theme — fallback na default pokud themeId neexistuje
  const theme = getThemeById(themeId);

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

                {pendingHorse ? (
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
                  <button
                    onClick={rollDice}
                    disabled={!gameState || players.length === 0}
                    className="w-full rounded-2xl bg-slate-900 px-4 py-4 text-lg font-semibold text-white shadow transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                  >
                    Hoď kostkou
                  </button>
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

// ─── Herní helpery ────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function isBankrupt(player: Player): boolean {
  return player.coins <= 0;
}

/** Vrátí index dalšího aktivního (neozkrachovalého) hráče. */
function getNextActiveIndex(currentIndex: number, players: Player[]): number {
  if (players.length === 0) return 0;
  let next = (currentIndex + 1) % players.length;
  let attempts = 0;
  while (isBankrupt(players[next]) && attempts < players.length) {
    next = (next + 1) % players.length;
    attempts++;
  }
  return next;
}

// ─── Normalizace dat ze Supabase ──────────────────────────────────────────────

function normalizePlayer(raw: unknown): Player {
  const r = raw as Record<string, unknown>;
  return {
    id: r.id as string,
    game_id: r.game_id as string,
    name: r.name as string,
    position: Number(r.position),
    color: r.color as string,
    coins: Number(r.coins),
    horses: Array.isArray(r.horses) ? (r.horses as Horse[]) : [],
    turn_order: Number(r.turn_order),
  };
}

function normalizeState(raw: unknown): GameState {
  const r = raw as Record<string, unknown>;
  return {
    game_id: r.game_id as string,
    current_player_index: Number(r.current_player_index),
    last_roll: r.last_roll != null ? Number(r.last_roll) : null,
    log: Array.isArray(r.log) ? (r.log as string[]) : [],
    turn_count: Number(r.turn_count ?? 0),
    horse_pending: Boolean(r.horse_pending ?? false),
  };
}
