"use client";

import React from "react";
import { supabase } from "@/lib/supabase";
import { getThemeById, getThemeRacers } from "@/lib/themes";
import type { RacerConfig } from "@/lib/themes";
import { resolveRacerRefsAction } from "@/app/admin/racers/actions";
import { themeToManifest } from "@/lib/themes/manifest";
import { loadThemeManifestAsync } from "@/lib/themes/loader";
import { getBoardById } from "@/lib/board";
import { awardXpAction, awardRaceStarAction, awardWinStarAction, awardMoneySpentAction, awardObjectiveXpAction } from "@/app/game/actions";
import { checkSharedObjectiveInGameReward } from "@/lib/scenarios/objective-rewards";
import { STADIUM_ASPECT } from "@/lib/board/constants";
import {
  FIELD_POSITIONS,
  FIELD_POSITIONS_STADIUM,
  FIELD_ROTATIONS_STADIUM,
  FIGURINE_POSITIONS,
  FIGURINE_POSITIONS_STADIUM,
} from "@/lib/board/layout";
import { logEvent } from "@/lib/analytics";
import { buildFogReveal as libBuildFogReveal } from "@/lib/fog";
import { UI_TEXT } from "@/lib/ui-text";
import { applyBoardShuffle } from "@/lib/board/shuffle";
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
  getPreferredHorse,
  normalizeFavoriteHorse,
  computeRent,
  applyRentPayment,
  computeRaceScore,
  applyStartPassage,
  applyStaminaDebuff,
  resolveGiveRacer,
  REROLL_COST,
  REROLL_CHANCE,
  ROLL_CORRECTION_COST,
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
import type { Player, Horse, ActiveEffect, GameState, OfferPending, RerollOffer, RaceOffer, BankruptAnnouncement, RacePendingEvent, StableDuelPendingOffer, PostTurnEvent, RaceType, EconomyConfig, RollAdjustment } from "@/lib/types/game";
import { DEFAULT_ECONOMY } from "@/lib/types/game";
import { resolveYearEvent } from "@/lib/year-events";
import type { CenterEvent, FlashEvent } from "@/lib/types/events";
import { mapToCenterEvent, buildRollDecisionOptions } from "@/lib/game/viewModel";
import { buildRacerOwnership, getDisplayPlayers, computeRaceResultsView } from "@/lib/game/gameBoardViewModel";
import { useGameBoardAudio } from "@/app/components/board/hooks/useGameBoardAudio";
import { useGuideState } from "@/app/components/board/hooks/useGuideState";
import CenterEventModal from "./modals/CenterEventModal";
import FlashToast from "./modals/FlashToast";
import RacerLostModal, { type RacerCategory } from "./modals/RacerLostModal";
import MajorLossOverlay from "./modals/MajorLossOverlay";
import MajorGainOverlay from "./modals/MajorGainOverlay";
import RaceModal from "./RaceModal";
import RaceEventOverlay from "./RaceEventOverlay";
import type { MinigameResult } from "./race/RacingMinigame";
import type { MinigameResult as StableMinigameResult } from "@/lib/minigames/types";
import { computeMinigameSettlement, STABLE_DUEL_APPLY_BOT_STAMINA_LOSS } from "@/lib/minigames/settlement";
import { selectStableMinigame } from "@/lib/minigames/selectStableMinigame";
import BuildInfoBar from "./BuildInfoBar";
import ThemeAssetInspector from "./ThemeAssetInspector";
import DevRaceModeShell from "./DevRaceModeShell";
import DevDuelShell  from "./duel/DuelDevShell";
import SpeedDevShell from "./speed/SpeedDevShell";
import LegendaryRaceDevShell from "./legendary/LegendaryRaceDevShell";
import StableDuelBoardLayer, { type DuelContestant } from "./StableDuelBoardLayer";
import DevToolbar from "./board/DevToolbar";
import { useOnlineBotTrigger } from "./board/hooks/useOnlineBotTrigger";
import FieldCardList from "./board/FieldCardList";
import GamePanel from "./board/GamePanel";
import StableDuelStatusBanners from "./board/StableDuelStatusBanners";
import GameFinishedScreen from "./board/GameFinishedScreen";
import GuestBanner from "./board/GuestBanner";
import IntroOverlay from "./IntroOverlay";
import StartFlowOverlay from "./start-flow/StartFlowOverlay";
import { getScenarioForTheme, evaluateScenarioWinCondition } from "@/lib/scenarios";
import ScoreTable from "./ScoreTable";
import BrandLogo from "./BrandLogo";
import { useOpponentMoneyFeedback } from "@/app/hooks/useOpponentMoneyFeedback";
import BoardCenterPanel from "./center-panel/BoardCenterPanel";
import BankruptAnnouncementModal from "./modals/BankruptAnnouncementModal";
import { AmbientBackground } from "./ui/AmbientBackground";
import { BoardAnimationLayer } from "./board/BoardAnimationLayer";
import { BoardSurface } from "./board/BoardSurface";
import { DEFAULT_STARTING_COINS } from "@/lib/game-constants";
import { getFieldOwner, expireStaleEntries, buildFieldOwnershipPlacement, buildFieldOwnership, applyFieldOwnerPayment } from "@/lib/game/fieldOwnership";

// Styly polí jsou součástí theme systému (lib/themes/*)
// Přistupuj přes: theme.colors.fieldStyles[field.type]

// Pozice polí — 21 bodů rovnoměrně rozmístěných na kružnici r=42 % (center 50 %/50 %).
// Úhel pole i: α = 180° − i × (360°/21), kde 0° = vpravo, 90° = nahoru (CSS y je inverzní).
// Vzorec: left = 50 + 42·cos(α), top = 50 − 42·sin(α).
// Mezera mezi sousedními poli ≈ 24 px (na boardu max-w 760 px) — rovnoměrná po celém okruhu.

// ─── Komponenta ───────────────────────────────────────────────────────────────

interface Props {
  gameCode?: string;
}

interface PendingRollDecision {
  playerId: string;
  playerIndex: number;
  baseRoll: number;
  basePosition: number;
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
  const [discordThreadUrl, setDiscordThreadUrl] = React.useState<string | null>(null);
  const [players, setPlayers] = React.useState<Player[]>([]);
  const [gameState, setGameState] = React.useState<GameState | null>(null);
  const [loading, setLoading] = React.useState(!!gameCode);
  const [pendingRacer, setPendingRacer] = React.useState<{ racer: Horse; playerIndex: number; flavorText?: string } | null>(null);
  const [botRetrySeq, setBotRetrySeq] = React.useState(0);
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
  const [ghostMoveTarget, setGhostMoveTarget] = React.useState<number | null>(null);
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
  // dev-only: Race Mode shell overlay (mimo game state)
  const [devRaceMode, setDevRaceMode] = React.useState(false);
  // dev-only: Race Board layer (vrstva uvnitř boardu)
  const [devRaceBoardLayer, setDevRaceBoardLayer] = React.useState(false);
  // dev-only: Neon Rope Duel harness
  const [devDuelOpen,  setDevDuelOpen]  = React.useState(false);
  // dev-only: Speed Arena harness
  const [devSpeedOpen, setDevSpeedOpen] = React.useState(false);
  // dev-only: Legendary Horse Race harness
  const [devLegendaryOpen, setDevLegendaryOpen] = React.useState(false);
  // dev-only: Race Board Flip layer (flip animace boardu)
  const [devFlipOpen, setDevFlipOpen] = React.useState(false);
  // dev-only: GameFinishedScreen preview s mock daty
  const [devFinaleOpen, setDevFinaleOpen] = React.useState(false);
  const [flipBoardAnim, setFlipBoardAnim] = React.useState<"idle" | "out" | "back-in">("idle");
  const flipTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  // Stájový souboj — board overlay (game flow)
  const [stableDuelCtx, setStableDuelCtx] = React.useState<{ challenger: DuelContestant; defender: DuelContestant; isPreview: boolean; challengerId?: string; defenderId?: string; duelRole?: "challenger_authority" | "defender_remote"; duelId?: string; sharedCountdownEndsAt?: number; mafiaBonus?: number } | null>(null);
  const stableDuelProceedRef = React.useRef<((resultLog?: string[], updatedCurrentPlayerHorses?: import("@/lib/types/game").Horse[]) => Promise<void>) | null>(null);
  const boardSurfaceRef = React.useRef<HTMLDivElement>(null);
  // Idempotency refs pro countdown a overlay — klíčovány identitou duelu
  const countdownStartedRef  = React.useRef<string | null>(null);
  const overlayOpenedRef     = React.useRef<string | null>(null);
  // Guard: createdAt posledního bot-created duelu který jsme zpracovali (proti re-triggeru)
  const botDuelHandledRef    = React.useRef<number | null>(null);
  // Lokální zobrazovací stav countdownu (3/2/1/START) — jen UI, žádný DB zápis
  const [countdownDisplay, setCountdownDisplay] = React.useState<string | null>(null);
  // Dev: přepínač režimu Stable Duel — default pvbot_awareness, opt-in online_1v1
  const [stableDuelMode, setStableDuelMode] = React.useState<"pvbot_awareness" | "online_1v1">(() => {
    if (typeof window !== "undefined") {
      const v = localStorage.getItem("stableDuelMode");
      if (v === "online_1v1") return "online_1v1";
    }
    return "pvbot_awareness";
  });
  const rollDecisionTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const rollDecisionResolvedRef = React.useRef(false);
  const pendingRollResolverRef = React.useRef<((adjustment: RollAdjustment) => void) | null>(null);
  // Refs pro ochranu animace před Realtime přepsáním pozice
  const animatingPlayerIdRef = React.useRef<string | null>(null);
  const animPositionRef = React.useRef<number | null>(null);
  // Předchozí pozice hráčů — pro detekci pohybu soupeřů
  const prevPlayersRef = React.useRef<Player[]>([]);

