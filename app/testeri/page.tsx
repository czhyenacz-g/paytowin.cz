import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Wanted testeři hry | PayToWin.cz",
  description:
    "Hledám testery pro PayToWin.cz, českou online deskovku o závodech, penězích a risku. Vyzkoušej demo hry a pomoz doladit pravidla, mobilní ovládání i zábavnost.",
  alternates: {
    canonical: "https://paytowin.cz/testeri",
  },
  openGraph: {
    title: "Wanted testeři hry | PayToWin.cz",
    description:
      "Hledám testery pro PayToWin.cz, českou online deskovku o závodech, penězích a risku. Vyzkoušej demo hry a pomoz doladit pravidla, mobilní ovládání i zábavnost.",
    url: "https://paytowin.cz/testeri",
    siteName: "PayToWin.cz",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Wanted testeři hry | PayToWin.cz",
    description:
      "Hledám testery pro PayToWin.cz, českou online deskovku o závodech, penězích a risku. Vyzkoušej demo hry a pomoz doladit pravidla, mobilní ovládání i zábavnost.",
  },
};

const paperCard = "rounded-[28px] border border-amber-200/15 bg-[#15110e]/92 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-sm";
const sectionTitle = "text-[11px] font-black uppercase tracking-[0.28em] text-amber-200/80";

