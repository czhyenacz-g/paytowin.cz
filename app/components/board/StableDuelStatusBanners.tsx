"use client";

import type { OfferPending, StableDuelPendingOffer } from "@/lib/types/game";

interface Props {
  offerPending: OfferPending | null;
  myPlayerId: string | null;
  viewerRole: string;
  countdownDisplay: string | null;
  handleDefenderReady: () => void;
  handleFallbackToPvBot: () => void;
}

export default function StableDuelStatusBanners({
  offerPending,
  myPlayerId,
  viewerRole,
  countdownDisplay,
  handleDefenderReady,
  handleFallbackToPvBot,
}: Props) {
  const sdPending = offerPending?.type === "stable_duel_pending"
    ? offerPending as StableDuelPendingOffer
    : null;
  if (!sdPending) return null;

  const mode = sdPending.mode ?? "pvbot_awareness";
  const isChallenger = myPlayerId === sdPending.challengerId;
  const isDefender   = myPlayerId === sdPending.defenderId;
  const isSpectatorView = viewerRole === "spectator";
  if (!isChallenger && !isDefender && !isSpectatorView) return null;

  // pvbot_awareness: malý fixed info bar pro defender/spectator — neposouvá board
  if (mode === "pvbot_awareness") {
    if (!isDefender && !isSpectatorView) return null;
    return (
      <div className="fixed bottom-4 left-1/2 z-[44] -translate-x-1/2 rounded-lg border border-amber-700/40 bg-amber-900/20 px-4 py-2 text-[11px] text-amber-300 flex items-center gap-2 backdrop-blur-sm">
        <span>⚔️</span>
        {isDefender
          ? <span><strong>{sdPending.challengerName ?? "Hráč"}</strong> tě vyzval na stájový souboj · souboj zatím běží proti botovi</span>
          : <span>Stájový souboj: <strong>{sdPending.challengerName ?? "?"}</strong> vs <strong>{sdPending.defenderName ?? "?"}</strong> · PvBot režim</span>
        }
      </div>
    );
  }

  // ── online_1v1 ────────────────────────────────────────────────────────
  const sdPhase = sdPending.phase;
  const isFinished     = sdPhase === "finished";
  const isCountingDown = sdPhase === "countdown";
  const hasStarted = sdPhase === "started" || (isCountingDown && !!sdPending.startsAt && sdPending.startsAt <= Date.now());

  // Finished — výsledek pro defender/spectator
  if (isFinished) {
    const summary     = sdPending.resultSummary;
    const coinsDelta  = summary?.coinsDelta;
    const winnerLabel = sdPending.winnerId
      ? (sdPending.winnerId === sdPending.challengerId ? sdPending.challengerName : sdPending.defenderName) ?? "?"
      : null;

    if (isDefender) {
      return (
        <div className="fixed bottom-4 left-1/2 z-[44] -translate-x-1/2 w-full max-w-sm rounded-xl border border-violet-600/50 bg-slate-950/90 px-4 py-3 flex flex-col gap-1 text-center backdrop-blur-sm"
          style={{ boxShadow: "0 0 20px rgba(139,92,246,0.2)" }}
        >
          <div className="text-[9px] uppercase tracking-widest text-violet-400 font-bold">Stájový souboj 1v1 — výsledek</div>
          <div className="text-sm text-violet-100">
            {winnerLabel
              ? <><strong>{winnerLabel}</strong> vyhrál{coinsDelta ? <span className="text-emerald-400"> +{coinsDelta}💰</span> : null}</>
              : <span>Remíza (0💰)</span>
            }
          </div>
        </div>
      );
    }
    if (isSpectatorView) {
      return (
        <div className="fixed bottom-4 left-1/2 z-[44] -translate-x-1/2 rounded-lg border border-slate-700/40 bg-slate-900/80 px-3 py-2 text-[11px] text-slate-400 flex items-center gap-2 backdrop-blur-sm">
          <span>⚔️</span>
          <span>1v1 souboj skončil:{" "}
            {winnerLabel
              ? <><strong className="text-slate-300">{winnerLabel}</strong> vyhrál{coinsDelta ? ` (+${coinsDelta}💰)` : ""}</>
              : "remíza"
            }
          </span>
        </div>
      );
    }
    return null;
  }

  // Countdown — fixed centered overlay
  if (isCountingDown && !hasStarted) {
    if (isSpectatorView) {
      return (
        <div className="fixed bottom-4 left-1/2 z-[44] -translate-x-1/2 rounded-lg border border-slate-700/40 bg-slate-900/80 px-3 py-2 text-[11px] text-slate-400 flex items-center gap-2 backdrop-blur-sm">
          <span>⚔️</span>
          <span>1v1 souboj začíná: <strong>{sdPending.challengerName ?? "?"}</strong> vs <strong>{sdPending.defenderName ?? "?"}</strong></span>
        </div>
      );
    }
    return (
      <div className="fixed inset-0 z-[44] flex items-center justify-center bg-black/70 backdrop-blur-sm">
        <div className="rounded-2xl border border-indigo-600/50 bg-indigo-950/90 px-8 py-8 flex flex-col items-center gap-3"
          style={{ boxShadow: "0 0 40px rgba(99,102,241,0.3)" }}
        >
          <div className="text-[9px] uppercase tracking-widest text-indigo-400 font-bold">Stájový souboj 1v1</div>
          <div className="text-6xl font-black text-white" style={{ textShadow: "0 0 32px rgba(99,102,241,0.9)" }}>
            {countdownDisplay ?? "…"}
          </div>
          <div className="text-[11px] font-semibold text-indigo-200">{sdPending.challengerName ?? "?"} vs {sdPending.defenderName ?? "?"}</div>
          <div className="text-[10px] text-indigo-400">Po odpočtu se hra spustí automaticky</div>
          <div className="text-[10px] text-slate-400 mt-1">
            {isChallenger
              ? <span>Tvoje ovládání: <span className="font-mono text-indigo-300">A / D</span> zatáčet · <span className="font-mono text-indigo-300">SPACE</span> boost</span>
              : <span>Tvoje ovládání: <span className="font-mono text-violet-300">← / →</span> zatáčet · <span className="font-mono text-violet-300">SPACE</span> boost</span>
            }
          </div>
        </div>
      </div>
    );
  }

  // Po startu — challenger má otevřený overlay
  if (hasStarted) {
    if (isDefender) {
      return (
        <div className="fixed bottom-4 left-1/2 z-[44] -translate-x-1/2 rounded-lg border border-violet-700/50 bg-slate-950/80 px-4 py-2 text-[12px] text-violet-200 flex items-center gap-2 backdrop-blur-sm">
          <span>⚔️</span>
          <span>Souboj probíhá — otvírám herní rozhraní…</span>
        </div>
      );
    }
    if (isSpectatorView) {
      return (
        <div className="fixed bottom-4 left-1/2 z-[44] -translate-x-1/2 rounded-lg border border-slate-700/40 bg-slate-900/80 px-3 py-2 text-[11px] text-slate-400 flex items-center gap-2 backdrop-blur-sm">
          <span>⚔️</span>
          <span>1v1 souboj probíhá: <strong>{sdPending.challengerName ?? "?"}</strong></span>
        </div>
      );
    }
    return null;
  }

  // pending / both_ready — fixed center overlays
  const isPending = sdPhase === "pending";

  if (isChallenger || isDefender) {
    const defReady = sdPending.defenderReady ?? false;
    const bothReady = !isPending;
    return (
      <div className="fixed inset-0 z-[44] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
        <div
          className="w-full max-w-2xl rounded-2xl border border-indigo-500/30 bg-slate-950/97 overflow-hidden flex flex-col sm:flex-row sm:min-h-[450px]"
          style={{ boxShadow: "0 0 60px rgba(99,102,241,0.25), 0 0 120px rgba(99,102,241,0.1)" }}
        >
          {/* Levá část — promo karta minihry */}
          <div className="sm:w-[45%] shrink-0 relative flex items-center justify-center bg-black/40 min-h-[200px] sm:min-h-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/minigames/neon_rope.webp"
              alt="Neon Rope Duel"
              className="absolute inset-0 w-full h-full object-cover"
              style={{ opacity: 0.85 }}
            />
            <div
              className="absolute inset-0"
              style={{ background: "linear-gradient(to right, transparent 60%, rgba(2,4,16,0.97) 100%)" }}
            />
            <div
              className="absolute inset-0 rounded-l-2xl"
              style={{ boxShadow: "inset 0 0 0 2px rgba(99,102,241,0.25)" }}
            />
          </div>

          {/* Pravá část — text + akce */}
          <div className="flex-1 flex flex-col justify-center gap-4 px-7 py-8">
            <div className="text-[9px] font-bold uppercase tracking-[0.3em] text-indigo-400">Stájový souboj 1v1</div>
            <div
              className="text-3xl font-black text-white leading-tight"
              style={{ textShadow: "0 0 32px rgba(99,102,241,0.7)" }}
            >
              STÁJOVÝ SOUBOJ
            </div>

            {bothReady ? (
              <div className="text-sm text-emerald-300 font-semibold">
                {isChallenger ? "Spouštím odpočet…" : "Jsi připraven — spouštění odpočtu…"}
              </div>
            ) : (
              <>
                <div className="text-base text-slate-300">
                  {isDefender
                    ? <><strong className="text-white">{sdPending.challengerName ?? "Hráč"}</strong> tě vyzval na souboj</>
                    : <>Čekáš na <strong className="text-white">{sdPending.defenderName ?? "?"}</strong>…</>
                  }
                </div>
                <div className="text-sm text-slate-500 italic">Vyhni se soupeři i jeho lanu.</div>
                <div className="text-[11px] text-slate-500 font-mono">
                  {isChallenger
                    ? <span><span className="text-indigo-400">Tvoje ovládání:</span> A / D zatáčet · SPACE boost</span>
                    : <span><span className="text-violet-400">Tvoje ovládání:</span> ← / → zatáčet · SPACE boost</span>
                  }
                </div>

                {isDefender && (
                  <button
                    onClick={handleDefenderReady}
                    className="mt-1 rounded-xl border border-emerald-500/60 bg-emerald-900/50 px-6 py-3.5 text-base font-black text-emerald-300 hover:bg-emerald-800/70 hover:border-emerald-400/80 transition-all self-start"
                    style={{ boxShadow: "0 0 20px rgba(52,211,153,0.2)" }}
                  >
                    ⚔️ JSEM PŘIPRAVEN
                  </button>
                )}

                {isChallenger && isPending && (
                  <button
                    onClick={handleFallbackToPvBot}
                    className="mt-1 rounded-lg border border-amber-600/60 bg-amber-900/40 px-4 py-2 text-sm text-amber-300 hover:bg-amber-800/60 transition self-start"
                  >
                    Hrát proti botovi (pokud druhý hráč nereaguje)
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // spectator pending
  return (
    <div className="fixed bottom-4 left-1/2 z-[44] -translate-x-1/2 rounded-lg border border-slate-700/40 bg-slate-900/80 px-3 py-2 text-[11px] text-slate-400 flex items-center gap-2 backdrop-blur-sm">
      <span>⚔️</span>
      <span>Příprava stájového 1v1: <strong>{sdPending.challengerName ?? "?"}</strong> vs <strong>{sdPending.defenderName ?? "?"}</strong></span>
    </div>
  );
}
