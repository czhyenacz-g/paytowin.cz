"use client";

import { useEffect } from "react";
import { unlockAudio } from "@/lib/audio/audio-manager";

/**
 * Zavolá unlockAudio() při první uživatelské interakci (klik/tap).
 * Prohlížeče blokují autoplay před první interakcí — tenhle hook to odblokuje.
 * Bezpečné volat vícekrát — audio-manager si sám drží příznak unlocked.
 */
export function useAudioUnlock(): void {
  useEffect(() => {
    const handler = () => unlockAudio();
    window.addEventListener("pointerdown", handler, { once: true });
    return () => window.removeEventListener("pointerdown", handler);
  }, []);
}
