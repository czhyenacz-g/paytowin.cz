import Link from "next/link";

export const metadata = {
  title: "Partnerství a spolupráce — paytowin.cz",
  description: "Hledáme partnery pro reklamu, affiliate spolupráci a speciální herní eventy na PayToWin.cz.",
};

const COOPERATION_OPTIONS = [
  {
    emoji: "📢",
    title: "Reklama na webu",
    desc: "Bannerová nebo textová reklama na LandingPage, v herních obrazovkách nebo na tematických podstránkách.",
  },
  {
    emoji: "🔗",
    title: "Affiliate odkazy",
    desc: "Vaše nabídka propojená s naší /bets stránkou. Platba za klik nebo konverzi — domluvíme individuálně.",
  },
  {
    emoji: "🏁",
    title: "Speciální herní eventy",
    desc: "Pojmenovaný závod nebo turnaj nesoucí vaše jméno. Hráči soutěží, vy získáváte viditelnost.",
  },
  {
    emoji: "🎁",
    title: "Soutěže o produkty partnera",
    desc: "Výherci dostihů nebo speciálních eventů ve hře mohou získat reálné ceny od vás.",
  },
];

const FOR_WHO = [
  { emoji: "🏇", label: "Dostihové a závodní projekty" },
  { emoji: "🎮", label: "Herní značky a e-shopy" },
  { emoji: "🏪", label: "Lokální podniky s tematickým přesahem" },
  { emoji: "🛒", label: "E-shopy s tematickými produkty" },
  { emoji: "📊", label: "Budoucí affiliate partneři (sázky 18+)" },
];

const COMING_SOON = [
  "Reklamní bloky na LandingPage",
  "Stránka /bets s externími nabídkami",
  "Speciální branded eventy ve hře",
  "Soutěže a odměny pro hráče",
];

export default function PartnersPage() {
  return (
    <div className="min-h-screen bg-slate-900 text-white py-12 px-6">
      <div className="mx-auto max-w-2xl space-y-10">

        {/* Hero */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-black text-white">Partnerství a spolupráce</h1>
          <p className="text-slate-400">
            Hledáme partnery pro reklamu, affiliate spolupráci a speciální herní eventy.
          </p>
        </div>

        {/* Úvod */}
        <div className="rounded-2xl border border-slate-700 bg-slate-800/60 px-5 py-5 text-sm text-slate-300 leading-relaxed space-y-2">
          <p>
            <strong className="text-white">PayToWin.cz</strong> je závodní online deskovka inspirovaná dostihy a motoristickými závody.
            Hráči staví stáje, kupují závodníky, sázejí a soupeří v multiplayer hrách v reálném čase.
          </p>
          <p className="text-slate-400">
            Web je ve veřejné betě s rostoucí hráčskou základnou. Hledáme partnery, kteří se chtějí spojit
            s tímto konceptem dříve, než přijde velký traffic.
          </p>
        </div>

        {/* Možnosti spolupráce */}
        <div className="space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            Možnosti spolupráce
          </h2>
          <div className="space-y-3">
            {COOPERATION_OPTIONS.map((opt) => (
              <div
                key={opt.title}
                className="rounded-2xl border border-slate-700 bg-slate-800/60 px-5 py-4 flex items-start gap-4"
              >
                <span className="text-2xl shrink-0 mt-0.5">{opt.emoji}</span>
                <div>
                  <div className="font-semibold text-slate-100">{opt.title}</div>
                  <div className="mt-1 text-sm text-slate-400 leading-snug">{opt.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pro koho */}
        <div className="space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            Pro koho to může být
          </h2>
          <div className="rounded-2xl border border-slate-700 bg-slate-800/40 px-5 py-4">
            <ul className="space-y-2">
              {FOR_WHO.map((item) => (
                <li key={item.label} className="flex items-center gap-3 text-sm text-slate-300">
                  <span className="shrink-0">{item.emoji}</span>
                  <span>{item.label}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Co připravujeme */}
        <div className="space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            Co připravujeme
          </h2>
          <div className="rounded-2xl border border-slate-700 bg-slate-800/40 px-5 py-4">
            <ul className="space-y-2">
              {COMING_SOON.map((item) => (
                <li key={item} className="flex items-center gap-3 text-sm text-slate-400">
                  <span className="text-amber-400 shrink-0">→</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* CTA */}
        <div className="rounded-2xl border border-indigo-500/30 bg-indigo-500/10 px-6 py-6 space-y-4 text-center">
          <div>
            <div className="text-lg font-bold text-white">Máte zájem o spolupráci?</div>
            <p className="mt-1.5 text-sm text-slate-400">
              Napište nám a domluvíme individuální formu partnerství.
            </p>
          </div>
          <a
            href="mailto:info@paytowin.cz?subject=Partnerství PayToWin.cz"
            className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-500 transition"
          >
            ✉️ info@paytowin.cz
          </a>
        </div>

        {/* Zpět */}
        <div className="text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-800 px-5 py-2.5 text-sm font-semibold text-slate-200 hover:bg-slate-700 transition"
          >
            ← Zpět na hlavní stránku
          </Link>
        </div>

      </div>
    </div>
  );
}
