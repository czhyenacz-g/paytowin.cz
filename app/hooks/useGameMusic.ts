"use client";

import { useEffect } from "react";
import { playMusic, stopMusic } from "@/lib/audio/audio-manager";
import type { MusicContext } from "@/lib/audio/audio-types";
import type { CardThemeTag } from "@/lib/cards";

/** Převede cardThemeTag na MusicContext. */
function tagToMusicContext(tag: CardThemeTag | undefined): MusicContext {
  if (tag === "horse") return "race_horses";
  if (tag === "car") return "race_cars";
  return "race_default";
}

/**
 * Přehraje hudbu odpovídající aktuálnímu theme.
 * Při unmountu hudbu zastaví.
 */
export function useGameMusic(cardThemeTag: CardThemeTag | undefined): void {
  useEffect(() => {
    playMusic(tagToMusicContext(cardThemeTag));
    return () => stopMusic();
  // Záměrně jen při změně tagu — ne při každém renderu
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardThemeTag]);
}
