import type { Player, RacePendingEvent } from "@/lib/types/game";
import { racerOwnershipKey, computeRaceScore } from "@/lib/engine";

// ── Pure derived view-model helpers ──────────────────────────────────────────
// Tyto funkce nemají side-effecty, nepracují s React state, DB ani timery.
// Mohou být bezpečně zavolány opakovaně ze stejnými vstupy.

/**
 * Builds racer → owner map from the players array.
 * Uses id-first key with name as fallback for legacy data.
 */
export function buildRacerOwnership(players: Player[]): Record<string, Player> {
  const map: Record<string, Player> = {};
  players.forEach(p => p.horses.forEach(h => { map[racerOwnershipKey(h)] = p; }));
  return map;
}

/**
 * Returns players with the animating player's position overridden to animPosition.
 * Ensures the animating figurine appears at the current animation step, not the DB position.
 */
export function getDisplayPlayers(
  players: Player[],
  animatingPlayerIdx: number | null,
  animPosition: number | null,
): Player[] {
  return players.map((p, i) =>
    i === animatingPlayerIdx && animPosition !== null ? { ...p, position: animPosition } : p
  );
}

export interface RaceResultEntry {
  player: Player | undefined;
  horse: Player["horses"][number] | undefined;
  speed: number;
  score: number;
  effectiveScore: number;
  finalStamina: number;
}

/**
 * Computes sorted race results from a race_pending event in "results" phase.
 * Returns null when the event is absent or not in the results phase.
 * Sort order matches closeRaceResult winner determination.
 */
export function computeRaceResultsView(
  racePendingEvt: RacePendingEvent | null,
  players: Player[],
): RaceResultEntry[] | null {
  if (racePendingEvt?.phase !== "results") return null;
  return (racePendingEvt.playerIds ?? []).map(pid => {
    const player = players.find(p => p.id === pid);
    const horseKey = racePendingEvt.selections?.[pid];
    const horse = player?.horses.find(h => racerOwnershipKey(h) === horseKey);
    const score = racePendingEvt.scores?.[pid] ?? 0;
    const finalStamina = racePendingEvt.finalStaminas?.[pid] ?? horse?.stamina ?? 100;
    const maxStamina = horse?.maxStamina ?? 100;
    const debuffFactor = (player?.active_effects ?? [])
      .filter(e => e.kind === "stamina_debuff")
      .reduce((acc, e) => acc * e.factor, 1);
    const effectiveScore = computeRaceScore({ rawScore: score, finalStamina, maxStamina, debuffFactor, isLegendary: horse?.isLegendary });
    return { player, horse, speed: horse?.speed ?? 0, score, effectiveScore, finalStamina };
  }).sort((a, b) => b.effectiveScore - a.effectiveScore || b.speed - a.speed);
}
