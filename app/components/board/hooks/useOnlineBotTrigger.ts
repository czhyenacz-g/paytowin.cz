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
}

/**
 * useOnlineBotTrigger — spustí bot tah kdykoliv je bot na tahu.
 *
 * Reaktivní na gameState.turn_count + current_player_index, takže funguje
 * jak po Realtime update tak po initial load / page refresh.
 * Stale-closure problém z Realtime handleru odpadá — myPlayerId je přímá dep.
 *
 * Spouští jen owner klient (players[0].id === myPlayerId).
 * turn_count guard v server action zabrání double-execute při rychlých re-renderech.
 */
export function useOnlineBotTrigger({ gameId, gameState, players, myPlayerId, isLocalGame }: Params) {
  const scheduledRef = React.useRef(false);

  React.useEffect(() => {
    if (!gameId || !gameState || isLocalGame) return;

    const botPlayer = players[gameState.current_player_index];
    if (!botPlayer?.is_bot) return;

    // Executor = owner hráč (players[0] = nejnižší turn_order)
    const isOwner = !!myPlayerId && players[0]?.id === myPlayerId;
    if (!isOwner) return;

    // Blokující stavy — počkej až se vyřeší
    if (gameState.offer_pending) return;

    if (scheduledRef.current) return;
    scheduledRef.current = true;

    const delay = 900 + Math.random() * 1100;

    const run = async () => {
      try {
        if (gameState.horse_pending) {
          await executeBotHorseDecisionAction(gameId, gameState.turn_count);
        } else if (!gameState.card_pending) {
          await executeBotTurnAction(gameId, gameState.turn_count);
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
    gameState?.horse_pending,
    gameState?.card_pending,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    !!gameState?.offer_pending,
  ]);
}
