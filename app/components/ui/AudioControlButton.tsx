"use client";

import React from "react";
import { useAudioSettings } from "@/app/hooks/useAudioSettings";
import { unlockAudio } from "@/lib/audio/audio-manager";

export default function AudioControlButton() {
  const [open, setOpen] = React.useState(false);
  const popoverRef = React.useRef<HTMLDivElement>(null);
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const { settings, setMusicEnabled, setSfxEnabled, setMusicVolume, setSfxVolume } = useAudioSettings();

  // Zavři klikem mimo
  React.useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (
        popoverRef.current && !popoverRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const anythingOn = settings.musicEnabled || settings.sfxEnabled;

  function handleToggle() {
    unlockAudio();
    setOpen(v => !v);
  }

  return (
    <div className="relative shrink-0">
      <button
        ref={buttonRef}
        onClick={handleToggle}
        className="rounded-[3px] px-1.5 py-1 text-[13px] text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition min-w-[28px] min-h-[28px] flex items-center justify-center"
        title="Zvuk"
        aria-label="Nastavení zvuku"
      >
        {anythingOn ? "🔊" : "🔇"}
      </button>

      {open && (
        <div
          ref={popoverRef}
          className="absolute right-0 top-full mt-1 z-50 w-56 rounded-[4px] border border-slate-200 bg-white shadow-lg p-3 space-y-3"
        >
          <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Zvuk</div>

          {/* Hudba */}
          <div className="space-y-1.5">
            <label className="flex items-center justify-between gap-2 cursor-pointer">
              <span className="text-xs font-semibold text-slate-700">Hudba</span>
              <Toggle value={settings.musicEnabled} onChange={setMusicEnabled} />
            </label>
            <VolumeSlider
              value={settings.musicVolume}
              disabled={!settings.musicEnabled}
              onChange={setMusicVolume}
            />
          </div>

          <div className="border-t border-slate-100" />

          {/* Herní zvuky */}
          <div className="space-y-1.5">
            <label className="flex items-center justify-between gap-2 cursor-pointer">
              <span className="text-xs font-semibold text-slate-700">Herní zvuky</span>
              <Toggle value={settings.sfxEnabled} onChange={setSfxEnabled} />
            </label>
            <VolumeSlider
              value={settings.sfxVolume}
              disabled={!settings.sfxEnabled}
              onChange={setSfxVolume}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors ${value ? "bg-amber-500" : "bg-slate-200"}`}
      role="switch"
      aria-checked={value}
    >
      <span
        className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform mt-0.5 ${value ? "translate-x-4" : "translate-x-0.5"}`}
      />
    </button>
  );
}

function VolumeSlider({ value, disabled, onChange }: { value: number; disabled: boolean; onChange: (v: number) => void }) {
  return (
    <input
      type="range"
      min={0}
      max={1}
      step={0.05}
      value={value}
      disabled={disabled}
      onChange={e => onChange(parseFloat(e.target.value))}
      className="w-full accent-amber-500 disabled:opacity-40"
    />
  );
}
