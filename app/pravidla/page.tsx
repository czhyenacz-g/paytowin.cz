export default function PravidlaPage() {
  return (
    <div className="min-h-screen bg-slate-100">
      <div className="mx-auto max-w-2xl px-6 py-12">
        <a href="/" className="mb-8 inline-block text-sm text-slate-400 hover:text-slate-600">← Zpět na úvod</a>

        <h1 className="text-3xl font-bold text-slate-800">Pravidla hry</h1>
        <p className="mt-2 text-slate-500">PayToWin.cz — Dostihy, sázky a finanční chaos</p>

        <div className="mt-8 space-y-8 text-slate-700">

          <section>
            <h2 className="text-xl font-bold text-slate-800">Cíl hry</h2>
            <p className="mt-2">Přežít co nejdéle a nashromáždit co nejvíce coins. Poslední hráč, který nezkrachuje, vyhrává.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-800">Příprava</h2>
            <ul className="mt-2 space-y-1 list-disc list-inside">
              <li>Každý hráč začíná s <strong>500 coins</strong> a na poli START.</li>
              <li>Hráči se střídají v pořadí, v jakém se připojili ke hře.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-800">Průběh tahu</h2>
            <ul className="mt-2 space-y-1 list-disc list-inside">
              <li>Hráč na tahu hodí šestistěnnou kostkou.</li>
              <li>Figurka se posune o příslušný počet polí dopředu.</li>
              <li>Efekt pole se ihned aplikuje (zisk, ztráta, hazard nebo kůň).</li>
              <li>Tah přechází na dalšího hráče.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-800">Typy polí</h2>
            <div className="mt-2 space-y-2">
              <div className="flex items-start gap-3 rounded-xl bg-red-50 px-4 py-3">
                <span className="text-lg">🏁</span>
                <div>
                  <strong>START</strong> — průchod nebo přistání = <strong>+200 coins</strong> státní dotace.
                  Jenže stát se zadlužuje, a tak každé kolo zvyšuje daně:
                  kolo 1 = −0, kolo 2 = −50, kolo 3 = −100, kolo 4 = −150 … až na strop <strong>−500</strong>.
                  V pozdních kolech tak průchod STARTem přináší čím dál méně — nebo tě rovnou připraví o coins.
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-xl bg-emerald-50 px-4 py-3">
                <span className="text-lg">🟢</span>
                <div><strong>Zisk</strong> — dostaneš coins dle popisu pole.</div>
              </div>
              <div className="flex items-start gap-3 rounded-xl bg-red-50 px-4 py-3">
                <span className="text-lg">🔴</span>
                <div><strong>Ztráta</strong> — zaplatíš coins dle popisu pole.</div>
              </div>
              <div className="flex items-start gap-3 rounded-xl bg-violet-50 px-4 py-3">
                <span className="text-lg">🟣</span>
                <div><strong>Hazard</strong> — náhodně vyhraješ nebo prohraješ coins. Štěstí rozhoduje.</div>
              </div>
              <div className="flex items-start gap-3 rounded-xl bg-amber-50 px-4 py-3">
                <span className="text-lg">🟠</span>
                <div><strong>Kůň</strong> — stáj nabídne koně ke koupi. Můžeš koupit nebo přeskočit.</div>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-800">Koně</h2>
            <ul className="mt-2 space-y-1 list-disc list-inside">
              <li>Na desce jsou 4 koňská pole (Divoká růže, Modrý blesk, Zlatá hříva, Rychlý vítr).</li>
              <li>Koně se liší rychlostí (1–5) a cenou (80–400 coins).</li>
              <li>Koupený kůň je tvůj — zobrazuje se v tvém panelu.</li>
              <li>Závody s koňmi jsou plánovanou funkcí.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-800">Bankrot</h2>
            <ul className="mt-2 space-y-1 list-disc list-inside">
              <li>Hráč s 0 nebo méně coins je <strong>bankrotář</strong>.</li>
              <li>Bankrotářova figurka zmizí z desky.</li>
              <li>Jeho tahy se automaticky přeskakují.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-800">Konec hry</h2>
            <p className="mt-2">Hra pokračuje, dokud nezůstane jediný aktivní hráč. Ten vyhrává.</p>
          </section>

        </div>

        <div className="mt-12 text-center text-sm text-slate-400">
          <a href="mailto:info@paytowin.cz" className="underline hover:text-slate-600">info@paytowin.cz</a>
        </div>
      </div>
    </div>
  );
}
