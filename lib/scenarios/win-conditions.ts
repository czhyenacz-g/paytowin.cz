import type { Player } from "@/lib/types/game";
import type { Field } from "@/lib/engine";
import type { ScenarioDefinition } from "./types";
import { isBankrupt, racerOwnershipKey } from "@/lib/engine";

export interface ScenarioWinResult {
  winnerId: string | null;
  reason: string | null;
  type: string | null;
}

/**
 * evaluateScenarioWinCondition — vyhodnotí scenario-specific win condition.
 *
 * Vrátí winnerId pokud někdo splnil podmínku, jinak null.
 * Bankrotující hráči se nepočítají jako potenciální vítězové.
 *
 * collect_all_available_racers:
 *   "Dostupní" raceři = raceři přítomní na board polích (field.racer != null).
 *   Off-board raceři (legendary, slotIndex mimo board) se nepočítají.
 */
export function evaluateScenarioWinCondition(args: {
  scenario: ScenarioDefinition | null;
  players: Player[];
  fields: Field[];
}): ScenarioWinResult {
  const { scenario, players, fields } = args;

  if (!scenario?.winCondition) return { winnerId: null, reason: null, type: null };

  if (scenario.winCondition.type === "collect_all_available_racers") {
    const boardRacers = fields
      .filter(f => (f.type === "racer" || f.type === "horse") && f.racer)
      .map(f => f.racer!);

    if (boardRacers.length === 0) return { winnerId: null, reason: null, type: scenario.winCondition.type };

    const boardRacerKeys = boardRacers.map(r => racerOwnershipKey(r));

    const activePlayers = players.filter(p => !isBankrupt(p));

    for (const player of activePlayers) {
      const ownedKeys = new Set(player.horses.map(h => racerOwnershipKey(h)));
      const ownsAll = boardRacerKeys.every(k => ownedKeys.has(k));
      if (ownsAll) {
        return {
          winnerId: player.id,
          reason: `${player.name} ovládl celý noční ovál — získal všechny dostupné koně.`,
          type: scenario.winCondition.type,
        };
      }
    }

    return { winnerId: null, reason: null, type: scenario.winCondition.type };
  }

  return { winnerId: null, reason: null, type: null };
}
