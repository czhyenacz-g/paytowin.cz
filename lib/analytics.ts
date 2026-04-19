/**
 * Thin event-tracking wrapper over @vercel/analytics.
 * Call logEvent() from client components — track() requires browser context.
 */
import { track } from "@vercel/analytics";

export type AppEvent =
  | { name: "create_game_success"; game_code: string; theme_id: string; board_id: string }
  | { name: "create_game_fail";    reason: string }
  | { name: "join_game_success";   game_code: string }
  | { name: "join_game_fail";      reason: string }
  | { name: "spectator_view";      game_code: string }
  | { name: "game_finish";         game_code: string; winner: string }
  | { name: "duel_start";          game_code: string; race_type: string }
  | { name: "duel_finish";         game_code: string; race_type: string; winner: string };

export function logEvent(event: AppEvent): void {
  const { name, ...props } = event;
  // fire-and-forget — never throw, never block
  try { track(name, props as Record<string, string>); } catch { /* ignore */ }
}
