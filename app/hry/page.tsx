import GamesList from "@/app/components/GamesList";

export default function HryPage() {
  return (
    <div className="min-h-screen bg-slate-100">
      <div className="bg-amber-100 border-b border-amber-300 px-4 py-2 text-center text-sm text-amber-800">
        Experimentální projekt · kontakt:{" "}
        <a href="mailto:info@paytowin.cz" className="underline hover:text-amber-900">info@paytowin.cz</a>
      </div>
      <div className="mx-auto max-w-2xl px-6 py-10">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Aktivní hry</h1>
            <p className="text-sm text-slate-500 mt-0.5">Sleduj probíhající hry jako pozorovatel.</p>
          </div>
          <a href="/" className="text-sm text-slate-400 hover:text-slate-600 underline">← Úvod</a>
        </div>
        <GamesList />
      </div>
    </div>
  );
}
