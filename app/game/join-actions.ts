"use server";

import { supabase } from "@/lib/supabase";
import { PLAYER_COLORS } from "@/lib/game";
import { DEFAULT_STARTING_COINS } from "@/lib/game-constants";

// ─── Typy ────────────────────────────────────────────────────────────────────

export type RequestJoinResult =
  | { ok: true;  status: "pending" | "approved"; requestId: string }
  | { ok: false; reason:
      | "approval_not_required"  // hra nemá require_approval
      | "game_not_found"
      | "game_unavailable"       // cancelled nebo finished
      | "already_rejected"       // existující request je rejected — musí owner reinstate
      | "insert_failed"
    }

export type ApproveJoinResult =
  | { ok: true;  playerId: string }
  | { ok: false; reason:
      | "request_not_found"
      | "not_owner"
      | "not_pending"
      | "game_full"
      | "game_unavailable"
      | "player_insert_failed"
    }

export type RejectJoinResult =
  | { ok: true }
  | { ok: false; reason: "request_not_found" | "not_owner" | "already_approved" }

export type ReinstateJoinResult =
  | { ok: true;  status: "pending" }
  | { ok: false; reason: "request_not_found" | "not_owner" | "already_approved" }

export type CheckJoinStatusResult =
  | { ok: true;  status: "pending" }
  | { ok: true;  status: "rejected" }
  | { ok: true;  status: "approved"; playerId: string; gameCode: string }
  | { ok: false; reason: "not_found" | "no_discord_id" | "approved_but_player_missing" }

// ─── requestJoinAction ────────────────────────────────────────────────────────

/**
 * Hráč podá žádost o připojení.
 * Pokud hra nemá require_approval, akce vrátí ok:false + reason:"approval_not_required"
 * — caller se může rovnou řídit standardním join flow.
 */
export async function requestJoinAction(params: {
  gameCode:          string;
  name:              string;
  discordId?:        string | null;
  discordAvatarUrl?: string | null;
}): Promise<RequestJoinResult> {
  const { gameCode, name, discordId = null, discordAvatarUrl = null } = params;

  // Najdi hru
  const { data: game, error: gameErr } = await supabase
    .from("games")
    .select("id, status, require_approval, owner_discord_id")
    .eq("code", gameCode.toUpperCase())
    .single();

  if (gameErr || !game) {
    return { ok: false, reason: "game_not_found" };
  }

  if (game.status === "cancelled" || game.status === "finished") {
    return { ok: false, reason: "game_unavailable" };
  }

  if (!game.require_approval) {
    return { ok: false, reason: "approval_not_required" };
  }

  // Zkontroluj existující request (jen pro Discord hráče — anon nemá unikátní identitu)
  if (discordId) {
    const { data: existing } = await supabase
      .from("game_join_requests")
      .select("id, status")
      .eq("game_id", game.id)
      .eq("discord_id", discordId)
      .maybeSingle();

    if (existing) {
      if (existing.status === "pending" || existing.status === "approved") {
        return { ok: true, status: existing.status as "pending" | "approved", requestId: existing.id };
      }
      if (existing.status === "rejected") {
        return { ok: false, reason: "already_rejected" };
      }
    }
  }

  // Vlož nový request
  const { data: req, error: insertErr } = await supabase
    .from("game_join_requests")
    .insert({
      game_id:            game.id,
      name:               name.trim(),
      discord_id:         discordId,
      discord_avatar_url: discordAvatarUrl,
    })
    .select("id")
    .single();

  if (insertErr || !req) {
    console.error("[requestJoinAction] insert failed:", insertErr?.message);
    return { ok: false, reason: "insert_failed" };
  }

  return { ok: true, status: "pending", requestId: req.id };
}

// ─── approveJoinRequestAction ─────────────────────────────────────────────────

/**
 * Owner schválí žádost — přidá hráče do players a označí request jako approved.
 * Před insertem znovu ověří kapacitu hry (guard proti race condition).
 */
export async function approveJoinRequestAction(
  requestId:         string,
  reviewerDiscordId: string,
): Promise<ApproveJoinResult> {

  // Načti request + hru najednou
  const { data: req, error: reqErr } = await supabase
    .from("game_join_requests")
    .select("id, game_id, name, discord_id, discord_avatar_url, status")
    .eq("id", requestId)
    .single();

  if (reqErr || !req) {
    return { ok: false, reason: "request_not_found" };
  }

  const { data: game, error: gameErr } = await supabase
    .from("games")
    .select("id, status, owner_discord_id, max_players, code, economy")
    .eq("id", req.game_id)
    .single();

  if (gameErr || !game) {
    return { ok: false, reason: "request_not_found" };
  }

  // Owner check
  if (!reviewerDiscordId || game.owner_discord_id !== reviewerDiscordId) {
    return { ok: false, reason: "not_owner" };
  }

  // Hra musí být přijatelná
  if (game.status === "cancelled" || game.status === "finished") {
    return { ok: false, reason: "game_unavailable" };
  }

  // Pending guard — idempotence pokud je request pending
  if (req.status !== "pending") {
    return { ok: false, reason: "not_pending" };
  }

  // Znovu spočítej hráče — ochrana před race condition
  const { data: currentPlayers } = await supabase
    .from("players")
    .select("id")
    .eq("game_id", game.id);

  const playerCount = currentPlayers?.length ?? 0;
  const maxP = game.max_players ?? 32;

  if (playerCount >= maxP) {
    return { ok: false, reason: "game_full" };
  }

  const turnOrder = playerCount;
  const color = PLAYER_COLORS[turnOrder % PLAYER_COLORS.length];
  const gameEconomy = game.economy as { startingCoins?: number } | null;
  const joinStartingCoins = gameEconomy?.startingCoins ?? DEFAULT_STARTING_COINS;

  // Insert hráče
  const { data: newPlayer, error: playerErr } = await supabase
    .from("players")
    .insert({
      game_id:            game.id,
      name:               req.name,
      color,
      position:           0,
      coins:              joinStartingCoins,
      horses:             [],
      turn_order:         turnOrder,
      discord_id:         req.discord_id ?? null,
      discord_avatar_url: req.discord_avatar_url ?? null,
      is_bot:             false,
    })
    .select("id")
    .single();

  if (playerErr || !newPlayer) {
    console.error("[approveJoinRequestAction] player insert failed:", playerErr?.message);
    return { ok: false, reason: "player_insert_failed" };
  }

  // Označ request jako schválený
  await supabase
    .from("game_join_requests")
    .update({ status: "approved", reviewed_at: new Date().toISOString() })
    .eq("id", requestId);

  return { ok: true, playerId: newPlayer.id };
}

