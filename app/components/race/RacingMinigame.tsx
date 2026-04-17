"use client";

/**
 * RacingMinigame — hybridní závodní minihra.
 *
 * Fáze 1 — Překážky (0–7 s):
 *   Prompty se sekvenčně zobrazují (← → ↑) s reakčním oknem.
 *   Správná klávesa v čase → +3 body. Spam nefunguje — prompty mají mezery.
 *
 * Fáze 2 — Sprint (7–10 s):
 *   Střídej ← a → co nejrychleji. Každé správné střídání → +1 bod.
 *
 * Kontrakt s boardem: MinigameProps → MinigameResult (score + finalStamina).
 * Board neví nic o fázích ani inputech uvnitř. Výměna = jen tento soubor.
 */

import React from "react";
import type { Player, Horse } from "@/lib/types/game";
import { STAMINA_PER_TAP } from "@/lib/types/game";

// ── Kontrakt ────────────────────────────────────────────────────────────────

/** Co board předá minihře. */
export interface MinigameProps {
  racingPlayer: Player;
  racingHorse: Horse | undefined;
  /** true = tento klient je aktivní závodník; false = jen sleduje */
  isMyTurn: boolean;
  currentIdx: number;
  totalRacers: number;
  initialStamina: number;
  onSubmit: (result: MinigameResult) => void;
}

/** Co minihra vrátí boardu po doběhnutí. */
export interface MinigameResult {
  score: number;
  finalStamina: number;
}

// ── Sdílené UI ──────────────────────────────────────────────────────────────

/** Vizuální bar staminy: zelená > 66, žlutá > 33, červená ≤ 33. */
export function StaminaBar({ value }: { value: number }) {
  const color = value > 66 ? "#22c55e" : value > 33 ? "#f59e0b" : "#ef4444";
  return (
    <div className="flex items-center gap-1.5 mt-0.5">
      <div className="h-1.5 w-16 rounded-full bg-slate-200 overflow-hidden">
        <div className="h-1.5 rounded-full" style={{ width: `${value}%`, background: color }} />
      </div>
      <span className="text-xs text-slate-400">{value}/100</span>
    </div>
  );
}

// ── Konstanty ───────────────────────────────────────────────────────────────

export const RACE_DURATION_MS = 10000;

const OBSTACLE_END_MS  = 7000;  // fáze 1: 0–7 s
const PROMPT_ACTIVE_MS = 1100;  // okno pro odpověď
const PROMPT_GAP_MS    = 400;   // mezera mezi prompty
const OBSTACLE_HIT_PTS = 3;     // body za správnou reakci

// ── Typy a klávesy ──────────────────────────────────────────────────────────

type ObstacleKey = "←" | "→" | "↑";
type SprintKey   = "←" | "→";
type GamePhase   = "obstacle" | "sprint";

const OBSTACLE_KEYS: ObstacleKey[] = ["←", "→", "↑"];
const OBSTACLE_LABELS: Record<ObstacleKey, string> = {
  "←": "Zatáč vlevo!",
  "→": "Zatáč vpravo!",
  "↑": "Skok!",
};

const KEY_CODE_MAP: Record<string, ObstacleKey | "↓"> = {
  ArrowLeft: "←", ArrowRight: "→", ArrowUp: "↑", ArrowDown: "↓",
};

function randomObstacleKey(exclude?: ObstacleKey): ObstacleKey {
  const pool = OBSTACLE_KEYS.filter(k => k !== exclude);
  return pool[Math.floor(Math.random() * pool.length)];
}

// ── Komponenta ──────────────────────────────────────────────────────────────

