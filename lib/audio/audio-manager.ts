"use client";

import type { AudioSettings, MusicContext, SfxEvent } from "./audio-types";
import { DEFAULT_AUDIO_SETTINGS, MUSIC_TRACKS, SFX_TRACKS } from "./audio-config";

// ─── Stav audio manageru ──────────────────────────────────────────────────────

let settings: AudioSettings = { ...DEFAULT_AUDIO_SETTINGS };
let unlocked = false;
let currentMusicContext: MusicContext | null = null;
let currentMusicEl: HTMLAudioElement | null = null;

// ─── Pomocné funkce ───────────────────────────────────────────────────────────

function devLog(...args: unknown[]): void {
  if (process.env.NODE_ENV === "development") {
    console.log("[audio-manager]", ...args);
  }
}

function effectiveMusicVolume(): number {
  return settings.masterVolume * settings.musicVolume;
}

function effectiveSfxVolume(): number {
  return settings.masterVolume * settings.sfxVolume;
}

// ─── Veřejné API ──────────────────────────────────────────────────────────────

/** Inicializuje audio manager — volat při startu aplikace (volitelné). */
export function init(): void {
  devLog("init");
}

/**
 * Odblokuje audio po první uživatelské interakci.
 * Volat z click/tap handleru — prohlížeče blokují autoplay bez uživatelské akce.
 */
export function unlockAudio(): void {
  if (unlocked) return;
  unlocked = true;
  devLog("unlocked");

  // Pokud čeká na přehrání hudby, spusť ji teď
  if (currentMusicEl && settings.musicEnabled) {
    currentMusicEl.play().catch((e) => devLog("unlock play failed", e));
  }
}

/**
 * Přehraje hudbu pro daný kontext.
 * Pokud je stejný track aktivní, nic nedělá.
 * Pokud soubor chybí nebo prohlížeč přehrání odmítne, tiché selhání.
 */
export function playMusic(context: MusicContext): void {
  if (!settings.musicEnabled) return;
  if (currentMusicContext === context && currentMusicEl && !currentMusicEl.paused) return;

  stopMusic();

  const track = MUSIC_TRACKS[context];
  if (!track) return;

  try {
    const audio = new Audio(track.src);
    audio.loop = true;
    audio.volume = effectiveMusicVolume();
    currentMusicEl = audio;
    currentMusicContext = context;

    if (unlocked) {
      audio.play().catch((e) => devLog("playMusic failed", context, e));
    } else {
      devLog("playMusic queued until unlock", context);
    }
  } catch (e) {
    devLog("playMusic error", context, e);
  }
}

/** Zastaví aktuálně přehrávanou hudbu. */
export function stopMusic(): void {
  if (currentMusicEl) {
    currentMusicEl.pause();
    currentMusicEl.src = "";
    currentMusicEl = null;
  }
  currentMusicContext = null;
}

/**
 * Přehraje SFX event jednorázově.
 * Pokud soubor chybí nebo přehrání selže, tiché selhání.
 */
export function playSfx(event: SfxEvent): void {
  if (!settings.sfxEnabled || !unlocked) return;

  const track = SFX_TRACKS[event];
  if (!track) return;

  try {
    const audio = new Audio(track.src);
    audio.volume = effectiveSfxVolume();
    audio.play().catch((e) => devLog("playSfx failed", event, e));
  } catch (e) {
    devLog("playSfx error", event, e);
  }
}

// ─── Nastavení ────────────────────────────────────────────────────────────────

export function setMusicEnabled(value: boolean): void {
  settings = { ...settings, musicEnabled: value };
  if (!value) {
    currentMusicEl?.pause();
  } else if (currentMusicEl) {
    currentMusicEl.play().catch((e) => devLog("setMusicEnabled resume failed", e));
  }
}

export function setSfxEnabled(value: boolean): void {
  settings = { ...settings, sfxEnabled: value };
}

export function setMasterVolume(value: number): void {
  settings = { ...settings, masterVolume: Math.max(0, Math.min(1, value)) };
  if (currentMusicEl) currentMusicEl.volume = effectiveMusicVolume();
}

export function setMusicVolume(value: number): void {
  settings = { ...settings, musicVolume: Math.max(0, Math.min(1, value)) };
  if (currentMusicEl) currentMusicEl.volume = effectiveMusicVolume();
}

export function setSfxVolume(value: number): void {
  settings = { ...settings, sfxVolume: Math.max(0, Math.min(1, value)) };
}

/** Vrátí aktuální kopii nastavení (read-only). */
export function getSettings(): AudioSettings {
  return { ...settings };
}

/** Vrátí aktuálně přehrávaný hudební kontext nebo null. */
export function getCurrentMusicContext(): MusicContext | null {
  return currentMusicContext;
}
