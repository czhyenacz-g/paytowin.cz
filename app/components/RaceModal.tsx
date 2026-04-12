"use client";

import React from "react";
import type { RaceOffer, Player } from "@/lib/types/game";

interface Props {
  race: RaceOffer;
  players: Player[];
  /** local=always true; online=myPlayerId === current racer */
  isMyRaceTurn: boolean;
  onSubmitScore: (score: number) => void;
  onClose: () => void;
  isHost: boolean;
}

type LocalPhase = "countdown" | "racing" | "done";

const RACE_DURATION_MS = 5000;

export default function RaceModal({ race, players, isMyRaceTurn, onSubmitScore, onClose, isHost }: Props) {
  const [localPhase, setLocalPhase] = React.useState<LocalPhase>("countdown");
  const [countdown, setCountdown] = React.useState(3);
  const [score, setScore] = React.useState(0);
  const [timeLeft, setTimeLeft] = React.useState(RACE_DURATION_MS);
  const scoreRef = React.useRef(0);
  const onSubmitRef = React.useRef(onSubmitScore);
  React.useEffect(() => { onSubmitRef.current = onSubmitScore; });

  const currentRacerId = race.playerIds[race.currentRacerIndex];
  const currentRacer = players.find(p => p.id === currentRacerId);

  // Reset local state when a new racer starts
  React.useEffect(() => {
    if (!isMyRaceTurn || race.phase !== "racing") return;
    setLocalPhase("countdown");
    setCountdown(3);
    setScore(0);
    scoreRef.current = 0;
    setTimeLeft(RACE_DURATION_MS);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [race.currentRacerIndex]);

  // Countdown 3 → 2 → 1 → Go
  React.useEffect(() => {
    if (!isMyRaceTurn || localPhase !== "countdown") return;
    if (countdown <= 0) {
      setLocalPhase("racing");
      return;
    }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [isMyRaceTurn, localPhase, countdown]);

  // 5 s racing timer
  React.useEffect(() => {
    if (!isMyRaceTurn || localPhase !== "racing") return;
    const interval = setInterval(() => {
      setTimeLeft(t => {
        const next = t - 100;
        if (next <= 0) {
          clearInterval(interval);
          setLocalPhase("done");
          onSubmitRef.current(scoreRef.current);
          return 0;
        }
        return next;
      });
    }, 100);
    return () => clearInterval(interval);
  }, [isMyRaceTurn, localPhase]);

  // A / L keypress
  React.useEffect(() => {
    if (!isMyRaceTurn || localPhase !== "racing") return;
    const handleKey = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === "a" || key === "l") {
        scoreRef.current += 1;
        setScore(s => s + 1);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isMyRaceTurn, localPhase]);

  const handleTap = () => {
    if (localPhase !== "racing") return;
    scoreRef.current += 1;
    setScore(s => s + 1);
  };

  // ── Results phase ─────────────────────────────────────────────────────────────
  if (race.phase === "results") {
    const sortedResults = race.playerIds
      .map(id => ({ player: players.find(p => p.id === id), score: race.scores[id] ?? 0 }))
      .sort((a, b) => b.score - a.score);

    const medals = ["🥇", "🥈", "🥉"];
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
        <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl space-y-4">
          <div className="text-center">
            <div className="text-4xl">🏁</div>
            <h2 className="text-xl font-bold text-slate-800 mt-1">Výsledky závodu</h2>
          </div>
          <div className="space-y-2">
            {sortedResults.map(({ player, score: s }, i) => (
              <div
                key={player?.id ?? i}
                className={`flex items-center justify-between rounded-xl px-4 py-3 ${
                  i === 0
                    ? "bg-amber-100 border-2 border-amber-400"
                    : "bg-slate-50 border border-slate-200"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">{medals[i] ?? `${i + 1}.`}</span>
                  <span className="font-semibold text-slate-800">{player?.name ?? "?"}</span>
                </div>
                <span className="font-bold text-slate-700">
                  {s} <span className="text-xs font-normal text-slate-400">úderů</span>
                </span>
              </div>
            ))}
          </div>
          {isHost ? (
            <button
              onClick={onClose}
              className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 transition"
            >
              Zavřít závod →
            </button>
          ) : (
            <div className="rounded-2xl bg-slate-100 px-4 py-3 text-center text-sm text-slate-400">
              Čeká na hostitele…
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Racing phase — spectator / waiting for my turn ─────────────────────────
  if (!isMyRaceTurn) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
        <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl text-center space-y-4">
          <div className="text-4xl">🏁</div>
          <h2 className="text-xl font-bold text-slate-800">Závod!</h2>
          <p className="text-slate-500 text-sm">
            Závodí:{" "}
            <span className="font-semibold text-slate-800">{currentRacer?.name ?? "?"}</span>
          </p>
          <p className="text-xs text-slate-400">
            {race.currentRacerIndex + 1} / {race.playerIds.length} závodníků
          </p>
          {Object.keys(race.scores).length > 0 && (
            <div className="space-y-1 text-left rounded-xl bg-slate-50 p-3">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                Odjeté
              </div>
              {race.playerIds
                .filter(id => race.scores[id] !== undefined)
                .map(id => {
                  const p = players.find(pl => pl.id === id);
                  return (
                    <div key={id} className="flex justify-between text-sm">
                      <span className="text-slate-700">{p?.name ?? id}</span>
                      <span className="font-bold text-slate-800">{race.scores[id]} úderů</span>
                    </div>
                  );
                })}
            </div>
          )}
          <div className="animate-pulse text-xs text-slate-400">Čekej na svůj tah…</div>
        </div>
      </div>
    );
  }

  // ── My turn — countdown ────────────────────────────────────────────────────
  if (localPhase === "countdown") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
        <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl text-center space-y-4">
          <div className="text-4xl">🏁</div>
          <h2 className="text-xl font-bold text-slate-800">
            {currentRacer?.name ?? "Ty"} závodí!
          </h2>
          <p className="text-sm text-slate-500">Mačkej střídavě A a L (nebo TAP)</p>
          <div className="text-8xl font-black text-slate-900 my-6">
            {countdown > 0 ? countdown : "Jeď!"}
          </div>
          <p className="text-xs text-slate-400">připrav se…</p>
        </div>
      </div>
    );
  }

  // ── My turn — racing ───────────────────────────────────────────────────────
  if (localPhase === "racing") {
    const progressPct = (timeLeft / RACE_DURATION_MS) * 100;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
        <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl text-center space-y-3">
          <div className="text-4xl">🏃</div>
          <h2 className="text-xl font-bold text-slate-800">Jeď!</h2>
          <div className="text-7xl font-black text-slate-900">{score}</div>
          <div className="text-sm text-slate-500 font-semibold">úderů A+L</div>
          <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-400 transition-all duration-100"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="text-xs text-slate-400">{(timeLeft / 1000).toFixed(1)} s zbývá</div>
          <button
            onPointerDown={handleTap}
            className="w-full rounded-2xl bg-amber-500 px-4 py-8 text-2xl font-black text-white active:scale-95 transition-transform select-none"
            style={{ touchAction: "manipulation" }}
          >
            TAP!
          </button>
          <p className="text-xs text-slate-400">nebo mačkej A + L na klávesnici</p>
        </div>
      </div>
    );
  }

  // ── Submitted, waiting for DB update ──────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl text-center space-y-4">
        <div className="text-4xl">⏳</div>
        <h2 className="text-xl font-bold text-slate-800">Hotovo!</h2>
        <div className="text-5xl font-black text-slate-700">{score}</div>
        <div className="text-sm text-slate-500">tvoje skóre</div>
        <div className="animate-pulse text-xs text-slate-400">Čeká na ostatní hráče…</div>
      </div>
    </div>
  );
}
