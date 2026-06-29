import { describe, expect, it } from "vitest";
import {
  canMutatePermaRacerOwnership,
  filterGamePoolRacers,
  filterLegendPoolRacers,
} from "./catalog-logic";
import { applyPermaRacerOverride } from "./perma";
import { canUsePermaRacerAsOverride } from "./perma";
import type { RacerProfile } from "./types";

const gameRacers: RacerProfile[] = [
  { id: "g1", name: "Běžný kůň", speed: 6, price: 100, emoji: "🐎", maxStamina: 80, isLegendary: false, type: "horse", isBuiltin: true, isPublic: true },
  { id: "l1", name: "Legenda", speed: 9, price: 999, emoji: "🏆", maxStamina: 90, isLegendary: true, type: "horse", isBuiltin: true, isPublic: true },
  { id: "o1", name: "Owned", speed: 7, price: 120, emoji: "🐎", maxStamina: 70, isLegendary: false, type: "horse", isBuiltin: false, isPublic: true, ownerId: "u1" },
];

const ownedPerma = {
  id: "u-perma",
  template_id: "tpl-perma",
  owner_user_id: "u1" as const,
  name: "Blesk z Pastvin",
  slug: "blesk-z-pastvin",
  status: "owned" as const,
  sale_status: "sold" as const,
  category: "perma" as const,
  species_id: "horse" as const,
  rarity: "epic",
  description: null,
  stamina_current: 70,
  stamina_max: 100,
  availability_status: "available" as const,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const ownedPermaDetail = {
  ...ownedPerma,
  template_name: "Template",
  template_description: null,
  front_image_path: "/front.webp",
  side_image_path: "/side.webp",
  token_image_path: null,
  badge_icon_path: "/badge.webp",
};

describe("catalog pool guards", () => {
  it("getGamePoolRacers equivalent helper excludes legendaries and owned racers", () => {
    expect(filterGamePoolRacers(gameRacers)).toHaveLength(1);
    expect(filterGamePoolRacers(gameRacers)[0]?.id).toBe("g1");
  });

  it("getLegendPoolRacers equivalent helper returns only legendaries", () => {
    expect(filterLegendPoolRacers(gameRacers)).toHaveLength(1);
    expect(filterLegendPoolRacers(gameRacers)[0]?.id).toBe("l1");
  });
});

describe("perma ownership guards", () => {
  it("blocks mutation by a foreign owner", () => {
    const result = canMutatePermaRacerOwnership(ownedPerma, "u2");
    expect(result.ok).toBe(false);
  });

  it("allows mutation for the owner", () => {
    const result = canMutatePermaRacerOwnership(ownedPerma, "u1");
    expect(result.ok).toBe(true);
  });
});

describe("perma override", () => {
  it("accepts matching species and owner", () => {
    const candidate = { id: "g1", name: "Běžný kůň", species: "horse" as const, poolType: "game" as const, category: "perma", image: null, isLegendary: false, availability_status: "available" };
    expect(canUsePermaRacerAsOverride(ownedPerma, candidate, "u1")).toBe(true);
  });

  it("rejects different species", () => {
    const candidate = { id: "g1", name: "Běžný kůň", species: "car" as const, poolType: "game" as const, category: "perma", image: null, isLegendary: false, availability_status: "available" };
    expect(canUsePermaRacerAsOverride(ownedPerma, candidate, "u1")).toBe(false);
  });

  it("rejects foreign owner", () => {
    const candidate = { id: "g1", name: "Běžný kůň", species: "horse" as const, poolType: "game" as const, category: "perma", image: null, isLegendary: false, availability_status: "available" };
    expect(canUsePermaRacerAsOverride(ownedPerma, candidate, "u2")).toBe(false);
  });

  it("rejects resting racer", () => {
    const candidate = { id: "g1", name: "Běžný kůň", species: "horse" as const, poolType: "game" as const, category: "perma", image: null, isLegendary: false, availability_status: "available" };
    expect(canUsePermaRacerAsOverride({ ...ownedPerma, availability_status: "resting" }, candidate, "u1")).toBe(false);
  });

  it("rejects a non-game pool racer", () => {
    const candidate = { id: "l1", name: "Legenda", species: "horse" as const, poolType: "legend" as const, category: "perma", image: null, isLegendary: true, availability_status: "available" };
    expect(canUsePermaRacerAsOverride(ownedPerma, candidate, "u1")).toBe(false);
  });

  it("returns a display-only override model", () => {
    const candidate = { id: "g1", name: "Běžný kůň", species: "horse" as const, poolType: "game" as const, category: "perma", image: "/game.webp", isLegendary: false, availability_status: "available" };
    const view = applyPermaRacerOverride(candidate, ownedPermaDetail, "u1");
    expect(view?.isPermaOverride).toBe(true);
    expect(view?.gameRacerId).toBe("g1");
    expect(view?.permaRacerId).toBe("u-perma");
    expect(view?.frontImage).toBe("/front.webp");
    expect(view?.sideImage).toBe("/side.webp");
    expect(view?.tokenImage).toBe(null);
  });
});
