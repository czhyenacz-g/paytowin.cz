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
}

export default function GameFinishedScreen({
  players,
  bustOrder,
  pageBackground,
  myPlayerId = null,
  gameMode = "local",
  scenario = null,
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

  // Win star eligibility — stejná logika jako awardWinStarAction
  const humanPlayers = players.filter(p => !p.is_bot && p.discord_id);
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
      <div
        className="relative w-full max-w-md border-2 border-stone-500 shadow-2xl overflow-hidden"
        style={{ backgroundImage: "url('/gazete.webp')", backgroundSize: "cover", backgroundPosition: "top center" }}
      >
        {/* Aged-paper overlay pro čitelnost */}
        <div className="absolute inset-0 bg-[#f4efe4]/82 z-0" />

        <div className="relative z-10">

          {/* ── Novinový masthead ── */}
          <div className="px-6 pt-5 pb-4 border-b-[3px] border-stone-500 text-center">
            <div className="invisible text-[8px] font-bold uppercase tracking-[0.32em] text-stone-500">— Mimořádné vydání —</div>
            <div className="invisible mt-1 font-serif text-[26px] font-black uppercase tracking-[0.12em] text-stone-900 leading-none">Pay to Win Gazette</div>
            <div className="invisible mt-1 text-[8px] uppercase tracking-[0.22em] text-stone-500">Nezávislé noviny ze světa dostihů · Archiv výsledků</div>
          </div>

          {isSoloLoss ? (
            /* ── Solo prohra ── */
            <>
              <div className="px-6 py-8 text-center border-b border-stone-500">
                <div className="text-5xl">💀</div>
                <div className="mt-3 text-[9px] font-bold uppercase tracking-[0.22em] text-stone-500">Tréninková zpráva</div>
                <h2 className="mt-1 font-serif text-2xl font-black text-stone-900">Zkrachoval jsi</h2>
                <p className="mt-1 text-xs italic text-stone-500">Tréninková hra skončila porážkou.</p>
              </div>
              {isPersonalized && (
                <div className="px-6 py-3 border-b border-stone-400 bg-stone-50/60">
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
                <div className="px-6 py-5 border-b border-stone-500 bg-amber-50/70">
                  <div className="text-[9px] font-bold uppercase tracking-[0.22em] text-amber-700">Vítěz sezóny</div>
                  <h2 className="mt-1 font-serif text-[32px] font-black leading-tight text-amber-800">
                    🏆 Vyhrál jsi
                  </h2>
                  <p className="mt-1.5 text-xs italic text-stone-600">
                    Tvoje stáj ovládla závodní sezónu.
                  </p>
                </div>
              ) : isPersonalized && winnerIsBot ? (
                <div className="px-6 py-5 border-b border-stone-500">
                  <div className="text-[9px] font-bold uppercase tracking-[0.22em] text-stone-500">Výsledek kola</div>
                  <h2 className="mt-1 font-serif text-[28px] font-black leading-tight text-stone-700">
                    🤖 Vyhrál bot
                  </h2>
                  <p className="mt-1.5 text-xs italic text-stone-500">
                    Tréninkový soupeř byl tentokrát rychlejší.
                  </p>
                </div>
              ) : isPersonalized ? (
                <div className="px-6 py-5 border-b border-stone-500">
                  <div className="text-[9px] font-bold uppercase tracking-[0.22em] text-stone-500">Konečné výsledky</div>
                  <h2 className="mt-1 font-serif text-[28px] font-black leading-tight text-stone-900">
                    {winner?.name ?? "—"}
                  </h2>
                  <p className="mt-1.5 text-xs italic text-stone-500">Vyhrál závod bez dluhů.</p>
                  {myRank !== null && (
                    <p className="mt-2 text-xs font-medium text-stone-700">
                      Tvoje místo: {myRank}.{myPlayer && isBankrupt(myPlayer) ? " — zkrachoval jsi" : ""}
                    </p>
                  )}
                </div>
              ) : (
                /* Local / spectator — obecný newspaper styl */
                <div className="px-6 py-5 border-b border-stone-500 bg-amber-50/40">
                  <div className="text-[9px] font-bold uppercase tracking-[0.22em] text-amber-700">🏆 Vítěz sezóny</div>
                  <h2 className="mt-1 font-serif text-[30px] font-black leading-tight text-stone-900">
                    {winner?.name ?? "—"}
                  </h2>
                  <p className="mt-1.5 text-xs italic text-stone-500">
                    Poslední závodník bez dluhů.
                  </p>
                  {winner && (
                    <p className="mt-2 text-sm font-bold text-amber-700">
                      💰 {winner.coins.toLocaleString("cs-CZ")} zůstatek
                    </p>
                  )}
                </div>
              )}

              {/* ── Reward box — jen pro online hráče s identitou ── */}
              {isPersonalized && (
                <div className="px-6 py-3 border-b border-stone-400 bg-stone-50/60 space-y-1.5">
                  {iWon ? (
                    <>
                      <div className="flex items-center gap-2 text-xs font-medium text-stone-700">
                        <span className="text-amber-500">⚡</span> XP za výhru
                      </div>
                      {isWinStarEligible ? (
                        <div className="flex items-center gap-2 text-xs font-medium text-amber-700">
                          <span>⭐</span> +1 výherní hvězda
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-xs text-stone-400 italic">
                          <span>⭐</span> Výherní hvězdy se počítají jen za hry proti reálným hráčům
                        </div>
                      )}
                      {winner && (
                        <div className="flex items-center gap-2 text-xs font-medium text-stone-600">
                          <span>💰</span> {winner.coins.toLocaleString("cs-CZ")} zůstatek
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 text-xs font-medium text-stone-600">
                        <span className="text-amber-500">⚡</span> XP za účast
                      </div>
                      {!isWinStarEligible && (
                        <div className="flex items-center gap-2 text-xs text-stone-400 italic">
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

              {/* ── Výsledek společného kontraktu (hotseat) ── */}
              {sharedObjectiveDef && isLocalGame && sharedObjectiveDef.condition && (
                <ObjectiveResultPanel
                  mode="shared"
                  objectiveTitle={sharedObjectiveDef.title}
                  objectiveTask={sharedObjectiveDef.task}
                  completed={sharedWinner !== null}
                  reason={
                    sharedWinner !== null
                      ? (sharedResults.find((r) => r.completed)?.reason ?? "")
                      : "Žádný hráč podmínku nesplnil."
                  }
                  rewardLabel={sharedObjectiveDef.rewardLabel}
                  winnerName={sharedWinnerName}
                />
              )}

              {/* ── Konečné pořadí ── */}
              <div className="px-6 py-4 border-b border-stone-500">
                <div className="mb-2 text-[9px] font-bold uppercase tracking-[0.22em] text-stone-500">Konečné pořadí</div>
                <ScoreTable players={players} bustOrder={bustOrder} titles={matchTitles} />
              </div>

              {/* ── Padlí závodníci ── */}
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

          <div className="px-6 py-5">
            <a href="/" className="block bg-stone-900 px-4 py-3.5 text-center text-sm font-bold tracking-wide text-[#f4efe4] hover:bg-stone-700 active:scale-[0.98] transition">
              ← Nová hra
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
