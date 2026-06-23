import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pravidla hry | StartovníPole.cz — kampaň RaceToWin",
  description: "Jak se hraje StartovníPole.cz: raceři, peníze, závody, riziko, výhry a druhé šance.",
};

const cardClass = "rounded-[28px] border border-amber-200/15 bg-[#15110e]/92 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-sm";
const sectionTitle = "text-[11px] font-black uppercase tracking-[0.28em] text-amber-200/80";
const ruleHeading = "text-base font-bold text-amber-50";
const ruleBody = "mt-2 text-sm leading-relaxed text-stone-300";
const ruleList = "mt-2 space-y-1 text-sm leading-relaxed text-stone-300";
const ruleMuted = "mt-2 text-xs leading-relaxed text-stone-500";

export default function PravidlaPage() {
  return (
    <main
      className="min-h-screen overflow-x-hidden text-stone-100"
      style={{
        backgroundImage:
          "linear-gradient(rgba(15,23,42,0.82) 0%, rgba(15,23,42,0.70) 40%, rgba(15,23,42,0.86) 100%), url('/menu_bckg.webp')",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
        <a href="/" className="mb-4 inline-block text-xs font-semibold uppercase tracking-[0.25em] text-amber-100/70 hover:text-amber-100">
          ← Zpět na úvod
        </a>

        {/* Hero */}
        <section className={`${cardClass} overflow-hidden`}>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.16),transparent_40%),radial-gradient(circle_at_bottom_right,rgba(120,53,15,0.28),transparent_45%)]" />
          <div className="relative space-y-3">
            <div className={sectionTitle}>StartovníPole.cz · kampaň RaceToWin · engine PayToWin</div>
            <h1 className="font-serif text-4xl font-semibold leading-[0.95] tracking-[-0.04em] text-amber-50 sm:text-5xl">
              🎮 Jak hrát
            </h1>
            <p className="text-sm leading-relaxed text-stone-400">
              Rychlá pravidla první kampaně.
            </p>
          </div>
        </section>

        {/* Pravidla */}
        <div className="mt-4 space-y-4">

          <section className={cardClass}>
            <div className={sectionTitle}>Cíl hry</div>
            <p className={ruleBody}>
              Přežij co nejdéle a nezbankrotuj.<br />
              Poslední hráč ve hře vyhrává.
            </p>
            <p className={ruleMuted}>
              Počáteční peníze závisí na nastavení: Hard — 6 000, Normál — 8 000 (výchozí), Bohatý — 10 000.
            </p>
          </section>

          <section className={cardClass}>
            <div className={sectionTitle}>Tvůj tah</div>
            <ol className={`${ruleList} list-decimal list-inside`}>
              <li>Hoď kostkou (1–6)</li>
              <li>Posuň se</li>
              <li>Aktivuje se pole</li>
              <li>Hotovo, další hráč</li>
            </ol>
          </section>

          <section className={cardClass}>
            <div className={sectionTitle}>Úprava hodu</div>
            <p className={ruleBody}>Po hodu máš 4 sekundy na rozhodnutí:</p>
            <ul className={`${ruleList} list-disc list-inside`}>
              <li>+1 krok za 600 coins</li>
              <li>−1 krok za 600 coins</li>
              <li>nebo nic (automaticky pokud nereaguješ)</li>
            </ul>
          </section>

          <section className={cardClass}>
            <div className={sectionTitle}>Závodníci</div>
            <ul className={`${ruleList} list-disc list-inside`}>
              <li>Můžeš je kupovat</li>
              <li>Ostatní ti platí, když na ně vstoupí</li>
              <li>Můžeš je prodat (80 % ceny)</li>
              <li>Když závodník vyčerpá staminu, vrátí se do nabídky — může ho koupit jiný hráč</li>
            </ul>
          </section>

          <section className={cardClass}>
            <div className={sectionTitle}>Vsadit na pole</div>
            <p className={ruleBody}>
              Před hodem kostkou můžeš zaplatit za označení až 3 odkrytých ztrátových polí.
              Pokud na takové pole vstoupí soupeř, zaplatí ztrátu tobě místo bance.
            </p>
            <ul className={`${ruleList} list-disc list-inside`}>
              <li>1. pole: 100 💰</li>
              <li>2. pole: +200 💰</li>
              <li>3. pole: +400 💰</li>
            </ul>
            <p className={ruleMuted}>
              Označení platí jen krátce. Když vyprší, pole se zase chová normálně.
            </p>
          </section>

          <section className={cardClass}>
            <div className={sectionTitle}>Stájový souboj</div>
            <p className={ruleBody}>Když vstoupíš na cizího závodníka:</p>
            <ol className={`${ruleList} list-decimal list-inside`}>
              <li>Oba hráči potvrdí souboj</li>
              <li>Spustí se odpočet</li>
              <li>Následuje minihra</li>
            </ol>
            <p className={ruleMuted}>
              Některé efekty a karty mohou hráče přeskočit na další kolo — v seznamu hráčů je označen jako „stojí".
            </p>
          </section>

          <section className={cardClass}>
            <div className={sectionTitle}>Ovládání miniher</div>
            <ul className={`${ruleList} list-disc list-inside font-mono`}>
              <li>P1: WASD (relativní dle směru jízdy) · Q nebo 2× dopředu = boost</li>
              <li>P2: ← ↑ ↓ → · Space nebo 2× dopředu = boost</li>
            </ul>
            <p className={ruleMuted}>Na mobilu: dotykové ovládání ← BOOST →</p>
            <p className={ruleMuted}>Boost = krátké zrychlení za cenu staminy</p>
          </section>

          <section className={cardClass}>
            <div className={sectionTitle}>Stamina</div>
            <ul className={`${ruleList} list-disc list-inside`}>
              <li>Každý závodník ji má (0–100)</li>
              <li>Klesá při soubojích</li>
              <li>Regeneruje se mezi tahy</li>
              <li>Nízká stamina = horší výkon</li>
            </ul>
          </section>

          <section className={cardClass}>
            <div className={sectionTitle}>Bankrot</div>
            <ul className={`${ruleList} list-disc list-inside`}>
              <li>0 coins = konec</li>
              <li>Závodníci se vrací na mapu</li>
            </ul>
          </section>

          <section className={cardClass}>
            <div className={sectionTitle}>Fog on the Road</div>
            <ul className={`${ruleList} list-disc list-inside`}>
              <li>Nevidíš celou mapu</li>
              <li>Pole se odhalí až když na ně někdo vstoupí</li>
            </ul>
          </section>

          <section className={cardClass}>
            <div className={sectionTitle}>Co přijde později</div>
            <ul className={`${ruleList} list-disc list-inside text-stone-500`}>
              <li>Velké závody pro všechny hráče</li>
              <li>Speciální podmínky pro jejich spuštění</li>
              <li>Další typy karet a eventů</li>
              <li>Nové kampaně a mapy</li>
            </ul>
          </section>

        </div>

        <div className="mt-8 pb-8 text-center text-xs text-stone-600">
          <a href="mailto:info@paytowin.cz" className="hover:text-stone-400 underline">info@paytowin.cz</a>
          {" · "}
          <a href="/o-nas" className="hover:text-stone-400 underline">O projektu</a>
        </div>
      </div>
    </main>
  );
}
