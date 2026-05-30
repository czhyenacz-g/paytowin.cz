"use client";

import React from "react";
import type { Player } from "@/lib/types/game";
import { COINS_FEEDBACK_DURATION_MS } from "@/lib/game-constants";

export interface OpponentMoneyEvent {
  playerId: string;
  playerName: string;
  amount: number;
  kind: "gain" | "loss";
}

/**
 * useOpponentMoneyFeedback — detekuje coins změny soupeřů/botů a vrací krátký event.
 *
 * - Online mód (myPlayerId !== null): soupeř = každý hráč s id !== myPlayerId
 * - Local mód  (myPlayerId === null): feedback pouze pro boty (is_bot === true)
 * - První run inicializuje snapshot bez false-positive
 * - Auto-dismiss po 3 s
 * - Nevolá Supabase, nemění hráče, jen čte players snapshot
 */
export function useOpponentMoneyFeedback(
  players: Player[],
  myPlayerId: string | null,
): OpponentMoneyEvent | null {
  const [event, setEvent] = React.useState<OpponentMoneyEvent | null>(null);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevCoinsRef = React.useRef<Record<string, number>>({});

  React.useEffect(() => {
    const prev = prevCoinsRef.current;
    for (const p of players) {
      const prevCoins = prev[p.id];
      if (prevCoins === undefined) { prev[p.id] = p.coins; continue; }
      const delta = p.coins - prevCoins;
      prev[p.id] = p.coins;
      if (delta === 0) continue;
      const isOpponent = myPlayerId ? p.id !== myPlayerId : !!p.is_bot;
      if (!isOpponent) continue;
      if (timerRef.current) clearTimeout(timerRef.current);
      setEvent({ playerId: p.id, playerName: p.name, amount: Math.abs(delta), kind: delta > 0 ? "gain" : "loss" });
      timerRef.current = setTimeout(() => setEvent(null), COINS_FEEDBACK_DURATION_MS);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players, myPlayerId]);

  React.useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  return event;
}
