/**
 * lib/speed/presets.ts — pojmenované dev presety pro Speed Arena.
 *
 * Tyto id jsou stabilní dev tuning API.
 * Nepřejmenovávat bez důvodu, protože se na ně budou odkazovat další zadání.
 */

import type { SpeedConfig } from "./types";

export interface SpeedPreset {
  id: string;
  label: string;
  description: string;
  config: SpeedConfig;
}

export const SPEED_PRESETS: SpeedPreset[] = [
  {
    id: "speed.default",
    label: "Default",
    description: "Vyvážená hra. Střední rychlost, standardní arena.",
    config: {
      arenaW: 440, arenaH: 300,
      maxTicks: 150, tickMs: 80,
      acceleration: 0.04, maxVelocity: 8,
      turnRate: 0.075,
      crashVelocityThreshold: 4.5,
      boostStrength: 1.5, slowStrength: 1.2,
      objectRespawnTicks: 45,
    },
  },
  {
    id: "speed.safe-learning",
    label: "Safe Learning",
    description: "Pomalá hra, vysoký crash práh. Vhodné pro testování mechanik.",
    config: {
      arenaW: 440, arenaH: 300,
      maxTicks: 200, tickMs: 120,
      acceleration: 0.02, maxVelocity: 5,
      turnRate: 0.07,
      crashVelocityThreshold: 8.0,
      boostStrength: 1.0, slowStrength: 0.8,
      objectRespawnTicks: 60,
    },
  },
  {
    id: "speed.high-risk",
    label: "High Risk",
    description: "Vysoká rychlost, nízký crash práh. Vyžaduje přesné řízení.",
    config: {
      arenaW: 440, arenaH: 300,
      maxTicks: 120, tickMs: 60,
      acceleration: 0.06, maxVelocity: 12,
      turnRate: 0.09,
      crashVelocityThreshold: 3.0,
      boostStrength: 2.0, slowStrength: 1.5,
      objectRespawnTicks: 30,
    },
  },
  {
    id: "speed.boost-heavy",
    label: "Boost Heavy",
    description: "Maximální boost efekt, rychlé respawny. Chaos.",
    config: {
      arenaW: 440, arenaH: 300,
      maxTicks: 150, tickMs: 80,
      acceleration: 0.04, maxVelocity: 10,
      turnRate: 0.075,
      crashVelocityThreshold: 5.0,
      boostStrength: 3.0, slowStrength: 0.5,
      objectRespawnTicks: 20,
    },
  },
];
