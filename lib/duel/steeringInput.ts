import type { AbsDir, Dir } from "./types";

export type ControlScheme = "wasd" | "arrows";

const WASD_TO_ABS: Partial<Record<string, AbsDir>> = {
  KeyW: "up", KeyA: "left", KeyS: "down", KeyD: "right",
};
const ARROWS_TO_ABS: Partial<Record<string, AbsDir>> = {
  ArrowUp: "up", ArrowLeft: "left", ArrowDown: "down", ArrowRight: "right",
};
const OPPOSITE: Record<AbsDir, AbsDir> = {
  up: "down", down: "up", left: "right", right: "left",
};
const ABS_LEFT_TURN: Record<AbsDir, AbsDir> = {
  up: "left", left: "down", down: "right", right: "up",
};

/**
 * Translates an absolute key press to a relative steering command
 * based on the player's current facing direction.
 * Returns null for the 180° opposite key (ignored / U-turn blocked).
 */
export function resolveRelativeDir(
  keyCode: string,
  facing: AbsDir,
  scheme: ControlScheme
): Dir | null {
  const abs = (scheme === "wasd" ? WASD_TO_ABS : ARROWS_TO_ABS)[keyCode];
  if (!abs) return null;
  if (abs === facing) return "straight";
  if (abs === OPPOSITE[facing]) return null;
  return ABS_LEFT_TURN[facing] === abs ? "left" : "right";
}

/**
 * Returns the relative Dir from currently held keys given current facing.
 * Left-turn takes priority if both a left-turn and right-turn key are held.
 */
export function dirFromHeldKeys(
  keys: ReadonlySet<string>,
  facing: AbsDir,
  scheme: ControlScheme
): Dir {
  const map = scheme === "wasd" ? WASD_TO_ABS : ARROWS_TO_ABS;
  let foundLeft = false;
  let foundRight = false;
  for (const code of Object.keys(map)) {
    if (!keys.has(code)) continue;
    const abs = map[code]!;
    if (abs === facing || abs === OPPOSITE[facing]) continue;
    if (ABS_LEFT_TURN[facing] === abs) foundLeft = true;
    else foundRight = true;
  }
  if (foundLeft) return "left";
  if (foundRight) return "right";
  return "straight";
}
