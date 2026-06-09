"use client";

import React from "react";

const TW_HEX: Record<string, string> = {
  "bg-emerald-500": "#10b981", "bg-violet-500": "#8b5cf6",
  "bg-amber-500":   "#f59e0b", "bg-rose-500":   "#f43f5e",
  "bg-sky-500":     "#0ea5e9", "bg-indigo-500": "#6366f1",
  "bg-pink-500":    "#ec4899", "bg-orange-500": "#f97316",
  "bg-teal-500":    "#14b8a6", "bg-red-500":    "#ef4444",
  "bg-blue-500":    "#3b82f6", "bg-green-500":  "#22c55e",
  "bg-yellow-500":  "#eab308", "bg-purple-500": "#a855f7",
  "bg-cyan-500":    "#06b6d4", "bg-lime-500":   "#84cc16",
  "bg-fuchsia-500": "#d946ef",
};
import type { Field } from "@/lib/engine";
import { isBankrupt, racerOwnershipKey } from "@/lib/engine";
import type { Player } from "@/lib/types/game";
import type { ThemeManifest } from "@/lib/themes/manifest";
import {
  FIELD_POSITIONS,
  FIELD_POSITIONS_STADIUM,
  FIELD_ROTATIONS_STADIUM,
} from "@/lib/board/layout";
import {
  buildCardBackgroundImageValue,
  resolveFieldCardImagePath,
  resolveRacerCardImagePath,
} from "@/lib/themes/assets";
import {
  getFieldAccentColor,
  getFieldDetail,
  getFieldMetaLabel,
  getFieldTone,
} from "@/lib/board/fieldHelpers";

interface Props {
  fields: Field[];
  boardShape: "circle" | "stadium" | undefined;
  trailFields: number[];
  hoveredPlayerId: string | null;
  displayPlayers: Player[];
  racerOwnership: Record<string, Player>;
  hoveredFieldIdx: number | null;
  ghostMoveTarget: number | null;
  themeId: string;
  themeManifest: ThemeManifest;
  fieldStyles: Record<string, string>;
  flippingFields: Set<number>;
  showingHiddenRef: React.MutableRefObject<Set<number>>;
  isFieldVisible: (field: { index: number; type: string }) => boolean;
  onHoverField: (idx: number | null) => void;
  // Field ownership selection mode
  selectionMode?: boolean;
  eligibleFieldIndexes?: Set<number>;
  selectedFieldIndexes?: number[];
  onSelectField?: (idx: number) => void;
  myPlayerColor?: string;
}

