import type { Player } from "@/lib/types/game";
import { isBankrupt } from "@/lib/engine";
import { computeMatchTitles } from "@/lib/match-titles";
import ScoreTable from "../ScoreTable";
import type { ScenarioDefinition } from "@/lib/scenarios";
import {
  getPersonalObjectiveForPlayer,
  evaluateObjectiveForPlayer,
  evaluateSharedObjectiveForPlayers,
} from "@/lib/scenarios";
import ObjectiveResultPanel from "./ObjectiveResultPanel";
import { getObjectiveRewardConfig, XP_OBJECTIVE } from "@/lib/scenarios/objective-rewards";
import GameFinishedAudio from "./GameFinishedAudio";
import GuestFinishedPrompt from "./GuestFinishedPrompt";

const BUST_LINES = [
  "Mafii se dluhy musí splácet. Bohužel jsi neměl už z čeho.",
  "Sázky nevyšly. Zůstaly jen dluhy a prázdná stáj.",
  "Věřitelé byli rychlejší než tvůj další tah.",
  "Když dojdou peníze, dojdou i přátelé.",
  "Tvůj závod skončil dřív, než ses dostal do cíle.",
];

interface GameFinishedScreenProps {
  players: Player[];
  bustOrder: string[];
  pageBackground: string;
  myPlayerId?: string | null;
  gameMode?: "online" | "local";
  scenario?: ScenarioDefinition | null;
  /** XP odměna za tuto hru — zobrazí se u řádku XP za výhru/účast, pokud je k dispozici. */
  xpReward?: number;
  /** Které sdílené objectives byly vyplaceny v průběhu hry (in-game coins). */
  objectiveAwardedIds?: string[];
  /** Kdo vyhrál daný sdílený objective — key: objectiveId, value: playerId. */
  objectiveCompletedBy?: Record<string, string>;
}

