import Link from "next/link";

interface Props {
  compact?: boolean;
}

const RACE_CARDS = [
  {
    type: "Dostihy",
    emoji: "🏇",
    desc: "Klasické dostihové závody — koně, žokejové, sázkové příležitosti.",
  },
  {
    type: "Závody aut",
    emoji: "🏎️",
    desc: "Motoristické soutěže a rychlostní závody po celém světě.",
  },
  {
    type: "Speciální závodní události",
    emoji: "🏆",
    desc: "Mimořádné závody, šampionáty a sezónní závodní akce.",
  },
];

export default function BetsPreview({ compact = false }: Props) {
  if (compact) {
    return (
      <div className="rounded-2xl border border-slate-700/60 bg-slate-800/50 p-4 space-y-3">
        <div>
          <div className="text-sm font-semibold text-slate-100">Reálné dostihy a závody</div>
          <p className="mt-1 text-xs text-slate-400">
            Připravujeme přehled externích sázkových nabídek na reálné závody.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {RACE_CARDS.slice(0, 2).map((card) => (
            <div
              key={card.type}
              className="rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2.5"
            >
              <div className="text-base">{card.emoji}</div>
              <div className="mt-1 text-xs font-semibold text-slate-200">{card.type}</div>
              <div className="mt-0.5 inline-flex items-center rounded-full bg-amber-500/20 px-1.5 py-px text-[10px] font-semibold text-amber-400">
                Brzy
              </div>
            </div>
          ))}
        </div>
        <Link
          href="/bets"
          className="block w-full rounded-xl border border-slate-600 bg-slate-700/50 px-3 py-2 text-center text-xs font-semibold text-slate-300 hover:bg-slate-700 transition"
        >
          Dostihy a sázky 18+ →
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white py-12 px-6">
      <div className="mx-auto max-w-2xl space-y-8">

        {/* Hero */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-black text-white">Dostihy a závody</h1>
          <p className="text-slate-400">
            Připravujeme přehled reálných závodů a externích sázkových nabídek.
          </p>
        </div>

        {/* Disclaimer */}
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300 text-center">
          ⚠️ Sázky jsou externí obsah. Pouze pro osoby starší 18 let. Hraj zodpovědně.
        </div>

        {/* Připravujeme sekce */}
        <div className="space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            Připravujeme
          </h2>
          <div className="space-y-3">
            {RACE_CARDS.map((card) => (
              <div
                key={card.type}
                className="rounded-2xl border border-slate-700 bg-slate-800/60 px-5 py-4 flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <span className="text-3xl shrink-0">{card.emoji}</span>
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-100">{card.type}</div>
                    <div className="mt-0.5 text-sm text-slate-400 leading-snug">{card.desc}</div>
                    <div className="mt-1.5 inline-flex items-center rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-semibold text-amber-400">
                      Brzy
                    </div>
                  </div>
                </div>
                <button
                  disabled
                  className="shrink-0 rounded-xl border border-slate-600 bg-slate-700/50 px-4 py-2 text-sm font-semibold text-slate-500 cursor-not-allowed"
                >
                  Zobrazit nabídku
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Info box */}
        <div className="rounded-2xl border border-slate-700 bg-slate-800/40 px-5 py-4 text-sm text-slate-400">
          💡 Až bude web mít traffic, napojíme affiliate partnera nebo ručně vybraný externí odkaz.
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
