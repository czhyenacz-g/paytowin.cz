"use server";

import { supabase } from "@/lib/supabase";
import { getThemeById, getThemeRacers, themeToManifest } from "@/lib/themes";
import { resolveManifestRacers } from "@/lib/racers/resolver";
import { getBoardById } from "@/lib/board";
import { applyBoardShuffle } from "@/lib/board/shuffle";
import {
  buildFields,
  getNextActiveIndex,
  getStartTax,
  isBankrupt,
  playerOwnsRacer,
  racerOwnershipKey,
} from "@/lib/engine";
import { drawCard } from "@/lib/cards";
import { decideBotHorsePurchase } from "@/lib/bot/botDecision";
import { DEFAULT_ECONOMY } from "@/lib/types/game";
import type { Player, Horse, EconomyConfig, ActiveEffect } from "@/lib/types/game";
import type { RacerConfig } from "@/lib/themes";

// ── helpers ──────────────────────────────────────────────────────────────────

async function fetchBotContext(gameId: string) {
  const [gameRes, stateRes, playersRes] = await Promise.all([
    supabase.from("games").select("id, economy, theme_id, board_id").eq("id", gameId).single(),
    supabase.from("game_state").select("*").eq("game_id", gameId).single(),
    supabase.from("players").select("*").eq("game_id", gameId).order("turn_order"),
  ]);

  if (gameRes.error || !gameRes.data) return null;
  if (stateRes.error || !stateRes.data) return null;
  if (playersRes.error || !playersRes.data) return null;

  const game    = gameRes.data;
  const state   = stateRes.data;
  const players = playersRes.data as unknown as Player[];

  const economy: EconomyConfig = (game.economy as EconomyConfig | null) ?? DEFAULT_ECONOMY;
  const theme    = getThemeById(game.theme_id);
  const manifest = themeToManifest(theme);
  const resolvedRacers = await resolveManifestRacers(manifest);
  const racers: RacerConfig[] = resolvedRacers.length > 0 ? resolvedRacers : getThemeRacers(theme);

  const boardDef = game.board_id ? getBoardById(game.board_id) : theme.board ?? getBoardById("small");
  const shuffled = applyBoardShuffle(boardDef, game.id);
  const FIELDS   = buildFields(shuffled, racers, economy);

  return { game, state, players, economy, theme, FIELDS, racers };
}

async function botFinishTurn(
  gameId: string,
  botPlayer: Player,
  updatedBotPlayer: Player,
  allPlayers: Player[],
  params: {
    nextIndex: number;
    turnCount: number;
    log: string[];
    lastRoll?: number;
    updatedHorses?: Horse[];
  },
) {
  const updatedPlayers = allPlayers.map(p =>
    p.id === botPlayer.id ? updatedBotPlayer : p
  );

  // Stamina regen for bot player
  const regenHorses = (params.updatedHorses ?? updatedBotPlayer.horses).map(h => {
    const cap = h.maxStamina ?? 100;
    return { ...h, stamina: Math.min(cap, (h.stamina ?? cap) + 10) };
  });

  // Active effects decay
  const effects = (updatedBotPlayer.active_effects ?? []) as ActiveEffect[];
  const updatedEffects = effects
    .map(e => ({ ...e, turnsLeft: e.turnsLeft - 1 }))
    .filter(e => e.turnsLeft > 0);

  const stateUpdate: Record<string, unknown> = {
    current_player_index: params.nextIndex,
    turn_count: params.turnCount,
    horse_pending: false,
    card_pending: null,
    offer_pending: null,
    log: params.log.slice(0, 20),
  };
  if (params.lastRoll !== undefined) stateUpdate.last_roll = params.lastRoll;

  const playerUpdate: Record<string, unknown> = {};
  if (regenHorses.length > 0) playerUpdate.horses = regenHorses;
  if (updatedEffects.length !== effects.length ||
      effects.some((e, i) => e.turnsLeft !== updatedEffects[i]?.turnsLeft)) {
    playerUpdate.active_effects = updatedEffects;
  }

  await Promise.all([
    supabase.from("game_state").update(stateUpdate).eq("game_id", gameId),
    ...(Object.keys(playerUpdate).length > 0
      ? [supabase.from("players").update(playerUpdate).eq("id", botPlayer.id)]
      : []),
  ]);

  // Game over check
  const activePlayers = updatedPlayers.filter(p => !isBankrupt(p));
  if (updatedPlayers.length >= 2 && activePlayers.length <= 1) {
    await supabase.from("games").update({ status: "finished" }).eq("id", gameId);
  }
}

