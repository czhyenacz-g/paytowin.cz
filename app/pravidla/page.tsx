export const metadata = {
  title: "Pravidla hry | PayToWin.cz",
  description: "Zjisti, jak se hraje PayToWin.cz: raceři, peníze, závody, riziko, výhry a druhé šance.",
};

export default function PravidlaPage() {
  return (
    <div className="min-h-screen bg-slate-100">
      <div className="mx-auto max-w-2xl px-6 py-12">
        <a href="/" className="mb-8 inline-block text-sm text-slate-400 hover:text-slate-600">← Zpět na úvod</a>

        <h1 className="text-3xl font-bold text-slate-800">🎮 Jak hrát</h1>
        <p className="mt-2 text-slate-500">Rychlá pravidla — PayToWin.cz</p>

        <div className="mt-8 space-y-6 text-slate-700">

          <section>
            <h2 className="text-lg font-bold text-slate-800">🎯 Cíl</h2>
            <p className="mt-2">
              Přežij co nejdéle a nezbankrotuj.<br />
              Poslední hráč ve hře vyhrává.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-800">🎲 Tvůj tah</h2>
            <ol className="mt-2 space-y-1 list-decimal list-inside">
              <li>Hoď kostkou (1–6)</li>
              <li>Posuň se</li>
              <li>Aktivuje se pole</li>
              <li>Hotovo, další hráč</li>
            </ol>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-800">➕ Úprava hodu</h2>
            <p className="mt-2">Po hodu můžeš:</p>
            <ul className="mt-2 space-y-1 list-disc list-inside">
              <li>+1 krok za 100 coins</li>
              <li>−1 krok za 100 coins</li>
              <li>nebo nic</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-800">🐎 Závodníci</h2>
            <ul className="mt-2 space-y-1 list-disc list-inside">
              <li>Můžeš je kupovat</li>
              <li>Ostatní ti platí, když na ně vstoupí</li>
              <li>Můžeš je prodat (80 % ceny)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-800">⚔️ Stájový souboj</h2>
            <p className="mt-2">Když vstoupíš na cizího závodníka:</p>
            <ol className="mt-2 space-y-1 list-decimal list-inside">
              <li>Oba hráči potvrdí souboj</li>
              <li>Spustí se odpočet</li>
              <li>Následuje minihra</li>
            </ol>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-800">🎮 Ovládání</h2>
            <ul className="mt-2 space-y-1 list-disc list-inside font-mono text-sm">
              <li>P1: A / D + SPACE (boost)</li>
              <li>P2: ← / → + S (boost)</li>
            </ul>
            <p className="mt-2 text-sm text-slate-500">Boost = krátké zrychlení za cenu staminy</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-800">🔋 Stamina</h2>
            <ul className="mt-2 space-y-1 list-disc list-inside">
              <li>Každý kůň/auto ji má (0–100)</li>
              <li>Klesá při soubojích</li>
              <li>Regeneruje se mezi tahy</li>
              <li>Nízká stamina = horší výkon</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-800">💀 Bankrot</h2>
            <ul className="mt-2 space-y-1 list-disc list-inside">
              <li>0 coins = konec</li>
              <li>Koně/Lamy/velbloudi/auta se vrací na mapu</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-800">🌫️ Fog on the Road</h2>
            <ul className="mt-2 space-y-1 list-disc list-inside">
              <li>Nevidíš celou mapu</li>
              <li>Pole se odhalí až když na ně někdo vstoupí</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-800">🔮 Co přijde později</h2>
            <ul className="mt-2 space-y-1 list-disc list-inside text-slate-500">
              <li>Velké závody pro všechny hráče</li>
              <li>Speciální podmínky pro jejich spuštění</li>
              <li>Další typy karet a eventů</li>
            </ul>
          </section>

        </div>

        <div className="mt-12 text-center text-sm text-slate-400">
          <a href="mailto:info@paytowin.cz" className="underline hover:text-slate-600">info@paytowin.cz</a>
        </div>
      </div>
    </div>
  );
}
