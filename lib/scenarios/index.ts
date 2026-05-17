export type { ScenarioDefinition, PersonalObjectiveDefinition, SharedObjectiveDefinition, ObjectiveCondition, ObjectiveEvaluationResult, ScenarioWinCondition, ScenarioWinConditionType } from "./types";
export { horseDayScenario } from "./horse-day";
export { horseNightScenario } from "./horse-night";
export { getPersonalObjectiveForPlayer, getSharedObjectiveForGame } from "./objectives";
export { evaluateObjectiveForPlayer, evaluatePersonalObjectiveForPlayer, evaluateSharedObjectiveForPlayers } from "./evaluator";
export type { ObjectiveEvaluationContext } from "./evaluator";
export { evaluateScenarioWinCondition } from "./win-conditions";
export type { ScenarioWinResult } from "./win-conditions";

import { horseDayScenario } from "./horse-day";
import { horseNightScenario } from "./horse-night";
import type { ScenarioDefinition } from "./types";

const SCENARIOS: ScenarioDefinition[] = [horseDayScenario, horseNightScenario];

export function getScenarioForTheme(themeId: string): ScenarioDefinition | null {
  return SCENARIOS.find(s => s.themeId === themeId) ?? null;
}
