import type { RacerConfig } from "@/lib/themes";
import type { RacerProfile } from "./types";
import { getBuiltinRacerProfiles } from "./seed-builtin";

export function racerProfilesToConfigs(profiles: RacerProfile[]): RacerConfig[] {
  return profiles.map((p) => ({
    id:          p.id,
    name:        p.name,
    speed:       p.speed,
    price:       p.price,
    emoji:       p.emoji,
    image:       p.imageUrl,
    maxStamina:  p.maxStamina,
    isLegendary: p.isLegendary,
    flavorText:  p.flavorText,
    isBuiltIn:   p.isBuiltin,
    racerType:   p.type,
  }));
}

/** Static fallback (no DB). */
export function getBuiltinRacerConfigs(): RacerConfig[] {
  return racerProfilesToConfigs(getBuiltinRacerProfiles());
}