export default function FieldCardList({
  fields,
  boardShape,
  trailFields,
  hoveredPlayerId,
  displayPlayers,
  racerOwnership,
  hoveredFieldIdx,
  ghostMoveTarget,
  themeId,
  themeManifest,
  fieldStyles,
  flippingFields,
  showingHiddenRef,
  isFieldVisible,
  onHoverField,
  selectionMode = false,
  eligibleFieldIndexes,
  selectedFieldIndexes,
  onSelectField,
  myPlayerColor,
}: Props) {
  const playerHex = myPlayerColor
    ? (myPlayerColor.startsWith("#") || myPlayerColor.startsWith("rgb") ? myPlayerColor : TW_HEX[myPlayerColor] ?? "#f97316")
    : "#f97316";
  const isNight = themeId.includes("night");
  const labelBadgeClass = isNight
    ? "inline-flex max-w-[58px] items-center justify-center rounded-[10px] bg-white/20 px-1.5 py-0.5 text-[5.5px] font-medium uppercase leading-[1.05] tracking-[0.04em] text-white/70 shadow-[0_1px_0_rgba(255,255,255,0.10)]"
    : "inline-flex max-w-[58px] items-center justify-center rounded-[10px] bg-black/30 px-1.5 py-0.5 text-[5.5px] font-black uppercase leading-[1.05] tracking-[0.04em] text-white shadow-[0_1px_0_rgba(0,0,0,0.25)]";

  return (
    <>
      {fields.map((field) => {
        const pos = boardShape === "stadium"
          ? FIELD_POSITIONS_STADIUM[field.index]
          : FIELD_POSITIONS[field.index];
        const isTrail = trailFields.includes(field.index);
        const isHoverHighlight = hoveredPlayerId
          ? displayPlayers.some(p => p.id === hoveredPlayerId && p.position === field.index && !isBankrupt(p))
          : false;
        const owner = field.type === "racer" && field.racer ? racerOwnership[racerOwnershipKey(field.racer)] ?? null : null;
        const detail = getFieldDetail(field, owner?.name ?? null);
        const metaLabel = getFieldMetaLabel(field, owner?.name ?? null);
        const isHovered = hoveredFieldIdx === field.index;
        const tone = getFieldTone(field, themeId);
        const isDefaultMoveTarget = ghostMoveTarget === field.index;

        const posLeft = parseFloat(pos.left as string);
        const posTop  = parseFloat(pos.top  as string);
        const odx = posLeft - 50;
        const ody = posTop  - 50;
        const olen = Math.sqrt(odx * odx + ody * ody) || 1;
        const hoverShift = isHovered ? `translate(${(odx / olen) * 70}px, ${(ody / olen) * 70}px) ` : "";

        const rotDeg = boardShape === "stadium"
          ? (FIELD_ROTATIONS_STADIUM[field.index] ?? 0)
          : field.index * (360 / 21) - 90;

        const glows: string[] = [];
        if (isTrail) glows.push("drop-shadow(0 0 7px rgba(251,191,36,0.95))");
        if (isHoverHighlight) glows.push("drop-shadow(0 0 7px rgba(96,165,250,0.95))");
        if (owner) {
          const ownerHex = (() => {
            const c = owner.color;
            if (!c) return "#6366f1";
            if (c.startsWith("#") || c.startsWith("rgb")) return c;
            return TW_HEX[c] ?? "#6366f1";
          })();
          glows.push(`drop-shadow(0 0 6px ${ownerHex}cc)`);
          glows.push(`drop-shadow(0 0 14px ${ownerHex}88)`);
          glows.push(`drop-shadow(0 0 24px ${ownerHex}44)`);
        }

        // Selection mode glow — barva hráče
        const isEligible = selectionMode && !!eligibleFieldIndexes?.has(field.index);
        const isSelected = isEligible && !!selectedFieldIndexes?.includes(field.index);
        if (isSelected) {
          glows.push(`drop-shadow(0 0 10px ${playerHex}) drop-shadow(0 0 22px ${playerHex}cc) drop-shadow(0 0 6px white)`);
        } else if (isEligible) {
          glows.push(`drop-shadow(0 0 10px ${playerHex}) drop-shadow(0 0 22px ${playerHex}88)`);
        }

        const fieldBgPrimaryPath = field.type === "racer"
          ? resolveRacerCardImagePath(
              themeId,
              field.racer?.id,
              field.racer?.image,
            )
          : resolveFieldCardImagePath(
              themeId,
              field.type,
              themeManifest.assets?.fieldTextures?.[field.type]
            );
        const fieldBgImage = buildCardBackgroundImageValue(fieldBgPrimaryPath);

        return (
          <div
            key={field.index}
            className={`absolute overflow-visible${selectionMode && !isEligible ? " opacity-40" : ""}`}
            style={{
              top: pos.top,
              left: pos.left,
              width: "82px",
              height: "112px",
              transform: `${hoverShift}translate(-50%, -50%) rotate(${rotDeg}deg) scale(${isHovered ? 2.52 : 1.0})`,
              transition: "transform 0.18s ease-out, box-shadow 0.18s ease-out",
              zIndex: isHovered ? 100 : 2,
              filter: glows.length > 0 ? glows.join(" ") : undefined,
              cursor: selectionMode ? (isEligible ? "pointer" : "not-allowed") : "default",
            }}
            onMouseEnter={() => onHoverField(field.index)}
            onMouseLeave={() => onHoverField(null)}
            onClick={() => isEligible && onSelectField?.(field.index)}
          >
            {(!isFieldVisible(field) || showingHiddenRef.current.has(field.index)) ? (
              <div
                className={`relative h-full w-full overflow-hidden rounded-[2px] ring-1 ring-black/20 shadow-[0_10px_18px_rgba(15,23,42,0.16)]${flippingFields.has(field.index) ? " fog-card-flip" : ""}`}
                style={{
                  backgroundImage: "url('/fog-of-war-card.webp')",
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  border: "1px solid rgba(0,0,0,0.82)",
                  borderTopWidth: "6px",
                  borderTopColor: "rgba(30,41,59,0.9)",
                  perspective: "400px",
                }}
              />
            ) : (
            <div
              className={`group relative h-full w-full overflow-hidden rounded-[2px] ring-1 ring-black/10 shadow-[0_10px_18px_rgba(15,23,42,0.16)] ${fieldStyles[field.type]}${flippingFields.has(field.index) ? " fog-card-flip" : ""}`}
              style={{
                height: "100%",
                width: "100%",
                backgroundImage: fieldBgImage,
                backgroundSize: "cover, cover",
                backgroundPosition: "center, center",
                border: "1px solid rgba(0,0,0,0.82)",
                borderTopWidth: "6px",
                borderTopColor: getFieldAccentColor(field),
              }}
            >
              <div className={`pointer-events-none absolute inset-0 ${tone.cardOverlay}`} />
              {field.type !== "racer" && field.type !== "start" && (
                <div className="pointer-events-none absolute inset-0 bg-white/25 transition-opacity duration-150 group-hover:opacity-0" />
              )}
              {isSelected && (
                <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
                  <div className="rounded-full bg-green-500/90 p-1.5 shadow-lg">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                </div>
              )}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 px-2 pb-2">
              <div className="flex justify-center">
                <div className={labelBadgeClass}>
                    <span className="whitespace-normal break-words text-center">
                      {field.type === "start" ? "START" : field.label}
                    </span>
                  </div>
                </div>
              </div>

              <div
                className="relative z-10 flex h-full w-full flex-col justify-between"
                style={{ transform: `rotate(${-rotDeg}deg)` }}
              />
            </div>
            )}
          </div>
        );
      })}
    </>
  );
}
