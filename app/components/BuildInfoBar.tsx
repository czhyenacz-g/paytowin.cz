"use client";

/**
 * BuildInfoBar — nenápadný řádek se stavem buildu, theme a board.
 *
 * Zobrazuje:
 *   Engine 0.1+abc1234 (preview)   — verze enginu + Vercel env pokud není production
 *   Theme classic-race v1.0.0       — theme id + verze z ThemeManifest
 *   Board small                     — aktivní board preset
 */

import { ENGINE_VERSION, BUILD_ENV } from "@/lib/build-info";
import { themeToManifest } from "@/lib/themes";
import type { Theme } from "@/lib/themes";

interface Props {
  theme: Theme;
  boardId: string;
}

export default function BuildInfoBar({ theme, boardId }: Props) {
  const manifest = themeToManifest(theme);
  const themeVersion = manifest.meta.version ?? "unknown";

  // Zobraz env jen pokud není production (production je "normální stav")
  const envLabel = BUILD_ENV !== "production" ? ` (${BUILD_ENV})` : "";

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 py-2 text-xs text-slate-400 select-none">
      <span title="Engine verze: major.minor + commit SHA">
        Engine {ENGINE_VERSION}{envLabel}
      </span>
      <span aria-hidden>·</span>
      <span title={`Theme: ${manifest.meta.id}`}>
        Theme {manifest.meta.id} v{themeVersion}
      </span>
      <span aria-hidden>·</span>
      <span title="Aktivní board preset">
        Board {boardId || "small"}
      </span>
    </div>
  );
}
