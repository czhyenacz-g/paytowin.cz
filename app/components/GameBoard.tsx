"use client";

import React from "react";
import { supabase } from "@/lib/supabase";

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

const BANKRUPTCY_TAX_ROUND = 3;   // od tohoto kola hráči platí daň za průchod STARTem
const BANKRUPTCY_TAX_AMOUNT = 50; // daň v coins

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

const FIELD_STYLE: Record<FieldType, string> = {
  start:      "h-20 w-20 border-red-400 bg-red-500 text-white",
  coins_gain: "h-16 w-16 border-emerald-400 bg-emerald-100 text-emerald-800",
  coins_lose: "h-16 w-16 border-red-300 bg-red-100 text-red-800",
  gamble:     "h-16 w-16 border-violet-400 bg-violet-100 text-violet-800",
  horse:      "h-16 w-16 border-amber-400 bg-amber-100 text-amber-800",
  neutral:    "h-16 w-16 border-slate-300 bg-white text-slate-700",
};

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
  const [players, setPlayers] = React.useState<Player[]>([]);
  const [gameState, setGameState] = React.useState<GameState | null>(null);
  const [loading, setLoading] = React.useState(!!gameCode);
  const [pendingHorse, setPendingHorse] = React.useState<{ horse: Horse; playerIndex: number } | null>(null);
  const [myPlayerId, setMyPlayerId] = React.useState<string | null>(null);
  const [isRolling, setIsRolling] = React.useState(false);
  const [isMoving, setIsMoving] = React.useState(false);
  const [displayRoll, setDisplayRoll] = React.useState<number | null>(null);
  const [animPosition, setAnimPosition] = React.useState<number | null>(null);
  const [animatingPlayerIdx, setAnimatingPlayerIdx] = React.useState<number | null>(null);
  const [trailFields, setTrailFields] = React.useState<number[]>([]);

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
      setMyPlayerId(localStorage.getItem(`paytowin_player_${gameCode}`));
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
    const normalized = (playersData ?? []).map(normalizePlayer);
    setPlayers(normalized);
    if (stateData) setGameState(normalizeState(stateData));
    return { players: normalized, state: stateData ? normalizeState(stateData) : null };
  };

  // ── Realtime subscriptions ───────────────────────────────────────────────────
  React.useEffect(() => {
    if (!gameId) return;

    const channel = supabase
      .channel(`game:${gameId}`)
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

    const trail: number[] = [];
    for (let step = 1; step <= roll; step++) {
      const pos = (oldPosition + step) % 21;
      trail.push(pos);
      setAnimPosition(pos);
      setTrailFields([...trail]);
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

    // Daň za průchod/přistání na STARTu od kola BANKRUPTCY_TAX_ROUND
    if (currentRound >= BANKRUPTCY_TAX_ROUND && (passedStart || newPosition === 0)) {
      movedPlayer = { ...movedPlayer, coins: movedPlayer.coins - BANKRUPTCY_TAX_AMOUNT };
      extraLog.push(`${currentPlayer.name}: Daň za průchod STARTem — -${BANKRUPTCY_TAX_AMOUNT} 💰`);
    }

    if (field.type === "horse" && field.horse) {
      // Neukazujem tah dál — čekáme na rozhodnutí. horse_pending = true v DB.
      await supabase.from("players").update({ position: newPosition, coins: movedPlayer.coins }).eq("id", currentPlayer.id);
      await supabase.from("game_state").update({
        last_roll: roll,
        turn_count: newTurnCount,
        horse_pending: true,
        log: [`${currentPlayer.name} přišel na stáj: ${field.horse.emoji} ${field.horse.name}`, ...extraLog, ...newLog].slice(0, 20),
      }).eq("game_id", gameId);
      setPendingHorse({ horse: field.horse, playerIndex: gameState.current_player_index });
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
    setTimeout(() => setTrailFields([]), 1500);
  };

  const buyHorse = async () => {
    if (!pendingHorse || !gameState) return;
    const { horse, playerIndex } = pendingHorse;
    const player = players[playerIndex];
    if (!player || player.coins < horse.price) return;

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
  const isMyTurn = !!myPlayerId && currentPlayer?.id === myPlayerId && !isBankrupt(currentPlayer) && !isRolling && !isMoving;
  const currentRound = gameState ? Math.floor(gameState.turn_count / Math.max(1, players.length)) + 1 : 1;

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

  return (
    <div className="min-h-screen bg-slate-100">
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
          <div className="rounded-3xl bg-white p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-slate-800">Pay-to-Win</h1>
                <p className="text-sm text-slate-500">Dostihy, sázky a finanční chaos.</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-slate-100 px-3 py-2 text-xs font-medium text-slate-500">
                  Kolo <span className="font-bold text-slate-800">{currentRound}</span>
                  {currentRound >= BANKRUPTCY_TAX_ROUND && (
                    <span className="ml-1 text-red-500" title={`Od kola ${BANKRUPTCY_TAX_ROUND} se platí daň ${BANKRUPTCY_TAX_AMOUNT} za průchod STARTem`}>🏛️</span>
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

            <div className="relative mx-auto aspect-square w-full max-w-[760px] rounded-[40px] border border-slate-200 bg-emerald-50">
              {FIELDS.map((field) => {
                const pos = FIELD_POSITIONS[field.index];
                const playersHere = fieldPlayers(field.index);
                const isTrail = trailFields.includes(field.index);
                return (
                  <div
                    key={field.index}
                    className={`absolute flex flex-col items-center justify-center rounded-2xl border-2 shadow-sm transition-all duration-200 ${FIELD_STYLE[field.type]} ${isTrail ? "ring-2 ring-amber-400 ring-offset-1 brightness-110" : ""}`}
                    style={pos}
                    title={field.description}
                  >
                    <div className="text-base leading-none">{field.emoji}</div>
                    <div className="text-[9px] font-bold leading-tight text-center px-0.5 mt-0.5">
                      {field.type === "start" ? "START" : field.label}
                    </div>
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

              <div className="absolute left-1/2 top-1/2 flex h-[42%] w-[42%] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[36px] border-2 border-dashed border-slate-300 bg-slate-50 p-4 text-center">
                <div>
                  <div className="text-2xl">🐎</div>
                  <div className="mt-1 text-sm font-semibold text-slate-700">Dostihiště</div>
                  <div className="mt-1 text-xs text-slate-400">Přijdou závody.</div>
                </div>
              </div>
            </div>
          </div>

          {/* Pravý panel */}
          <div className="flex flex-col gap-4">
            <div className="rounded-3xl bg-white p-6 shadow-lg">
              <h2 className="text-2xl font-bold text-slate-800">Panel hry</h2>
              <div className="mt-4 space-y-4">

                <div className={`rounded-2xl p-4 transition-colors ${isRolling ? "bg-amber-100" : "bg-slate-100"}`}>
                  <div className="text-sm text-slate-500">Poslední hod</div>
                  <div className={`mt-1 text-4xl font-bold transition-all ${isRolling ? "text-amber-600" : "text-slate-800"}`}>
                    {(isRolling || isMoving) && displayRoll !== null ? displayRoll : (gameState?.last_roll ?? "-")}
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
                  <div className="mb-3 text-sm font-medium text-slate-700">Hráči</div>
                  <div className="space-y-2">
                    {players.map((player, index) => {
                      const isCurrent = gameState?.current_player_index === index;
                      const bankrupt = isBankrupt(player);
                      const field = FIELDS[player.position];
                      return (
                        <div key={player.id} className={`rounded-2xl border-2 p-3 transition-colors ${
                          bankrupt
                            ? "border-red-300 bg-red-50 opacity-60"
                            : isCurrent
                            ? "border-slate-900 bg-slate-50 shadow-sm"
                            : "border-slate-200 bg-white"
                        }`}>
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-black text-black ring-2 ring-black/20 shadow ${bankrupt ? "bg-slate-400" : player.color}`}>
                                {player.name.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <div className={`font-semibold text-sm leading-tight ${bankrupt ? "text-slate-400 line-through" : "text-slate-800"}`}>
                                  {player.name}
                                </div>
                                {bankrupt ? (
                                  <div className="text-xs font-semibold text-red-500">💀 Zkrachoval</div>
                                ) : (
                                  <div className="text-xs text-slate-500 truncate">{field?.emoji} {field?.label}</div>
                                )}
                                {!bankrupt && player.horses.length > 0 && (
                                  <div className="text-xs text-amber-700 mt-0.5">
                                    {player.horses.map((h) => `${h.emoji} ${h.name}`).join(", ")}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="text-right shrink-0 space-y-1">
                              <div className={`text-sm font-bold ${bankrupt ? "text-red-400" : "text-slate-800"}`}>
                                {player.coins} 💰
                              </div>
                              {isCurrent && !bankrupt && (
                                <div className="rounded-full bg-slate-900 px-2 py-0.5 text-center text-[10px] font-semibold text-white">
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
              <div className="rounded-3xl bg-white p-6 shadow-lg">
                <div className="text-sm font-medium text-slate-700 mb-3">Log tahů</div>
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
      <div className="py-4 text-center text-xs text-slate-400">
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
