"use server";

import { supabase } from "@/lib/supabase";

// XP awards per placement
const XP_BASE    = 50;
const XP_WINNER  = 100;
const XP_SECOND  = 50;
const XP_THIRD   = 25;

/**
 * awardXpAction — přidělí XP hráčům po dokončení hry.
 * Volá se jen jednou díky guard sloupci games.xp_awarded.
 * Pracuje jen s Discord-ověřenými hráči (discord_id NOT NULL).
 */
export async function awardXpAction(
  gameId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!gameId) return { ok: false, error: "gameId chybí" };

  // Načti hru — zkontroluj guard a status
  const { data: game, error: gameErr } = await supabase
    .from("games")
    .select("id, status, xp_awarded")
    .eq("id", gameId)
    .single();

  if (gameErr || !game) return { ok: false, error: gameErr?.message ?? "Hra nenalezena" };
  if (game.status !== "finished") return { ok: false, error: "Hra ještě neskončila" };
  if (game.xp_awarded) return { ok: false, error: "XP již bylo uděleno" };

  // Načti hráče + game_state (bust_order)
  const [playersRes, gsRes] = await Promise.all([
    supabase.from("players").select("id, discord_id, coins").eq("game_id", gameId),
    supabase.from("game_state").select("bust_order").eq("game_id", gameId).single(),
  ]);

  if (playersRes.error) return { ok: false, error: playersRes.error.message };
  if (gsRes.error)      return { ok: false, error: gsRes.error.message };

  const players   = playersRes.data ?? [];
  const bustOrder: string[] = (gsRes.data?.bust_order as string[]) ?? [];

  // Urči pořadí: winner = hráč s coins > 0, bust_order last = 2nd, second-to-last = 3rd
  const winner = players.find(p => (p.coins ?? 0) > 0);

  // Sestaví mapu discord_id → XP
  const xpMap = new Map<string, number>();

  const addXp = (discordId: string | null | undefined, xp: number) => {
    if (!discordId) return;
    xpMap.set(discordId, (xpMap.get(discordId) ?? 0) + xp);
  };

  // Základní XP pro všechny Discord hráče
  for (const p of players) {
    addXp(p.discord_id, XP_BASE);
  }

  // Výherce
  addXp(winner?.discord_id, XP_WINNER);

  // 2. místo = poslední v bust_order (nejpozději zbankrotoval)
  if (bustOrder.length >= 1) {
    const secondId = bustOrder[bustOrder.length - 1];
    const second = players.find(p => p.id === secondId);
    addXp(second?.discord_id, XP_SECOND);
  }

  // 3. místo = předposlední v bust_order
  if (bustOrder.length >= 2) {
    const thirdId = bustOrder[bustOrder.length - 2];
    const third = players.find(p => p.id === thirdId);
    addXp(third?.discord_id, XP_THIRD);
  }

  // Upsert do user_profiles — XP pro všechny + výhra pro vítěze
  for (const [discordId, xp] of xpMap.entries()) {
    const isWinner = discordId === winner?.discord_id;
    const { error } = await supabase.rpc("increment_xp_and_wins", {
      p_discord_id: discordId,
      p_xp: xp,
      p_win: isWinner,
    });
    if (error) return { ok: false, error: `XP upsert selhal pro ${discordId}: ${error.message}` };
  }

  // Označ hru jako xp_awarded
  const { error: markErr } = await supabase
    .from("games")
    .update({ xp_awarded: true })
    .eq("id", gameId);

  if (markErr) return { ok: false, error: markErr.message };

  return { ok: true };
}
