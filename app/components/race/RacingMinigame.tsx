"use client";

/**
 * RacingMinigame — izolovaná gameplay vrstva závodní minihry.
 *
 * Kontrakt s boardem:
 *   Board předá MinigameProps (kdo závodí, počáteční stamina, timing).
 *   Minihra vrátí MinigameResult přes onSubmit (score + finalStamina).
 *
 * Board neví nic o tom, jak minihra funguje uvnitř.
 * Minihra neví nic o DB, fázích závodu ani odměnách.
 *
 * Výměna minihry v budoucnu = jen tato komponenta, kontrakt zůstane.
 */

import React from "react";
import type { Player, Horse } from "@/lib/types/game";
import { STAMINA_PER_TAP } from "@/lib/types/game";

// ── Kontrakt ───────────────────────────────────────────────────────────────────

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

// ── Sdílené UI ─────────────────────────────────────────────────────────────────

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

// ── Gameplay konstanty ────────────────────────────────────────────────────────

export const RACE_DURATION_MS = 10000;

const RACE_KEYS = ["←", "→", "↑", "↓"] as const;
type RaceKey = typeof RACE_KEYS[number];

const KEY_CODE_MAP: Record<string, RaceKey> = {
  ArrowLeft: "←", ArrowRight: "→", ArrowUp: "↑", ArrowDown: "↓",
};

const KEY_LABELS: Record<RaceKey, string> = {
  "↑": "Sprint!",
  "↓": "Přeskok!",
  "←": "Zatáčka vlevo!",
  "→": "Zatáčka vpravo!",
};

function randomKey(exclude?: RaceKey): RaceKey {
  const pool = RACE_KEYS.filter(k => k !== exclude) as RaceKey[];
  return pool[Math.floor(Math.random() * pool.length)];
}

// ── Komponenta ────────────────────────────────────────────────────────────────