// ─── rejectJoinRequestAction ──────────────────────────────────────────────────

/**
 * Owner odmítne žádost.
 * Idempotentní: rejected → rejected je ok.
 * Approved → chyba (nechceme omylem rušit schváleného hráče).
 */
export async function rejectJoinRequestAction(
  requestId:         string,
  reviewerDiscordId: string,
): Promise<RejectJoinResult> {

  const { data: req, error: reqErr } = await supabase
    .from("game_join_requests")
    .select("id, game_id, status")
    .eq("id", requestId)
    .single();

  if (reqErr || !req) {
    return { ok: false, reason: "request_not_found" };
  }

  const { data: game } = await supabase
    .from("games")
    .select("owner_discord_id")
    .eq("id", req.game_id)
    .single();

  if (!game || game.owner_discord_id !== reviewerDiscordId) {
    return { ok: false, reason: "not_owner" };
  }

  if (req.status === "approved") {
    return { ok: false, reason: "already_approved" };
  }

  // pending → rejected; rejected → idempotentně ok
  if (req.status === "pending") {
    await supabase
      .from("game_join_requests")
      .update({ status: "rejected", reviewed_at: new Date().toISOString() })
      .eq("id", requestId);
  }

  return { ok: true };
}

// ─── reinstateJoinRequestAction ───────────────────────────────────────────────

/**
 * Owner obnoví odmítnutou žádost zpět na pending.
 * Idempotentní: pending → pending je ok.
 * Approved → chyba (hráč je already ve hře).
 */
export async function reinstateJoinRequestAction(
  requestId:         string,
  reviewerDiscordId: string,
): Promise<ReinstateJoinResult> {

  const { data: req, error: reqErr } = await supabase
    .from("game_join_requests")
    .select("id, game_id, status")
    .eq("id", requestId)
    .single();

  if (reqErr || !req) {
    return { ok: false, reason: "request_not_found" };
  }

  const { data: game } = await supabase
    .from("games")
    .select("owner_discord_id")
    .eq("id", req.game_id)
    .single();

  if (!game || game.owner_discord_id !== reviewerDiscordId) {
    return { ok: false, reason: "not_owner" };
  }

  if (req.status === "approved") {
    return { ok: false, reason: "already_approved" };
  }

  // rejected → pending; pending → idempotentně ok
  if (req.status === "rejected") {
    await supabase
      .from("game_join_requests")
      .update({ status: "pending", reviewed_at: null })
      .eq("id", requestId);
  }

  return { ok: true, status: "pending" };
}

// ─── checkJoinRequestStatusAction ────────────────────────────────────────────

/**
 * Žadatel zkontroluje stav své žádosti.
 * Vyžaduje discordId — anon hráči nepoužívají approval flow.
 * Pokud je approved, najde players row a vrátí playerId + gameCode pro redirect.
 */
export async function checkJoinRequestStatusAction(params: {
  gameCode:  string;
  discordId: string;
}): Promise<CheckJoinStatusResult> {
  const { gameCode, discordId } = params;

  if (!discordId) {
    return { ok: false, reason: "no_discord_id" };
  }

  const { data: game } = await supabase
    .from("games")
    .select("id, code")
    .eq("code", gameCode.toUpperCase())
    .single();

  if (!game) {
    return { ok: false, reason: "not_found" };
  }

  const { data: req } = await supabase
    .from("game_join_requests")
    .select("id, status")
    .eq("game_id", game.id)
    .eq("discord_id", discordId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!req) {
    return { ok: false, reason: "not_found" };
  }

  if (req.status === "pending") {
    return { ok: true, status: "pending" };
  }

  if (req.status === "rejected") {
    return { ok: true, status: "rejected" };
  }

  // approved → najdi player row
  const { data: player } = await supabase
    .from("players")
    .select("id")
    .eq("game_id", game.id)
    .eq("discord_id", discordId)
    .maybeSingle();

  if (!player) {
    return { ok: false, reason: "approved_but_player_missing" };
  }

  return { ok: true, status: "approved", playerId: player.id, gameCode: game.code };
}
