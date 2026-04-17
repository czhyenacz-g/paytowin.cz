"use client";

import type { FlashEvent } from "@/lib/types/events";

interface Props {
  event: FlashEvent;
}

/**
 * FlashToast — krátký non-blocking spotlight pro výrazné herní momenty.
 * Auto-dismiss řídí rodič (setTimeout → setFlashEvent(null)).
 * pointer-events-none: nekryje interakci s boardem.
 */
export default function FlashToast({ event }: Props) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center pointer-events-none"
      aria-live="assertive"
    >
      {event.type === "legendary_gone" && (
        <LegendaryGoneContent event={event} />
      )}
      {event.type === "coins_penalty" && (
        <CoinsPenaltyContent event={event} />
      )}
    </div>
  );
}

// ── Legenda mizí ─────────────────────────────────────────────────────────────

function LegendaryGoneContent({
  event,
}: {
  event: Extract<FlashEvent, { type: "legendary_gone" }>;
}) {
  return (
    <div
      className="mx-6 w-full max-w-xs rounded-3xl bg-slate-900 px-6 py-7 text-center shadow-2xl"
      style={{ animation: "cardFadeIn 0.3s ease-out both" }}
    >
      <div className="text-5xl">{event.emoji}</div>
      <div className="mt-3 text-xs font-bold uppercase tracking-widest text-amber-400">
        Legenda odchází
      </div>
      <div className="mt-1 text-xl font-black text-white">{event.racerName}</div>
      <div className="mt-2 text-sm text-slate-400">
        {event.playerName} — závodil jako legenda, zmizel jako legenda.
      </div>
    </div>
  );
}

// ── Finanční penalizace ──────────────────────────────────────────────────────

function CoinsPenaltyContent({
  event,
}: {
  event: Extract<FlashEvent, { type: "coins_penalty" }>;
}) {
  return (
    <div
      className="mx-6 w-full max-w-xs rounded-2xl bg-white px-5 py-5 shadow-2xl ring-2 ring-red-200"
      style={{ animation: "cardFadeIn 0.2s ease-out both" }}
    >
      <div className="flex items-center gap-3">
        <div className="text-3xl">{event.emoji}</div>
        <div>
          <div className="text-sm font-bold text-slate-800">{event.fieldLabel}</div>
          <div className="text-xs text-slate-500">{event.playerName}</div>
        </div>
        <div className="ml-auto text-lg font-black text-red-500">
          {event.amount} 💰
        </div>
      </div>
    </div>
  );
}
