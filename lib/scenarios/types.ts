export type ObjectiveCondition = {
  type: "owns_at_least_racers";
  count: number;
};

export type ScenarioWinConditionType = "last_player_standing" | "collect_all_available_racers";

export interface ScenarioWinCondition {
  type: ScenarioWinConditionType;
  label?: string;
}

export interface ObjectiveEvaluationResult {
  objectiveId: string;
  playerId: string;
  completed: boolean;
  reason: string;
  rewardLabel: string;
  rewardCoins?: number;
}

export interface PersonalObjectiveDefinition {
  id: string;
  title: string;
  story: string;
  task: string;
  rewardLabel: string;
  condition?: ObjectiveCondition;
}

export interface SharedObjectiveDefinition {
  id: string;
  title: string;
  story: string;
  task: string;
  rewardLabel: string;
  rewardCoins?: number;
  completionMode?: "first_player_only";
  condition?: ObjectiveCondition;
}

export interface ScenarioDefinition {
  id: string;
  themeId: string;
  title: string;
  place: string;
  year: number;
  subtitle: string;
  introText: string;
  publicObjectiveTitle: string;
  publicObjectiveText: string;
  winConditionSummary: string;
  personalObjectives?: PersonalObjectiveDefinition[];
  sharedObjectives?: SharedObjectiveDefinition[];
  winCondition?: ScenarioWinCondition;
}
