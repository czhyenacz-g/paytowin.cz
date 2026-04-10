export default function ONasPage() {
  return (
    <div className="min-h-screen bg-slate-100">
      <div className="mx-auto max-w-2xl px-6 py-12">
        <a href="/" className="mb-8 inline-block text-sm text-slate-400 hover:text-slate-600">← Zpět na úvod</a>

        <h1 className="text-3xl font-bold text-slate-800">O nás</h1>

        <div className="mt-8 space-y-6 text-slate-700">

          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <div className="text-4xl mb-3">🐎</div>
            <h2 className="text-xl font-bold text-slate-800">Pay-to-Win</h2>
            <p className="mt-2">
              Webová multiplayer hra inspirovaná klasickými Dostihy a sázkami.
              Hráči závodí o přežití na herní desce, kupují koně a snaží se nepřijít o všechny coins.
            </p>
          </div>

          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-slate-800">Experimentální projekt</h2>
            <p className="mt-2">
              Pay-to-Win je experimentální projekt. Hra je ve vývoji — přibývají nové funkce,
              může se měnit herní mechanika a občas se může stát, že něco nefunguje úplně správně.
            </p>
            <p className="mt-3">
              Zpětnou vazbu, nápady nebo hlášení chyb posílej na{" "}
              <a href="mailto:info@paytowin.cz" className="underline text-slate-500 hover:text-slate-800">info@paytowin.cz</a>.
            </p>
          </div>

          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-slate-800">Technologie</h2>
            <ul className="mt-2 space-y-1 list-disc list-inside text-slate-600">
              <li>Next.js 15 + TypeScript</li>
              <li>Supabase (Postgres + Realtime)</li>
              <li>Tailwind CSS</li>
              <li>Vercel</li>
            </ul>
          </div>

        </div>

        <div className="mt-12 text-center text-sm text-slate-400">
          <a href="mailto:info@paytowin.cz" className="underline hover:text-slate-600">info@paytowin.cz</a>
        </div>
      </div>
    </div>
  );
}
