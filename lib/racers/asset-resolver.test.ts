import { describe, expect, it } from "vitest";
import { resolvePermaRacerAssets, PERMA_BADGE_FALLBACK } from "./asset-resolver";

describe("resolvePermaRacerAssets", () => {
  it("uses front image as primary display image", () => {
    const resolved = resolvePermaRacerAssets({ id: "x", front_image_path: "/front.webp" });
    expect(resolved.primaryDisplayImage).toBe("/front.webp");
  });

  it("falls back to placeholder when front image is missing", () => {
    const resolved = resolvePermaRacerAssets({ id: "x" });
    expect(resolved.primaryDisplayImage).toBe("/themes/_shared/perma-placeholder.webp");
  });

  it("uses idle animation as secondary display image when side image is missing", () => {
    const resolved = resolvePermaRacerAssets({ id: "x" }, [{ id: "1", racer_unique_id: "x", racer_template_id: null, asset_type: "idle_animation", path: "/idle.webp", sort_order: 0, is_primary: false }]);
    expect(resolved.secondaryDisplayImage).toBe("/idle.webp");
  });

  it("fallbacks token image to primary display image", () => {
    const resolved = resolvePermaRacerAssets({ id: "x", front_image_path: "/front.webp" });
    expect(resolved.tokenImage).toBe("/front.webp");
  });

  it("fallbacks badge to default PERMA badge", () => {
    const resolved = resolvePermaRacerAssets({ id: "x" });
    expect(resolved.badgeIcon).toBe(PERMA_BADGE_FALLBACK);
  });
});
