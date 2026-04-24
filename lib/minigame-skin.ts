/** Volitelné theme skinování dev minigame arén. Žádná game state, žádné DB. */
export interface MinigameSkin {
  backgroundUrl?: string;
  overlayOpacity?: number; // 0–1; výchozí 0.62
  racingEmoji?: string;
  themeName?: string;
}

export const STANDALONE_PRESETS: Array<{
  label: string;
  url?: string;
  emoji: string;
  dark: boolean;
}> = [
  { label: "Žádné",        url: undefined,                  emoji: "⬛", dark: false },
  { label: "Horse Day",    url: "/bg_horse_day.webp",       emoji: "🐎", dark: false },
  { label: "Horse Night",  url: "/bg_horse_night.webp",     emoji: "🐎", dark: true  },
  { label: "Car Day",      url: "/bg_car_day.webp",         emoji: "🚗", dark: false },
  { label: "Car Night",    url: "/bg_car_night.webp",       emoji: "🚗", dark: true  },
  { label: "Classic",      url: "/bg_horse_classic.webp",   emoji: "🐎", dark: false },
];
