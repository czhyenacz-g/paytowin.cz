import fs from "fs";
import path from "path";

const GENERATED_PATH = path.join(process.cwd(), "data/racer-imports/horses.generated.json");
const REVIEW_PATH = path.join(process.cwd(), "data/racer-imports/horses.review.json");
const DRAFT_PATH = path.join(process.cwd(), "data/racer-imports/horses.racers-draft.json");

export type RacerImportReviewItem = {
  id: string;
  sourceFolder: string;
  sourceFile: string;
  targetPath: string;
  suggestedCategory: "race" | "work" | "perma" | "unknown";
  displayName: string | null;
  slug: string | null;
  confirmedType: string | null;
  confirmedColor: string | null;
  confirmedRole: string | null;
  speed: number | null;
  maxStamina: number | null;
  price: number | null;
  rarity: "common" | "rare" | "epic" | "legendary" | "unique" | null;
  flavorText: string | null;
  story: string | null;
  notes: string | null;
};

export function loadGeneratedManifest(): RacerImportReviewItem[] {
  const raw = fs.readFileSync(GENERATED_PATH, "utf-8");
  return JSON.parse(raw) as RacerImportReviewItem[];
}

export function loadReviewManifest(): Record<string, Partial<RacerImportReviewItem>> {
  if (!fs.existsSync(REVIEW_PATH)) return {};
  const raw = fs.readFileSync(REVIEW_PATH, "utf-8");
  return JSON.parse(raw) as Record<string, Partial<RacerImportReviewItem>>;
}

export function mergeManifests(): RacerImportReviewItem[] {
  const generated = loadGeneratedManifest();
  const review = loadReviewManifest();

  return generated.map((item) => {
    const overrides = review[item.id] ?? {};
    // Source fields always come from generated; editable fields may be overridden by review
    return {
      ...item,
      displayName: overrides.displayName ?? item.displayName ?? null,
      slug: overrides.slug ?? item.slug ?? null,
      confirmedType: overrides.confirmedType ?? item.confirmedType ?? null,
      confirmedColor: overrides.confirmedColor ?? item.confirmedColor ?? null,
      confirmedRole: overrides.confirmedRole ?? item.confirmedRole ?? null,
      speed: overrides.speed ?? item.speed ?? null,
      maxStamina: overrides.maxStamina ?? item.maxStamina ?? null,
      price: overrides.price ?? item.price ?? null,
      rarity: overrides.rarity ?? item.rarity ?? null,
      flavorText: overrides.flavorText ?? item.flavorText ?? null,
      story: overrides.story ?? item.story ?? null,
      notes: overrides.notes ?? item.notes ?? null,
    };
  });
}

export type RacerDraftItem = {
  id: string;
  kind: "game_pool" | "perma_unique" | "work" | "unknown";
  displayName: string;
  slug: string;
  imageUrl: string;
  imagePath: string;
  species: "horse";
  sourceCategory: "race" | "work" | "perma" | "unknown";
  color: string | null;
  role: string | null;
  speed: number | null;
  maxStamina: number | null;
  price: number | null;
  rarity: "common" | "rare" | "epic" | "legendary" | "unique" | null;
  flavorText: string | null;
  story: string | null;
  internalNotes: string | null;
  source: {
    importId: string;
    sourceFolder: string;
    sourceFile: string;
    targetPath: string;
  };
};

export function loadDraftManifest(): RacerDraftItem[] | null {
  if (!fs.existsSync(DRAFT_PATH)) return null;
  const raw = fs.readFileSync(DRAFT_PATH, "utf-8");
  return JSON.parse(raw) as RacerDraftItem[];
}

export function saveReviewItem(id: string, updates: Partial<RacerImportReviewItem>): void {
  if (process.env.NODE_ENV === "production") {
    throw new Error("saveReviewItem is not allowed in production");
  }

  const generated = loadGeneratedManifest();
  const review = loadReviewManifest();

  // Strip source fields — only save editable fields
  const { id: _id, sourceFolder: _sf, sourceFile: _sfile, targetPath: _tp, suggestedCategory: _sc, ...editableUpdates } = updates;

  review[id] = {
    ...review[id],
    ...editableUpdates,
  };

  // Preserve order from generated manifest
  const ordered: Record<string, Partial<RacerImportReviewItem>> = {};
  for (const item of generated) {
    if (review[item.id] !== undefined) {
      ordered[item.id] = review[item.id];
    }
  }

  fs.writeFileSync(REVIEW_PATH, JSON.stringify(ordered, null, 2), "utf-8");
}
