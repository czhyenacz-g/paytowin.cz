import type { RacerProfile } from "./types";

export type RacerSpecies = "horse" | "lama" | "camel" | "car";
export type RacerCategory = "game" | "legend" | "perma";
export type RacerUniqueStatus = "draft" | "reserved" | "owned" | "archived";
export type RacerSaleStatus = "offered" | "sold" | "reserved" | "draft" | "hidden";
export type RacerAvailabilityStatus = "available" | "resting" | "exhausted" | "racing" | "reserved" | "draft";

export interface PermaRacerLike {
  owner_user_id: string | null;
  status: RacerUniqueStatus;
  sale_status: RacerSaleStatus;
  availability_status: RacerAvailabilityStatus;
  species_id: RacerSpecies;
  category: RacerCategory;
}

export function isGamePoolRacerProfile(racer: Pick<RacerProfile, "isLegendary" | "ownerId" | "type">): boolean {
  return !racer.isLegendary && !racer.ownerId && ["horse", "lama", "camel", "car"].includes(racer.type);
}

export function isLegendPoolRacerProfile(racer: Pick<RacerProfile, "isLegendary" | "type">): boolean {
  return Boolean(racer.isLegendary) && ["horse", "lama", "camel", "car"].includes(racer.type);
}

export function filterGamePoolRacers(racers: RacerProfile[], species?: RacerSpecies): RacerProfile[] {
  return racers.filter((r) => isGamePoolRacerProfile(r) && (!species || r.type === species));
}

export function filterLegendPoolRacers(racers: RacerProfile[], species?: RacerSpecies): RacerProfile[] {
  return racers.filter((r) => isLegendPoolRacerProfile(r) && (!species || r.type === species));
}

export function canMutatePermaRacerOwnership(
  existing: Pick<PermaRacerLike, "owner_user_id" | "status" | "sale_status">,
  userId: string,
): { ok: true } | { ok: false; error: string } {
  if (existing.owner_user_id && existing.owner_user_id !== userId) {
    return { ok: false, error: "Perma racer už vlastní jiný hráč." };
  }
  if (existing.status === "owned" && existing.owner_user_id !== userId) {
    return { ok: false, error: "Perma racer už je prodaný." };
  }
  if (existing.sale_status === "sold" && existing.owner_user_id !== userId) {
    return { ok: false, error: "Perma racer už je prodaný." };
  }
  return { ok: true };
}