// ── public server actions ─────────────────────────────────────────────────────

/**
 * executeBotTurnAction — vykoná celý tah bota (hod kostkou + herní logika).
 * Guard: turn_count musí odpovídat expectedTurnCount, aby se zabránilo double-execute.
 */
export async function executeBotTurnAction(
  gameId: string,
  expectedTurnCount: number,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const ctx = await fetchBotContext(gameId);
  if (!ctx) return { ok: false, reason: "context fetch failed" };

  const { state, players, economy, theme, FIELDS } = ctx;

  // Guards
  if (state.turn_count !== expectedTurnCount) return { ok: false, reason: "stale turn_count" };
  if (state.horse_pending) return { ok: false, reason: "horse_pending active" };
  if (state.card_pending)  return { ok: false, reason: "card_pending active" };
  if (state.offer_pending) return { ok: false, reason: "offer_pending active" };

  const botPlayer = players[state.current_player_index];
  if (!botPlayer?.is_bot) return { ok: false, reason: "current player is not a bot" };

  // Roll dice (1-6)
  const roll = Math.ceil(Math.random() * 6);
  const fieldCount = FIELDS.length;
  const oldPosition = botPlayer.position;
  const newPosition = (oldPosition + roll) % fieldCount;
  const passedStart = newPosition !== 0 && (oldPosition + roll) >= fieldCount;

  const newTurnCount = state.turn_count + 1;
  const logEntries: string[] = Array.isArray(state.log) ? (state.log as string[]) : [];

  let movedPlayer: Player = { ...botPlayer, position: newPosition };

  // START crossing
  if (passedStart || newPosition === 0) {
    const currentLaps = movedPlayer.laps ?? 0;
    const startTax    = getStartTax(currentLaps, economy);
    movedPlayer = {
      ...movedPlayer,
      coins: movedPlayer.coins + economy.stateSubsidy - startTax,
      laps:  currentLaps + 1,
    };
  }

  const extraLog: string[] = [];
  if (passedStart) extraLog.push(`${botPlayer.name} prošel STARTem — +${economy.stateSubsidy} 💰`);

  const field = FIELDS[newPosition];

  await supabase.from("players").update({
    position: newPosition,
    coins: movedPlayer.coins,
    laps: movedPlayer.laps ?? 0,
  }).eq("id", botPlayer.id);

  const updatedPlayers = players.map(p => p.id === botPlayer.id ? movedPlayer : p);
  const nextIndex = getNextActiveIndex(state.current_player_index, updatedPlayers);

  // ── Field handling ─────────────────────────────────────────────────────────

  if (field.type === "racer" && field.racer) {
    const alreadyOwned = playerOwnsRacer(movedPlayer, field.racer);
    const ownerPlayer  = players.find(p => p.id !== botPlayer.id && playerOwnsRacer(p, field.racer!));

    if (alreadyOwned) {
      // Bot přijel na vlastní pole — bez efektu
      const log = [`${botPlayer.name} přijel ke své vlastní stáji: ${field.racer.emoji} ${field.racer.name}`, ...extraLog, ...logEntries];
      await botFinishTurn(gameId, botPlayer, movedPlayer, updatedPlayers, { nextIndex, turnCount: newTurnCount, log, lastRoll: roll });
    } else if (ownerPlayer) {
      // Platba nájmu
      const rent = Math.round(field.racer.price * 0.2);
      const paidBot   = { ...movedPlayer, coins: movedPlayer.coins - rent };
      const paidOwner = { ...ownerPlayer, coins: ownerPlayer.coins + rent };
      const log = [`${botPlayer.name} zaplatil nájem ${rent} 💰 hráči ${ownerPlayer.name} za ${field.racer.emoji} ${field.racer.name}`, ...extraLog, ...logEntries];
      await Promise.all([
        supabase.from("players").update({ coins: paidBot.coins }).eq("id", botPlayer.id),
        supabase.from("players").update({ coins: paidOwner.coins }).eq("id", ownerPlayer.id),
      ]);
      const updatedForNext = updatedPlayers.map(p =>
        p.id === botPlayer.id ? paidBot : p.id === ownerPlayer.id ? paidOwner : p
      );
      const nextIdx2 = getNextActiveIndex(state.current_player_index, updatedForNext);
      await botFinishTurn(gameId, botPlayer, paidBot, updatedForNext, { nextIndex: nextIdx2, turnCount: newTurnCount, log, lastRoll: roll });
    } else {
      // Nikdo nevlastní — horse_pending=true, bot koupí/přeskočí v executeBotHorseDecisionAction
      const log = [`${botPlayer.name} přijel na pole závodníka: ${field.racer.emoji} ${field.racer.name}`, ...extraLog, ...logEntries];
      await Promise.all([
        supabase.from("game_state").update({
          horse_pending: true,
          turn_count: newTurnCount,
          log: log.slice(0, 20),
          last_roll: roll,
        }).eq("game_id", gameId),
      ]);
      // Trigger pro horse decision přijde přes Realtime (horse_pending=true)
    }
    return { ok: true };
  }

  // Karty — aplikujeme jednoduché efekty, složité přeskočíme s varováním
  if (field.type === "chance" || field.type === "finance" || field.type === "mafia") {
    const card = drawCard(field.type, theme.content?.cards, theme.cardThemeTag);
    const effect = card.effect;
    let finalPlayer = movedPlayer;
    const cardLog: string[] = [`${botPlayer.name} lízl kartu: ${card.text}`];

    if (effect.kind === "coins" && effect.value !== undefined) {
      finalPlayer = { ...finalPlayer, coins: finalPlayer.coins + effect.value };
      cardLog.push(`${effect.value > 0 ? "+" : ""}${effect.value} 💰`);
    } else if (effect.kind === "skip_turn") {
      finalPlayer = { ...finalPlayer, skip_next_turn: true };
      cardLog.push(`${botPlayer.name}: přeskočí příští tah`);
    } else if (effect.kind === "stamina_debuff" && effect.factor !== undefined && effect.duration !== undefined) {
      const newEffect: ActiveEffect = { kind: "stamina_debuff", factor: effect.factor, turnsLeft: effect.duration };
      finalPlayer = { ...finalPlayer, active_effects: [...(finalPlayer.active_effects ?? []), newEffect] };
    } else {
      // move / give_racer — příliš složité pro server MVP, přeskočíme
      console.warn(`[bot] skipping complex card effect "${effect.kind}" for bot ${botPlayer.name}`);
    }

    const playerUpdates: Record<string, unknown> = {
      coins: finalPlayer.coins,
      skip_next_turn: finalPlayer.skip_next_turn ?? false,
    };
    if (finalPlayer.active_effects !== movedPlayer.active_effects) {
      playerUpdates.active_effects = finalPlayer.active_effects;
    }
    await supabase.from("players").update(playerUpdates).eq("id", botPlayer.id);

    const log = [...cardLog, ...extraLog, ...logEntries];
    const updatedForNext2 = updatedPlayers.map(p => p.id === botPlayer.id ? finalPlayer : p);
    const nextIdx3 = getNextActiveIndex(state.current_player_index, updatedForNext2);
    await botFinishTurn(gameId, botPlayer, finalPlayer, updatedForNext2, { nextIndex: nextIdx3, turnCount: newTurnCount, log, lastRoll: roll });
    return { ok: true };
  }

  // coins_gain / coins_lose / start / neutral / gamble
  if (field.action) {
    const result = field.action(movedPlayer);
    const finalPlayer = result.player as Player;
    if (finalPlayer.coins !== movedPlayer.coins) {
      await supabase.from("players").update({ coins: finalPlayer.coins }).eq("id", botPlayer.id);
    }
    const log = [result.log, ...extraLog, ...logEntries].filter(Boolean) as string[];
    const updatedForNext3 = updatedPlayers.map(p => p.id === botPlayer.id ? finalPlayer : p);
    const nextIdx4 = getNextActiveIndex(state.current_player_index, updatedForNext3);
    await botFinishTurn(gameId, botPlayer, finalPlayer, updatedForNext3, { nextIndex: nextIdx4, turnCount: newTurnCount, log, lastRoll: roll });
    return { ok: true };
  }

  // Fallback — neutral pole bez action
  const log = [`${botPlayer.name} hodil ${roll} a stál na ${field.label ?? field.type}`, ...extraLog, ...logEntries];
  await botFinishTurn(gameId, botPlayer, movedPlayer, updatedPlayers, { nextIndex, turnCount: newTurnCount, log, lastRoll: roll });
  return { ok: true };
}