export default function GameFinishedScreen({
  players,
  bustOrder,
  pageBackground,
  myPlayerId = null,
  gameMode = "local",
  scenario = null,
  xpReward,
  objectiveAwardedIds,
  objectiveCompletedBy,
}: GameFinishedScreenProps) {
  const winner = players.find(p => !isBankrupt(p));
  const losers = players.filter(p => isBankrupt(p));
  const isSoloLoss = players.length === 1 && !winner;
  const matchTitles = players.length >= 2 ? computeMatchTitles(players, bustOrder) : undefined;

  // Personalization — jen pro online hráče s identitou
  const isPersonalized = !!myPlayerId && gameMode === "online";
  const iWon = isPersonalized && winner?.id === myPlayerId;
  const winnerIsBot = !!winner?.is_bot;
  const myPlayer = isPersonalized ? (players.find(p => p.id === myPlayerId) ?? null) : null;
  const isGuest = !!myPlayer && !myPlayer.discord_id && !myPlayer.is_bot;

  // Objective evaluation — čistě odvozené, žádný state
  const isLocalGame = gameMode === "local";
  const personalObjective =
    scenario && !isLocalGame && myPlayer
      ? getPersonalObjectiveForPlayer(scenario, myPlayer)
      : null;
  const personalResult =
    personalObjective?.condition && myPlayer
      ? evaluateObjectiveForPlayer(personalObjective, myPlayer)
      : null;

  const sharedObjectiveDef = scenario?.sharedObjectives?.[0] ?? null;
  const sharedResults =
    scenario && isLocalGame && sharedObjectiveDef?.condition
      ? evaluateSharedObjectiveForPlayers(scenario, players, { players })
      : [];
  const sharedWinner = sharedResults.find((r) => r.completed) ?? null;
  const sharedWinnerName = sharedWinner
    ? (players.find((p) => p.id === sharedWinner.playerId)?.name ?? "—")
    : null;

  // Shared objective reward — z game_state (kdo vyhrál in-game reward)
  const sharedObjId = sharedObjectiveDef?.id ?? null;
  const sharedObjWasAwarded = sharedObjId ? (objectiveAwardedIds ?? []).includes(sharedObjId) : false;
  const sharedObjWinnerPlayerId = sharedObjId ? (objectiveCompletedBy?.[sharedObjId] ?? null) : null;
  const sharedObjWinnerName = sharedObjWinnerPlayerId
    ? (players.find(p => p.id === sharedObjWinnerPlayerId)?.name ?? null)
    : sharedWinnerName;
  const sharedObjRewardCfg = sharedObjId ? getObjectiveRewardConfig(sharedObjId) : null;
  const sharedObjInGameCoins = sharedObjWasAwarded && sharedObjRewardCfg ? sharedObjRewardCfg.inGameCoins : undefined;
  // Win star eligibility — stejná logika jako awardWinStarAction
  const humanPlayers = players.filter(p => !p.is_bot && p.discord_id);

  const sharedObjXpNote = sharedObjWasAwarded && sharedObjRewardCfg
    ? (humanPlayers.length >= 2
        ? `⭐ +${XP_OBJECTIVE} XP do profilu (hráno s živými hráči)`
        : `⭐ XP do profilu pouze ve hře s živými hráči`)
    : null;
  const isWinStarEligible = humanPlayers.length >= 2 && !!winner?.discord_id && !winner.is_bot;

  // Moje pořadí — řazení identické se ScoreTable
  const sortedIds = [...players]
    .sort((a, b) => {
      if (!isBankrupt(a) && !isBankrupt(b)) return b.coins - a.coins;
      if (!isBankrupt(a)) return -1;
      if (!isBankrupt(b)) return 1;
      return (bustOrder.indexOf(b.id) ?? -1) - (bustOrder.indexOf(a.id) ?? -1);
    })
    .map(p => p.id);
  const myRankIndex = myPlayerId ? sortedIds.indexOf(myPlayerId) : -1;
  const myRank = myRankIndex >= 0 ? myRankIndex + 1 : null;

  const bustLine = (playerId: string) => {
    const idx = bustOrder.indexOf(playerId);
    return BUST_LINES[(idx >= 0 ? idx : 0) % BUST_LINES.length];
  };

  const sortedLosers = [...losers].sort((a, b) => {
    const ia = bustOrder.indexOf(a.id);
    const ib = bustOrder.indexOf(b.id);
    return ib - ia;
  });

  return (
    <div className={`min-h-screen ${pageBackground} flex items-center justify-center p-6`}>
      <GameFinishedAudio />
      <div
        className="relative w-full max-w-md border-2 border-stone-500 shadow-2xl overflow-hidden"
        style={{ backgroundImage: "url('/new_end_backgroud.webp')", backgroundSize: "contain", backgroundPosition: "top center", backgroundRepeat: "no-repeat", backgroundColor: "#f4efe4" }}
      >
        {/* Aged-paper overlay pro čitelnost */}
        <div className="absolute inset-0 bg-[#f4efe4]/82 z-0" />

        <div className="relative z-10">

          {/* ── Novinový masthead — top spacing odpovídá výšce dekorace v pozadí ── */}
          <div className="px-[18%] pt-16 pb-4 text-center">
            <div className="text-[9px] font-bold uppercase tracking-[0.35em] text-stone-600 opacity-30">
              Pay to Win Gazette · Mimořádné vydání
            </div>
          </div>

          {isSoloLoss ? (
            /* ── Solo prohra ── */
            <>
              <div className="px-[18%] py-8 text-center border-b border-stone-500">
                <div className="text-5xl">💀</div>
                <div className="mt-3 text-[9px] font-bold uppercase tracking-[0.22em] text-stone-700">Tréninková zpráva</div>
                <h2 className="mt-1 font-serif text-2xl font-black text-stone-900">Zkrachoval jsi</h2>
                <p className="mt-1 text-xs italic text-stone-600">Tréninková hra skončila porážkou.</p>
              </div>
              {isPersonalized && (
                <div className="px-[18%] py-3 border-b border-stone-400 bg-stone-50/60">
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-600">
                    <span className="text-amber-500">⚡</span> XP za účast
                  </span>
                </div>
              )}
            </>
          ) : (
            <>
              {/* ── Hero blok — 4 stavy ── */}
              {iWon ? (
                <div className="px-[18%] py-7 border-b border-stone-500 bg-amber-50/70">
                  <div className="text-[9px] font-bold uppercase tracking-[0.22em] text-amber-700">Vítěz sezóny</div>
                  <h2 className="mt-2 font-serif text-[36px] font-black leading-tight text-amber-800">
                    🏆 Vyhrál jsi
                  </h2>
                  <p className="mt-2 text-xs italic text-stone-600">
                    Tvoje stáj ovládla závodní sezónu.
                  </p>
                </div>
              ) : isPersonalized && winnerIsBot ? (
                <div className="px-[18%] py-6 border-b border-stone-500">
                  <div className="text-[9px] font-bold uppercase tracking-[0.22em] text-stone-700">Výsledek kola</div>
                  <h2 className="mt-2 font-serif text-[28px] font-black leading-tight text-stone-700">
                    🤖 Vyhrál bot
                  </h2>
                  <p className="mt-2 text-xs italic text-stone-600">
                    Tréninkový soupeř byl tentokrát rychlejší.
                  </p>
                </div>
              ) : isPersonalized ? (
                <div className="px-[18%] py-6 border-b border-stone-500">
                  <div className="text-[9px] font-bold uppercase tracking-[0.22em] text-stone-700">Konečné výsledky</div>
                  <h2 className="mt-2 font-serif text-[28px] font-black leading-tight text-stone-900 break-words">
                    {winner?.name ?? "—"}
                  </h2>
                  <p className="mt-2 text-xs italic text-stone-600">Vyhrál závod bez dluhů.</p>
                  {myRank !== null && (
                    <p className="mt-2 text-xs font-medium text-stone-700">
                      Tvoje místo: {myRank}.{myPlayer && isBankrupt(myPlayer) ? " — zkrachoval jsi" : ""}
                    </p>
                  )}
                </div>
              ) : (
                /* Local / spectator — obecný newspaper styl */
                <div className="px-[18%] py-6 border-b border-stone-500 bg-amber-50/40">
                  <div className="text-[9px] font-bold uppercase tracking-[0.22em] text-amber-700">🏆 Vítěz sezóny</div>
                  <h2 className="mt-2 font-serif text-[30px] font-black leading-tight text-stone-900 break-words">
                    {winner?.name ?? "—"}
                  </h2>
                  <p className="mt-2 text-xs italic text-stone-600">
                    Poslední závodník bez dluhů.
                  </p>
                  {winner && (
                    <p className="mt-2 text-xs font-medium text-stone-600">
                      💰 Konečný zůstatek: <span className="font-bold text-amber-700">{winner.coins.toLocaleString("cs-CZ")}</span>
                    </p>
                  )}
                </div>
              )}

              {/* ── Reward box — jen pro online hráče s identitou ── */}
              {isPersonalized && (
                <div className="px-[18%] py-4 border-b border-stone-400 bg-stone-50/60 space-y-2.5">
                  {iWon ? (
                    <>
                      <div className="flex items-center justify-between text-xs font-medium text-stone-700">
                        <span className="flex items-center gap-1.5"><span className="text-amber-500">⚡</span> XP za výhru</span>
                        {xpReward !== undefined && (
                          <span className="font-bold text-amber-600">+{xpReward} XP</span>
                        )}
                      </div>
                      {isWinStarEligible ? (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700">
                            <span>⭐</span> Výherní hvězda
                          </div>
                          <span className="rounded-full bg-amber-200 px-2.5 py-0.5 text-[11px] font-black text-amber-800">+1</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-xs text-stone-600 italic">
                          <span>⭐</span> Výherní hvězdy se počítají jen za hry proti reálným hráčům
                        </div>
                      )}
                      {winner && (
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-stone-600">💰 Konečný zůstatek</span>
                          <span className="font-semibold text-emerald-700">{winner.coins.toLocaleString("cs-CZ")}</span>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="flex items-center justify-between text-xs font-medium text-stone-600">
                        <span className="flex items-center gap-1.5"><span className="text-amber-500">⚡</span> XP za účast</span>
                        {xpReward !== undefined && (
                          <span className="font-bold text-stone-700">+{xpReward} XP</span>
                        )}
                      </div>
                      {!isWinStarEligible && (
                        <div className="flex items-center gap-1.5 text-xs text-stone-600 italic">
                          <span>⭐</span> Výherní hvězdy se počítají jen za hry proti reálným hráčům
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* ── Výsledek osobního kontraktu (online) ── */}
              {personalResult && personalObjective && (
                <ObjectiveResultPanel
                  mode="personal"
                  objectiveTitle={personalObjective.title}
                  objectiveTask={personalObjective.task}
                  completed={personalResult.completed}
                  reason={personalResult.reason}
                  rewardLabel={personalResult.rewardLabel}
                />
              )}

              {/* ── Výsledek společného kontraktu ── */}
              {sharedObjectiveDef && sharedObjectiveDef.condition && (isLocalGame || sharedObjWasAwarded) && (
                <ObjectiveResultPanel
                  mode="shared"
                  objectiveTitle={sharedObjectiveDef.title}
                  objectiveTask={sharedObjectiveDef.task}
                  completed={isLocalGame ? (sharedWinner !== null) : sharedObjWasAwarded}
                  reason={
                    isLocalGame
                      ? (sharedWinner !== null ? (sharedResults.find(r => r.completed)?.reason ?? "") : "Žádný hráč podmínku nesplnil.")
                      : (sharedObjWasAwarded ? `${sharedObjWinnerName ?? "Hráč"} splnil podmínku jako první v průběhu hry.` : "Podmínka nebyla splněna.")
                  }
                  rewardLabel={sharedObjectiveDef.rewardLabel}
                  winnerName={sharedObjWasAwarded ? sharedObjWinnerName : sharedWinnerName}
                  inGameCoinsRewarded={sharedObjInGameCoins}
                  profileXpNote={sharedObjXpNote}
                />
              )}

              {/* ── Konečné pořadí ── */}
              <div className="px-[18%] py-4 border-b border-stone-500 bg-[#f4efe4]/60">
                <div className="mb-2 text-[9px] font-bold uppercase tracking-[0.22em] text-stone-700">Konečné pořadí</div>
                <ScoreTable players={players} bustOrder={bustOrder} titles={matchTitles} />
              </div>

              {/* ── Padlí závodníci ── */}
              {sortedLosers.length > 0 && (
                <div className="px-[18%] py-4 border-b border-stone-500 bg-[#f4efe4]/70">
                  <div className="mb-2 text-[9px] font-bold uppercase tracking-[0.22em] text-stone-700">Padlí závodníci</div>
                  <div className="space-y-2.5">
                    {sortedLosers.map(p => (
                      <div key={p.id}>
                        <div className="text-xs font-bold text-stone-800 leading-snug break-words">💀 {p.name}</div>
                        <div className="mt-0.5 text-xs italic text-stone-600 leading-snug">{bustLine(p.id)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {isGuest && <GuestFinishedPrompt />}

          <div className="px-[18%] py-4 flex justify-center">
            <a href="/" className="border-2 border-stone-800 px-8 py-2.5 text-center text-sm font-bold tracking-wide text-stone-800 hover:bg-stone-100 active:scale-[0.98] transition">
              ← Nová hra
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