export default function RacingMinigame({
  racingPlayer,
  racingHorse,
  isMyTurn,
  currentIdx,
  totalRacers,
  initialStamina,
  onSubmit,
}: MinigameProps) {
  const [timeLeft, setTimeLeft] = React.useState(RACE_DURATION_MS);
  const [inputs, setInputs] = React.useState(0);              // celkem stisků → stamina drain
  const [score, setScore] = React.useState(0);                // čistý výsledek (správné − špatné, ≥0)
  const [targetKey, setTargetKey] = React.useState<RaceKey>(() => randomKey());
  const [pressesOnTarget, setPressesOnTarget] = React.useState(0); // kolik stisků na aktuálním cíli
  const [lastResult, setLastResult] = React.useState<"+1" | "−1" | null>(null);
  const submittedRef = React.useRef(false);

  // liveStamina odvozena od počtu stisků — žádný extra state
  const liveStamina = Math.max(0, initialStamina - inputs * STAMINA_PER_TAP);
  const burnedOut = liveStamina === 0;

  const submit = React.useCallback((finalScore: number, totalInputs: number) => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    const finalStamina = Math.max(0, initialStamina - totalInputs * STAMINA_PER_TAP);
    onSubmit({ score: finalScore, finalStamina });
  }, [onSubmit, initialStamina]);

  // Odpočet každých 100 ms
  React.useEffect(() => {
    const interval = setInterval(() => setTimeLeft(prev => Math.max(0, prev - 100)), 100);
    return () => clearInterval(interval);
  }, []);

  // Auto-submit při vypršení času
  React.useEffect(() => {
    if (timeLeft === 0) submit(score, inputs);
  }, [timeLeft, score, inputs, submit]);

  // Auto-rotace cíle každé 2 s — hráč nemůže čekat věčně
  React.useEffect(() => {
    if (!isMyTurn) return;
    const interval = setInterval(() => {
      if (!submittedRef.current) {
        setTargetKey(prev => randomKey(prev));
        setPressesOnTarget(0);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [isMyTurn]);

  // Input: správná klávesa +1, špatná −1 (min 0); cíl se mění po každém 2. stisku
  const handleInput = (pressedKey: RaceKey) => {
    if (!isMyTurn || submittedRef.current || timeLeft === 0) return;
    const correct = pressedKey === targetKey;
    setInputs(i => i + 1);
    setScore(s => correct ? s + 1 : Math.max(0, s - 1));
    setLastResult(correct ? "+1" : "−1");
    setTimeout(() => setLastResult(null), 300);
    setPressesOnTarget(prev => {
      const next = prev + 1;
      if (next >= 2) {
        setTargetKey(k => randomKey(k));
        return 0;
      }
      return next;
    });
  };

  // Klávesnice: šipkové klávesy — jen aktivní závodník
  React.useEffect(() => {
    if (!isMyTurn) return;
    const onKey = (e: KeyboardEvent) => {
      const mapped = KEY_CODE_MAP[e.code];
      if (mapped && !submittedRef.current && timeLeft > 0) {
        e.preventDefault();
        handleInput(mapped);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMyTurn, targetKey, timeLeft]); // targetKey: čerstvý správný cíl při každém re-renderu

  const pct = timeLeft / RACE_DURATION_MS;
  const barColor = pct > 0.5 ? "#22c55e" : pct > 0.25 ? "#f59e0b" : "#ef4444";

  // Čekání na jiného závodníka — view beze změny
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

  // Aktivní minihra
  const btnClass = (k: RaceKey) =>
    `rounded-xl py-4 text-2xl font-black transition-all select-none disabled:opacity-40 ${
      targetKey === k
        ? "bg-indigo-600 text-white shadow-lg ring-2 ring-indigo-400 ring-offset-1 scale-105"
        : "bg-slate-100 text-slate-400 hover:bg-slate-200"
    }`;

  return (
    <div className="space-y-3">
      <div className="text-center">
        <span className="text-3xl">{racingHorse?.emoji ?? "🏇"}</span>
        <p className="text-sm font-semibold text-slate-700 mt-1">{racingHorse?.name ?? "Závodník"}</p>
      </div>

      {/* Timer bar */}
      <div className="h-3 w-full rounded-full bg-slate-100 overflow-hidden">
        <div className="h-3 rounded-full transition-none" style={{ width: `${pct * 100}%`, background: barColor }} />
      </div>

      {/* Čas + skóre + feedback badge */}
      <div className="flex items-center justify-between px-1">
        <span className="text-sm text-slate-500">{Math.ceil(timeLeft / 1000)} s</span>
        <div className="flex items-center gap-2">
          {lastResult && (
            <span className={`text-sm font-bold ${lastResult === "+1" ? "text-green-500" : "text-red-500"}`}>
              {lastResult}
            </span>
          )}
          <span className="text-3xl font-black text-slate-800 tabular-nums">{score}</span>
        </div>
      </div>

      {/* Akční prompt — textový label aktuálního cíle */}
      <p className="text-center text-base font-bold text-indigo-600 tracking-wide">
        {KEY_LABELS[targetKey]}
      </p>

      {/* Směrové tlačítka: kříž ↑ / ← → / ↓ */}
      <div className="grid grid-cols-3 gap-2">
        <div />
        <button onClick={() => handleInput("↑")} disabled={timeLeft === 0} className={btnClass("↑")}>↑</button>
        <div />
        <button onClick={() => handleInput("←")} disabled={timeLeft === 0} className={btnClass("←")}>←</button>
        <div />
        <button onClick={() => handleInput("→")} disabled={timeLeft === 0} className={btnClass("→")}>→</button>
        <div />
        <button onClick={() => handleInput("↓")} disabled={timeLeft === 0} className={btnClass("↓")}>↓</button>
        <div />
      </div>

      {/* Live stamina + varování */}
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

      <p className="text-center text-xs text-slate-400">šipkové klávesy nebo tlačítka</p>
    </div>
  );
}
