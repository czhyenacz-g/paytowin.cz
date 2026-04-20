export default function PravidlaPage() {
  return (
    <div className="min-h-screen bg-slate-100">
      <div className="mx-auto max-w-2xl px-6 py-12">
        <a href="/" className="mb-8 inline-block text-sm text-slate-400 hover:text-slate-600">← Zpět na úvod</a>

        <h1 className="text-3xl font-bold text-slate-800">Pravidla hry</h1>
        <p className="mt-2 text-slate-500">PayToWin.cz — Závody, sázky a finanční chaos</p>

        <div className="mt-8 space-y-8 text-slate-700">

          <section>
            <h2 className="text-xl font-bold text-slate-800">Cíl hry</h2>
            <p className="mt-2">
              Přežít co nejdéle, nashromáždit co nejvíce coins a vyhrát závody.
              Poslední hráč, který nezkrachuje, vyhrává.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-800">Příprava</h2>
            <ul className="mt-2 space-y-1 list-disc list-inside">
              <li>Každý hráč začíná s <strong>1 000 coins</strong> a na poli START.</li>
              <li>Hráči se střídají v pořadí, v jakém se připojili ke hře.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-800">Průběh tahu</h2>
            <ul className="mt-2 space-y-1 list-disc list-inside">
              <li>Hráč na tahu hodí šestistěnnou kostkou (1–6).</li>
              <li>Figurka se posune o příslušný počet polí dopředu.</li>
              <li>Efekt pole, na které hráč přistane, se ihned aplikuje.</li>
              <li>Tah přechází na dalšího aktivního hráče.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-800">Korekce tahu (+1 / −1)</h2>
            <p className="mt-2">
              Po každém hodu se krátce zobrazí panel s možností upravit výsledek:
            </p>
            <ul className="mt-2 space-y-1 list-disc list-inside">
              <li><strong>+1 krok</strong> za 100 coins — přesuneš se o jedno pole dál.</li>
              <li><strong>−1 krok</strong> za 100 coins — přesuneš se o jedno pole méně.</li>
              <li><strong>Normálně</strong> — zdarma, žádná úprava.</li>
            </ul>
            <p className="mt-2 text-sm text-slate-500">
              Pokud nic nevybereš, po uplynutí limitu se automaticky provede normální tah.
              Korekce není možná, pokud by výsledný počet kroků klesl pod 1.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-800">Typy polí</h2>
            <div className="mt-2 space-y-2">
              <div className="flex items-start gap-3 rounded-xl bg-red-50 px-4 py-3">
                <span className="text-lg">🏁</span>
                <div>
                  <strong>START</strong> — průchod nebo přistání = <strong>+200 coins</strong> státní dotace.
                  Jenže stát se zadlužuje: od kola 3 roste daň o 40 coins za kolo (kolo 3 = −40, kolo 4 = −80 … strop −400).
                  V pozdní fázi hry tak průchod STARTem přináší čím dál méně — nebo tě rovnou připraví o coins.
                  <br /><span className="text-sm text-slate-500 mt-1 block">Průchod a přistání se nepočítají dvakrát — efekt se aplikuje vždy jen jednou za tah.</span>
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
                <div>
                  <strong>Závodník (Racer)</strong> — stáj nabídne závodníka ke koupi. Závodníci se liší rychlostí a cenou.
                  Bez vlastního závodníka se nemůžeš zúčastnit závodů.
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-xl bg-sky-50 px-4 py-3">
                <span className="text-lg">🎴</span>
                <div><strong>Osud / Finance</strong> — lízneš kartu s jednorázovým efektem (zisk, ztráta nebo jiná událost).</div>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-800">Závodníci a vlastnictví polí</h2>
            <ul className="mt-2 space-y-1 list-disc list-inside">
              <li>Když přistaneš na poli závodníka, můžeš ho koupit za jeho cenu.</li>
              <li>Koupený závodník se zobrazuje v tvém panelu.</li>
              <li>
                Pokud jiný hráč přistane na poli, které vlastníš, zaplatí ti <strong>nájemné</strong>.
              </li>
              <li>
                <strong>Ztráta závodníka:</strong> Pokud hráč zkrachuje nebo přijde o závodníka jiným způsobem,
                závodník zmizí z jeho inventáře a <strong>příslušné pole se znovu uvolní</strong> —
                může si ho koupit kdokoliv, kdo na něj příště přistane.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-800">Závody</h2>
            <ul className="mt-2 space-y-1 list-disc list-inside">
              <li>Závod se spustí, jakmile každý aktivní hráč vlastní alespoň jednoho závodníka.</li>
              <li>Každý hráč vybere závodníka, se kterým nastoupí.</li>
              <li>Výsledek závodu ovlivňuje rychlost závodníka a jeho aktuální stamina.</li>
              <li>Vítěz dostane odměnu v coins; poražení mohou přijít o část svých prostředků.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-800">Stamina a vyčerpání závodníka</h2>
            <ul className="mt-2 space-y-1 list-disc list-inside">
              <li>Každý závodník má staminu (0–100). Plně odpočatý závodník závodí na 100 %.</li>
              <li>Po každém závodě stamina klesá. Unavený závodník podává horší výkony.</li>
              <li>Stamina se postupně regeneruje mezi závody (každý tah +10, max 100).</li>
              <li>
                <strong>Vyčerpání:</strong> Závodník s nulovou staminkou závodí výrazně hůř —
                sleduj její stav a přizpůsob strategii.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-800">Hlavní závodník</h2>
            <p className="mt-2">
              Každý hráč si může označit jednoho závodníka jako <strong>hlavního</strong>.
              Ten se automaticky předvybere při vstupu do závodu, což usnadní rychlé rozhodování
              bez zdržení.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-800">Bankrot</h2>
            <ul className="mt-2 space-y-1 list-disc list-inside">
              <li>Hráč s 0 nebo méně coins je <strong>bankrotář</strong>.</li>
              <li>Bankrotářova figurka zmizí z desky a jeho závodníci se vrátí zpět na desku.</li>
              <li>Příslušná pole závodníků se znovu uvolní pro ostatní hráče.</li>
              <li>Tahy bankrotáře se automaticky přeskakují.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-800">Konec hry</h2>
            <p className="mt-2">
              Hra pokračuje, dokud nezůstane jediný aktivní hráč. Ten vyhrává.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-800">Komunitní mapy a editor</h2>
            <p className="mt-2 text-slate-600">
              Kromě základní mapy budou k dispozici <strong>komunitní mapy</strong> — fan-made, sezónní a event mapy
              s jiným rozvržením polí a ekonomikou.
              V <strong>editoru</strong> si budeš moct navrhnout vlastní mapu, rozmístit pole a sdílet ji s ostatními hráči.
            </p>
          </section>

        </div>

        <div className="mt-12 text-center text-sm text-slate-400">
          <a href="mailto:info@paytowin.cz" className="underline hover:text-slate-600">info@paytowin.cz</a>
        </div>
      </div>
    </div>
  );
}
