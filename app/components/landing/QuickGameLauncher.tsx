"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { createQuickGame } from "@/lib/quickGame";

interface Props {
  /** Pokud zadán, button je přímý odkaz (a tag) místo vytváření hry — vhodné pro homepage CTA. */
  href?: string;
  ctaLabel?: string;
}

export default function QuickGameLauncher({ href, ctaLabel }: Props) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  const handleClick = async () => {
    setLoading(true);
    setError("");
    const result = await createQuickGame();
    if (!result.ok) {
      setError("Nepodařilo se spustit hru. Zkus to znovu.");
      setLoading(false);
      return;
    }
    router.push(`/game/${result.gameCode}`);
  };

  const label = ctaLabel ?? "🏇 Hrát rychlou hru proti botům";
  const btnClass =
    "w-full rounded-2xl bg-amber-600 px-6 py-4 text-base font-bold text-white shadow-lg transition hover:bg-amber-500 disabled:opacity-60 active:scale-[0.98] block text-center";

  return (
    <div className="w-full">
      {href ? (
        <a href={href} className={btnClass}>
          {label}
        </a>
      ) : (
        <button
          onClick={handleClick}
          disabled={loading}
          className={btnClass}
        >
          {loading ? "Zakládám hru…" : label}
        </button>
      )}
      <p className="mt-1.5 text-center text-xs text-amber-200/55">
        Bez registrace. Spustíš hru a hned hraješ proti botům.
      </p>
      {error && (
        <p className="mt-1 text-center text-xs text-red-400">{error}</p>
      )}
    </div>
  );
}
