import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "FAQ | StartovníPole.cz",
  description:
    "Časté otázky ke StartovníPole.cz, české online závodní deskovce. Jak se hraje, co je kampaň RaceToWin a proč nejde o hazard.",
  alternates: {
    canonical: "https://startovnipole.cz/faq",
  },
  openGraph: {
    title: "FAQ | StartovníPole.cz",
    description: "Časté otázky ke StartovníPole.cz, české online závodní deskovce.",
    url: "https://startovnipole.cz/faq",
    siteName: "StartovníPole.cz",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "FAQ | StartovníPole.cz",
    description: "Časté otázky ke StartovníPole.cz, české online závodní deskovce.",
  },
};

const faq: { q: string; a: string }[] = [
  {
    q: "Co je StartovníPole.cz?",
    a: "StartovníPole.cz je česká online závodní deskovka ve vývoji. Hráči se pohybují po mapě, kupují koně, závodí, riskují tahy, platí odvody a snaží se přežít finanční chaos. Aktuální kampaň se jmenuje RaceToWin a běží na enginu PayToWin, který řeší tahy, mapy, hráče, boty, závodníky, vlastnictví, minihry a kampaně.",
  },
  {
    q: "Je StartovníPole.cz hotová hra?",
    a: "Ne. StartovníPole.cz je beta verze a otevřený prototyp. Některé části už se dají hrát, jiné se ladí, přepisují nebo testují. Bugy, divné situace a změny pravidel zatím patří k vývoji.",
  },
  {
    q: "Je StartovníPole.cz hazard?",
    a: "Ne. StartovníPole.cz není hazardní hra. Nehraje se o skutečné peníze, herní mince nemají reálnou peněžní hodnotu a výhry nejdou vybrat. Jde o online deskovou hru a testovací herní projekt.",
  },
  {
    q: "Je hra vhodná i pro děti?",
    a: "Ano. StartovníPole.cz je nenásilná závodní deskovka s kostkou, náhodou a jednoduchými rozhodnutími. Přesný věk záleží na dítěti, ale cílíme na hru, kterou zvládnou děti, rodiče i prarodiče — klidně od 5 do 120 let.",
  },
  {
    q: "Musím za hru platit?",
    a: "Ne. Demo a testování hry je zdarma.",
  },
  {
    q: "Jak se hra hraje?",
    a: "Hráč hodí kostkou, posune se po mapě a podle políčka řeší nákup koně, kartu, závod, odvody, banku nebo jinou událost. Cílem je vydržet ve hře, sbírat výhry, dobře hospodařit s penězi a využívat šance, které se objeví.",
  },
  {
    q: "Co jsou koně nebo raceři?",
    a: "V první kampani jsou hlavními závodníky koně. V engine vrstvě jim říkáme raceři, protože do budoucna může stejný systém fungovat i pro auta, jezdce nebo jiné závodní entity.",
  },
  {
    q: "Dá se hrát na mobilu?",
    a: "Ano, hra je responzivní a běží i na mobilu. Mobilní ovládání se ale pořád ladí, hlavně u závodních miniher a soubojů. Pokud něco na mobilu nefunguje pohodlně, je to přesně typ zpětné vazby, který teď pomáhá.",
  },
  {
    q: "Dá se hrát proti botovi?",
    a: "Ano. Bot pomáhá testovat hru i ve chvíli, kdy není po ruce další hráč. Chování bota se postupně stabilizuje, aby uměl nakupovat, platit, závodit a nezasekával průběh partie.",
  },
  {
    q: "Dá se hrát s kamarády online?",
    a: "Ano. Hru lze založit a poslat ostatním odkaz nebo kód. Multiplayer je ale pořád ve vývoji, takže se ladí reconnect, připojení přes link, chování botů i různé hraniční situace.",
  },
  {
    q: "Proč se ve hře tolik řeší peníze?",
    a: "Protože je to satirická hra o světě, kde všechno něco stojí. Koně, závody, odvody, chyby i druhé šance. Peníze jsou herní prostředek, ne skutečná měna.",
  },
  {
    q: "Co znamená beta verze?",
    a: "Beta znamená, že hra je veřejně testovatelná, ale není finální. Pravidla, texty, mapy, mobilní ovládání i technické věci se můžou měnit podle testování.",
  },
  {
    q: "Jak můžu pomoct s testováním?",
    a: "Stačí odehrát demo partii a napsat, co bylo nejasné, co bylo zábavné, kde se hra zasekla nebo co na mobilu nefungovalo dobře. Více je na stránce pro testery.",
  },
  {
    q: "Můžu mít koně nebo závodníka pojmenovaného po sobě?",
    a: "Možná ano. Nejaktivnější a nejužitečnější testeři se můžou propsat přímo do hry — třeba jako jméno koně, závodníka nebo později auta. Není to garantovaná odměna pro každého, spíš poděkování lidem, kteří hře opravdu pomůžou.",
  },
  {
    q: "Kdo za StartovníPole.cz stojí?",
    a: "Za StartovníPole.cz stojí hlavně Hynek (czhyenacz) Dařbujan a pár lidí kolem něj, kteří se nebojí testovat, kritizovat a zkoušet divné nápady. Další projekty najdeš na darbujan.com.",
  },
  {
    q: "Co bude dál?",
    a: "Nejdřív se stabilizuje aktuální kampaň: pravidla, mobilní ovládání, bot, multiplayer a základní mapy. Potom může přibýt dalších map, kampaní, závodníků, aut nebo komunitního obsahu.",
  },
];

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faq.map(({ q, a }) => ({
    "@type": "Question",
    name: q,
    acceptedAnswer: { "@type": "Answer", text: a },
  })),
};

