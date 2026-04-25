/**
 * lib/legendary/presets.ts — pojmenované dev presety pro Legendary Horse Race.
 *
 * Tyto id jsou stabilní dev tuning API. Nepřejmenovávat bez důvodu.
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
    description: "Vyvážená hra. Různé výšky překážek, 15% double.",
    config: {
      arenaW: 560, arenaH: 340,
      maxTicks: 200, tickMs: 80,
      obstacleInterval: 40, obstacleVariance: 20,
      jumpDuration: 18, jumpCooldown: 12,
      stumbleDuration: 12, crashPenalty: 50, clearBonus: 30,
      distancePerTick: 3,
      jumpMaxHeight: 120,
      baseGap: 130,
      doubleChance: 0.15,
    },
  },
  {
    id: "legendary.horse-fast",
    label: "Fast",
    description: "Rychlý běh, 20% double překážky. Reflexy.",
    config: {
      arenaW: 560, arenaH: 340,
      maxTicks: 180, tickMs: 55,
      obstacleInterval: 28, obstacleVariance: 12,
      jumpDuration: 15, jumpCooldown: 10,
      stumbleDuration: 8, crashPenalty: 60, clearBonus: 40,
      distancePerTick: 4,
      jumpMaxHeight: 105,
      baseGap: 110,
      doubleChance: 0.20,
    },
  },
  {
    id: "legendary.horse-chaos",
    label: "Chaos",
    description: "35% double, velké penalizace. Plný chaos.",
    config: {
      arenaW: 560, arenaH: 340,
      maxTicks: 220, tickMs: 80,
      obstacleInterval: 22, obstacleVariance: 45,
      jumpDuration: 18, jumpCooldown: 8,
      stumbleDuration: 16, crashPenalty: 80, clearBonus: 50,
      distancePerTick: 3,
      jumpMaxHeight: 130,
      baseGap: 100,
      doubleChance: 0.35,
    },
  },
];
