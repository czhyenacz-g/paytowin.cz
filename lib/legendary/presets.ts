/**
 * lib/legendary/presets.ts — pojmenované dev presety pro Legendary Horse Race.
 *
 * Tyto id jsou stabilní dev tuning API. Nepřejmenovávat bez důvodu,
 * protože se na ně budou odkazovat další zadání.
 */

import type { LegendaryConfig } from "./types";

export interface LegendaryPreset {
  id: string;
  label: string;
  description: string;
  config: LegendaryConfig;
}

export const LEGENDARY_PRESETS: LegendaryPreset[] = [
  {
    id: "legendary.horse-default",
    label: "Default",
    description: "Vyvážená hra. Překážky každých ~40 kroků, 14 s run.",
    config: {
      arenaW: 560, arenaH: 200,
      maxTicks: 180, tickMs: 80,
      obstacleInterval: 40, obstacleVariance: 20,
      jumpDuration: 10, jumpCooldown: 12,
      stumbleDuration: 12, crashPenalty: 50, clearBonus: 30,
      distancePerTick: 3,
    },
  },
  {
    id: "legendary.horse-fast",
    label: "Fast",
    description: "Rychlý běh, hutnější překážky. Vyžaduje reflexy.",
    config: {
      arenaW: 560, arenaH: 200,
      maxTicks: 150, tickMs: 60,
      obstacleInterval: 28, obstacleVariance: 10,
      jumpDuration: 8, jumpCooldown: 10,
      stumbleDuration: 8, crashPenalty: 60, clearBonus: 40,
      distancePerTick: 4,
    },
  },
  {
    id: "legendary.horse-chaos",
    label: "Chaos",
    description: "Náhodné intervaly, velké penalizace. Plný chaos.",
    config: {
      arenaW: 560, arenaH: 200,
      maxTicks: 200, tickMs: 80,
      obstacleInterval: 22, obstacleVariance: 45,
      jumpDuration: 10, jumpCooldown: 8,
      stumbleDuration: 16, crashPenalty: 80, clearBonus: 50,
      distancePerTick: 3,
    },
  },
];
