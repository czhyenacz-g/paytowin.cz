"use client";

import type { AudioSettings, MusicContext, SfxEvent } from "./audio-types";
import { DEFAULT_AUDIO_SETTINGS, MUSIC_TRACKS, SFX_TRACKS } from "./audio-config";

// ─── Stav ─────────────────────────────────────────────────────────────────────

let settings: AudioSettings = { ...DEFAULT_AUDIO_SETTINGS };
let unlocked = false;

// Playlist stav
interface PlaylistState {
  context: MusicContext;
  tracks: string[];
  loop: true | number;
  gapSeconds: number;
  trackIndex: number;  // pozice v tracks[] (pro multi-track playlist)
  cycleCount: number;  // kolik celých průchodů playlistem proběhlo
  el: HTMLAudioElement | null;
  gapTimer: ReturnType<typeof setTimeout> | null;
}

let playlist: PlaylistState | null = null;
// Co chceme hrát — zachováno i při musicEnabled=false
let intendedContext: MusicContext | null = null;

// ─── Subscribers ─────────────────────────────────────────────────────────────

const subscribers = new Set<() => void>();

function notify(): void {
  subscribers.forEach(fn => fn());
}

export function subscribeToSettings(fn: () => void): () => void {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

// ─── localStorage ─────────────────────────────────────────────────────────────

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

let storageLoaded = false;

function ensureStorageLoaded(): void {
  if (storageLoaded || typeof window === "undefined") return;
  storageLoaded = true;
  settings = { ...settings, ...loadSavedSettings() };
}

// ─── Pomocné ──────────────────────────────────────────────────────────────────

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

// ─── Playlist engine ──────────────────────────────────────────────────────────

function clearPlaylist(): void {
  if (!playlist) return;
  if (playlist.gapTimer !== null) {
    clearTimeout(playlist.gapTimer);
    playlist.gapTimer = null;
  }
  if (playlist.el) {
    playlist.el.onended = null;
    playlist.el.pause();
    playlist.el.src = "";
    playlist.el = null;
  }
  playlist = null;
}

function playTrack(state: PlaylistState): void {
  // Vyčisti předchozí element v rámci playlistu
  if (state.el) {
    state.el.onended = null;
    state.el.pause();
    state.el.src = "";
    state.el = null;
  }

  const src = state.tracks[state.trackIndex];
  if (!src) return;

  try {
    const audio = new Audio(src);
    audio.volume = effectiveMusicVolume();
    // Nepoužíváme audio.loop — opakování řídíme sami přes onended
    state.el = audio;

    audio.onended = () => {
      if (playlist !== state) return; // playlist byl mezitím vyměněn

      const nextTrackIndex = state.trackIndex + 1;

      if (nextTrackIndex < state.tracks.length) {
        // Pokračuj na další track v playlistu po gapSeconds
        state.trackIndex = nextTrackIndex;
        devLog("playlist next track in", state.gapSeconds, "s");
        state.gapTimer = setTimeout(() => {
          state.gapTimer = null;
          if (playlist === state && settings.musicEnabled) playTrack(state);
        }, state.gapSeconds * 1000);
      } else {
        // Konec playlistu — increment cycle
        state.cycleCount += 1;
        devLog("playlist cycle", state.cycleCount, "of", state.loop);

        const shouldRepeat = state.loop === true || state.cycleCount < state.loop;
        if (shouldRepeat) {
          state.trackIndex = 0;
          state.gapTimer = setTimeout(() => {
            state.gapTimer = null;
            if (playlist === state && settings.musicEnabled) playTrack(state);
          }, state.gapSeconds * 1000);
        } else {
          devLog("playlist finished (", state.cycleCount, "cycles)");
          clearPlaylist();
        }
      }
    };

    if (unlocked) {
      audio.play().catch((e) => devLog("playTrack failed", src, e));
    } else {
      devLog("playTrack queued until unlock", src);
    }
  } catch (e) {
    devLog("playTrack error", src, e);
  }
}

function startPlaylist(context: MusicContext): void {
  clearPlaylist();

  const cfg = MUSIC_TRACKS[context];
  if (!cfg || cfg.tracks.length === 0) return;

  playlist = {
    context,
    tracks: cfg.tracks,
    loop: cfg.loop,
    gapSeconds: cfg.gapSeconds,
    trackIndex: 0,
    cycleCount: 0,
    el: null,
    gapTimer: null,
  };

  playTrack(playlist);
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

  // Spusť čekající hudbu
  if (playlist?.el && settings.musicEnabled) {
    playlist.el.play().catch((e) => devLog("unlock play failed", e));
  } else if (!playlist && intendedContext && settings.musicEnabled) {
    startPlaylist(intendedContext);
  }
}

export function playMusic(context: MusicContext): void {
  ensureStorageLoaded();
  intendedContext = context;

  if (!settings.musicEnabled) return;
  // Stejný kontext a playlist aktivní — nepřerušuj
  if (playlist?.context === context && (playlist.el && !playlist.el.paused || playlist.gapTimer !== null)) return;

  startPlaylist(context);
}

export function stopMusic(): void {
  intendedContext = null;
  clearPlaylist();
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
    // Pozastav element, ale nech playlist stav — resume bude fungovat
    playlist?.el?.pause();
  } else {
    if (playlist?.el && playlist.el.paused) {
      playlist.el.play().catch((e) => devLog("resume failed", e));
    } else if (!playlist && intendedContext) {
      startPlaylist(intendedContext);
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
  if (playlist?.el) playlist.el.volume = effectiveMusicVolume();
  saveSettings(settings);
  notify();
}

export function setMusicVolume(value: number): void {
  ensureStorageLoaded();
  settings = { ...settings, musicVolume: Math.max(0, Math.min(1, value)) };
  if (playlist?.el) playlist.el.volume = effectiveMusicVolume();
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
  return intendedContext;
}
