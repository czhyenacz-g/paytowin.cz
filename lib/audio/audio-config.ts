import type { AudioSettings, MusicContext, SfxEvent } from "./audio-types";

// ─── Výchozí nastavení ────────────────────────────────────────────────────────

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  musicEnabled: true,
  sfxEnabled: true,
  masterVolume: 0.7,
  musicVolume: 0.35,
  sfxVolume: 0.7,
};

// ─── Mapování hudebních kontextů na soubory ───────────────────────────────────

export interface MusicTrackConfig {
  src: string;
  description: string;
}

export const MUSIC_TRACKS: Record<MusicContext, MusicTrackConfig> = {
  menu: {
    src: "/audio/music/menu/menu-theme.mp3",
    description: "Hudba hlavního menu",
  },
  race_horses: {
    src: "/audio/music/maps/horses/horse-race-theme.mp3",
    description: "Hudba pro koňské závody",
  },
  race_cars: {
    src: "/audio/music/maps/cars/city-car-race-theme.mp3",
    description: "Hudba pro závodní auta",
  },
  race_default: {
    src: "/audio/music/maps/default/default-race-theme.mp3",
    description: "Výchozí hudba závodu",
  },
};

// ─── Mapování SFX eventů na soubory ──────────────────────────────────────────

export interface SfxTrackConfig {
  src: string;
  description: string;
}

export const SFX_TRACKS: Record<SfxEvent, SfxTrackConfig> = {
  ui_click: {
    src: "/audio/sfx/ui/click.mp3",
    description: "Kliknutí v UI",
  },
  ui_confirm: {
    src: "/audio/sfx/ui/confirm.mp3",
    description: "Potvrzení akce",
  },
  ui_back: {
    src: "/audio/sfx/ui/back.mp3",
    description: "Zpět / zrušení",
  },
  race_start: {
    src: "/audio/sfx/race/start.mp3",
    description: "Start závodu",
  },
  race_finish: {
    src: "/audio/sfx/race/finish.mp3",
    description: "Cíl / konec závodu",
  },
  race_countdown: {
    src: "/audio/sfx/race/countdown.mp3",
    description: "Odpočítávání před závodem",
  },
  reward_open: {
    src: "/audio/sfx/rewards/open.mp3",
    description: "Otevření odměny",
  },
  error_soft: {
    src: "/audio/sfx/ui/error-soft.mp3",
    description: "Jemná chyba / zakázaná akce",
  },
};
