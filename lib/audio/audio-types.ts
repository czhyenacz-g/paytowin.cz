// ─── Hudební kontexty ─────────────────────────────────────────────────────────

export type MusicContext =
  | "menu"
  | "race_horses"
  | "race_cars"
  | "race_default";

// ─── SFX eventy ───────────────────────────────────────────────────────────────

export type SfxEvent =
  | "ui_click"
  | "ui_confirm"
  | "ui_back"
  | "race_start"
  | "race_finish"
  | "race_countdown"
  | "reward_open"
  | "error_soft";

// ─── Nastavení audio systému ──────────────────────────────────────────────────

export interface AudioSettings {
  musicEnabled: boolean;
  sfxEnabled: boolean;
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
}
