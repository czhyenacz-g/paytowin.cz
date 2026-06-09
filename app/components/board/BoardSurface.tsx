"use client";

import React from "react";
import type { Field } from "@/lib/engine";
import { isBankrupt, getStartTax } from "@/lib/engine";
import type { Player, EconomyConfig } from "@/lib/types/game";
import type { Theme } from "@/lib/themes";
import type { ThemeManifest } from "@/lib/themes/manifest";
import type { BoardConfig } from "@/lib/board";
import { FIGURINE_POSITIONS, FIGURINE_POSITIONS_STADIUM } from "@/lib/board/layout";
import type { YearEvent } from "@/lib/year-events";
import type { OpponentMoneyEvent } from "@/app/hooks/useOpponentMoneyFeedback";
import FieldCardList from "./FieldCardList";
import { BoardAnimationLayer } from "./BoardAnimationLayer";
import BoardCenterPanel from "../center-panel/BoardCenterPanel";

interface Props {
  surfaceRef: React.RefObject<HTMLDivElement | null>;
  board: BoardConfig;
  boardBgUrl: string;
  flipBoardAnim: "idle" | "out" | "back-in";
  devFlipOpen: boolean;
  theme: Theme;
  themeId: string;
  themeManifest: ThemeManifest;
  FIELDS: Field[];
  trailFields: number[];
  hoveredPlayerId: string | null;
  displayPlayers: Player[];
  racerOwnership: Record<string, Player>;
  hoveredFieldIdx: number | null;
  hoveredField: Field | null;
  ghostMoveTarget: number | null;
  flippingFields: Set<number>;
  showingHiddenRef: React.MutableRefObject<Set<number>>;
  isFieldVisible: (field: { index: number; type: string }) => boolean;
  animatingPlayerIdx: number | null;
  animPosition: number | null;
  animatingPlayerId: string | null;
  players: Player[];
  economy: EconomyConfig;
  myPlayer: Player | null;
  coinsFeedback: { amount: number; kind: "gain" | "lose"; playerName: string; fieldLabel: string } | null;
  opponentMoneyEvent: OpponentMoneyEvent | null;
  currentYearEvent: YearEvent | null;
  gameYear: number;
  onHoverField: (idx: number | null) => void;
  // Field ownership selection mode
  fieldSelectionMode?: boolean;
  eligibleFieldIndexes?: Set<number>;
  selectedFieldIndexes?: number[];
  onSelectField?: (idx: number) => void;
  myPlayerColor?: string;
}