const cardClass =
  "rounded-[28px] border border-amber-200/15 bg-[#15110e]/92 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-sm";
const sectionTitle =
  "text-[11px] font-black uppercase tracking-[0.28em] text-amber-200/80";

export default function FaqPage() {
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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
        <a
          href="/"
          className="mb-4 inline-block text-xs font-semibold uppercase tracking-[0.25em] text-amber-100/70 hover:text-amber-100"
        >
          ← Zpět na úvod
        </a>

        {/* Hero */}
        <section className={`${cardClass} relative overflow-hidden`}>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.16),transparent_40%),radial-gradient(circle_at_bottom_right,rgba(120,53,15,0.28),transparent_45%)]" />
          <div className="relative space-y-3 p-5 sm:p-8">
            <div className={sectionTitle}>Časté otázky</div>
            <h1 className="font-serif text-3xl font-semibold leading-tight tracking-[-0.03em] text-amber-50 sm:text-4xl">
              FAQ — časté otázky ke StartovníPole.cz
            </h1>
            <p className="text-sm leading-relaxed text-stone-300 sm:text-[15px]">
              StartovníPole.cz je česká online závodní deskovka ve vývoji. Kombinuje tahovou
              deskovku, nákup koní, závody, risk, banku, odvody a špatná rozhodnutí. Tady jsou
              nejčastější otázky, které můžou zajímat nové hráče, testery i náhodné kolemjdoucí.
            </p>
          </div>
        </section>

        {/* FAQ bloky */}
        <div className="mt-4 space-y-3">
          {faq.map(({ q, a }) => (
            <section key={q} className={`${cardClass} p-5`}>
              <h2 className="text-sm font-bold text-amber-100 leading-snug">{q}</h2>
              <p className="mt-2 text-sm leading-relaxed text-stone-300">{a}</p>
            </section>
          ))}
        </div>

        {/* CTA */}
        <section className={`${cardClass} mt-5 p-5 sm:p-6`}>
          <div className={sectionTitle}>Pojď to zkusit</div>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/"
              className="inline-flex h-11 items-center justify-center rounded-full bg-gradient-to-b from-amber-200 to-amber-500 px-5 text-sm font-bold text-stone-950 shadow-[0_14px_30px_rgba(245,158,11,0.22)] transition hover:brightness-105"
            >
              Vyzkoušet demo
            </Link>
            <Link
              href="/testeri"
              className="inline-flex h-11 items-center justify-center rounded-full border border-amber-200/20 bg-white/5 px-5 text-sm font-semibold text-amber-100 transition hover:bg-white/10"
            >
              Hledám testery
            </Link>
            <Link
              href="/pravidla"
              className="inline-flex h-11 items-center justify-center rounded-full border border-white/10 bg-white/5 px-5 text-sm font-semibold text-stone-300 transition hover:border-amber-300/30 hover:text-amber-100"
            >
              Pravidla hry
            </Link>
          </div>
        </section>

        <div className="mt-8 pb-8 text-center text-xs text-stone-600">
          <a href="mailto:info@paytowin.cz" className="hover:text-stone-400 underline">
            info@paytowin.cz
          </a>
          {" · "}
          <a href="/o-nas" className="hover:text-stone-400 underline">
            O projektu
          </a>
        </div>
      </div>
    </main>
  );
}
