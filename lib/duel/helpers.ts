/**
 * lib/duel/helpers.ts — Speed-based helpers for Rope Duel.
 * Speed scale: 1–10 (1 = very slow, 5 = average, 10 = legendary).
 */

export function getRopeDuelStartDelayTicks(speed: number): number {
  return speed >= 7 ? 0 : 1;
}

// gridW kept in signature for call-site compatibility; not used in new model.
export function getRopeDuelNitroDashTiles(speed: number, _gridW: number): number {
  if (speed >= 10) return 8;
  if (speed >= 7)  return 6;
  if (speed >= 4)  return 4;
  return 2;
}

export function getRopeDuelNitroCooldownTicks(speed: number): number {
  if (speed >= 10) return 3;
  if (speed >= 7)  return 7;
  if (speed >= 4)  return 12;
  return 18;
}

export interface RopeDuelSpeedLabel {
  start: string;
  nitro: string;
}

export function getRopeDuelSpeedLabel(speed: number): RopeDuelSpeedLabel {
  if (speed >= 10) return { start: "bleskový", nitro: "legendární" };
  if (speed >= 7)  return { start: "rychlý",   nitro: "silné" };
  if (speed >= 4)  return { start: "průměr",   nitro: "dobré" };
  return               { start: "pomalý",    nitro: "slabé" };
}
