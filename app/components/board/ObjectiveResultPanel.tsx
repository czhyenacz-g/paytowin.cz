interface Props {
  mode: "personal" | "shared";
  objectiveTitle: string;
  objectiveTask: string;
  completed: boolean;
  reason: string;
  rewardLabel: string;
  winnerName?: string | null;
  /** Coins udělené hráči během hry (in-game reward). Zobrazí se pokud > 0. */
  inGameCoinsRewarded?: number;
  /** Informační text o profilovém XP (např. "+90 XP" nebo "pouze s živými hráči"). */
  profileXpNote?: string | null;
}

export default function ObjectiveResultPanel({
  mode,
  objectiveTitle,
  objectiveTask,
  completed,
  reason,
  rewardLabel,
  winnerName,
  inGameCoinsRewarded,
  profileXpNote,
}: Props) {
  const sectionLabel = mode === "personal" ? "Tvůj kontrakt" : "Společný kontrakt";

  return (
    <div className="relative px-6 py-4 border-b border-stone-500 bg-[#f4efe4]">
      <div className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.22em] text-stone-700">
        {sectionLabel}
      </div>
      <div className="text-sm font-bold text-stone-800 leading-snug">{objectiveTitle}</div>
      <div className="mt-0.5 text-xs text-stone-600 italic leading-snug">{objectiveTask}</div>

      <div className="mt-2 space-y-0.5">
        {completed ? (
          <div className="text-xs font-bold text-emerald-700">✓ Splněno</div>
        ) : (
          <div className="text-xs font-bold text-stone-600">✗ Nesplněno</div>
        )}
        <div className="text-[10px] text-stone-600 leading-snug">{reason}</div>
        {mode === "shared" && completed && winnerName && (
          <div className="text-xs text-stone-600">
            Kontrakt splnil jako první:{" "}
            <span className="font-semibold">{winnerName}</span>
          </div>
        )}
      </div>

      {/* Reward info — zobrazí se jen pokud byl objective splněn */}
      {completed && (inGameCoinsRewarded || profileXpNote) && (
        <div className="mt-2 space-y-0.5">
          {inGameCoinsRewarded ? (
            <div className="text-[10px] font-semibold text-emerald-700">
              💰 +{inGameCoinsRewarded.toLocaleString("cs-CZ")} Kč obdrženo během hry
            </div>
          ) : null}
          {profileXpNote ? (
            <div className="text-[10px] text-stone-600">{profileXpNote}</div>
          ) : null}
        </div>
      )}

      {!inGameCoinsRewarded && !profileXpNote && (
        <div className="mt-2 text-[10px] text-stone-600 italic">{rewardLabel}</div>
      )}
    </div>
  );
}
