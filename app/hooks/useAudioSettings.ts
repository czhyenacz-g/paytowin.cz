"use client";

import React from "react";
import {
  getSettings,
  subscribeToSettings,
  setMusicEnabled,
  setSfxEnabled,
  setMusicVolume,
  setSfxVolume,
  setMasterVolume,
} from "@/lib/audio/audio-manager";
import type { AudioSettings } from "@/lib/audio/audio-types";

/**
 * Reaktivní hook pro audio nastavení.
 * Jeden zdroj pravdy — audio manager. Automaticky re-renderuje při změně.
 * Používej všude místo lokálního useState pro audio nastavení.
 */
export function useAudioSettings(): {
  settings: AudioSettings;
  setMusicEnabled: (v: boolean) => void;
  setSfxEnabled: (v: boolean) => void;
  setMusicVolume: (v: number) => void;
  setSfxVolume: (v: number) => void;
  setMasterVolume: (v: number) => void;
} {
  const [settings, setSettings] = React.useState<AudioSettings>(() => getSettings());

  React.useEffect(() => {
    // Sync při mountu (storage mohl načíst jiné hodnoty)
    setSettings(getSettings());
    return subscribeToSettings(() => setSettings(getSettings()));
  }, []);

  return {
    settings,
    setMusicEnabled,
    setSfxEnabled,
    setMusicVolume,
    setSfxVolume,
    setMasterVolume,
  };
}
