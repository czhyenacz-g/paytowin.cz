export type StableMinigameType = "neon_rope_duel" | "neon_speedrace" | "legendary_race";

export interface SelectStableMinigameParams {
  themeId: string;
  themeType?: string;
  challengerHorse: { isLegendary?: boolean } | null;
  defenderHorse:   { isLegendary?: boolean } | null;
  rngSeed?: number;
}

/**
 * Vybere typ stájové minihry na základě theme a závodníků.
 *
 * Pravidla (v pořadí priority):
 *   1. Legenda → legendary_race
 *   2. Car theme → neon_speedrace
 *   3. Horse theme → neon_rope_duel
 *   4. Fallback → neon_rope_duel
 *
 * TODO: 30% náhodný Legendary Race event (libovolný racer + libovolný theme)
 */
export function selectStableMinigame({
  themeId,
  themeType,
  challengerHorse,
  defenderHorse,
}: SelectStableMinigameParams): StableMinigameType {
  if (challengerHorse?.isLegendary || defenderHorse?.isLegendary) {
    return "legendary_race";
  }

  const combined = `${themeId} ${themeType ?? ""}`.toLowerCase();
  if (combined.includes("car"))   return "neon_speedrace";
  if (combined.includes("horse")) return "neon_rope_duel";

  return "neon_rope_duel";
}
