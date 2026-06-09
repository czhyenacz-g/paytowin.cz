"use client";

import React from "react";

interface Params {
  gameCode: string | undefined;
  turnCount: number | null | undefined;
  viewerRole: string;
  /** true pokud hráč existuje v partii (myPlayer !== null) */
  hasPlayer: boolean;
  /** true pokud hráč zkrachoval */
  isPlayerBankrupt: boolean;
  /** počet závodníků hráče */
  horseCount: number;
  gameStatus: string;
}

interface UseGuideStateReturn {
  shouldShowCorrectionGuide: boolean;
  shouldShowRacerGuide: boolean;
  shouldShowStaminaGuide: boolean;
  dismissCorrectionGuide: () => void;
  dismissRacerGuide: () => void;
  dismissStaminaGuide: () => void;
}

export function useGuideState({
  gameCode,
  turnCount,
  viewerRole,
  hasPlayer,
  isPlayerBankrupt,
  horseCount,
  gameStatus,
}: Params): UseGuideStateReturn {
  const [correctionGuideDismissed, setCorrectionGuideDismissed] = React.useState(false);
  const [racerGuideDismissed, setRacerGuideDismissed] = React.useState(false);
  const [staminaGuideDismissed, setStaminaGuideDismissed] = React.useState(false);
  const [guideDismissedTurn, setGuideDismissedTurn] = React.useState<number | null>(null);

  // Init z localStorage při změně gameCode (nová hra = nový scope)
  React.useEffect(() => {
    const scope = gameCode ?? "local";
    setCorrectionGuideDismissed(localStorage.getItem(`paytowin_guide_correction_${scope}`) === "dismissed");
    setRacerGuideDismissed(localStorage.getItem(`paytowin_guide_racer_${scope}`) === "dismissed");
    setStaminaGuideDismissed(localStorage.getItem(`paytowin_guide_stamina_${scope}`) === "dismissed");
  }, [gameCode]);

  const dismissCorrectionGuide = React.useCallback(() => {
    const key = `paytowin_guide_correction_${gameCode ?? "local"}`;
    localStorage.setItem(key, "dismissed");
    setCorrectionGuideDismissed(true);
    setGuideDismissedTurn(turnCount ?? null);
  }, [gameCode, turnCount]);

  const dismissRacerGuide = React.useCallback(() => {
    const key = `paytowin_guide_racer_${gameCode ?? "local"}`;
    localStorage.setItem(key, "dismissed");
    setRacerGuideDismissed(true);
    setGuideDismissedTurn(turnCount ?? null);
  }, [gameCode, turnCount]);

  const dismissStaminaGuide = React.useCallback(() => {
    const key = `paytowin_guide_stamina_${gameCode ?? "local"}`;
    localStorage.setItem(key, "dismissed");
    setStaminaGuideDismissed(true);
    setGuideDismissedTurn(turnCount ?? null);
  }, [gameCode, turnCount]);

  const suppressGuideThisTurn = guideDismissedTurn !== null && guideDismissedTurn === (turnCount ?? null);
  const isVisible = viewerRole === "player" && !suppressGuideThisTurn && hasPlayer && !isPlayerBankrupt && gameStatus === "playing";

  const shouldShowCorrectionGuide = isVisible && !correctionGuideDismissed;
  const shouldShowRacerGuide      = isVisible && !racerGuideDismissed && horseCount === 0;
  const shouldShowStaminaGuide    = isVisible && !staminaGuideDismissed && horseCount > 0;

  return {
    shouldShowCorrectionGuide,
    shouldShowRacerGuide,
    shouldShowStaminaGuide,
    dismissCorrectionGuide,
    dismissRacerGuide,
    dismissStaminaGuide,
  };
}
