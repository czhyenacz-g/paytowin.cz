import type {
  ScenarioDefinition,
  PersonalObjectiveDefinition,
  SharedObjectiveDefinition,
} from "./types";

/**
 * Deterministicky vybere osobní kontrakt pro daného hráče podle turn_order.
 * Hráči 0,1,2,… dostanou různé kontrakty — zaručená unikátnost pokud hráčů ≤ kontraktů.
 * Fallback na hash player.id pokud turn_order není k dispozici.
 */
export function getPersonalObjectiveForPlayer(
  scenario: ScenarioDefinition,
  player: { id: string; turn_order?: number | null },
): PersonalObjectiveDefinition | null {
  const objectives = scenario.personalObjectives;
  if (!objectives || objectives.length === 0) return null;

  const index =
    player.turn_order != null
      ? player.turn_order % objectives.length
      : [...player.id].reduce((acc, c) => acc + c.charCodeAt(0), 0) % objectives.length;

  return objectives[index];
}

/**
 * Vrátí veřejný shared kontrakt pro celou hotseat hru.
 * Sdílí ho všichni hráči — volí se první dostupný.
 */
export function getSharedObjectiveForGame(
  scenario: ScenarioDefinition,
): SharedObjectiveDefinition | null {
  return scenario.sharedObjectives?.[0] ?? null;
}
