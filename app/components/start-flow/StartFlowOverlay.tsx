"use client";

import React from "react";
import IntroOverlay from "@/app/components/IntroOverlay";
import PersonalObjectiveOverlay from "./PersonalObjectiveOverlay";
import SharedObjectiveOverlay from "./SharedObjectiveOverlay";
import type { ScenarioDefinition } from "@/lib/scenarios";
import {
  getPersonalObjectiveForPlayer,
  getSharedObjectiveForGame,
} from "@/lib/scenarios/objectives";
import { DEFAULT_STARTING_COINS } from "@/lib/game-constants";

/**
 * StartFlowOverlay — orchestruje startovní overlay sekvenci mimo GameBoard.tsx.
 *
 * Sekvence fází:
 *   "idle"              → čeká na dokončení loadingu
 *   "intro"             → veřejný scenario intro (IntroOverlay)
 *   "shared_contract"   → společný kontrakt pro hotseat hru (SharedObjectiveOverlay)
 *   "personal_contract" → osobní kontrakt pro online hru (PersonalObjectiveOverlay)
 *   "done"              → konec, overlay skryt
 *
 * Rozhodovací strom po intro:
 *   local/hotseat + sharedObjective  → shared_contract
 *   online + player + personalObj    → personal_contract
 *   jinak                            → done
 */

type Phase = "idle" | "intro" | "shared_contract" | "personal_contract" | "done";

interface Props {
  /** True dokud GameBoard načítá data — overlay čeká a nezobrazí intro předčasně. */
  loading: boolean;
  /** True pro lokální/hotseat hru; false pro online. */
  isLocalGame: boolean;
  /** Scenario pro aktuální mapu; null = mapa bez scénáře. */
  scenario: ScenarioDefinition | null;
  year: number;
  place: string;
  subtitle: string;
  /** Hráč přihlášený v aktuálním prohlížeči; null = pozorovatel nebo nepřihlášený. */
  player: { id: string; turn_order?: number | null } | null;
  /** Počáteční coins hry — pro zobrazení v scenario textu místo fixní konstanty. */
  startingCoins?: number;
  /** Zavolá se po dokončení celé sekvence (všechny fáze hotovy). */
  onFlowDone?: () => void;
}

export default function StartFlowOverlay({
  loading,
  isLocalGame,
  scenario,
  year,
  place,
  subtitle,
  player,
  startingCoins,
  onFlowDone,
}: Props) {
  const [phase, setPhase] = React.useState<Phase>("idle");
  const shownRef = React.useRef(false);

  React.useEffect(() => {
    if (loading || shownRef.current) return;
    shownRef.current = true;
    setPhase("intro");
  }, [loading]);

  // Odvozeno čistě — žádný nový state, stabilní mezi rendery
  const sharedObjective =
    scenario && isLocalGame ? getSharedObjectiveForGame(scenario) : null;

  const personalObjective =
    scenario && !isLocalGame && player
      ? getPersonalObjectiveForPlayer(scenario, player)
      : null;

  const handleIntroDone = React.useCallback(() => {
    if (sharedObjective) {
      setPhase("shared_contract");
    } else if (personalObjective) {
      setPhase("personal_contract");
    } else {
      setPhase("done");
      onFlowDone?.();
    }
  }, [sharedObjective, personalObjective, onFlowDone]);

  const handleContractDone = React.useCallback(() => {
    setPhase("done");
    onFlowDone?.();
  }, [onFlowDone]);

  if (phase === "idle" || phase === "done") return null;

  if (phase === "intro") {
    const startingMoneyFormatted = (startingCoins ?? DEFAULT_STARTING_COINS).toLocaleString("cs-CZ");
    const resolvedPublicObjectiveText = scenario?.publicObjectiveText?.replace(
      "{startingMoney}",
      startingMoneyFormatted,
    );
    const hasLongContent = !!(scenario?.introText || scenario?.publicObjectiveText);
    return (
      <IntroOverlay
        year={year}
        place={place}
        subtitle={subtitle}
        introText={scenario?.introText}
        publicObjectiveTitle={scenario?.publicObjectiveTitle}
        publicObjectiveText={resolvedPublicObjectiveText}
        disableAutoDismiss={hasLongContent}
        onDone={handleIntroDone}
      />
    );
  }

  if (phase === "shared_contract" && sharedObjective) {
    return (
      <SharedObjectiveOverlay objective={sharedObjective} onDone={handleContractDone} />
    );
  }

  if (phase === "personal_contract" && personalObjective) {
    return (
      <PersonalObjectiveOverlay objective={personalObjective} onDone={handleContractDone} />
    );
  }

  return null;
}
