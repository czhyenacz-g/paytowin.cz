import { isBankrupt, getStartTax } from "./engine";
import { DEFAULT_ECONOMY } from "./types/game";
import type { Player, EconomyConfig } from "./types/game";

export interface PlayerMarker {
  emoji: string;
  title: string;
}

const LOW_STAMINA_THRESHOLD = 30;

export function getPlayerStateMarkers(
  player: Player,
  allPlayers: Player[],
  economy: Partial<EconomyConfig> = DEFAULT_ECONOMY
): PlayerMarker[] {
  if (isBankrupt(player)) return [];

  const markers: PlayerMarker[] = [];
  const activePlayers = allPlayers.filter((p) => !isBankrupt(p));

  // 👑 Richest among active players (skip if sole survivor)
  if (activePlayers.length > 1) {
    const maxCoins = Math.max(...activePlayers.map((p) => p.coins));
    if (player.coins === maxCoins) {
      markers.push({ emoji: "👑", title: "Nejbohatší hráč" });
    }
  }

  // 💀 Near bankruptcy — coins below next START tax (min 500)
  const nextTax = getStartTax((player.laps ?? 0) + 1, economy);
  const bankruptThreshold = Math.max(500, nextTax);
  if (player.coins > 0 && player.coins < bankruptThreshold) {
    markers.push({ emoji: "💀", title: "Na hraně bankrotu" });
  }

  // ⚠️ Any owned racer below stamina threshold
  const hasLowStamina = player.horses.some(
    (h) => (h.stamina ?? h.maxStamina ?? 100) < LOW_STAMINA_THRESHOLD
  );
  if (hasLowStamina) {
    markers.push({ emoji: "⚠️", title: "Závodník má nízkou staminu" });
  }

  return markers;
}