export default function TesteriPage() {
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
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
        <div className="mb-4 flex items-center justify-between gap-3">
          <Link href="/" className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-100/70 hover:text-amber-100">
            ← Zpět na PayToWin.cz
          </Link>
          <span className="rounded-full border border-amber-300/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-amber-300">
            Beta v0.7.8-seno
          </span>
        </div>

        <section className={`${paperCard} relative overflow-hidden`}>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.16),transparent_40%),radial-gradient(circle_at_bottom_right,rgba(120,53,15,0.28),transparent_45%)]" />
          <div className="relative grid gap-6 p-5 sm:p-8 lg:grid-cols-[1.2fr_0.8fr] lg:p-10">
            <div className="space-y-5">
              <p className={sectionTitle}>Wanted</p>
              <h1 className="max-w-2xl font-serif text-4xl font-semibold leading-[0.95] tracking-[-0.04em] text-amber-50 sm:text-5xl lg:text-6xl">
                Wanted: testeři hry PayToWin.cz
              </h1>
              <p className="max-w-2xl text-base leading-relaxed text-stone-300 sm:text-lg">
                Hledám pár lidí na beta testování české online deskovky PayToWin.cz. Zahraj demo hry, zkus mobil i desktop a napiš, co je nejasné, zábavné nebo rozbité.
              </p>
              <p className="max-w-2xl text-sm leading-relaxed text-stone-400 sm:text-[15px]">
                Nečekej hotovou hru. Čekej bugy, divné situace, boty, co občas udělají hloupost, a pravidla, která se ještě ladí.
              </p>

              <div className="flex flex-wrap gap-3 pt-2">
                <Link
                  href="/"
                  className="inline-flex h-11 items-center justify-center rounded-full bg-gradient-to-b from-amber-200 to-amber-500 px-5 text-sm font-bold text-stone-950 shadow-[0_14px_30px_rgba(245,158,11,0.22)] transition hover:brightness-105"
                >
                  Vyzkoušet demo
                </Link>
                <a
                  href="#feedback"
                  className="inline-flex h-11 items-center justify-center rounded-full border border-amber-200/20 bg-white/5 px-5 text-sm font-semibold text-amber-100 transition hover:bg-white/10"
                >
                  Nahlásit zpětnou vazbu
                </a>
              </div>
            </div>

            <aside className="space-y-3">
              <div className="rounded-[24px] border border-amber-200/15 bg-black/25 p-4">
                <div className={sectionTitle}>Co potřebuji</div>
                <ul className="mt-3 space-y-2 text-sm leading-relaxed text-stone-300">
                  <li>• zahrát krátkou testovací partii</li>
                  <li>• napsat, co bylo nejasné</li>
                  <li>• napsat, co bylo zábavné</li>
                  <li>• ideálně nahlásit bug screenshotem</li>
                  <li>• vyzkoušet mobil i desktop, pokud můžeš</li>
                </ul>
              </div>

              <div className="rounded-[24px] border border-amber-200/15 bg-black/25 p-4">
                <div className={sectionTitle}>Co za to</div>
                <p className="mt-3 text-sm leading-relaxed text-stone-300">
                  Peníze zatím nejsou. Ale nejlepší testeři se můžou propsat přímo do hry — třeba jako jméno koně, závodníka nebo budoucího auta.
                </p>
                <p className="mt-2 text-xs leading-relaxed text-stone-400">
                  Není to garantovaná odměna pro každého. Je to možnost pro lidi, kteří hře opravdu pomůžou.
                </p>
              </div>
            </aside>
          </div>
        </section>

        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          <section className={`${paperCard} p-5`}>
            <div className={sectionTitle}>Co je PayToWin.cz</div>
            <h2 className="mt-3 text-xl font-bold text-amber-50">Rozpracovaná česká online deskovka</h2>
            <p className="mt-3 text-sm leading-relaxed text-stone-300">
              PayToWin.cz je rozpracovaná česká online deskovka o závodech, nákupech koní, riskování tahů a finančním chaosu. Hra je zatím v beta verzi, takže cílem testování není najít dokonalý produkt, ale pomoct odhalit bugy, nejasná pravidla a momenty, které nejsou dost zábavné.
            </p>
          </section>

          <section className={`${paperCard} p-5`}>
            <div className={sectionTitle}>Koho hledám</div>
            <h2 className="mt-3 text-xl font-bold text-amber-50">Lidi na beta testování</h2>
            <p className="mt-3 text-sm leading-relaxed text-stone-300">
              Hledám testery hry, kteří zvládnou odehrát krátkou demo partii a napsat stručnou zpětnou vazbu. Nemusíš být profesionální tester. Stačí chuť zkusit novou českou online deskovku a říct, kde se hra zasekla, co nedávalo smysl nebo co naopak fungovalo dobře.
            </p>
          </section>

          <section className={`${paperCard} p-5`}>
            <div className={sectionTitle}>Co budeš testovat</div>
            <h2 className="mt-3 text-xl font-bold text-amber-50">Demo hry, mobil i flow</h2>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed text-stone-300">
              <li>• jestli demo hry dává smysl novému hráči</li>
              <li>• jestli je hra použitelná na mobilu i desktopu</li>
              <li>• jestli jsou pravidla pochopitelná</li>
              <li>• jestli se hra nezasekává při tazích, nákupech nebo závodech</li>
              <li>• jestli bot působí aspoň trochu rozumně</li>
              <li>• jestli má výhra dobrý pocit</li>
            </ul>
          </section>
        </div>

        <section id="feedback" className={`${paperCard} mt-5 p-5 sm:p-6`}>
          <div className={sectionTitle}>Jak se zapojit</div>
          <h2 className="mt-3 text-xl font-bold text-amber-50">Stačí vyzkoušet demo a poslat zpětnou vazbu</h2>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-stone-300">
            Zpětnou vazbu mi zatím pošli přes kontakt, ze kterého jsi dostal odkaz. Ideálně napiš, co bylo nejasné, kde se hra zasekla a co tě naopak bavilo.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/"
              className="inline-flex h-10 items-center justify-center rounded-full border border-amber-200/20 bg-amber-500/15 px-4 text-sm font-semibold text-amber-100 transition hover:bg-amber-500/25"
            >
              Zpět na PayToWin.cz
            </Link>
            <span className="inline-flex h-10 items-center rounded-full border border-white/10 px-4 text-sm font-semibold text-stone-300">
              Zpětnou vazbu mi zatím pošli přes kontakt, ze kterého jsi dostal odkaz.
            </span>
          </div>
        </section>
      </div>
    </main>
  );
}
