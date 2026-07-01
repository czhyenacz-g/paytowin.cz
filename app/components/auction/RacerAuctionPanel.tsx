"use client";

import React from "react";
import type { RacerAuctionOffer } from "@/lib/types/game";
import type { Player } from "@/lib/types/game";
import type { SoundId } from "@/lib/audio/sfx";
import { getNextBidAmount, canPlayerBid } from "@/lib/game/racerAuction";
import { useAuctionCountdown } from "./useAuctionCountdown";

interface Props {
  offer: RacerAuctionOffer;
  players: Player[];
  myPlayerId: string | null;
  myPlayer: Player | null;
  isMyTurn: boolean;
  onBid: () => Promise<"ok" | "stale">;
  onSettleAuction: () => void;
  playSfx: (id: SoundId) => void;
}

export default function RacerAuctionPanel({
  offer,
  players,
  myPlayerId,
  myPlayer,
  onBid,
  onSettleAuction,
  playSfx,
}: Props) {
  const { secondsLeft, isExpired } = useAuctionCountdown(offer.endsAt);
  const [staleMsg, setStaleMsg] = React.useState<string | null>(null);

  // Slavnostní cinkání při startu aukce — jednou při mountu
  React.useEffect(() => {
    playSfx("auction_start");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pípání v posledních 5 sekundách — jednou za sekundu
  const prevTickRef = React.useRef<number | null>(null);
  // Reset tick guardu při každém novém příhozu (endsAt se změní) — zabrání přeskočení tiknutí
  React.useEffect(() => {
    prevTickRef.current = null;
  }, [offer.endsAt]);
  React.useEffect(() => {
    if (secondsLeft > 0 && secondsLeft <= 5 && secondsLeft !== prevTickRef.current) {
      prevTickRef.current = secondsLeft;
      playSfx("auction_tick");
    }
  }, [secondsLeft, playSfx]);

  // Vítězný zvuk — jednou při expiraci aukce kde jsem vyhrál
  const winFiredRef = React.useRef(false);
  React.useEffect(() => {
    if (isExpired && offer.currentBidderPlayerId === myPlayerId && !winFiredRef.current) {
      winFiredRef.current = true;
      playSfx("auction_win");
    }
  }, [isExpired, offer.currentBidderPlayerId, myPlayerId, playSfx]);

  const isSettlementAuthority = myPlayerId === offer.revealedByPlayerId;

  const onSettleRef = React.useRef(onSettleAuction);
  React.useEffect(() => { onSettleRef.current = onSettleAuction; });
  const settlementFiredRef = React.useRef(false);

  React.useEffect(() => {
    if (isExpired && isSettlementAuthority && !settlementFiredRef.current) {
      settlementFiredRef.current = true;
      onSettleRef.current();
    }
  }, [isExpired, isSettlementAuthority]);

  const nextBid = getNextBidAmount(offer);
  const bidCheck = myPlayer ? canPlayerBid(myPlayer, offer, Date.now()) : { ok: false, reason: "Nejsi hráč." };
  const currentBidder = offer.currentBidderPlayerId
    ? players.find(p => p.id === offer.currentBidderPlayerId)
    : null;

  if (isExpired && offer.currentBid === null) {
    return (
      <div className="rounded-[4px] border border-slate-300 bg-slate-50 p-4 text-center space-y-1">
        <div className="text-sm font-semibold text-slate-600">🔨 Aukce skončila</div>
        <div className="text-xs text-slate-500">Nikdo nepřihodil. Aukce skončila bez prodeje.</div>
      </div>
    );
  }

  return (
    <div className="rounded-[4px] border-2 border-amber-600 bg-amber-50 p-4 space-y-3">
      {/* Hlavička */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold uppercase tracking-widest text-amber-700">🔨 Aukce</span>
        <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-semibold text-amber-900">Historická legenda</span>
      </div>

      {/* Racer info */}
      <div className="flex items-start gap-3">
        {offer.racerImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={offer.racerImageUrl}
            alt={offer.racerName}
            className="h-20 w-20 rounded-lg object-contain bg-amber-100 shrink-0"
            onError={(e) => { e.currentTarget.style.display = "none"; }}
          />
        ) : (
          <div className="h-20 w-20 flex items-center justify-center text-5xl bg-amber-100 rounded-lg shrink-0">
            {offer.racerEmoji}
          </div>
        )}
        <div className="space-y-0.5">
          <div className="font-bold text-slate-900 text-base">{offer.racerName}</div>
          <div className="text-sm text-slate-600">⚡ Rychlost: {offer.racerSpeed}</div>
          <div className="text-sm text-slate-600">💪 Stamina: {offer.racerMaxStamina}</div>
          {offer.racerFlavorText && (
            <p className="text-xs italic text-slate-500 pt-0.5">„{offer.racerFlavorText}"</p>
          )}
        </div>
      </div>

      {/* Ceny */}
      <div className="rounded-[3px] bg-white border border-amber-200 p-2.5 space-y-1 text-sm">
        <div className="text-slate-500">
          Vyvolávací cena: <span className="font-semibold text-slate-700">{offer.startPrice.toLocaleString("cs-CZ")} 💰</span>
        </div>
        {offer.currentBid !== null ? (
          <div className="text-amber-800 font-semibold">
            Aktuální nabídka: {offer.currentBid.toLocaleString("cs-CZ")} 💰
            {currentBidder && (
              <span className="text-amber-600 font-normal"> — vede {currentBidder.name}</span>
            )}
          </div>
        ) : (
          <div className="text-slate-400 text-xs">Nikdo zatím nepřihodil.</div>
        )}
        <div className="text-xs text-slate-500">Každý příhoz navyšuje cenu o {offer.bidStep} 💰</div>
      </div>

      {/* Countdown */}
      <div className={`text-center text-xs font-semibold ${secondsLeft <= 5 ? "text-red-600 animate-pulse" : "text-amber-700"}`}>
        {secondsLeft > 0
          ? `Konec za ${secondsLeft} s bez dalšího příhozu`
          : "Aukce právě končí…"}
      </div>

      {/* Tlačítko příhozu */}
      <button
        onClick={async () => {
          setStaleMsg(null);
          const result = await onBid();
          if (result === "stale") {
            setStaleMsg("Někdo byl rychlejší. Nabídka se změnila.");
            setTimeout(() => setStaleMsg(null), 4000);
          }
        }}
        disabled={!bidCheck.ok}
        className="w-full rounded-[3px] bg-amber-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-slate-300 transition"
      >
        {offer.currentBid !== null
          ? `Přihodit +${offer.bidStep.toLocaleString("cs-CZ")} na ${nextBid.toLocaleString("cs-CZ")} 💰`
          : `Přihodit na ${nextBid.toLocaleString("cs-CZ")} 💰`}
      </button>

      {staleMsg && (
        <p className="text-center text-xs text-amber-700 font-medium">{staleMsg}</p>
      )}
      {!staleMsg && !bidCheck.ok && bidCheck.reason && (
        <p className="text-center text-xs text-slate-500">{bidCheck.reason}</p>
      )}
    </div>
  );
}
