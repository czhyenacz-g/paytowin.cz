interface Props {
  mode: "personal" | "shared";
  objectiveTitle: string;
  objectiveTask: string;
  completed: boolean;
  reason: string;
  rewardLabel: string;
  winnerName?: string | null;
}

export default function ObjectiveResultPanel({
  mode,
  objectiveTitle,
  objectiveTask,
  completed,
  reason,
  rewardLabel,
  winnerName,
}: Props) {
  const sectionLabel = mode === "personal" ? "Tvůj kontrakt" : "Společný kontrakt";

  return (
    <div className="px-6 py-4 border-b border-stone-500">
      <div className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.22em] text-stone-500">
        {sectionLabel}
      </div>
      <div className="text-sm font-bold text-stone-800 leading-snug">{objectiveTitle}</div>
      <div className="mt-0.5 text-xs text-stone-500 italic leading-snug">{objectiveTask}</div>

      <div className="mt-2 space-y-0.5">
        {completed ? (
          <div className="text-xs font-bold text-emerald-700">✓ Splněno</div>
        ) : (
          <div className="text-xs font-bold text-stone-400">✗ Nesplněno</div>
        )}
        <div className="text-[10px] text-stone-400 leading-snug">{reason}</div>
        {mode === "shared" && completed && winnerName && (
          <div className="text-xs text-stone-600">
            Nárok na kontrakt podle konečného stavu:{" "}
            <span className="font-semibold">{winnerName}</span>
          </div>
        )}
      </div>

      <div className="mt-2 text-[10px] text-stone-500 italic">{rewardLabel}</div>
    </div>
  );
}
