"use client";

interface Props {
  playerName: string;
}

export default function BankruptAnnouncementModal({ playerName }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-[4px] bg-white p-8 shadow-2xl text-center space-y-4">
        <div className="text-6xl">💀</div>
        <h2 className="text-2xl font-bold text-slate-800">{playerName} zkrachoval!</h2>
        <p className="text-sm text-slate-500">Hra pokračuje bez tohoto hráče.</p>
        <div className="animate-pulse text-xs text-slate-400">Pokračujeme za chvíli…</div>
      </div>
    </div>
  );
}
