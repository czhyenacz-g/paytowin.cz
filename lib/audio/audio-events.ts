/**
 * audio-events.ts — re-export typů a konstant pro snadné importy.
 *
 * Použití:
 *   import { playMusic, playSfx } from "@/lib/audio/audio-manager";
 *   import type { MusicContext, SfxEvent } from "@/lib/audio/audio-events";
 */

export type { MusicContext, SfxEvent, AudioSettings } from "./audio-types";
export { MUSIC_TRACKS, SFX_TRACKS, DEFAULT_AUDIO_SETTINGS } from "./audio-config";
export {
  init,
  unlockAudio,
  playMusic,
  stopMusic,
  playSfx,
  setMusicEnabled,
  setSfxEnabled,
  setMasterVolume,
  setMusicVolume,
  setSfxVolume,
  getSettings,
  getCurrentMusicContext,
} from "./audio-manager";

// TODO: Napojení na hru
// ─────────────────────────────────────────────────────────────────────────────
// V menu (app/page.tsx nebo layout):
//   import { playMusic } from "@/lib/audio/audio-manager";
//   playMusic("menu");
//
// V herní komponentě (GameBoard.tsx nebo ThemeProvider) po načtení mapy:
//   const theme = useTheme(); // nebo prop
//   if (theme?.cardThemeTag === "horse") playMusic("race_horses");
//   else if (theme?.cardThemeTag === "car") playMusic("race_cars");
//   else playMusic("race_default");
//
// unlockAudio() napojit na první klik v aplikaci — viz useUnlockAudio hook níže.
