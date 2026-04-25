/**
 * lib/duel/helpers.ts — Speed-based helpers for Rope Duel.
 * Speed scale: 1–10 (1 = very slow, 5 = average, 10 = legendary).
 */

export function getRopeDuelStartDelayTicks(speed: number): number {
  if (speed >= 9) return 0;
  if (speed >= 7) return 1;
  if (speed >= 5) return 2;
  if (speed >= 3) return 3;
  return 4;
}

export function getRopeDuelNitroDashTiles(speed: number, gridW: number): number {
  const base  = Math.max(3, Math.floor(gridW / 10));
  const bonus = speed >= 9 ? 3 : speed >= 7 ? 2 : speed >= 5 ? 1 : speed >= 3 ? 0 : -1;
  return Math.min(7, Math.max(2, base + bonus));
}

export interface RopeDuelSpeedLabel {
  start: string;
  nitro: string;
}

export function getRopeDuelSpeedLabel(speed: number): RopeDuelSpeedLabel {
  if (speed >= 9) return { start: "bleskový",  nitro: "legendární" };
  if (speed >= 7) return { start: "rychlý",    nitro: "silné" };
  if (speed >= 5) return { start: "průměr",    nitro: "dobré" };
  if (speed >= 3) return { start: "pomalejší", nitro: "krátké" };
  return               { start: "těžký",      nitro: "slabé" };
}
