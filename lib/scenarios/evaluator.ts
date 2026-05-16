import type { Player } from "@/lib/types/game";
import type {
  ScenarioDefinition,
  PersonalObjectiveDefinition,
  SharedObjectiveDefinition,
  ObjectiveCondition,
  ObjectiveEvaluationResult,
} from "./types";
import { getPersonalObjectiveForPlayer } from "./objectives";

export interface ObjectiveEvaluationContext {
  players: Player[];
}

function evaluateCondition(
  condition: ObjectiveCondition,
  player: Player,
): { completed: boolean; reason: string } {
  if (condition.type === "owns_at_least_racers") {
    const count = player.horses.length;
    return {
      completed: count >= condition.count,
      reason: `Hráč vlastní ${count} z ${condition.count} požadovaných racerů.`,
    };
  }
  return { completed: false, reason: "Neznámá podmínka." };
}

export function evaluatePersonalObjectiveForPlayer(
  scenario: ScenarioDefinition,
  player: Player,
  _ctx: ObjectiveEvaluationContext,
): ObjectiveEvaluationResult | null {
  const objective = getPersonalObjectiveForPlayer(scenario, player);
  if (!objective) return null;
  return evaluateObjectiveForPlayer(objective, player);
}

export function evaluateObjectiveForPlayer(
  objective: PersonalObjectiveDefinition,
  player: Player,
): ObjectiveEvaluationResult {
  if (!objective.condition) {
    return {
      objectiveId: objective.id,
      playerId: player.id,
      completed: false,
      reason: "Podmínka není strojově vyhodnotitelná.",
      rewardLabel: objective.rewardLabel,
    };
  }
  const { completed, reason } = evaluateCondition(objective.condition, player);
  return {
    objectiveId: objective.id,
    playerId: player.id,
    completed,
    reason,
    rewardLabel: objective.rewardLabel,
  };
}

/**
 * Pro shared objective s completionMode "first_player_only" vrátí výsledek
 * pouze pro prvního hráče (dle turn_order), který splňuje podmínku.
 * Ostatní hráči dostanou completed=false.
 */
export function evaluateSharedObjectiveForPlayers(
  scenario: ScenarioDefinition,
  players: Player[],
  _ctx: ObjectiveEvaluationContext,
): ObjectiveEvaluationResult[] {
  const objective: SharedObjectiveDefinition | undefined =
    scenario.sharedObjectives?.[0];
  if (!objective) return [];

  if (!objective.condition) {
    return players.map((p) => ({
      objectiveId: objective.id,
      playerId: p.id,
      completed: false,
      reason: "Podmínka není strojově vyhodnotitelná.",
      rewardLabel: objective.rewardLabel,
      rewardCoins: objective.rewardCoins,
    }));
  }

  const sorted = [...players].sort((a, b) => a.turn_order - b.turn_order);

  let firstWinner: Player | null = null;
  if (objective.completionMode === "first_player_only") {
    firstWinner = sorted.find((p) => evaluateCondition(objective.condition!, p).completed) ?? null;
  }

  return sorted.map((p) => {
    if (objective.completionMode === "first_player_only") {
      const isWinner = firstWinner?.id === p.id;
      return {
        objectiveId: objective.id,
        playerId: p.id,
        completed: isWinner,
        reason: isWinner
          ? evaluateCondition(objective.condition!, p).reason
          : firstWinner
            ? `Jiný hráč splnil podmínku jako první.`
            : `Žádný hráč podmínku nesplňuje.`,
        rewardLabel: objective.rewardLabel,
        rewardCoins: isWinner ? objective.rewardCoins : undefined,
      };
    }
    const { completed, reason } = evaluateCondition(objective.condition!, p);
    return {
      objectiveId: objective.id,
      playerId: p.id,
      completed,
      reason,
      rewardLabel: objective.rewardLabel,
      rewardCoins: completed ? objective.rewardCoins : undefined,
    };
  });
}
