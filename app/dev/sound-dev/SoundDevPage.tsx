"use client";

import React from "react";
import { MUSIC_TRACKS, SFX_TRACKS } from "@/lib/audio/audio-config";
import type { MusicContext, SfxEvent } from "@/lib/audio/audio-types";
import * as audioManager from "@/lib/audio/audio-manager";
import { useAudioSettings } from "@/app/hooks/useAudioSettings";

export default function SoundDevPage() {
  const { settings, setMusicEnabled, setSfxEnabled, setMusicVolume, setSfxVolume, setMasterVolume } = useAudioSettings();
  const [activeMusicCtx, setActiveMusicCtx] = React.useState<MusicContext | null>(null);
  const [unlocked, setUnlocked] = React.useState(false);
  const [lastSfx, setLastSfx] = React.useState<SfxEvent | null>(null);

  const musicContexts = Object.keys(MUSIC_TRACKS) as MusicContext[];
  const sfxEvents = Object.keys(SFX_TRACKS) as SfxEvent[];

  function handleUnlock() {
    audioManager.unlockAudio();
    setUnlocked(true);
  }

  function handlePlayMusic(ctx: MusicContext) {
    audioManager.playMusic(ctx);
    setActiveMusicCtx(audioManager.getCurrentMusicContext());
  }

  function handleStopMusic() {
    audioManager.stopMusic();
    setActiveMusicCtx(null);
  }

  function handlePlaySfx(event: SfxEvent) {
    audioManager.playSfx(event);
    setLastSfx(event);
    setTimeout(() => setLastSfx(null), 1000);
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6 space-y-8 max-w-3xl mx-auto">
      {/* Varování */}
      <div className="rounded border border-amber-500 bg-amber-950 px-4 py-2 text-amber-300 text-sm font-medium">
        Vývojářská stránka pro testování zvuků. Nepoužívat jako veřejnou herní stránku.
      </div>

      {/* Nadpis */}
      <div>
        <h1 className="text-2xl font-bold text-white">Sound Dev</h1>
        <p className="text-sm text-gray-400 mt-1">Vývojářský panel pro testování hudby a zvukových efektů.</p>
      </div>

      {/* Globální ovládání */}
      <section className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500">Globální ovládání</h2>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleUnlock}
            className={`rounded px-3 py-1.5 text-sm font-semibold transition ${unlocked ? "bg-green-800 text-green-200 cursor-default" : "bg-slate-700 hover:bg-slate-600 text-white"}`}
          >
            {unlocked ? "✓ Audio unlocked" : "Unlock audio"}
          </button>
          <button
            onClick={handleStopMusic}
            className="rounded px-3 py-1.5 text-sm font-semibold bg-slate-700 hover:bg-slate-600 text-white transition"
          >
            Stop music
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.musicEnabled}
              onChange={e => setMusicEnabled(e.target.checked)}
              className="accent-amber-500"
            />
            <span>Music enabled</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.sfxEnabled}
              onChange={e => setSfxEnabled(e.target.checked)}
              className="accent-amber-500"
            />
            <span>SFX enabled</span>
          </label>
        </div>

        <div className="space-y-2 text-sm">
          {(
            [
              { label: "Master volume", value: settings.masterVolume, setter: setMasterVolume },
              { label: "Music volume",  value: settings.musicVolume,  setter: setMusicVolume },
              { label: "SFX volume",    value: settings.sfxVolume,    setter: setSfxVolume },
            ] as { label: string; value: number; setter: (v: number) => void }[]
          ).map(({ label, value, setter }) => (
            <label key={label} className="flex items-center gap-3">
              <span className="w-32 text-gray-400 shrink-0">{label}</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={value}
                onChange={e => setter(parseFloat(e.target.value))}
                className="flex-1 accent-amber-500"
              />
              <span className="w-10 text-right text-gray-400 tabular-nums">{Math.round(value * 100)}%</span>
            </label>
          ))}
        </div>
      </section>

      {/* Hudba */}
      <section className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500">Hudba</h2>
        <div className="rounded border border-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-900 text-gray-400 text-xs uppercase">
              <tr>
                <th className="text-left px-3 py-2">Kontext</th>
                <th className="text-left px-3 py-2 hidden sm:table-cell">Tracks</th>
                <th className="text-left px-3 py-2 hidden sm:table-cell">Loop / gap</th>
                <th className="text-left px-3 py-2">Stav</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {musicContexts.map(ctx => {
                const cfg = MUSIC_TRACKS[ctx];
                const isActive = activeMusicCtx === ctx;
                return (
                  <tr key={ctx} className={isActive ? "bg-amber-950/40" : "bg-gray-950"}>
                    <td className="px-3 py-2 font-mono text-amber-300">{ctx}</td>
                    <td className="px-3 py-2 text-gray-500 text-xs hidden sm:table-cell">
                      {cfg.tracks.map((t, i) => (
                        <div key={i}>{t}</div>
                      ))}
                    </td>
                    <td className="px-3 py-2 text-gray-400 text-xs hidden sm:table-cell">
                      {cfg.loop === true ? "∞" : `${cfg.loop}×`} / {cfg.gapSeconds}s gap
                    </td>
                    <td className="px-3 py-2">
                      {isActive
                        ? <span className="text-xs font-semibold text-green-400">▶ playing</span>
                        : <span className="text-xs text-gray-600">configured</span>
                      }
                    </td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => handlePlayMusic(ctx)}
                        className="rounded px-2 py-1 text-xs font-semibold bg-amber-700 hover:bg-amber-600 text-white transition"
                      >
                        Play
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* SFX */}
      <section className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500">SFX</h2>
        <div className="rounded border border-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-900 text-gray-400 text-xs uppercase">
              <tr>
                <th className="text-left px-3 py-2">Event</th>
                <th className="text-left px-3 py-2 hidden sm:table-cell">Soubor</th>
                <th className="text-left px-3 py-2 hidden sm:table-cell">Popis</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {sfxEvents.map(event => {
                const track = SFX_TRACKS[event];
                const justPlayed = lastSfx === event;
                return (
                  <tr key={event} className={justPlayed ? "bg-blue-950/40" : "bg-gray-950"}>
                    <td className="px-3 py-2 font-mono text-blue-300">{event}</td>
                    <td className="px-3 py-2 text-gray-500 text-xs hidden sm:table-cell">{track.src}</td>
                    <td className="px-3 py-2 text-gray-400 hidden sm:table-cell">{track.description}</td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => handlePlaySfx(event)}
                        className="rounded px-2 py-1 text-xs font-semibold bg-blue-700 hover:bg-blue-600 text-white transition"
                      >
                        Play
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
