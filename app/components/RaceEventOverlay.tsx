"use client";

import React from "react";
import { racerOwnershipKey } from "@/lib/engine";
import type { Player, Horse, RacePendingEvent, RaceType } from "@/lib/types/game";
import RacingMinigame, { StaminaBar } from "./race/RacingMinigame";
import type { MinigameResult } from "./race/RacingMinigame";
import { UI_TEXT } from "@/lib/ui-text";

interface RaceResult {
  player: Player | undefined;
  horse: Horse | undefined;
  speed: number;
  score: number;
  effectiveScore: number;
  finalStamina: number;
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
  onSubmitScore: (result: MinigameResult) => void;
  onCloseResult: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Zobrazí obrázek závodníka, nebo emoji jako fallback. */
function RacerThumb({ horse, size = "md" }: { horse: Horse; size?: "sm" | "md" }) {
  if (horse.image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={horse.image}
        alt={horse.name}
        className={size === "sm" ? "h-7 w-7 rounded-lg object-cover bg-slate-100 shrink-0" : "h-10 w-10 rounded-lg object-cover bg-slate-100 shrink-0"}
        onError={(e) => { e.currentTarget.style.display = "none"; }}
      />
    );
  }
  return <span className={size === "sm" ? "text-lg shrink-0" : "text-2xl shrink-0"}>{horse.emoji}</span>;
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
  const labels = UI_TEXT.race.types[event.raceType ?? "mass_race"];

  // Hot-seat handoff: 5s "Připrav se" countdown před závodem každého hráče.
  // Dává čas fyzicky předat zařízení u jednoho počítače. Aktivní jen pro isLocalGame.
  //
  // handoffDoneForIndex: explicitně označuje, pro který currentRacerIndex handoff skončil.
  // Inicializuje se na -1 → minigame se nikdy nezobrazí dřív než handoff skončí
  // (eliminuje race condition kde null initial state probliknul minigame před efektem).
  const currentRacerIndex = event.currentRacerIndex ?? 0;
  const [handoffCountdown,    setHandoffCountdown]    = React.useState<number | null>(null);
  const [handoffDoneForIndex, setHandoffDoneForIndex] = React.useState<number>(-1);

  React.useEffect(() => {
    if (phase !== "racing" || !isLocalGame) {
      setHandoffCountdown(null);
      return;
    }
    setHandoffCountdown(5);
    const timers = [
      setTimeout(() => setHandoffCountdown(4), 1000),
      setTimeout(() => setHandoffCountdown(3), 2000),
      setTimeout(() => setHandoffCountdown(2), 3000),
      setTimeout(() => setHandoffCountdown(1), 4000),
      setTimeout(() => {
        setHandoffCountdown(null);
        setHandoffDoneForIndex(currentRacerIndex); // minigame se odemkne jen pro tohoto hráče
      }, 5000),
    ];
    return () => timers.forEach(clearTimeout);
  // Znovu se spustí při každém novém závodníkovi (currentRacerIndex) i při vstupu do racing fáze
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase === "racing" ? `racing_${currentRacerIndex}` : "not_racing", isLocalGame]);

  // Minigame se zobrazí jen když: online NEBO handoff tohoto závodníka explicitně dokončen
  const showHandoff = isLocalGame && phase === "racing" && handoffDoneForIndex !== currentRacerIndex;
  const showMinigame = !isLocalGame || (phase === "racing" && handoffDoneForIndex === currentRacerIndex);

  // Preferred závodník pro aktuálního výběrčího
  const preferredHorse = selectorPlayer?.horses.find(h => h.isPreferred) ?? null;
  const preferredKey = preferredHorse ? racerOwnershipKey(preferredHorse) : null;

  // Identita rivalů — zobrazí se jako "Hráč A ⚔️ Hráč B" v rivals_race selecting fázi
  const rivals = event.raceType === "rivals_race" && event.playerIds.length === 2
    ? (event.playerIds.map(id => players.find(p => p.id === id)).filter(Boolean) as Player[])
    : null;

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
            <div className="text-4xl">{labels.selectingEmoji}</div>
            <h2 className="text-xl font-bold text-slate-800">{labels.selectingTitle}</h2>
            {rivals ? (
              <p className="text-sm font-semibold text-slate-600">
                {rivals[0].name} <span className="text-slate-300">⚔️</span> {rivals[1].name}
              </p>
            ) : (
              <p className="text-sm text-slate-400">
                {event.currentSelectorIndex + 1} / {event.playerIds.length}
              </p>
            )}
          </div>

