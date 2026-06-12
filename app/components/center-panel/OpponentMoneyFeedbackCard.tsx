import type { OpponentMoneyEvent } from "@/app/hooks/useOpponentMoneyFeedback";

interface Props {
  event: OpponentMoneyEvent;
  centerTitleClass: string;
}

export default function OpponentMoneyFeedbackCard({ event, centerTitleClass }: Props) {
  const isGain = event.kind === "gain";
  return (
    <div className="relative z-10" style={{ transition: "opacity 0.25s ease" }}>
      <div
        className="text-[10px] font-semibold uppercase tracking-widest mb-1.5 opacity-60"
        style={{ color: isGain ? "#fbbf24" : "#94a3b8" }}
      >
        {isGain ? "Soupeř získal" : "Soupeř utratil"}
      </div>
      <div
        className="text-4xl font-black tabular-nums leading-none"
        style={{ color: isGain ? "#fbbf24" : "#f87171" }}
      >
        {isGain ? "+" : "-"}{event.amount} 💰
      </div>
      <div className={`mt-2 text-xs font-semibold ${centerTitleClass}`}>
        {event.playerName}
      </div>
    </div>
  );
}
