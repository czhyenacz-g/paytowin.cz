/**
 * lib/duel/presets.ts — pojmenované dev presety pro Neon Rope Duel.
 *
 * Tyto id jsou stabilní dev tuning API.
 * Nepřejmenovávat bez důvodu, protože se na ně budou odkazovat další zadání.
 */

import type { DuelConfig } from "./types";

export interface DuelPreset {
  id: string;
  label: string;
  description: string;
  config: DuelConfig;
}

export const DUEL_PRESETS: DuelPreset[] = [
  {
    id: "duel.default",
    label: "Default",
    description: "Standardní grid 28×20, střední tempo.",
    config: { gridW: 28, gridH: 20, maxTicks: 200, tickMs: 120 },
  },
  {
    id: "duel.slow-learning",
    label: "Slow Learning",
    description: "Menší grid, pomalé tempo. Pro ladění AI a mechanik.",
    config: { gridW: 20, gridH: 14, maxTicks: 300, tickMs: 200 },
  },
  {
    id: "duel.fast-chaos",
    label: "Fast Chaos",
    description: "Velká arena, velmi rychlé tiky. Vysoké riziko.",
    config: { gridW: 40, gridH: 29, maxTicks: 400, tickMs: 60 },
  },
  {
    id: "duel.large-arena",
    label: "Large Arena",
    description: "Velká arena, standardní tempo. Delší partie.",
    config: { gridW: 40, gridH: 29, maxTicks: 300, tickMs: 120 },
  },
];
