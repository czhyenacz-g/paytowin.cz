"use server";

import fs from "fs";
import path from "path";
import { mergeManifests, saveReviewItem, type RacerImportReviewItem, type RacerDraftItem } from "@/lib/racers/import-review";

const DRAFT_PATH = path.join(process.cwd(), "data/racer-imports/horses.racers-draft.json");

export async function loadImportReviewAction(): Promise<RacerImportReviewItem[]> {
  return mergeManifests();
}

export async function exportRacerDraftAction(): Promise<{ ok: boolean; error?: string; warnings?: string[] }> {
  if (process.env.NODE_ENV === "production") {
    return { ok: false, error: "Export není povolen v produkci." };
  }

  try {
    const merged = mergeManifests();

    // Validate required fields
    const validationErrors: string[] = [];
    for (const item of merged) {
      const missing: string[] = [];
      if (!item.displayName) missing.push("displayName");
      if (!item.slug) missing.push("slug");
      if (missing.length > 0) {
        validationErrors.push(`${item.id}: ${missing.join(", ")}`);
      }
    }

    if (validationErrors.length > 0) {
      return {
        ok: false,
        error: "Validace selhala. Chybí povinná pole:\n" + validationErrors.join("\n"),
      };
    }

    // Map to RacerDraftItem[]
    function determineKind(item: RacerImportReviewItem): RacerDraftItem["kind"] {
      if (
        item.suggestedCategory === "perma" ||
        item.confirmedType === "perma" ||
        item.rarity === "unique"
      ) {
        return "perma_unique";
      }
      if (item.suggestedCategory === "work" || item.confirmedType === "work") {
        return "work";
      }
      if (item.suggestedCategory === "race" || item.confirmedType === "race") {
        return "game_pool";
      }
      return "unknown";
    }

    const draft: RacerDraftItem[] = merged.map((item) => ({
      id: item.id,
      kind: determineKind(item),
      displayName: item.displayName!,
      slug: item.slug!,
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
      poolType: item.poolType ?? null,
      spawnSource: item.spawnSource ?? null,
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

    fs.writeFileSync(DRAFT_PATH, JSON.stringify(draft, null, 2), "utf-8");

    const warnings: string[] = [];
    const unknownCount = draft.filter((d) => d.kind === "unknown").length;
    if (unknownCount > 0) {
      warnings.push(`${unknownCount} položek má kind = "unknown" — zkontroluj confirmedType.`);
    }

    return { ok: true, warnings: warnings.length > 0 ? warnings : undefined };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function saveImportReviewItemAction(
  id: string,
  updates: Partial<RacerImportReviewItem>
): Promise<{ ok: boolean; error?: string }> {
  if (process.env.NODE_ENV === "production") {
    return { ok: false, error: "Editace není povolena v produkci." };
  }

  try {
    saveReviewItem(id, updates);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
