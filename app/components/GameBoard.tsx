"use client";

import React from "react";
import { supabase } from "@/lib/supabase";
import { getThemeById, getThemeRacers } from "@/lib/themes";
import type { RacerConfig } from "@/lib/themes";
import { resolveRacerRefsAction } from "@/app/admin/racers/actions";
import { themeToManifest } from "@/lib/themes/manifest";
import {
  buildCardBackgroundImageValue,
  resolveFieldCardImagePath,
  resolveRacerCardImagePath,
} from "@/lib/themes/assets";
import { loadThemeManifestAsync } from "@/lib/themes/loader";
import { getBoardById } from "@/lib/board";
import { awardXpAction, awardRaceStarAction } from "@/app/game/actions";
import { STADIUM_ASPECT } from "@/lib/board/constants";
import { logEvent } from "@/lib/analytics";
import { UI_TEXT } from "@/lib/ui-text";
import { applyBoardShuffle } from "@/lib/board/shuffle";
import { textToMorse, extractCapsSegment } from "@/lib/morse";
import { computeMatchTitles } from "@/lib/match-titles";
import TelegramStrip from "./TelegramStrip";
import type { TelegramMessage } from "./TelegramStrip";
import type { Field } from "@/lib/engine";
import {
  sleep,
  buildFields,
  getStartTax,
  isBankrupt,
  getNextActiveIndex,
  normalizePlayer,
  normalizeState,
  playerOwnsRacer,
  racerOwnershipKey,
  REROLL_COST,
  REROLL_CHANCE,
} from "@/lib/engine";

const RACE_WINNER_REWARD = 500; // fixní odměna za 1. místo v mass_race

/** Vrátí "horse" nebo "car" podle racerType v theme konfiguraci; null pro ostatní/neznámé typy. */
function racerSoundType(h: { id?: string }, themeRacers: import("@/lib/themes").RacerConfig[]): "horse" | "car" | null {
  if (!h.id) return null;
  const cfg = themeRacers.find(r => r.id === h.id);
  if (cfg?.racerType === "horse") return "horse";
  if (cfg?.racerType === "car") return "car";
  return null;
}

/** Vrátí true pokud oba hráči mají aspoň jednoho závodníka — stejná podmínka jako race flow. */
function canTriggerRivalsRace(p1: Player, p2: Player): boolean {
  return p1.horses.length > 0 && p2.horses.length > 0;
}
import { drawCard } from "@/lib/cards";
import type { GameCard } from "@/lib/cards";
import type { Player, Horse, ActiveEffect, GameState, OfferPending, RerollOffer, RaceOffer, BankruptAnnouncement, RacePendingEvent, PostTurnEvent, RaceType, EconomyConfig } from "@/lib/types/game";
import { DEFAULT_ECONOMY } from "@/lib/types/game";
import { resolveYearEvent } from "@/lib/year-events";
import type { CenterEvent, FlashEvent } from "@/lib/types/events";
import CenterEventModal from "./modals/CenterEventModal";
import FlashToast from "./modals/FlashToast";
import RaceModal from "./RaceModal";
import RaceEventOverlay from "./RaceEventOverlay";
import type { MinigameResult } from "./race/RacingMinigame";
import BuildInfoBar from "./BuildInfoBar";
import ThemeAssetInspector from "./ThemeAssetInspector";
import DevRaceModeShell from "./DevRaceModeShell";
import DevRaceBoardLayer from "./DevRaceBoardLayer";
import DevRaceFlipLayer from "./DevRaceFlipLayer";
import DevDuelShell  from "./duel/DuelDevShell";
import SpeedDevShell from "./speed/SpeedDevShell";
import IntroOverlay from "./IntroOverlay";
import ScoreTable from "./ScoreTable";
import BrandLogo from "./BrandLogo";
import { useBgMusic } from "@/lib/audio/music";
import { sfxPlay, type SoundId } from "@/lib/audio/sfx";

// Styly polí jsou součástí theme systému (lib/themes/*)
// Přistupuj přes: theme.colors.fieldStyles[field.type]

// Pozice polí — 21 bodů rovnoměrně rozmístěných na kružnici r=42 % (center 50 %/50 %).
// Úhel pole i: α = 180° − i × (360°/21), kde 0° = vpravo, 90° = nahoru (CSS y je inverzní).
// Vzorec: left = 50 + 42·cos(α), top = 50 − 42·sin(α).
// Mezera mezi sousedními poli ≈ 24 px (na boardu max-w 760 px) — rovnoměrná po celém okruhu.
const FIELD_POSITIONS: React.CSSProperties[] = [
  { top: "50.0%", left: "8.0%",  transform: "translate(-50%, -50%)" },  //  0 START
  { top: "37.7%", left: "9.8%",  transform: "translate(-50%, -50%)" },  //  1
  { top: "26.4%", left: "15.3%", transform: "translate(-50%, -50%)" },  //  2
  { top: "17.2%", left: "23.7%", transform: "translate(-50%, -50%)" },  //  3
  { top: "10.9%", left: "34.8%", transform: "translate(-50%, -50%)" },  //  4
  { top: "8.1%",  left: "46.9%", transform: "translate(-50%, -50%)" },  //  5
  { top: "9.1%",  left: "59.4%", transform: "translate(-50%, -50%)" },  //  6
  { top: "13.6%", left: "71.0%", transform: "translate(-50%, -50%)" },  //  7
  { top: "21.4%", left: "80.8%", transform: "translate(-50%, -50%)" },  //  8
  { top: "31.8%", left: "87.8%", transform: "translate(-50%, -50%)" },  //  9
  { top: "43.8%", left: "91.5%", transform: "translate(-50%, -50%)" },  // 10
  { top: "56.2%", left: "91.5%", transform: "translate(-50%, -50%)" },  // 11
  { top: "68.2%", left: "87.8%", transform: "translate(-50%, -50%)" },  // 12
  { top: "78.6%", left: "80.8%", transform: "translate(-50%, -50%)" },  // 13
  { top: "86.4%", left: "71.0%", transform: "translate(-50%, -50%)" },  // 14
  { top: "91.0%", left: "59.4%", transform: "translate(-50%, -50%)" },  // 15
  { top: "91.9%", left: "46.9%", transform: "translate(-50%, -50%)" },  // 16
  { top: "89.1%", left: "34.8%", transform: "translate(-50%, -50%)" },  // 17
  { top: "82.8%", left: "23.7%", transform: "translate(-50%, -50%)" },  // 18
  { top: "73.7%", left: "15.3%", transform: "translate(-50%, -50%)" },  // 19
  { top: "62.3%", left: "9.8%",  transform: "translate(-50%, -50%)" },  // 20
];

// ─── Stadium layout — 21 pozic na stadionovém okruhu ─────────────────────────
// Geometrie: r=22 (poloměr zaoblení), hw=18 (polovina délky rovné strany), střed 50/50.
// Perimetr ≈ 210.23, krok = 210.23/21 ≈ 10.01. Počátek: levý krajní bod (10, 50).
// Traversal: CCW v matematickém prostoru = CW na obrazovce (CSS y dolů).
const FIELD_POSITIONS_STADIUM: React.CSSProperties[] = [
  { top: "50.00%", left: "10.00%", transform: "translate(-50%, -50%)" },  //  0 START  (levý krajní bod)
  { top: "40.37%", left: "12.23%", transform: "translate(-50%, -50%)" },  //  1
  { top: "32.61%", left: "18.54%", transform: "translate(-50%, -50%)" },  //  2
  { top: "28.45%", left: "27.59%", transform: "translate(-50%, -50%)" },  //  3
  { top: "28.00%", left: "37.48%", transform: "translate(-50%, -50%)" },  //  4  (začátek horní roviny)
  { top: "28.00%", left: "47.50%", transform: "translate(-50%, -50%)" },  //  5
  { top: "28.00%", left: "57.51%", transform: "translate(-50%, -50%)" },  //  6
  { top: "28.00%", left: "67.52%", transform: "translate(-50%, -50%)" },  //  7  (konec horní roviny)
  { top: "30.04%", left: "77.27%", transform: "translate(-50%, -50%)" },  //  8  (pravý oblouk)
  { top: "36.13%", left: "85.08%", transform: "translate(-50%, -50%)" },  //  9
  { top: "45.05%", left: "89.42%", transform: "translate(-50%, -50%)" },  // 10
  { top: "54.97%", left: "89.42%", transform: "translate(-50%, -50%)" },  // 11
  { top: "63.88%", left: "85.07%", transform: "translate(-50%, -50%)" },  // 12
  { top: "69.97%", left: "77.25%", transform: "translate(-50%, -50%)" },  // 13
  { top: "72.00%", left: "67.51%", transform: "translate(-50%, -50%)" },  // 14  (začátek dolní roviny)
  { top: "72.00%", left: "57.51%", transform: "translate(-50%, -50%)" },  // 15
  { top: "72.00%", left: "47.50%", transform: "translate(-50%, -50%)" },  // 16
  { top: "72.00%", left: "37.48%", transform: "translate(-50%, -50%)" },  // 17  (konec dolní roviny)
  { top: "71.55%", left: "27.56%", transform: "translate(-50%, -50%)" },  // 18  (levý oblouk dolní)
  { top: "67.38%", left: "18.51%", transform: "translate(-50%, -50%)" },  // 19
  { top: "59.63%", left: "12.23%", transform: "translate(-50%, -50%)" },  // 20
];

// Rotace polí pro stadium layout — tangenciální úhel na každém bodě tratě (stupně).
// Vypočteno jako: rotDeg = 90 − α, kde α je outward normal úhel v matematické konvenci.
const FIELD_ROTATIONS_STADIUM: number[] = [
  -90,   //  0  (levý krajní bod, outward = vlevo 180°)
  -64,   //  1
  -38,   //  2
  -12,   //  3
    0,   //  4  (horní rovina, outward = nahoru 90°)
    0,   //  5
    0,   //  6
    0,   //  7
   25,   //  8  (pravý oblouk)
   51,   //  9
   77,   // 10
  103,   // 11
  129,   // 12
  155,   // 13
  180,   // 14  (dolní rovina, outward = dolů −90°)
  180,   // 15
  180,   // 16
  180,   // 17
  192,   // 18  (levý oblouk dolní)
  218,   // 19
  244,   // 20
];

// ─── Kostka ───────────────────────────────────────────────────────────────────

// Souřadnice teček pro každou stranu kostky [cx, cy] v SVG viewBox 0–100
const DICE_DOTS: [number, number][][] = [
  [[50, 50]],                                                          // 1
  [[28, 28], [72, 72]],                                                // 2
  [[28, 28], [50, 50], [72, 72]],                                      // 3
  [[28, 28], [72, 28], [28, 72], [72, 72]],                            // 4
  [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],                  // 5
  [[28, 28], [72, 28], [28, 50], [72, 50], [28, 72], [72, 72]],        // 6
];

function DiceFace({ value, size = 80, rolling = false }: { value: number | null; size?: number; rolling?: boolean }) {
  if (value === null) {
    // Prázdná kostka před prvním hodem
    return (
      <svg width={size} height={size} viewBox="0 0 100 100" style={{ filter: "drop-shadow(0 3px 6px rgba(0,0,0,0.12))" }}>
        <rect x="6" y="6" width="88" height="88" rx="18" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="3"/>
      </svg>
    );
  }
  const dots = DICE_DOTS[(value - 1 + 6) % 6];
  return (
    <svg
      width={size} height={size} viewBox="0 0 100 100"
      className={rolling ? "animate-spin" : "transition-transform duration-150"}
      style={{ filter: "drop-shadow(0 3px 8px rgba(0,0,0,0.18))" }}
    >
      <rect x="6" y="6" width="88" height="88" rx="18" fill="white" stroke="#e2e8f0" strokeWidth="2.5"/>
      {/* Lehký 3D highlight */}
      <rect x="6" y="6" width="88" height="44" rx="18" fill="rgba(255,255,255,0.55)"/>
      {dots.map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="9" fill="#1e293b"/>
      ))}
    </svg>
  );
}

// Pozice figurek — každé pole posunuté o ~10 % směrem ke středu desky (50 %, 50 %)
const FIGURINE_POSITIONS: React.CSSProperties[] = FIELD_POSITIONS.map((pos) => {
  const left = parseFloat(pos.left as string);
  const top  = parseFloat(pos.top  as string);
  const dx = 50 - left;
  const dy = 50 - top;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const offset = 10; // % směrem ke středu
  return {
    left: `${left + (dx / len) * offset}%`,
    top:  `${top  + (dy / len) * offset}%`,
    transform: "translate(-50%, -50%)",
  };
});

// Figurky pro stadium layout.
// Kontejner má aspect-[20/18] (= STADIUM_ASPECT) — 1 % horiz ≠ 1 % vert v pixelech.
// Správný inward offset: normalizuj vektor v pixelovém prostoru (dx škálujeme A=W/H),
// poté převeď zpět na % — výsledkem je fyzicky stejný inset ve všech směrech po okruhu.
const FIGURINE_POSITIONS_STADIUM: React.CSSProperties[] = FIELD_POSITIONS_STADIUM.map((pos) => {
  const left = parseFloat(pos.left as string);
  const top  = parseFloat(pos.top  as string);
  const dx = 50 - left;
  const dy = 50 - top;
  // Normalizace v pixelovém prostoru: dx škálujeme poměrem W/H
  const len = Math.sqrt((STADIUM_ASPECT * dx) ** 2 + dy ** 2) || 1;
  const offset = 6; // % výšky kontejneru — fyzicky konzistentní inset ve všech směrech
  return {
    left: `${left + (dx / len) * offset}%`,
    top:  `${top  + (dy / len) * offset}%`,
    transform: "translate(-50%, -50%)",
  };
});

// ─── Pole: detail text pro hover stav ────────────────────────────────────────
function getFieldDetail(field: Field, ownerName: string | null): string | null {
  if (field.type === "neutral") return null;
  if (field.type === "racer") {
    if (!field.racer) return null;
    if (ownerName) return `✓ ${ownerName}`;
    return `${field.racer.price} 💰 ${"⭐".repeat(Math.min(field.racer.speed, 5))}`;
  }
  if (field.type === "chance")  return "🎴 náhodná karta";
  if (field.type === "finance") return "💼 finance karta";
  if (field.type === "mafia")   return "🎭 Mafie karta";
  if (field.type === "gamble")  return "🎲 hazard";
  return field.description || null;
}

function getFieldMetaLabel(field: Field, ownerName: string | null): string | null {
  if (field.type === "start") return "START";
  if (field.type === "racer") {
    if (!field.racer) return null;
    if (ownerName) return "obsazeno";
    return `${field.racer.price} 💰`;
  }
  if (field.type === "coins_gain") return field.description || "odměna";
  if (field.type === "coins_lose") return field.description || "ztráta";
  if (field.type === "chance") return "osud";
  if (field.type === "finance") return "Finance";
  if (field.type === "mafia")   return "Mafie";
  if (field.type === "gamble") return "hazard";
  return field.description || null;
}

/**
 * scheduleMorseAudio — naplánuje přehrání morseovky na WebAudio timeline.
 *
 * Timing (UNIT = 35 ms):
 *   dit = 1 UNIT, dah = 3 UNIT, inter-element gap = 1 UNIT,
 *   inter-letter gap = 3 UNIT, inter-word gap = 7 UNIT.
 */
function scheduleMorseAudio(ctx: AudioContext, morse: string): void {
  const UNIT = 0.035; // 35 ms
  const FREQ = 660;
  const VOL  = 0.22;
  let t = ctx.currentTime + 0.05;

  function beep(dur: number) {
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.value = FREQ;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(VOL, t + 0.004);
    gain.gain.setValueAtTime(VOL, t + dur - 0.004);
    gain.gain.linearRampToValueAtTime(0, t + dur);
    osc.start(t);
    osc.stop(t + dur + 0.01);
    t += dur + UNIT; // symbol + inter-element gap
  }

  const words = morse.split("  /  ");
  for (let wi = 0; wi < words.length; wi++) {
    const letters = words[wi].split(" ");
    for (let li = 0; li < letters.length; li++) {
      for (const sym of letters[li]) {
        if (sym === "·") beep(UNIT);
        else if (sym === "−") beep(3 * UNIT);
      }
      if (li < letters.length - 1) t += 2 * UNIT; // inter-letter = 3 UNIT total
    }
    if (wi < words.length - 1) t += 6 * UNIT; // inter-word = 7 UNIT total
  }
}

/**
 * getFieldAccentColor — barva akcentní horní hrany karty (strana od středu).
 * Nezávislé na theme — jde o herní sémantiku pole, ne o theme barvu.
 */
function getFieldAccentColor(field: Field): string {
  switch (field.type) {
    case "start":      return "#ef4444"; // red-500
    case "coins_gain": return "#34d399"; // emerald-400
    case "coins_lose": return "#f87171"; // red-400
    case "gamble":     return "#c084fc"; // violet-400
    case "racer":
    case "horse":      return "#fbbf24"; // amber-400
    case "chance":     return "#38bdf8"; // sky-400
    case "finance":    return "#38bdf8"; // sky-400
    case "mafia":      return "#a855f7"; // purple-500
    default:           return "#94a3b8"; // slate-400 (neutral)
  }
}

function getFieldTone(field: Field, themeId: string) {
  const usesDarkSurface = field.type === "start" || themeId.endsWith("night");
  return usesDarkSurface
    ? {
        cardOverlay: "bg-gradient-to-b from-black/18 via-black/0 via-[42%] to-black/72",
        topBadge: "border border-white/14 bg-black/42 text-slate-100 shadow-[0_1px_0_rgba(255,255,255,0.06)]",
        titleText: "text-slate-50",
        metaText: "text-slate-200/90",
        footerPanel: "bg-gradient-to-t from-black/78 via-black/60 to-black/8",
        detailPanel: "border border-white/12 bg-black/58 text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]",
        detailText: "text-slate-100",
        ownerText: "text-slate-200/85",
      }
    : {
        cardOverlay: "bg-gradient-to-b from-white/10 via-transparent via-[36%] to-black/44",
        topBadge: "border border-black/10 bg-white/74 text-slate-800 shadow-[0_1px_0_rgba(255,255,255,0.4)]",
        titleText: "text-white",
        metaText: "text-white/80",
        footerPanel: "bg-gradient-to-t from-slate-950/78 via-slate-950/58 to-transparent",
        detailPanel: "border border-black/8 bg-white/88 text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]",
        detailText: "text-slate-700",
        ownerText: "text-slate-700/75",
      };
}

// ─── Komponenta ───────────────────────────────────────────────────────────────

interface Props {
  gameCode?: string;
}

type RollAdjustment = -1 | 0 | 1;

interface PendingRollDecision {
  playerId: string;
  playerIndex: number;
  baseRoll: number;
  basePosition: number;
}

// ─── AmbientBackground ────────────────────────────────────────────────────────

function AmbientBackground({ primary, alt }: { primary: string; alt: string }) {
  const [showAlt, setShowAlt] = React.useState(false);

  React.useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    function schedule() {
      // 35–50 s s jemnou náhodou
      const delay = 35_000 + Math.random() * 15_000;
      timer = setTimeout(() => {
        setShowAlt((prev) => !prev);
        schedule();
      }, delay);
    }
    schedule();
    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      <div
        className="fixed inset-0 -z-10"
        style={{ background: primary, transition: "opacity 6s ease-in-out", opacity: showAlt ? 0 : 1 }}
      />
      <div
        className="fixed inset-0 -z-10"
        style={{ background: alt, transition: "opacity 6s ease-in-out", opacity: showAlt ? 1 : 0 }}
      />
    </>
  );
}

// ─── GameBoard ────────────────────────────────────────────────────────────────

