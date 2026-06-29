import type { PermaRacer, RacerAsset, RacerUniqueDetail } from "./catalog";

export interface ResolvedPermaAssets {
  frontImage: string | null;
  sideImage: string | null;
  idleAnimation: string | null;
  tokenImage: string | null;
  badgeIcon: string | null;
  primaryDisplayImage: string;
  secondaryDisplayImage: string;
}

const DEFAULT_PERMA_BADGE = "/themes/_shared/perma-badge.svg";
const DEFAULT_PERMA_PLACEHOLDER = "/themes/_shared/perma-placeholder.webp";

function pickAsset(assets: RacerAsset[], assetType: RacerAsset["asset_type"]): string | null {
  return assets.find((asset) => asset.asset_type === assetType)?.path ?? null;
}

export function resolvePermaRacerAssets(
  racer: Pick<PermaRacer | RacerUniqueDetail, "id"> & Partial<PermaRacer & RacerUniqueDetail>,
  assets: RacerAsset[] = [],
): ResolvedPermaAssets {
  const frontImage = racer.front_image_path ?? pickAsset(assets, "front_image");
  const sideImage = racer.side_image_path ?? pickAsset(assets, "side_image");
  const idleAnimation = pickAsset(assets, "idle_animation");
  const tokenFromAsset = pickAsset(assets, "token_image");
  const badgeFromAsset = racer.badge_icon_path ?? pickAsset(assets, "badge_icon");

  const primaryDisplayImage = frontImage ?? DEFAULT_PERMA_PLACEHOLDER;
  const secondaryDisplayImage = sideImage ?? idleAnimation ?? DEFAULT_PERMA_PLACEHOLDER;
  const tokenImage = tokenFromAsset ?? primaryDisplayImage;
  const badgeIcon = badgeFromAsset ?? DEFAULT_PERMA_BADGE;

  return {
    frontImage,
    sideImage,
    idleAnimation,
    tokenImage,
    badgeIcon,
    primaryDisplayImage,
    secondaryDisplayImage,
  };
}

export const PERMA_BADGE_FALLBACK = DEFAULT_PERMA_BADGE;
export const PERMA_PLACEHOLDER_IMAGE = DEFAULT_PERMA_PLACEHOLDER;
