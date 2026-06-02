import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "O nás | PayToWin.cz",
  description: "Kdo stojí za PayToWin.cz, českou online deskovkou o závodech, risku, penězích a špatných rozhodnutích.",
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

        <section className={`${cardClass} overflow-hidden`}>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.16),transparent_40%),radial-gradient(circle_at_bottom_right,rgba(120,53,15,0.28),transparent_45%)]" />
          <div className="relative space-y-5">
            <div className={sectionTitle}>O nás</div>
            <h1 className="max-w-3xl font-serif text-4xl font-semibold leading-[0.95] tracking-[-0.04em] text-amber-50 sm:text-5xl lg:text-6xl">
              O nás
            </h1>
            <p className="max-w-3xl text-base leading-relaxed text-stone-300 sm:text-lg">
              Za PayToWin.cz stojím hlavně já — Hynek „czhyenacz“ Dařbujan. Vymýšlím pravidla, ladím flow hry, píšu texty, zkouším AI nástroje a postupně z toho skládám českou online deskovku, kterou si chci sám zahrát.
            </p>
            <p className="max-w-3xl text-sm leading-relaxed text-stone-400 sm:text-[15px]">
              Proč tedy „o nás“? Protože tahle hra nevzniká ve vzduchoprázdnu. Je o nás, které baví deskové hry, prototypování, vymýšlení vlastních pravidel, tvorba obsahu, testování s kamarády, hraní si s AI a někdy i vrtání se ve zdrojovém kódu jen proto, že to jde.
            </p>
            <p className="max-w-3xl text-sm leading-relaxed text-stone-300">
              Moje další projekty a pokusy najdeš na{" "}
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
          </div>
        </section>

        <div className="mt-5 grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
          <section className={cardClass}>
            <div className={sectionTitle}>Co zkouším</div>
            <h2 className="mt-3 text-xl font-bold text-amber-50">Projekty, deskovky, AI a kód</h2>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed text-stone-300">
              <li>• českou online deskovku, která má vlastní atmosféru</li>
              <li>• hru, kde se potkává náhoda, risk, peníze a špatná rozhodnutí</li>
              <li>• vývojový proces, kde AI pomáhá s návrhem, texty i kódem</li>
              <li>• komunitní testování místo dokonalého produktu od prvního dne</li>
            </ul>
          </section>

          <section className={cardClass}>
            <div className={sectionTitle}>Jak to beru</div>
            <h2 className="mt-3 text-xl font-bold text-amber-50">Experiment ve vývoji</h2>
            <p className="mt-3 text-sm leading-relaxed text-stone-300">
              PayToWin.cz je zatím beta. Něco funguje, něco se rozbije a něco se během testování úplně přepíše. Pokud tě baví sledovat, jak se hra rodí, jsi tu správně.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-stone-400">
              Když budeš chtít napsat, co je divné, co dává smysl nebo co bys změnil, budu rád. Upřímná zpětná vazba je pro tenhle projekt důležitější než uhlazený marketing.
            </p>
          </section>
        </div>

        <section className={`${cardClass} mt-5`}>
          <div className={sectionTitle}>Kontakt</div>
          <h2 className="mt-3 text-xl font-bold text-amber-50">Zpětná vazba</h2>
          <p className="mt-3 text-sm leading-relaxed text-stone-300">
            Zpětnou vazbu mi zatím pošli přes kontakt, ze kterého jsi dostal odkaz.
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