export default function GameBoard({ gameCode }: Props) {
  const [gameId, setGameId] = React.useState<string | null>(null);
  const [themeId, setThemeId] = React.useState<string>("horse-day");
  const [boardId, setBoardId] = React.useState<string>("small");
  const [gameMode, setGameMode] = React.useState<"online" | "local">("online");
  const [economy, setEconomy] = React.useState<EconomyConfig>(DEFAULT_ECONOMY);
  const [isHost, setIsHost] = React.useState(false);
  const [gameStatus, setGameStatus] = React.useState<string>("playing");
  const [fogOfWar, setFogOfWar] = React.useState(false);
  const [players, setPlayers] = React.useState<Player[]>([]);
  const [gameState, setGameState] = React.useState<GameState | null>(null);
  const [loading, setLoading] = React.useState(!!gameCode);
  const [pendingRacer, setPendingRacer] = React.useState<{ racer: Horse; playerIndex: number } | null>(null);
  const [pendingCard, setPendingCard] = React.useState<{ card: GameCard; playerIndex: number } | null>(null);
  const cardAppliedRef = React.useRef<string | null>(null);
  const [pendingOffer, setPendingOffer] = React.useState<RerollOffer | null>(null);
  const [canReroll, setCanReroll] = React.useState(false);
  // Ochrana: klíč nabídky, kterou jsme už potvrdili — zabrání dvojímu spuštění
  const offerAcceptedRef = React.useRef<string | null>(null);
  const raceSubmittedRef = React.useRef<string | null>(null);
  const selectionSubmittedRef = React.useRef<string | null>(null);
  const pendingRaceScoreRef = React.useRef<string | null>(null);
  const [countdownNum, setCountdownNum] = React.useState<number | null>(null);
  const [myPlayerId, setMyPlayerId] = React.useState<string | null>(null);
  const [myDiscordAvatar, setMyDiscordAvatar] = React.useState<string | null>(null);
  const [viewerRole, setViewerRole] = React.useState<"loading" | "player" | "spectator" | "login_required">("loading");
  const [isRolling, setIsRolling] = React.useState(false);
  const [isMoving, setIsMoving] = React.useState(false);
  const [displayRoll, setDisplayRoll] = React.useState<number | null>(null);
  const [pendingRollDecision, setPendingRollDecision] = React.useState<PendingRollDecision | null>(null);
  const [bankruptWarning, setBankruptWarning] = React.useState<{
    playerName: string; horses: Horse[]; totalSellValue: number; willSurvive: boolean;
  } | null>(null);
  const bankruptWarningResolverRef = React.useRef<((sellAll: boolean) => void) | null>(null);
  const [rollDecisionCountdown, setRollDecisionCountdown] = React.useState<number | null>(null);
  const [animPosition, setAnimPosition] = React.useState<number | null>(null);
  const [animatingPlayerIdx, setAnimatingPlayerIdx] = React.useState<number | null>(null);
  const [trailFields, setTrailFields] = React.useState<number[]>([]);
  const [hoveredPlayerId, setHoveredPlayerId] = React.useState<string | null>(null);
  const [hoveredFieldIdx, setHoveredFieldIdx] = React.useState<number | null>(null);
  const [soundEnabled, setSoundEnabled] = React.useState(true);
  const [racerGuideDismissed, setRacerGuideDismissed] = React.useState(false);
  const [staminaGuideDismissed, setStaminaGuideDismissed] = React.useState(false);
  const [preferredGuideDismissed, setPreferredGuideDismissed] = React.useState(false);
  const [guideDismissedTurn, setGuideDismissedTurn] = React.useState<number | null>(null);
  const [introVisible, setIntroVisible] = React.useState(false);
  const introShownRef = React.useRef(false);
  // dev-only: Race Mode shell overlay (mimo game state)
  const [devRaceMode, setDevRaceMode] = React.useState(false);
  // dev-only: Race Board layer (vrstva uvnitř boardu)
  const [devRaceBoardLayer, setDevRaceBoardLayer] = React.useState(false);
  // dev-only: Neon Rope Duel harness
  const [devDuelOpen,  setDevDuelOpen]  = React.useState(false);
  // dev-only: Speed Arena harness
  const [devSpeedOpen, setDevSpeedOpen] = React.useState(false);
  // dev-only: Race Board Flip layer (flip animace boardu)
  const [devFlipOpen, setDevFlipOpen] = React.useState(false);
  const [flipBoardAnim, setFlipBoardAnim] = React.useState<"idle" | "out" | "back-in">("idle");
  const flipTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioCtxRef = React.useRef<AudioContext | null>(null);
  const soundEnabledRef = React.useRef(true);
  const rollDecisionTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const rollDecisionResolvedRef = React.useRef(false);
  const pendingRollResolverRef = React.useRef<((adjustment: RollAdjustment) => void) | null>(null);
  // Refs pro ochranu animace před Realtime přepsáním pozice
  const animatingPlayerIdRef = React.useRef<string | null>(null);
  const animPositionRef = React.useRef<number | null>(null);

  const [boardBgUrl, setBoardBgUrl] = React.useState<string>("");
  /** Závodníci načtení z globální registry (racerRefs flow). Null = použij inline theme racers. */
  const [resolvedRacers, setResolvedRacers] = React.useState<RacerConfig[] | null>(null);
  const [flashEvent, setFlashEvent] = React.useState<FlashEvent | null>(null);
  const flashTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [telegramMessage, setTelegramMessage] = React.useState<TelegramMessage | null>(null);
  const telegramTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [coinsFeedback, setCoinsFeedback] = React.useState<{ amount: number; kind: "gain" | "lose"; playerName: string; fieldLabel: string } | null>(null);
  const coinsFeedbackTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [scorePopupOpen, setScorePopupOpen] = React.useState(false);
  const flashActiveRef = React.useRef(false);
  const deferredOfferRef = React.useRef<RerollOffer | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    loadThemeManifestAsync(themeId).then(async (manifest) => {
      if (cancelled) return;

      const bgUrl = manifest.assets?.boardBackgroundImage ?? "";
      setBoardBgUrl(bgUrl);
      console.log(`[GameBoard] theme="${themeId}" boardBgUrl="${bgUrl || "none"}"`);

      // Pokud theme používá racerRefs → načti závodníky z globální registry
      if (manifest.racerRefs?.length) {
        const racers = await resolveRacerRefsAction(manifest.racerRefs);
        if (!cancelled && racers.length > 0) {
          setResolvedRacers(racers);
          console.log(`[GameBoard] theme="${themeId}" racerRefs resolved: ${racers.length} závodníků z registry`);
        }
      } else {
        // Theme nemá racerRefs — reset na inline fallback
        setResolvedRacers(null);
      }
    });
    return () => { cancelled = true; };
  }, [themeId]);

  // Theme + FIELDS — odvozeno ze stavu themeId/boardId, aktualizuje se při každém renderu
  const theme = getThemeById(themeId);
  const themeManifest = themeToManifest(theme);

  // Background music — no-op pokud theme.music není definováno
  useBgMusic(theme.music, soundEnabled);
  const board = theme.board ?? getBoardById(boardId);
  const shuffledBoard = applyBoardShuffle(board, gameId);
  // resolvedRacers: závodníci z globální registry (racerRefs flow); null = inline fallback
  const FIELDS = buildFields(shuffledBoard, resolvedRacers ?? getThemeRacers(theme), economy);
  const hoveredField = hoveredFieldIdx !== null ? FIELDS.find((field) => field.index === hoveredFieldIdx) ?? null : null;
  // Ref aby stale closures (Realtime subscriptions) vždy dostaly aktuální FIELDS
  const fieldsRef = React.useRef<Field[]>(FIELDS);
  fieldsRef.current = FIELDS;

  // Fog of War helpers
  const revealedFields: number[] = gameState?.revealed_fields ?? [];
  function isFieldVisible(field: { index: number; type: string }): boolean {
    if (!fogOfWar) return true;
    if (field.type === "start" || field.type === "racer") return true;
    return revealedFields.includes(field.index);
  }
  function buildFogReveal(fieldIndex: number, base?: number[]): number[] {
    const current = base ?? revealedFields;
    if (current.includes(fieldIndex)) return current;
    // Racer a start pole jsou vždy viditelné — nepřidávat do revealedFields (zamezí zbytečnému flipu)
    const fieldType = FIELDS.find(f => f.index === fieldIndex)?.type;
    if (fieldType === "racer" || fieldType === "start") return current;
    return [...current, fieldIndex];
  }
  /** Krizový reset — zachová jen racer/start pole, všechna ostatní schová. */
  function buildCrisisReset(fields: typeof FIELDS): number[] {
    const keepTypes = new Set(["start", "racer"]);
    return revealedFields.filter((idx) => {
      const f = fields.find((f) => f.index === idx);
      return f ? keepTypes.has(f.type) : false;
    });
  }

  // Fog flip reveal animation
  // seenRevealedRef: pole odhalená od mountu — nepřehrávají flip (reload, join mid-game)
  const seenRevealedRef = React.useRef<Set<number>>(new Set());
  // Guard: turn číslo posledního zobrazeného year event telegramu — brání dvojímu zobrazení
  const seenYearEventTurnRef = React.useRef<number>(0);
  // Guard: GAME OVER telegram — true = already shown or game was already finished on load
  const seenGameOverRef = React.useRef<boolean>(false);
  // Join telegram: null = not yet initialized (skip first run), Set = known player IDs
  const knownPlayerIdsRef = React.useRef<Set<string> | null>(null);
  // Late-join spectator telegram: true = sessionStorage flag byl přečten, telegram čeká na render
  const lateJoinRef = React.useRef<boolean>(false);
  // flippingFields: pole právě animující flip
  const [flippingFields, setFlippingFields] = React.useState<Set<number>>(new Set());
  // showingHiddenRef: pole v první půlce flipu — stále zobrazují hidden card
  const showingHiddenRef = React.useRef<Set<number>>(new Set());

  React.useEffect(() => {
    if (!fogOfWar) return;
    const newlyRevealed = revealedFields.filter((idx) => !seenRevealedRef.current.has(idx));
    if (newlyRevealed.length === 0) return;
    newlyRevealed.forEach((idx) => seenRevealedRef.current.add(idx));

    // Spusť flip: nejdřív přidej do showingHidden (stále zobrazují hidden card)
    newlyRevealed.forEach((idx) => showingHiddenRef.current.add(idx));
    setFlippingFields((prev) => new Set([...prev, ...newlyRevealed]));

    // Po 120ms (polovina flipu) — swap na real card
    const swapTimer = setTimeout(() => {
      newlyRevealed.forEach((idx) => showingHiddenRef.current.delete(idx));
      setFlippingFields((prev) => new Set(prev)); // force rerender
    }, 120);

    // Po 240ms — konec animace
    const endTimer = setTimeout(() => {
      setFlippingFields((prev) => {
        const next = new Set(prev);
        newlyRevealed.forEach((idx) => next.delete(idx));
        return next;
      });
    }, 240);

    return () => { clearTimeout(swapTimer); clearTimeout(endTimer); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealedFields.join(","), fogOfWar]);

  // Načti preference zvuku z localStorage
  React.useEffect(() => {
    const stored = localStorage.getItem("paytowin_sound");
    const enabled = stored !== "off";
    setSoundEnabled(enabled);
    soundEnabledRef.current = enabled;
  }, []);

  React.useEffect(() => {
    return () => {
      if (rollDecisionTimerRef.current) clearTimeout(rollDecisionTimerRef.current);
    };
  }, []);

  React.useEffect(() => {
    const scope = gameCode ?? "local";
    setRacerGuideDismissed(localStorage.getItem(`paytowin_guide_racer_${scope}`) === "dismissed");
    setStaminaGuideDismissed(localStorage.getItem(`paytowin_guide_stamina_${scope}`) === "dismissed");
    setPreferredGuideDismissed(localStorage.getItem(`paytowin_guide_preferred_${scope}`) === "dismissed");
  }, [gameCode]);

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    soundEnabledRef.current = next;
    localStorage.setItem("paytowin_sound", next ? "on" : "off");
  };

  const dismissRacerGuide = React.useCallback(() => {
    const guideKey = `paytowin_guide_racer_${gameCode ?? "local"}`;
    localStorage.setItem(guideKey, "dismissed");
    setRacerGuideDismissed(true);
    setGuideDismissedTurn(gameState?.turn_count ?? null);
  }, [gameCode, gameState?.turn_count]);

  const dismissStaminaGuide = React.useCallback(() => {
    const guideKey = `paytowin_guide_stamina_${gameCode ?? "local"}`;
    localStorage.setItem(guideKey, "dismissed");
    setStaminaGuideDismissed(true);
    setGuideDismissedTurn(gameState?.turn_count ?? null);
  }, [gameCode, gameState?.turn_count]);

  const dismissPreferredGuide = React.useCallback(() => {
    const guideKey = `paytowin_guide_preferred_${gameCode ?? "local"}`;
    localStorage.setItem(guideKey, "dismissed");
    setPreferredGuideDismissed(true);
    setGuideDismissedTurn(gameState?.turn_count ?? null);
  }, [gameCode, gameState?.turn_count]);

  const clearRollDecisionTimer = React.useCallback(() => {
    if (rollDecisionTimerRef.current) {
      clearTimeout(rollDecisionTimerRef.current);
      rollDecisionTimerRef.current = null;
    }
  }, []);

  const resolveRollDecision = React.useCallback((adjustment: RollAdjustment) => {
    if (rollDecisionResolvedRef.current) return;
    rollDecisionResolvedRef.current = true;
    clearRollDecisionTimer();
    const resolver = pendingRollResolverRef.current;
    pendingRollResolverRef.current = null;
    setPendingRollDecision(null);
    setRollDecisionCountdown(null);
    if (resolver) resolver(adjustment);
  }, [clearRollDecisionTimer]);

  // Countdown 3→0 pro korekci tahu — zobrazí se jen aktivnímu hráči
  React.useEffect(() => {
    if (!pendingRollDecision) { setRollDecisionCountdown(null); return; }
    setRollDecisionCountdown(3);
    const interval = setInterval(() => {
      setRollDecisionCountdown((n) => (n !== null && n > 0 ? n - 1 : n));
    }, 1000);
    return () => clearInterval(interval);
  }, [pendingRollDecision]);

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

  const playSfx = React.useCallback((id: SoundId) => {
    if (!soundEnabledRef.current) return;
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
      sfxPlay(id, audioCtxRef.current);
    } catch { /* AudioContext nedostupný */ }
  }, []);

  // Race sound — přehraje při startu závodu (přechod null → RaceOffer)
  const pendingRaceRef = React.useRef<boolean>(false);
  React.useEffect(() => {
    const isRaceNow = gameState?.offer_pending?.type === "race";
    if (isRaceNow && !pendingRaceRef.current) playSfx("race");
    pendingRaceRef.current = !!isRaceNow;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState?.offer_pending?.type]);

  // Year event telegram — globální broadcast pro všechny klienty a pozorovatele.
  // seenYearEventTurnRef brání dvojímu zobrazení na aktivním hráčovi (který už zavolal
  // showTelegram lokálně a ref nastavil před zápisem do DB).
  React.useEffect(() => {
    const yet = gameState?.year_event_telegram;
    if (!yet) return;
    if (yet.turn <= seenYearEventTurnRef.current) return;
    seenYearEventTurnRef.current = yet.turn;
    showTelegram(yet.text);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState?.year_event_telegram?.turn]);

  // GAME OVER telegram — lokální detekce přechodu do finished.
  // seenGameOverRef zabraňuje přehrání při reloadu hry, která je finished od začátku.
  React.useEffect(() => {
    if (gameStatus !== "finished") return;
    if (seenGameOverRef.current) return;
    seenGameOverRef.current = true;
    showTelegram("KONEC HRY — Sezóna skončila.");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameStatus]);

  // Late-join spectator telegram — jednorázový lokální telegram po redirectu z LandingPage.
  // lateJoinRef je nastaven v loadGame po přečtení sessionStorage flagu; spustí se jen jednou.
  React.useEffect(() => {
    if (viewerRole !== "spectator") return;
    if (!lateJoinRef.current) return;
    lateJoinRef.current = false;
    showTelegram("ZÁVOD BĚŽÍ — Připojil ses jako pozorovatel.");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewerRole]);

  // Join telegram — lokální detekce nového hráče; jen pro aktivní hráče, ne spectatory.
  // knownPlayerIdsRef = null znamená "ještě neinicializováno" — první běh nastaví ref bez telegramu.
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

  // ── Načtení hry ze Supabase ──────────────────────────────────────────────────
  React.useEffect(() => {
    if (!gameCode) return;

    const loadGame = async () => {
      const { data: game } = await supabase
        .from("games")
        .select()
        .eq("code", gameCode)
        .single();

      if (!game) { setLoading(false); return; }
      setGameId(game.id);
      setThemeId(game.theme_id ?? "horse-day");
      setBoardId(game.board_id ?? "small");
      setGameMode((game.game_mode ?? "online") as "online" | "local");
      setGameStatus(game.status);
      // Seed: pokud hra už skončila před načtením, nezobrazuj GAME OVER telegram znovu
      if (game.status === "finished" || game.status === "cancelled") seenGameOverRef.current = true;
      setFogOfWar(!!game.fog_of_war);
      if (game.economy && typeof game.economy === "object") {
        setEconomy({ ...DEFAULT_ECONOMY, ...(game.economy as Partial<EconomyConfig>) });
      }

      const { data: { user } } = await supabase.auth.getUser();
      const myDiscordId = user?.user_metadata?.provider_id as string | undefined;
      const myAvatarUrl = user?.user_metadata?.avatar_url as string | null ?? null;
      if (myAvatarUrl) setMyDiscordAvatar(myAvatarUrl);

      const pid = localStorage.getItem(`paytowin_player_${gameCode}`);
      setMyPlayerId(pid);

      // Urči roli: hráč / pozorovatel / nepřihlášen
      if (pid) {
        setViewerRole("player");
      } else {
        const role = myDiscordId ? "spectator" : "login_required";
        setViewerRole(role);
        if (role === "spectator") {
          logEvent({ name: "spectator_view", game_code: gameCode });
          if (sessionStorage.getItem("paytowin_late_join") === gameCode) {
            sessionStorage.removeItem("paytowin_late_join");
            lateJoinRef.current = true;
          }
        }
      }

      // Host detekce: Discord ID musí souhlasit s owner_discord_id hry
      if (myDiscordId && game.owner_discord_id && myDiscordId === game.owner_discord_id) {
        setIsHost(true);
      }

      await refreshGame(game.id);
      setLoading(false);

      if (game.status === "waiting") {
        await supabase.from("games").update({ status: "playing" }).eq("id", game.id);
      }
    };

    loadGame();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameCode]);

  const refreshGame = async (id: string) => {
    const [{ data: playersData }, { data: stateData }] = await Promise.all([
      supabase.from("players").select().eq("game_id", id).order("turn_order"),
      supabase.from("game_state").select().eq("game_id", id).single(),
    ]);
    let normalized = (playersData ?? []).map(normalizePlayer);

    // Pojistka: pokud právě animujeme pohyb, nepřepíše Realtime pozici animující figurky
    // (stale closure v Realtime handleru by jinak skočila zpět na DB pozici)
    if (animatingPlayerIdRef.current !== null && animPositionRef.current !== null) {
      normalized = normalized.map(p => {
        if (p.id !== animatingPlayerIdRef.current) return p;
        if (p.position !== animPositionRef.current) {
          console.log(`[turn-flow] refreshGame guard active — DB pos=${p.position} overridden with anim pos=${animPositionRef.current}`);
        }
        return { ...p, position: animPositionRef.current! };
      });
    }

    setPlayers(normalized);
    if (stateData) {
      const ns = normalizeState(stateData);
      // Seed seenRevealedRef s aktuálně odhalenými poli — nepřehrávají flip při načtení
      if (seenRevealedRef.current.size === 0 && ns.revealed_fields.length > 0) {
        seenRevealedRef.current = new Set(ns.revealed_fields);
      }
      // Seed seenYearEventTurnRef — telegram z minulých tahů se při (re)načtení nezobrazí
      if (seenYearEventTurnRef.current === 0 && ns.year_event_telegram?.turn) {
        seenYearEventTurnRef.current = ns.year_event_telegram.turn;
      }
      setGameState(ns);
    }
    return { players: normalized, state: stateData ? normalizeState(stateData) : null };
  };

  // ── Realtime subscriptions ───────────────────────────────────────────────────
  React.useEffect(() => {
    if (!gameId) return;

    const channel = supabase
      .channel(`game:${gameId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "games", filter: `id=eq.${gameId}` },
        (payload) => {
          const updated = payload.new as { status?: string };
          if (updated.status) setGameStatus(updated.status);
        }
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "players", filter: `game_id=eq.${gameId}` },
        () => { refreshGame(gameId); }
      )
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "game_state", filter: `game_id=eq.${gameId}` },
        async () => {
          const { players: freshPlayers, state: freshState } = await refreshGame(gameId);
          if (!freshState) return;
          // horse_pending v DB je jediný zdroj pravdy — žádné hádání indexů
          if (freshState.horse_pending) {
            const currentP = freshPlayers[freshState.current_player_index];
            const field = currentP ? fieldsRef.current[currentP.position] : null;
            if (field?.type === "racer" && field.racer) {
              setPendingRacer({ racer: field.racer, playerIndex: freshState.current_player_index });
            }
          } else {
            setPendingRacer(null);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]);

  // ── Herní akce ────────────────────────────────────────────────────────────────

  /** Zobrazí dočasný center feedback pro coins_gain / coins_lose — auto-hide po 3 s. */
  const showCoinsFeedback = React.useCallback((amount: number, kind: "gain" | "lose", playerName: string, fieldLabel: string) => {
    if (coinsFeedbackTimerRef.current) clearTimeout(coinsFeedbackTimerRef.current);
    setCoinsFeedback({ amount, kind, playerName, fieldLabel });
    coinsFeedbackTimerRef.current = setTimeout(() => setCoinsFeedback(null), 3000);
    playSfx(kind === "gain" ? "coin_gain" : "coin_loss");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Zobrazí telegramový proužek + přehraje morse cue prvního CAPS segmentu. */
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

  /** Zobrazí krátký centrální spotlight — auto-dismiss po dané době. */
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
  }, []);

  // Zobrazí nouzové varování před bankrotem. Vrací hráče po prodeji (nebo beze změny).
  const confirmBankruptOrSell = React.useCallback((player: Player): Promise<Player> => {
    if (player.horses.length === 0) return Promise.resolve(player);
    return new Promise(resolve => {
      const totalSellValue = player.horses.reduce((sum, h) => sum + Math.floor(h.price * 0.8), 0);
      bankruptWarningResolverRef.current = (sellAll: boolean) => {
        setBankruptWarning(null);
        bankruptWarningResolverRef.current = null;
        if (sellAll) {
          resolve({ ...player, coins: player.coins + totalSellValue, horses: [] });
        } else {
          resolve(player);
        }
      };
      setBankruptWarning({
        playerName: player.name,
        horses: player.horses,
        totalSellValue,
        willSurvive: player.coins + totalSellValue > 0,
      });
    });
  }, []);

  const rollDice = async () => {
    const activePendingRace = gameState?.offer_pending?.type === "race" ? gameState.offer_pending as RaceOffer : null;
    const activePendingBankrupt = gameState?.offer_pending?.type === "bankrupt_announcement";
    const activePendingRacePlaceholder = gameState?.offer_pending?.type === "race_pending";
    if (!gameState || pendingRacer || pendingCard || pendingOffer || pendingRollDecision || activePendingRace || activePendingBankrupt || activePendingRacePlaceholder || isRolling || isMoving || bankruptWarning) return;

    const roll = Math.floor(Math.random() * 6) + 1;
    const currentPlayer = players[gameState.current_player_index];
    if (!currentPlayer) return;

    console.log(`[turn-flow] roll start — player="${currentPlayer.name}" pos=${currentPlayer.position} roll=${roll}`);

    playSfx("dice");
    setIsRolling(true);
    setDisplayRoll(null);
    const animDuration = 800 + Math.random() * 400;
    const start = Date.now();
    while (Date.now() - start < animDuration) {
      setDisplayRoll(Math.floor(Math.random() * 6) + 1);
      await sleep(80);
    }
    setDisplayRoll(roll);
    await sleep(300);
    setIsRolling(false);


    const selectedAdjustment = await new Promise<RollAdjustment>((resolve) => {
      const decision: PendingRollDecision = {
        playerId: currentPlayer.id,
        playerIndex: gameState.current_player_index,
        baseRoll: roll,
        basePosition: currentPlayer.position,
      };
      rollDecisionResolvedRef.current = false;
      pendingRollResolverRef.current = resolve;
      setPendingRollDecision(decision);
      clearRollDecisionTimer();
      rollDecisionTimerRef.current = setTimeout(() => {
        resolveRollDecision(0);
      }, 3000);
    });

    const adjustmentAllowed = selectedAdjustment !== 0 &&
      currentPlayer.coins >= 600 &&
      (roll + selectedAdjustment) >= 1;
    const finalAdjustment = adjustmentAllowed ? selectedAdjustment : 0;
    const finalRoll = roll + finalAdjustment;
    const adjustmentCost = finalAdjustment === 0 ? 0 : 600;

    // ── 2. Animace pohybu pole po poli ────────────────────────────────────────
    const oldPosition = currentPlayer.position;
    const fieldCount = FIELDS.length;
    const newPosition = (oldPosition + finalRoll) % fieldCount;

    setIsMoving(true);
    setAnimatingPlayerIdx(gameState.current_player_index);
    setAnimPosition(oldPosition);
    setTrailFields([]);
    // Nastav refs — refreshGame je bude číst i ze stale closure v Realtime handleru
    animatingPlayerIdRef.current = currentPlayer.id;
    animPositionRef.current = oldPosition;

    const movePrimaryHorse = currentPlayer.horses.find(h => h.isPreferred) ?? currentPlayer.horses[0];
    const moveRacerType = movePrimaryHorse ? racerSoundType(movePrimaryHorse, getThemeRacers(theme)) : null;

    const trail: number[] = [];
    for (let step = 1; step <= finalRoll; step++) {
      const pos = (oldPosition + step) % fieldCount;
      trail.push(pos);
      setAnimPosition(pos);
      animPositionRef.current = pos;
      setTrailFields([...trail]);
      if (moveRacerType === "horse") playSfx("hoof_step");
      else if (moveRacerType === "car") playSfx("engine_step");
      else playStepSound();
      await sleep(160);
    }

    setIsMoving(false);
    // animatingPlayerIdx necháme nastavený až po zápisu do DB — jinak figurka
    // problikne na starou pozici (player.position v DB ještě není aktualizované)

    console.log(`[turn-flow] animation done — targetPos=${newPosition} field="${FIELDS[newPosition]?.type}"`);

    // ── 3. Herní logika + zápis do Supabase ───────────────────────────────────
    const field = FIELDS[newPosition];
    const newLog = gameState.log ?? [];
    const newTurnCount = gameState.turn_count + 1;
    const currentRound = Math.floor(gameState.turn_count / Math.max(1, players.length));

    // Průchod STARTem bez přistání (přeskočení pole 0)
    const passedStart = newPosition !== 0 && (oldPosition + finalRoll) >= fieldCount;

    let movedPlayer = { ...currentPlayer, position: newPosition, coins: currentPlayer.coins - adjustmentCost };
    const extraLog: string[] = [];
    // Fog: base pro reveal tohoto tahu — může být přepsán krizovým resetem
    let fogRevealBase: number[] | undefined = undefined;
    // Year event telegram payload — naplní se pokud player projde STARTem a spustí rok. event
    let yearEventTelegramPayload: { text: string; turn: number } | undefined;

    if (finalAdjustment !== 0) {
      const signed = finalAdjustment > 0 ? `+${finalAdjustment}` : `${finalAdjustment}`;
      extraLog.push(`${currentPlayer.name} upravil hod o ${signed} krok za ${adjustmentCost} 💰`);
    }

    if (passedStart) {
      movedPlayer = { ...movedPlayer, coins: movedPlayer.coins + economy.stateSubsidy };
      extraLog.push(`${currentPlayer.name} prošel STARTem — +${economy.stateSubsidy} 💰`);
    }

    // Daň za průchod/přistání na STARTu — roste s počtem průchodů (laps-based).
    // laps před tímto průchodem: 0 = první průchod = bez daně, 1 = druhý = baseTax, atd.
    if (passedStart || newPosition === 0) {
      const currentLaps = currentPlayer.laps ?? 0;
      const startTax = getStartTax(currentLaps, economy);
      movedPlayer = { ...movedPlayer, laps: currentLaps + 1 };
      if (startTax > 0) {
        movedPlayer = { ...movedPlayer, coins: movedPlayer.coins - startTax };
        extraLog.push(`${currentPlayer.name}: Výpalné (daně) za průchod STARTem — -${startTax} 💰`);
      }
      // Roční event — vyhodnotí se jednou při průchodu STARTem pro nový rok
      const yearStart = theme.mapMeta?.yearStart ?? 1921;
      const campaignOffset = movedPlayer.laps ?? 0; // po inkrementu
      const displayYear = yearStart + campaignOffset;
      const yearEvent = resolveYearEvent(campaignOffset, displayYear, theme.yearEvents);
      if (yearEvent) {
        extraLog.push(`📅 ${displayYear}: ${yearEvent.title}`);
        const telegramText = `${yearEvent.title} — ${displayYear}: ${yearEvent.body ?? yearEvent.title}`;
        yearEventTelegramPayload = { text: telegramText, turn: newTurnCount };
        // Aktivní hráč vidí okamžitě; seenRef zabrání dvojímu zobrazení přes Realtime
        seenYearEventTurnRef.current = newTurnCount;
        showTelegram(telegramText);
      }
      // Reset non-racer karet — řízeno flagem v eventu, ne hardcoded rokem
      if (fogOfWar && (yearEvent?.resetNonRacerCards || yearEvent?.crisis)) {
        fogRevealBase = buildCrisisReset(FIELDS);
        seenRevealedRef.current = new Set(fogRevealBase);
        extraLog.push(`💥 Krize roku ${displayYear} — karty znovu skryté.`);
      }
    }

    if (field.type === "racer" && field.racer) {
      const alreadyOwned = playerOwnsRacer(movedPlayer, field.racer);
      // Vlastník = jiný hráč který má tohoto racera — id-first, name fallback pro stará data
      const ownerPlayer = players.find(
        p => p.id !== currentPlayer.id && playerOwnsRacer(p, field.racer!)
      );
      const lookupSource = (field.racer.id && ownerPlayer?.horses.some(h => h.id)) ? "id" : "name";
      console.log(`[racer-rent] owner lookup via ${lookupSource} for racer "${field.racer.name}" (id=${field.racer.id ?? "none"}) — owner=${ownerPlayer?.name ?? "none"}`);

      if (alreadyOwned) {
        // Hráč tohoto závodníka už vlastní — přeskočíme nabídku, pokračujeme normálně
        console.log(`[racer-rent] ${currentPlayer.name} landed on own racer "${field.racer.name}" — no rent`);
        const logLines = [`${currentPlayer.name} přijel ke své ${theme.labels.racerField.toLowerCase()}: ${field.racer.emoji} ${field.racer.name}`, ...extraLog];
        const updatedPlayers = players.map((p, i) =>
          i === gameState.current_player_index ? movedPlayer : p
        );
        const nextIndex = getNextActiveIndex(gameState.current_player_index, updatedPlayers);
        await supabase.from("players").update({ position: newPosition, coins: movedPlayer.coins, laps: movedPlayer.laps ?? 0 }).eq("id", currentPlayer.id);
        await finishTurn({ nextIndex, turnCount: newTurnCount, log: [...logLines, ...newLog], lastRoll: roll, ...(yearEventTelegramPayload ? { yearEventTelegram: yearEventTelegramPayload } : {}) });
      } else if (ownerPlayer) {
        if (canTriggerRivalsRace(movedPlayer, ownerPlayer)) {
          // ── Rivals race: oba hráči mají závodníky → duel místo rentu ──────────
          const reward = Math.round(field.racer.price * 0.2);
          const logLines = [`⚔️ ${currentPlayer.name} vstoupil na ${theme.labels.racerField.toLowerCase()} ${ownerPlayer.name} — čeká je souboj!`, ...extraLog];
          const updatedPlayersForNext = players.map(p => p.id === currentPlayer.id ? movedPlayer : p);
          const nextIndex = getNextActiveIndex(gameState.current_player_index, updatedPlayersForNext);
          await supabase.from("players").update({ position: newPosition, coins: movedPlayer.coins, laps: movedPlayer.laps ?? 0 }).eq("id", currentPlayer.id);
          await finishTurn({
            nextIndex, turnCount: newTurnCount, log: [...logLines, ...newLog], lastRoll: roll,
            postTurnEvent: { kind: "race_pending", raceType: "rivals_race", playerIds: [currentPlayer.id, ownerPlayer.id], reward },
            ...(yearEventTelegramPayload ? { yearEventTelegram: yearEventTelegramPayload } : {}),
          });
        } else {
          // ── Rent fallback: jeden nebo oba hráči nemají závodníka ──────────────
          const rent = Math.round(field.racer.price * 0.2);
          const rentedPlayer = { ...movedPlayer, coins: movedPlayer.coins - rent };
          const paidOwner = { ...ownerPlayer, coins: ownerPlayer.coins + rent };

          console.log(`[racer-rent] ${currentPlayer.name} (id=${currentPlayer.id}) landed on "${field.racer.name}" (racer.id=${field.racer.id ?? "none"}) owned by ${ownerPlayer.name} (id=${ownerPlayer.id}) → rent=${rent}`);
          console.log(`[racer-rent] transfer: ${currentPlayer.name} ${movedPlayer.coins}→${rentedPlayer.coins}, ${ownerPlayer.name} ${ownerPlayer.coins}→${paidOwner.coins}`);

          const wouldBankruptRent = rentedPlayer.coins <= 0 && currentPlayer.coins > 0;
          const finalRentedPlayer = wouldBankruptRent ? await confirmBankruptOrSell(rentedPlayer) : rentedPlayer;
          const wentBankrupt = finalRentedPlayer.coins <= 0 && currentPlayer.coins > 0;
          const logLines = [
            `${currentPlayer.name} zaplatil ${rent} 💰 hráči ${ownerPlayer.name} za ${field.racer.emoji} ${field.racer.name}`,
            ...extraLog,
          ];
          if (wentBankrupt) {
            logLines.push(`💀 ${finalRentedPlayer.name} zkrachoval!`);
            playSfx("bankrupt");
            console.log(`[racer-rent] ${finalRentedPlayer.name} went bankrupt after paying rent`);
          } else if (wouldBankruptRent) {
            logLines.push(`${finalRentedPlayer.name} prodal koně a přežil! 💰`);
          }

          const updatedPlayers = players.map(p => {
            if (p.id === finalRentedPlayer.id) return finalRentedPlayer;
            if (p.id === paidOwner.id) return paidOwner;
            return p;
          });
          const nextIndex = getNextActiveIndex(gameState.current_player_index, updatedPlayers);

          // Oba hráči se aktualizují najednou; game_state až potom
          const activeAfterRent = updatedPlayers.filter(p => !isBankrupt(p));
          const rentGameEnds = (updatedPlayers.length >= 2 && activeAfterRent.length === 1) ||
                               (updatedPlayers.length === 1 && activeAfterRent.length === 0);

          await Promise.all([
            supabase.from("players").update({ position: finalRentedPlayer.position, coins: finalRentedPlayer.coins, horses: finalRentedPlayer.horses, laps: finalRentedPlayer.laps ?? 0 }).eq("id", finalRentedPlayer.id),
            supabase.from("players").update({ coins: paidOwner.coins }).eq("id", paidOwner.id),
          ]);
          await finishTurn({
            nextIndex, turnCount: newTurnCount, log: [...logLines, ...newLog], lastRoll: roll,
            ...(wouldBankruptRent ? { updatedCurrentPlayerHorses: finalRentedPlayer.horses } : {}),
            ...(wentBankrupt && !rentGameEnds ? { postTurnEvent: { kind: "announcement" as const, playerId: finalRentedPlayer.id, playerName: finalRentedPlayer.name } } : {}),
            ...(wentBankrupt ? { bustPlayerId: finalRentedPlayer.id } : {}),
            ...(yearEventTelegramPayload ? { yearEventTelegram: yearEventTelegramPayload } : {}),
          });

          if (wentBankrupt) await checkAndFinishGame(updatedPlayers);
        }
      } else {
        // Čekáme na rozhodnutí hráče. horse_pending = true v DB (DB sloupec zachován).
        await supabase.from("players").update({ position: newPosition, coins: movedPlayer.coins, laps: movedPlayer.laps ?? 0 }).eq("id", currentPlayer.id);
        await supabase.from("game_state").update({
          last_roll: roll,
          turn_count: newTurnCount,
          horse_pending: true,
          card_pending: null,
          offer_pending: null,
          log: [`${currentPlayer.name} přišel na ${theme.labels.racerField.toLowerCase()}: ${field.racer.emoji} ${field.racer.name}`, ...extraLog, ...newLog].slice(0, 20),
          year_event_telegram: yearEventTelegramPayload ?? null,
          ...(fogOfWar ? { revealed_fields: buildFogReveal(newPosition, fogRevealBase) } : {}),
        }).eq("game_id", gameId);
        if (canReroll) setCanReroll(false);
        setPendingRacer({ racer: field.racer, playerIndex: gameState.current_player_index });
      }
    } else if (field.type === "chance" || field.type === "finance" || field.type === "mafia") {
      // ── Karta: lízni, zobraz všem, efekt se aplikuje automaticky po 2.5 s ──
      const card = drawCard(field.type, theme.content?.cards, theme.cardThemeTag);
      const cardLabel = field.type === "chance" ? "🎴 Osud" : field.type === "mafia" ? "🎭 Mafie" : "💼 Finance";
      // FIX pořadí: nejdřív uložíme finální pozici hráče, pak card_pending.
      // applyCardEffect poběží ze stale closure (timer 2.5s) — position musí být
      // v DB stabilní předtím, než se karta aplikuje.
      console.log(`[turn-flow] card field — persisting position=${newPosition} before card_pending`);
      await supabase.from("players").update({ position: newPosition, coins: movedPlayer.coins, laps: movedPlayer.laps ?? 0 }).eq("id", currentPlayer.id);
      console.log(`[turn-flow] card_pending set — card="${card.id}" kind="${card.effect.kind}"`);
      await supabase.from("game_state").update({
        last_roll: roll,
        turn_count: newTurnCount,
        horse_pending: false,
        card_pending: card as unknown as Record<string, unknown>,
        offer_pending: null,
        log: [`${currentPlayer.name} lízl kartu ${cardLabel}`, ...extraLog, ...newLog].slice(0, 20),
        year_event_telegram: yearEventTelegramPayload ?? null,
        ...(fogOfWar ? { revealed_fields: buildFogReveal(newPosition, fogRevealBase) } : {}),
      }).eq("game_id", gameId);
      if (canReroll) setCanReroll(false);
      // Lokální state — ostatní klienti dostanou přes Realtime
      setPendingCard({ card, playerIndex: gameState.current_player_index });
    } else {
      const { player: afterField, log: fieldLog } = field.action(movedPlayer);
      const logLines = [...(fieldLog ? [fieldLog] : []), ...extraLog];

      // Center feedback pro finanční pole
      if (field.type === "coins_lose") {
        showCoinsFeedback(afterField.coins - movedPlayer.coins, "lose", movedPlayer.name, field.label);
      } else if (field.type === "coins_gain") {
        showCoinsFeedback(afterField.coins - movedPlayer.coins, "gain", movedPlayer.name, field.label);
      }

      // Bankrot? — dej hráči šanci prodat koně, pak znovu vyhodnoť
      const wouldBankrupt = afterField.coins <= 0 && currentPlayer.coins > 0;
      const finalPlayer = wouldBankrupt ? await confirmBankruptOrSell(afterField) : afterField;
      const wentBankrupt = finalPlayer.coins <= 0;
      if (wentBankrupt) { logLines.push(`💀 ${finalPlayer.name} zkrachoval!`); playSfx("bankrupt"); }
      else if (wouldBankrupt) logLines.push(`${finalPlayer.name} prodal koně a přežil! 💰`);

      const updatedPlayers = players.map((p, i) =>
        i === gameState.current_player_index ? finalPlayer : p
      );
      const nextIndex = getNextActiveIndex(gameState.current_player_index, updatedPlayers);

      // Hráč aktualizován vždy (pozice, coins, koně)
      console.log(`[turn-flow] normal field persist — pos=${finalPlayer.position} coins=${finalPlayer.coins} wentBankrupt=${wentBankrupt}`);
      await supabase.from("players").update({ position: finalPlayer.position, coins: finalPlayer.coins, horses: finalPlayer.horses, laps: finalPlayer.laps ?? 0 }).eq("id", currentPlayer.id);

      // Nabídka rerollu: 25 % šance, jen pokud nešel do bankrotu a nejde o reroll
      const triggerOffer = !canReroll && !wentBankrupt && Math.random() < REROLL_CHANCE;

      const activeAfterNormal = updatedPlayers.filter(p => !isBankrupt(p));
      const normalGameEnds = (updatedPlayers.length >= 2 && activeAfterNormal.length === 1) ||
                             (updatedPlayers.length === 1 && activeAfterNormal.length === 0);

      if (triggerOffer) {
        const offer: OfferPending = { type: "reroll", playerId: currentPlayer.id, playerName: currentPlayer.name, cost: REROLL_COST };
        await supabase.from("game_state").update({
          last_roll: roll,
          horse_pending: false,
          card_pending: null,
          offer_pending: offer as unknown as Record<string, unknown>,
          log: [...logLines, `💡 Nabídka, co lze odmítnout — pro ${currentPlayer.name}`, ...newLog].slice(0, 20),
          year_event_telegram: yearEventTelegramPayload ?? null,
          ...(fogOfWar ? { revealed_fields: buildFogReveal(newPosition, fogRevealBase) } : {}),
        }).eq("game_id", gameId);
        if (flashActiveRef.current) {
          deferredOfferRef.current = offer as RerollOffer;
        } else {
          setPendingOffer(offer);
        }
      } else {
        await finishTurn({
          nextIndex, turnCount: newTurnCount, log: [...logLines, ...newLog], lastRoll: roll,
          ...(wouldBankrupt ? { updatedCurrentPlayerHorses: finalPlayer.horses } : {}),
          ...(wentBankrupt && !normalGameEnds ? { postTurnEvent: { kind: "announcement" as const, playerId: finalPlayer.id, playerName: finalPlayer.name } } : {}),
          ...(fogOfWar ? { revealedFields: buildFogReveal(newPosition, fogRevealBase) } : {}),
          ...(wentBankrupt ? { bustPlayerId: finalPlayer.id } : {}),
          ...(yearEventTelegramPayload ? { yearEventTelegram: yearEventTelegramPayload } : {}),
        });
        if (canReroll) setCanReroll(false);
      }

      if (wentBankrupt) await checkAndFinishGame(updatedPlayers);
    }

    // ── 4. Vyčisti animační stav, stopa zmizí po 1,5 s ──────────────────────
    // Optimistický update pozice: nastav newPosition lokálně PŘED vymazáním refs.
    // Bez toho by displayPlayers přepnulo zpět na starý players[i].position
    // (Realtime refreshGame ještě nedorazil) a figurka by problikla zpět.
    // Nová pozice je ve všech větvích zapsána do DB dřív, než sem dorazíme,
    // takže optimistický update je konzistentní s DB stavem.
    setPlayers(prev => prev.map(p =>
      p.id === currentPlayer.id ? { ...p, position: newPosition } : p
    ));
    setAnimatingPlayerIdx(null);
    animatingPlayerIdRef.current = null;
    animPositionRef.current = null;
    setTimeout(() => setTrailFields([]), 3000);
  };

  /**
   * Vrátí true pokud všichni aktivní hráči vlastní ≥1 racera — trigger pro závod.
   * Voláno jen v buyRacer, protože ownership se mění pouze nákupem.
   */
  const shouldTriggerRacePending = (updatedPlayers: Player[]): boolean => {
    if (gameStatus !== "playing") return false;
    if (gameState?.mass_race_done) return false; // mass race už proběhl, nepouštět znovu
    const activePlayers = updatedPlayers.filter(p => !isBankrupt(p));
    if (activePlayers.length < 2) return false;
    return activePlayers.every(p => p.horses.length > 0);
  };

  const buyRacer = async () => {
    if (!pendingRacer || !gameState) return;
    const { racer, playerIndex } = pendingRacer;
    const player = players[playerIndex];
    if (!player || player.coins < racer.price) return;
    if (playerOwnsRacer(player, racer)) return; // pojistka: už vlastní (id-first)

    const updatedCoins = player.coins - racer.price;
    const updatedHorses = [...player.horses, racer];
    const newLog = gameState.log ?? [];
    const newTurnCount = gameState.turn_count + 1;

    const wouldBankruptBuy = updatedCoins <= 0;
    let finalCoins = updatedCoins;
    let finalHorses = updatedHorses;
    if (wouldBankruptBuy) {
      const playerAfterBuy = { ...player, coins: updatedCoins, horses: updatedHorses };
      const resolved = await confirmBankruptOrSell(playerAfterBuy);
      finalCoins = resolved.coins;
      finalHorses = resolved.horses;
    }
    const wentBankrupt = finalCoins <= 0;
    const logLines = [`${player.name} koupil ${racer.emoji} ${racer.name} za ${racer.price} 💰`];
    if (wentBankrupt) { logLines.push(`💀 ${player.name} zkrachoval!`); playSfx("bankrupt"); }
    else if (wouldBankruptBuy) logLines.push(`${player.name} prodal koně a přežil! 💰`);

    // Zahrnuje finální koně — race trigger potřebuje vidět aktuální ownership
    const updatedPlayers = players.map((p, i) =>
      i === playerIndex ? { ...player, coins: finalCoins, horses: finalHorses } : p
    );
    const nextIndex = getNextActiveIndex(playerIndex, updatedPlayers);

    const activeAfterBuy = updatedPlayers.filter(p => !isBankrupt(p));
    const buyGameEnds = (updatedPlayers.length >= 2 && activeAfterBuy.length === 1) ||
                        (updatedPlayers.length === 1 && activeAfterBuy.length === 0);

    // Priorita: bankrot announcement > race trigger
    let postTurnEvent: PostTurnEvent | undefined;
    if (wentBankrupt && !buyGameEnds) {
      postTurnEvent = { kind: "announcement" as const, playerId: player.id, playerName: player.name };
    } else if (shouldTriggerRacePending(updatedPlayers)) {
      postTurnEvent = { kind: "race_pending" as const, playerIds: activeAfterBuy.map(p => p.id) };
      logLines.push("🏁 Závod se připravuje!");
    }

    await supabase.from("players").update({ coins: finalCoins, horses: finalHorses }).eq("id", player.id);

    // Optimistický update: okamžitě promítni nové horses + coins do lokálního stavu
    setPlayers(prev => prev.map(p =>
      p.id === player.id ? { ...p, coins: finalCoins, horses: finalHorses } : p
    ));

    await finishTurn({
      nextIndex, turnCount: newTurnCount, log: [...logLines, ...newLog],
      updatedCurrentPlayerHorses: finalHorses,
      ...(postTurnEvent ? { postTurnEvent } : {}),
      ...(wentBankrupt ? { bustPlayerId: player.id } : {}),
    });

    if (wentBankrupt) await checkAndFinishGame(updatedPlayers);
    setPendingRacer(null);
  };

  /**
   * sellRacerToBank — hráč prodá jednoho racera zpět bance za 80 % původní ceny.
   *
   * Povoleno jen ve vlastním tahu bez aktivní pending akce.
   * Neukončuje tah — hráč pokračuje dál (hodí nebo provede další akci).
   */
  const sellRacerToBank = async (player: Player, racer: Horse) => {
    if (!gameState) return;
    const sellPrice = Math.floor(racer.price * 0.8);
    const updatedCoins = player.coins + sellPrice;
    const racerKey = racerOwnershipKey(racer);
    const updatedHorses = player.horses.filter(h => racerOwnershipKey(h) !== racerKey);

    const newLog = [
      `${player.name} prodal ${racer.emoji} ${racer.name} bance za ${sellPrice} 💰`,
      ...(gameState.log ?? []),
    ].slice(0, 20);

    await supabase.from("players").update({ coins: updatedCoins, horses: updatedHorses }).eq("id", player.id);
    await supabase.from("game_state").update({ log: newLog }).eq("game_id", player.game_id);

    setPlayers(prev => prev.map(p =>
      p.id === player.id ? { ...p, coins: updatedCoins, horses: updatedHorses } : p
    ));
    showCoinsFeedback(sellPrice, "gain", player.name, `Prodej ${racer.name}`);
  };

  // Označí jednoho koně jako preferred (ostatní se odznačí); racerKey=null = zrušit výběr
  const setPreferredRacer = async (playerId: string, racerKey: string | null) => {
    const player = players.find(p => p.id === playerId);
    if (!player) return;
    const updatedHorses = player.horses.map(h => ({
      ...h,
      isPreferred: racerKey !== null && racerOwnershipKey(h) === racerKey,
    }));
    await supabase.from("players").update({ horses: updatedHorses }).eq("id", playerId);
  };

  const skipRacer = async () => {
    if (!pendingRacer || !gameState) return;
    const player = players[pendingRacer.playerIndex];
    const nextIndex = getNextActiveIndex(pendingRacer.playerIndex, players);
    const newLog = gameState.log ?? [];

    await finishTurn({
      nextIndex,
      turnCount: gameState.turn_count + 1,
      log: [`${player?.name ?? "?"} přeskočil nákup`, ...newLog],
    });

    setPendingRacer(null);
  };

  // ── Nabídka rerollu ───────────────────────────────────────────────────────────

  const acceptOffer = async () => {
    if (!pendingOffer || !gameState || !gameId) return;
    // Ochrana: tato nabídka už byla potvrzena
    const key = pendingOffer.playerId + "_" + gameState.turn_count;
    if (offerAcceptedRef.current === key) return;
    offerAcceptedRef.current = key;

    const player = players.find(p => p.id === pendingOffer.playerId);
    if (!player || player.coins < pendingOffer.cost) return;

    // Optimisticky skryj modal hned — předchází Realtime race (players.update fires před game_state.update)
    setPendingOffer(null);

    const newLog = gameState.log ?? [];
    await supabase.from("players").update({ coins: player.coins - pendingOffer.cost }).eq("id", player.id);
    await supabase.from("game_state").update({
      offer_pending: null,
      log: [`${player.name} zaplatil ${pendingOffer.cost} 💰 za druhý hod`, ...newLog].slice(0, 20),
    }).eq("game_id", gameId);

    setCanReroll(true);
    setPendingOffer(null);
  };

  const declineOffer = async () => {
    if (!pendingOffer || !gameState || !gameId) return;
    const newLog = gameState.log ?? [];
    const nextIndex = getNextActiveIndex(gameState.current_player_index, players);
    await finishTurn({
      nextIndex,
      turnCount: gameState.turn_count + 1,
      log: [`${pendingOffer.playerName} odmítl nabídku`, ...newLog],
    });

    setPendingOffer(null);
  };

  // ── Efekt karty ──────────────────────────────────────────────────────────────

  /**
   * Aplikuje efekt karty — volá POUZE aktivní hráčův klient (isMyTurn).
   * Ochrana cardAppliedRef zabrání dvojímu spuštění při re-renderu.
   *
   * FIX: playerUpdate záměrně NEobsahuje position pro coins/skip_turn karty.
   * Důvod: applyCardEffect může být zavolán ze stale closure timeru (2.5s),
   * kdy players state ještě nemá Realtime-aktualizovanou pozici po tahu.
   * Zápis stale position by resetoval figurku zpět.
   * Position se ukládá pouze tehdy, kdy ji karta skutečně mění (kind==="move").
   */
  const applyCardEffect = React.useCallback(async (card: GameCard, playerIndex: number) => {
    if (!gameState || !gameId) return;
    // Ochrana: karta tohoto ID už byla aplikována
    if (cardAppliedRef.current === card.id + "_" + gameState.turn_count) return;
    cardAppliedRef.current = card.id + "_" + gameState.turn_count;

    const player = players[playerIndex];
    if (!player) return;

    console.log(`[turn-flow] applyCardEffect start — player="${player.name}" pos=${player.position} card="${card.id}" kind="${card.effect.kind}"`);

    let updatedPlayer = { ...player };
    const logLines: string[] = [];
    const newLog = gameState.log ?? [];
    let cardMovedToRacer: Horse | undefined;
    let cardYearEventTelegram: { text: string; turn: number } | undefined;

    if (card.effect.kind === "coins" && card.effect.value !== undefined) {
      updatedPlayer = { ...updatedPlayer, coins: updatedPlayer.coins + card.effect.value };
      const sign = card.effect.value > 0 ? "+" : "";
      logLines.push(`${player.name}: ${card.text} (${sign}${card.effect.value} 💰)`);
    } else if (card.effect.kind === "move" && card.effect.value !== undefined) {
      const fc = fieldsRef.current.length;
      const oldPos = updatedPlayer.position;
      const newPos = ((oldPos + card.effect.value) % fc + fc) % fc;
      console.log(`[turn-flow] card move: from pos=${oldPos} by ${card.effect.value} → pos=${newPos}`);
      updatedPlayer = { ...updatedPlayer, position: newPos };
      const sign = card.effect.value > 0 ? "+" : "";
      logLines.push(`${player.name}: ${card.text} (posun ${sign}${card.effect.value})`);

      // START crossing — forward card move that wraps past field 0
      const passedStartCard = card.effect.value > 0 && newPos < oldPos;
      if (passedStartCard || newPos === 0) {
        if (passedStartCard) {
          updatedPlayer = { ...updatedPlayer, coins: updatedPlayer.coins + economy.stateSubsidy };
          logLines.push(`${player.name} prošel STARTem — +${economy.stateSubsidy} 💰`);
        }
        const currentLaps = updatedPlayer.laps ?? 0;
        const startTax = getStartTax(currentLaps, economy);
        updatedPlayer = { ...updatedPlayer, laps: currentLaps + 1 };
        if (startTax > 0) {
          updatedPlayer = { ...updatedPlayer, coins: updatedPlayer.coins - startTax };
          logLines.push(`${player.name}: Výpalné (daně) za průchod STARTem — -${startTax} 💰`);
        }
        const yearStart = theme.mapMeta?.yearStart ?? 1921;
        const campaignOffset = updatedPlayer.laps ?? 0;
        const displayYear = yearStart + campaignOffset;
        const yearEvent = resolveYearEvent(campaignOffset, displayYear, theme.yearEvents);
        if (yearEvent) {
          logLines.push(`📅 ${displayYear}: ${yearEvent.title}`);
          const telegramText = `${yearEvent.title} — ${displayYear}: ${yearEvent.body ?? yearEvent.title}`;
          cardYearEventTelegram = { text: telegramText, turn: gameState.turn_count + 1 };
          seenYearEventTurnRef.current = gameState.turn_count + 1;
          showTelegram(telegramText);
        }
      }

      // Landing field effects.
      // Guard depth=1: chance/finance/mafia blocked (card chain).
      // racer: volný racer → spustí horse_pending flow; vlastněný → skip.
      const landingField = fieldsRef.current[newPos];
      if (landingField) {
        const lt = landingField.type;
        if (lt === "chance" || lt === "finance" || lt === "mafia") {
          const label = lt === "chance" ? "Osud" : lt === "mafia" ? "Mafie" : "Finance";
          logLines.push(`${player.name}: přistál na poli ${label} — karta se nevylosuje (přesun byl kartou).`);
          console.log(`[turn-flow] card move landed on ${lt} — skipped (chain guard depth=1)`);
        } else if ((lt === "racer" || lt === "horse") && landingField.racer) {
          const alreadyOwned = playerOwnsRacer(updatedPlayer, landingField.racer);
          const ownerPlayer = players.find(p => p.id !== player.id && playerOwnsRacer(p, landingField.racer!));
          if (!alreadyOwned && !ownerPlayer) {
            cardMovedToRacer = landingField.racer as Horse;
            logLines.push(`${player.name}: přišel na ${landingField.racer.emoji} ${landingField.label} — možnost koupě.`);
            console.log(`[turn-flow] card move landed on free racer — horse_pending will be set`);
          } else {
            logLines.push(`${player.name}: přistál u stáje ${landingField.racer.emoji} ${landingField.label} — nabídka se nespustí (přesun byl kartou).`);
            console.log(`[turn-flow] card move landed on owned racer — skipped (chain guard depth=1)`);
          }
        } else {
          // coins_gain, coins_lose, start, gamble, neutral — bezpečné synchronní akce
          const { player: afterField, log: fieldLog } = landingField.action(updatedPlayer);
          updatedPlayer = afterField;
          if (fieldLog) logLines.push(fieldLog);
          console.log(`[turn-flow] card move landed on ${lt} — field action applied, coins=${updatedPlayer.coins}`);
        }
      }
    } else if (card.effect.kind === "skip_turn") {
      // skip_next_turn uložíme do DB — bude přeskočen při příštím tahu
      logLines.push(`${player.name}: ${card.text} (vynechá příští tah)`);
    } else if (card.effect.kind === "give_racer") {
      // Všichni volní raceři — na boardu, nevlastněni žádným hráčem
      const racerFields = fieldsRef.current.filter(f => (f.type === "racer" || f.type === "horse") && f.racer);
      const ownedKeys = new Set(players.flatMap(p => p.horses.map(h => racerOwnershipKey(h))));
      const freeRacers = racerFields.map(f => f.racer!).filter(r => !ownedKeys.has(racerOwnershipKey(r)));

      // Priorita 1: konkrétní racer dle racerId
      //   1a. Hledej na boardových polích (běžný případ)
      //   1b. Hledej přímo v theme rosterech — podporuje legendární racery, kteří
      //       nemají vlastní pole na boardu (off-board raceři, více racer slotů než
      //       theme.racers). Pokud ho hráč ještě nevlastní, je považován za volného.
      // Priorita 2: náhodný volný racer z boardu (fallback pokud named není dostupný)
      // Priorita 3: nic — zaloguj skip
      let chosen: typeof freeRacers[number] | undefined;
      let usedFallback = false;
      if (card.effect.racerId) {
        chosen = freeRacers.find(r => r.id === card.effect.racerId);
        if (!chosen) {
          // Off-board legendary lookup: racer je v theme rosterech, ale ne na boardovém poli
          const themeRacer = getThemeRacers(theme).find(rc => rc.id === card.effect.racerId);
          if (themeRacer && !ownedKeys.has(racerOwnershipKey(themeRacer))) {
            chosen = {
              id:          themeRacer.id,
              name:        themeRacer.name,
              speed:       themeRacer.speed,
              price:       themeRacer.price,
              emoji:       themeRacer.emoji,
              maxStamina:  themeRacer.maxStamina ?? themeRacer.stamina,
              stamina:     themeRacer.maxStamina ?? themeRacer.stamina,
              isLegendary: themeRacer.isLegendary,
            };
            console.log(`[give_racer] off-board legendary found in theme roster: "${themeRacer.name}" (id=${themeRacer.id})`);
          } else {
            chosen = freeRacers[Math.floor(Math.random() * freeRacers.length)];
            usedFallback = true;
            console.log(`[give_racer] named racer "${card.effect.racerId}" not available (owned or missing) → random fallback`);
          }
        }
      } else {
        chosen = freeRacers[Math.floor(Math.random() * freeRacers.length)];
      }

      if (chosen) {
        const newHorse: Horse = { ...chosen, stamina: chosen.maxStamina ?? chosen.stamina ?? 100 };
        updatedPlayer = { ...updatedPlayer, horses: [...updatedPlayer.horses, newHorse] };
        if (usedFallback) {
          logLines.push(`${player.name}: ${card.text} — požadovaný závodník nebyl dostupný, získal ${chosen.emoji} ${chosen.name}!`);
        } else {
          logLines.push(`${player.name}: ${card.text} — získal ${chosen.emoji} ${chosen.name}!`);
        }
      } else {
        logLines.push(`${player.name}: ${card.text} — žádný volný závodník není k dispozici.`);
      }
    } else if (card.effect.kind === "stamina_debuff") {
      const factor = card.effect.factor ?? 0.5;
      const duration = card.effect.duration ?? 2;
      // No stacking: filter out any existing stamina_debuff and replace (refresh duration).
      const existing = (updatedPlayer.active_effects ?? []).filter(e => e.kind !== "stamina_debuff");
      const newEffect: ActiveEffect = { kind: "stamina_debuff", factor, turnsLeft: duration };
      updatedPlayer = { ...updatedPlayer, active_effects: [...existing, newEffect] };
      logLines.push(`${player.name}: ${card.text} (stamina závodníků ×${factor} na ${duration} kola)`);
    }

    // effect2 — Mafia trade-off druhý efekt (coins nebo move)
    if (card.effect2) {
      const e2 = card.effect2;
      if (e2.kind === "coins" && e2.value !== undefined) {
        updatedPlayer = { ...updatedPlayer, coins: updatedPlayer.coins + e2.value };
      } else if (e2.kind === "move" && e2.value !== undefined) {
        const fc = fieldsRef.current.length;
        updatedPlayer = { ...updatedPlayer, position: ((updatedPlayer.position + e2.value) % fc + fc) % fc };
      } else if (e2.kind === "skip_turn") {
        // skip se propíše do playerUpdate níže
      }
    }

    const wouldBankruptCard = updatedPlayer.coins <= 0 && player.coins > 0;
    const finalUpdatedPlayer = wouldBankruptCard ? await confirmBankruptOrSell(updatedPlayer) : updatedPlayer;
    const wentBankrupt = finalUpdatedPlayer.coins <= 0;
    if (wentBankrupt) { logLines.push(`💀 ${player.name} zkrachoval!`); playSfx("bankrupt"); }
    else if (wouldBankruptCard) logLines.push(`${player.name} prodal koně a přežil! 💰`);

    // FIX: position do DB jen pokud ji karta skutečně změnila (kind==="move").
    const anyMove = card.effect.kind === "move" || card.effect2?.kind === "move";
    const anySkip = card.effect.kind === "skip_turn" || card.effect2?.kind === "skip_turn";
    const playerUpdate: Record<string, unknown> = { coins: finalUpdatedPlayer.coins };
    if (anyMove) playerUpdate.position = finalUpdatedPlayer.position;
    if (anyMove && finalUpdatedPlayer.laps !== player.laps) playerUpdate.laps = finalUpdatedPlayer.laps ?? 0;
    if (anySkip) playerUpdate.skip_next_turn = true;
    if (card.effect.kind === "give_racer" || wouldBankruptCard) playerUpdate.horses = finalUpdatedPlayer.horses;
    if (card.effect.kind === "stamina_debuff") playerUpdate.active_effects = finalUpdatedPlayer.active_effects;

    console.log(`[turn-flow] applyCardEffect persisting — pos=${finalUpdatedPlayer.position} coins=${finalUpdatedPlayer.coins} wentBankrupt=${wentBankrupt}`);
    await supabase.from("players").update(playerUpdate).eq("id", player.id);

    // Card → volný racer: spustíme horse_pending purchase flow (buyRacer/skipRacer dokončí tah)
    if (cardMovedToRacer && !wentBankrupt) {
      await supabase.from("game_state").update({
        turn_count: gameState.turn_count + 1,
        horse_pending: true,
        card_pending: null,
        offer_pending: null,
        log: [...logLines, ...newLog].slice(0, 20),
        year_event_telegram: cardYearEventTelegram ?? null,
      }).eq("game_id", gameId);
      setPendingRacer({ racer: cardMovedToRacer, playerIndex });
      setPendingCard(null);
      return;
    }

    // Urči dalšího hráče
    const updatedPlayers = players.map((p, i) => i === playerIndex ? finalUpdatedPlayer : p);
    const nextIndex = getNextActiveIndex(playerIndex, updatedPlayers);

    const activeAfterCard = updatedPlayers.filter(p => !isBankrupt(p));
    const cardGameEnds = (updatedPlayers.length >= 2 && activeAfterCard.length === 1) ||
                         (updatedPlayers.length === 1 && activeAfterCard.length === 0);

    await finishTurn({
      nextIndex, turnCount: gameState.turn_count + 1, log: [...logLines, ...newLog],
      // FIX: give_racer zapsal nové horses do DB těsně před tímto voláním.
      // finishTurn dělá stamina regen write ze closure `players` — která je stale a
      // neobsahuje právě přidaného racera. Bez tohoto parametru by regen write
      // přepsal horses a nový racer by zmizel. Stejná třída bugu jako buyRacer.
      ...(card.effect.kind === "give_racer" || wouldBankruptCard ? { updatedCurrentPlayerHorses: finalUpdatedPlayer.horses } : {}),
      ...(wentBankrupt && !cardGameEnds ? { postTurnEvent: { kind: "announcement" as const, playerId: finalUpdatedPlayer.id, playerName: finalUpdatedPlayer.name } } : {}),
      ...(wentBankrupt ? { bustPlayerId: finalUpdatedPlayer.id } : {}),
      ...(cardYearEventTelegram ? { yearEventTelegram: cardYearEventTelegram } : {}),
    });

    if (wentBankrupt) await checkAndFinishGame(updatedPlayers);
    setPendingCard(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState, players, gameId]);

  // Ref vždy ukazuje na nejnovější verzi applyCardEffect.
  // Timer v useEffect níže zachytí closure — bez ref by volal stale verzi
  // (players state nemusí mít aktualizovanou pozici v době setPendingCard).
  const applyCardEffectRef = React.useRef(applyCardEffect);
  React.useEffect(() => { applyCardEffectRef.current = applyCardEffect; });

  // Automaticky aplikuj efekt karty po 7 s — jen aktivní hráčův klient
  React.useEffect(() => {
    if (!pendingCard) return;
    const isActivePlayerClient =
      gameMode === "local"
        ? true // local: aktuální hráč vždy u zařízení
        : (myPlayerId && players[pendingCard.playerIndex]?.id === myPlayerId);
    if (!isActivePlayerClient) return;

    console.log(`[turn-flow] card pending timer start — card="${pendingCard.card.id}" kind="${pendingCard.card.effect.kind}"`);
    const timer = setTimeout(() => {
      console.log(`[turn-flow] card timer fired — calling applyCardEffect`);
      applyCardEffectRef.current(pendingCard.card, pendingCard.playerIndex);
    }, 7000);

    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingCard?.card.id, pendingCard?.playerIndex]);

  const cancelGame = async () => {
    if (!gameId) return;
    if (!window.confirm("Opravdu chceš zrušit hru? Ostatní hráči ji ztratí.")) return;
    const { error } = await supabase.from("games").update({ status: "cancelled" }).eq("id", gameId);
    if (error) {
      alert(`Nepodařilo se zrušit hru: ${error.message}`);
      return;
    }
    setGameStatus("cancelled");
  };

  // ── Post-turn hook ────────────────────────────────────────────────────────────

  /**
   * finishTurn — centralizuje posun na dalšího hráče po dokončení tahu.
   *
   * Volají všechny handlery, které ukončují tah:
   *   rollDice (normální pole, racer rent, racer own),
   *   buyRacer, skipRacer, declineOffer, applyCardEffect.
   *
   * ┌──────────────────────────────────────────────────────────────────────────┐
   * │  POST-TURN HOOK                                                          │
   * │  Volitelný postTurnEvent (PostTurnEvent) před dalším tahem:              │
   * │    kind="announcement" → zapíše BankruptAnnouncement do offer_pending,  │
   * │      všichni klienti zobrazí overlay, triggerer auto-advance za 3 s.    │
   * │                                                                          │
   * │  Budoucí rozšíření: přidej nový kind do PostTurnEvent a větev sem.      │
   * │    Příklad: kind="race_pending" → spustí závod před dalším tahem.       │
   * └──────────────────────────────────────────────────────────────────────────┘
   */
  const finishTurn = async (params: {
    nextIndex: number;
    turnCount: number;
    log: string[];
    lastRoll?: number;
    postTurnEvent?: PostTurnEvent;
    /** Aktuální stav horses pro regen — nutné pokud volající (buyRacer) v tomto tahu
     *  horses aktualizoval. Closure `players` je stale a bez tohoto parametru by regen
     *  přepsal nově zakoupené racery starší DB hodnotou. */
    updatedCurrentPlayerHorses?: Horse[];
    /** Fog of War: aktualizovaný seznam odhalených polí — přidat do game_state update. */
    revealedFields?: number[];
    /** ID hráče, který v tomto tahu zkrachoval — appendne se do bust_order. */
    bustPlayerId?: string;
    /** Year event telegram payload — uloží se do game_state, přečtou všichni klienti přes Realtime. */
    yearEventTelegram?: { text: string; turn: number };
  }) => {
    if (!gameId) return;

    // POST-TURN HOOK — dispatch podle kind
    if (params.postTurnEvent?.kind === "announcement") {
      const announcement: BankruptAnnouncement = {
        type: "bankrupt_announcement",
        playerName: params.postTurnEvent.playerName,
        playerId: params.postTurnEvent.playerId,
        nextIndex: params.nextIndex,
        turnCount: params.turnCount,
        ...(params.lastRoll !== undefined ? { lastRoll: params.lastRoll } : {}),
      };
      const announcementUpdate: Record<string, unknown> = {
        horse_pending: false,
        card_pending: null,
        offer_pending: announcement as unknown as Record<string, unknown>,
        log: params.log.slice(0, 20),
      };
      if (params.lastRoll !== undefined) announcementUpdate.last_roll = params.lastRoll;
      if (params.revealedFields !== undefined) announcementUpdate.revealed_fields = params.revealedFields;
      if (params.bustPlayerId) announcementUpdate.bust_order = [...(gameState?.bust_order ?? []), params.bustPlayerId];
      announcementUpdate.year_event_telegram = params.yearEventTelegram ?? null;
      await supabase.from("game_state").update(announcementUpdate).eq("game_id", gameId);
      return;
    }

    // POST-TURN HOOK — race_pending: sekvenční výběr závodníků
    if (params.postTurnEvent?.kind === "race_pending") {
      const raceEvtParam = params.postTurnEvent as { kind: "race_pending"; playerIds: string[]; raceType?: RaceType; reward?: number };
      const evt: RacePendingEvent = {
        type: "race_pending",
        raceType: raceEvtParam.raceType ?? "mass_race",
        nextIndex: params.nextIndex,
        turnCount: params.turnCount,
        playerIds: raceEvtParam.playerIds,
        currentSelectorIndex: 0,
        selections: {},
        ...(params.lastRoll !== undefined ? { lastRoll: params.lastRoll } : {}),
        ...(raceEvtParam.reward !== undefined ? { reward: raceEvtParam.reward } : {}),
      };
      const evtUpdate: Record<string, unknown> = {
        horse_pending: false,
        card_pending: null,
        offer_pending: evt as unknown as Record<string, unknown>,
        log: params.log.slice(0, 20),
      };
      if (params.lastRoll !== undefined) evtUpdate.last_roll = params.lastRoll;
      if (params.revealedFields !== undefined) evtUpdate.revealed_fields = params.revealedFields;
      evtUpdate.year_event_telegram = params.yearEventTelegram ?? null;
      await supabase.from("game_state").update(evtUpdate).eq("game_id", gameId);
      return;
    }

    const update: Record<string, unknown> = {
      current_player_index: params.nextIndex,
      turn_count: params.turnCount,
      horse_pending: false,
      card_pending: null,
      offer_pending: null,
      log: params.log.slice(0, 20),
    };
    if (params.lastRoll !== undefined) update.last_roll = params.lastRoll;
    if (params.revealedFields !== undefined) update.revealed_fields = params.revealedFields;
    if (params.bustPlayerId) update.bust_order = [...(gameState?.bust_order ?? []), params.bustPlayerId];
    update.year_event_telegram = params.yearEventTelegram ?? null;

    // Regen staminy pro aktuálního hráče (+10 za tah, strop = maxStamina ?? 100)
    // Použijeme params.updatedCurrentPlayerHorses pokud existuje — closure `players`
    // je stale, pokud volající (buyRacer) v tomto tahu horses aktualizoval.
    const playerForRegen = gameState ? players[gameState.current_player_index] : null;
    const regenSourceHorses = params.updatedCurrentPlayerHorses ?? playerForRegen?.horses ?? [];
    const regenHorses = regenSourceHorses.length > 0
      ? regenSourceHorses.map(h => {
          const cap = h.maxStamina ?? 100;
          return { ...h, stamina: Math.min(cap, (h.stamina ?? cap) + 10) };
        })
      : null;

    // Dekrementuj turnsLeft aktivních efektů; odstraň vypršené.
    const currentEffects = playerForRegen?.active_effects ?? [];
    const updatedEffects = currentEffects
      .map(e => ({ ...e, turnsLeft: e.turnsLeft - 1 }))
      .filter(e => e.turnsLeft > 0);
    const effectsChanged = currentEffects.length !== updatedEffects.length ||
      currentEffects.some((e, i) => e.turnsLeft !== updatedEffects[i]?.turnsLeft);

    const playerRegenUpdate: Record<string, unknown> = {};
    if (regenHorses) playerRegenUpdate.horses = regenHorses;
    if (effectsChanged) playerRegenUpdate.active_effects = updatedEffects;

    await Promise.all([
      supabase.from("game_state").update(update).eq("game_id", gameId),
      ...(Object.keys(playerRegenUpdate).length > 0 && playerForRegen
        ? [supabase.from("players").update(playerRegenUpdate).eq("id", playerForRegen.id)]
        : []),
    ]);
  };

  const closeBankruptAnnouncement = async () => {
    if (!gameId || !gameState) return;
    const ann = gameState.offer_pending?.type === "bankrupt_announcement"
      ? gameState.offer_pending as BankruptAnnouncement
      : null;
    if (!ann) return;
    const update: Record<string, unknown> = {
      current_player_index: ann.nextIndex,
      turn_count: ann.turnCount,
      offer_pending: null,
    };
    if (ann.lastRoll !== undefined) update.last_roll = ann.lastRoll;
    await supabase.from("game_state").update(update).eq("game_id", gameId);
  };

  const closeBankruptAnnouncementRef = React.useRef(closeBankruptAnnouncement);
  React.useEffect(() => { closeBankruptAnnouncementRef.current = closeBankruptAnnouncement; });

  // Auto-zavři bankrot announcement po 3 s — jen triggerer klient
  React.useEffect(() => {
    if (gameState?.offer_pending?.type !== "bankrupt_announcement") return;
    const ann = gameState.offer_pending as BankruptAnnouncement;
    const isTriggerer = gameMode === "local"
      ? viewerRole === "player"
      : myPlayerId === ann.playerId;
    if (!isTriggerer) return;
    const timer = setTimeout(() => {
      closeBankruptAnnouncementRef.current();
    }, 3000);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState?.offer_pending?.type === "bankrupt_announcement"
      ? (gameState.offer_pending as BankruptAnnouncement).playerId
      : null]);

  // ── Race pending placeholder ─────────────────────────────────────────────

  const closeRacePending = async () => {
    if (!gameId || !gameState) return;
    const evt = gameState.offer_pending?.type === "race_pending"
      ? gameState.offer_pending as RacePendingEvent
      : null;
    if (!evt) return;
    const update: Record<string, unknown> = {
      current_player_index: evt.nextIndex,
      turn_count: evt.turnCount,
      offer_pending: null,
    };
    if (evt.lastRoll !== undefined) update.last_roll = evt.lastRoll;
    await supabase.from("game_state").update(update).eq("game_id", gameId);
  };

  // Uzavře výsledky závodu, vyplatí vítězi reward a posune tah dál
  const closeRaceResult = async () => {
    if (!gameId || !gameState) return;
    const evt = gameState.offer_pending?.type === "race_pending"
      ? gameState.offer_pending as RacePendingEvent
      : null;
    if (!evt || evt.phase !== "results") return;

    // Urči vítěze: effective score = tapy * staminaMultiplier, tiebreak: speed
    // Legendární kůň: multiplier=1.0 (záchrana, stamina ho nebrzdí) + vždy se vyřadí po závodě.
    // Ostatní koně: finalStamina/maxStamina.
    const raceEntries = (evt.playerIds ?? []).map(pid => {
      const player = players.find(p => p.id === pid);
      const horseKey = evt.selections?.[pid];
      const horse = player?.horses.find(h => racerOwnershipKey(h) === horseKey);
      const rawScore = evt.scores?.[pid] ?? 0;
      const finalStamina = evt.finalStaminas?.[pid] ?? horse?.stamina ?? 100;
      const maxStamina = horse?.maxStamina ?? 100;
      const debuffFactor = (player?.active_effects ?? [])
        .filter(e => e.kind === "stamina_debuff")
        .reduce((acc, e) => acc * e.factor, 1);
      const staminaMultiplier = horse?.isLegendary ? 1 : (finalStamina / maxStamina) * debuffFactor;
      return { player, horse, horseKey, rawScore, effectiveScore: rawScore * staminaMultiplier, speed: horse?.speed ?? 0, finalStamina, maxStamina };
    });
    const winnerEntry = [...raceEntries].sort((a, b) => b.effectiveScore - a.effectiveScore || b.speed - a.speed)[0];

    const winner = winnerEntry?.player ?? null;
    const reward = evt.reward ?? RACE_WINNER_REWARD;
    const raceLabel = evt.raceType === "rivals_race" ? "Souboj" : "Závod";
    const logLine = winner
      ? `🏁 ${raceLabel}: ${winner.name} vyhrál! +${reward} 💰 (${winnerEntry.horse?.emoji ?? ""} ${winnerEntry.horse?.name ?? ""})`
      : `🏁 ${raceLabel} skončil.`;

    // Aplikuj finalStamina na závodního koně; kůň s 0 staminou nebo legendární se vyřadí z inventáře
    const staminaUpdates = raceEntries
      .filter(e => e.player && e.horse)
      .map(e => {
        const eliminate = e.finalStamina === 0 || e.horse!.isLegendary;
        const updatedHorses = eliminate
          ? e.player!.horses.filter(h => racerOwnershipKey(h) !== e.horseKey)
          : e.player!.horses.map(h =>
              racerOwnershipKey(h) === e.horseKey ? { ...h, stamina: e.finalStamina } : h
            );
        return supabase.from("players").update({ horses: updatedHorses }).eq("id", e.player!.id);
      });

    // Hlášky pro racery vyřazené po závodě (stamina=0 nebo legendární)
    const burnedOutEntries = raceEntries.filter(e => (e.finalStamina === 0 || e.horse?.isLegendary) && e.horse && e.player);
    const burnedOutLines = burnedOutEntries.map(e => {
      const label = `${e.horse!.emoji} ${e.horse!.name} (${e.player!.name})`;
      return e.horse!.isLegendary
        ? `${label}: Zmizel tak rychle, jako se objevil.`
        : `${label}: Zkolaboval po závodě vyčerpáním. Zabaven.`;
    });

    // Flash spotlight — legendární závodník má přednost; fallback na prvního stamina burnout
    const legendaryEntry = burnedOutEntries.find(e => e.horse?.isLegendary);
    if (legendaryEntry) {
      showFlash({ type: "legendary_gone", emoji: legendaryEntry.horse!.emoji, playerName: legendaryEntry.player!.name, racerName: legendaryEntry.horse!.name });
    }

    const stateUpdate: Record<string, unknown> = {
      current_player_index: evt.nextIndex,
      turn_count: evt.turnCount,
      offer_pending: null,
      // mass_race_done jen pro mass_race — rivals_race tuto vlajku nemění
      ...(evt.raceType !== "rivals_race" ? { mass_race_done: true } : {}),
      log: [logLine, ...burnedOutLines, ...(gameState.log ?? [])].slice(0, 20),
    };
    if (evt.lastRoll !== undefined) stateUpdate.last_roll = evt.lastRoll;

    await Promise.all([
      supabase.from("game_state").update(stateUpdate).eq("game_id", gameId),
      ...(winner
        ? [supabase.from("players").update({ coins: winner.coins + reward }).eq("id", winner.id)]
        : []),
      ...staminaUpdates,
    ]);

    // Hvězda pro vítěze — fire-and-forget, guardováno race_stars_awarded v game_state
    if (winner?.discord_id && evt.turnCount !== undefined) {
      awardRaceStarAction(gameId, winner.discord_id, evt.turnCount).catch(() => {});
    }
  };

  // ── Výběr závodníků před závodem ─────────────────────────────────────────

  const submitRaceSelection = async (racerKey: string) => {
    if (!gameId || !gameState) return;
    const evt = gameState.offer_pending?.type === "race_pending"
      ? gameState.offer_pending as RacePendingEvent
      : null;
    if (!evt?.playerIds?.length) return;
    const key = `${evt.turnCount}_${evt.playerIds[evt.currentSelectorIndex]}_${evt.currentSelectorIndex}`;
    if (selectionSubmittedRef.current === key) {
      console.warn(`[race-select] dedup blocked — key=${key}, previous race may have had same player at same index`);
      return;
    }
    selectionSubmittedRef.current = key;

    const currentSelectorId = evt.playerIds[evt.currentSelectorIndex];
    const newSelections = { ...evt.selections, [currentSelectorId]: racerKey };
    const isLast = evt.currentSelectorIndex >= evt.playerIds.length - 1;

    if (isLast) {
      // Všechny výběry hotové — přejdi na countdown fázi závodu
      const updatedEvt: RacePendingEvent = { ...evt, selections: newSelections, phase: "countdown" };
      await supabase.from("game_state").update({
        offer_pending: updatedEvt as unknown as Record<string, unknown>,
      }).eq("game_id", gameId);
    } else {
      const updatedEvt: RacePendingEvent = {
        ...evt,
        selections: newSelections,
        currentSelectorIndex: evt.currentSelectorIndex + 1,
      };
      await supabase.from("game_state").update({
        offer_pending: updatedEvt as unknown as Record<string, unknown>,
      }).eq("game_id", gameId);
    }
  };

  // Zapíše skóre aktuálního závodníka a posune na dalšího (nebo results).
  // Přijímá MinigameResult od RacingMinigame nebo watchdog fallback { score: 0 }.
  // Pokud finalStamina chybí (watchdog), zachová aktuální staminu koně.
  // watchdogForIndex: index hráče pro který byl watchdog nastaven — ochrana proti
  // situaci kdy watchdog vystřelí po přechodu na dalšího závodníka a přepíše jeho skóre.
  const submitPendingRaceScore = async ({ score, finalStamina, watchdogForIndex }: { score: number; finalStamina?: number; watchdogForIndex?: number }) => {
    if (!gameId || !gameState) return;
    const evt = gameState.offer_pending?.type === "race_pending"
      ? gameState.offer_pending as RacePendingEvent
      : null;
    if (!evt || evt.phase !== "racing") return;
    const idx = evt.currentRacerIndex ?? 0;
    // Watchdog guard: zamítni pokud watchdog patří jinému hráči než aktuálnímu
    if (watchdogForIndex !== undefined && idx !== watchdogForIndex) return;
    const currentRacerId = evt.playerIds[idx];
    const key = `${evt.turnCount}_${currentRacerId}_${idx}`;
    if (pendingRaceScoreRef.current === key) {
      console.warn(`[race-score] dedup blocked — key=${key}, previous race may have had same player at same index`);
      return;
    }
    if (evt.scores?.[currentRacerId] !== undefined) return; // score už přišlo, nepřepisuj
    pendingRaceScoreRef.current = key;

    // Pokud watchdog nezná finalStamina, zachovej aktuální staminu koně
    const player = players.find(p => p.id === currentRacerId);
    const horseKey = evt.selections?.[currentRacerId];
    const horse = player?.horses.find(h => racerOwnershipKey(h) === horseKey);
    const actualFinalStamina = finalStamina ?? (horse?.stamina ?? 100);

    const newScores = { ...(evt.scores ?? {}), [currentRacerId]: score };
    const newFinalStaminas = { ...(evt.finalStaminas ?? {}), [currentRacerId]: actualFinalStamina };
    const isLast = idx >= evt.playerIds.length - 1;

    const updatedEvt: RacePendingEvent = isLast
      ? { ...evt, scores: newScores, finalStaminas: newFinalStaminas, phase: "results" }
      : { ...evt, scores: newScores, finalStaminas: newFinalStaminas, currentRacerIndex: idx + 1 };
    await supabase.from("game_state").update({
      offer_pending: updatedEvt as unknown as Record<string, unknown>,
    }).eq("game_id", gameId);
  };

  // Ref pro watchdog — vždy ukazuje na nejnovější verzi funkce (čerstvý gameState)
  const submitPendingRaceScoreRef = React.useRef(submitPendingRaceScore);
  React.useEffect(() => { submitPendingRaceScoreRef.current = submitPendingRaceScore; });

  // ── Závod (race miniGame) ──────────────────────────────────────────────────

  const startRace = async () => {
    if (!gameId || !gameState) return;
    if (pendingRacer || pendingCard || pendingOffer) return;
    if (gameState.offer_pending?.type === "race") return; // already running
    const activePlayers = players.filter(p => !isBankrupt(p));
    if (activePlayers.length < 2) return;
    const race: RaceOffer = {
      type: "race",
      phase: "racing",
      currentRacerIndex: 0,
      playerIds: activePlayers.map(p => p.id),
      scores: {},
    };
    await supabase.from("game_state").update({
      offer_pending: race as unknown as Record<string, unknown>,
    }).eq("game_id", gameId);
  };

  const submitRaceScore = async (score: number) => {
    if (!gameId || !gameState) return;
    const race = gameState.offer_pending?.type === "race" ? gameState.offer_pending as RaceOffer : null;
    if (!race || race.phase !== "racing") return;
    const key = `${race.playerIds[race.currentRacerIndex]}_${race.currentRacerIndex}`;
    if (raceSubmittedRef.current === key) return;
    raceSubmittedRef.current = key;

    const currentRacerId = race.playerIds[race.currentRacerIndex];
    const newScores = { ...race.scores, [currentRacerId]: score };
    const isLast = race.currentRacerIndex >= race.playerIds.length - 1;
    const updatedRace: RaceOffer = {
      ...race,
      scores: newScores,
      currentRacerIndex: isLast ? race.currentRacerIndex : race.currentRacerIndex + 1,
      phase: isLast ? "results" : "racing",
    };
    await supabase.from("game_state").update({
      offer_pending: updatedRace as unknown as Record<string, unknown>,
    }).eq("game_id", gameId);
  };

  const closeRace = async () => {
    if (!gameId || !gameState) return;
    const race = gameState.offer_pending?.type === "race" ? gameState.offer_pending as RaceOffer : null;
    if (!race || race.phase !== "results") return;
    const winner = race.playerIds
      .map(id => ({ id, score: race.scores[id] ?? 0 }))
      .sort((a, b) => b.score - a.score)[0];
    const winnerPlayer = winner ? players.find(p => p.id === winner.id) : null;
    const scoreLog = race.playerIds
      .map(id => { const p = players.find(pl => pl.id === id); return `${p?.name ?? id}: ${race.scores[id] ?? 0}`; })
      .join(", ");
    const logLine = winnerPlayer
      ? `🏁 Závod: ${winnerPlayer.name} vyhrál! (${scoreLog})`
      : `🏁 Závod skončil (${scoreLog})`;
    const newLog = gameState.log ?? [];
    await supabase.from("game_state").update({
      offer_pending: null,
      log: [logLine, ...newLog].slice(0, 20),
    }).eq("game_id", gameId);
    raceSubmittedRef.current = null;
  };

  // Zkontroluj podmínky konce hry a nastav status na "finished".
  // Dvě pravidla:
  //   Multiplayer výhra: >=2 hráčů celkem, přesně 1 aktivní zbývá.
  //   Solo prohra:        1 hráč celkem,  0 aktivních (zbankrotoval).
  const checkAndFinishGame = async (updatedPlayers: Player[]) => {
    if (!gameId) return;
    const activePlayers = updatedPlayers.filter(p => !isBankrupt(p));
    const multiplayerWin = updatedPlayers.length >= 2 && activePlayers.length === 1;
    const soloLoss = updatedPlayers.length === 1 && activePlayers.length === 0;
    if (multiplayerWin || soloLoss) {
      await supabase.from("games").update({ status: "finished" }).eq("id", gameId);
      const winner = multiplayerWin ? (activePlayers[0]?.name ?? "") : "nobody";
      if (gameCode) logEvent({ name: "game_finish", game_code: gameCode, winner });
      // Okamžitý lokální update — stejný vzor jako cancelGame.
      // Realtime propaguje ostatním klientům, ale tento klient nečeká.
      setGameStatus("finished");
      // XP — fire and forget; duplikaci hlídá games.xp_awarded guard
      awardXpAction(gameId).catch(() => {});
    }
  };

  // ── Dev: flip layer helpers ───────────────────────────────────────────────────
  React.useEffect(() => () => { if (flipTimerRef.current) clearTimeout(flipTimerRef.current); }, []);

  const openDevFlip = React.useCallback(() => {
    setFlipBoardAnim("out");
    flipTimerRef.current = setTimeout(() => {
      setDevFlipOpen(true);
      setFlipBoardAnim("idle");
    }, 300);
  }, []);

  const closeDevFlip = React.useCallback(() => {
    setDevFlipOpen(false);
    setFlipBoardAnim("back-in");
    flipTimerRef.current = setTimeout(() => setFlipBoardAnim("idle"), 300);
  }, []);

  // ── Helpers ──────────────────────────────────────────────────────────────────

  // Po načtení / refresh: obnov pendingRacer a pendingCard ze stavu DB
  React.useEffect(() => {
    if (!gameState || players.length === 0) return;
    if (gameState.horse_pending) {
      const currentP = players[gameState.current_player_index];
      const field = currentP ? fieldsRef.current[currentP.position] : null;
      if (field?.type === "racer" && field.racer) {
        setPendingRacer({ racer: field.racer, playerIndex: gameState.current_player_index });
      }
    } else {
      setPendingRacer(null);
    }
    if (gameState.card_pending) {
      setPendingCard({ card: gameState.card_pending, playerIndex: gameState.current_player_index });
    } else {
      setPendingCard(null);
    }
    if (gameState.offer_pending?.type === "reroll") {
      const offer = gameState.offer_pending as RerollOffer;
      // Guard: pokud byla tato nabídka již přijata v tomto sessionu, neobnovuj ji.
      // Bez toho by Players Realtime (fired před game_state.update) obnovil modal.
      const offerKey = offer.playerId + "_" + gameState.turn_count;
      if (offerAcceptedRef.current === offerKey) return;
      if (flashActiveRef.current) {
        deferredOfferRef.current = offer;
      } else {
        setPendingOffer(offer);
      }
    } else {
      deferredOfferRef.current = null;
      setPendingOffer(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState?.horse_pending, gameState?.card_pending, gameState?.offer_pending, gameState?.current_player_index]);

  // Auto-skip: pokud má aktuální hráč skip_next_turn = true, přeskočíme jeho tah
  React.useEffect(() => {
    if (!gameState || players.length === 0 || !gameId) return;
    const currentP = players[gameState.current_player_index];
    if (!currentP?.skip_next_turn) return;
    if (gameState.horse_pending || gameState.card_pending) return; // počkej až se vyřeší

    // Jen trigger klient: local = kdokoliv, online = hráč s myPlayerId
    const isActiveClient = gameMode === "local"
      ? viewerRole === "player"
      : myPlayerId === currentP.id;
    if (!isActiveClient) return;

    const doSkip = async () => {
      const newLog = gameState.log ?? [];
      const nextIndex = getNextActiveIndex(gameState.current_player_index, players);
      await supabase.from("players").update({ skip_next_turn: false }).eq("id", currentP.id);
      await supabase.from("game_state").update({
        current_player_index: nextIndex,
        turn_count: gameState.turn_count + 1,
        log: [`${currentP.name} přeskakuje tah (penalizace z karty)`, ...newLog].slice(0, 20),
      }).eq("game_id", gameId);
    };
    doSkip();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState?.current_player_index, players.map(p => p.skip_next_turn).join(",")]);

  // Intro overlay — zobrazí se jednou po dokončení načítání
  React.useEffect(() => {
    if (loading || introShownRef.current) return;
    introShownRef.current = true;
    setIntroVisible(true);
  }, [loading]);

  // Herní rok — startovní rok theme + počet průchodů STARTem lídra (player.laps)
  const leadLaps = players.reduce((max, p) => Math.max(max, p.laps ?? 0), 0);
  const gameYear = (theme.mapMeta?.yearStart ?? 1921) + leadLaps;
  const currentYearEvent = resolveYearEvent(leadLaps, gameYear, theme.yearEvents);

  // Pro render desky: animující hráč se zobrazuje na animPosition, ne na DB pozici
  const displayPlayers = players.map((p, i) =>
    i === animatingPlayerIdx && animPosition !== null ? { ...p, position: animPosition } : p
  );
  const animatingPlayerId = animatingPlayerIdx !== null ? players[animatingPlayerIdx]?.id : null;

  // Bankrotáři nejsou vidět na desce
  const fieldPlayers = (fieldIndex: number) =>
    displayPlayers.filter((p) => p.position === fieldIndex && !isBankrupt(p) && p.id !== animatingPlayerId);
  const currentPlayer = gameState ? players[gameState.current_player_index] : null;
  // Bankrotář nemůže hrát ani když je na řadě — blokujeme deadlock
  // Pozorovatel nikdy nemůže hrát
  const isLocalGame = gameMode === "local";
  // Závod — odvozeno z DB stavu
  const pendingRace = (gameState?.offer_pending?.type === "race") ? gameState.offer_pending as RaceOffer : null;
  // Bankrot announcement — odvozeno z DB stavu
  const bankruptAnn = (gameState?.offer_pending?.type === "bankrupt_announcement") ? gameState.offer_pending as BankruptAnnouncement : null;
  // Race pending (výběr závodníků) — odvozeno z DB stavu
  const racePendingEvt = (gameState?.offer_pending?.type === "race_pending") ? gameState.offer_pending as RacePendingEvent : null;
  const raceSelectorPlayer = racePendingEvt?.playerIds?.length
    ? players.find(p => p.id === racePendingEvt.playerIds[racePendingEvt.currentSelectorIndex]) ?? null
    : null;
  const isMySelectionTurn = !!(racePendingEvt?.playerIds?.length && (
    isLocalGame ? true : raceSelectorPlayer?.id === myPlayerId
  ));
  // Kdo aktuálně závodí (racing fáze)
  const raceCurrentPlayer = racePendingEvt?.phase === "racing" && racePendingEvt.playerIds?.length
    ? players.find(p => p.id === racePendingEvt.playerIds[racePendingEvt.currentRacerIndex ?? 0]) ?? null
    : null;
  const isMyRacingTurn = !!(racePendingEvt?.phase === "racing" && (
    isLocalGame ? true : raceCurrentPlayer?.id === myPlayerId
  ));
  // Výsledky závodu: effective score = raw tapy × staminaMultiplier, tiebreak speed
  // Legendární kůň: multiplier=1.0. Ostatní: finalStamina/maxStamina.
  // Řazení odpovídá winner logice v closeRaceResult
  const raceResults = racePendingEvt?.phase === "results"
    ? (racePendingEvt.playerIds ?? []).map(pid => {
        const player = players.find(p => p.id === pid);
        const horseKey = racePendingEvt.selections?.[pid];
        const horse = player?.horses.find(h => racerOwnershipKey(h) === horseKey);
        const score = racePendingEvt.scores?.[pid] ?? 0;
        const finalStamina = racePendingEvt.finalStaminas?.[pid] ?? horse?.stamina ?? 100;
        const maxStamina = horse?.maxStamina ?? 100;
        const debuffFactor = (player?.active_effects ?? [])
          .filter(e => e.kind === "stamina_debuff")
          .reduce((acc, e) => acc * e.factor, 1);
        const staminaMultiplier = horse?.isLegendary ? 1 : (finalStamina / maxStamina) * debuffFactor;
        const effectiveScore = score * staminaMultiplier;
        return { player, horse, speed: horse?.speed ?? 0, score, effectiveScore, finalStamina };
      }).sort((a, b) => b.effectiveScore - a.effectiveScore || b.speed - a.speed)
    : null;
  const isMyRaceTurn = !!(pendingRace?.phase === "racing" && (
    isLocalGame ? true : myPlayerId === pendingRace?.playerIds[pendingRace?.currentRacerIndex ?? -1]
  ));
  const isSpectator = viewerRole === "spectator";
  const hasPendingRollDecision = !!pendingRollDecision;
  const isMyPendingRollDecisionTurn = !!(pendingRollDecision && (
    isLocalGame ? viewerRole === "player" : myPlayerId === pendingRollDecision.playerId
  ));
  const suppressGuideThisTurn = guideDismissedTurn !== null && guideDismissedTurn === (gameState?.turn_count ?? null);
  // Local: kdokoliv "player" může hodit za aktuálního hráče (hot-seat)
  // Online: jen hráč jehož ID sedí s localStorage
  const isMyTurn = isLocalGame
    ? (viewerRole === "player" && !!currentPlayer && !isBankrupt(currentPlayer) && !isRolling && !isMoving && !hasPendingRollDecision)
    : (!!myPlayerId && currentPlayer?.id === myPlayerId && !isBankrupt(currentPlayer) && !isRolling && !isMoving && !isSpectator && !hasPendingRollDecision);
  const currentRound = gameState ? Math.floor(gameState.turn_count / Math.max(1, players.length)) + 1 : 1;
  const myPlayer = players.find((player) => player.id === myPlayerId) ?? null;
  // Online: bankrotovaný hráč se stává pasivním pozorovatelem — vidí hru, ale nemůže jednat.
  // Local: všichni hráči sdílejí zařízení, pojem "můj hráč" neexistuje.
  const iAmBankrupt = !isLocalGame && !!myPlayer && isBankrupt(myPlayer);
  const shouldShowRacerGuide =
    viewerRole === "player" &&
    !suppressGuideThisTurn &&
    !racerGuideDismissed &&
    !!myPlayer &&
    !isBankrupt(myPlayer) &&
    myPlayer.horses.length === 0 &&
    gameStatus === "playing";
  const shouldShowStaminaGuide =
    viewerRole === "player" &&
    !suppressGuideThisTurn &&
    !staminaGuideDismissed &&
    !!myPlayer &&
    !isBankrupt(myPlayer) &&
    myPlayer.horses.length > 0 &&
    gameStatus === "playing";
  const hasPreferredRacer = !!myPlayer?.horses.some((horse) => horse.isPreferred);
  const shouldShowPreferredGuide =
    viewerRole === "player" &&
    !suppressGuideThisTurn &&
    !preferredGuideDismissed &&
    !!myPlayer &&
    !isBankrupt(myPlayer) &&
    myPlayer.horses.length > 0 &&
    !hasPreferredRacer &&
    gameStatus === "playing";
  const rollDecisionOptions = pendingRollDecision
    ? ([-1, 0, 1] as RollAdjustment[]).map((adjustment) => {
        const finalRoll = pendingRollDecision.baseRoll + adjustment;
        const isAffordable = adjustment === 0 || (currentPlayer?.coins ?? 0) >= 600;
        const isValid = finalRoll >= 1;
        const targetField = isValid ? FIELDS[(pendingRollDecision.basePosition + finalRoll) % FIELDS.length] : null;
        return {
          adjustment,
          finalRoll,
          cost: adjustment === 0 ? 0 : 600,
          isDisabled: !isValid || !isAffordable,
          targetField,
        };
      })
    : [];

  // Mapa (racer.id ?? racer.name) → vlastník — id-first, name fallback pro stará data
  const racerOwnership: Record<string, Player> = {};
  players.forEach(p => p.horses.forEach(h => { racerOwnership[racerOwnershipKey(h)] = p; }));

  // Auto-posuň countdown → racing (po 3,5 s) a inicializuj racing stav.
  // Jen triggerer (host / local). Racing → results řídí submitPendingRaceScore.
  React.useEffect(() => {
    if (racePendingEvt?.phase !== "countdown") return;
    if (!isHost && !isLocalGame) return;
    const timer = setTimeout(async () => {
      if (!gameId || !gameState) return;
      const current = gameState.offer_pending?.type === "race_pending"
        ? gameState.offer_pending as RacePendingEvent
        : null;
      if (!current || current.phase !== "countdown") return;
      await supabase.from("game_state").update({
        offer_pending: { ...current, phase: "racing", currentRacerIndex: 0, scores: {} } as unknown as Record<string, unknown>,
      }).eq("game_id", gameId);
    }, 3500);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [racePendingEvt?.phase]);

  // Lokální countdown číslo (kosmetika — každý klient animuje sám)
  React.useEffect(() => {
    if (racePendingEvt?.phase !== "countdown") { setCountdownNum(null); return; }
    setCountdownNum(3);
    const t1 = setTimeout(() => setCountdownNum(2), 1000);
    const t2 = setTimeout(() => setCountdownNum(1), 2000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [racePendingEvt?.phase]);

  // Watchdog: pokud závodník neodešle score do limitu, host zapíše 0 a pokračuje dál.
  // Jen host/local. Resetuje se pro každého závodníka (dependency na currentRacerIndex).
  React.useEffect(() => {
    if (racePendingEvt?.phase !== "racing") return;
    if (!isHost && !isLocalGame) return;
    // Online: 10 s minihra + 2 s buffer = 12 s
    // Hot-seat: 5 s handoff + 10 s minihra + 2 s buffer = 17 s
    const watchdogMs = isLocalGame ? 17000 : 12000;
    // Zachyť index závodníka teď — submitPendingRaceScoreRef může být aktualizován
    // na novějšího hráče dříve než watchdog vystřelí, proto předáváme watchdogForIndex.
    const watchdogForIndex = racePendingEvt.currentRacerIndex ?? 0;
    const timer = setTimeout(() => {
      submitPendingRaceScoreRef.current({ score: 0, watchdogForIndex });
    }, watchdogMs);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [racePendingEvt?.phase === "racing"
      ? `racing_${racePendingEvt.currentRacerIndex ?? 0}`
      : null]);

  // Auto-confirm preferred racera — pokud má aktuální selektor validního preferred koně,
  // potvrdí ho automaticky bez zobrazení selection overlay.
  // Fallback ruční selection nastane pouze tehdy, když preferred neexistuje / hráč ho nevlastní.
  // Nízká nebo nulová stamina auto-confirm NEBLOKUJE (hráč nese důsledek své volby).
  React.useEffect(() => {
    if (!racePendingEvt || (racePendingEvt.phase && racePendingEvt.phase !== "selecting")) return;
    if (!isMySelectionTurn || !raceSelectorPlayer) return;
    const preferred = raceSelectorPlayer.horses.find(h => h.isPreferred);
    if (!preferred) return;
    submitRaceSelection(racerOwnershipKey(preferred));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [racePendingEvt?.currentSelectorIndex, isMySelectionTurn]);

  // Sestavení CenterEvent view modelu pro sjednocený modal
  const centerEvent = mapToCenterEvent(
    pendingCard,
    pendingOffer,
    players,
    gameMode,
    viewerRole,
    myPlayerId
  );

  // ── Render ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900">
        <IntroOverlay
          year={theme.mapMeta?.yearStart ?? 1921}
          place={theme.mapMeta?.place ?? ""}
          subtitle={theme.mapMeta?.subtitle ?? ""}
          isLoading={true}
          onDone={() => {}}
        />
      </div>
    );
  }

  if (gameCode && !gameId) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl font-bold text-slate-800">Hra nenalezena</div>
          <a href="/" className="mt-4 block text-sm text-slate-500 underline">Zpět na úvod</a>
        </div>
      </div>
    );
  }

  if (gameStatus === "cancelled") {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
        <div className="text-center space-y-4">
          <div className="text-5xl">🚫</div>
          <h2 className="text-2xl font-bold text-slate-800">Hra byla zrušena</h2>
          <p className="text-slate-500">Hostitel ukončil tuto hru.</p>
          <a href="/" className="block text-sm text-slate-400 underline hover:text-slate-600">← Zpět na úvod</a>
        </div>
      </div>
    );
  }

  if (gameStatus === "finished") {
    const winner = players.find(p => !isBankrupt(p));
    const losers = players.filter(p => isBankrupt(p));
    const isSoloLoss = players.length === 1 && !winner;
    const bustOrder = gameState?.bust_order ?? [];
    const matchTitles = players.length >= 2 ? computeMatchTitles(players, bustOrder) : undefined;
    const BUST_LINES = [
      "Mafii se dluhy musí splácet. Bohužel jsi neměl už z čeho.",
      "Sázky nevyšly. Zůstaly jen dluhy a prázdná stáj.",
      "Věřitelé byli rychlejší než tvůj další tah.",
      "Když dojdou peníze, dojdou i přátelé.",
      "Tvůj závod skončil dřív, než ses dostal do cíle.",
    ];
    // Stabilní přiřazení hlášky: index v bustOrder % počet hlášek.
    const bustLine = (playerId: string) => {
      const idx = bustOrder.indexOf(playerId);
      return BUST_LINES[(idx >= 0 ? idx : 0) % BUST_LINES.length];
    };
    // Zkrachovalí seřazeni dle bustOrder (pozdější = výše, jako v ScoreTable)
    const sortedLosers = [...losers].sort((a, b) => {
      const ia = bustOrder.indexOf(a.id);
      const ib = bustOrder.indexOf(b.id);
      return ib - ia;
    });
    return (
      <div className={`min-h-screen ${theme.colors.pageBackground} flex items-center justify-center p-6`}>
        <div
          className="relative w-full max-w-md border-2 border-stone-500 shadow-2xl overflow-hidden"
          style={{ backgroundImage: "url('/gazete.webp')", backgroundSize: "cover", backgroundPosition: "top center" }}
        >
          {/* Aged-paper overlay pro čitelnost */}
          <div className="absolute inset-0 bg-[#f4efe4]/82 z-0" />

          {/* Veškerý obsah nad overlayem */}
          <div className="relative z-10">

            {/* ── Novinový masthead — text skrytý (titulek je v bg obrázku), výška zachována ── */}
            <div className="px-6 pt-5 pb-4 border-b-[3px] border-stone-500 text-center">
              <div className="invisible text-[8px] font-bold uppercase tracking-[0.32em] text-stone-500">— Mimořádné vydání —</div>
              <div className="invisible mt-1 font-serif text-[26px] font-black uppercase tracking-[0.12em] text-stone-900 leading-none">Pay to Win Gazette</div>
              <div className="invisible mt-1 text-[8px] uppercase tracking-[0.22em] text-stone-500">Nezávislé noviny ze světa dostihů · Archiv výsledků</div>
            </div>

            {isSoloLoss ? (
              /* ── Solo prohra ── */
              <div className="px-6 py-8 text-center border-b border-stone-500">
                <div className="text-5xl">💀</div>
                <div className="mt-3 text-[9px] font-bold uppercase tracking-[0.22em] text-stone-500">Tréninková zpráva</div>
                <h2 className="mt-1 font-serif text-2xl font-black text-stone-900">Zkrachoval jsi</h2>
                <p className="mt-1 text-xs italic text-stone-500">Tréninková hra skončila porážkou.</p>
              </div>
            ) : (
              /* ── Multiplayer výhra ── */
              <>
                <div className="px-6 py-5 border-b border-stone-500">
                  <div className="text-[9px] font-bold uppercase tracking-[0.22em] text-stone-500">Vítěz sezóny</div>
                  <h2 className="mt-1 font-serif text-[28px] font-black leading-tight text-stone-900">
                    {winner?.name ?? "—"}
                  </h2>
                  <p className="mt-1.5 text-xs italic text-stone-500">
                    Poslední závodník, který opustil závod bez dluhů.
                  </p>
                </div>
                <div className="px-6 py-4 border-b border-stone-500">
                  <div className="mb-2 text-[9px] font-bold uppercase tracking-[0.22em] text-stone-500">Konečné pořadí</div>
                  <ScoreTable players={players} bustOrder={gameState?.bust_order ?? []} titles={matchTitles} />
                </div>
                {sortedLosers.length > 0 && (
                  <div className="px-6 py-4 border-b border-stone-500">
                    <div className="mb-2 text-[9px] font-bold uppercase tracking-[0.22em] text-stone-500">Padlí závodníci</div>
                    <div className="space-y-1.5">
                      {sortedLosers.map(p => (
                        <div key={p.id} className="text-xs leading-snug">
                          <span className="font-bold text-stone-800">💀 {p.name} —</span>
                          <span className="italic text-stone-700"> {bustLine(p.id)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="px-6 py-4">
              <a href="/" className="block bg-stone-900 px-4 py-3 text-center text-sm font-semibold text-[#f4efe4] hover:bg-stone-700 transition">
                ← Nová hra
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (viewerRole === "login_required") {
    // Lokální hra — nemá smysl žádat o Discord login na jiném zařízení
    if (isLocalGame) {
      return (
        <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
          <div className="w-full max-w-sm text-center space-y-4">
            <div className="text-4xl">🖥️</div>
            <h2 className="text-xl font-bold text-slate-800">Lokální hra</h2>
            <p className="text-sm text-slate-500">
              Tato hra je lokální (hot-seat) a lze ji hrát pouze na zařízení, kde byla vytvořena.
            </p>
            <a href="/" className="block text-sm text-slate-400 underline hover:text-slate-600">← Zpět na úvod</a>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
        <div className="w-full max-w-sm text-center space-y-4">
          <div className="text-4xl">👀</div>
          <h2 className="text-xl font-bold text-slate-800">Sleduj hru jako pozorovatel</h2>
          <p className="text-sm text-slate-500">
            Pro sledování hry se přihlas přes Discord.
          </p>
          <button
            onClick={() => supabase.auth.signInWithOAuth({
              provider: "discord",
              options: { redirectTo: `${window.location.origin}/auth/callback?next=/game/${gameCode}` },
            })}
            className="w-full rounded-2xl bg-indigo-600 px-4 py-4 text-lg font-semibold text-white hover:bg-indigo-700"
          >
            🎮 Přihlásit přes Discord
          </button>
          <a href="/" className="block text-xs text-slate-400 underline hover:text-slate-600">Zpět na úvod</a>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${theme.colors.arenaGradient ? "" : theme.colors.pageBackground}`}>
      {/* Background pinned to viewport — nezávislý na výšce content containeru */}
      {theme.colors.arenaGradient && !theme.colors.arenaGradientAlt && (
        <div className="fixed inset-0 -z-10" style={{ background: theme.colors.arenaGradient }} />
      )}
      {theme.colors.arenaGradient && theme.colors.arenaGradientAlt && (
        <AmbientBackground primary={theme.colors.arenaGradient} alt={theme.colors.arenaGradientAlt} />
      )}

      {/* ── Center Event Modal (card + offer) ───────────────────────────── */}
      {centerEvent && (
        <CenterEventModal
          event={centerEvent}
          onConfirm={acceptOffer}
          onDecline={declineOffer}
          onApplyCard={pendingCard ? () => applyCardEffectRef.current(pendingCard.card, pendingCard.playerIndex) : undefined}
        />
      )}

      {/* ── Flash Toast (auto-dismiss spotlight pro výrazné momenty) ─────── */}
      {flashEvent && <FlashToast event={flashEvent} />}

      {/* ── Telegram Strip (roční eventy / test mode) ────────────────────── */}
      <TelegramStrip message={telegramMessage} />

      {/* ── Race Modal ───────────────────────────────────────────────────── */}
      {pendingRace && (
        <RaceModal
          race={pendingRace}
          players={players}
          isMyRaceTurn={isMyRaceTurn}
          onSubmitScore={submitRaceScore}
          onClose={closeRace}
          isHost={isHost}
        />
      )}

      {/* ── Bankrot announcement ─────────────────────────────────────────── */}
      {bankruptAnn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-[4px] bg-white p-8 shadow-2xl text-center space-y-4">
            <div className="text-6xl">💀</div>
            <h2 className="text-2xl font-bold text-slate-800">{bankruptAnn.playerName} zkrachoval!</h2>
            <p className="text-sm text-slate-500">Hra pokračuje bez tohoto hráče.</p>
            <div className="animate-pulse text-xs text-slate-400">Pokračujeme za chvíli…</div>
          </div>
        </div>
      )}

      {/* ── Race flow: výběr → countdown → závod → výsledky ────────────────── */}
      {racePendingEvt && racePendingEvt.playerIds?.length > 0 && (
        <RaceEventOverlay
          event={racePendingEvt}
          players={players}
          countdownNum={countdownNum}
          selectorPlayer={raceSelectorPlayer}
          isMySelectionTurn={isMySelectionTurn}
          racingPlayer={raceCurrentPlayer}
          isMyRacingTurn={isMyRacingTurn}
          raceResults={raceResults}
          reward={racePendingEvt.reward ?? RACE_WINNER_REWARD}
          isHost={isHost}
          isLocalGame={isLocalGame}
          racingEmoji={theme.labels.racingEmoji}
          onSelectRacer={submitRaceSelection}
          onSkip={closeRacePending}
          onSubmitScore={submitPendingRaceScore}
          onCloseResult={closeRaceResult}
        />
      )}

      <div className="bg-amber-100 border-b border-amber-300 px-4 py-2 text-center text-sm text-amber-800">
        Experimentální projekt · kontakt:{" "}
        <a href="mailto:info@paytowin.cz" className="underline hover:text-amber-900">info@paytowin.cz</a>
        {gameCode && (
          <span className="ml-4 font-mono font-bold tracking-widest">
            🎮 hra: {gameCode}
          </span>
        )}
      </div>
      {isSpectator && (
        <div className="border-b border-indigo-200 bg-indigo-50 px-4 py-2.5 text-center text-sm text-indigo-700">
          👀 Sleduješ tuto hru jako <strong>pozorovatel</strong> — hráčské akce nejsou dostupné.
          {gameCode && (
            <> Chceš hrát?{" "}
              <a href={`/?join=${gameCode}`} className="font-semibold underline hover:text-indigo-900">
                Připoj se kódem {gameCode} →
              </a>
            </>
          )}
        </div>
      )}
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">

          {/* Herní plocha */}
          <div className="flex flex-col gap-3 lg:pl-36">
            {/* HUD + legenda — vlastní panel s pozadím */}
            <div className={`rounded-[4px] px-4 py-3 shadow-md ring-1 ring-black/[0.06] ${theme.colors.cardBackground}`}>
            {/* HUD — 3 zóny: brand | stav hry | akce */}
            <div className="mb-3 flex items-center gap-2">
              {/* Levá zóna: brand + mode badges */}
              <div className="flex items-center gap-2 shrink-0">
                <BrandLogo
                  variant="nav"
                  className={`transition-opacity hover:opacity-75 ${theme.colors.textPrimary}`}
                  onClick={() => window.open("/", "_blank")}
                />
                {isLocalGame && (
                  <div className="rounded-[3px] bg-orange-100 px-2 py-1 text-[11px] font-semibold text-orange-700">
                    {UI_TEXT.board.localModeBadge}
                  </div>
                )}
                {isSpectator && (
                  <div className="rounded-[3px] bg-indigo-100 px-2.5 py-1 text-xs font-semibold text-indigo-700">
                    {UI_TEXT.board.spectatorBadge}
                  </div>
                )}
              </div>

              {/* Střední zóna: stav hry — roztáhne se */}
              <div className="flex flex-1 items-center justify-center gap-2 min-w-0">
                {/* Score popup */}
                <div className="relative shrink-0">
                  <button
                    onClick={() => { setScorePopupOpen((prev) => !prev); }}
                    className="rounded-[3px] bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-500 hover:bg-slate-200 transition select-none"
                    title="Zobrazit score"
                  >
                    {UI_TEXT.board.roundLabel} <span className="font-bold text-slate-700">{currentRound}</span>
                    {(currentPlayer?.laps ?? 0) >= 1 && (
                      <span className="ml-1 text-red-500" title={`Výpalné (daně) za průchod STARTem: -${getStartTax(currentPlayer?.laps ?? 0, economy)} 💰`}>🏛️</span>
                    )}
                    <span className="ml-1 opacity-50">📊</span>
                  </button>
                  {scorePopupOpen && (
                    <>
                      {/* Backdrop — klik mimo zavře popup */}
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setScorePopupOpen(false)}
                      />
                      {/* Novinový list — centrovaný modal */}
                      <div className="fixed inset-0 z-50 flex items-center justify-center p-6 pointer-events-none">
                        <div
                          className="relative w-full max-w-xl border-2 border-[#6b7257] shadow-2xl overflow-hidden pointer-events-auto"
                          style={{ backgroundImage: "url('/gazete.webp')", backgroundSize: "cover", backgroundPosition: "top center" }}
                        >
                          <div className="absolute inset-0 bg-[#f4efe4]/82 z-0" />
                          <div className="relative z-10">
                            {/* Prázdný prostor pro background masthead */}
                            <div className="pt-24" />
                            {/* Headline sekce */}
                            <div className="pl-[25%] pr-8 pb-4 border-b border-[#6b7257]/50">
                              <div className="text-[9px] font-bold uppercase tracking-[0.22em] text-[#6b7257]">Aktuální pořadí</div>
                              <h2 className="mt-1 font-serif text-2xl font-black leading-tight text-[#6b7257]">Průběžné výsledky dostihů</h2>
                            </div>
                            {/* Tabulka */}
                            <div className="pl-[25%] pr-[25%] py-5">
                              <ScoreTable
                                players={players}
                                bustOrder={gameState?.bust_order ?? []}
                              />
                            </div>
                            {/* Zavřít */}
                            <div className="pl-[25%] pr-8 pb-6">
                              <button
                                onClick={() => setScorePopupOpen(false)}
                                className="w-3/4 border border-[#6b7257] bg-[#6b7257]/15 px-4 py-2.5 text-center text-sm font-semibold text-[#6b7257] hover:bg-[#6b7257]/25 transition"
                              >
                                Zavřít
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
                <div className="rounded-[3px] bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-white shrink-0 max-w-[160px] truncate">
                  ▶ {currentPlayer?.name ?? "—"}
                </div>
              </div>

              {/* Pravá zóna: hostitelské akce */}
              {isHost && gameStatus !== "cancelled" && (
                <div className="flex items-center gap-1.5 shrink-0">
                  {!pendingRace && !pendingCard && !pendingRacer && !pendingOffer && players.filter(p => !isBankrupt(p)).length >= 2 && (
                    <button
                      onClick={startRace}
                      className="rounded-[3px] bg-amber-500 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-amber-600 transition"
                    >
                      {UI_TEXT.board.raceButton}
                    </button>
                  )}
                  <button
                    onClick={cancelGame}
                    className="rounded-[3px] bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-100 transition"
                  >
                    Zrušit
                  </button>
                </div>
              )}
              {/* DEV-only: Race Mode experiments */}
              {process.env.NODE_ENV === "development" && (
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => setDevRaceMode(true)}
                    className="rounded-[3px] border border-purple-300 bg-purple-50 px-2.5 py-1 text-[11px] font-semibold text-purple-700 hover:bg-purple-100 transition"
                    title="DEV: Race Shell — fullscreen overlay"
                  >
                    🧪 Shell
                  </button>
                  <button
                    onClick={() => setDevRaceBoardLayer(true)}
                    className="rounded-[3px] border border-indigo-300 bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-100 transition"
                    title="DEV: Race Layer — vrstva uvnitř boardu"
                  >
                    🏁 Layer
                  </button>
                  <button
                    onClick={openDevFlip}
                    className="rounded-[3px] border border-teal-300 bg-teal-50 px-2.5 py-1 text-[11px] font-semibold text-teal-700 hover:bg-teal-100 transition"
                    title="DEV: Race Flip — flip animace boardu"
                  >
                    🔄 Flip
                  </button>
                  <button
                    onClick={() => setDevDuelOpen(true)}
                    className="rounded-[3px] border border-emerald-400 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100 transition"
                    title="DEV: Neon Rope Duel — lokální harness"
                  >
                    🪢 Duel
                  </button>
                  <button
                    onClick={() => setDevSpeedOpen(true)}
                    className="rounded-[3px] border border-cyan-400 bg-cyan-50 px-2.5 py-1 text-[11px] font-semibold text-cyan-700 hover:bg-cyan-100 transition"
                    title="DEV: Speed Arena — lokální harness"
                  >
                    🏎 Speed
                  </button>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-[3px] bg-emerald-100 px-2 py-1 text-emerald-800">🟢 {theme.labels.legend.gain}</span>
              <span className="rounded-[3px] bg-red-100 px-2 py-1 text-red-800">🔴 {theme.labels.legend.lose}</span>
              <span className="rounded-[3px] bg-violet-100 px-2 py-1 text-violet-800">🟣 {theme.labels.legend.gamble}</span>
              <span className="rounded-[3px] bg-amber-100 px-2 py-1 text-amber-800">🟠 {theme.labels.legend.racer}</span>
            </div>
            </div>{/* konec HUD+legenda panelu */}

            {/* aspect-[20/18] musí odpovídat STADIUM_ASPECT v lib/board/constants.ts */}
            <div className={`relative mx-auto w-full overflow-visible ${board.shape === "stadium" ? "aspect-[20/18]" : "aspect-square max-w-[760px]"}`}>
              <div
                className={`absolute inset-0 overflow-hidden rounded-[4px] border-2 ${theme.colors.boardSurfaceBorder} ${theme.colors.boardSurface}`}
                style={{
                  boxShadow: "inset 0 2px 24px rgba(0,0,0,0.09), 0 4px 32px rgba(0,0,0,0.10)",
                  transition: flipBoardAnim !== "idle" ? "transform 0.3s ease-in-out" : "none",
                  transform: (devFlipOpen && flipBoardAnim !== "back-in") || flipBoardAnim === "out"
                    ? "perspective(900px) rotateY(-90deg)"
                    : "perspective(900px) rotateY(0deg)",
                }}
              >
                {boardBgUrl && (
                  <div
                    className="pointer-events-none absolute inset-0"
                    style={{ backgroundImage: `url(${boardBgUrl})`, backgroundSize: "cover", backgroundPosition: "center", opacity: 0.5 }}
                  />
                )}

                {/* ── SVG traťový pás ── */}
                <svg
                  className="pointer-events-none absolute inset-0 h-full w-full"
                  viewBox="0 0 100 100"
                  style={{ zIndex: 0 }}
                >
                  {board.shape === "stadium" ? (<>
                    {/* Stadium: zaoblený obdélník, r=22, rovné strany hw=18 */}
                    <path d="M 32 28 L 68 28 A 22 22 0 0 1 68 72 L 32 72 A 22 22 0 0 1 32 28 Z"
                      fill="none" stroke="rgba(0,0,0,0.07)" strokeWidth="11" />
                    <path d="M 32 28 L 68 28 A 22 22 0 0 1 68 72 L 32 72 A 22 22 0 0 1 32 28 Z"
                      fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="11" />
                  </>) : (<>
                    <ellipse cx="50" cy="50" rx="42" ry="42"
                      fill="none" stroke="rgba(0,0,0,0.07)" strokeWidth="11" />
                    <ellipse cx="50" cy="50" rx="42" ry="42"
                      fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="11" />
                  </>)}
                </svg>
              </div>

              <div className="absolute inset-0 overflow-visible">
                {FIELDS.map((field) => {
                  const pos = board.shape === "stadium"
                    ? FIELD_POSITIONS_STADIUM[field.index]
                    : FIELD_POSITIONS[field.index];
                  const isTrail = trailFields.includes(field.index);
                  const isHoverHighlight = hoveredPlayerId
                    ? displayPlayers.some(p => p.id === hoveredPlayerId && p.position === field.index && !isBankrupt(p))
                    : false;
                  const owner = field.type === "racer" && field.racer ? racerOwnership[racerOwnershipKey(field.racer)] ?? null : null;
                  const detail = getFieldDetail(field, owner?.name ?? null);
                  const metaLabel = getFieldMetaLabel(field, owner?.name ?? null);
                  const isHovered = hoveredFieldIdx === field.index;
                  const tone = getFieldTone(field, themeId);

                  // Rotace segmentu: 0° = RIGHT, segment „spodek" míří ven od středu
                  const rotDeg = board.shape === "stadium"
                    ? (FIELD_ROTATIONS_STADIUM[field.index] ?? 0)
                    : field.index * (360 / 21) - 90;

                  const glows: string[] = [];
                  if (isTrail) glows.push("drop-shadow(0 0 7px rgba(251,191,36,0.95))");
                  if (isHoverHighlight) glows.push("drop-shadow(0 0 7px rgba(96,165,250,0.95))");
                  if (owner) glows.push("drop-shadow(0 0 5px rgba(99,102,241,0.8))");

                  const fieldBgPrimaryPath = field.type === "racer"
                    ? resolveRacerCardImagePath(
                        themeId,
                        field.racer?.id,
                        field.racer?.image,
                      )
                    : resolveFieldCardImagePath(
                        themeId,
                        field.type,
                        themeManifest.assets?.fieldTextures?.[field.type]
                      );
                  const fieldBgImage = buildCardBackgroundImageValue(fieldBgPrimaryPath);

                  return (
                    <div
                      key={field.index}
                      className="absolute overflow-visible"
                      style={{
                        top: pos.top,
                        left: pos.left,
                        width: "82px",
                        height: "112px",
                        transform: `translate(-50%, -50%) rotate(${rotDeg}deg) scale(${isHovered ? 2.8 : 1.0})`,
                        transition: "transform 0.18s ease-out, box-shadow 0.18s ease-out",
                        zIndex: isHovered ? 100 : 2,
                        filter: glows.length > 0 ? glows.join(" ") : undefined,
                        cursor: "default",
                      }}
                      onMouseEnter={() => setHoveredFieldIdx(field.index)}
                      onMouseLeave={() => setHoveredFieldIdx(null)}
                    >
                      {/* Fog of War: skrytá karta — vlastní render, žádný obsah normální karty neprosvítá */}
                      {(!isFieldVisible(field) || showingHiddenRef.current.has(field.index)) ? (
                        <div
                          className={`relative h-full w-full overflow-hidden rounded-[2px] ring-1 ring-black/20 shadow-[0_10px_18px_rgba(15,23,42,0.16)]${flippingFields.has(field.index) ? " fog-card-flip" : ""}`}
                          style={{
                            backgroundImage: "url('/fog-of-war-card.webp')",
                            backgroundSize: "cover",
                            backgroundPosition: "center",
                            border: "1px solid rgba(0,0,0,0.82)",
                            borderTopWidth: "6px",
                            borderTopColor: "rgba(30,41,59,0.9)",
                            perspective: "400px",
                          }}
                        />
                      ) : (
                      <div
                        className={`group relative h-full w-full overflow-hidden rounded-[2px] ring-1 ring-black/10 shadow-[0_10px_18px_rgba(15,23,42,0.16)] ${theme.colors.fieldStyles[field.type]}${flippingFields.has(field.index) ? " fog-card-flip" : ""}`}
                        style={{
                          height: "100%",
                          width: "100%",
                          backgroundImage: fieldBgImage,
                          backgroundSize: "cover, cover",
                          backgroundPosition: "center, center",
                          border: "1px solid rgba(0,0,0,0.82)",
                          borderTopWidth: "6px",
                          borderTopColor: getFieldAccentColor(field),
                        }}
                      >
                        <div className={`pointer-events-none absolute inset-0 ${tone.cardOverlay}`} />
                        {/* Jemný bílý overlay pro neracer pole — odlišuje je od hero racer karet */}
                        {field.type !== "racer" && field.type !== "start" && (
                          <div className="pointer-events-none absolute inset-0 bg-white/25 transition-opacity duration-150 group-hover:opacity-0" />
                        )}
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 px-2 pb-2">
                        <div className="flex justify-center">
                          <div className="inline-flex max-w-[58px] items-center justify-center rounded-[10px] bg-white/50 px-1.5 py-0.5 text-[5.5px] font-black uppercase leading-[1.05] tracking-[0.04em] text-slate-950 shadow-[0_1px_0_rgba(255,255,255,0.35)]">
                              <span className="whitespace-normal break-words text-center">
                                {field.type === "start" ? "START" : field.label}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div
                          className="relative z-10 flex h-full w-full flex-col justify-between"
                          style={{ transform: `rotate(${-rotDeg}deg)` }}
                        />
                      </div>
                      )}

                    </div>
                  );
                })}

                {/* Figurky hráčů — mimo čtverce polí, posunuté ke středu */}
                {FIELDS.map((field) => {
                  const playersHere = fieldPlayers(field.index);
                  if (playersHere.length === 0) return null;
                  return (
                    <div
                      key={`fig-${field.index}`}
                      className="absolute flex items-center justify-center gap-0.5"
                      style={{
                        ...(board.shape === "stadium"
                          ? FIGURINE_POSITIONS_STADIUM[field.index]
                          : FIGURINE_POSITIONS[field.index]),
                        zIndex: 10,
                      }}
                    >
                      {playersHere.map((player) => {
                        const isAnimatingThis = player.id === animatingPlayerId;
                        return (
                          <div
                            key={player.id}
                            className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-black text-black ring-2 ring-black/20 ${player.color} ${isAnimatingThis ? "scale-125 animate-bounce" : "animate-figurine-bob"}`}
                            style={{ boxShadow: "0 3px 0 rgba(0,0,0,0.35), 0 4px 6px rgba(0,0,0,0.25)", animationDelay: isAnimatingThis ? "0s" : `${(player.turn_order % 4) * 0.28}s` }}
                            title={player.name}
                          >
                            {player.name.charAt(0).toUpperCase()}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}

                {/* ── Trail dots — stopa za pohybující se figurkou ─────────────────── */}
                {animatingPlayerIdx !== null && trailFields.length > 0 && (() => {
                  const n = trailFields.length;
                  const trailColor = players[animatingPlayerIdx]?.color ?? "bg-amber-400";
                  return trailFields.map((fieldIdx, i) => {
                    const pos = board.shape === "stadium"
                      ? FIGURINE_POSITIONS_STADIUM[fieldIdx]
                      : FIGURINE_POSITIONS[fieldIdx];
                    if (!pos) return null;
                    const progress = n === 1 ? 1 : i / (n - 1);
                    const opacity = 0.10 + progress * 0.38;
                    const size = 4 + progress * 14;
                    return (
                      <div
                        key={`trail-${fieldIdx}-${i}`}
                        className="absolute pointer-events-none"
                        style={{ left: pos.left, top: pos.top, transform: "translate(-50%, -50%)", zIndex: 11, width: `${size}px`, height: `${size}px` }}
                      >
                        <div className={`rounded-full ${trailColor}`} style={{ width: "100%", height: "100%", opacity }} />
                      </div>
                    );
                  });
                })()}

                {/* ── Smooth floating figurine — plynulý pohyb s CSS transition ─── */}
                {animatingPlayerIdx !== null && animPosition !== null && (() => {
                  const animPlayer = players[animatingPlayerIdx];
                  if (!animPlayer) return null;
                  const pos = board.shape === "stadium"
                    ? FIGURINE_POSITIONS_STADIUM[animPosition]
                    : FIGURINE_POSITIONS[animPosition];
                  if (!pos) return null;
                  return (
                    <div
                      className="absolute pointer-events-none"
                      style={{ left: pos.left, top: pos.top, transform: "translate(-50%, -50%)", zIndex: 15, transition: "left 140ms ease-out, top 140ms ease-out" }}
                    >
                      <div
                        className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-black text-black ring-2 ring-black/20 scale-125 animate-bounce ${animPlayer.color}`}
                        style={{ boxShadow: "0 3px 0 rgba(0,0,0,0.35), 0 4px 6px rgba(0,0,0,0.25)" }}
                        title={animPlayer.name}
                      >
                        {animPlayer.name.charAt(0).toUpperCase()}
                      </div>
                    </div>
                  );
                })()}

                {/* ── Info blok Startu — pod kartou (pole 0 je rotovaná -90°, zabírá levou hranu)  */}
                {(() => {
                  const startBonus = economy.stateSubsidy;
                  const myLaps = (myPlayer?.laps ?? 0);
                  const myNextTax = getStartTax(myLaps, economy);
                  return (
                    <div
                      className="absolute pointer-events-none select-none"
                      style={{ top: "50%", left: 0, transform: "translate(-108%, -50%)", zIndex: 3 }}
                    >
                      <div className="rounded-lg bg-black/40 px-2 py-1.5 backdrop-blur-sm space-y-0.5">
                        <div className="text-[9px] font-semibold text-green-400 whitespace-nowrap">
                          Příspěvek: +{startBonus} 💰
                        </div>
                        {myNextTax > 0 && (
                          <div className="text-[9px] font-semibold text-red-400 whitespace-nowrap">
                            Výpalné (daně): −{myNextTax} 💰
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                <div
                  className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center p-4 text-center ${theme.assets?.centerBgImage ? "" : `overflow-hidden border-2 shadow-inner ${theme.colors.centerBorder}`} ${theme.colors.centerBackground}`}
                  style={theme.assets?.centerBgImage
                    ? { width: "62%", height: "42%" }
                    : board.shape === "stadium"
                      ? { width: "50%", height: "40%", borderRadius: "25%" }
                      : { width: "44%", height: "44%", borderRadius: "50%" }}
                >
                  {theme.assets?.centerBgImage && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={theme.assets.centerBgImage}
                      alt=""
                      className="pointer-events-none absolute inset-0 h-full w-full object-contain"
                    />
                  )}
                  {hoveredField && !isFieldVisible(hoveredField) ? (
                    <div className="relative z-10 max-w-[180px] text-center">
                      <div className="text-3xl">🌫️</div>
                      <div className={`mt-2 text-sm font-semibold ${theme.colors.centerTitle}`}>Zakryté mlhou</div>
                      <div className={`mt-1 text-xs ${theme.colors.centerSubtitle}`}>Sem ještě nikdo nedošel</div>
                    </div>
                  ) : hoveredField ? (
                    <div className="relative z-10 max-w-[180px]">
                      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                        {hoveredField.type === "racer" ? (hoveredField.racer ? "racer" : "slot") : hoveredField.type === "coins_gain" ? "reward" : hoveredField.type === "coins_lose" ? "risk" : hoveredField.type}
                      </div>
                      <div className={`mt-2 text-sm font-semibold ${theme.colors.centerTitle}`}>
                        {hoveredField.type === "start" ? "START" : hoveredField.label}
                      </div>
                      {/* Racer detail */}
                      {hoveredField.type === "racer" && hoveredField.racer && (() => {
                        const racer = hoveredField.racer;
                        const owner = racerOwnership[racerOwnershipKey(racer)] ?? null;
                        const speedStars = Math.min(racer.speed, 5);
                        const racerImage = racer.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={racer.image}
                            alt={racer.name}
                            className="mx-auto mt-2 h-14 w-14 rounded-lg object-cover bg-slate-100"
                            onError={(e) => { e.currentTarget.style.display = "none"; }}
                          />
                        ) : null;

                        if (owner) {
                          // Vlastněný racer — aktuální stamina z player.horses
                          const ownedHorse = owner.horses.find(h => racerOwnershipKey(h) === racerOwnershipKey(racer));
                          const currentStamina = ownedHorse?.stamina ?? ownedHorse?.maxStamina ?? 100;
                          const staminaDots = Math.round(currentStamina / 20);
                          return (
                            <div className={`mt-2 space-y-1 text-[10px] ${theme.colors.centerSubtitle}`}>
                              {racerImage}
                              <div className={`text-xs font-medium ${theme.colors.centerSubtitle}`}>✓ {owner.name}</div>
                              <div className="flex items-center justify-between gap-3">
                                <span className="opacity-60 shrink-0">Rychlost</span>
                                <span className="tracking-tight">
                                  {"⭐".repeat(speedStars)}{"·".repeat(5 - speedStars)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between gap-3">
                                <span className="opacity-60 shrink-0">Stamina</span>
                                <span className="tracking-tight">
                                  {"🔵".repeat(staminaDots)}{"·".repeat(5 - staminaDots)}
                                </span>
                              </div>
                            </div>
                          );
                        }

                        // Volný racer (nabídka ke koupi) — max stamina z katalogu
                        const maxStamina = racer.maxStamina ?? racer.stamina ?? 100;
                        const staminaDots = Math.round(maxStamina / 20);
                        return (
                          <div className={`mt-2 space-y-1 text-[10px] ${theme.colors.centerSubtitle}`}>
                            {racerImage}
                            <div className="flex items-center justify-between gap-3">
                              <span className="opacity-60 shrink-0">Rychlost</span>
                              <span className="tracking-tight">
                                {"⭐".repeat(speedStars)}{"·".repeat(5 - speedStars)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <span className="opacity-60 shrink-0">Max stamina</span>
                              <span className="tracking-tight">
                                {"🔵".repeat(staminaDots)}{"·".repeat(5 - staminaDots)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <span className="opacity-60 shrink-0">Cena</span>
                              <span className="font-semibold">{racer.price} 💰</span>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Non-racer detail — existující string renderer */}
                      {hoveredField.type !== "racer" && getFieldDetail(hoveredField, null) && (
                        <div className={`mt-2 text-xs leading-relaxed ${theme.colors.centerSubtitle}`}>
                          {getFieldDetail(hoveredField, null)}
                        </div>
                      )}

                      {hoveredField.flavorText && (
                        <div className={`mt-2 text-[10px] italic leading-relaxed opacity-70 ${theme.colors.centerSubtitle}`}>
                          {hoveredField.flavorText}
                        </div>
                      )}
                    </div>
                  ) : coinsFeedback ? (
                    <div className="relative z-10" style={{ transition: "opacity 0.25s ease" }}>
                      <div
                        className="text-5xl font-black tabular-nums leading-none"
                        style={{ color: coinsFeedback.kind === "gain" ? "#34d399" : "#f87171" }}
                      >
                        {coinsFeedback.kind === "gain" ? "+" : ""}{coinsFeedback.amount} 💰
                      </div>
                      <div className={`mt-2 text-xs font-semibold uppercase tracking-wide ${theme.colors.centerTitle}`}>
                        {coinsFeedback.playerName}
                      </div>
                      <div className={`mt-0.5 text-[10px] ${theme.colors.centerSubtitle} opacity-70`}>
                        {coinsFeedback.fieldLabel}
                      </div>
                    </div>
                  ) : (
                    <div className="relative z-10">
                      <div className="text-4xl">{theme.labels.racingEmoji}</div>
                      <div className={`mt-1 text-sm font-semibold ${theme.colors.centerTitle}`}>{theme.labels.centerTitle}</div>
                      <div className={`mt-1 text-xs ${theme.colors.centerSubtitle}`}>{theme.labels.centerSubtitle}</div>
                      <div className={`mt-2 text-[11px] font-semibold tabular-nums ${theme.colors.centerSubtitle} opacity-70`}>
                        {gameYear}
                      </div>
                      {currentYearEvent && (
                        <div className={`mt-1 text-[10px] font-semibold leading-tight ${theme.colors.centerSubtitle}`}>
                          {currentYearEvent.title}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Pravý panel */}
          <div className="flex flex-col gap-3">
            <div className={`rounded-[4px] p-5 shadow-xl ring-1 ring-black/[0.06] ${theme.colors.cardBackground}`}>
              <div className="flex items-center justify-between mb-4">
                <div className={`text-[10px] font-bold uppercase tracking-widest ${theme.colors.textMuted}`}>{UI_TEXT.board.gamePanelTitle}</div>
                <button
                  onClick={toggleSound}
                  title={soundEnabled ? "Vypnout zvuky" : "Zapnout zvuky"}
                  className="rounded-[3px] px-2 py-1 text-base text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
                >
                  {soundEnabled ? "🔊" : "🔇"}
                </button>
              </div>
              <div className="space-y-3">
                {shouldShowRacerGuide && (
                  <div className="relative overflow-hidden rounded-[4px] border border-amber-300 bg-gradient-to-br from-amber-50 via-white to-amber-100 p-4 shadow-sm">
                    <div className="pointer-events-none absolute -right-4 -top-4 text-6xl opacity-10">{theme.labels.racingEmoji}</div>
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[3px] bg-amber-100 text-2xl">
                        🎩
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-black uppercase tracking-[0.18em] text-amber-700">
                          Průvodce
                        </div>
                        <div className="mt-1 text-sm font-semibold text-slate-800">
                          {UI_TEXT.guide.noRacer.title}
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-slate-600">
                          {UI_TEXT.guide.noRacer.body}
                        </p>
                      </div>
                      <button
                        onClick={dismissRacerGuide}
                        className="shrink-0 rounded-[3px] px-2 py-1 text-xs font-medium text-slate-400 transition hover:bg-white/70 hover:text-slate-700"
                        title="Skrýt nápovědu"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                )}

                {!shouldShowRacerGuide && shouldShowStaminaGuide && (
                  <div className="relative overflow-hidden rounded-[4px] border border-sky-300 bg-gradient-to-br from-sky-50 via-white to-cyan-100 p-4 shadow-sm">
                    <div className="pointer-events-none absolute -right-4 -top-4 text-6xl opacity-10">{theme.labels.racingEmoji}</div>
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[3px] bg-sky-100 text-2xl">
                        🎩
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-black uppercase tracking-[0.18em] text-sky-700">
                          Průvodce
                        </div>
                        <div className="mt-1 text-sm font-semibold text-slate-800">
                          {UI_TEXT.guide.hasRacer.title}
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-slate-600">
                          {UI_TEXT.guide.hasRacer.body}
                        </p>
                      </div>
                      <button
                        onClick={dismissStaminaGuide}
                        className="shrink-0 rounded-[3px] px-2 py-1 text-xs font-medium text-slate-400 transition hover:bg-white/70 hover:text-slate-700"
                        title="Skrýt nápovědu"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                )}

                {!shouldShowRacerGuide && !shouldShowStaminaGuide && shouldShowPreferredGuide && (
                  <div className="relative overflow-hidden rounded-[4px] border border-violet-300 bg-gradient-to-br from-violet-50 via-white to-fuchsia-100 p-4 shadow-sm">
                    <div className="pointer-events-none absolute -right-4 -top-4 text-6xl opacity-10">⭐</div>
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[3px] bg-violet-100 text-2xl">
                        🎩
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-black uppercase tracking-[0.18em] text-violet-700">
                          Průvodce
                        </div>
                        <div className="mt-1 text-sm font-semibold text-slate-800">
                          {UI_TEXT.guide.setPreferred.title}
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-slate-600">
                          {UI_TEXT.guide.setPreferred.body}
                        </p>
                      </div>
                      <button
                        onClick={dismissPreferredGuide}
                        className="shrink-0 rounded-[3px] px-2 py-1 text-xs font-medium text-slate-400 transition hover:bg-white/70 hover:text-slate-700"
                        title="Skrýt nápovědu"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                )}

                <div className={`rounded-[4px] p-4 transition-colors border border-black/[0.06] ${isRolling ? theme.colors.rollPanelRolling : theme.colors.rollPanelIdle}`}>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">{UI_TEXT.board.lastRollTitle}</div>
                  <div className="flex items-center gap-3">
                    <DiceFace
                      value={(isRolling || isMoving || hasPendingRollDecision) && displayRoll !== null ? displayRoll : (gameState?.last_roll ?? null)}
                      size={72}
                      rolling={isRolling}
                    />
                    {((isRolling || isMoving || hasPendingRollDecision) && displayRoll !== null ? displayRoll : gameState?.last_roll) && (
                      <span className={`text-3xl font-bold ${isRolling ? "text-amber-600" : "text-slate-700"}`}>
                        {(isRolling || isMoving || hasPendingRollDecision) && displayRoll !== null ? displayRoll : gameState?.last_roll}
                      </span>
                    )}
                    {currentPlayer && (
                      <div className="ml-auto mr-2 flex flex-col items-end gap-0.5">
                        <div className="flex items-center gap-1.5">
                          <div className={`h-2.5 w-2.5 shrink-0 rounded-full ${currentPlayer.color}`} />
                          <span className="text-[11px] font-bold text-slate-700 truncate max-w-[80px]">{currentPlayer.name}</span>
                        </div>
                        <span className="text-[10px] text-slate-400">na tahu</span>
                      </div>
                    )}
                  </div>
                </div>

                {bankruptWarning ? (
                  <div className="rounded-[4px] border-2 border-red-500 bg-red-950 p-4 space-y-3">
                    <div>
                      <div className="text-sm font-bold text-red-300">💀 Všechno, nebo nic</div>
                      <div className="mt-1 text-xs text-red-400/80">
                        Prodají se všichni tví koně bance za 80 % ceny.
                        {!bankruptWarning.willSurvive && " Ani to nestačí — zkrachuješ tak či tak."}
                      </div>
                    </div>
                    <div className="text-xs text-red-400">
                      {bankruptWarning.horses.length} {bankruptWarning.horses.length === 1 ? "kůň" : "koní"} · výnos{" "}
                      <strong className="text-white">{bankruptWarning.totalSellValue} 💰</strong>
                    </div>
                    {bankruptWarning.willSurvive && (
                      <div className="text-xs text-emerald-400">✓ Prodej tě zachrání.</div>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={() => bankruptWarningResolverRef.current?.(true)}
                        className="flex-1 rounded-[3px] bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 transition"
                      >
                        Prodat všechny koně
                      </button>
                      <button
                        onClick={() => bankruptWarningResolverRef.current?.(false)}
                        className="flex-1 rounded-[3px] border border-red-700 px-3 py-2 text-sm font-semibold text-red-300 hover:bg-red-900 transition"
                      >
                        Nechat zkrachovat
                      </button>
                    </div>
                  </div>
                ) : pendingCard ? (
                  <div className={`rounded-[4px] border-2 p-4 space-y-2 ${
                    pendingCard.card.type === "chance"
                      ? "border-sky-400 bg-sky-50"
                      : "border-teal-400 bg-teal-50"
                  }`}>
                    <div className={`text-xs font-bold uppercase tracking-widest ${
                      pendingCard.card.type === "chance" ? "text-sky-600" : "text-teal-600"
                    }`}>
                      {pendingCard.card.type === "chance" ? "🎴 Osud" : "💼 Finance"}
                    </div>
                    <div className="text-sm font-medium text-slate-800 leading-snug">
                      {pendingCard.card.text}
                    </div>
                    <div className={`mt-1 inline-block rounded-[3px] px-3 py-1 text-xs font-bold ${
                      pendingCard.card.type === "chance"
                        ? "bg-sky-100 text-sky-800"
                        : "bg-teal-100 text-teal-800"
                    }`}>
                      {pendingCard.card.effectLabel}
                    </div>
                    <div className="text-xs text-slate-400 pt-1">
                      Lízl: {players[pendingCard.playerIndex]?.name ?? "?"} · efekt se aplikuje za chvíli…
                    </div>
                  </div>
                ) : pendingRacer ? (
                  <div
                    className="rounded-[4px] border-2 border-amber-400 bg-amber-50 p-4 space-y-3"
                  >
                    <div className="text-sm font-semibold text-amber-900">
                      {/* theme.labels.racerField + racer — UI text z theme */}
                      {theme.labels.racerField} nabízí {theme.labels.racer.toLowerCase()}:
                    </div>
                    <div className="flex items-center gap-3">
                      {pendingRacer.racer.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={pendingRacer.racer.image}
                          alt={pendingRacer.racer.name}
                          className="h-12 w-12 rounded-lg object-cover bg-slate-100 shrink-0"
                          onError={(e) => { e.currentTarget.style.display = "none"; }}
                        />
                      ) : (
                        <div className="text-3xl shrink-0">{pendingRacer.racer.emoji}</div>
                      )}
                      <div>
                        <div className="font-bold text-slate-800">{pendingRacer.racer.name}</div>
                        <div className="text-sm text-slate-500">{UI_TEXT.racer.speedLabel} {"⭐".repeat(pendingRacer.racer.speed)}</div>
                        <div className="text-sm font-semibold text-amber-700">{UI_TEXT.racer.priceLabel} {pendingRacer.racer.price} 💰</div>
                        <div className="text-xs text-slate-400">
                          {players[pendingRacer.playerIndex]?.name} má: {players[pendingRacer.playerIndex]?.coins ?? 0} 💰
                        </div>
                      </div>
                    </div>
                    {isMyTurn ? (
                      <div className="flex gap-2">
                        <button
                          onClick={buyRacer}
                          disabled={(players[pendingRacer.playerIndex]?.coins ?? 0) < pendingRacer.racer.price}
                          className="flex-1 rounded-[3px] bg-amber-500 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:bg-slate-300"
                        >
                          {UI_TEXT.racer.buyButton}
                        </button>
                        <button
                          onClick={skipRacer}
                          className="flex-1 rounded-[3px] border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          {UI_TEXT.racer.skipButton}
                        </button>
                      </div>
                    ) : (
                      <div className="rounded-[3px] bg-slate-100 px-3 py-2 text-center text-sm text-slate-500">
                        {UI_TEXT.racer.waitingForDecision} {players[pendingRacer.playerIndex]?.name}…
                      </div>
                    )}
                  </div>
                ) : pendingRollDecision ? (
                  <div className="rounded-[4px] border border-slate-300 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                          {UI_TEXT.rollDecision.title}
                        </div>
                        <div className="mt-1 text-sm font-semibold text-slate-800">
                          Padlo <span className="text-base">{pendingRollDecision.baseRoll}</span>. Vyber finální tah.
                        </div>
                      </div>
                      {isMyPendingRollDecisionTurn && rollDecisionCountdown !== null && (
                        <div className="rounded-[3px] bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-500 tabular-nums">
                          {rollDecisionCountdown} s
                        </div>
                      )}
                    </div>
                    {isMyPendingRollDecisionTurn ? (
                      <>
                        <div className="mt-3 grid grid-cols-3 gap-2">
                          {rollDecisionOptions.map((option) => {
                            const signedLabel = option.adjustment > 0 ? `+${option.adjustment}` : `${option.adjustment}`;
                            return (
                              <button
                                key={option.adjustment}
                                onClick={() => resolveRollDecision(option.adjustment)}
                                disabled={option.isDisabled}
                                className={`rounded-[3px] border px-3 py-3 text-left transition ${
                                  option.adjustment === 0
                                    ? "border-slate-300 bg-slate-50 hover:bg-slate-100"
                                    : "border-amber-200 bg-amber-50 hover:bg-amber-100"
                                } disabled:cursor-not-allowed disabled:opacity-45`}
                              >
                                <div className="text-xs font-black uppercase tracking-wide text-slate-500">
                                  {option.adjustment === 0 ? UI_TEXT.rollDecision.normalOption : `${signedLabel} ${UI_TEXT.rollDecision.stepUnit}`}
                                </div>
                                <div className="mt-1 text-lg font-bold text-slate-800">
                                  {option.finalRoll}
                                </div>
                                <div className="mt-1 text-[11px] font-medium text-slate-500">
                                  {option.cost === 0 ? UI_TEXT.rollDecision.free : `-${option.cost} 💰`}
                                </div>
                                {option.targetField && (
                                  <div className="mt-2 text-[11px] leading-snug text-slate-600">
                                    {isFieldVisible(option.targetField)
                                      ? <>{option.targetField.emoji} {option.targetField.label}</>
                                      : <>🌫️ ???</>
                                    }
                                  </div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                        <div className="mt-2 text-[11px] text-slate-400">
                          {UI_TEXT.rollDecision.autoFallbackHint}
                        </div>
                      </>
                    ) : (
                      <div className="mt-3 rounded-[3px] bg-slate-100 px-3 py-3 text-center text-sm text-slate-500">
                        {UI_TEXT.rollDecision.waitingForPlayer} {currentPlayer?.name ?? "…"}…
                      </div>
                    )}
                  </div>
                ) : isSpectator ? (
                  <div className="w-full rounded-[4px] border border-indigo-200 bg-indigo-50 px-4 py-4 text-center space-y-1.5">
                    <div className="text-sm font-semibold text-indigo-700">👀 Sleduješ hru jako pozorovatel</div>
                    {gameCode && (
                      <div className="text-xs text-indigo-500">
                        Chceš hrát? Zadej kód{" "}
                        <span className="font-mono font-bold">{gameCode}</span>{" "}
                        na{" "}
                        <a href={`/?join=${gameCode}`} className="underline hover:text-indigo-700">úvodní stránce</a>.
                      </div>
                    )}
                  </div>
                ) : iAmBankrupt ? (
                  <div className="w-full rounded-[4px] bg-slate-800 px-4 py-4 text-center">
                    <div className="text-sm font-semibold text-slate-300">💀 Jsi pozorovatel</div>
                    <div className="mt-1 text-xs text-slate-500">Sleduj, kdo přežije do konce.</div>
                  </div>
                ) : isRolling ? (
                  <div className="w-full rounded-[4px] bg-amber-100 px-4 py-4 text-center text-amber-700 font-semibold animate-pulse">
                    {UI_TEXT.board.rollingStatus}
                  </div>
                ) : isMoving ? (
                  <div className="w-full rounded-[4px] bg-slate-100 px-4 py-4 text-center text-slate-600 font-semibold">
                    {theme.labels.racingEmoji} {UI_TEXT.board.movingStatus}
                  </div>
                ) : isMyTurn ? (
                  <div className="space-y-2">
                    {canReroll && (
                      <div className="rounded-[3px] bg-amber-100 px-3 py-2 text-center text-xs font-semibold text-amber-800">
                        {UI_TEXT.board.freeRerollNotice}
                      </div>
                    )}
                    <button
                      onClick={rollDice}
                      disabled={!gameState || players.length === 0}
                      className={`w-full rounded-[4px] px-4 py-4 text-lg font-semibold text-white shadow transition disabled:cursor-not-allowed disabled:bg-slate-400 ${canReroll ? "bg-amber-500 hover:bg-amber-600" : "bg-slate-900 hover:bg-slate-800"}`}
                    >
                      {canReroll ? UI_TEXT.board.rerollButton : UI_TEXT.board.rollButton}
                    </button>
                  </div>
                ) : (
                  <div className="w-full rounded-[4px] bg-slate-100 px-4 py-4 text-center text-slate-500">
                    {UI_TEXT.board.waitingForPlayer} <span className="font-semibold text-slate-700">{currentPlayer?.name ?? "…"}</span>
                  </div>
                )}

                {/* Hráči */}
                <div className="border-t border-black/[0.06] my-1" />
                <div>
                  <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">{UI_TEXT.board.playersTitle}</div>
                  <div className="space-y-2">
                    {players.map((player, index) => {
                      const isCurrent = gameState?.current_player_index === index;
                      const bankrupt = isBankrupt(player);
                      const field = FIELDS[player.position];
                      // Discord avatar: preferuj player.discord_avatar_url (uložen v DB při joinu).
                      // Fallback pro vlastního hráče: session avatar (pro případ starých záznamů bez DB pole).
                      const isMe = !isLocalGame && player.id === myPlayerId;
                      const avatarUrl = player.discord_avatar_url ?? (isMe ? myDiscordAvatar : null);
                      const showAvatar = !!avatarUrl;
                      return (
                        <div
                          key={player.id}
                          onMouseEnter={() => !bankrupt && setHoveredPlayerId(player.id)}
                          onMouseLeave={() => setHoveredPlayerId(null)}
                          className={`rounded-[4px] border-2 p-3 transition-all cursor-default ${
                            bankrupt
                              ? "border-red-200 bg-red-50/50 opacity-35"
                              : hoveredPlayerId === player.id
                              ? theme.colors.playerCardHover
                              : isCurrent
                              ? `${theme.colors.playerCardActive} shadow-md`
                              : theme.colors.playerCardNormal
                          }`}
                        >
                          <div className="space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                {showAvatar ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={avatarUrl!}
                                    alt=""
                                    className={`h-8 w-8 shrink-0 rounded-full object-cover ring-2 shadow ${bankrupt ? "ring-slate-300 opacity-40" : "ring-black/20"}`}
                                  />
                                ) : (
                                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-black text-black ring-2 ring-black/20 shadow ${bankrupt ? "bg-slate-400" : player.color}`}>
                                    {player.name.charAt(0).toUpperCase()}
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <div className={`font-semibold text-sm leading-tight ${bankrupt ? "text-slate-400 line-through" : theme.colors.textPrimary}`}>
                                    {player.name}
                                  </div>
                                  {bankrupt ? (
                                    <div className="text-xs font-semibold text-red-500">{UI_TEXT.board.bankruptLabel}</div>
                                  ) : (
                                    <div className={`text-xs truncate ${theme.colors.textMuted}`}>{field?.emoji} {field?.label}</div>
                                  )}
                                </div>
                              </div>
                              <div className="text-right shrink-0 space-y-1">
                                <div className={`text-sm font-bold ${bankrupt ? "text-red-400" : theme.colors.textPrimary}`}>
                                  {player.coins} 💰
                                </div>
                                {isCurrent && !bankrupt && (
                                  <div className={`rounded-full px-2 py-0.5 text-center text-[10px] font-semibold ${theme.colors.activePlayerBadge}`}>
                                    {UI_TEXT.board.activePlayerBadge}
                                  </div>
                                )}
                              </div>
                            </div>
                            {!bankrupt && player.horses.length > 0 && (
                              <div className="border-t border-black/8 pt-2 space-y-1.5">
                                {[...player.horses]
                                  .sort((a, b) => (b.isPreferred ? 1 : 0) - (a.isPreferred ? 1 : 0))
                                  .map((h) => {
                                    const hKey = racerOwnershipKey(h);
                                    const isOwn = isLocalGame ? viewerRole === "player" : player.id === myPlayerId;
                                    return (
                                      <div
                                        key={hKey}
                                        className={`rounded-[3px] px-2.5 py-2 text-xs ${
                                          h.isPreferred
                                            ? "border border-yellow-200 bg-yellow-50"
                                            : "border border-black/[0.06] bg-slate-50"
                                        }`}
                                        onMouseEnter={() => {
                                          const rst = racerSoundType(h, getThemeRacers(theme));
                                          if (rst === "horse") playSfx("hoof_hover");
                                          else if (rst === "car") playSfx("engine_hover");
                                        }}
                                      >
                                        <div className={`flex items-start gap-2 text-sm font-semibold leading-snug ${h.isPreferred ? "text-amber-700" : "text-slate-700"}`}>
                                          {h.image
                                            ? ( // eslint-disable-next-line @next/next/no-img-element
                                              <img src={h.image} alt={h.name} className="mt-0.5 h-6 w-6 shrink-0 rounded object-cover bg-slate-100" onError={(e) => { e.currentTarget.style.display = "none"; }} />)
                                            : <span className="mt-0.5 shrink-0 text-base">{h.emoji}</span>
                                          }
                                          <span className="min-w-0 flex-1 break-words">
                                            {h.name}
                                          </span>
                                        </div>
                                        <div className="mt-1.5 ml-6 inline-flex max-w-full flex-wrap items-center gap-1.5">
                                          <span className="whitespace-nowrap rounded-[2px] bg-white/80 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                                            ⚡ {h.speed}
                                          </span>
                                          <span className="whitespace-nowrap rounded-[2px] bg-white/80 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                                            {UI_TEXT.board.staminaLabel} {h.stamina ?? h.maxStamina ?? 100}%
                                          </span>
                                          {isOwn ? (
                                            <span className="inline-flex items-center gap-1 whitespace-nowrap">
                                              {h.isPreferred && (
                                                <span className="rounded-[2px] bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600">
                                                  {UI_TEXT.board.preferredBadge}
                                                </span>
                                              )}
                                              <button
                                                onClick={() => setPreferredRacer(player.id, h.isPreferred ? null : hKey)}
                                                className={`shrink-0 text-sm leading-none transition-colors ${
                                                  h.isPreferred
                                                    ? "text-amber-400 hover:text-slate-300"
                                                    : "text-slate-300 hover:text-amber-400"
                                                }`}
                                                title={h.isPreferred ? "Odnastavit hlavního závodníka" : "Nastavit jako hlavního závodníka"}
                                              >
                                                {h.isPreferred ? "★" : "☆"}
                                              </button>
                                              {isCurrent && !gameState?.horse_pending && !gameState?.card_pending && !gameState?.offer_pending && (
                                                <button
                                                  onClick={() => sellRacerToBank(player, h)}
                                                  className="shrink-0 rounded-[2px] bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-400 hover:bg-red-100 hover:text-red-600 transition-colors"
                                                  title={`Prodat bance za ${Math.floor(h.price * 0.8)} 💰 (80 % ceny)`}
                                                >
                                                  Prodat
                                                </button>
                                              )}
                                            </span>
                                          ) : h.isPreferred ? (
                                            <span className="inline-flex items-center gap-1 whitespace-nowrap">
                                              <span className="rounded-[2px] bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600">
                                                Hlavní
                                              </span>
                                              <span className="shrink-0 text-sm leading-none text-amber-400">★</span>
                                            </span>
                                          ) : null}
                                        </div>
                                      </div>
                                    );
                                  })}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* DEV: Race Board Layer — absolute overlay uvnitř board surface */}
                {process.env.NODE_ENV === "development" && devRaceBoardLayer && (
                  <DevRaceBoardLayer
                    playerName={players.find(p => p.id === myPlayerId)?.name ?? players[0]?.name ?? "Hráč"}
                    playerColor={players.find(p => p.id === myPlayerId)?.color ?? "#64748b"}
                    racingEmoji={theme.labels.racingEmoji}
                    onExit={() => setDevRaceBoardLayer(false)}
                  />
                )}

              </div>

              {/* DEV: Race Flip Layer — sourozenec boardu, ne dítě; flip efekt navazuje na rotaci boardu */}
              {process.env.NODE_ENV === "development" && devFlipOpen && (
                <DevRaceFlipLayer
                  playerName={players.find(p => p.id === myPlayerId)?.name ?? players[0]?.name ?? "Hráč"}
                  playerColor={players.find(p => p.id === myPlayerId)?.color ?? "#64748b"}
                  racingEmoji={theme.labels.racingEmoji}
                  onExit={closeDevFlip}
                />
              )}
            </div>

            {/* Log */}
            {(gameState?.log?.length ?? 0) > 0 && (
              <div className={`rounded-[4px] px-4 py-3 shadow-sm ring-1 ring-black/[0.05] ${theme.colors.cardBackground}`}>
                <div className={`text-[10px] font-bold uppercase tracking-widest mb-2 ${theme.colors.textMuted}`}>{UI_TEXT.board.moveLogTitle}</div>
                <div className="space-y-1 max-h-36 overflow-y-auto">
                  {(gameState?.log ?? []).map((entry, i) => (
                    <div key={i} className={`text-[11px] leading-snug ${i === 0 ? `font-medium ${theme.colors.textPrimary}` : theme.colors.textMuted}`}>
                      {entry}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
      {introVisible && (
        <IntroOverlay
          year={theme.mapMeta?.yearStart ?? 1921}
          place={theme.mapMeta?.place ?? "místní okruh"}
          subtitle={theme.mapMeta?.subtitle ?? "Každá mapa má svoje pravidla."}
          onDone={() => setIntroVisible(false)}
        />
      )}
      <BuildInfoBar theme={theme} boardId={boardId} />
      <ThemeAssetInspector themeId={themeId} theme={theme} />

      {/* DEV: Race Mode shell overlay — mimo game state, žádné DB změny */}
      {process.env.NODE_ENV === "development" && devRaceMode && (
        <DevRaceModeShell
          playerName={players.find(p => p.id === myPlayerId)?.name ?? players[0]?.name ?? "Hráč"}
          playerColor={players.find(p => p.id === myPlayerId)?.color ?? "#64748b"}
          racingEmoji={theme.labels.racingEmoji}
          onExit={() => setDevRaceMode(false)}
        />
      )}
      {/* DEV: Neon Rope Duel — izolovaný lokální harness, žádný game state */}
      {process.env.NODE_ENV === "development" && devDuelOpen && (
        <DevDuelShell onExit={() => setDevDuelOpen(false)} />
      )}
      {/* DEV: Speed Arena — izolovaný lokální harness, žádný game state */}
      {process.env.NODE_ENV === "development" && devSpeedOpen && (
        <SpeedDevShell onExit={() => setDevSpeedOpen(false)} />
      )}
      <div className="py-2 flex items-center justify-center gap-4 text-xs text-slate-400">
        <a href="/pravidla" className="hover:text-slate-600 underline">Pravidla hry</a>
        <span>·</span>
        <a href="/o-nas" className="hover:text-slate-600 underline">O nás</a>
        <span>·</span>
        <a href="mailto:info@paytowin.cz" className="hover:text-slate-600 underline">info@paytowin.cz</a>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Mapuje herní stav na CenterEvent view model pro CenterEventModal.
 * Priorita: card_pending > offer_pending.
 */
function mapToCenterEvent(
  pendingCard: { card: GameCard; playerIndex: number } | null,
  pendingOffer: RerollOffer | null,
  players: Player[],
  gameMode: "online" | "local",
  viewerRole: string,
  myPlayerId: string | null
): CenterEvent | null {
  if (pendingCard) {
    const { card, playerIndex } = pendingCard;
    return {
      type: "card",
      cardType: card.type,
      category: card.type === "chance" ? "Osud" : card.type === "mafia" ? "Mafie" : "Finance",
      emoji: card.type === "chance" ? "🎴" : card.type === "mafia" ? "🎭" : "💼",
      playerName: players[playerIndex]?.name ?? "?",
      text: card.text,
      effectLabel: card.effectLabel,
      imagePath: card.imagePath,
      isActivePlayer: gameMode === "local" ? true : (myPlayerId !== null && (players[playerIndex]?.id === myPlayerId)),
    };
  }
  if (pendingOffer) {
    const offerPlayer = players.find(p => p.id === pendingOffer.playerId);
    const playerCoins = offerPlayer?.coins ?? 0;
    return {
      type: "offer",
      playerName: pendingOffer.playerName,
      playerCoins,
      cost: pendingOffer.cost,
      canConfirm: playerCoins >= pendingOffer.cost,
      isActivePlayer: gameMode === "local"
        ? viewerRole === "player"
        : myPlayerId === pendingOffer.playerId,
    };
  }
  return null;
}

/**
 * Vrátí zobrazitelný identifikátor závodníka.
 *
 * Priorita fallbacků:
 *   1. racerImages[racer.id] — z theme.assets.racerImages (nový kanonický zdroj)
 *   2. racer.image — přímý obrázek v RacerConfig (theme builder ho vyplní)
 *   3. racer.emoji — vždy k dispozici
 *
 * Pozn.: horseImages je legacy název; volající předává `racerImages ?? horseImages`.
 */
export function resolveRacerDisplay(
  racer: Horse,
  racerImages?: Partial<Record<string, string>>
): { type: "emoji"; value: string } | { type: "image"; src: string; alt: string } {
  const key = racer.id ?? racer.name;
  const src = racerImages?.[key];
  if (src) return { type: "image", src, alt: racer.name };
  return { type: "emoji", value: racer.emoji };
}
