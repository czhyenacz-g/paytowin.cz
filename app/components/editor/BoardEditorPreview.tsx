"use client";

/**
 * BoardEditorPreview — izolovaná preview hrací plochy pro theme creator / map editor.
 *
 * Záměrně NEZÁVISÍ na GameBoard.tsx — editor a gameplay board musí zůstat oddělené.
 * Bez game state, Realtime, animací, tahů, hráčů.
 *
 * Použití — uncontrolled (standalone):
 *   <BoardEditorPreview board={board} manifest={manifest} />
 *
 * Použití — controlled (ThemeDevTool):
 *   <BoardEditorPreview
 *     board={editableBoard}
 *     manifest={manifest}
 *     selectedIndex={selectedFieldIndex}
 *     onFieldClick={(field) => setSelectedFieldIndex(field.index)}
 *   />
 *
 * selectedIndex: pokud je předán (i null), komponenta je v controlled módu — parent
 * drží vybraný stav. Jinak komponenta drží vlastní interní stav.
 *
 * Detail vybraného pole se zobrazuje externě přes FieldEditorPanel v parentu.
 */

import React from "react";
import type { BoardConfig } from "@/lib/board/types";
import type { ThemeManifest } from "@/lib/themes/manifest";
import type { Field } from "@/lib/engine";
import { buildFields } from "@/lib/engine";
import {
  buildCardBackgroundImageValue,
  resolveFieldCardImagePath,
  resolveRacerCardImagePath,
} from "@/lib/themes/assets";
import type { FieldStyleKey } from "@/lib/themes";

// ─── Layout konstanty ─────────────────────────────────────────────────────────

/**
 * FIELD_POSITIONS — 21 pozic polí na kružnici r=42 % (center 50 %/50 %).
 *
 * Záměrně zkopírováno z GameBoard.tsx, ne importováno.
 * Důvod: editor nesmí být provázán s herní komponentou — různé životní cykly,
 * různý stav, různé budoucí potřeby layoutu.
 *
 * Vzorec: α = 180° − i × (360°/21)
 *   left = 50 + 42·cos(α)
 *   top  = 50 − 42·sin(α)
 */
const FIELD_POSITIONS: React.CSSProperties[] = [
  { top: "50.0%", left: "8.0%",  transform: "translate(-50%, -50%)" },  //  0 START
  { top: "37.7%", left: "9.8%",  transform: "translate(-50%, -50%)" },  //  1
  { top: "26.4%", left: "15.3%", transform: "translate(-50%, -50%)" },  //  2
  { top: "17.2%", left: "23.7%", transform: "translate(-50%, -50%)" },  //  3
  { top: "10.9%", left: "34.8%", transform: "translate(-50%, -50%)" },  //  4
  { top: "8.1%",  left: "46.9%", transform: "translate(-50%, -50%)" },  //  5
  { top: "9.1%",  left: "59.4%", transform: "translate(-50%, -50%)" },  //  6
  { top: "13.6%", left: "71.0%", transform: "translate(-50%, -50%)" },  //  7
  { top: "21.4%", left: "80.8%", transform: "translate(-50%, -50%)" },  //  8
  { top: "31.8%", left: "87.8%", transform: "translate(-50%, -50%)" },  //  9
  { top: "43.8%", left: "91.5%", transform: "translate(-50%, -50%)" },  // 10
  { top: "56.2%", left: "91.5%", transform: "translate(-50%, -50%)" },  // 11
  { top: "68.2%", left: "87.8%", transform: "translate(-50%, -50%)" },  // 12
  { top: "78.6%", left: "80.8%", transform: "translate(-50%, -50%)" },  // 13
  { top: "86.4%", left: "71.0%", transform: "translate(-50%, -50%)" },  // 14
  { top: "91.0%", left: "59.4%", transform: "translate(-50%, -50%)" },  // 15
  { top: "91.9%", left: "46.9%", transform: "translate(-50%, -50%)" },  // 16
  { top: "89.1%", left: "34.8%", transform: "translate(-50%, -50%)" },  // 17
  { top: "82.8%", left: "23.7%", transform: "translate(-50%, -50%)" },  // 18
  { top: "73.7%", left: "15.3%", transform: "translate(-50%, -50%)" },  // 19
  { top: "62.3%", left: "9.8%",  transform: "translate(-50%, -50%)" },  // 20
];

