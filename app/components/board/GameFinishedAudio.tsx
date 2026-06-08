"use client";

import React from "react";

export default function GameFinishedAudio() {
  const hasPlayedRef = React.useRef(false);

  React.useEffect(() => {
    if (hasPlayedRef.current) return;
    hasPlayedRef.current = true;

    const soundEnabled = localStorage.getItem("paytowin_sound") !== "off";
    if (!soundEnabled) return;

    const audio = new Audio("/in-nomine-patris.mp3");
    audio.volume = 0.7;
    console.log("[GAME_AUDIO] game_finished_sound_play");
    audio.play().catch(() => {
      console.log("[GAME_AUDIO] game_finished_sound_failed");
    });
  }, []);

  return null;
}
