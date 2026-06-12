"use client";

import type { Theme } from "@/lib/themes";
import type { Field } from "@/lib/engine";
import type { Player, Horse } from "@/lib/types/game";
import type { YearEvent } from "@/lib/year-events";
import type { OpponentMoneyEvent } from "@/app/hooks/useOpponentMoneyFeedback";
import { racerOwnershipKey } from "@/lib/engine";
import { getFieldDetail } from "@/lib/board/fieldHelpers";
import OpponentMoneyFeedbackCard from "./OpponentMoneyFeedbackCard";

interface CoinsFeedback {
  amount: number;
  kind: "gain" | "lose";
  playerName: string;
  fieldLabel: string;
}

interface Props {
  theme: Theme;
  themeId: string;
  boardShape: "circle" | "stadium" | undefined;
  hoveredField: Field | null;
  isFieldVisible: (field: Field) => boolean;
  coinsFeedback: CoinsFeedback | null;
  opponentMoneyEvent: OpponentMoneyEvent | null;
  currentYearEvent: YearEvent | null;
  gameYear: number;
  racerOwnership: Record<string, Player>;
}

export default function BoardCenterPanel({
  theme,
  themeId,
  boardShape,
  hoveredField,
  isFieldVisible,
  coinsFeedback,
  opponentMoneyEvent,
  currentYearEvent,
  gameYear,
  racerOwnership,
}: Props) {
  const isNight = themeId.includes("night");

  const panelStyle: React.CSSProperties = isNight ? {
    background: "rgba(5,8,20,0.82)",
    border: "1px solid rgba(255,255,255,0.13)",
    borderRadius: 12,
    boxShadow: "0 0 16px rgba(0,0,0,0.45)",
    padding: "8px 10px",
  } : {
    background: "rgba(255,252,235,0.90)",
    border: "1px solid rgba(120,100,70,0.22)",
    borderRadius: 12,
    boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
    padding: "8px 10px",
  };
  const typeBadgeCls = isNight ? "text-slate-500" : "text-stone-500";
  const nameCls      = isNight ? "text-slate-300 font-medium" : "text-stone-950 font-black";
  const subtitleCls  = isNight ? "text-slate-500" : "text-stone-600 font-medium";
  const lblCls       = isNight ? "text-slate-400 shrink-0" : "text-stone-500 shrink-0";
  const valCls       = isNight ? "tracking-tight text-slate-100" : "tracking-tight text-stone-800";
  const ownerCls     = isNight ? "text-slate-300 font-medium" : "text-stone-600 font-medium";

  const hasFeedback = !!coinsFeedback || !!opponentMoneyEvent;

  // Responsive sizes: smaller on mobile, normal on sm+
  const sizeClass = theme.assets?.centerBgImage
    ? "w-[52%] h-[36%] sm:w-[62%] sm:h-[42%]"
    : boardShape === "stadium"
      ? "w-[42%] h-[34%] sm:w-[50%] sm:h-[40%]"
      : "w-[38%] h-[38%] sm:w-[44%] sm:h-[44%]";

  const wrapperClassName = `absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center p-4 text-center ${sizeClass} ${hasFeedback ? "z-[20]" : ""} ${
    theme.assets?.centerBgImage
      ? ""
      : `${isNight ? "overflow-visible" : "overflow-hidden"} border-2 shadow-inner ${theme.colors.centerBorder}`
  } ${theme.colors.centerBackground}`;

  const wrapperStyle: React.CSSProperties = theme.assets?.centerBgImage
    ? {}
    : boardShape === "stadium"
      ? { borderRadius: "25%" }
      : { borderRadius: "50%" };

  return (
    <div className={wrapperClassName} style={wrapperStyle}>
      {theme.assets?.centerBgImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={theme.assets.centerBgImage}
          alt=""
          className="pointer-events-none absolute inset-0 h-full w-full object-contain"
        />
      )}

      {hoveredField && !isFieldVisible(hoveredField) ? (
        <div className="relative z-10 max-w-[180px] text-center">
          <div className="text-3xl">🌫️</div>
          <div className={`mt-2 text-sm font-semibold ${theme.colors.centerTitle}`}>Zakryté mlhou</div>
          <div className={`mt-1 text-xs ${theme.colors.centerDescriptionPill ?? theme.colors.centerSubtitle}`}>Sem ještě nikdo nedošel</div>
        </div>
      ) : hoveredField ? (
        <div className="relative z-10 max-w-[180px]">
          {(() => {
            // ── Racer profil ──────────────────────────────────────
            if (hoveredField.type === "racer" && hoveredField.racer) {
              const racer = hoveredField.racer;
              const owner = racerOwnership[racerOwnershipKey(racer)] ?? null;
              const speedStars = Math.min(racer.speed, 5);
              const racerTypeLabel = racer.isLegendary ? "legendární" : "závodník";

              if (owner) {
                const ownedHorse = owner.horses.find((h: Horse) => racerOwnershipKey(h) === racerOwnershipKey(racer));
                const currentStamina = ownedHorse?.stamina ?? ownedHorse?.maxStamina ?? 100;
                const staminaDots = Math.round(currentStamina / 20);
                return (
                  <div style={panelStyle} className="space-y-1 text-[10px]">
                    <div className={`font-black uppercase tracking-[0.18em] text-[9px] ${typeBadgeCls}`}>{racerTypeLabel}</div>
                    <div className={`text-sm ${nameCls}`}>{racer.name}</div>
                    {racer.image && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={racer.image} alt={racer.name} className="mx-auto mt-1 h-14 w-14 rounded-lg object-cover bg-slate-100" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                    )}
                    <div className={ownerCls}>✓ {owner.name}</div>
                    <div className="flex items-center justify-between gap-3">
                      <span className={lblCls}>Rychlost</span>
                      <span className={valCls}>{"⭐".repeat(speedStars)}{"·".repeat(5 - speedStars)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className={lblCls}>Stamina</span>
                      <span className={valCls}>{"🔵".repeat(staminaDots)}{"·".repeat(5 - staminaDots)}</span>
                    </div>
                  </div>
                );
              }

              const maxStamina = racer.maxStamina ?? racer.stamina ?? 100;
              const staminaDots = Math.round(maxStamina / 20);
              return (
                <div style={panelStyle} className="space-y-1 text-[10px]">
                  <div className={`font-black uppercase tracking-[0.18em] text-[9px] ${typeBadgeCls}`}>{racerTypeLabel}</div>
                  <div className={`text-sm ${nameCls}`}>{racer.name}</div>
                  {racer.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={racer.image} alt={racer.name} className="mx-auto mt-1 h-14 w-14 rounded-lg object-cover bg-slate-100" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                  )}
                  <div className="flex items-center justify-between gap-3">
                    <span className={lblCls}>Rychlost</span>
                    <span className={valCls}>{"⭐".repeat(speedStars)}{"·".repeat(5 - speedStars)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className={lblCls}>Max stamina</span>
                    <span className={valCls}>{"🔵".repeat(staminaDots)}{"·".repeat(5 - staminaDots)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className={lblCls}>Cena</span>
                    <span className={`font-semibold ${valCls}`}>{racer.price} 💰</span>
                  </div>
                </div>
              );
            }

            // ── Ostatní pole (coins, chance, start, slot, …) ─────
            const fieldTypeBadge =
              hoveredField.type === "racer"      ? "slot"   :
              hoveredField.type === "coins_gain" ? "reward" :
              hoveredField.type === "coins_lose" ? "risk"   :
              hoveredField.type;
            const fieldName = hoveredField.type === "start" ? "START" : hoveredField.label;
            const detail = getFieldDetail(hoveredField, null);

            return (
              <div style={panelStyle} className="space-y-1 text-[10px]">
                <div className={`font-black uppercase tracking-[0.18em] text-[9px] ${typeBadgeCls}`}>{fieldTypeBadge}</div>
                <div className={`text-sm ${nameCls}`}>{fieldName}</div>
                {detail && <div className={subtitleCls}>{detail}</div>}
                {hoveredField.flavorText && (
                  <div className={`text-[9px] italic leading-relaxed opacity-70 ${subtitleCls}`}>
                    {hoveredField.flavorText}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      ) : coinsFeedback ? (
        <div className="relative z-10" style={{ transition: "opacity 0.25s ease" }}>
          <div
            className="text-5xl font-black tabular-nums leading-none"
            style={{ color: coinsFeedback.kind === "gain" ? "#34d399" : "#f87171" }}
          >
            {coinsFeedback.kind === "gain" ? "+" : ""}{coinsFeedback.amount} 💰
          </div>
          <div className={`mt-2 text-xs font-semibold uppercase tracking-wide ${theme.colors.centerTitle}`}>
            {coinsFeedback.playerName}
          </div>
          <div className={`mt-0.5 text-[10px] ${theme.colors.centerSubtitle} opacity-70`}>
            {coinsFeedback.fieldLabel}
          </div>
        </div>
      ) : opponentMoneyEvent ? (
        <OpponentMoneyFeedbackCard event={opponentMoneyEvent} centerTitleClass={theme.colors.centerTitle} />
      ) : (
        <div className="relative z-10 hidden sm:flex flex-col items-center text-center">
          <div className="text-4xl">{theme.labels.racingEmoji}</div>
          <div className={`mt-1 text-sm font-semibold ${theme.colors.centerTitle}`}>{theme.labels.centerTitle}</div>
          <div className={`mt-1 text-xs font-medium ${theme.colors.centerDescriptionPill ?? theme.colors.centerSubtitle}`}>{theme.labels.centerSubtitle}</div>
          <div className={`mt-2 text-[11px] font-semibold tabular-nums ${theme.colors.centerSubtitle}`}>
            {currentYearEvent ? `${gameYear} — ${currentYearEvent.title}` : gameYear}
          </div>
        </div>
      )}
    </div>
  );
}
