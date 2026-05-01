"use client";

import React from "react";
import type { Field } from "@/lib/engine";
import type { Player, Horse, GameState } from "@/lib/types/game";
import type { GameCard } from "@/lib/cards";
import type { Theme } from "@/lib/themes";
import { UI_TEXT } from "@/lib/ui-text";
import type { SoundId } from "@/lib/audio/sfx";
import type { MinigameResult as StableMinigameResult } from "@/lib/minigames/types";
import DevRaceBoardLayer from "../DevRaceBoardLayer";
import StableDuelBoardLayer, { type DuelContestant } from "../StableDuelBoardLayer";
import DevRaceFlipLayer from "../DevRaceFlipLayer";
import PlayerList from "./PlayerList";

const DICE_DOTS: [number, number][][] = [
  [[50, 50]],
  [[28, 28], [72, 72]],
  [[28, 28], [50, 50], [72, 72]],
  [[28, 28], [72, 28], [28, 72], [72, 72]],
  [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
  [[28, 28], [72, 28], [28, 50], [72, 50], [28, 72], [72, 72]],
];

function DiceFace({ value, size = 80, rolling = false }: { value: number | null; size?: number; rolling?: boolean }) {
  if (value === null) {
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

interface Props {
  theme: Theme;
  players: Player[];
  gameState: GameState | null;
  currentPlayer: Player | null;
  soundEnabled: boolean;
  toggleSound: () => void;
  shouldShowRacerGuide: boolean;
  shouldShowStaminaGuide: boolean;
  shouldShowPreferredGuide: boolean;
  dismissRacerGuide: () => void;
  dismissStaminaGuide: () => void;
  dismissPreferredGuide: () => void;
  isRolling: boolean;
  isMoving: boolean;
  displayRoll: number | null;
  hasPendingRollDecision: boolean;
  bankruptWarning: { playerName: string; horses: Horse[]; totalSellValue: number; willSurvive: boolean } | null;
  bankruptWarningResolverRef: React.MutableRefObject<((sellAll: boolean) => void) | null>;
  pendingCard: { card: GameCard; playerIndex: number } | null;
  pendingRacer: { racer: Horse; playerIndex: number } | null;
  pendingRollDecision: { baseRoll: number; basePosition: number } | null;
  isMyTurn: boolean;
  isMyPendingRollDecisionTurn: boolean;
  rollDecisionOptions: Array<{ adjustment: -1 | 0 | 1; finalRoll: number; cost: number; isDisabled: boolean; targetField: Field | null }>;
  rollDecisionCountdown: number | null;
  resolveRollDecision: (adjustment: -1 | 0 | 1) => void;
  isFieldVisible: (field: { index: number; type: string }) => boolean;
  isSpectator: boolean;
  iAmBankrupt: boolean;
  canReroll: boolean;
  gameCode: string | undefined;
  rollDice: () => void;
  buyRacer: () => void;
  skipRacer: () => void;
  setPreferredRacer: (playerId: string, key: string | null) => void;
  sellRacerToBank: (player: Player, horse: Horse) => void;
  myPlayerId: string | null;
  myDiscordAvatar: string | null;
  isLocalGame: boolean;
  viewerRole: string;
  hoveredPlayerId: string | null;
  setHoveredPlayerId: (id: string | null) => void;
  playSfx: (id: SoundId) => void;
  FIELDS: Field[];
  gameId: string | null;
  themeId: string;
  minigameBgUrl: string;
  stableDuelCtx: {
    challenger: DuelContestant;
    defender: DuelContestant;
    isPreview: boolean;
    challengerId?: string;
    defenderId?: string;
    duelRole?: "challenger_authority" | "defender_remote";
    duelId?: string;
    sharedCountdownEndsAt?: number;
  } | null;
  handleStableDuelFinish: (result: StableMinigameResult) => void;
  devRaceBoardLayer: boolean;
  setDevRaceBoardLayer: (v: boolean) => void;
  devFlipOpen: boolean;
  closeDevFlip: () => void;
}

export default function GamePanel({
  theme,
  players,
  gameState,
  currentPlayer,
  soundEnabled,
  toggleSound,
  shouldShowRacerGuide,
  shouldShowStaminaGuide,
  shouldShowPreferredGuide,
  dismissRacerGuide,
  dismissStaminaGuide,
  dismissPreferredGuide,
  isRolling,
  isMoving,
  displayRoll,
  hasPendingRollDecision,
  bankruptWarning,
  bankruptWarningResolverRef,
  pendingCard,
  pendingRacer,
  pendingRollDecision,
  isMyTurn,
  isMyPendingRollDecisionTurn,
  rollDecisionOptions,
  rollDecisionCountdown,
  resolveRollDecision,
  isFieldVisible,
  isSpectator,
  iAmBankrupt,
  canReroll,
  gameCode,
  rollDice,
  buyRacer,
  skipRacer,
  setPreferredRacer,
  sellRacerToBank,
  myPlayerId,
  myDiscordAvatar,
  isLocalGame,
  viewerRole,
  hoveredPlayerId,
  setHoveredPlayerId,
  playSfx,
  FIELDS,
  gameId,
  themeId,
  minigameBgUrl,
  stableDuelCtx,
  handleStableDuelFinish,
  devRaceBoardLayer,
  setDevRaceBoardLayer,
  devFlipOpen,
  closeDevFlip,
}: Props) {
  return (
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

          <PlayerList
            players={players}
            gameState={gameState}
            theme={theme}
            FIELDS={FIELDS}
            isLocalGame={isLocalGame}
            myPlayerId={myPlayerId}
            myDiscordAvatar={myDiscordAvatar}
            hoveredPlayerId={hoveredPlayerId}
            setHoveredPlayerId={setHoveredPlayerId}
            viewerRole={viewerRole}
            setPreferredRacer={setPreferredRacer}
            sellRacerToBank={sellRacerToBank}
            playSfx={playSfx}
          />


          {/* DEV: Race Board Layer — absolute overlay uvnitř board surface */}
          {process.env.NODE_ENV === "development" && devRaceBoardLayer && (
            <DevRaceBoardLayer
              playerName={players.find(p => p.id === myPlayerId)?.name ?? players[0]?.name ?? "Hráč"}
              playerColor={players.find(p => p.id === myPlayerId)?.color ?? "#64748b"}
              racingEmoji={theme.labels.racingEmoji}
              onExit={() => setDevRaceBoardLayer(false)}
            />
          )}

          {/* Stájový souboj — board overlay (game flow + dev preview) */}
          {stableDuelCtx && (
            <StableDuelBoardLayer
              challenger={stableDuelCtx.challenger}
              defender={stableDuelCtx.defender}
              isDev={stableDuelCtx.isPreview}
              themeId={themeId}
              backgroundUrl={minigameBgUrl || undefined}
              onFinish={handleStableDuelFinish}
              duelRole={stableDuelCtx.duelRole}
              duelId={stableDuelCtx.duelId}
              gameId={gameId ?? undefined}
              challengerId={stableDuelCtx.challengerId}
              defenderId={stableDuelCtx.defenderId}
              useSharedCountdown={!!stableDuelCtx.duelRole}
              sharedCountdownEndsAt={stableDuelCtx.sharedCountdownEndsAt}
              disableManualStart={!!stableDuelCtx.duelRole}
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
  );
}