// Stadium layout — kopie z GameBoard.tsx (záměrně, editor musí být oddělený)
const FIELD_POSITIONS_STADIUM: React.CSSProperties[] = [
  { top: "50.00%", left: "10.00%", transform: "translate(-50%, -50%)" },  //  0 START
  { top: "40.37%", left: "12.23%", transform: "translate(-50%, -50%)" },  //  1
  { top: "32.61%", left: "18.54%", transform: "translate(-50%, -50%)" },  //  2
  { top: "28.45%", left: "27.59%", transform: "translate(-50%, -50%)" },  //  3
  { top: "28.00%", left: "37.48%", transform: "translate(-50%, -50%)" },  //  4
  { top: "28.00%", left: "47.50%", transform: "translate(-50%, -50%)" },  //  5
  { top: "28.00%", left: "57.51%", transform: "translate(-50%, -50%)" },  //  6
  { top: "28.00%", left: "67.52%", transform: "translate(-50%, -50%)" },  //  7
  { top: "30.04%", left: "77.27%", transform: "translate(-50%, -50%)" },  //  8
  { top: "36.13%", left: "85.08%", transform: "translate(-50%, -50%)" },  //  9
  { top: "45.05%", left: "89.42%", transform: "translate(-50%, -50%)" },  // 10
  { top: "54.97%", left: "89.42%", transform: "translate(-50%, -50%)" },  // 11
  { top: "63.88%", left: "85.07%", transform: "translate(-50%, -50%)" },  // 12
  { top: "69.97%", left: "77.25%", transform: "translate(-50%, -50%)" },  // 13
  { top: "72.00%", left: "67.51%", transform: "translate(-50%, -50%)" },  // 14
  { top: "72.00%", left: "57.51%", transform: "translate(-50%, -50%)" },  // 15
  { top: "72.00%", left: "47.50%", transform: "translate(-50%, -50%)" },  // 16
  { top: "72.00%", left: "37.48%", transform: "translate(-50%, -50%)" },  // 17
  { top: "71.55%", left: "27.56%", transform: "translate(-50%, -50%)" },  // 18
  { top: "67.38%", left: "18.51%", transform: "translate(-50%, -50%)" },  // 19
  { top: "59.63%", left: "12.23%", transform: "translate(-50%, -50%)" },  // 20
];

const FIELD_ROTATIONS_STADIUM: number[] = [
  -90, -64, -38, -12, 0, 0, 0, 0, 25, 51, 77, 103, 129, 155, 180, 180, 180, 180, 192, 218, 244,
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  board: BoardConfig;
  manifest: ThemeManifest;
  assetVersion?: number;
  /**
   * Vybraný index pole. Pokud je předán (i jako null), komponenta je controlled —
   * parent drží výběr. Pokud je undefined, komponenta drží vlastní interní stav.
   */
  selectedIndex?: number | null;
  /** Callback při kliknutí na pole. */
  onFieldClick?: (field: Field) => void;
}

// ─── Komponenta ───────────────────────────────────────────────────────────────

