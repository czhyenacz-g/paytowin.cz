"use client";

import type { AudioSettings, MusicContext, SfxEvent } from "./audio-types";
import { DEFAULT_AUDIO_SETTINGS, MUSIC_TRACKS, SFX_TRACKS } from "./audio-config";

// ─── Stav ─────────────────────────────────────────────────────────────────────

let settings: AudioSettings = { ...DEFAULT_AUDIO_SETTINGS };
let unlocked = false;
// Co má hrát (i když je hudba vypnutá) — zachováváme záměr pro re-enable
let intendedMusicContext: MusicContext | null = null;
let currentMusicEl: HTMLAudioElement | null = null;

// ─── Subscribers (pro reaktivní React hooky) ──────────────────────────────────

const subscribers = new Set<() => void>();

function notify(): void {
  subscribers.forEach(fn => fn());
}

export function subscribeToSettings(fn: () => void): () => void {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

// ─── localStorage persistence ─────────────────────────────────────────────────

const STORAGE_KEY = "ptw_audio_settings";

function saveSettings(s: AudioSettings): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      musicEnabled: s.musicEnabled,
      sfxEnabled: s.sfxEnabled,
      musicVolume: s.musicVolume,
      sfxVolume: s.sfxVolume,
    }));
  } catch { /* quota exceeded apod. */ }
}

function loadSavedSettings(): Partial<AudioSettings> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const p = JSON.parse(raw) as Record<string, unknown>;
    const out: Partial<AudioSettings> = {};
    if (typeof p.musicEnabled === "boolean") out.musicEnabled = p.musicEnabled;
    if (typeof p.sfxEnabled === "boolean") out.sfxEnabled = p.sfxEnabled;
    if (typeof p.musicVolume === "number" && p.musicVolume >= 0 && p.musicVolume <= 1) out.musicVolume = p.musicVolume;
    if (typeof p.sfxVolume === "number" && p.sfxVolume >= 0 && p.sfxVolume <= 1) out.sfxVolume = p.sfxVolume;
    return out;
  } catch { return {}; }
}

// ─── Lazy init ze storage (jednou při prvním volání z browseru) ───────────────

let storageLoaded = false;

function ensureStorageLoaded(): void {
  if (storageLoaded || typeof window === "undefined") return;
  storageLoaded = true;
  settings = { ...settings, ...loadSavedSettings() };
}

// ─── Pomocné ─────────────────────────────────────────────────────────────────

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

function startMusicEl(context: MusicContext): void {
  if (currentMusicEl) {
    currentMusicEl.pause();
    currentMusicEl.src = "";
    currentMusicEl = null;
  }
  const track = MUSIC_TRACKS[context];
  if (!track) return;
  try {
    const audio = new Audio(track.src);
    audio.loop = true;
    audio.volume = effectiveMusicVolume();
    currentMusicEl = audio;
    if (unlocked) {
      audio.play().catch((e) => devLog("playMusic failed", context, e));
    } else {
      devLog("playMusic queued until unlock", context);
    }
  } catch (e) {
    devLog("playMusic error", context, e);
  }
}

// ─── Veřejné API ──────────────────────────────────────────────────────────────

export function init(): void {
  ensureStorageLoaded();
  devLog("init", settings);
}

export function unlockAudio(): void {
  ensureStorageLoaded();
  if (unlocked) return;
  unlocked = true;
  devLog("unlocked");
  if (currentMusicEl && settings.musicEnabled) {
    currentMusicEl.play().catch((e) => devLog("unlock play failed", e));
  } else if (!currentMusicEl && intendedMusicContext && settings.musicEnabled) {
    startMusicEl(intendedMusicContext);
  }
}

export function playMusic(context: MusicContext): void {
  ensureStorageLoaded();
  intendedMusicContext = context;
  if (!settings.musicEnabled) return;
  // Stejný track už hraje
  if (currentMusicEl && !currentMusicEl.paused && intendedMusicContext === context) return;
  startMusicEl(context);
}

export function stopMusic(): void {
  intendedMusicContext = null;
  if (currentMusicEl) {
    currentMusicEl.pause();
    currentMusicEl.src = "";
    currentMusicEl = null;
  }
}

export function playSfx(event: SfxEvent): void {
  ensureStorageLoaded();
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
  ensureStorageLoaded();
  settings = { ...settings, musicEnabled: value };
  saveSettings(settings);
  notify();
  if (!value) {
    currentMusicEl?.pause();
  } else {
    if (currentMusicEl && currentMusicEl.paused) {
      currentMusicEl.play().catch((e) => devLog("resume failed", e));
    } else if (!currentMusicEl && intendedMusicContext) {
      startMusicEl(intendedMusicContext);
    }
  }
}

export function setSfxEnabled(value: boolean): void {
  ensureStorageLoaded();
  settings = { ...settings, sfxEnabled: value };
  saveSettings(settings);
  notify();
}

export function setMasterVolume(value: number): void {
  ensureStorageLoaded();
  settings = { ...settings, masterVolume: Math.max(0, Math.min(1, value)) };
  if (currentMusicEl) currentMusicEl.volume = effectiveMusicVolume();
  saveSettings(settings);
  notify();
}

export function setMusicVolume(value: number): void {
  ensureStorageLoaded();
  settings = { ...settings, musicVolume: Math.max(0, Math.min(1, value)) };
  if (currentMusicEl) currentMusicEl.volume = effectiveMusicVolume();
  saveSettings(settings);
  notify();
}

export function setSfxVolume(value: number): void {
  ensureStorageLoaded();
  settings = { ...settings, sfxVolume: Math.max(0, Math.min(1, value)) };
  saveSettings(settings);
  notify();
}

export function getSettings(): AudioSettings {
  ensureStorageLoaded();
  return { ...settings };
}

export function getCurrentMusicContext(): MusicContext | null {
  return intendedMusicContext;
}