export default function RacingMinigame({
  racingPlayer,
  racingHorse,
  isMyTurn,
  currentIdx,
  totalRacers,
  initialStamina,
  onSubmit,
}: MinigameProps) {

  // ── Timer ──────────────────────────────────────────────────────────────
  const [timeLeft, setTimeLeft] = React.useState(RACE_DURATION_MS);

  // ── Fáze ───────────────────────────────────────────────────────────────
  const [gamePhase, setGamePhase] = React.useState<GamePhase>("obstacle");
  const gamePhaseRef = React.useRef<GamePhase>("obstacle");

  // ── Obstacle phase state ───────────────────────────────────────────────
  const [prompt, setPrompt] = React.useState<ObstacleKey | null>(null);
  const [promptActive, setPromptActive] = React.useState(false);
  const [obstFeedback, setObstFeedback] = React.useState<"hit" | "miss" | null>(null);

  const promptActiveRef  = React.useRef(false);
  const currentPromptRef = React.useRef<ObstacleKey | null>(null);
  const lastPromptKeyRef = React.useRef<ObstacleKey | undefined>(undefined);

  // ── Sprint phase state ─────────────────────────────────────────────────
  const [sprintScore, setSprintScore] = React.useState(0);
  const [lastSprintKey, setLastSprintKey] = React.useState<SprintKey | null>(null);
  const [sprintFlash, setSprintFlash] = React.useState(false);

  const lastSprintKeyRef = React.useRef<SprintKey | null>(null);

  // ── Score + stamina (refs = canonical hodnoty pro submit, state = display) ──
  const scoreRef = React.useRef({ obstacle: 0, sprint: 0, presses: 0 });
  const [obstacleScore, setObstacleScore] = React.useState(0);
  const [totalPresses,  setTotalPresses]  = React.useState(0);

  const liveStamina = Math.max(0, initialStamina - totalPresses * STAMINA_PER_TAP);
  const burnedOut   = liveStamina === 0;

  const submittedRef = React.useRef(false);

  // ── Submit ─────────────────────────────────────────────────────────────
  const submit = React.useCallback(() => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    const { obstacle, sprint, presses } = scoreRef.current;
    const finalStamina = Math.max(0, initialStamina - presses * STAMINA_PER_TAP);
    onSubmit({ score: obstacle + sprint, finalStamina });
  }, [onSubmit, initialStamina]);

  // ── Timer tick ─────────────────────────────────────────────────────────
  React.useEffect(() => {
    const interval = setInterval(() => setTimeLeft(prev => Math.max(0, prev - 100)), 100);
    return () => clearInterval(interval);
  }, []);

  React.useEffect(() => {
    if (timeLeft === 0) submit();
  }, [timeLeft, submit]);

  // ── Obstacle prompt sequence ───────────────────────────────────────────
  React.useEffect(() => {
    if (!isMyTurn) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    let offset = 0;

    while (offset < OBSTACLE_END_MS) {
      const showAt = offset;
      const hideAt = offset + PROMPT_ACTIVE_MS;
      timers.push(setTimeout(() => {
        if (submittedRef.current || gamePhaseRef.current !== "obstacle") return;
        const key = randomObstacleKey(lastPromptKeyRef.current);
        lastPromptKeyRef.current  = key;
        currentPromptRef.current  = key;
        promptActiveRef.current   = true;
        setPrompt(key);
        setPromptActive(true);
        setObstFeedback(null);
      }, showAt));
      timers.push(setTimeout(() => {
        promptActiveRef.current = false;
        setPromptActive(false);
      }, hideAt));
      offset += PROMPT_ACTIVE_MS + PROMPT_GAP_MS;
    }

    // Přechod do sprintu
    timers.push(setTimeout(() => {
      gamePhaseRef.current = "sprint";
      setGamePhase("sprint");
      promptActiveRef.current = false;
      setPromptActive(false);
      setPrompt(null);
    }, OBSTACLE_END_MS));

    return () => timers.forEach(clearTimeout);
  }, [isMyTurn]);

  // ── Input handlers ─────────────────────────────────────────────────────

  const handleObstacleInput = React.useCallback((key: ObstacleKey) => {
    if (!promptActiveRef.current || submittedRef.current) return;
    // Zavři okno ihned — zabraňuje double-fire
    promptActiveRef.current = false;
    setPromptActive(false);
    scoreRef.current.presses += 1;
    setTotalPresses(scoreRef.current.presses);
    if (key === currentPromptRef.current) {
      scoreRef.current.obstacle += OBSTACLE_HIT_PTS;
      setObstacleScore(scoreRef.current.obstacle);
      setObstFeedback("hit");
    } else {
      setObstFeedback("miss");
    }
    setTimeout(() => setObstFeedback(null), 500);
  }, []);

  const handleSprintInput = React.useCallback((key: SprintKey) => {
    if (submittedRef.current) return;
    if (key === lastSprintKeyRef.current) return; // stejná klávesa dvakrát = ignoruj
    lastSprintKeyRef.current = key;
    setLastSprintKey(key);
    scoreRef.current.sprint  += 1;
    scoreRef.current.presses += 1;
    setSprintScore(scoreRef.current.sprint);
    setTotalPresses(scoreRef.current.presses);
    setSprintFlash(true);
    setTimeout(() => setSprintFlash(false), 120);
  }, []);

  // ── Keyboard ───────────────────────────────────────────────────────────
  React.useEffect(() => {
    if (!isMyTurn) return;
    const onKey = (e: KeyboardEvent) => {
      if (submittedRef.current) return;
      const mapped = KEY_CODE_MAP[e.code];
      if (!mapped || mapped === "↓") return;
      e.preventDefault();
      if (gamePhaseRef.current === "obstacle") {
        handleObstacleInput(mapped as ObstacleKey);
      } else {
        handleSprintInput(mapped as SprintKey);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isMyTurn, handleObstacleInput, handleSprintInput]);

  // ── Render helpers ─────────────────────────────────────────────────────
  const pct = timeLeft / RACE_DURATION_MS;
  const barColor = pct > 0.5 ? "#22c55e" : pct > 0.25 ? "#f59e0b" : "#ef4444";
  const totalScore = obstacleScore + sprintScore;
  // Příští správný klávesa ve sprintu = opak posledního; před prvním stiskem obě neutrální
  const expectedSprintKey: SprintKey | null = lastSprintKey === "←" ? "→" : lastSprintKey === "→" ? "←" : null;

  // Spectator view
  if (!isMyTurn) {
    return (
      <div className="text-center space-y-4 py-2">
        <div className="text-4xl">{racingHorse?.emoji ?? "🏇"}</div>
        <p className="text-sm text-slate-500">
          Závodí:{" "}
          <span className="font-semibold text-slate-700">{racingPlayer.name}</span>
        </p>
        <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
          <div className="h-2 rounded-full transition-none" style={{ width: `${pct * 100}%`, background: barColor }} />
        </div>
        <p className="text-xs text-slate-400">{Math.ceil(timeLeft / 1000)} s</p>
        <p className="text-xs text-slate-300">{currentIdx + 1} / {totalRacers}</p>
      </div>
    );
  }

  // Active minigame
  return (
    <div className="space-y-3">

      {/* Header: kůň + celkové skóre */}
      <div className="flex items-center justify-between">
        <span className="text-lg">
          {racingHorse?.emoji ?? "🏇"}{" "}
          <span className="text-sm font-semibold text-slate-700">{racingHorse?.name ?? "Závodník"}</span>
        </span>
        <span className="text-2xl font-black text-slate-800 tabular-nums">{totalScore}</span>
      </div>

      {/* Timer bar */}
      <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
        <div className="h-2.5 rounded-full transition-none" style={{ width: `${pct * 100}%`, background: barColor }} />
      </div>
      <div className="flex justify-between px-0.5">
        <span className="text-xs text-slate-400">{Math.ceil(timeLeft / 1000)} s</span>
        <span className={`text-xs font-bold uppercase tracking-wide ${
          gamePhase === "sprint" ? "text-amber-600 animate-pulse" : "text-slate-400"
        }`}>
          {gamePhase === "sprint" ? "🏁 Sprint!" : "Překážky"}
        </span>
      </div>

      {/* ── Fáze 1: Překážky ── */}
      {gamePhase === "obstacle" && (
        <div className="space-y-3">
          {/* Prompt area */}
          <div className={`min-h-[72px] flex flex-col items-center justify-center rounded-2xl transition-colors ${
            obstFeedback === "hit"  ? "bg-green-50 ring-2 ring-green-400"  :
            obstFeedback === "miss" ? "bg-red-50 ring-2 ring-red-400"      :
            promptActive            ? "bg-indigo-50 ring-2 ring-indigo-300" :
                                      "bg-slate-50"
          }`}>
            {obstFeedback === "hit"  && <p className="text-4xl font-black text-green-500">✓</p>}
            {obstFeedback === "miss" && <p className="text-4xl font-black text-red-500">✗</p>}
            {!obstFeedback && promptActive && prompt && (
              <>
                <p className="text-3xl font-black text-indigo-700">{prompt}</p>
                <p className="text-sm font-bold text-indigo-600 mt-0.5">{OBSTACLE_LABELS[prompt]}</p>
              </>
            )}
            {!obstFeedback && !promptActive && (
              <p className="text-xs text-slate-400">Připrav se…</p>
            )}
          </div>

          {/* Tlačítka: ← ↑ → */}
          <div className="grid grid-cols-3 gap-2">
            {(["←", "↑", "→"] as ObstacleKey[]).map(k => (
              <button
                key={k}
                onClick={() => handleObstacleInput(k)}
                disabled={!promptActive || obstFeedback !== null}
                className={`rounded-xl py-4 text-2xl font-black transition-all select-none ${
                  promptActive && obstFeedback === null && prompt === k
                    ? "bg-indigo-600 text-white shadow-lg ring-2 ring-indigo-400 scale-105"
                    : "bg-slate-100 text-slate-400 hover:bg-slate-200 disabled:opacity-30"
                }`}
              >
                {k}
              </button>
            ))}
          </div>
          <p className="text-center text-xs text-slate-400">← ↑ → klávesy nebo tlačítka</p>
        </div>
      )}

      {/* ── Fáze 2: Sprint ── */}
      {gamePhase === "sprint" && (
        <div className="space-y-3">
          <div className={`h-12 flex items-center justify-center rounded-2xl transition-colors ${
            sprintFlash ? "bg-amber-100" : "bg-slate-50"
          }`}>
            <p className="text-sm font-bold text-slate-600">
              Střídej:{" "}
              <span className="text-amber-600 font-black tracking-widest">← →</span>
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {(["←", "→"] as SprintKey[]).map(k => (
              <button
                key={k}
                onClick={() => handleSprintInput(k)}
                className={`rounded-xl py-5 text-3xl font-black transition-all select-none ${
                  expectedSprintKey === k
                    ? "bg-amber-500 text-white shadow-lg ring-2 ring-amber-300 scale-105"
                    : expectedSprintKey === null
                    ? "bg-slate-200 text-slate-600 hover:bg-amber-100"
                    : "bg-slate-100 text-slate-400 hover:bg-slate-200"
                }`}
              >
                {k}
              </button>
            ))}
          </div>
          <div className="flex justify-between items-center text-xs px-1">
            <span className="text-slate-400">← → klávesy</span>
            <span className="font-bold text-amber-600">{sprintScore} finišů</span>
          </div>
        </div>
      )}

      {/* Stamina */}
      <div className={`space-y-1 rounded-xl px-2 py-1.5 ${burnedOut ? "bg-red-50" : ""}`}>
        <div className="flex items-center justify-between text-xs px-0.5">
          <span className={burnedOut ? "text-red-500 font-semibold" : liveStamina < 30 ? "text-amber-500 font-semibold" : "text-slate-500"}>
            {burnedOut ? "💀 Kůň vyčerpán — bude vyřazen" : liveStamina < 30 ? "⚠️ Kritická stamina!" : "Stamina"}
          </span>
          <span className={burnedOut ? "text-red-500 font-semibold" : liveStamina < 30 ? "text-amber-500 font-semibold" : "text-slate-400"}>
            {liveStamina}/100
          </span>
        </div>
        <StaminaBar value={liveStamina} />
        {liveStamina > 0 && liveStamina < 30 && (
          <p className="text-center text-xs font-semibold text-amber-500 animate-pulse">
            Zpomal, nebo přijdeš o koně!
          </p>
        )}
      </div>
    </div>
  );
}