  const [boardBgUrl, setBoardBgUrl] = React.useState<string>("");
  const [minigameBgUrl, setMinigameBgUrl] = React.useState<string>("");
  /** Závodníci načtení z globální registry (racerRefs flow). Null = použij inline theme racers. */
  const [resolvedRacers, setResolvedRacers] = React.useState<RacerConfig[] | null>(null);
  const [racerLostModal, setRacerLostModal] = React.useState<{ horse: import("@/lib/types/game").Horse; playerName: string; racerCategory: RacerCategory } | null>(null);
  const opponentMoneyEvent = useOpponentMoneyFeedback(players, myPlayerId);
  const [scorePopupOpen, setScorePopupOpen] = React.useState(false);
  const [topPanelVisible, setTopPanelVisible] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    loadThemeManifestAsync(themeId).then(async (manifest) => {
      if (cancelled) return;

      const bgUrl = manifest.assets?.boardBackgroundImage ?? "";
      setBoardBgUrl(bgUrl);
      const mgUrl = manifest.assets?.minigameBgImage ?? bgUrl;
      setMinigameBgUrl(mgUrl);
      console.log(`[GameBoard] theme="${themeId}" boardBgUrl="${bgUrl || "none"}" minigameBgUrl="${mgUrl || "none"}"`);

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
    return libBuildFogReveal(fieldIndex, FIELDS, base ?? revealedFields);
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
  // Late-join spectator telegram: true = sessionStorage flag byl přečten, telegram čeká na render
  const lateJoinRef = React.useRef<boolean>(false);
  // Discord rejoin reclaim: jméno hráče po úspěšném reclaimu — použito pro jednoráz. toast
  const discordReclaimRef = React.useRef<string | null>(null);

  // ── Audio & UX feedback hook ──────────────────────────────────────────
  const {
    soundEnabled,
    flashEvent,
    telegramMessage,
    coinsFeedback,
    majorLossAmount,
    majorGainAmount,
    toggleSound,
    playSfx,
    playStepSound,
    showCoinsFeedback,
    showMajorLoss,
    clearMajorLoss,
    showMajorGain,
    clearMajorGain,
    showTelegram,
    showFlash,
    flashActiveRef,
    deferredOfferRef,
  } = useGameBoardAudio({
    themeMusic: theme.music,
    players,
    gameMode,
    myPlayerId,
    offerPendingType: gameState?.offer_pending?.type,
    gameStatus,
    viewerRole,
    fieldCount: FIELDS.length,
    setPendingOffer,
    seenGameOverRef,
    lateJoinRef,
  });

  // flippingFields: pole právě animující flip
  const [flippingFields, setFlippingFields] = React.useState<Set<number>>(new Set());
  // showingHiddenRef: pole v první půlce flipu — stále zobrazují hidden card
  const showingHiddenRef = React.useRef<Set<number>>(new Set());

  // Field ownership selection mode
  const [fieldSelectionMode, setFieldSelectionMode] = React.useState(false);
  const [selectedFieldIndexes, setSelectedFieldIndexes] = React.useState<number[]>([]);

  const eligibleFieldIndexes = React.useMemo<Set<number>>(() => {
    const currentOwners = expireStaleEntries(gameState?.field_owners ?? [], gameState?.turn_count ?? 0);
    return new Set(
      FIELDS
        .filter(f =>
          f.type === "coins_lose" &&
          isFieldVisible(f) &&
          getFieldOwner(f.index, currentOwners, players, gameState?.turn_count ?? 0) === null
        )
        .map(f => f.index)
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState?.field_owners, gameState?.turn_count, FIELDS, players]);

  const fieldOwnership = React.useMemo<Record<number, import("@/lib/types/game").Player>>(
    () => buildFieldOwnership(gameState?.field_owners ?? [], players, gameState?.turn_count ?? 0),
    [gameState?.field_owners, gameState?.turn_count, players],
  );

  const [fieldOwnershipLoading, setFieldOwnershipLoading] = React.useState(false);
  const [fieldOwnershipError, setFieldOwnershipError] = React.useState<string | null>(null);

  const handleFieldSelect = React.useCallback((idx: number) => {
    if (!eligibleFieldIndexes.has(idx)) return;
    setSelectedFieldIndexes(prev => {
      if (prev.includes(idx)) return prev.filter(i => i !== idx);
      if (prev.length >= 3) return prev;
      return [...prev, idx];
    });
  }, [eligibleFieldIndexes]);

  const handleCancelOwnership = React.useCallback(() => {
    setFieldSelectionMode(false);
    setSelectedFieldIndexes([]);
    setFieldOwnershipError(null);
  }, []);

  const handleStartFieldSelection = React.useCallback(() => {
    setSelectedFieldIndexes([]);
    setFieldSelectionMode(true);
    setFieldOwnershipError(null);
  }, []);

  const confirmFieldOwnership = React.useCallback(async () => {
    if (!gameState || !gameId || !myPlayerId || selectedFieldIndexes.length === 0) return;
    const player = players.find(p => p.id === myPlayerId);
    if (!player) return;

    const result = buildFieldOwnershipPlacement(
      selectedFieldIndexes,
      player.id,
      player.name,
      gameState.turn_count,
      players.length,
      FIELDS,
      gameState.field_owners ?? [],
    );

    if (!result.valid) {
      setFieldOwnershipError(result.reason ?? "Neplatný výběr");
      return;
    }
    if (player.coins < result.totalCost) {
      setFieldOwnershipError("Nedostatek coins.");
      return;
    }

    setFieldOwnershipLoading(true);
    setFieldOwnershipError(null);
    try {
      const newFieldOwners = [
        ...expireStaleEntries(gameState.field_owners ?? [], gameState.turn_count),
        ...result.entries,
      ];
      const newLog = [
        `${player.name} vsadil na ${result.entries.length} ${result.entries.length === 1 ? "pole" : "polí"} za ${result.totalCost} 💰`,
        ...(gameState.log ?? []),
      ].slice(0, 20);

      const { data: updatedRows, error: gsError } = await supabase
        .from("game_state")
        .update({ field_owners: newFieldOwners as unknown as Record<string, unknown>[], log: newLog })
        .eq("game_id", gameId)
        .eq("turn_count", gameState.turn_count)
        .select("turn_count");

      if (gsError || !updatedRows || updatedRows.length === 0) {
        console.error("[confirmFieldOwnership] gsError:", gsError, "updatedRows:", updatedRows);
        setFieldOwnershipError(gsError ? `Chyba: ${gsError.message}` : "Pole se mezitím změnila, zkus to znovu.");
        return;
      }

      await supabase
        .from("players")
        .update({ coins: player.coins - result.totalCost })
        .eq("id", player.id);

      setFieldSelectionMode(false);
      setSelectedFieldIndexes([]);
    } catch (err) {
      console.error("[confirmFieldOwnership]", err);
      setFieldOwnershipError("Chyba při ukládání. Zkus to znovu.");
    } finally {
      setFieldOwnershipLoading(false);
    }
  }, [selectedFieldIndexes, gameState, gameId, myPlayerId, players, FIELDS]);

  // Reset selection when turn changes
  React.useEffect(() => {
    if (fieldSelectionMode) {
      setFieldSelectionMode(false);
      setSelectedFieldIndexes([]);
      setFieldOwnershipError(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState?.turn_count]);

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

  React.useEffect(() => {
    return () => {
      if (rollDecisionTimerRef.current) clearTimeout(rollDecisionTimerRef.current);
    };
  }, []);

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
    setRollDecisionCountdown(4);
    const interval = setInterval(() => {
      setRollDecisionCountdown((n) => (n !== null && n > 0 ? n - 1 : n));
    }, 1000);
    return () => clearInterval(interval);
  }, [pendingRollDecision]);

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

  // Discord rejoin reclaim toast — zobrazí se jednorázově po automatickém reclaimu na novém zařízení.
  React.useEffect(() => {
    if (viewerRole !== "player") return;
    if (!discordReclaimRef.current) return;
    const reclaimedName = discordReclaimRef.current;
    discordReclaimRef.current = null;
    showTelegram(`Pokračuješ jako ${reclaimedName} 🐎`);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewerRole]);

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
      setDiscordThreadUrl(game.discord_thread_url ?? null);
      if (game.economy && typeof game.economy === "object") {
        setEconomy({ ...DEFAULT_ECONOMY, ...(game.economy as Partial<EconomyConfig>) });
      }

      const { data: { user } } = await supabase.auth.getUser();
      const myDiscordId = user?.user_metadata?.provider_id as string | undefined;
      const myAvatarUrl = user?.user_metadata?.avatar_url as string | null ?? null;
      if (myAvatarUrl) setMyDiscordAvatar(myAvatarUrl);

      let pid = localStorage.getItem(`paytowin_player_${gameCode}`);

      // Discord rejoin reclaim: hráč přišel z nového zařízení bez localStorage
      if (!pid && myDiscordId && game.game_mode !== "local") {
        const { data: reclaimRows, error: reclaimErr } = await supabase
          .from("players")
          .select("id, name")
          .eq("game_id", game.id)
          .eq("discord_id", myDiscordId)
          .eq("is_bot", false)
          .limit(2);
        if (reclaimErr) {
          console.warn("[REJOIN] discord_reclaim_query_error", { gameCode, error: reclaimErr.message });
        } else if (reclaimRows && reclaimRows.length === 1) {
          const match = reclaimRows[0];
          localStorage.setItem(`paytowin_player_${gameCode}`, match.id);
          pid = match.id;
          discordReclaimRef.current = match.name as string;
          console.info("[REJOIN] discord_reclaim_success", { gameCode, playerId: match.id, playerName: match.name });
        } else if (reclaimRows && reclaimRows.length > 1) {
          console.warn("[REJOIN] discord_reclaim_ambiguous", { gameCode, matchCount: reclaimRows.length });
        } else {
          console.info("[REJOIN] discord_reclaim_no_match", { gameCode });
        }
      }

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

  // ── Online bot trigger ────────────────────────────────────────────────────────
  // Explicitní refetch po bot akci — realtime doručení není garantované na mobilu.
  // refreshGame je bezpečný k opakovanému volání (idempotentní čtení z DB).
  // setPendingRacer je stable React setter — bezpečné v deps.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const onBotActionComplete = React.useCallback(async () => {
    if (!gameId) return;
    console.log("[GAME_REFRESH] refresh_game_start", { gameId });
    const { players: freshPlayers, state: freshState } = await refreshGame(gameId);
    console.log("[GAME_REFRESH] refresh_game_done", { gameId });
    if (freshState) {
      const currentP = freshPlayers[freshState.current_player_index];
      console.log("[GAME_REFRESH] refresh_game_state_snapshot", {
        gameId,
        turn_count: freshState.turn_count,
        current_player_index: freshState.current_player_index,
        horse_pending: freshState.horse_pending,
        card_pending_exists: !!freshState.card_pending,
        offer_pending_kind: (freshState.offer_pending as { type?: string } | null)?.type ?? null,
        pendingRacer_expected_null: !freshState.horse_pending || !!currentP?.is_bot,
        currentPlayer_name: currentP?.name ?? null,
        currentPlayer_is_bot: currentP?.is_bot ?? null,
        players_count: freshPlayers.length,
      });
      // Explicitně vyčisti pendingRacer pokud DB říká horse_pending=false.
      // useEffect [horse_pending] nemusí znovu reagovat, pokud se dep nezměnil (stejná hodnota).
      // Volání setPendingRacer(null) je idempotentní — bezpečné i když je již null.
      if (!freshState.horse_pending) {
        setPendingRacer(null);
      } else {
        // horse_pending=true zůstalo — pokud je na tahu bot, spusť retry signál.
        // Bez toho by useOnlineBotTrigger nereagoval (deps by se nezměnily).
        const currentP = freshPlayers[freshState.current_player_index];
        if (currentP?.is_bot) {
          setBotRetrySeq(prev => prev + 1);
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]); // refreshGame + setPendingRacer závisí jen na refs a stable setterech

  useOnlineBotTrigger({ gameId, gameState, players, myPlayerId, isLocalGame: gameMode === "local", onBotActionComplete, botRetrySeq });

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
            if (field?.type === "racer" && field.racer && !currentP?.is_bot) {
              setPendingRacer({ racer: field.racer, playerIndex: freshState.current_player_index, flavorText: field.flavorText });
            } else {
              setPendingRacer(null);
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
  /**
   * Scroll-before-overlay helper — scrollne k boardu, pak v rAF otevře StableDuelBoardLayer.
   * Idempotentní: stejný duelKey otevře overlay jen jednou (ref guard).
   */
  const openStableDuelOverlay = React.useCallback((
    ctx: { challenger: DuelContestant; defender: DuelContestant; isPreview: boolean; challengerId?: string; defenderId?: string; duelRole?: "challenger_authority" | "defender_remote"; duelId?: string; sharedCountdownEndsAt?: number; mafiaBonus?: number },
    duelKey: string,
  ) => {
    if (overlayOpenedRef.current === duelKey) return;
    overlayOpenedRef.current = duelKey;
    window.scrollTo({ top: 0, behavior: "smooth" });
    requestAnimationFrame(() => setStableDuelCtx(ctx));
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

  // ── Guide visibility ─────────────────────────────────────────────────────
  const myPlayer = players.find((player) => player.id === myPlayerId) ?? null;
  const isGuestPlayer = !!myPlayer && !myPlayer.discord_id && !myPlayer.is_bot;
  const humanPlayerCount = players.filter(p => !p.is_bot).length;
  const botPlayerCount   = players.filter(p => !!p.is_bot).length;

  const {
    shouldShowCorrectionGuide,
    shouldShowRacerGuide,
    shouldShowStaminaGuide,
    shouldShowSoloLobbyGuide,
    dismissCorrectionGuide,
    dismissRacerGuide,
    dismissStaminaGuide,
    dismissSoloLobbyGuide,
  } = useGuideState({
    gameCode,
    turnCount: gameState?.turn_count,
    viewerRole,
    hasPlayer: !!myPlayer,
    isPlayerBankrupt: !!myPlayer && isBankrupt(myPlayer),
    horseCount: myPlayer?.horses.length ?? 0,
    gameStatus,
    humanPlayerCount,
    botPlayerCount,
  });

  const rollDice = async () => {
    const activePendingRace = gameState?.offer_pending?.type === "race" ? gameState.offer_pending as RaceOffer : null;
    const activePendingBankrupt = gameState?.offer_pending?.type === "bankrupt_announcement";
    const activePendingRacePlaceholder = gameState?.offer_pending?.type === "race_pending";
    const activePendingStableDuel = gameState?.offer_pending?.type === "stable_duel_pending" &&
      (gameState.offer_pending as StableDuelPendingOffer).phase !== "finished";
    if (!gameState || pendingRacer || pendingCard || pendingOffer || pendingRollDecision || activePendingRace || activePendingBankrupt || activePendingRacePlaceholder || activePendingStableDuel || isRolling || isMoving || bankruptWarning) return;

    if (shouldShowCorrectionGuide) {
      dismissCorrectionGuide();
    } else if (shouldShowRacerGuide) {
      dismissRacerGuide();
    } else if (shouldShowStaminaGuide) {
      dismissStaminaGuide();
    }

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

    // Set ghost target for default move
    const fieldCount = FIELDS.length;
    setGhostMoveTarget((currentPlayer.position + roll) % fieldCount);

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
      }, 4000);
    });

    const adjustmentAllowed = selectedAdjustment !== 0 &&
      currentPlayer.coins >= ROLL_CORRECTION_COST &&
      (roll + selectedAdjustment) >= 1;
    const finalAdjustment = adjustmentAllowed ? selectedAdjustment : 0;
    const finalRoll = roll + finalAdjustment;
    const adjustmentCost = finalAdjustment === 0 ? 0 : ROLL_CORRECTION_COST;

    // ── 2. Animace pohybu pole po poli ────────────────────────────────────────
    const oldPosition = currentPlayer.position;
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

    // Daň za průchod/přistání na STARTu — roste s počtem průchodů (laps-based).
    // laps před tímto průchodem: 0 = první průchod = bez daně, 1 = druhý = baseTax, atd.
    if (passedStart || newPosition === 0) {
      const beforeStartCoins = movedPlayer.coins;
      const { player: afterStart, logLines: startLog } = applyStartPassage(movedPlayer, passedStart, economy);
      movedPlayer = afterStart;
      extraLog.push(...startLog);
      const startTaxPaid = beforeStartCoins - movedPlayer.coins;
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
      // Vlastník = živý jiný hráč který má tohoto racera — bankrotovaný se ignoruje
      const ownerPlayer = players.find(
        p => p.id !== currentPlayer.id && !isBankrupt(p) && playerOwnsRacer(p, field.racer!)
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
        await finishTurn({ nextIndex, turnCount: newTurnCount, log: [...logLines, ...newLog], lastRoll: roll, ...(yearEventTelegramPayload ? { yearEventTelegram: yearEventTelegramPayload } : {}), ...(fogRevealBase !== undefined ? { clearFieldOwners: true } : {}) });
      } else if (ownerPlayer) {
        if (canTriggerRivalsRace(movedPlayer, ownerPlayer)) {
          // ── Stájový souboj: oba hráči mají koně → board overlay duel ──────────
          await supabase.from("players").update({ position: newPosition, coins: movedPlayer.coins, laps: movedPlayer.laps ?? 0 }).eq("id", currentPlayer.id);
          const updatedPlayersForNext = players.map(p => p.id === currentPlayer.id ? movedPlayer : p);
          const nextIndex = getNextActiveIndex(gameState.current_player_index, updatedPlayersForNext);
          const challenger: DuelContestant = {
            name: currentPlayer.name,
            horse: getPreferredHorse(movedPlayer.horses),
            color: currentPlayer.color,
            coins: movedPlayer.coins,
          };
          const defender: DuelContestant = {
            name: ownerPlayer.name,
            horse: getPreferredHorse(ownerPlayer.horses),
            color: ownerPlayer.color,
            coins: ownerPlayer.coins,
          };
          stableDuelProceedRef.current = async (resultLog?: string[], updatedCurrentPlayerHorses?: import("@/lib/types/game").Horse[]) => {
            await finishTurn({
              nextIndex, turnCount: newTurnCount,
              log: [
                ...(resultLog ?? [`⚔️ ${currentPlayer.name} svedl souboj stájí s ${ownerPlayer.name}!`]),
                ...extraLog, ...newLog,
              ],
              lastRoll: roll,
              clearOfferPending: { type: "stable_duel_pending", challengerId: currentPlayer.id, defenderId: ownerPlayer.id },
              ...(yearEventTelegramPayload ? { yearEventTelegram: yearEventTelegramPayload } : {}),
              ...(updatedCurrentPlayerHorses ? { updatedCurrentPlayerHorses } : {}),
            });
          };
          boardSurfaceRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
          const duelCreatedAt = Date.now();
          // Guard: zabrání pvbot useEffectu znovu otevřít overlay po dokončení duelu (stejný pattern jako bot-triggered cesta)
          botDuelHandledRef.current = duelCreatedAt;
          const rawMafiaBonus = Math.round(getStartTax(currentPlayer.laps ?? 0, economy) * 0.10);
          const duelMafiaBonus = rawMafiaBonus > 0 ? Math.min(rawMafiaBonus, 500) : undefined;
          const shouldAutoUseOnline1v1 =
            gameMode === "online" &&
            currentPlayer.id !== ownerPlayer.id &&
            !!challenger.horse &&
            !!defender.horse;
          const effectiveMode: "online_1v1" | "pvbot_awareness" =
            ownerPlayer.is_bot
              ? "pvbot_awareness"
              : gameMode === "online" && (stableDuelMode === "online_1v1" || shouldAutoUseOnline1v1)
              ? "online_1v1"
              : "pvbot_awareness";
          // pvbot_awareness: otevři StableDuelBoardLayer ihned (scroll+rAF); online_1v1: čekej na handshake
          if (effectiveMode !== "online_1v1") {
            openStableDuelOverlay(
              { challenger, defender, isPreview: false, challengerId: currentPlayer.id, defenderId: ownerPlayer.id, mafiaBonus: duelMafiaBonus },
              `pvbot_${currentPlayer.id}_${ownerPlayer.id}_${duelCreatedAt}`,
            );
          }
          // Sdílený pending stav — informuje všechny klienty přes Realtime
          if (gameId) {
            const duelPending: StableDuelPendingOffer = {
              type: "stable_duel_pending",
              phase: "pending",
              mode: effectiveMode,
              challengerId: currentPlayer.id,
              defenderId: ownerPlayer.id,
              challengerName: currentPlayer.name,
              defenderName: ownerPlayer.name,
              fieldIndex: field.index,
              minigameType: selectStableMinigame({ themeId, challengerHorse: challenger.horse, defenderHorse: defender.horse }),
              createdAt: duelCreatedAt,
              ...(effectiveMode === "online_1v1" ? { challengerReady: true, defenderReady: false } : {}),
              ...(duelMafiaBonus !== undefined ? { mafiaBonus: duelMafiaBonus } : {}),
            };
            console.log("[stable-duel-trigger]", {
              stableDuelMode,
              effectiveMode,
              autoOnline1v1: shouldAutoUseOnline1v1,
              challengerId: currentPlayer.id,
              defenderId: ownerPlayer.id,
              gameMode,
              offerPendingMode: duelPending.mode,
            });
            await supabase.from("game_state").update({
              offer_pending: duelPending as unknown as Record<string, unknown>,
            }).eq("game_id", gameId);
          }
        } else {
          // ── Rent fallback: jeden nebo oba hráči nemají závodníka ──────────────
          const rent = computeRent(field.racer.price);
          const { payer: rentedPlayer, owner: paidOwner } = applyRentPayment(movedPlayer, ownerPlayer, rent);

          console.log(`[racer-rent] ${currentPlayer.name} (id=${currentPlayer.id}) landed on "${field.racer.name}" (racer.id=${field.racer.id ?? "none"}) owned by ${ownerPlayer.name} (id=${ownerPlayer.id}) → rent=${rent}`);
          console.log(`[racer-rent] transfer: ${currentPlayer.name} ${movedPlayer.coins}→${rentedPlayer.coins}, ${ownerPlayer.name} ${ownerPlayer.coins}→${paidOwner.coins}`);

          const wouldBankruptRent = rentedPlayer.coins <= 0 && currentPlayer.coins > 0;
          const finalRentedPlayer = wouldBankruptRent ? await confirmBankruptOrSell(rentedPlayer) : rentedPlayer;
          const wentBankrupt = finalRentedPlayer.coins <= 0 && currentPlayer.coins > 0;
          const noHorseNote = movedPlayer.horses.length === 0
            ? `${currentPlayer.name} ještě nemá koně na souboj — platí nájem.`
            : null;
          const logLines = [
            `${currentPlayer.name} zaplatil ${rent} 💰 hráči ${ownerPlayer.name} za ${field.racer.emoji} ${field.racer.name}`,
            ...(noHorseNote ? [noHorseNote] : []),
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

          console.log(`[RENT_FLOW] human_rent_payment_start`, { gameId, payerId: finalRentedPlayer.id, ownerId: paidOwner.id, rent });
          const { data: rentData, error: rentError } = await supabase.rpc("pay_rent_atomic", {
            p_game_id:  gameId,
            p_payer_id: finalRentedPlayer.id,
            p_owner_id: paidOwner.id,
            p_amount:   rent,
          });
          if (rentError || !rentData?.[0]) {
            console.error(`[RENT_FLOW] human_rent_payment_failed`, { gameId, payerId: finalRentedPlayer.id, ownerId: paidOwner.id, rent, error: rentError?.message ?? "no data" });
            return;
          }
          console.log(`[RENT_FLOW] human_rent_payment_done`, { gameId, payerCoinsDb: rentData[0].payer_coins, ownerCoinsDb: rentData[0].owner_coins });
          // RPC atomicky přeneslo rent: owner_coins správně. Payer mohl prodat koně
          // (forced sale) → finalRentedPlayer.coins se může lišit od rentData[0].payer_coins;
          // přepíšeme payer's final state jedním write.
          await supabase.from("players").update({
            position: finalRentedPlayer.position,
            coins:    finalRentedPlayer.coins,
            horses:   finalRentedPlayer.horses,
            laps:     finalRentedPlayer.laps ?? 0,
          }).eq("id", finalRentedPlayer.id);
          await finishTurn({
            nextIndex, turnCount: newTurnCount, log: [...logLines, ...newLog], lastRoll: roll,
            ...(wouldBankruptRent ? { updatedCurrentPlayerHorses: finalRentedPlayer.horses } : {}),
            ...(wentBankrupt && !rentGameEnds ? { postTurnEvent: { kind: "announcement" as const, playerId: finalRentedPlayer.id, playerName: finalRentedPlayer.name } } : {}),
            ...(wentBankrupt ? { bustPlayerId: finalRentedPlayer.id } : {}),
            ...(yearEventTelegramPayload ? { yearEventTelegram: yearEventTelegramPayload } : {}),
            ...(fogRevealBase !== undefined ? { clearFieldOwners: true } : {}),
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
          ...(fogRevealBase !== undefined ? { field_owners: [] } : {}),
        }).eq("game_id", gameId);
        if (canReroll) setCanReroll(false);
        setPendingRacer({ racer: field.racer, playerIndex: gameState.current_player_index, flavorText: field.flavorText });
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
        ...(fogRevealBase !== undefined ? { field_owners: [] } : {}),
      }).eq("game_id", gameId);
      if (canReroll) setCanReroll(false);
      // Lokální state — ostatní klienti dostanou přes Realtime
      setPendingCard({ card, playerIndex: gameState.current_player_index });
    } else {
      // Field ownership přesměrování pro coins_lose
      const fieldOwnerForPayment = field.type === "coins_lose"
        ? getFieldOwner(field.index, gameState.field_owners ?? [], players, gameState.turn_count)
        : null;
      const shouldRedirectToOwner = fieldOwnerForPayment !== null
        && fieldOwnerForPayment.id !== movedPlayer.id
        && !isBankrupt(fieldOwnerForPayment);

      let afterField: typeof movedPlayer;
      let fieldLog: string;
      let ownerAfterPayment: typeof movedPlayer | null = null;

      if (shouldRedirectToOwner && fieldOwnerForPayment) {
        const { player: actionResult } = field.action(movedPlayer);
        const lossAmount = movedPlayer.coins - actionResult.coins;
        if (lossAmount > 0) {
          const payment = applyFieldOwnerPayment(movedPlayer, fieldOwnerForPayment, lossAmount, field.label);
          afterField = payment.payer;
          fieldLog = payment.log;
          ownerAfterPayment = payment.owner;
        } else {
          afterField = actionResult;
          fieldLog = `${movedPlayer.name} stál na ${field.label}`;
        }
      } else {
        const result = field.action(movedPlayer);
        afterField = result.player as typeof movedPlayer;
        fieldLog = result.log;
      }

      const logLines = [...(fieldLog ? [fieldLog] : []), ...extraLog];

      // Center feedback pro finanční pole
      if (field.type === "coins_lose") {
        const coinDelta = afterField.coins - movedPlayer.coins; // záporné číslo
        showCoinsFeedback(coinDelta, "lose", movedPlayer.name, field.label);
        if (-coinDelta >= 601) showMajorLoss(-coinDelta);
      } else if (field.type === "coins_gain") {
        const gainDelta = afterField.coins - movedPlayer.coins;
        const netGainDelta = gainDelta - adjustmentCost;
        showCoinsFeedback(gainDelta, "gain", movedPlayer.name, field.label);
        if (netGainDelta >= 1000) showMajorGain(gainDelta, movedPlayer.id);
      }

      // Bankrot? — dej hráči šanci prodat koně, pak znovu vyhodnoť
      const wouldBankrupt = afterField.coins <= 0 && currentPlayer.coins > 0;
      const finalPlayer = wouldBankrupt ? await confirmBankruptOrSell(afterField) : afterField;
      const wentBankrupt = finalPlayer.coins <= 0;
      if (wentBankrupt) { logLines.push(`💀 ${finalPlayer.name} zkrachoval!`); playSfx("bankrupt"); }
      else if (wouldBankrupt) logLines.push(`${finalPlayer.name} prodal koně a přežil! 💰`);

      const updatedPlayers = players.map((p, i) => {
        if (i === gameState.current_player_index) return finalPlayer;
        if (ownerAfterPayment && p.id === ownerAfterPayment.id) return ownerAfterPayment;
        return p;
      });
      const nextIndex = getNextActiveIndex(gameState.current_player_index, updatedPlayers);

      // Hráč aktualizován vždy (pozice, coins, koně)
      console.log(`[turn-flow] normal field persist — pos=${finalPlayer.position} coins=${finalPlayer.coins} wentBankrupt=${wentBankrupt}`);
      await supabase.from("players").update({ position: finalPlayer.position, coins: finalPlayer.coins, horses: finalPlayer.horses, laps: finalPlayer.laps ?? 0 }).eq("id", currentPlayer.id);
      if (ownerAfterPayment) {
        await supabase.from("players").update({ coins: ownerAfterPayment.coins }).eq("id", ownerAfterPayment.id);
      }

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
          ...(fogRevealBase !== undefined ? { field_owners: [] } : {}),
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
          ...(fogRevealBase !== undefined ? { clearFieldOwners: true } : {}),
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
    setGhostMoveTarget(null);
    setTimeout(() => setTrailFields([]), 3000);
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
    finalHorses = normalizeFavoriteHorse(finalHorses);
    const wentBankrupt = finalCoins <= 0;

    // Objective reward — zkontroluj sdílený objective ihned po nákupu racera
    // Bonus se přičte do finalCoins před DB write; guard se zapíše fire-and-forget
    const alreadyAwardedObjectives = gameState.objective_rewards_awarded ?? [];
    const objectiveHit = !wentBankrupt && scenario
      ? checkSharedObjectiveInGameReward(
          scenario,
          { ...player, horses: finalHorses, coins: finalCoins },
          alreadyAwardedObjectives,
        )
      : null;
    if (objectiveHit) {
      finalCoins += objectiveHit.config.inGameCoins;
    }

    const logLines = [`${player.name} koupil koně ${racer.emoji} ${racer.name}`];
    if (wentBankrupt) { logLines.push(`💀 ${player.name} zkrachoval!`); playSfx("bankrupt"); }
    else if (wouldBankruptBuy) logLines.push(`${player.name} prodal koně a přežil! 💰`);
    if (objectiveHit) {
      logLines.push(`🏆 ${player.name} splnil kontrakt! +${objectiveHit.config.inGameCoins} 💰`);
    }

    const objectiveTelegram = objectiveHit
      ? { text: `🏆 ${player.name} splnil kontrakt! +${objectiveHit.config.inGameCoins} 💰`, turn: newTurnCount }
      : undefined;
    if (objectiveTelegram) {
      seenYearEventTurnRef.current = newTurnCount;
      showTelegram(objectiveTelegram.text);
    }

    // Zahrnuje finální koně — race trigger potřebuje vidět aktuální ownership
    const updatedPlayers = players.map((p, i) =>
      i === playerIndex ? { ...player, coins: finalCoins, horses: finalHorses } : p
    );
    const nextIndex = getNextActiveIndex(playerIndex, updatedPlayers);

    const activeAfterBuy = updatedPlayers.filter(p => !isBankrupt(p));
    const buyGameEnds = (updatedPlayers.length >= 2 && activeAfterBuy.length === 1) ||
                        (updatedPlayers.length === 1 && activeAfterBuy.length === 0);

    let postTurnEvent: PostTurnEvent | undefined;
    if (wentBankrupt && !buyGameEnds) {
      postTurnEvent = { kind: "announcement" as const, playerId: player.id, playerName: player.name };
    }

    await supabase.from("players").update({ coins: finalCoins, horses: finalHorses }).eq("id", player.id);

    // Spend event — jen Discord hráči; chyba nesmí rozbít nákup
    if (player.discord_id && gameId) {
      supabase.from("spend_events").insert({
        game_id:    gameId,
        player_id:  player.id,
        discord_id: player.discord_id,
        event_type: "racer_purchase",
        amount:     racer.price,
        metadata:   { racer_id: racer.id ?? null, racer_name: racer.name, field_index: player.position, source: "buy_racer" },
      }).then(({ error }) => { if (error) console.warn("[spend_events] insert failed", error); });
    }

    // Optimistický update: okamžitě promítni nové horses + coins do lokálního stavu
    setPlayers(prev => prev.map(p =>
      p.id === player.id ? { ...p, coins: finalCoins, horses: finalHorses } : p
    ));

    // Objective guard se zapisuje atomicky v rámci finishTurn (stejný UPDATE jako posun tahu),
    // aby Realtime subscription přečetla vždy konzistentní stav a odměna se nevyplatila 2×.
    await finishTurn({
      nextIndex, turnCount: newTurnCount, log: [...logLines, ...newLog],
      updatedCurrentPlayerHorses: finalHorses,
      ...(postTurnEvent ? { postTurnEvent } : {}),
      ...(wentBankrupt ? { bustPlayerId: player.id } : {}),
      ...(objectiveTelegram ? { yearEventTelegram: objectiveTelegram } : {}),
      ...(objectiveHit ? {
        newObjectiveRewardsAwarded: [...alreadyAwardedObjectives, objectiveHit.objectiveId],
        newObjectiveCompletedBy: { ...(gameState.objective_completed_by ?? {}), [objectiveHit.objectiveId]: player.id },
      } : {}),
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
    const updatedHorses = normalizeFavoriteHorse(
      player.horses.filter(h => racerOwnershipKey(h) !== racerKey)
    );

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
      clearOfferPending: { type: "reroll" },
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
    let cardMovedToRacerFlavorText: string | undefined;
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
        const beforeCardStartCoins = updatedPlayer.coins;
        const { player: afterStart, logLines: startLog } = applyStartPassage(updatedPlayer, passedStartCard, economy);
        updatedPlayer = afterStart;
        logLines.push(...startLog);
        const cardStartTaxPaid = beforeCardStartCoins - updatedPlayer.coins;
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
            cardMovedToRacerFlavorText = landingField.flavorText;
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
      const result = resolveGiveRacer({
        racerId: card.effect.racerId,
        fields: fieldsRef.current,
        players,
        themeRacers: getThemeRacers(theme),
        randomIndex: Math.random(),
      });
      if (result) {
        const { horse, usedFallback } = result;
        updatedPlayer = { ...updatedPlayer, horses: [...updatedPlayer.horses, horse] };
        logLines.push(usedFallback
          ? `${player.name}: ${card.text} — požadovaný závodník nebyl dostupný, získal ${horse.emoji} ${horse.name}!`
          : `${player.name}: ${card.text} — získal ${horse.emoji} ${horse.name}!`
        );
      } else {
        logLines.push(`${player.name}: ${card.text} — žádný volný závodník není k dispozici.`);
      }
    } else if (card.effect.kind === "stamina_debuff") {
      const factor = card.effect.factor ?? 0.5;
      const duration = card.effect.duration ?? 2;
      updatedPlayer = applyStaminaDebuff(updatedPlayer, factor, duration);
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
    const finalCardHorses = (card.effect.kind === "give_racer" || wouldBankruptCard)
      ? normalizeFavoriteHorse(finalUpdatedPlayer.horses)
      : finalUpdatedPlayer.horses;
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
    if (card.effect.kind === "give_racer" || wouldBankruptCard) playerUpdate.horses = finalCardHorses;
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
      setPendingRacer({ racer: cardMovedToRacer, playerIndex, flavorText: cardMovedToRacerFlavorText });
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
      ...(card.effect.kind === "give_racer" || wouldBankruptCard ? { updatedCurrentPlayerHorses: finalCardHorses } : {}),
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
    /**
     * Cíleně smaž offer_pending — pouze když caller ví, že pending odpovídá tomuto tahu.
     * Bez tohoto parametru se offer_pending v DB NEZMĚNÍ.
     * type + IDs slouží jako dokumentace; DB check se nedělá (finishTurn v proceed má stale closure).
     * TODO: až finishTurn bude useCallback s live gameState dep, přidat ověření proti DB hodnotě.
     */
    clearOfferPending?: { type: string; challengerId?: string; defenderId?: string };
    /** Fog reset (resetNonRacerCards): vymaže všechny field_owners — neviditelné vlastněné pole by přesměrovalo platbu. */
    clearFieldOwners?: boolean;
    /**
     * Objective guard — pokud byl v tomto tahu splněn sdílený objective, předej nový seznam
     * awarded IDs a completed_by map. Zapisuje se atomicky v tomtéž UPDATE jako posun tahu,
     * čímž se zabrání race condition (fire-and-forget by mohl dorazit do DB až po Realtime
     * triggeru z finishTurn, čímž by refreshGame přečetl starý prázdný seznam a odměna
     * by se vyplatila znovu při dalším nákupu).
     */
    newObjectiveRewardsAwarded?: string[];
    newObjectiveCompletedBy?: Record<string, string>;
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
      if (params.clearFieldOwners) announcementUpdate.field_owners = [];
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
      if (params.clearFieldOwners) evtUpdate.field_owners = [];
      evtUpdate.year_event_telegram = params.yearEventTelegram ?? null;
      await supabase.from("game_state").update(evtUpdate).eq("game_id", gameId);
      return;
    }

    const update: Record<string, unknown> = {
      current_player_index: params.nextIndex,
      turn_count: params.turnCount,
      horse_pending: false,
      card_pending: null,
      log: params.log.slice(0, 20),
    };
    // offer_pending se čistí jen na explicitní požádání — zabrání přepsání nesouvisejícího pending.
    // TODO: clearOfferPending currently gates which caller may clear offer_pending, but does not
    //       compare against the latest DB row. Before real ready/countdown multiplayer, move this
    //       to an atomic conditional cleanup / RPC or refetch-and-compare.
    if (params.clearOfferPending !== undefined) update.offer_pending = null;
    if (params.lastRoll !== undefined) update.last_roll = params.lastRoll;
    if (params.revealedFields !== undefined) update.revealed_fields = params.revealedFields;
    if (params.clearFieldOwners) update.field_owners = [];
    if (params.bustPlayerId) update.bust_order = [...(gameState?.bust_order ?? []), params.bustPlayerId];
    update.year_event_telegram = params.yearEventTelegram ?? null;
    // Objective guard — atomicky se zápisem tahu; zabraňuje race condition fire-and-forget.
    if (params.newObjectiveRewardsAwarded !== undefined) {
      update.objective_rewards_awarded = params.newObjectiveRewardsAwarded;
      update.objective_completed_by    = params.newObjectiveCompletedBy ?? {};
    }

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
      const effectiveScore = computeRaceScore({ rawScore, finalStamina, maxStamina, debuffFactor, isLegendary: horse?.isLegendary });
      return { player, horse, horseKey, rawScore, effectiveScore, speed: horse?.speed ?? 0, finalStamina, maxStamina };
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
          ? normalizeFavoriteHorse(e.player!.horses.filter(h => racerOwnershipKey(h) !== e.horseKey))
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

    // Modal pro ztrátu racera — jen pro tohoto hráče, ne bota; legenda dostane jiný text
    const myBurnout = burnedOutEntries.find(
      e => e.player!.id === myPlayerId && !e.player!.is_bot,
    );
    if (myBurnout?.horse) {
      const racerCategory: RacerCategory = myBurnout.horse.isLegendary
        ? "legendary"
        : themeId.startsWith("car") ? "car" : "animal";
      setRacerLostModal({ horse: myBurnout.horse, playerName: myBurnout.player!.name, racerCategory });
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
  // Pravidla v prioritě:
  //   1. Scenario win condition (např. collect_all_available_racers pro horse-night).
  //   2. Multiplayer výhra: >=2 hráčů celkem, přesně 1 aktivní zbývá.
  //   3. Solo prohra:        1 hráč celkem,  0 aktivních (zbankrotoval).
  const checkAndFinishGame = async (updatedPlayers: Player[]) => {
    if (!gameId) return;
    const activePlayers = updatedPlayers.filter(p => !isBankrupt(p));
    const multiplayerWin = updatedPlayers.length >= 2 && activePlayers.length === 1;
    const soloLoss = updatedPlayers.length === 1 && activePlayers.length === 0;
    const scenarioWin = evaluateScenarioWinCondition({
      scenario,
      players: updatedPlayers,
      fields: fieldsRef.current,
    });
    if (multiplayerWin || soloLoss || scenarioWin.winnerId) {
      await supabase.from("games").update({ status: "finished" }).eq("id", gameId);
      const winner = scenarioWin.winnerId
        ? (updatedPlayers.find(p => p.id === scenarioWin.winnerId)?.name ?? "")
        : multiplayerWin ? (activePlayers[0]?.name ?? "")
        : "nobody";
      if (gameCode) logEvent({ name: "game_finish", game_code: gameCode, winner });
      // Okamžitý lokální update — stejný vzor jako cancelGame.
      // Realtime propaguje ostatním klientům, ale tento klient nečeká.
      setGameStatus("finished");
      // XP + win stars + spend + objective XP — fire and forget; duplikaci hlídají guard sloupce
      awardXpAction(gameId).catch(() => {});
      awardWinStarAction(gameId).catch(() => {});
      awardMoneySpentAction(gameId).catch(() => {});
      awardObjectiveXpAction(gameId).catch(() => {});
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

  const handleStableDuelFinish = React.useCallback(async (result: StableMinigameResult) => {
    const ctx = stableDuelCtx;
    setStableDuelCtx(null);
    const proceed = stableDuelProceedRef.current;
    stableDuelProceedRef.current = null;

    // Challenger-only guard — defender/spectator nesmí volat settlement ani finishTurn.
    // V lokální hře (hot-seat) přeskočíme: jeden klient hraje za oba, žádné riziko duplicity.
    if (gameMode !== "local" && !ctx?.isPreview && ctx?.challengerId && myPlayerId !== ctx.challengerId) {
      setStableDuelCtx(null);
      stableDuelProceedRef.current = null;
      return;
    }

    // Live settlement — přeskočit v preview nebo pokud chybí player IDs
    if (!ctx?.isPreview && ctx?.challengerId && ctx?.defenderId) {
      const challenger = players.find(p => p.id === ctx.challengerId);
      const defender   = players.find(p => p.id === ctx.defenderId);

      if (challenger && defender) {
        const cKey = ctx.challenger.horse ? racerOwnershipKey(ctx.challenger.horse) : null;
        const dKey = ctx.defender.horse   ? racerOwnershipKey(ctx.defender.horse)   : null;

        const s = computeMinigameSettlement(
          result,
          ctx.challenger.horse?.price,
          ctx.defender.horse?.price,
          ctx.mafiaBonus,
        );

        const newCCoins = Math.max(0, challenger.coins + s.p1.coinsDelta);
        const newDCoins = Math.max(0, defender.coins   + s.p2.coinsDelta);
        if (challenger.id === myPlayerId && s.p1.coinsDelta <= -601) showMajorLoss(-s.p1.coinsDelta);
        if (defender.id === myPlayerId   && s.p2.coinsDelta <= -601) showMajorLoss(-s.p2.coinsDelta);
        if (challenger.id === myPlayerId && s.p1.coinsDelta >= 1000) showMajorGain(s.p1.coinsDelta, challenger.id);
        if (defender.id === myPlayerId   && s.p2.coinsDelta >= 1000) showMajorGain(s.p2.coinsDelta, defender.id);

        const updatedCHorses = (() => {
          if (!cKey) return challenger.horses;
          const newStamina = Math.max(0, ((challenger.horses.find(h => racerOwnershipKey(h) === cKey)?.stamina) ?? 0) - s.p1.stamina.total);
          if (newStamina === 0) return normalizeFavoriteHorse(challenger.horses.filter(h => racerOwnershipKey(h) !== cKey));
          return challenger.horses.map(h => racerOwnershipKey(h) === cKey ? { ...h, stamina: newStamina } : h);
        })();

        // Bot/defender stamina skip dokud hraje jen jeden hráč na jednom zařízení
        const updatedDHorses = STABLE_DUEL_APPLY_BOT_STAMINA_LOSS && dKey
          ? defender.horses.map(h =>
              racerOwnershipKey(h) === dKey
                ? { ...h, stamina: Math.max(0, (h.stamina ?? h.maxStamina ?? 100) - s.p2.stamina.total) }
                : h
            )
          : defender.horses;

        if (process.env.NODE_ENV === "development") {
          console.log("[stable-duel] result:", result);
          console.log("[stable-duel] settlement:", s);
          const cBefore = challenger.horses.find(h => racerOwnershipKey(h) === cKey)?.stamina ?? "?";
          const cAfter  = updatedCHorses.find(h => racerOwnershipKey(h) === cKey)?.stamina ?? "?";
          console.log(`[stable-duel] challenger stamina: ${cBefore} → ${cAfter}`);
          console.log(`[stable-duel] defender stamina skipped (bot flag): ${!STABLE_DUEL_APPLY_BOT_STAMINA_LOSS}`);
        }

        await Promise.all([
          supabase.from("players").update({ coins: newCCoins, horses: updatedCHorses }).eq("id", challenger.id),
          supabase.from("players").update({ coins: newDCoins, horses: updatedDHorses }).eq("id", defender.id),
        ]);

        // Popup pro ztrátu koně kvůli stamině — zobraz jen pokud challenger je lidský hráč tohoto klienta
        const challengerLostHorse = cKey && updatedCHorses.length < challenger.horses.length;
        if (challengerLostHorse && challenger.id === myPlayerId && !challenger.is_bot) {
          const lostHorse = challenger.horses.find(h => racerOwnershipKey(h) === cKey);
          if (lostHorse) {
            console.log("[RACER_FLOW] stamina_loss_popup", { racerName: lostHorse.name, playerId: challenger.id, reason: "stable_duel_stamina", isLegendary: !!lostHorse.isLegendary });
            const racerCategory: RacerCategory = lostHorse.isLegendary
              ? "legendary"
              : themeId.startsWith("car") ? "car" : "animal";
            setRacerLostModal({ horse: lostHorse, playerName: challenger.name, racerCategory });
          }
        }

        // Snapshot pro game over check — closure `players` je stale (před-settlement coiny)
        const postDuelPlayers = players.map(p => {
          if (p.id === challenger.id) return { ...p, coins: newCCoins };
          if (p.id === defender.id)   return { ...p, coins: newDCoins };
          return p;
        });

        const r = Math.abs(s.p1.coinsDelta);
        let resultLog: string[];
        if (result.winner === 1) {
          resultLog = [`⚔️ ${ctx.challenger.name} porazil ${ctx.defender.name}! (+${r}💰 vs −${r}💰)`];
        } else if (result.winner === 2) {
          resultLog = [`⚔️ ${ctx.defender.name} porazil ${ctx.challenger.name}! (+${r}💰 vs −${r}💰)`];
        } else {
          resultLog = [`⚔️ ${ctx.challenger.name} vs ${ctx.defender.name} — remíza (0💰)`];
        }

        // Pro online_1v1: zapiš sdílený finished stav, nech defender/spectators číst výsledek.
        // Cleanup offer_pending se odloží o krátkou dobu, aby Realtime stihlo doručit.
        const currentPending = gameState?.offer_pending as StableDuelPendingOffer | null;
        const isOnline1v1 = currentPending?.mode === "online_1v1" && !!gameId;
        if (isOnline1v1 && currentPending) {
          const finishedPending: StableDuelPendingOffer = {
            ...currentPending,
            phase: "finished",
            finishedAt: Date.now(),
            winnerId: result.winner === 1 ? ctx.challengerId : result.winner === 2 ? ctx.defenderId : undefined,
            loserId:  result.winner === 1 ? ctx.defenderId  : result.winner === 2 ? ctx.challengerId : undefined,
            resultSummary: {
              challengerId: ctx.challengerId!,
              defenderId:   ctx.defenderId!,
              winnerLabel:  result.winner === 1 ? ctx.challenger.name : result.winner === 2 ? ctx.defender.name : undefined,
              loserLabel:   result.winner === 1 ? ctx.defender.name   : result.winner === 2 ? ctx.challenger.name : undefined,
              coinsDelta:   r,
            },
          };
          await supabase.from("game_state").update({
            offer_pending: finishedPending as unknown as Record<string, unknown>,
          }).eq("game_id", gameId);

          // Odložený cleanup — ověří, že pending odpovídá tomuto souboji, pak zavolá finishTurn.
          const capturedGameId = gameId;
          const capturedCtx = { challengerId: ctx.challengerId, defenderId: ctx.defenderId };
          setTimeout(async () => {
            try {
              const { data: row, error } = await supabase
                .from("game_state").select("offer_pending").eq("game_id", capturedGameId).single();
              if (error) { console.error("[stable-duel-cleanup] fetch error", error); return; }
              const cur = row?.offer_pending as StableDuelPendingOffer | null;
              if (
                cur?.type === "stable_duel_pending" &&
                cur.phase === "finished" &&
                cur.challengerId === capturedCtx.challengerId &&
                cur.defenderId  === capturedCtx.defenderId
              ) {
                if (proceed) {
                  console.log("[stable-duel-cleanup] calling proceed");
                  await proceed(resultLog, updatedCHorses);
                  await checkAndFinishGame(postDuelPlayers);
                  console.log("[stable-duel-cleanup] success");
                } else {
                  console.warn("[stable-duel-cleanup] skipped — proceed is null");
                }
              } else {
                console.log("[stable-duel-cleanup] skipped — pending changed or not matching", cur?.phase);
              }
            } catch (e) {
              console.error("[stable-duel-cleanup] error", e);
            }
          }, 2500);
          return;
        }

        if (proceed) await proceed(resultLog, updatedCHorses);
        await checkAndFinishGame(postDuelPlayers);
        return;
      }
    }

    if (proceed) await proceed();
  }, [stableDuelCtx, players, myPlayerId, gameId, gameState?.offer_pending, gameMode]);

  /** Defender potvrdí připravenost pro online_1v1 — jen klient s myPlayerId === defenderId. */
  const handleDefenderReady = React.useCallback(async () => {
    if (!gameId || !myPlayerId) return;
    const current = gameState?.offer_pending;
    if (
      current?.type !== "stable_duel_pending" ||
      (current as StableDuelPendingOffer).mode !== "online_1v1" ||
      (current as StableDuelPendingOffer).defenderId !== myPlayerId ||
      (current as StableDuelPendingOffer).phase !== "pending"
    ) return;
    const pending = current as StableDuelPendingOffer;
    const updated: StableDuelPendingOffer = {
      ...pending,
      defenderReady: true,
      readyUpdatedAt: Date.now(),
      phase: pending.challengerReady !== false ? "both_ready" : "pending",
    };
    await supabase.from("game_state").update({
      offer_pending: updated as unknown as Record<string, unknown>,
    }).eq("game_id", gameId);
  }, [gameId, gameState?.offer_pending, myPlayerId]);

  /** Challenger přepne na PvBot fallback když defender nereaguje.
   *  Přepíše DB pending na pvbot_awareness, aby defender/spectators viděli standardní banner. */
  const handleFallbackToPvBot = React.useCallback(async () => {
    const sdPending = gameState?.offer_pending?.type === "stable_duel_pending"
      ? gameState.offer_pending as StableDuelPendingOffer
      : null;
    if (!sdPending || myPlayerId !== sdPending.challengerId) return;
    // Přepiš pending na pvbot_awareness — defender přestane vidět online_1v1 waiting panel
    if (gameId && sdPending.mode === "online_1v1") {
      const updated: StableDuelPendingOffer = { ...sdPending, mode: "pvbot_awareness", phase: "pending" };
      await supabase.from("game_state").update({
        offer_pending: updated as unknown as Record<string, unknown>,
      }).eq("game_id", gameId);
    }
    const cPlayer = players.find(p => p.id === sdPending.challengerId);
    const dPlayer = players.find(p => p.id === sdPending.defenderId);
    openStableDuelOverlay(
      {
        challenger: { name: sdPending.challengerName ?? cPlayer?.name ?? "Challenger", horse: getPreferredHorse(cPlayer?.horses ?? []), color: cPlayer?.color ?? "#00ff88", coins: cPlayer?.coins },
        defender:   { name: sdPending.defenderName ?? dPlayer?.name ?? "Defender",   horse: getPreferredHorse(dPlayer?.horses ?? []), color: dPlayer?.color ?? "#c084fc", coins: dPlayer?.coins },
        isPreview: false,
        challengerId: sdPending.challengerId,
        defenderId: sdPending.defenderId,
        mafiaBonus: sdPending.mafiaBonus,
      },
      `fallback_${sdPending.challengerId}_${sdPending.createdAt}`,
    );
  }, [gameId, gameState?.offer_pending, myPlayerId, players, openStableDuelOverlay]);

  // ── Stable Duel online_1v1 countdown ─────────────────────────────────────────

  // Challenger jednorázově zapíše "countdown" + startsAt po both_ready.
  // Idempotentní přes countdownStartedRef + guard sdPending.startsAt.
  React.useEffect(() => {
    const sdPending = gameState?.offer_pending?.type === "stable_duel_pending"
      ? gameState.offer_pending as StableDuelPendingOffer
      : null;
    if (!sdPending || sdPending.mode !== "online_1v1" || sdPending.phase !== "both_ready") return;
    if (!sdPending.challengerReady || !sdPending.defenderReady) return;
    if (sdPending.startsAt) return; // guard: startsAt již nastaveno (refresh)
    if (!gameId || myPlayerId !== sdPending.challengerId) return;

    const duelKey = `cdown_${sdPending.challengerId}_${sdPending.createdAt}`;
    if (countdownStartedRef.current === duelKey) return;
    countdownStartedRef.current = duelKey;

    const updated: StableDuelPendingOffer = {
      ...sdPending,
      phase: "countdown",
      countdownOwnerId: sdPending.challengerId,
      countdownStartedAt: Date.now(),
      startsAt: Date.now() + 10000,
    };
    console.log("[stable-duel-countdown] challenger writes countdown", { duelKey, startsAt: updated.startsAt });
    supabase.from("game_state").update({
      offer_pending: updated as unknown as Record<string, unknown>,
    }).eq("game_id", gameId).then((res: { error: unknown }) => {
      if (res.error) console.error("[stable-duel-countdown] supabase write failed", res.error);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState?.offer_pending, gameId, myPlayerId]);

  // Lokální interval počítá countdown z DB startsAt.
  // Pro spectatory aktualizuje countdownDisplay na board panelu.
  // Pro aktivní hráče otevře overlay hned při phase === "countdown" (ne až po startsAt).
  React.useEffect(() => {
    const sdPending = gameState?.offer_pending?.type === "stable_duel_pending"
      ? gameState.offer_pending as StableDuelPendingOffer
      : null;
    const startsAt = sdPending?.startsAt;
    if (!startsAt || sdPending?.mode !== "online_1v1" || sdPending.phase !== "countdown") {
      setCountdownDisplay(null);
      return;
    }
    const isChallenger = myPlayerId === sdPending.challengerId;
    const isDefender   = myPlayerId === sdPending.defenderId;
    const cId = sdPending.challengerId;
    const dId = sdPending.defenderId;
    const cName = sdPending.challengerName;
    const dName = sdPending.defenderName;
    const createdAt = sdPending.createdAt;
    const duelKey = `overlay_${cId}_${dId}_${createdAt}_${startsAt}`;

    // Open overlay immediately for active players — shared countdown runs inside overlay
    if (isChallenger || isDefender) {
      const cPlayer = players.find(p => p.id === cId);
      const dPlayer = players.find(p => p.id === dId);
      const duelId = `stable_duel:${cId}:${dId}:${createdAt}`;
      const ctxBase = {
        challenger: { name: cName ?? cPlayer?.name ?? "Challenger", horse: getPreferredHorse(cPlayer?.horses ?? []), color: cPlayer?.color ?? "#00ff88", coins: cPlayer?.coins },
        defender:   { name: dName ?? dPlayer?.name ?? "Defender",   horse: getPreferredHorse(dPlayer?.horses ?? []), color: dPlayer?.color ?? "#c084fc", coins: dPlayer?.coins },
        isPreview: false,
        challengerId: cId,
        defenderId: dId,
        duelId,
        sharedCountdownEndsAt: startsAt,
        mafiaBonus: sdPending.mafiaBonus,
      };
      if (isChallenger) {
        openStableDuelOverlay({ ...ctxBase, duelRole: "challenger_authority" }, duelKey);
      } else {
        openStableDuelOverlay({ ...ctxBase, duelRole: "defender_remote" }, `def_${duelKey}`);
      }
    }

    // Board panel display — used by spectators; active players see the overlay countdown
    const tick = () => {
      const remaining = startsAt - Date.now();
      if (remaining > 0) {
        setCountdownDisplay(String(Math.max(1, Math.ceil(remaining / 1000))));
      } else {
        setCountdownDisplay("START");
      }
    };

    tick();
    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState?.offer_pending, myPlayerId, players, openStableDuelOverlay]);

  // Zavře defender overlay jakmile challenger zapíše phase "finished" do DB.
  React.useEffect(() => {
    if (!stableDuelCtx || stableDuelCtx.duelRole !== "defender_remote") return;
    const sdPending = gameState?.offer_pending?.type === "stable_duel_pending"
      ? gameState.offer_pending as StableDuelPendingOffer
      : null;
    if (
      sdPending?.phase === "finished" &&
      sdPending.challengerId === stableDuelCtx.challengerId &&
      sdPending.defenderId === stableDuelCtx.defenderId
    ) {
      setStableDuelCtx(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState?.offer_pending, stableDuelCtx]);

  // ── Bot-created pvbot duel: auto-open overlay for human challenger ───────────
  // Když bot zapíše offer_pending s challengerId === myPlayerId a mode pvbot_awareness,
  // rollDice se nespustilo — overlay a stableDuelProceedRef musíme nastavit zde.
  React.useEffect(() => {
    const sdPending = gameState?.offer_pending?.type === "stable_duel_pending"
      ? gameState.offer_pending as StableDuelPendingOffer
      : null;
    if (!sdPending || sdPending.mode !== "pvbot_awareness") return;
    if (sdPending.challengerId !== myPlayerId) return;
    if (stableDuelCtx) return;
    if (stableDuelProceedRef.current) return; // nastaveno rollDice — nepřepisovat
    if (!gameState || !gameId || players.length === 0) return;
    if (botDuelHandledRef.current === sdPending.createdAt) return; // idempotent guard

    const cPlayer = players.find(p => p.id === sdPending.challengerId);
    const dPlayer = players.find(p => p.id === sdPending.defenderId);
    if (!cPlayer || !dPlayer) return;

    botDuelHandledRef.current = sdPending.createdAt;

    const challenger: DuelContestant = {
      name:   sdPending.challengerName ?? cPlayer.name,
      horse:  getPreferredHorse(cPlayer.horses),
      color:  cPlayer.color,
      coins:  cPlayer.coins,
    };
    const defender: DuelContestant = {
      name:   sdPending.defenderName ?? dPlayer.name,
      horse:  getPreferredHorse(dPlayer.horses),
      color:  dPlayer.color,
      coins:  dPlayer.coins,
    };

    const capturedNextIndex  = getNextActiveIndex(gameState.current_player_index, players);
    const capturedTurnCount  = gameState.turn_count + 1;
    const capturedLog        = [...(gameState.log ?? [])];
    const capturedCId        = sdPending.challengerId;
    const capturedDId        = sdPending.defenderId;

    stableDuelProceedRef.current = async (resultLog?: string[]) => {
      await finishTurn({
        nextIndex:          capturedNextIndex,
        turnCount:          capturedTurnCount,
        log:                [
          ...(resultLog ?? [`⚔️ ${challenger.name} vs ${defender.name} — stájový souboj skončil`]),
          ...capturedLog,
        ],
        clearOfferPending:  { type: "stable_duel_pending", challengerId: capturedCId, defenderId: capturedDId },
      });
    };

    openStableDuelOverlay(
      { challenger, defender, isPreview: false, challengerId: sdPending.challengerId, defenderId: sdPending.defenderId, mafiaBonus: sdPending.mafiaBonus },
      `pvbot_bot_${sdPending.challengerId}_${sdPending.defenderId}_${sdPending.createdAt}`,
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState?.offer_pending, myPlayerId, stableDuelCtx, players, gameId, openStableDuelOverlay]);

  // ── Helpers ──────────────────────────────────────────────────────────────────

  // Po načtení / refresh: obnov pendingRacer a pendingCard ze stavu DB
  React.useEffect(() => {
    if (!gameState || players.length === 0) return;
    if (gameState.horse_pending) {
      const currentP = players[gameState.current_player_index];
      const field = currentP ? fieldsRef.current[currentP.position] : null;
      if (field?.type === "racer" && field.racer && !currentP?.is_bot) {
        setPendingRacer({ racer: field.racer, playerIndex: gameState.current_player_index, flavorText: field.flavorText });
      } else {
        setPendingRacer(null);
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

  // Herní rok — startovní rok theme + počet průchodů STARTem lídra (player.laps)
  const leadLaps = players.reduce((max, p) => Math.max(max, p.laps ?? 0), 0);
  const gameYear = (theme.mapMeta?.yearStart ?? 1921) + leadLaps;
  const currentYearEvent = resolveYearEvent(leadLaps, gameYear, theme.yearEvents);
  const scenario = getScenarioForTheme(themeId);

  // Pro render desky: animující hráč se zobrazuje na animPosition, ne na DB pozici
  const displayPlayers = getDisplayPlayers(players, animatingPlayerIdx, animPosition);
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
  const raceResults = computeRaceResultsView(racePendingEvt, players);
  const isMyRaceTurn = !!(pendingRace?.phase === "racing" && (
    isLocalGame ? true : myPlayerId === pendingRace?.playerIds[pendingRace?.currentRacerIndex ?? -1]
  ));
  const isSpectator = viewerRole === "spectator";
  const hasPendingRollDecision = !!pendingRollDecision;
  const isMyPendingRollDecisionTurn = !!(pendingRollDecision && (
    isLocalGame ? viewerRole === "player" : myPlayerId === pendingRollDecision.playerId
  ));
  // Local: kdokoliv "player" může hodit za aktuálního hráče (hot-seat)
  // Online: jen hráč jehož ID sedí s localStorage
  const isMyTurn = isLocalGame
    ? (viewerRole === "player" && !!currentPlayer && !isBankrupt(currentPlayer) && !isRolling && !isMoving && !hasPendingRollDecision)
    : (!!myPlayerId && currentPlayer?.id === myPlayerId && !isBankrupt(currentPlayer) && !isRolling && !isMoving && !isSpectator && !hasPendingRollDecision);
  const currentRound = gameState ? Math.floor(gameState.turn_count / Math.max(1, players.length)) + 1 : 1;
  // Online: bankrotovaný hráč se stává pasivním pozorovatelem — vidí hru, ale nemůže jednat.
  // Local: všichni hráči sdílejí zařízení, pojem "můj hráč" neexistuje.
  const iAmBankrupt = !isLocalGame && !!myPlayer && isBankrupt(myPlayer);
  const rollDecisionOptions = pendingRollDecision
    ? buildRollDecisionOptions(pendingRollDecision, FIELDS, currentPlayer?.coins ?? 0)
    : [];

  // Mapa (racer.id ?? racer.name) → vlastník — id-first, name fallback pro stará data
  const racerOwnership = buildRacerOwnership(players);

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

  // Watchdog: pokud card_pending zůstane aktivní déle než 5 minut (selhání klienta), host ho
  // vyčistí. Nevolá applyCardEffect — pouze odblokuje hru smazáním stale pending stavu.
  // Před mazáním ověří, že DB stále obsahuje stejnou kartu (capturedCardId + capturedTurnCount).
  // 5 minut dává hráči čas přejít z PC na mobil nebo se krátce odpojit.
  const CARD_PENDING_WATCHDOG_MS = 5 * 60 * 1000;
  React.useEffect(() => {
    if (!gameState?.card_pending) return;
    if (!isHost && !isLocalGame) return;
    if (gameStatus !== "playing") return;
    const capturedCardId   = gameState.card_pending.id;
    const capturedTurnCount = gameState.turn_count;
    const timer = setTimeout(async () => {
      if (!gameId) return;
      const { data: fresh } = await supabase
        .from("game_state")
        .select("card_pending, turn_count")
        .eq("game_id", gameId)
        .single();
      if (!fresh?.card_pending) return; // klient mezitím vyřešil
      const freshCard = fresh.card_pending as { id?: string };
      if (freshCard.id !== capturedCardId || fresh.turn_count !== capturedTurnCount) return;
      console.warn("[watchdog] card_pending stale — clearing", { capturedCardId, capturedTurnCount });
      await supabase
        .from("game_state")
        .update({ card_pending: null })
        .eq("game_id", gameId)
        .eq("turn_count", capturedTurnCount); // safety: nemazat pokud tah pokročil
    }, CARD_PENDING_WATCHDOG_MS);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState?.card_pending
      ? gameState.card_pending.id + "_" + gameState.turn_count
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
    return (
      <GameFinishedScreen
        players={players}
        bustOrder={gameState?.bust_order ?? []}
        pageBackground={theme.colors.pageBackground}
        myPlayerId={myPlayerId}
        gameMode={gameMode}
        scenario={scenario}
        objectiveAwardedIds={gameState?.objective_rewards_awarded}
        objectiveCompletedBy={gameState?.objective_completed_by}
      />
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
      {/* bankruptWarning má vždy prioritu — pokrývá celý screen z-50 a sidebar by byl nedosažitelný */}
      {centerEvent && !bankruptWarning && (
        <CenterEventModal
          event={centerEvent}
          onConfirm={acceptOffer}
          onDecline={declineOffer}
          onApplyCard={pendingCard ? () => applyCardEffectRef.current(pendingCard.card, pendingCard.playerIndex) : undefined}
        />
      )}

      {/* ── Flash Toast (auto-dismiss spotlight pro výrazné momenty) ─────── */}
      {flashEvent && <FlashToast event={flashEvent} />}

      {/* ── Racer Lost Modal (stamina burnout po závodě) ─────────────────── */}
      {racerLostModal && (
        <RacerLostModal
          horse={racerLostModal.horse}
          playerName={racerLostModal.playerName}
          racerCategory={racerLostModal.racerCategory}
          onDismiss={() => setRacerLostModal(null)}
        />
      )}

      {/* ── Major Loss Overlay (ztráta >= 601 coins) ─────────────────────── */}
      {majorLossAmount !== null && (
        <MajorLossOverlay
          amount={majorLossAmount}
          onDismiss={clearMajorLoss}
        />
      )}

      {/* ── Major Gain Overlay (zisk >= 1000 coins) ───────────────────────── */}
      {majorGainAmount !== null && (
        <MajorGainOverlay
          amount={majorGainAmount}
          onDismiss={clearMajorGain}
        />
      )}

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
          myPlayerId={myPlayerId}
        />
      )}

      {/* ── Bankrot announcement ─────────────────────────────────────────── */}
      {bankruptAnn && <BankruptAnnouncementModal playerName={bankruptAnn.playerName} />}

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

      {gameCode && (
        <div className="bg-amber-100 border-b border-amber-300 px-4 py-2 text-center text-sm text-amber-800 font-mono font-bold tracking-widest">
          🎮 hra: {gameCode}
        </div>
      )}
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
            {!topPanelVisible ? (
              <button
                onClick={() => setTopPanelVisible(true)}
                className={`w-full rounded-[4px] py-1.5 text-[11px] font-medium text-center ring-1 ring-black/[0.06] ${theme.colors.cardBackground} ${theme.colors.textMuted} hover:opacity-80 transition`}
              >
                ↓ Zobrazit panel
              </button>
            ) : (
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
                          style={{ backgroundImage: "url('/new_end_backgroud.webp')", backgroundSize: "cover", backgroundPosition: "top center" }}
                        >
                          <div className="absolute inset-0 bg-[#f4efe4]/82 z-0" />
                          <div className="relative z-10">
                            {/* Prázdný prostor pro background masthead */}
                            <div className="pt-24" />
                            {/* Headline sekce */}
                            <div className="px-[15%] pb-4 border-b border-[#6b7257]/50">
                              <div className="text-[9px] font-bold uppercase tracking-[0.22em] text-[#6b7257]">Aktuální pořadí</div>
                              <h2 className="mt-1 font-serif text-2xl font-black leading-tight text-[#6b7257]">Průběžné výsledky dostihů</h2>
                            </div>
                            {/* Tabulka */}
                            <div className="px-[15%] py-5">
                              <ScoreTable
                                players={players}
                                bustOrder={gameState?.bust_order ?? []}
                              />
                            </div>
                            {/* Zavřít */}
                            <div className="px-[15%] pb-6">
                              <button
                                onClick={() => setScorePopupOpen(false)}
                                className="w-full border border-[#6b7257] bg-[#6b7257]/15 px-4 py-2.5 text-center text-sm font-semibold text-[#6b7257] hover:bg-[#6b7257]/25 transition"
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
              {/* Skrýt panel — vždy na pravém okraji */}
              <button
                onClick={() => setTopPanelVisible(false)}
                className="shrink-0 ml-1 rounded-[3px] px-1.5 py-1 text-[11px] text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
                title="Skrýt panel"
                aria-label="Skrýt panel"
              >
                ↑
              </button>
            </div>

            {/* DEV-only: Race Mode experiments — vlastní řádek pod HUD */}
            {process.env.NODE_ENV === "development" && (
              <DevToolbar
                onOpenRaceMode={() => setDevRaceMode(true)}
                onOpenRaceBoardLayer={() => setDevRaceBoardLayer(true)}
                onOpenFlip={openDevFlip}
                onOpenDuel={() => setDevDuelOpen(true)}
                onOpenSpeed={() => setDevSpeedOpen(true)}
                onOpenLegendary={() => setDevLegendaryOpen(true)}
                onOpenFinale={() => setDevFinaleOpen(true)}
                onOpenStableDuel={() => {
                  const p0 = players[0];
                  const p1 = players[1] ?? players[0];
                  setStableDuelCtx({
                    challenger: { name: p0?.name ?? "Hráč 1", horse: p0?.horses[0] ?? null, color: p0?.color ?? "#00ff88" },
                    defender:   { name: p1?.name ?? "Hráč 2", horse: p1?.horses[0] ?? null, color: p1?.color ?? "#c084fc" },
                    isPreview: true,
                  });
                  boardSurfaceRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                stableDuelMode={stableDuelMode}
                onToggleStableDuelMode={() => {
                  const next: "pvbot_awareness" | "online_1v1" = stableDuelMode === "online_1v1" ? "pvbot_awareness" : "online_1v1";
                  setStableDuelMode(next);
                  localStorage.setItem("stableDuelMode", next);
                }}
              />
            )}

            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-[3px] bg-emerald-100 px-2 py-1 text-emerald-800">🟢 {theme.labels.legend.gain}</span>
              <span className="rounded-[3px] bg-red-100 px-2 py-1 text-red-800">🔴 {theme.labels.legend.lose}</span>
              <span className="rounded-[3px] bg-violet-100 px-2 py-1 text-violet-800">🟣 {theme.labels.legend.gamble}</span>
              <span className="rounded-[3px] bg-amber-100 px-2 py-1 text-amber-800">🟠 {theme.labels.legend.racer}</span>
            </div>
            </div>
            )}{/* konec topPanelVisible podmínky */}

            {!stableDuelCtx && (
              <StableDuelStatusBanners
                offerPending={gameState?.offer_pending ?? null}
                myPlayerId={myPlayerId}
                viewerRole={viewerRole}
                countdownDisplay={countdownDisplay}
                handleDefenderReady={handleDefenderReady}
                handleFallbackToPvBot={handleFallbackToPvBot}
              />
            )}

            <BoardSurface
              surfaceRef={boardSurfaceRef}
              board={board}
              boardBgUrl={boardBgUrl}
              flipBoardAnim={flipBoardAnim}
              devFlipOpen={devFlipOpen}
              theme={theme}
              themeId={themeId}
              themeManifest={themeManifest}
              FIELDS={FIELDS}
              trailFields={trailFields}
              hoveredPlayerId={hoveredPlayerId}
              displayPlayers={displayPlayers}
              racerOwnership={racerOwnership}
              hoveredFieldIdx={hoveredFieldIdx}
              hoveredField={hoveredField}
              ghostMoveTarget={ghostMoveTarget}
              flippingFields={flippingFields}
              showingHiddenRef={showingHiddenRef}
              isFieldVisible={isFieldVisible}
              animatingPlayerIdx={animatingPlayerIdx}
              animPosition={animPosition}
              animatingPlayerId={animatingPlayerId}
              players={players}
              economy={economy}
              myPlayer={myPlayer}
              coinsFeedback={coinsFeedback}
              opponentMoneyEvent={opponentMoneyEvent}
              currentYearEvent={currentYearEvent}
              gameYear={gameYear}
              onHoverField={setHoveredFieldIdx}
              fieldSelectionMode={fieldSelectionMode}
              eligibleFieldIndexes={eligibleFieldIndexes}
              selectedFieldIndexes={selectedFieldIndexes}
              onSelectField={handleFieldSelect}
              myPlayerColor={myPlayer?.color}
              fieldOwnership={fieldOwnership}
            />
          </div>

          {/* Pravý panel */}
          <GamePanel
            theme={theme}
            players={players}
            gameState={gameState}
            currentPlayer={currentPlayer}
            soundEnabled={soundEnabled}
            toggleSound={toggleSound}
            shouldShowRacerGuide={shouldShowRacerGuide}
            shouldShowStaminaGuide={shouldShowStaminaGuide}
            shouldShowCorrectionGuide={shouldShowCorrectionGuide}
            shouldShowSoloLobbyGuide={shouldShowSoloLobbyGuide}
            dismissRacerGuide={dismissRacerGuide}
            dismissStaminaGuide={dismissStaminaGuide}
            dismissCorrectionGuide={dismissCorrectionGuide}
            dismissSoloLobbyGuide={dismissSoloLobbyGuide}
            onCancelGame={cancelGame}
            isRolling={isRolling}
            isMoving={isMoving}
            displayRoll={displayRoll}
            hasPendingRollDecision={hasPendingRollDecision}
            bankruptWarning={bankruptWarning}
            bankruptWarningResolverRef={bankruptWarningResolverRef}
            pendingCard={pendingCard}
            pendingRacer={pendingRacer}
            pendingRollDecision={pendingRollDecision}
            isMyTurn={isMyTurn}
            isMyPendingRollDecisionTurn={isMyPendingRollDecisionTurn}
            rollDecisionOptions={rollDecisionOptions}
            rollDecisionCountdown={rollDecisionCountdown}
            resolveRollDecision={resolveRollDecision}
            isFieldVisible={isFieldVisible}
            isSpectator={isSpectator}
            iAmBankrupt={iAmBankrupt}
            canReroll={canReroll}
            gameCode={gameCode}
            rollDice={rollDice}
            buyRacer={buyRacer}
            skipRacer={skipRacer}
            setPreferredRacer={setPreferredRacer}
            sellRacerToBank={sellRacerToBank}
            myPlayerId={myPlayerId}
            myDiscordAvatar={myDiscordAvatar}
            isLocalGame={isLocalGame}
            viewerRole={viewerRole}
            hoveredPlayerId={hoveredPlayerId}
            setHoveredPlayerId={setHoveredPlayerId}
            playSfx={playSfx}
            FIELDS={FIELDS}
            gameId={gameId}
            themeId={themeId}
            minigameBgUrl={minigameBgUrl}
            stableDuelCtx={stableDuelCtx}
            handleStableDuelFinish={handleStableDuelFinish}
            devRaceBoardLayer={devRaceBoardLayer}
            setDevRaceBoardLayer={setDevRaceBoardLayer}
            devFlipOpen={devFlipOpen}
            closeDevFlip={closeDevFlip}
            fieldSelectionMode={fieldSelectionMode}
            selectedFieldIndexes={selectedFieldIndexes}
            canStartFieldSelection={isMyTurn && !iAmBankrupt && (myPlayer?.coins ?? 0) >= 100 && eligibleFieldIndexes.size > 0}
            myPlayerCoins={myPlayer?.coins ?? 0}
            onStartFieldSelection={handleStartFieldSelection}
            onCancelOwnership={handleCancelOwnership}
            onConfirmOwnership={confirmFieldOwnership}
            fieldOwnershipLoading={fieldOwnershipLoading}
            fieldOwnershipError={fieldOwnershipError}
            discordThreadUrl={discordThreadUrl}
          />

        </div>
      </div>
      <StartFlowOverlay
        loading={loading}
        isLocalGame={isLocalGame}
        scenario={scenario}
        year={theme.mapMeta?.yearStart ?? 1921}
        place={theme.mapMeta?.place ?? "místní okruh"}
        subtitle={theme.mapMeta?.subtitle ?? "Každá mapa má svoje pravidla."}
        player={myPlayer}
        startingCoins={economy.startingCoins ?? DEFAULT_STARTING_COINS}
      />
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
        <DevDuelShell
          onExit={() => setDevDuelOpen(false)}
          themeSkin={{
            backgroundUrl:  minigameBgUrl || undefined,
            overlayOpacity: themeId.endsWith("night") ? 0.20 : 0.20,
            racingEmoji:    theme.labels.racingEmoji,
            themeName:      theme.name,
          }}
        />
      )}
      {/* DEV: Speed Arena — izolovaný lokální harness, žádný game state */}
      {process.env.NODE_ENV === "development" && devSpeedOpen && (
        <SpeedDevShell
          onExit={() => setDevSpeedOpen(false)}
          themeSkin={{
            backgroundUrl:  minigameBgUrl || undefined,
            overlayOpacity: themeId.endsWith("night") ? 0.20 : 0.20,
            racingEmoji:    theme.labels.racingEmoji,
            themeName:      theme.name,
          }}
        />
      )}
      {/* DEV: Legendary Horse Race — izolovaný lokální harness, žádný game state */}
      {process.env.NODE_ENV === "development" && devLegendaryOpen && (
        <LegendaryRaceDevShell onExit={() => setDevLegendaryOpen(false)} />
      )}
      {process.env.NODE_ENV === "development" && devFinaleOpen && (
        <div className="fixed inset-0 z-[70] overflow-auto">
          <button
            onClick={() => setDevFinaleOpen(false)}
            className="fixed top-4 right-4 z-[71] rounded-full bg-black/70 px-3 py-1.5 text-sm text-white hover:bg-black"
          >
            ✕ Zavřít preview
          </button>
          <GameFinishedScreen
            players={[
              { id: "p1", game_id: "dev", name: "Vítěz Šampion Zdeněk Novotný III.", position: 12, color: "bg-blue-500", coins: 4250, horses: [], turn_order: 0, skip_next_turn: false, discord_id: "disc1", is_bot: false },
              { id: "p2", game_id: "dev", name: "Poražená Kristýna Schwarzenbergová-Hohenlohe", position: 8, color: "bg-purple-500", coins: 0, horses: [], turn_order: 1, skip_next_turn: false, discord_id: "disc2", is_bot: false },
              { id: "p3", game_id: "dev", name: "Bot Automatický", position: 3, color: "bg-slate-400", coins: 0, horses: [], turn_order: 2, skip_next_turn: false, is_bot: true },
            ]}
            bustOrder={["p3", "p2"]}
            pageBackground={theme.colors.pageBackground}
            myPlayerId="p1"
            gameMode="online"
            scenario={null}
            xpReward={100}
          />
        </div>
      )}
      {isGuestPlayer && gameCode && <GuestBanner gameCode={gameCode} />}

      <div className="py-2 flex items-center justify-center gap-4 text-xs text-slate-400">
        <a href="/pravidla" className="hover:text-slate-600 underline">Pravidla hry</a>
        <span>·</span>
        <a href="/o-nas" className="hover:text-slate-600 underline">O nás</a>
        <span>·</span>
        <a href="mailto:info@paytowin.cz" className="hover:text-slate-600 underline">info@paytowin.cz</a>
        <span>·</span>
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 tracking-wide">Beta v0.7.21-seno</span>
      </div>
    </div>
  );

}
