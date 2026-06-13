import type { Metadata } from "next";
import QuickGameLauncher from "@/app/components/landing/QuickGameLauncher";

export const metadata: Metadata = {
  title: "Rychlá hra | PayToWin.cz",
  description:
    "Zahraj si rychlou hru proti botům bez registrace. Spusť hned — žádné přihlašování.",
  alternates: {
    canonical: "https://paytowin.cz/quickgame",
  },
  openGraph: {
    title: "Rychlá hra | PayToWin.cz",
    description:
      "Zahraj si rychlou hru proti botům bez registrace. Spusť hned.",
    url: "https://paytowin.cz/quickgame",
  },
};

export default function QuickGamePage() {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center p-6"
      style={{
        backgroundImage:
          "linear-gradient(rgba(15,23,42,0.68) 0%, rgba(15,23,42,0.50) 50%, rgba(15,23,42,0.72) 100%), url('/bg_horse_day.webp')",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="w-full max-w-sm space-y-6">

        {/* Logo / nadpis */}
        <div className="text-center">
          <div className="brand-logo brand-logo--hero mx-auto inline-block">
            <span className="brand-logo__wordmark">
              <span className="brand-logo__pay">Race</span>
              <span className="brand-logo__to">To</span>
              <span className="brand-logo__win">Win</span>
            </span>
          </div>
          <p className="mt-2 text-sm font-semibold text-amber-200/80">
            Rychlá hra proti botům
          </p>
        </div>

        {/* Info karta */}
        <div className="rounded-2xl border border-amber-600/30 bg-slate-950/80 p-5 backdrop-blur-sm space-y-4">
          <ul className="space-y-2 text-sm text-amber-100/80">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-amber-400">🏇</span>
              Okamžitý start — žádná registrace
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-amber-400">🤖</span>
              Hraješ proti 2 botům
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-amber-400">💰</span>
              Mapa Denní dostihy, výchozí ekonomika
            </li>
          </ul>

          <QuickGameLauncher ctaLabel="Spustit rychlou hru" />
        </div>

        {/* Zpět */}
        <p className="text-center text-xs text-amber-200/40">
          <a href="/" className="underline hover:text-amber-200/70">
            ← Zpět na hlavní stránku
          </a>
        </p>

      </div>
    </div>
  );
}