          {isMySelectionTurn && selectorPlayer ? (
            <div className="space-y-3">
              <p className="text-center text-sm font-semibold text-slate-700">
                {isLocalGame ? `${selectorPlayer.name}: ` : ""}{labels.selectingPrompt}
              </p>
              {preferredHorse && preferredKey && (
                <div className="space-y-1">
                  <p className="text-center text-xs text-slate-400">{UI_TEXT.race.preferredRacer}</p>
                  <button
                    onClick={() => onSelectRacer(preferredKey)}
                    className="w-full flex items-center gap-3 rounded-2xl border-2 border-yellow-400 bg-yellow-50 px-4 py-3 text-left hover:bg-yellow-100 transition"
                  >
                    <span className="text-yellow-500">⭐</span>
                    <RacerThumb horse={preferredHorse} />
                    <div>
                      <div className="font-semibold text-slate-800">{preferredHorse.name}</div>
                      <div className="text-xs text-slate-400">{UI_TEXT.race.speed} {preferredHorse.speed}</div>
                      <StaminaBar value={preferredHorse.stamina ?? 100} />
                    </div>
                  </button>
                  <p className="text-center text-xs text-slate-300">{UI_TEXT.race.selectOther}</p>
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
                      <RacerThumb horse={horse} />
                      <div>
                        <div className="font-semibold text-slate-800">{horse.name}</div>
                        <div className="text-xs text-slate-400">{UI_TEXT.race.speed} {horse.speed}</div>
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
                {UI_TEXT.race.waitingForSelection}{" "}
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
                        <RacerThumb horse={horse} size="sm" />
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
              {UI_TEXT.race.skipSelection}
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
            <p className="text-sm text-slate-400">{labels.countdownSub}</p>
          </div>
        )}

        {/* ── Minihra — každý hráč závodí 10 s ── */}
        {phase === "racing" && racingPlayer && (
          <div className="space-y-3">
            <div className="text-center space-y-1">
              <h2 className="text-lg font-bold text-slate-800">{labels.racingTitle}</h2>
              <p className="text-sm text-slate-400">
                {(event.currentRacerIndex ?? 0) + 1} / {event.playerIds.length}
              </p>
            </div>

            {/* Hot-seat handoff: "Připrav se" countdown před závodem každého hráče.
                showHandoff garantuje zobrazení od prvního renderu — žádný flash minigame. */}
            {showHandoff ? (
              <div className="text-center space-y-4 py-4">
                <div className="text-5xl">{racingHorse?.emoji ?? "🏇"}</div>
                <p className="text-sm font-semibold text-slate-500 uppercase tracking-widest">
                  {UI_TEXT.race.handoffPrepare}
                </p>
                <p className="text-2xl font-black text-indigo-700">{racingPlayer.name}</p>
                {handoffCountdown !== null ? (
                  <div className="text-8xl font-black text-slate-800 tabular-nums leading-none">
                    {handoffCountdown}
                  </div>
                ) : (
                  <div className="text-2xl font-semibold text-slate-400">…</div>
                )}
                <p className="text-sm text-slate-400">{UI_TEXT.race.handoffInstruction}</p>
              </div>
            ) : showMinigame ? (
              <RacingMinigame
                key={`${currentRacerIndex}_ready`}
                racingPlayer={racingPlayer}
                racingHorse={racingHorse}
                isMyTurn={isMyRacingTurn}
                currentIdx={currentRacerIndex}
                totalRacers={event.playerIds.length}
                initialStamina={racingHorse?.stamina ?? 100}
                onSubmit={onSubmitScore}
              />
            ) : null}
          </div>
        )}

        {/* ── Výsledky závodu ── */}
        {phase === "results" && raceResults && (
          <div className="space-y-4">
            <div className="text-center space-y-1">
              <div className="text-4xl">🏆</div>
              <h2 className="text-xl font-bold text-slate-800">{labels.resultsTitle}</h2>
            </div>
            <div className="space-y-2">
              {raceResults.map(({ player, horse, score, effectiveScore, finalStamina }, idx) => player && horse ? (
                <div
                  key={player.id}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm ${idx === 0 ? "bg-amber-50 border border-amber-300" : "bg-slate-50"}`}
                >
                  <span className="font-bold text-slate-400 w-4">{idx + 1}.</span>
                  <RacerThumb horse={horse} size="sm" />
                  <div className="flex flex-col min-w-0">
                    <span className={`font-medium ${idx === 0 ? "text-amber-800" : "text-slate-700"}`}>
                      {player.name}
                    </span>
                    <span className="text-xs text-slate-400">
                      {score} bodů × {finalStamina}% staminy
                      {finalStamina === 0 && <span className="ml-1 text-red-400">{UI_TEXT.race.racerEliminated}</span>}
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
                {UI_TEXT.race.continueAction}
              </button>
            ) : (
              <div className="rounded-2xl bg-slate-100 px-4 py-3 text-center text-sm text-slate-400">
                {UI_TEXT.race.waitingForHost}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
