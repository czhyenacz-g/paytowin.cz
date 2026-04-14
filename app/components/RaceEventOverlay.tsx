"use client";

import React from "react";
import { racerOwnershipKey } from "@/lib/engine";
import { STAMINA_PER_TAP } from "@/lib/types/game";
import type { Player, Horse, RacePendingEvent } from "@/lib/types/game";

interface RaceResult {
  player: Player | undefined;
  horse: Horse | undefined;
  speed: number;
  score: number;
  effectiveScore: number;
  finalStamina: number;
}

// Vizuální bar staminy: zelená > 66, žlutá > 33, červená ≤ 33
function StaminaBar({ value }: { value: number }) {
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

interface RaceEventOverlayProps {
  event: RacePendingEvent;
  players: Player[];
  countdownNum: number | null;
  selectorPlayer: Player | null;
  isMySelectionTurn: boolean;
  racingPlayer: Player | null;
  isMyRacingTurn: boolean;
  raceResults: RaceResult[] | null;
  isHost: boolean;
  isLocalGame: boolean;
  onSelectRacer: (racerKey: string) => void;
  onSkip: () => void;
  onSubmitScore: (score: number, finalStamina: number) => void;
  onCloseResult: () => void;
}

// ── Minihra: 8s reaction pattern ──────────────────────────────────────────────

const RACE_DURATION_MS = 8000;

// Šipky jako cílové klávesy; KEY_CODE_MAP mapuje e.code → symbol
const RACE_KEYS = ["←", "→", "↑", "↓"] as const;
type RaceKey = typeof RACE_KEYS[number];
const KEY_CODE_MAP: Record<string, RaceKey> = {
  ArrowLeft: "←", ArrowRight: "→", ArrowUp: "↑", ArrowDown: "↓",
};
function randomKey(exclude?: RaceKey): RaceKey {
  const pool = RACE_KEYS.filter(k => k !== exclude) as RaceKey[];
  return pool[Math.floor(Math.random() * pool.length)];
}

function RacingMinigame({
  racingPlayer,
  racingHorse,
  isMyTurn,
  currentIdx,
  totalRacers,
  initialStamina,
  onSubmit,
}: {
  racingPlayer: Player;
  racingHorse: Horse | undefined;
  isMyTurn: boolean;
  currentIdx: number;
  totalRacers: number;
  initialStamina: number;
  onSubmit: (score: number, finalStamina: number) => void;
}) {
  const [timeLeft, setTimeLeft] = React.useState(RACE_DURATION_MS);
  const [inputs, setInputs] = React.useState(0);              // celkem stisků → stamina drain
  const [score, setScore] = React.useState(0);                // čistý výsledek (správné − špatné, ≥0)
  const [targetKey, setTargetKey] = React.useState<RaceKey>(() => randomKey());
  const [lastResult, setLastResult] = React.useState<"hit" | "miss" | null>(null);
  const submittedRef = React.useRef(false);

  // liveStamina odvozena od počtu stisků — žádný extra state
  const liveStamina = Math.max(0, initialStamina - inputs * STAMINA_PER_TAP);
  const burnedOut = liveStamina === 0;

  const submit = React.useCallback((finalScore: number, totalInputs: number) => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    const finalStamina = Math.max(0, initialStamina - totalInputs * STAMINA_PER_TAP);
    onSubmit(finalScore, finalStamina);
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
      if (!submittedRef.current) setTargetKey(prev => randomKey(prev));
    }, 2000);
    return () => clearInterval(interval);
  }, [isMyTurn]);

  // Input: správná klávesa +1, špatná −1 (min 0); cíl se vždy změní
  const handleInput = (pressedKey: RaceKey) => {
    if (!isMyTurn || submittedRef.current || timeLeft === 0) return;
    const correct = pressedKey === targetKey;
    setInputs(i => i + 1);
    setScore(s => correct ? s + 1 : Math.max(0, s - 1));
    setTargetKey(prev => randomKey(prev));
    setLastResult(correct ? "hit" : "miss");
    setTimeout(() => setLastResult(null), 300);
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
    `rounded-xl py-4 text-2xl font-black transition-colors select-none disabled:opacity-40 ${
      targetKey === k
        ? "bg-indigo-600 text-white shadow-md"
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

      {/* Čas + skóre */}
      <div className="flex items-center justify-between px-1">
        <span className="text-sm text-slate-500">{Math.ceil(timeLeft / 1000)} s</span>
        <span className={`text-3xl font-black tabular-nums ${
          lastResult === "hit" ? "text-green-500" : lastResult === "miss" ? "text-red-500" : "text-slate-800"
        }`}>{score}</span>
      </div>

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

      {/* Live stamina */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs px-0.5">
          <span className={burnedOut ? "text-red-500 font-semibold" : "text-slate-500"}>
            {burnedOut ? "💀 Kůň vyčerpán — bude vyřazen" : "Stamina"}
          </span>
          <span className={burnedOut ? "text-red-500 font-semibold" : "text-slate-400"}>
            {liveStamina}/100
          </span>
        </div>
        <StaminaBar value={liveStamina} />
      </div>

      <p className="text-center text-xs text-slate-400">šipkové klávesy nebo tlačítka</p>
    </div>
  );
}

// ── Hlavní overlay komponenta ─────────────────────────────────────────────────

export default function RaceEventOverlay({
  event,
  players,
  countdownNum,
  selectorPlayer,
  isMySelectionTurn,
  racingPlayer,
  isMyRacingTurn,
  raceResults,
  isHost,
  isLocalGame,
  onSelectRacer,
  onSkip,
  onSubmitScore,
  onCloseResult,
}: RaceEventOverlayProps) {
  const phase = event.phase;

  // Preferred závodník pro aktuálního výběrčího
  const preferredHorse = selectorPlayer?.horses.find(h => h.isPreferred) ?? null;
  const preferredKey = preferredHorse ? racerOwnershipKey(preferredHorse) : null;

  // Závodníkův kůň v racing fázi
  const racingHorse = racingPlayer
    ? racingPlayer.horses.find(h => racerOwnershipKey(h) === event.selections?.[racingPlayer.id])
    : undefined;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-2xl space-y-5">

        {/* ── Výběr závodníka ── */}
        {(!phase || phase === "selecting") && (<>
          <div className="text-center space-y-1">
            <div className="text-4xl">🏁</div>
            <h2 className="text-xl font-bold text-slate-800">Výběr závodníků</h2>
            <p className="text-sm text-slate-400">
              {event.currentSelectorIndex + 1} / {event.playerIds.length}
            </p>
          </div>

          {isMySelectionTurn && selectorPlayer ? (
            <div className="space-y-3">
              <p className="text-center text-sm font-semibold text-slate-700">
                {isLocalGame ? `${selectorPlayer.name}: ` : ""}Vyber závodníka pro závod
              </p>
              {preferredHorse && preferredKey && (
                <div className="space-y-1">
                  <p className="text-center text-xs text-slate-400">Preferred závodník</p>
                  <button
                    onClick={() => onSelectRacer(preferredKey)}
                    className="w-full flex items-center gap-3 rounded-2xl border-2 border-yellow-400 bg-yellow-50 px-4 py-3 text-left hover:bg-yellow-100 transition"
                  >
                    <span className="text-yellow-500">⭐</span>
                    <span className="text-2xl">{preferredHorse.emoji}</span>
                    <div>
                      <div className="font-semibold text-slate-800">{preferredHorse.name}</div>
                      <div className="text-xs text-slate-400">rychlost {preferredHorse.speed}</div>
                      <StaminaBar value={preferredHorse.stamina ?? 100} />
                    </div>
                  </button>
                  <p className="text-center text-xs text-slate-300">nebo vyber jiného:</p>
                </div>
              )}
              <div className="space-y-2">
                {selectorPlayer.horses.map((horse) => {
                  const key = racerOwnershipKey(horse);
                  return (
                    <button
                      key={key}
                      onClick={() => onSelectRacer(key)}
                      className="w-full flex items-center gap-3 rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 py-3 text-left hover:border-indigo-400 hover:bg-indigo-50 transition"
                    >
                      <span className="text-2xl">{horse.emoji}</span>
                      <div>
                        <div className="font-semibold text-slate-800">{horse.name}</div>
                        <div className="text-xs text-slate-400">rychlost {horse.speed}</div>
                        <StaminaBar value={horse.stamina ?? 100} />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-center text-sm text-slate-500">
                Čeká na výběr:{" "}
                <span className="font-semibold text-slate-700">{selectorPlayer?.name ?? "…"}</span>
              </p>
              {Object.keys(event.selections ?? {}).length > 0 && (
                <div className="space-y-1">
                  {Object.entries(event.selections).map(([pid, rKey]) => {
                    const pl = players.find(p => p.id === pid);
                    const horse = pl?.horses.find(h => racerOwnershipKey(h) === rKey);
                    if (!pl || !horse) return null;
                    return (
                      <div key={pid} className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
                        <span>{horse.emoji}</span>
                        <span className="font-medium">{pl.name}</span>
                        <span className="text-slate-400">→ {horse.name}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {(isHost || isLocalGame) && (
            <button
              onClick={onSkip}
              className="w-full rounded-2xl border border-slate-200 px-4 py-2 text-xs text-slate-400 hover:text-slate-600 transition"
            >
              Přeskočit výběr
            </button>
          )}
        </>)}

        {/* ── Countdown 3–2–1 ── */}
        {phase === "countdown" && (
          <div className="text-center space-y-4 py-4">
            <div className="text-5xl">🏁</div>
            <div className="text-8xl font-black text-slate-800 tabular-nums leading-none">
              {countdownNum ?? "…"}
            </div>
            <p className="text-sm text-slate-400">Závod začíná!</p>
          </div>
        )}

        {/* ── Minihra — každý hráč závodí 5 s ── */}
        {phase === "racing" && racingPlayer && (
          <div className="space-y-3">
            <div className="text-center space-y-1">
              <h2 className="text-lg font-bold text-slate-800">🏇 Závod!</h2>
              <p className="text-sm text-slate-400">
                {(event.currentRacerIndex ?? 0) + 1} / {event.playerIds.length}
              </p>
            </div>
            <RacingMinigame
              key={event.currentRacerIndex ?? 0}
              racingPlayer={racingPlayer}
              racingHorse={racingHorse}
              isMyTurn={isMyRacingTurn}
              currentIdx={event.currentRacerIndex ?? 0}
              totalRacers={event.playerIds.length}
              initialStamina={racingHorse?.stamina ?? 100}
              onSubmit={onSubmitScore}
            />
          </div>
        )}

        {/* ── Výsledky závodu ── */}
        {phase === "results" && raceResults && (
          <div className="space-y-4">
            <div className="text-center space-y-1">
              <div className="text-4xl">🏆</div>
              <h2 className="text-xl font-bold text-slate-800">Výsledky závodu</h2>
            </div>
            <div className="space-y-2">
              {raceResults.map(({ player, horse, score, effectiveScore, finalStamina }, idx) => player && horse ? (
                <div
                  key={player.id}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm ${idx === 0 ? "bg-amber-50 border border-amber-300" : "bg-slate-50"}`}
                >
                  <span className="font-bold text-slate-400 w-4">{idx + 1}.</span>
                  <span className="text-xl">{horse.emoji}</span>
                  <div className="flex flex-col min-w-0">
                    <span className={`font-medium ${idx === 0 ? "text-amber-800" : "text-slate-700"}`}>
                      {player.name}
                    </span>
                    <span className="text-xs text-slate-400">
                      {score} tapů × {finalStamina}%
                      {finalStamina === 0 && <span className="ml-1 text-red-400">💀 kůň vyřazen</span>}
                    </span>
                  </div>
                  <span className={`ml-auto text-sm font-bold tabular-nums ${idx === 0 ? "text-amber-700" : "text-slate-500"}`}>
                    {effectiveScore.toFixed(0)}
                  </span>
                </div>
              ) : null)}
            </div>
            {(isHost || isLocalGame) ? (
              <button
                onClick={onCloseResult}
                className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 transition"
              >
                Pokračovat →
              </button>
            ) : (
              <div className="rounded-2xl bg-slate-100 px-4 py-3 text-center text-sm text-slate-400">
                Čeká na hostitele…
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
