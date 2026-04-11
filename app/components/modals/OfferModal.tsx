"use client";

import type { OfferPending } from "@/lib/types/game";

interface Props {
  offer: OfferPending;
  playerCoins: number;
  isActivePlayer: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

export default function OfferModal({ offer, playerCoins, isActivePlayer, onAccept, onDecline }: Props) {
  const canAfford = playerCoins >= offer.cost;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.55)" }}
    >
      <div
        className="mx-4 w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden"
        style={{ animation: "cardFadeIn 0.25s ease-out both" }}
      >
        <div className="bg-amber-500 px-6 pt-6 pb-4">
          <div className="text-xs font-bold uppercase tracking-widest text-white/70">Speciální nabídka</div>
          <div className="mt-1 text-3xl">🎲</div>
          <div className="mt-2 text-xs font-semibold text-white/80">
            {offer.playerName}
          </div>
        </div>

        <div className="bg-white px-6 py-5 space-y-4">
          <p className="text-base font-medium text-slate-800 leading-snug">
            Zaplať <span className="font-bold text-amber-700">{offer.cost} 💰</span> a hoď kostkou znovu.
          </p>
          <div className="text-xs text-slate-500">
            {offer.playerName} má nyní <span className="font-semibold">{playerCoins} 💰</span>
          </div>
          {isActivePlayer ? (
            <div className="flex gap-3 pt-1">
              <button
                onClick={onAccept}
                disabled={!canAfford}
                className="flex-1 rounded-xl bg-amber-500 px-3 py-3 text-sm font-bold text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 transition"
              >
                {canAfford ? `Zaplatit ${offer.cost} 💰` : "Nedostatek coins"}
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
              Rozhoduje {offer.playerName}…
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
