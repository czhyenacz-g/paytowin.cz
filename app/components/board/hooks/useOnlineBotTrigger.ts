"use client";

import React from "react";
import type { Player, GameState } from "@/lib/types/game";
import { executeBotTurnAction, executeBotHorseDecisionAction } from "@/app/game/bot-actions";

interface Params {
  gameId: string | null;
  gameState: GameState | null;
  players: Player[];
  myPlayerId: string | null;
  isLocalGame: boolean;
  /** Zavolá se po úspěšné bot akci — explicitní refetch, nezávislý na realtime doručení. */
  onBotActionComplete?: () => Promise<void>;
}

/**
 * useOnlineBotTrigger — spustí bot tah kdykoliv je bot na tahu.
 *
 * Reaktivní na gameState.turn_count + current_player_index, takže funguje
 * jak po Realtime update tak po initial load / page refresh.
 * Stale-closure problém z Realtime handleru odpadá — myPlayerId je přímá dep.
 *
 * Spouští jakýkoliv aktivní hráčský klient (ne spectator) — bot flow nesmí záviset na
 * tom, že je přihlášený právě owner klient.
 * turn_count guard v server action zabrání double-execute při rychlých re-renderech.
 *
 * Po dokončení bot akce se zavolá onBotActionComplete (explicitní refetch) — realtime
 * doručení není garantované na mobilu, takže nespoléháme jen na něj.
 */
export function useOnlineBotTrigger({ gameId, gameState, players, myPlayerId, isLocalGame, onBotActionComplete }: Params) {
  const scheduledRef = React.useRef(false);
  // Ref pro callback — nepatří do deps useEffectu, ale musí být vždy aktuální
  const onBotActionCompleteRef = React.useRef(onBotActionComplete);
  React.useEffect(() => { onBotActionCompleteRef.current = onBotActionComplete; });

  const currentBotPlayerId = gameState ? players[gameState.current_player_index]?.id ?? null : null;

  React.useEffect(() => {
    if (!gameId || !gameState || isLocalGame) return;

    const botPlayer = players[gameState.current_player_index];
    if (!botPlayer?.is_bot) return;

    // Trigger jen z klienta skutečného hráče; spectator bez myPlayerId nic nespouští.
    if (!myPlayerId) {
      console.info("[BOT_FLOW] bot_trigger_skipped", { gameId, turnCount: gameState.turn_count, reason: "no_player_id" });
      return;
    }

    // Blokující stavy — počkej až se vyřeší
    if (gameState.offer_pending) {
      console.info("[BOT_FLOW] bot_trigger_skipped", { gameId, turnCount: gameState.turn_count, botName: botPlayer.name, reason: "offer_pending" });
      return;
    }

    if (scheduledRef.current) {
      console.info("[BOT_FLOW] bot_trigger_skipped", { gameId, turnCount: gameState.turn_count, botName: botPlayer.name, reason: "already_scheduled" });
      return;
    }
    scheduledRef.current = true;

    const delay = 900 + Math.random() * 1100;
    const pendingType = gameState.horse_pending ? "horse_decision" : gameState.card_pending ? "card_pending_wait" : "bot_turn";
    console.info("[BOT_FLOW] bot_trigger_scheduled", { gameId, turnCount: gameState.turn_count, botId: botPlayer.id, botName: botPlayer.name, myPlayerId, pendingType, delayMs: Math.round(delay) });

    const run = async () => {
      try {
        if (gameState.horse_pending) {
          console.info("[BOT_FLOW] bot_trigger_seen", { gameId, turnCount: gameState.turn_count, currentPlayerIndex: gameState.current_player_index, botId: botPlayer.id, botName: botPlayer.name, myPlayerId, action: "horse_decision" });
          await executeBotHorseDecisionAction(gameId, gameState.turn_count);
        } else if (!gameState.card_pending) {
          console.info("[BOT_FLOW] bot_trigger_seen", { gameId, turnCount: gameState.turn_count, currentPlayerIndex: gameState.current_player_index, botId: botPlayer.id, botName: botPlayer.name, myPlayerId, action: "bot_turn" });
          await executeBotTurnAction(gameId, gameState.turn_count);
        } else {
          console.info("[BOT_FLOW] bot_trigger_skipped", { gameId, turnCount: gameState.turn_count, botName: botPlayer.name, reason: "card_pending" });
          return; // žádná akce — přeskočí refetch, finally resetuje scheduledRef
        }
        // Explicitní refetch po bot akci — realtime není garantované na mobilu
        const refetch = onBotActionCompleteRef.current;
        if (refetch) {
          console.info("[BOT_FLOW] bot_action_complete_callback_start", { gameId, turnCount: gameState.turn_count });
          try {
            await refetch();
            console.info("[BOT_FLOW] bot_action_complete_callback_done", { gameId });
          } catch {
            console.warn("[BOT_FLOW] bot_action_complete_callback_failed", { gameId });
          }
        }
      } finally {
        scheduledRef.current = false;
      }
    };

    const timer = setTimeout(run, delay);
    return () => {
      clearTimeout(timer);
      scheduledRef.current = false;
    };
  // Záměrně nezahrnujeme `players` jako dep — mění se při každém refreshi a způsobilo
  // by restart timeru. Relevantní je jen turn_count + current_player_index.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    gameId,
    isLocalGame,
    myPlayerId,
    gameState?.turn_count,
    gameState?.current_player_index,
    currentBotPlayerId,
    gameState?.horse_pending,
    gameState?.card_pending,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    !!gameState?.offer_pending,
  ]);
}
