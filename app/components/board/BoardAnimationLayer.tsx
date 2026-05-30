"use client";

import type { Player } from "@/lib/types/game";
import { FIGURINE_POSITIONS, FIGURINE_POSITIONS_STADIUM } from "@/lib/board/layout";

interface Props {
  animatingPlayerIdx: number | null;
  animPosition: number | null;
  trailFields: number[];
  players: Player[];
  boardShape: "circle" | "stadium" | undefined;
}

export function BoardAnimationLayer({
  animatingPlayerIdx,
  animPosition,
  trailFields,
  players,
  boardShape,
}: Props) {
  return (
    <>
      {/* ── Trail dots — stopa za pohybující se figurkou ─────────────────── */}
      {animatingPlayerIdx !== null && trailFields.length > 0 && (() => {
        const n = trailFields.length;
        const trailColor = players[animatingPlayerIdx]?.color ?? "bg-amber-400";
        return trailFields.map((fieldIdx, i) => {
          const pos = boardShape === "stadium"
            ? FIGURINE_POSITIONS_STADIUM[fieldIdx]
            : FIGURINE_POSITIONS[fieldIdx];
          if (!pos) return null;
          const progress = n === 1 ? 1 : i / (n - 1);
          const opacity = 0.10 + progress * 0.38;
          const size = 4 + progress * 14;
          return (
            <div
              key={`trail-${fieldIdx}-${i}`}
              className="absolute pointer-events-none"
              style={{ left: pos.left, top: pos.top, transform: "translate(-50%, -50%)", zIndex: 11, width: `${size}px`, height: `${size}px` }}
            >
              <div className={`rounded-full ${trailColor}`} style={{ width: "100%", height: "100%", opacity }} />
            </div>
          );
        });
      })()}

      {/* ── Smooth floating figurine — plynulý pohyb s CSS transition ─── */}
      {animatingPlayerIdx !== null && animPosition !== null && (() => {
        const animPlayer = players[animatingPlayerIdx];
        if (!animPlayer) return null;
        const pos = boardShape === "stadium"
          ? FIGURINE_POSITIONS_STADIUM[animPosition]
          : FIGURINE_POSITIONS[animPosition];
        if (!pos) return null;
        return (
          <div
            className="absolute pointer-events-none"
            style={{ left: pos.left, top: pos.top, transform: "translate(-50%, -50%)", zIndex: 15, transition: "left 140ms ease-out, top 140ms ease-out" }}
          >
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-black text-black ring-2 ring-black/20 scale-125 animate-bounce ${animPlayer.color}`}
              style={{ boxShadow: "0 3px 0 rgba(0,0,0,0.35), 0 4px 6px rgba(0,0,0,0.25)" }}
              title={animPlayer.name}
            >
              {animPlayer.name.charAt(0).toUpperCase()}
            </div>
          </div>
        );
      })()}
    </>
  );
}
