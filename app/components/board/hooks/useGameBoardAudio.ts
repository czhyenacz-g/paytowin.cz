import React from "react";
import { useBgMusic, type MusicSource } from "@/lib/audio/music";
import { sfxPlay, type SoundId } from "@/lib/audio/sfx";
import { scheduleMorseAudio } from "@/lib/audio/morse";
import { textToMorse, extractCapsSegment } from "@/lib/morse";
import { COINS_FEEDBACK_DURATION_MS } from "@/lib/game-constants";
import type { FlashEvent } from "@/lib/types/events";
import type { Player, RerollOffer } from "@/lib/types/game";

export interface TelegramMessage {
  text: string;
  morse: string;
}

export interface CoinsFeedbackData {
  amount: number;
  kind: "gain" | "lose";
  playerName: string;
  fieldLabel: string;
}

interface UseGameBoardAudioParams {
  themeMusic: MusicSource | undefined;
  players: Player[];
  gameMode: "online" | "local";
  myPlayerId: string | null;
  offerPendingType: string | undefined;
  gameStatus: string;
  viewerRole: string;
  fieldCount: number;
  setPendingOffer: (offer: RerollOffer | null) => void;
  seenGameOverRef: React.MutableRefObject<boolean>;
  lateJoinRef: React.MutableRefObject<boolean>;
}

interface UseGameBoardAudioReturn {
  soundEnabled: boolean;
  flashEvent: FlashEvent | null;
  coinsFeedback: CoinsFeedbackData | null;
  telegramMessage: TelegramMessage | null;
  toggleSound: () => void;
  playSfx: (id: SoundId) => void;
  playStepSound: () => void;
  showCoinsFeedback: (amount: number, kind: "gain" | "lose", playerName: string, fieldLabel: string) => void;
  showTelegram: (text: string) => void;
  showFlash: (event: FlashEvent) => void;
  flashActiveRef: React.MutableRefObject<boolean>;
  deferredOfferRef: React.MutableRefObject<RerollOffer | null>;
}

/**
 * Manages all audio and feedback UI elements (sounds, coins feedback, flash messages, telegrams).
 * Returns state and handlers for audio/UX; exposes flashActiveRef and deferredOfferRef
 * for integration with rollDice and offer restoration logic.
 */
