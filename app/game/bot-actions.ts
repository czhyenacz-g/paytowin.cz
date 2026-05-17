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
  computeRent,
  getPreferredHorse,
  applyStartPassage,
  applyStaminaDebuff,
  resolveGiveRacer,
  ROLL_CORRECTION_COST,
} from "@/lib/engine";
import { chooseBotCorrection } from "@/lib/bot/botCorrection";
import { drawCard } from "@/lib/cards";
import { decideBotHorsePurchase } from "@/lib/bot/botDecision";
import { DEFAULT_ECONOMY } from "@/lib/types/game";
import type { Player, Horse, EconomyConfig, ActiveEffect, StableDuelPendingOffer } from "@/lib/types/game";
import type { RacerConfig } from "@/lib/themes";
import { awardMoneySpentAction } from "@/app/game/actions";
import { buildFogReveal } from "@/lib/fog";
import { selectStableMinigame } from "@/lib/minigames/selectStableMinigame";

// ── helpers ──────────────────────────────────────────────────────────────────

async function fetchBotContext(gameId: string) {
  const [gameRes, stateRes, playersRes] = await Promise.all([
    supabase.from("games").select("id, economy, theme_id, board_id, fog_of_war").eq("id", gameId).single(),
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
    revealedFields?: number[];
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
  if (params.revealedFields !== undefined) stateUpdate.revealed_fields = params.revealedFields;

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
    awardMoneySpentAction(gameId).catch(() => {});
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

  const { game, state, players, economy, theme, FIELDS, racers } = ctx;

  // Fog of War: helper pro výpočet revealed_fields po přistání bota na poli
  const currentRevealed: number[] = Array.isArray(state.revealed_fields) ? (state.revealed_fields as number[]) : [];
  const fogReveal = (pos: number): number[] | undefined =>
    game.fog_of_war ? buildFogReveal(pos, FIELDS, currentRevealed) : undefined;

  // Guards
  if (state.turn_count !== expectedTurnCount) return { ok: false, reason: "stale turn_count" };
  if (state.horse_pending) return { ok: false, reason: "horse_pending active" };
  if (state.card_pending)  return { ok: false, reason: "card_pending active" };
  if (state.offer_pending) return { ok: false, reason: "offer_pending active" };

  const botPlayer = players[state.current_player_index];
  if (!botPlayer?.is_bot) return { ok: false, reason: "current player is not a bot" };

  // Auto-skip: GameBoard useEffect se pro bota nevyhodnotí (myPlayerId ≠ bot.id)
  if (botPlayer.skip_next_turn) {
    const skipLog = [`${botPlayer.name} přeskakuje tah (penalizace z karty)`];
    const logEntries0: string[] = Array.isArray(state.log) ? (state.log as string[]) : [];
    const nextSkipIndex = getNextActiveIndex(state.current_player_index, players);
    await supabase.from("players").update({ skip_next_turn: false }).eq("id", botPlayer.id);
    await supabase.from("game_state").update({
      current_player_index: nextSkipIndex,
      turn_count: state.turn_count + 1,
      log: [...skipLog, ...logEntries0].slice(0, 20),
    }).eq("game_id", gameId);
    return { ok: true };
  }

  // Roll dice (1-6)
  const roll = Math.ceil(Math.random() * 6);
  const fieldCount = FIELDS.length;
  const oldPosition = botPlayer.position;

  // Agresivní korekce tahu — bot zváží ±1 pokud může vyvolat duel
  const correctionAdj = chooseBotCorrection({
    botPlayer,
    players,
    fields: FIELDS,
    rolledSteps: roll,
    basePosition: oldPosition,
    aggressionMode: "normal",
  });
  const finalRoll = roll + correctionAdj;

  const newPosition = (oldPosition + finalRoll) % fieldCount;
  const passedStart = newPosition !== 0 && (oldPosition + finalRoll) >= fieldCount;

  const newTurnCount = state.turn_count + 1;
  const logEntries: string[] = Array.isArray(state.log) ? (state.log as string[]) : [];

  let movedPlayer: Player = {
    ...botPlayer,
    position: newPosition,
    coins: correctionAdj !== 0 ? botPlayer.coins - ROLL_CORRECTION_COST : botPlayer.coins,
  };

  const extraLog: string[] = [];
  if (correctionAdj !== 0) {
    extraLog.push(`🤖 Bot upravil tah o ${correctionAdj > 0 ? "+" : ""}${correctionAdj} (taktický manévr −${ROLL_CORRECTION_COST} 💰)`);
  }

  // START crossing — shodné s lidským rollDice flow v GameBoard.tsx
  if (passedStart || newPosition === 0) {
    const { player: afterStart, logLines: startLog } = applyStartPassage(movedPlayer, passedStart, economy);
    movedPlayer = afterStart;
    extraLog.push(...startLog);
  }

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
      await botFinishTurn(gameId, botPlayer, movedPlayer, updatedPlayers, { nextIndex, turnCount: newTurnCount, log, lastRoll: finalRoll, revealedFields: fogReveal(newPosition) });
    } else if (ownerPlayer) {
      if (movedPlayer.horses.length > 0 && ownerPlayer.horses.length > 0) {
        // ── PvBot Stable Duel: lidský hráč (ownerPlayer) = challenger, bot = defender ──
        const duelCreatedAt = Date.now();
        const challengerHorse = getPreferredHorse(ownerPlayer.horses);
        const defenderHorse   = getPreferredHorse(movedPlayer.horses);
        const rawMafiaBonus = Math.round(getStartTax(botPlayer.laps ?? 0, economy) * 0.10);
        const mafiaBonus = rawMafiaBonus > 0 ? Math.min(rawMafiaBonus, 500) : undefined;
        const duelPending: StableDuelPendingOffer = {
          type:           "stable_duel_pending",
          phase:          "pending",
          mode:           "pvbot_awareness",
          challengerId:   ownerPlayer.id,
          defenderId:     botPlayer.id,
          challengerName: ownerPlayer.name,
          defenderName:   botPlayer.name,
          fieldIndex:     field.index,
          minigameType:   selectStableMinigame({ themeId: game.theme_id, challengerHorse, defenderHorse }),
          createdAt:      duelCreatedAt,
          ...(mafiaBonus !== undefined ? { mafiaBonus } : {}),
        };
        const log = [`⚔️ ${botPlayer.name} přistál na stáji ${ownerPlayer.name} (${field.racer.emoji} ${field.racer.name}) — stájový souboj!`, ...extraLog, ...logEntries];
        await supabase.from("game_state").update({
          offer_pending: duelPending as unknown as Record<string, unknown>,
          log: log.slice(0, 20),
          last_roll: roll,
        }).eq("game_id", gameId);
        // Tah botovi se nesmí ukončit — hra čeká na vyřešení duelu lidským hráčem
        return { ok: true };
      }
      // Rent fallback — jeden nebo oba nemají závodníka
      const rent = computeRent(field.racer.price);
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
      await botFinishTurn(gameId, botPlayer, paidBot, updatedForNext, { nextIndex: nextIdx2, turnCount: newTurnCount, log, lastRoll: finalRoll, revealedFields: fogReveal(newPosition) });
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

  // Karty
  if (field.type === "chance" || field.type === "finance" || field.type === "mafia") {
    const card = drawCard(field.type, theme.content?.cards, theme.cardThemeTag);
    const effect = card.effect;
    let finalPlayer = movedPlayer;
    const cardLog: string[] = [`${botPlayer.name} lízl kartu: ${card.text}`];
    let cardMovedToRacer: Horse | undefined;

    if (effect.kind === "coins" && effect.value !== undefined) {
      finalPlayer = { ...finalPlayer, coins: finalPlayer.coins + effect.value };
      cardLog.push(`${effect.value > 0 ? "+" : ""}${effect.value} 💰`);
    } else if (effect.kind === "skip_turn") {
      finalPlayer = { ...finalPlayer, skip_next_turn: true };
      cardLog.push(`${botPlayer.name}: přeskočí příští tah`);
    } else if (effect.kind === "stamina_debuff" && effect.factor !== undefined && effect.duration !== undefined) {
      finalPlayer = applyStaminaDebuff(finalPlayer, effect.factor, effect.duration);
    } else if (effect.kind === "move" && effect.value !== undefined) {
      const fc = FIELDS.length;
      const oldPos = finalPlayer.position;
      const newPos = ((oldPos + effect.value) % fc + fc) % fc;
      finalPlayer = { ...finalPlayer, position: newPos };
      cardLog.push(`posun ${effect.value > 0 ? "+" : ""}${effect.value} → pole ${newPos}`);

      // START crossing (pouze dopředný přesun přes pole 0)
      const passedStartCard = effect.value > 0 && newPos < oldPos;
      if (passedStartCard || newPos === 0) {
        const { player: afterStart, logLines: startLog } = applyStartPassage(finalPlayer, passedStartCard, economy);
        finalPlayer = afterStart;
        cardLog.push(...startLog);
      }

      // Efekty přistávacího pole (chain guard depth=1: karty se nevylosují, rent skip)
      const landingField = FIELDS[newPos];
      if (landingField) {
        const lt = landingField.type;
        if (lt === "chance" || lt === "finance" || lt === "mafia") {
          cardLog.push(`${botPlayer.name}: přistál na poli ${lt} — karta se nevylosuje (přesun byl kartou).`);
        } else if ((lt === "racer" || lt === "horse") && landingField.racer) {
          const alreadyOwned = playerOwnsRacer(finalPlayer, landingField.racer);
          const landingOwner = players.find(p => p.id !== botPlayer.id && playerOwnsRacer(p, landingField.racer!));
          if (!alreadyOwned && !landingOwner) {
            cardMovedToRacer = landingField.racer;
            cardLog.push(`${botPlayer.name}: přišel na ${landingField.racer.emoji} ${landingField.label} — možnost koupě.`);
          }
        } else if (landingField.action) {
          const { player: afterField, log: fieldLog } = landingField.action(finalPlayer);
          finalPlayer = afterField as Player;
          if (fieldLog) cardLog.push(fieldLog);
        }
      }
    } else if (effect.kind === "give_racer") {
      const result = resolveGiveRacer({
        racerId: effect.racerId,
        fields: FIELDS,
        players,
        themeRacers: racers,
        randomIndex: Math.random(),
      });
      if (result) {
        const { horse, usedFallback } = result;
        finalPlayer = { ...finalPlayer, horses: [...finalPlayer.horses, horse] };
        cardLog.push(usedFallback
          ? `${botPlayer.name}: ${card.text} — požadovaný závodník nebyl dostupný, získal ${horse.emoji} ${horse.name}!`
          : `${botPlayer.name}: ${card.text} — získal ${horse.emoji} ${horse.name}!`
        );
      } else {
        cardLog.push(`${botPlayer.name}: ${card.text} — žádný volný závodník není k dispozici.`);
      }
    }

    // effect2 — Mafia trade-off druhý efekt
    if (card.effect2) {
      const e2 = card.effect2;
      if (e2.kind === "coins" && e2.value !== undefined) {
        finalPlayer = { ...finalPlayer, coins: finalPlayer.coins + e2.value };
      } else if (e2.kind === "move" && e2.value !== undefined) {
        const fc = FIELDS.length;
        finalPlayer = { ...finalPlayer, position: ((finalPlayer.position + e2.value) % fc + fc) % fc };
      } else if (e2.kind === "skip_turn") {
        finalPlayer = { ...finalPlayer, skip_next_turn: true };
      }
    }

    const anyCardMove = effect.kind === "move" || card.effect2?.kind === "move";
    const anyCardSkip = effect.kind === "skip_turn" || card.effect2?.kind === "skip_turn";
    const playerUpdates: Record<string, unknown> = { coins: finalPlayer.coins };
    if (anyCardMove) {
      playerUpdates.position = finalPlayer.position;
      if (finalPlayer.laps !== movedPlayer.laps) playerUpdates.laps = finalPlayer.laps ?? 0;
    }
    if (anyCardSkip) playerUpdates.skip_next_turn = true;
    if (effect.kind === "give_racer") playerUpdates.horses = finalPlayer.horses;
    if (finalPlayer.active_effects !== movedPlayer.active_effects) {
      playerUpdates.active_effects = finalPlayer.active_effects;
    }
    await supabase.from("players").update(playerUpdates).eq("id", botPlayer.id);

    const log = [...cardLog, ...extraLog, ...logEntries];

    // Karta s přesunem na volný racer: spustíme horse_pending (bot dokončí přes executeBotHorseDecisionAction)
    if (cardMovedToRacer) {
      await supabase.from("game_state").update({
        horse_pending: true,
        turn_count: newTurnCount,
        card_pending: null,
        offer_pending: null,
        log: log.slice(0, 20),
        last_roll: roll,
      }).eq("game_id", gameId);
      return { ok: true };
    }

    const updatedForNext2 = updatedPlayers.map(p => p.id === botPlayer.id ? finalPlayer : p);
    const nextIdx3 = getNextActiveIndex(state.current_player_index, updatedForNext2);
    await botFinishTurn(gameId, botPlayer, finalPlayer, updatedForNext2, {
      nextIndex: nextIdx3,
      turnCount: newTurnCount,
      log,
      lastRoll: finalRoll,
      revealedFields: fogReveal(finalPlayer.position),
      ...(effect.kind === "give_racer" ? { updatedHorses: finalPlayer.horses } : {}),
    });
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
    await botFinishTurn(gameId, botPlayer, finalPlayer, updatedForNext3, { nextIndex: nextIdx4, turnCount: newTurnCount, log, lastRoll: finalRoll, revealedFields: fogReveal(newPosition) });
    return { ok: true };
  }

  // Fallback — neutral pole bez action
  const log = [`${botPlayer.name} hodil ${finalRoll} a stál na ${field.label ?? field.type}`, ...extraLog, ...logEntries];
  await botFinishTurn(gameId, botPlayer, movedPlayer, updatedPlayers, { nextIndex, turnCount: newTurnCount, log, lastRoll: finalRoll, revealedFields: fogReveal(newPosition) });
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

  const { game, state, players, FIELDS, racers } = ctx;

  // Fog of War: racer pole jsou vždy viditelné, takže fogReveal je no-op, ale zajišťuje konzistenci
  const currentRevealed: number[] = Array.isArray(state.revealed_fields) ? (state.revealed_fields as number[]) : [];
  const fogReveal = (pos: number): number[] | undefined =>
    game.fog_of_war ? buildFogReveal(pos, FIELDS, currentRevealed) : undefined;

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
      nextIndex, turnCount: newTurnCount, log, updatedHorses, revealedFields: fogReveal(botPlayer.position),
    });
  } else {
    const log = [`${botPlayer.name} odmítl koupit závodníka ${field.racer.emoji} ${field.racer.name}`, ...logEntries];
    await botFinishTurn(gameId, botPlayer, botPlayer, players, { nextIndex, turnCount: newTurnCount, log, revealedFields: fogReveal(botPlayer.position) });
  }

  return { ok: true };
}
