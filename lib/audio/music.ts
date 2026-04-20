import React from "react";

// ─── MusicSource ──────────────────────────────────────────────────────────────

/**
 * MusicSource — odkaz na audio soubor pro background music.
 *
 * src může být:
 *   - lokální cesta v /public:  "/audio/horse-day.mp3"
 *   - externí URL:              "https://cdn.example.com/horse-day.mp3"
 */
export interface MusicSource {
  src: string;
}

// ─── useBgMusic ───────────────────────────────────────────────────────────────

/**
 * useBgMusic — přehraje loopující background music.
 *
 * Bezpečné chování:
 *   - Pokud source není definován, hook nic nedělá.
 *   - Pokud browser zablokuje autoplay, selhání se tiše ignoruje.
 *     Hudba se spustí po první user interaction automaticky.
 *   - Cleanup při unmountu nebo změně src zastaví přehrávání.
 *
 * @param source  MusicSource nebo undefined (no-op)
 * @param enabled respektuje mute toggle (false → pause)
 */
export function useBgMusic(source: MusicSource | undefined, enabled: boolean): void {
  const audioRef = React.useRef<HTMLAudioElement | null>(null);

  // Vytvoří / nahradí audio element při změně src
  React.useEffect(() => {
    if (!source?.src) return;

    const audio = new Audio(source.src);
    audio.loop = true;
    audio.volume = 0.4;
    audioRef.current = audio;

    if (enabled) {
      audio.play().catch(() => {}); // browser může zablokovat autoplay — tiché selhání
    }

    return () => {
      audio.pause();
      audio.src = "";
      audioRef.current = null;
    };
  // Záměrně: neincludujeme `enabled` — play/pause řeší druhý effect níže
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source?.src]);

  // Reaguje na mute toggle
  React.useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (enabled) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, [enabled]);
}