/**
 * executeBotHorseDecisionAction — rozhodne o koupi závodníka (horse_pending=true).
 * Guard: turn_count musí odpovídat expectedTurnCount.
 */
export async function executeBotHorseDecisionAction(
  gameId: string,
  expectedTurnCount: number,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const ctx = await fetchBotContext(gameId);
  if (!ctx) return { ok: false, reason: "context fetch failed" };

  const { state, players, FIELDS, racers } = ctx;

  if (state.turn_count !== expectedTurnCount) return { ok: false, reason: "stale turn_count" };
  if (!state.horse_pending) return { ok: false, reason: "horse_pending is false" };

  const botPlayer = players[state.current_player_index];
  if (!botPlayer?.is_bot) return { ok: false, reason: "current player is not a bot" };

  const field = FIELDS[botPlayer.position];
  if (field.type !== "racer" || !field.racer) {
    // Stav je nekonzistentní — uklidíme horse_pending
    const nextIndex = getNextActiveIndex(state.current_player_index, players);
    await supabase.from("game_state").update({
      horse_pending: false,
      current_player_index: nextIndex,
      turn_count: state.turn_count + 1,
    }).eq("game_id", gameId);
    return { ok: false, reason: "no racer on field" };
  }

  const racerCfg = racers.find(r => r.id === field.racer!.id) ??
    (field.racer as unknown as RacerConfig);

  const decision = decideBotHorsePurchase(botPlayer, racerCfg);
  const newTurnCount = state.turn_count + 1;
  const nextIndex = getNextActiveIndex(state.current_player_index, players);
  const logEntries: string[] = Array.isArray(state.log) ? (state.log as string[]) : [];

  if (decision === "buy") {
    const hKey = racerOwnershipKey(field.racer);
    const newHorse: Horse = {
      id:          field.racer.id,
      name:        field.racer.name,
      speed:       field.racer.speed,
      price:       field.racer.price,
      emoji:       field.racer.emoji,
      image:       field.racer.image,
      maxStamina:  field.racer.maxStamina ?? 100,
      stamina:     field.racer.maxStamina ?? 100,
      isLegendary: field.racer.isLegendary,
    };
    const updatedHorses = [...botPlayer.horses, newHorse];
    const paidBot = { ...botPlayer, coins: botPlayer.coins - field.racer.price, horses: updatedHorses };

    await supabase.from("players").update({
      coins:  paidBot.coins,
      horses: updatedHorses,
    }).eq("id", botPlayer.id);

    const log = [`${botPlayer.name} koupil závodníka ${field.racer.emoji} ${field.racer.name} (${hKey})`, ...logEntries];
    const updatedPlayers = players.map(p => p.id === botPlayer.id ? paidBot : p);
    await botFinishTurn(gameId, botPlayer, paidBot, updatedPlayers, {
      nextIndex, turnCount: newTurnCount, log, updatedHorses,
    });
  } else {
    const log = [`${botPlayer.name} odmítl koupit závodníka ${field.racer.emoji} ${field.racer.name}`, ...logEntries];
    await botFinishTurn(gameId, botPlayer, botPlayer, players, { nextIndex, turnCount: newTurnCount, log });
  }

  return { ok: true };
}
