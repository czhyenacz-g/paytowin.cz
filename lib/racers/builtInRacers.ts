import type { RacerConfig } from "@/lib/themes";
import { getBuiltinRacerProfiles } from "./seed-builtin";

/**
 * Returns all built-in racers as RacerConfig[], suitable for UI components.
 * Converts RacerProfile fields (imageUrl → image, type → racerType) to RacerConfig shape.
 * Static — no DB call.
 */
export function getBuiltinRacerConfigs(): RacerConfig[] {
  return getBuiltinRacerProfiles().map((p) => ({
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
