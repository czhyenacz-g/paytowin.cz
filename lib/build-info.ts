/**
 * lib/build-info.ts — automaticky odvozená build metadata.
 *
 * Hodnoty jsou vloženy do JS bundle při buildu přes next.config.ts `env` block.
 * Na Vercelu jsou zdrojem Vercel system env proměnné nastavené při každém deployi.
 * Při lokálním vývoji fallbackují na "dev" / "local" / "development".
 *
 * NENEDIT ručně — verze se mění automaticky s každým commitem / deployem.
 *
 * Format: ENGINE_VERSION = "0.1+abc1234"
 *   0.1      — major.minor prefix, mění se jen při breaking change (ruční)
 *   abc1234  — prvních 7 znaků commit SHA (automatické)
 */

/** Major.minor prefix — mění se jen při skutečném breaking change */
const ENGINE_BASE = "0.1";

/**
 * 7-znakový commit SHA.
 * Na Vercelu: reálný SHA z VERCEL_GIT_COMMIT_SHA.
 * Lokálně: "dev".
 */
export const BUILD_SHA = (
  process.env.NEXT_PUBLIC_BUILD_SHA ?? "dev"
).slice(0, 7);

/**
 * Branch / ref name.
 * Na Vercelu: "main", "preview/feature-xyz", …
 * Lokálně: "local".
 */
export const BUILD_REF = process.env.NEXT_PUBLIC_BUILD_REF ?? "local";

/**
 * Vercel prostředí.
 * "production" | "preview" | "development"
 */
export const BUILD_ENV = process.env.NEXT_PUBLIC_VERCEL_ENV ?? "development";

/**
 * Celý engine version string.
 * Příklad: "0.1+abc1234"
 */
export const ENGINE_VERSION = `${ENGINE_BASE}+${BUILD_SHA}`;
