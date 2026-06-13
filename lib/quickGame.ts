import { supabase } from "@/lib/supabase";
import { generateGameCode, PLAYER_COLORS } from "@/lib/game";
import { DEFAULT_STARTING_COINS } from "@/lib/game-constants";

const GUEST_ADJECTIVES = [
  "Rychlý", "Statečný", "Chytrý", "Šikovný", "Drzý",
  "Šťastný", "Odvážný", "Hladový", "Zuřivý", "Tichý",
];
const GUEST_NOUNS = [
  "Jezdec", "Závodník", "Hráč", "Sázkař", "Dobrodruh",
  "Hospodský", "Strýc", "Podnikatel", "Spekulant", "Nováček",
];

function generateGuestName(): string {
  const adj = GUEST_ADJECTIVES[Math.floor(Math.random() * GUEST_ADJECTIVES.length)];
  const noun = GUEST_NOUNS[Math.floor(Math.random() * GUEST_NOUNS.length)];
  const num = Math.floor(Math.random() * 99) + 1;
  return `${adj} ${noun} ${num}`;
}

const QUICK_BOT_NAMES = ["Závodiště bot", "Stájový bot"];

export type QuickGameResult =
  | { ok: true; gameCode: string; playerId: string }
  | { ok: false; reason: string };

/**
 * Vytvoří quick game: 1 host + 2 boti, výchozí mapa horse-day, game_mode=online.
 * Ukládá playerId do localStorage. Kompatibilní s invite/join flow.
 */
export async function createQuickGame(): Promise<QuickGameResult> {
  const code = generateGameCode();
  const startingCoins = DEFAULT_STARTING_COINS;

  const { data: game, error: gameErr } = await supabase
    .from("games")
    .insert({
      code,
      status: "waiting",
      theme_id: "horse-day",
      board_id: "small-stadium",
      game_mode: "online",
      owner_discord_id: null,
      max_players: 6,
      economy: {
        stateSubsidy: 2000,
        baseTax: 500,
        lapTaxCoefficient: 1,
        maxTax: 5000,
        startingCoins,
      },
      fog_of_war: true,
    })
    .select()
    .single();

  if (gameErr || !game) {
    return { ok: false, reason: gameErr?.message ?? "game_insert_failed" };
  }

  const { data: guestPlayer, error: playerErr } = await supabase
    .from("players")
    .insert({
      game_id: game.id,
      name: generateGuestName(),
      color: PLAYER_COLORS[0],
      position: 0,
      coins: startingCoins,
      horses: [],
      turn_order: 0,
      is_bot: false,
      discord_id: null,
      discord_avatar_url: null,
    })
    .select()
    .single();

  if (playerErr || !guestPlayer) {
    return { ok: false, reason: playerErr?.message ?? "player_insert_failed" };
  }

  const { error: botsErr } = await supabase.from("players").insert(
    QUICK_BOT_NAMES.map((name, i) => ({
      game_id: game.id,
      name,
      color: PLAYER_COLORS[i + 1],
      position: 0,
      coins: startingCoins,
      horses: [],
      turn_order: i + 1,
      is_bot: true,
      discord_id: null,
      discord_avatar_url: null,
    }))
  );

  if (botsErr) {
    return { ok: false, reason: botsErr.message ?? "bots_insert_failed" };
  }

  const { error: stateErr } = await supabase.from("game_state").insert({
    game_id: game.id,
    current_player_index: 0,
    last_roll: null,
    log: [],
  });

  if (stateErr) {
    return { ok: false, reason: stateErr.message ?? "state_insert_failed" };
  }

  if (typeof window !== "undefined") {
    localStorage.setItem(`paytowin_player_${code}`, guestPlayer.id);
  }

  return { ok: true, gameCode: code, playerId: guestPlayer.id };
}
