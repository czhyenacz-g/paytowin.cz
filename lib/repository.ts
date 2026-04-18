/**
 * Repository — všechny Supabase volání na jednom místě.
 *
 * Pravidla:
 * - UI (komponenty) NEVOLAJÍ Supabase přímo — jde přes tento soubor.
 * - Každá funkce vrací surová data nebo void; normalizaci dělá engine.
 * - Žádné React importy.
 */

import { supabase } from "./supabase";
import type { Horse } from "./types/game";
import type { GameCard } from "./cards";
import type { OfferPending } from "./types/game";
import type { ThemeManifest } from "./themes/manifest";

// ─── Hry ──────────────────────────────────────────────────────────────────────

export async function fetchGameByCode(code: string) {
  const { data } = await supabase.from("games").select().eq("code", code).single();
  return data;
}

export async function updateGameStatus(gameId: string, status: "waiting" | "playing" | "finished" | "cancelled") {
  await supabase.from("games").update({ status }).eq("id", gameId);
}

// ─── Hráči ────────────────────────────────────────────────────────────────────

export async function fetchPlayers(gameId: string) {
  const { data } = await supabase.from("players").select().eq("game_id", gameId).order("turn_order");
  return data ?? [];
}

export async function updatePlayerPosition(playerId: string, position: number, coins: number) {
  await supabase.from("players").update({ position, coins }).eq("id", playerId);
}

export async function updatePlayerCoins(playerId: string, coins: number) {
  await supabase.from("players").update({ coins }).eq("id", playerId);
}

export async function updatePlayerHorsesAndCoins(playerId: string, coins: number, horses: Horse[]) {
  await supabase.from("players").update({ coins, horses }).eq("id", playerId);
}

export async function updatePlayerSkipTurn(playerId: string, value: boolean) {
  await supabase.from("players").update({ skip_next_turn: value }).eq("id", playerId);
}

export async function updatePlayerFull(
  playerId: string,
  update: { position?: number; coins?: number; horses?: Horse[]; skip_next_turn?: boolean; laps?: number }
) {
  await supabase.from("players").update(update).eq("id", playerId);
}

// ─── Herní stav ───────────────────────────────────────────────────────────────

export type GameStateUpdate = {
  current_player_index?: number;
  last_roll?: number | null;
  log?: string[];
  turn_count?: number;
  horse_pending?: boolean;
  card_pending?: GameCard | null | Record<string, unknown>;
  offer_pending?: OfferPending | null | Record<string, unknown>;
};

export async function fetchGameState(gameId: string) {
  const { data } = await supabase.from("game_state").select().eq("game_id", gameId).single();
  return data;
}

export async function updateGameState(gameId: string, update: GameStateUpdate) {
  await supabase.from("game_state").update(update as Record<string, unknown>).eq("game_id", gameId);
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export function subscribeToGame(
  gameId: string,
  handlers: {
    onGameUpdate: (payload: { new: Record<string, unknown> }) => void;
    onPlayersChange: () => void;
    onGameStateUpdate: () => void;
  }
) {
  return supabase
    .channel(`game:${gameId}`)
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "games", filter: `id=eq.${gameId}` },
      handlers.onGameUpdate as Parameters<ReturnType<typeof supabase.channel>["on"]>[2]
    )
    .on("postgres_changes", { event: "*", schema: "public", table: "players", filter: `game_id=eq.${gameId}` },
      handlers.onPlayersChange as Parameters<ReturnType<typeof supabase.channel>["on"]>[2]
    )
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "game_state", filter: `game_id=eq.${gameId}` },
      handlers.onGameStateUpdate as Parameters<ReturnType<typeof supabase.channel>["on"]>[2]
    )
    .subscribe();
}

export function unsubscribeChannel(channel: ReturnType<typeof supabase.channel>) {
  supabase.removeChannel(channel);
}

// ─── Themes ───────────────────────────────────────────────────────────────────

/**
 * getThemeFromDb — načte ThemeManifest z DB podle id.
 *
 * Vrátí null pokud theme v DB neexistuje nebo při chybě.
 * Volající (loadThemeManifestAsync) se stará o fallback.
 */
export async function getThemeFromDb(id: string): Promise<ThemeManifest | null> {
  const { data, error } = await supabase
    .from("themes")
    .select("manifest")
    .eq("id", id)
    .single();

  if (error || !data) return null;
  return data.manifest as ThemeManifest;
}

/**
 * upsertThemeToDb — uloží nebo přepíše ThemeManifest v DB.
 *
 * Používej pro seeding zabudovaných themes nebo uložení z theme builderu.
 * id je převzato z manifest.meta.id.
 */
export async function upsertThemeToDb(
  manifest: ThemeManifest,
  opts?: { createdBy?: string; isPublic?: boolean; isOfficial?: boolean }
): Promise<void> {
  await supabase.from("themes").upsert({
    id: manifest.meta.id,
    manifest: manifest as unknown as Record<string, unknown>,
    created_by: opts?.createdBy ?? null,
    is_public: opts?.isPublic ?? false,
    is_official: opts?.isOfficial ?? false,
  });
}
