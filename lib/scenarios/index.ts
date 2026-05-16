export type { ScenarioDefinition, PersonalObjectiveDefinition, SharedObjectiveDefinition, ObjectiveCondition, ObjectiveEvaluationResult } from "./types";
export { horseDayScenario } from "./horse-day";
export { getPersonalObjectiveForPlayer, getSharedObjectiveForGame } from "./objectives";
export { evaluateObjectiveForPlayer, evaluatePersonalObjectiveForPlayer, evaluateSharedObjectiveForPlayers } from "./evaluator";
export type { ObjectiveEvaluationContext } from "./evaluator";

import { horseDayScenario } from "./horse-day";
import type { ScenarioDefinition } from "./types";

const SCENARIOS: ScenarioDefinition[] = [horseDayScenario];

export function getScenarioForTheme(themeId: string): ScenarioDefinition | null {
  return SCENARIOS.find(s => s.themeId === themeId) ?? null;
}
