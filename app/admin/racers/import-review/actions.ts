"use server";

import { mergeManifests, saveReviewItem, type RacerImportReviewItem } from "@/lib/racers/import-review";

export async function loadImportReviewAction(): Promise<RacerImportReviewItem[]> {
  return mergeManifests();
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
