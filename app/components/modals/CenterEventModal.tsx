"use client";

import type { CenterEvent } from "@/lib/types/events";

// Accent palety per typ eventu
const CARD_ACCENT = {
  chance: {
    headerBg:    "bg-sky-600",
    badgeBg:     "bg-sky-100",
    badgeText:   "text-sky-800",
  },
  finance: {
    headerBg:    "bg-teal-700",
    badgeBg:     "bg-teal-100",
    badgeText:   "text-teal-800",
  },
};

interface Props {
  event: CenterEvent;
  onConfirm?: () => void;
  onDecline?: () => void;
  /** Zavolá okamžitou aplikaci efektu karty — jen předávat pro aktivního hráče */
  onApplyCard?: () => void;
}

export default function CenterEventModal({ event, onConfirm, onDecline, onApplyCard }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.55)" }}
    >
      <div
        className="mx-4 w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden"
        style={{ animation: "cardFadeIn 0.25s ease-out both" }}
      >
        {event.type === "card" && <CardEventContent event={event} onApplyCard={onApplyCard} />}
        {event.type === "offer" && (
          <OfferEventContent event={event} onConfirm={onConfirm} onDecline={onDecline} />
        )}
      </div>
    </div>
  );
}

// ─── Card variant ─────────────────────────────────────────────────────────────

function CardEventContent({
  event,
  onApplyCard,
}: {
  event: Extract<CenterEvent, { type: "card" }>;
  onApplyCard?: () => void;
}) {
  const accent = CARD_ACCENT[event.cardType];
  return (
    <>
      <div className={`px-6 pt-6 pb-4 ${accent.headerBg}`}>
        <div className="text-xs font-bold uppercase tracking-widest text-white/70">
          {event.category}
        </div>
        <div className="mt-1 text-3xl">{event.emoji}</div>
        <div className="mt-2 text-xs font-semibold text-white/80">
          {event.playerName} lízl kartu:
        </div>
      </div>
      {event.imagePath && (
        <div className="bg-slate-900 overflow-hidden" style={{ height: "260px" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={event.imagePath}
            alt=""
            className="w-full h-full object-cover object-center"
          />
        </div>
      )}
      <div className="bg-white px-6 py-5 space-y-4">
        <p className="text-base font-medium text-slate-800 leading-snug">
          {event.text}
        </p>
        <div className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold ${accent.badgeBg} ${accent.badgeText}`}>
          {event.effectLabel}
        </div>
        {event.isActivePlayer ? (
          <button
            onClick={onApplyCard}
            className="w-full rounded-xl bg-slate-800 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-900 transition-colors"
          >
            Pokračovat →
          </button>
        ) : (
          <div className="text-xs text-slate-400">
            Čeká na {event.playerName}…
          </div>
        )}
      </div>
    </>
  );
}

// ─── Offer variant ────────────────────────────────────────────────────────────

function OfferEventContent({
  event,
  onConfirm,
  onDecline,
}: {
  event: Extract<CenterEvent, { type: "offer" }>;
  onConfirm?: () => void;
  onDecline?: () => void;
}) {
  return (
    <>
      <div className="bg-amber-500 px-6 pt-6 pb-4">
        <div className="text-xs font-bold uppercase tracking-widest text-white/70">
          Speciální nabídka
        </div>
        <div className="mt-1 text-3xl">🎲</div>
        <div className="mt-2 text-xs font-semibold text-white/80">
          {event.playerName}
        </div>
      </div>
      <div className="bg-white px-6 py-5 space-y-4">
        <p className="text-base font-medium text-slate-800 leading-snug">
          Zaplať <span className="font-bold text-amber-700">{event.cost} 💰</span> a hoď kostkou znovu.
        </p>
        <div className="text-xs text-slate-500">
          {event.playerName} má nyní{" "}
          <span className="font-semibold">{event.playerCoins} 💰</span>
        </div>
        {event.isActivePlayer ? (
          <div className="flex gap-3 pt-1">
            <button
              onClick={onConfirm}
              disabled={!event.canConfirm}
              className="flex-1 rounded-xl bg-amber-500 px-3 py-3 text-sm font-bold text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 transition"
            >
              {event.canConfirm ? `Zaplatit ${event.cost} 💰` : "Nedostatek coins"}
            </button>
            <button
              onClick={onDecline}
              className="flex-1 rounded-xl border border-slate-300 px-3 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              Odmítnout
            </button>
          </div>
        ) : (
          <div className="rounded-xl bg-slate-100 px-3 py-3 text-center text-sm text-slate-500">
            Rozhoduje {event.playerName}…
          </div>
        )}
      </div>
    </>
  );
}