export function useGameBoardAudio(params: UseGameBoardAudioParams): UseGameBoardAudioReturn {
  const {
    themeMusic,
    players,
    gameMode,
    myPlayerId,
    offerPendingType,
    gameStatus,
    viewerRole,
    fieldCount,
    setPendingOffer,
    seenGameOverRef,
    lateJoinRef,
  } = params;

  // ── State ─────────────────────────────────────────────────────────────
  const [soundEnabled, setSoundEnabled] = React.useState(true);
  const [flashEvent, setFlashEvent] = React.useState<FlashEvent | null>(null);
  const [telegramMessage, setTelegramMessage] = React.useState<TelegramMessage | null>(null);
  const [coinsFeedback, setCoinsFeedback] = React.useState<CoinsFeedbackData | null>(null);

  // ── Refs ──────────────────────────────────────────────────────────────
  const audioCtxRef = React.useRef<AudioContext | null>(null);
  const soundEnabledRef = React.useRef(true);
  const flashTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const telegramTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const coinsFeedbackTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevPlayersRef = React.useRef<Player[]>([]);
  const pendingRaceRef = React.useRef<boolean>(false);
  const knownPlayerIdsRef = React.useRef<Set<string> | null>(null);
  const flashActiveRef = React.useRef(false);
  const deferredOfferRef = React.useRef<RerollOffer | null>(null);

  // ── Background music ──────────────────────────────────────────────────
  useBgMusic(themeMusic, soundEnabled);

  // ── Load sound preference from localStorage ──────────────────────────
  React.useEffect(() => {
    const stored = localStorage.getItem("paytowin_sound");
    const enabled = stored !== "off";
    setSoundEnabled(enabled);
    soundEnabledRef.current = enabled;
  }, []);

  // ── Cleanup timers on unmount ──────────────────────────────────────────
  React.useEffect(() => {
    return () => {
      if (coinsFeedbackTimerRef.current) clearTimeout(coinsFeedbackTimerRef.current);
      if (telegramTimerRef.current) clearTimeout(telegramTimerRef.current);
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    };
  }, []);

  // ── Toggle sound and persist ────────────────────────────────────────
  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    soundEnabledRef.current = next;
    localStorage.setItem("paytowin_sound", next ? "on" : "off");
  };

  // ── Play step sound (custom WebAudio synthesis) ─────────────────────
  const playStepSound = React.useCallback(() => {
    if (!soundEnabledRef.current) return;
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
      const ctx = audioCtxRef.current;
      // Krátký perkusivní klik — filtrovaný šum
      const bufferSize = Math.floor(ctx.sampleRate * 0.04);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 5);
      }
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = 1400;
      filter.Q.value = 0.6;
      const gain = ctx.createGain();
      gain.gain.value = 0.35;
      source.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      source.start();
    } catch {
      // AudioContext nedostupný (SSR, blokovaný prohlížečem)
    }
  }, []);

  // ── Play SFX (preset sound effects) ──────────────────────────────────
  const playSfx = React.useCallback((id: SoundId) => {
    if (!soundEnabledRef.current) return;
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") {
        ctx.resume().then(() => sfxPlay(id, ctx)).catch(() => {});
      } else {
        sfxPlay(id, ctx);
      }
    } catch { /* AudioContext nedostupný */ }
  }, []);

  // ── Race sound — přehraje při startu závodu (null → RaceOffer) ───────
  React.useEffect(() => {
    const isRaceNow = offerPendingType === "race";
    if (isRaceNow && !pendingRaceRef.current) playSfx("race");
    pendingRaceRef.current = !!isRaceNow;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offerPendingType]);

  // ── Opponent/bot step sounds (online mód) ───────────────────────────
  React.useEffect(() => {
    const prev = prevPlayersRef.current;
    prevPlayersRef.current = players;
    if (gameMode === "local") return; // rollDice obstarává zvuky pro všechny v lokální hře
    if (prev.length === 0) return;
    players.forEach(p => {
      if (p.id === myPlayerId) return; // vlastní pohyb hraje rollDice
      const old = prev.find(op => op.id === p.id);
      if (!old || p.position === old.position) return;
      const steps = (p.position - old.position + fieldCount) % fieldCount;
      if (steps < 1 || steps > 6) return;
      for (let i = 0; i < steps; i++) {
        setTimeout(() => playStepSound(), i * 160);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players, gameMode, myPlayerId, fieldCount]);

  // ── Show coins feedback (3s auto-dismiss) ───────────────────────────
  const showCoinsFeedback = React.useCallback((amount: number, kind: "gain" | "lose", playerName: string, fieldLabel: string) => {
    if (coinsFeedbackTimerRef.current) clearTimeout(coinsFeedbackTimerRef.current);
    setCoinsFeedback({ amount, kind, playerName, fieldLabel });
    coinsFeedbackTimerRef.current = setTimeout(() => setCoinsFeedback(null), COINS_FEEDBACK_DURATION_MS);
    playSfx(kind === "gain" ? "coin_gain" : "coin_loss");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Show telegram strip + Morse audio (4s auto-dismiss) ──────────────
  const showTelegram = React.useCallback((text: string) => {
    if (telegramTimerRef.current) clearTimeout(telegramTimerRef.current);
    setTelegramMessage({ text, morse: textToMorse(text) });
    if (soundEnabledRef.current) {
      const capsSegment = extractCapsSegment(text);
      if (capsSegment) {
        try {
          if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
          scheduleMorseAudio(audioCtxRef.current, textToMorse(capsSegment));
        } catch { /* AudioContext nedostupný */ }
      }
    }
    telegramTimerRef.current = setTimeout(() => setTelegramMessage(null), 4000);
  }, []);

  // ── Show flash spotlight (2–3s auto-dismiss) ───────────────────────
  const showFlash = React.useCallback((event: FlashEvent) => {
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashActiveRef.current = true;
    setFlashEvent(event);
    const ms = event.type === "legendary_gone" ? 3000 : 2000;
    flashTimerRef.current = setTimeout(() => {
      setFlashEvent(null);
      flashActiveRef.current = false;
      if (deferredOfferRef.current) {
        setPendingOffer(deferredOfferRef.current);
        deferredOfferRef.current = null;
      }
    }, ms);
  }, [setPendingOffer]);

  // ── Join telegram (nový hráč vstoupil do závodu) ────────────────────
  React.useEffect(() => {
    const currentIds = new Set(players.map(p => p.id));
    if (knownPlayerIdsRef.current === null) {
      // První run: jen ulož známá ID, nic nezobrazuj
      knownPlayerIdsRef.current = currentIds;
      return;
    }
    // Zobraz telegram jen aktivním hráčům; ne spectatorům, ne po konci hry
    if (viewerRole !== "player") { knownPlayerIdsRef.current = currentIds; return; }
    if (gameStatus === "finished" || gameStatus === "cancelled") { knownPlayerIdsRef.current = currentIds; return; }
    // Najdi nové hráče (INSERT)
    const newPlayers = players.filter(p => !knownPlayerIdsRef.current!.has(p.id));
    knownPlayerIdsRef.current = currentIds;
    if (newPlayers.length === 0) return;
    // Zobraz telegram pro prvního nového (edge case: simultánní join)
    showTelegram(`JOIN — ${newPlayers[0].name} vstoupil do závodu.`);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players]);

  return {
    soundEnabled,
    flashEvent,
    coinsFeedback,
    telegramMessage,
    toggleSound,
    playSfx,
    playStepSound,
    showCoinsFeedback,
    showTelegram,
    showFlash,
    flashActiveRef,
    deferredOfferRef,
  };
}
