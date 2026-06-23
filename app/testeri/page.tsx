import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Wanted testeři hry | StartovníPole.cz",
  description:
    "Hledám testery pro StartovníPole.cz, českou online deskovku o závodech, penězích a risku. Vyzkoušej demo hry a pomoz doladit pravidla, mobilní ovládání i zábavnost.",
  alternates: {
    canonical: "https://startovnipole.cz/testeri",
  },
  openGraph: {
    title: "Wanted testeři hry | StartovníPole.cz",
    description:
      "Hledám testery pro StartovníPole.cz, českou online deskovku o závodech, penězích a risku. Vyzkoušej demo hry a pomoz doladit pravidla, mobilní ovládání i zábavnost.",
    url: "https://startovnipole.cz/testeri",
    siteName: "StartovníPole.cz",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Wanted testeři hry | StartovníPole.cz",
    description:
      "Hledám testery pro StartovníPole.cz, českou online deskovku o závodech, penězích a risku. Vyzkoušej demo hry a pomoz doladit pravidla, mobilní ovládání i zábavnost.",
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
            ← Zpět na StartovníPole.cz
          </Link>
          <span className="rounded-full border border-amber-300/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-amber-300">
            Beta v0.7.87-seno
          </span>
        </div>

        <section className={`${paperCard} relative overflow-hidden`}>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.16),transparent_40%),radial-gradient(circle_at_bottom_right,rgba(120,53,15,0.28),transparent_45%)]" />
          <div className="relative grid gap-6 p-5 sm:p-8 lg:grid-cols-[1.2fr_0.8fr] lg:p-10">
            <div className="space-y-5">
              <p className={sectionTitle}>Wanted</p>
              <h1 className="max-w-2xl font-serif text-4xl font-semibold leading-[0.95] tracking-[-0.04em] text-amber-50 sm:text-5xl lg:text-6xl">
                Wanted: testeři hry StartovníPole.cz
              </h1>
              <p className="max-w-2xl text-base leading-relaxed text-stone-300 sm:text-lg">
                Hledám pár lidí na beta testování české online deskovky StartovníPole.cz (navazuje na PayToWin). Zahraj demo hry, zkus mobil i desktop a napiš, co je nejasné, zábavné nebo rozbité.
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

        <div className="mt-5 grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
          <section className={`${paperCard} p-5`}>
            <div className={sectionTitle}>Kdo za tím stojí</div>
            <h2 className="mt-3 text-xl font-bold text-amber-50">Osobní výzva od autora hry</h2>
            <p className="mt-3 text-sm leading-relaxed text-stone-300">
              Za StartovníPole.cz nestojí tým o stovce lidí. Stavím ho já — Hynek „czhyenacz“ Dařbujan — a pár přátel, kteří se nebojí říct mi, že něco nefunguje, nedává smysl nebo prostě není zábavné.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-amber-100/80">
              Právě takovou zpětnou vazbu teď potřebuji víc než pochvalu.
            </p>
          </section>

          <section className={`${paperCard} p-5`} id="feedback">
            <div className={sectionTitle}>Co mi nejvíc pomůže</div>
            <h2 className="mt-3 text-xl font-bold text-amber-50">Pár upřímných vět po jedné partii</h2>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed text-stone-300">
              <li>• kde ses ve hře ztratil</li>
              <li>• co tě bavilo</li>
              <li>• co bylo moc pomalé, nejasné nebo rozbité</li>
              <li>• jestli se hra dobře ovládala na mobilu</li>
              <li>• jestli bys ji zkusil znovu s kamarádem</li>
            </ul>
            <p className="mt-3 text-sm leading-relaxed text-stone-300">
              Nemusíš psát dlouhý report. I pár upřímných vět po jedné partii mi pomůže víc než ticho.
            </p>
          </section>
        </div>

        {/* Síň slávy testerů */}
        <section className={`${paperCard} mt-5 p-5 sm:p-6`}>
          <div className={sectionTitle}>Síň slávy</div>
          <h2 className="mt-3 text-xl font-bold text-amber-50">Testeři, kteří šli do toho první</h2>
          <p className="mt-2 text-sm leading-relaxed text-stone-400">
            Bez nich by hra ještě dřepěla v garážovém betě. Díky za odvahu.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            {[
              { name: "Seno", note: "první v sedle" },
              { name: "Petr S.", note: null },
              { name: "Aleš K.", note: null },
              { name: "Vojta S.", note: null },
              { name: "\"Mejtoš\"", note: null },
            ].map((t, i) => (
              <div
                key={t.name}
                className="flex items-center gap-2.5 rounded-2xl border border-amber-200/15 bg-black/30 px-4 py-3"
              >
                <span className="text-lg leading-none" aria-hidden>🐴</span>
                <div>
                  <div className="text-sm font-bold text-amber-100">{t.name}</div>
                  {t.note && (
                    <div className="text-[11px] text-amber-300/60">{t.note}</div>
                  )}
                </div>
                {i === 0 && (
                  <span className="ml-1 rounded-full border border-amber-300/30 bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-amber-300">#1</span>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className={`${paperCard} mt-5 p-5 sm:p-6`}>
          <div className={sectionTitle}>Jak se zapojit</div>
          <h2 className="mt-3 text-xl font-bold text-amber-50">Stačí vyzkoušet demo a napsat mi</h2>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-stone-300">
            Zpětnou vazbu mi zatím pošli přes kontakt, ze kterého jsi dostal odkaz. Ideálně napiš, co bylo nejasné, kde se hra zasekla a co tě naopak bavilo.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/"
              className="inline-flex h-10 items-center justify-center rounded-full border border-amber-200/20 bg-amber-500/15 px-4 text-sm font-semibold text-amber-100 transition hover:bg-amber-500/25"
            >
              Zpět na StartovníPole.cz
            </Link>
            <a
              href="mailto:info@paytowin.cz"
              className="inline-flex h-10 items-center rounded-full border border-white/10 px-4 text-sm font-semibold text-stone-300 transition hover:border-amber-300/30 hover:text-amber-100"
            >
              info@paytowin.cz
            </a>
          </div>
        </section>
      </div>
    </main>
  );
}
