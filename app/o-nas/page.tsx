import type { Metadata } from "next";
import RotatingBenefitStrip from "@/app/components/RotatingBenefitStrip";

export const metadata: Metadata = {
  title: "O nás | RaceToWin",
  description: "RaceToWin je engine a aplikace pro českou online deskovku. PayToWin.cz je první kampaň postavenou na tomhle enginu. Za projektem stojí Hynek Dařbujan.",
};

const cardClass = "rounded-[28px] border border-amber-200/15 bg-[#15110e]/92 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-sm";
const sectionTitle = "text-[11px] font-black uppercase tracking-[0.28em] text-amber-200/80";

export default function ONasPage() {
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
        <a href="/" className="mb-4 inline-block text-xs font-semibold uppercase tracking-[0.25em] text-amber-100/70 hover:text-amber-100">
          ← Zpět na úvod
        </a>

        {/* Hero */}
        <section className={`${cardClass} overflow-hidden`}>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.16),transparent_40%),radial-gradient(circle_at_bottom_right,rgba(120,53,15,0.28),transparent_45%)]" />
          <div className="relative space-y-5">
            <div className={sectionTitle}>O projektu</div>
            <h1 className="max-w-3xl font-serif text-4xl font-semibold leading-[0.95] tracking-[-0.04em] text-amber-50 sm:text-5xl lg:text-6xl">
              RaceToWin
            </h1>
            <p className="max-w-3xl text-base leading-relaxed text-stone-300 sm:text-lg">
              RaceToWin je engine a aplikace pro českou online deskovku o závodech, risku a špatných rozhodnutích. Každá kampaň na tomhle enginu dostane vlastní svět, pravidla a atmosféru.
            </p>
            <p className="max-w-3xl text-sm leading-relaxed text-stone-400 sm:text-[15px]">
              <span className="font-semibold text-amber-200/90">PayToWin</span> je název první kampaně — a záměrná ironie. Odkazuje na hry, kde si hráči reálně kupují výhodu, která rozhoduje o výsledku. My to otočili: ve hře se platí a riskuje v rámci herního světa, ne ve skutečnosti. Žádné mikrotransakce, žádné prémiové výhody. Název je satirický komentář na tenhle model, ne jeho popis.
            </p>
          </div>
        </section>

        {/* Proč si to zahrát */}
        <section className={`${cardClass} mt-5`}>
          <div className={sectionTitle}>Proč si to zahrát</div>
          <h2 className="mt-3 text-xl font-bold text-amber-50">Svižná deskovka pro partu</h2>
          <p className="mt-3 text-sm leading-relaxed text-stone-300">
            PayToWin je online deskovka pro přátele. Kupuješ závodníky, posíláš je do závodů, riskuješ herní peníze a doufáš, že tě jedna špatná karta nepošle zpátky na zem.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-stone-400">
            Cíl není sedět u stolu celé odpoledne a čekat, až někdo konečně dohraje tah. Partie má být rychlejší, škodolibější a víc o společných momentech: kdo přestřelil nákup, kdo zariskoval v závodě, komu karta otočila hru a kdo se směje naposledy.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-stone-400">
            Hraje se v prohlížeči bez instalace — na počítači i mobilu. Můžeš začít u stolu, pokračovat z gauče nebo si odskočit s telefonem v ruce. Hra tě nemá držet na jednom místě.
          </p>
        </section>

        <div className="mt-4">
          <RotatingBenefitStrip />
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
          {/* Kdo za tím stojí */}
          <section className={cardClass}>
            <div className={sectionTitle}>Kdo za tím stojí</div>
            <h2 className="mt-3 text-xl font-bold text-amber-50">Hynek „czhyenacz" Dařbujan</h2>
            <p className="mt-3 text-sm leading-relaxed text-stone-300">
              Vymýšlím pravidla, ladím flow hry, píšu texty, zkouším AI nástroje a postupně z toho skládám věc, kterou si chci sám zahrát.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-stone-400">
              Moje další projekty najdeš na{" "}
              <a
                href="https://darbujan.com"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-amber-100 underline decoration-amber-300/40 underline-offset-4 hover:text-amber-50"
              >
                darbujan.com
              </a>
              .
            </p>
            <ul className="mt-4 space-y-1.5 text-sm leading-relaxed text-stone-300">
              <li>• návrh enginu a herní mechaniky</li>
              <li>• vývojový proces s AI (design, texty, kód)</li>
              <li>• komunitní testování místo dokonalého produktu od prvního dne</li>
            </ul>
          </section>

          {/* Jak se to vyvíjí */}
          <section className={cardClass}>
            <div className={sectionTitle}>Jak se to vyvíjí</div>
            <h2 className="mt-3 text-xl font-bold text-amber-50">Experiment ve vývoji</h2>
            <p className="mt-3 text-sm leading-relaxed text-stone-300">
              RaceToWin je zatím v beta fázi. Něco funguje, něco se rozbije a něco se během testování přepíše. Kampaň PayToWin.cz slouží jako první živý provoz enginu.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-stone-400">
              Pokud tě baví sledovat, jak se hra rodí, jsi tu správně. Upřímná zpětná vazba je pro tenhle projekt důležitější než uhlazený marketing.
            </p>
          </section>
        </div>

        {/* Kontakt */}
        <section className={`${cardClass} mt-5`}>
          <div className={sectionTitle}>Kontakt</div>
          <h2 className="mt-3 text-xl font-bold text-amber-50">Zpětná vazba</h2>
          <p className="mt-3 text-sm leading-relaxed text-stone-300">
            Zpětnou vazbu mi zatím pošli přes kontakt, ze kterého jsi dostal odkaz, nebo přímo na mail.
          </p>
          <div className="mt-4">
            <a
              href="mailto:info@paytowin.cz"
              className="inline-flex h-10 items-center justify-center rounded-full border border-white/10 px-4 text-sm font-semibold text-stone-300 transition hover:border-amber-300/30 hover:text-amber-100"
            >
              info@paytowin.cz
            </a>
          </div>
        </section>
      </div>
    </main>
  );
}
