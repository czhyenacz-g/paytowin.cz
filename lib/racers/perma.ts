import type { Horse } from "@/lib/types/game";
import type { RacerSpecies, PermaRacer, RacerUniqueDetail } from "./catalog";

export interface GameRacerOverrideCandidate {
  id: string;
  name: string;
  species: RacerSpecies;
  poolType?: "game" | "legend" | "perma";
  category?: string | null;
  image?: string | null;
  rarity?: string | null;
  isLegendary?: boolean;
  availability_status?: string | null;
  sourceTemplateId?: string | null;
}

export interface PermaRacerOverrideView {
  isPermaOverride: true;
  gameRacerId: string;
  gameRacerName: string;
  gameRacerImage: string | null;
  permaRacerId: string;
  permaRacerName: string;
  frontImage: string | null;
  sideImage: string | null;
  tokenImage: string | null;
  badgeImage: string | null;
  rarity: string;
  species: RacerSpecies;
}

function isUnavailableForOverride(status?: string | null): boolean {
  return status === "resting" || status === "exhausted" || status === "racing" || status === "in_race";
}

export function canUsePermaRacerAsOverride(
  ownedRacer: Pick<PermaRacer, "owner_user_id" | "status" | "sale_status" | "availability_status" | "species_id" | "category">,
  gameRacer: GameRacerOverrideCandidate,
  userId: string,
): boolean {
  if (!ownedRacer.owner_user_id || ownedRacer.owner_user_id !== userId) return false;
  if (ownedRacer.status !== "owned") return false;
  if (ownedRacer.sale_status === "sold" && ownedRacer.owner_user_id !== userId) return false;
  if (isUnavailableForOverride(ownedRacer.availability_status)) return false;
  if (ownedRacer.species_id !== gameRacer.species) return false;
  if (gameRacer.category && gameRacer.category !== ownedRacer.category) return false;
  if (gameRacer.poolType && gameRacer.poolType !== "game") return false;
  if (gameRacer.isLegendary) return false;
  if (gameRacer.availability_status && isUnavailableForOverride(gameRacer.availability_status)) return false;
  return true;
}

export function applyPermaRacerOverride(
  gameRacer: GameRacerOverrideCandidate,
  ownedRacer: RacerUniqueDetail,
  userId: string,
): PermaRacerOverrideView | null {
  if (!canUsePermaRacerAsOverride(ownedRacer, gameRacer, userId)) return null;

  return {
    isPermaOverride: true,
    gameRacerId: gameRacer.id,
    gameRacerName: gameRacer.name,
    gameRacerImage: gameRacer.image ?? null,
    permaRacerId: ownedRacer.id,
    permaRacerName: ownedRacer.name,
    frontImage: ownedRacer.front_image_path,
    sideImage: ownedRacer.side_image_path ?? ownedRacer.token_image_path,
    tokenImage: ownedRacer.token_image_path,
    badgeImage: ownedRacer.badge_icon_path,
    rarity: ownedRacer.rarity,
    species: ownedRacer.species_id,
  };
}

export function getPermaOverrideDisplayName(view: PermaRacerOverrideView): string {
  return view.permaRacerName;
}