export function BoardSurface({
  surfaceRef,
  board,
  boardBgUrl,
  flipBoardAnim,
  devFlipOpen,
  theme,
  themeId,
  themeManifest,
  FIELDS,
  trailFields,
  hoveredPlayerId,
  displayPlayers,
  racerOwnership,
  hoveredFieldIdx,
  hoveredField,
  ghostMoveTarget,
  flippingFields,
  showingHiddenRef,
  isFieldVisible,
  animatingPlayerIdx,
  animPosition,
  animatingPlayerId,
  players,
  economy,
  myPlayer,
  coinsFeedback,
  opponentMoneyEvent,
  currentYearEvent,
  gameYear,
  onHoverField,
  fieldSelectionMode = false,
  eligibleFieldIndexes,
  selectedFieldIndexes,
  onSelectField,
  myPlayerColor,
}: Props) {
  const fieldPlayers = (fieldIndex: number) =>
    displayPlayers.filter((p) => p.position === fieldIndex && !isBankrupt(p) && p.id !== animatingPlayerId);

  return (
    /* aspect-[20/18] musí odpovídat STADIUM_ASPECT v lib/board/constants.ts */
    <div ref={surfaceRef} className={`relative mx-auto w-full overflow-visible ${board.shape === "stadium" ? "aspect-[20/18]" : "aspect-square max-w-[760px]"}`}>
      <div
        className={`absolute inset-0 overflow-hidden rounded-[4px] border-2 ${theme.colors.boardSurfaceBorder} ${theme.colors.boardSurface}`}
        style={{
          boxShadow: "inset 0 2px 24px rgba(0,0,0,0.09), 0 4px 32px rgba(0,0,0,0.10)",
          transition: flipBoardAnim !== "idle" ? "transform 0.3s ease-in-out" : "none",
          transform: (devFlipOpen && flipBoardAnim !== "back-in") || flipBoardAnim === "out"
            ? "perspective(900px) rotateY(-90deg)"
            : "perspective(900px) rotateY(0deg)",
        }}
      >
        {boardBgUrl && (
          <div
            className="pointer-events-none absolute inset-0"
            style={{ backgroundImage: `url(${boardBgUrl})`, backgroundSize: "cover", backgroundPosition: "center", opacity: 0.5 }}
          />
        )}

        {/* ── SVG traťový pás ── */}
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          viewBox="0 0 100 100"
          style={{ zIndex: 0 }}
        >
          {board.shape === "stadium" ? (<>
            {/* Stadium: zaoblený obdélník, r=22, rovné strany hw=18 */}
            <path d="M 32 28 L 68 28 A 22 22 0 0 1 68 72 L 32 72 A 22 22 0 0 1 32 28 Z"
              fill="none" stroke="rgba(0,0,0,0.07)" strokeWidth="11" />
            <path d="M 32 28 L 68 28 A 22 22 0 0 1 68 72 L 32 72 A 22 22 0 0 1 32 28 Z"
              fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="11" />
          </>) : (<>
            <ellipse cx="50" cy="50" rx="42" ry="42"
              fill="none" stroke="rgba(0,0,0,0.07)" strokeWidth="11" />
            <ellipse cx="50" cy="50" rx="42" ry="42"
              fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="11" />
          </>)}
        </svg>
      </div>

      <div className="absolute inset-0 overflow-visible">
        <FieldCardList
          fields={FIELDS}
          boardShape={board.shape}
          trailFields={trailFields}
          hoveredPlayerId={hoveredPlayerId}
          displayPlayers={displayPlayers}
          racerOwnership={racerOwnership}
          hoveredFieldIdx={hoveredFieldIdx}
          ghostMoveTarget={ghostMoveTarget}
          themeId={themeId}
          themeManifest={themeManifest}
          fieldStyles={theme.colors.fieldStyles}
          flippingFields={flippingFields}
          showingHiddenRef={showingHiddenRef}
          isFieldVisible={isFieldVisible}
          onHoverField={onHoverField}
          selectionMode={fieldSelectionMode}
          eligibleFieldIndexes={eligibleFieldIndexes}
          selectedFieldIndexes={selectedFieldIndexes}
          onSelectField={onSelectField}
          myPlayerColor={myPlayerColor}
        />

        {/* Ghost marker pro původní cíl hodu — zobrazen na pozici figurky (blíže středu) */}
        {ghostMoveTarget !== null && (() => {
          const pos = board.shape === "stadium"
            ? FIGURINE_POSITIONS_STADIUM[ghostMoveTarget]
            : FIGURINE_POSITIONS[ghostMoveTarget];
          if (!pos) return null;
          return (
            <div
              key="ghost-move-target"
              className="absolute z-10 pointer-events-none flex items-center justify-center"
              style={{ ...pos, width: "32px", height: "32px" }}
            >
              <div
                className="h-5 w-5 rounded-full bg-yellow-400/80 border-2 border-white/60 shadow-[0_0_15px_#fbbf24,0_0_30px_#fbbf24] animate-pulse"
                title="Původní cíl hodu"
              />
            </div>
          );
        })()}

        {/* Figurky hráčů — mimo čtverce polí, posunuté ke středu */}
        {FIELDS.map((field) => {
          const playersHere = fieldPlayers(field.index);
          if (playersHere.length === 0) return null;
          return (
            <div
              key={`fig-${field.index}`}
              className="absolute flex items-center justify-center gap-0.5"
              style={{
                ...(board.shape === "stadium"
                  ? FIGURINE_POSITIONS_STADIUM[field.index]
                  : FIGURINE_POSITIONS[field.index]),
                zIndex: 10,
              }}
            >
              {playersHere.map((player) => {
                const isAnimatingThis = player.id === animatingPlayerId;
                return (
                  <div
                    key={player.id}
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-black text-black ring-2 ring-black/20 ${player.color} ${isAnimatingThis ? "scale-125 animate-bounce" : "animate-figurine-bob"}`}
                    style={{ boxShadow: "0 3px 0 rgba(0,0,0,0.35), 0 4px 6px rgba(0,0,0,0.25)", animationDelay: isAnimatingThis ? "0s" : `${(player.turn_order % 4) * 0.28}s` }}
                    title={player.name}
                  >
                    {player.name.charAt(0).toUpperCase()}
                  </div>
                );
              })}
            </div>
          );
        })}

        <BoardAnimationLayer
          animatingPlayerIdx={animatingPlayerIdx}
          animPosition={animPosition}
          trailFields={trailFields}
          players={players}
          boardShape={board.shape}
        />

        {/* ── Info blok Startu — pod kartou (pole 0 je rotovaná -90°, zabírá levou hranu)  */}
        {(() => {
          const startBonus = economy.stateSubsidy;
          const myLaps = (myPlayer?.laps ?? 0);
          const myNextTax = getStartTax(myLaps, economy);
          return (
            <div
              className="absolute pointer-events-none select-none"
              style={{ top: "50%", left: 0, transform: "translate(-108%, -50%)", zIndex: 3 }}
            >
              <div className="rounded-lg bg-black/40 px-2 py-1.5 backdrop-blur-sm space-y-0.5">
                <div className="text-[9px] font-bold text-white/70 whitespace-nowrap tracking-wide">
                  📅 Roční uzávěrka
                </div>
                <div className="text-[9px] font-semibold text-green-400 whitespace-nowrap pointer-events-auto cursor-help" title='Příspěvek za to, že lezete do "přízně" těm, kdo jsou právě u moci.'>
                  Příspěvek: +{startBonus} 💰
                </div>
                {myNextTax > 0 ? (
                  <div className="text-[9px] font-semibold text-red-400 whitespace-nowrap pointer-events-auto cursor-help" title="Daně, nebo výpalné... ve výsledku je to asi jedno.">
                    Daně: −{myNextTax} 💰
                  </div>
                ) : (
                  <div className="text-[9px] text-white/40 whitespace-nowrap">
                    Bez daní
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        <BoardCenterPanel
          theme={theme}
          themeId={themeId}
          boardShape={board.shape}
          hoveredField={hoveredField}
          isFieldVisible={isFieldVisible}
          coinsFeedback={coinsFeedback}
          opponentMoneyEvent={opponentMoneyEvent}
          currentYearEvent={currentYearEvent}
          gameYear={gameYear}
          racerOwnership={racerOwnership}
        />

        {/* Mobilní feedback overlay — zobrazí se nad kartami pouze na malých obrazovkách */}
        {(coinsFeedback || opponentMoneyEvent) && (
          <div className="md:hidden absolute inset-0 z-[30] flex items-center justify-center pointer-events-none">
            <div className="rounded-2xl bg-black/80 px-6 py-5 text-center shadow-2xl backdrop-blur-sm">
              {coinsFeedback && (
                <>
                  <div
                    className="text-5xl font-black tabular-nums leading-none"
                    style={{ color: coinsFeedback.kind === "gain" ? "#34d399" : "#f87171" }}
                  >
                    {coinsFeedback.kind === "gain" ? "+" : ""}{coinsFeedback.amount} 💰
                  </div>
                  <div className="mt-2 text-xs font-semibold uppercase tracking-wide text-white/70">
                    {coinsFeedback.playerName}
                  </div>
                  <div className="mt-0.5 text-[10px] text-white/50">
                    {coinsFeedback.fieldLabel}
                  </div>
                </>
              )}
              {opponentMoneyEvent && (
                <>
                  <div
                    className="text-[10px] font-semibold uppercase tracking-widest mb-1.5 opacity-60"
                    style={{ color: opponentMoneyEvent.kind === "gain" ? "#fbbf24" : "#94a3b8" }}
                  >
                    {opponentMoneyEvent.kind === "gain" ? "Soupeř získal" : "Ztráta soupeře"}
                  </div>
                  <div
                    className="text-4xl font-black tabular-nums leading-none"
                    style={{ color: opponentMoneyEvent.kind === "gain" ? "#fbbf24" : "#f87171" }}
                  >
                    {opponentMoneyEvent.kind === "gain" ? "+" : "-"}{opponentMoneyEvent.amount} 💰
                  </div>
                  <div className="mt-2 text-xs font-semibold text-white/70">
                    {opponentMoneyEvent.playerName}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
