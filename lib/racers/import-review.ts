import fs from "fs";
import path from "path";

const GENERATED_PATH    = path.join(process.cwd(), "data/racer-imports/horses.generated.json");
const REVIEW_PATH       = path.join(process.cwd(), "data/racer-imports/horses.review.json");
const DRAFT_PATH        = path.join(process.cwd(), "data/racer-imports/horses.racers-draft.json");

const CL_GENERATED_PATH = path.join(process.cwd(), "data/racer-imports/horses-classic-legend.generated.json");
const CL_REVIEW_PATH    = path.join(process.cwd(), "data/racer-imports/horses-classic-legend.review.json");
const CL_DRAFT_PATH     = path.join(process.cwd(), "data/racer-imports/horses-classic-legend.draft.json");

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
  rarity: "common" | "uncommon" | "rare" | "epic" | "legendary" | "legendary_classic" | "unique" | "premium" | null;
  poolType: "classic_legend" | null;
  spawnSource: "historical_stable_card" | null;
  flavorText: string | null;
  story: string | null;
  notes: string | null;
};

// ─── Horses (pardubice) ───────────────────────────────────────────────────────

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
  return generated.map((item) => mergeItem(item, review[item.id]));
}

export function saveReviewItem(id: string, updates: Partial<RacerImportReviewItem>): void {
  if (process.env.NODE_ENV === "production") {
    throw new Error("saveReviewItem is not allowed in production");
  }
  const generated = loadGeneratedManifest();
  const review = loadReviewManifest();
  writeReviewUpdate(id, updates, generated, review, REVIEW_PATH);
}

// ─── Classic legend ───────────────────────────────────────────────────────────

export function loadClassicLegendGeneratedManifest(): RacerImportReviewItem[] {
  const raw = fs.readFileSync(CL_GENERATED_PATH, "utf-8");
  return JSON.parse(raw) as RacerImportReviewItem[];
}

export function loadClassicLegendReviewManifest(): Record<string, Partial<RacerImportReviewItem>> {
  if (!fs.existsSync(CL_REVIEW_PATH)) return {};
  const raw = fs.readFileSync(CL_REVIEW_PATH, "utf-8");
  return JSON.parse(raw) as Record<string, Partial<RacerImportReviewItem>>;
}

export function mergeClassicLegendManifests(): RacerImportReviewItem[] {
  const generated = loadClassicLegendGeneratedManifest();
  const review = loadClassicLegendReviewManifest();
  return generated.map((item) => mergeItem(item, review[item.id]));
}

export function saveClassicLegendReviewItem(id: string, updates: Partial<RacerImportReviewItem>): void {
  if (process.env.NODE_ENV === "production") {
    throw new Error("saveClassicLegendReviewItem is not allowed in production");
  }
  const generated = loadClassicLegendGeneratedManifest();
  const review = loadClassicLegendReviewManifest();
  writeReviewUpdate(id, updates, generated, review, CL_REVIEW_PATH);
}

// ─── Draft manifests ──────────────────────────────────────────────────────────

export type RacerDraftItem = {
  id: string;
  kind: "game_pool" | "perma_unique" | "work" | "classic_legend" | "unknown";
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
  rarity: "common" | "uncommon" | "rare" | "epic" | "legendary" | "legendary_classic" | "unique" | "premium" | null;
  poolType: "classic_legend" | null;
  spawnSource: "historical_stable_card" | null;
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

export function loadClassicLegendDraftManifest(): RacerDraftItem[] | null {
  if (!fs.existsSync(CL_DRAFT_PATH)) return null;
  const raw = fs.readFileSync(CL_DRAFT_PATH, "utf-8");
  return JSON.parse(raw) as RacerDraftItem[];
}

export function exportClassicLegendRacerDraft(): { ok: boolean; count?: number; error?: string } {
  if (process.env.NODE_ENV === "production") {
    return { ok: false, error: "Export není povolen v produkci." };
  }
  try {
    const merged = mergeClassicLegendManifests();
    const draft: RacerDraftItem[] = merged.map((item) => ({
      id: item.id,
      kind: "classic_legend" as const,
      displayName: item.displayName ?? item.id,
      slug: item.slug ?? item.id,
      imageUrl: item.targetPath,
      imagePath: item.targetPath,
      species: "horse",
      sourceCategory: item.suggestedCategory,
      color: item.confirmedColor ?? null,
      role: item.confirmedRole ?? null,
      speed: item.speed ?? null,
      maxStamina: item.maxStamina ?? null,
      price: item.price ?? null,
      rarity: item.rarity ?? null,
      poolType: item.poolType ?? "classic_legend",
      spawnSource: item.spawnSource ?? "historical_stable_card",
      flavorText: item.flavorText ?? null,
      story: item.story ?? null,
      internalNotes: item.notes ?? null,
      source: {
        importId: item.id,
        sourceFolder: item.sourceFolder,
        sourceFile: item.sourceFile,
        targetPath: item.targetPath,
      },
    }));
    fs.writeFileSync(CL_DRAFT_PATH, JSON.stringify(draft, null, 2), "utf-8");
    return { ok: true, count: draft.length };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function mergeItem(
  item: RacerImportReviewItem,
  overrides: Partial<RacerImportReviewItem> | undefined,
): RacerImportReviewItem {
  const o = overrides ?? {};
  return {
    ...item,
    displayName:   o.displayName   ?? item.displayName   ?? null,
    slug:          o.slug          ?? item.slug          ?? null,
    confirmedType: o.confirmedType ?? item.confirmedType ?? null,
    confirmedColor: o.confirmedColor ?? item.confirmedColor ?? null,
    confirmedRole: o.confirmedRole ?? item.confirmedRole ?? null,
    speed:         o.speed         ?? item.speed         ?? null,
    maxStamina:    o.maxStamina    ?? item.maxStamina    ?? null,
    price:         o.price         ?? item.price         ?? null,
    rarity:        o.rarity        ?? item.rarity        ?? null,
    poolType:      o.poolType      ?? item.poolType      ?? null,
    spawnSource:   o.spawnSource   ?? item.spawnSource   ?? null,
    flavorText:    o.flavorText    ?? item.flavorText    ?? null,
    story:         o.story         ?? item.story         ?? null,
    notes:         o.notes         ?? item.notes         ?? null,
  };
}

function writeReviewUpdate(
  id: string,
  updates: Partial<RacerImportReviewItem>,
  generated: RacerImportReviewItem[],
  review: Record<string, Partial<RacerImportReviewItem>>,
  reviewPath: string,
): void {
  const { id: _id, sourceFolder: _sf, sourceFile: _sfile, targetPath: _tp, suggestedCategory: _sc, ...editableUpdates } = updates;

  review[id] = {
    ...review[id],
    ...editableUpdates,
  };

  const ordered: Record<string, Partial<RacerImportReviewItem>> = {};
  for (const item of generated) {
    if (review[item.id] !== undefined) {
      ordered[item.id] = review[item.id];
    }
  }

  fs.writeFileSync(reviewPath, JSON.stringify(ordered, null, 2), "utf-8");
}
