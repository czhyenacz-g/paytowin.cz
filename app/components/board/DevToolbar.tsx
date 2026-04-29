"use client";

interface DevToolbarProps {
  onOpenRaceMode: () => void;
  onOpenRaceBoardLayer: () => void;
  onOpenFlip: () => void;
  onOpenDuel: () => void;
  onOpenSpeed: () => void;
  onOpenLegendary: () => void;
  onOpenStableDuel: () => void;
  stableDuelMode: "pvbot_awareness" | "online_1v1";
  onToggleStableDuelMode: () => void;
}

export default function DevToolbar({
  onOpenRaceMode,
  onOpenRaceBoardLayer,
  onOpenFlip,
  onOpenDuel,
  onOpenSpeed,
  onOpenLegendary,
  onOpenStableDuel,
  stableDuelMode,
  onToggleStableDuelMode,
}: DevToolbarProps) {
  return (
    <div className="flex items-center gap-1 shrink-0">
      <button
        onClick={onOpenRaceMode}
        className="rounded-[3px] border border-purple-300 bg-purple-50 px-2.5 py-1 text-[11px] font-semibold text-purple-700 hover:bg-purple-100 transition"
        title="DEV: Race Shell — fullscreen overlay"
      >
        🧪 Shell
      </button>
      <button
        onClick={onOpenRaceBoardLayer}
        className="rounded-[3px] border border-indigo-300 bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-100 transition"
        title="DEV: Race Layer — vrstva uvnitř boardu"
      >
        🏁 Layer
      </button>
      <button
        onClick={onOpenFlip}
        className="rounded-[3px] border border-teal-300 bg-teal-50 px-2.5 py-1 text-[11px] font-semibold text-teal-700 hover:bg-teal-100 transition"
        title="DEV: Race Flip — flip animace boardu"
      >
        🔄 Flip
      </button>
      <button
        onClick={onOpenDuel}
        className="rounded-[3px] border border-emerald-400 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100 transition"
        title="DEV: Neon Rope Duel — lokální harness"
      >
        🪢 Duel
      </button>
      <button
        onClick={onOpenSpeed}
        className="rounded-[3px] border border-cyan-400 bg-cyan-50 px-2.5 py-1 text-[11px] font-semibold text-cyan-700 hover:bg-cyan-100 transition"
        title="DEV: Speed Arena — lokální harness"
      >
        🏎 Speed
      </button>
      <button
        onClick={onOpenLegendary}
        className="rounded-[3px] border border-yellow-400 bg-yellow-50 px-2.5 py-1 text-[11px] font-semibold text-yellow-700 hover:bg-yellow-100 transition"
        title="DEV: Legendary Horse Race — lokální harness"
      >
        🌟 Legendary
      </button>
      <button
        onClick={onOpenStableDuel}
        className="rounded-[3px] border border-amber-400 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700 hover:bg-amber-100 transition"
        title="DEV: Stájový souboj — board overlay preview"
      >
        🐴 Stable
      </button>
      <button
        onClick={onToggleStableDuelMode}
        className={`rounded-[3px] border px-2.5 py-1 text-[11px] font-semibold transition ${stableDuelMode === "online_1v1" ? "border-indigo-400 bg-indigo-50 text-indigo-700 hover:bg-indigo-100" : "border-slate-400 bg-slate-50 text-slate-600 hover:bg-slate-100"}`}
        title={`Stable Duel mode: ${stableDuelMode}`}
      >
        {stableDuelMode === "online_1v1" ? "🎮 1v1" : "🤖 PvBot"}
      </button>
      <span className="rounded-[3px] bg-black/10 px-1.5 py-0.5 font-mono text-[9px] text-slate-500 select-all" title="stableDuelMode">
        {stableDuelMode}
      </span>
    </div>
  );
}