export default function BoardEditorPreview({
  board,
  manifest,
  assetVersion = 0,
  selectedIndex: controlledIndex,
  onFieldClick,
}: Props) {
  // Interní stav — použije se jen pokud není předán controlledIndex (uncontrolled mód)
  const [internalIndex, setInternalIndex] = React.useState<number | null>(null);

  const isControlled = controlledIndex !== undefined;
  const selectedIndex = isControlled ? controlledIndex : internalIndex;

  const themeId = manifest.meta.id;
  const fields = React.useMemo(
    () => buildFields(board, manifest.racers),
    [board, manifest.racers],
  );

  function withCacheBust(path: string | null | undefined): string | null {
    if (!path) return null;
    const separator = path.includes("?") ? "&" : "?";
    return `${path}${separator}v=${assetVersion}`;
  }

  const boardBgImage = withCacheBust(manifest.assets?.boardBackgroundImage);

  function handleFieldClick(field: Field) {
    if (!isControlled) setInternalIndex(field.index);
    onFieldClick?.(field);
  }

  // aspect-[20/16] musí odpovídat STADIUM_ASPECT v lib/board/constants.ts
  return (
    <div className={`relative mx-auto w-full overflow-visible ${board.shape === "stadium" ? "aspect-[20/16] max-w-[700px]" : "aspect-square max-w-[600px]"}`}>

      {/* Pozadí a SVG pásy — vizuálně identické s GameBoard */}
      <div
        className={`absolute inset-0 overflow-hidden rounded-[4px] border-2 ${manifest.colors.boardSurfaceBorder} ${manifest.colors.boardSurface}`}
        style={{
          ...(boardBgImage
            ? { backgroundImage: `url("${boardBgImage}")`, backgroundSize: "cover", backgroundPosition: "center" }
            : {}),
          boxShadow: "inset 0 2px 24px rgba(0,0,0,0.09), 0 4px 32px rgba(0,0,0,0.10)",
        }}
      >
        {/* SVG traťový pás */}
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          viewBox="0 0 100 100"
          style={{ zIndex: 0 }}
        >
          {board.shape === "stadium" ? (<>
            <path d="M 32 28 L 68 28 A 22 22 0 0 1 68 72 L 32 72 A 22 22 0 0 1 32 28 Z"
              fill="none" stroke="rgba(0,0,0,0.07)" strokeWidth="11" />
            <path d="M 32 28 L 68 28 A 22 22 0 0 1 68 72 L 32 72 A 22 22 0 0 1 32 28 Z"
              fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="11" />
          </>) : (<>
            <ellipse cx="50" cy="50" rx="42" ry="42" fill="none" stroke="rgba(0,0,0,0.07)" strokeWidth="11" />
            <ellipse cx="50" cy="50" rx="42" ry="42" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="11" />
          </>)}
        </svg>
      </div>

      {/* Pole */}
      <div className="absolute inset-0 overflow-visible">
        {fields.map((field) => {
          const pos = board.shape === "stadium"
            ? FIELD_POSITIONS_STADIUM[field.index]
            : FIELD_POSITIONS[field.index];
          if (!pos) return null;

          const isSelected = selectedIndex === field.index;
          const rotDeg = board.shape === "stadium"
            ? (FIELD_ROTATIONS_STADIUM[field.index] ?? 0)
            : field.index * (360 / 21) - 90;

          const fieldStyleKey = (field.type === "horse" ? "racer" : field.type) as FieldStyleKey;
          const fieldStyleCls = manifest.colors.fieldStyles[fieldStyleKey] ?? "";

          const primaryPath =
            field.type === "racer"
              ? resolveRacerCardImagePath(
                  themeId,
                  field.racer?.id,
                  field.racer?.image,
                )
              : resolveFieldCardImagePath(
                  themeId,
                  field.type,
                  manifest.assets?.fieldTextures?.[field.type],
                );

          const bgImage = buildCardBackgroundImageValue(withCacheBust(primaryPath));

          return (
            <div
              key={field.index}
              className={`absolute flex flex-col items-center justify-center overflow-hidden rounded-[2px] border-2 ring-1 shadow-[0_10px_18px_rgba(15,23,42,0.16)] cursor-pointer transition-all duration-150 ${fieldStyleCls} ${isSelected ? "ring-2 ring-indigo-400 ring-offset-1" : "ring-black/10"}`}
              style={{
                top: pos.top,
                left: pos.left,
                width: "82px",
                height: "112px",
                transform: `translate(-50%, -50%) rotate(${rotDeg}deg) scale(${isSelected ? 1.15 : 1.0})`,
                zIndex: isSelected ? 10 : 2,
                backgroundImage: bgImage,
                backgroundSize: "cover, cover",
                backgroundPosition: "center, center",
              }}
              onClick={() => handleFieldClick(field)}
              title={`Pole #${field.index} — ${field.label} (${field.type})`}
            >
              {/* Content — counter-rotovaný zpět do normálu */}
              <div
                className="relative z-10 flex w-full flex-col items-center gap-0.5 px-2 py-2"
                style={{ transform: `rotate(${-rotDeg}deg)` }}
              >
                <div className="leading-none text-lg">{field.emoji}</div>
                <div className="font-bold uppercase leading-tight text-center tracking-[0.08em] text-[9px] max-w-[60px]">
                  {field.type === "start" ? "START" : field.label}
                </div>
                {/* Index badge — jen v editoru */}
                <div className="mt-0.5 font-mono text-[7px] opacity-40">#{field.index}</div>
              </div>

              {/* Vybrané pole — checkmark */}
              {isSelected && (
                <div
                  className="absolute -top-1.5 -right-1.5 z-20 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-500 text-[8px] font-bold text-white shadow"
                  style={{ transform: `rotate(${-rotDeg}deg)` }}
                >
                  ✓
                </div>
              )}
            </div>
          );
        })}

        {/* Střed desky */}
        <div
          className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center border-2 p-4 text-center shadow-inner ${manifest.colors.centerBorder} ${manifest.colors.centerBackground}`}
          style={board.shape === "stadium"
            ? { width: "54%", height: "24%", borderRadius: "25%" }
            : { width: "44%", height: "44%", borderRadius: "50%" }}
        >
          <div>
            <div className="text-3xl">{manifest.racers[0]?.emoji ?? "🏁"}</div>
            <div className={`mt-1 text-[11px] font-semibold ${manifest.colors.centerTitle}`}>
              {manifest.meta.name}
            </div>
            <div className={`mt-0.5 text-[9px] ${manifest.colors.centerSubtitle}`}>
              editor · {fields.length} polí
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
