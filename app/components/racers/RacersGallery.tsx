"use client";

import type { RacerProfile } from "@/lib/racers/types";
import type { RacerCatalogSection, RacerUnique } from "@/lib/racers/catalog";
import { RACER_TYPE_LABELS } from "@/lib/racers/types";

interface Props {
  sections: RacerCatalogSection[];
}

function RacerCard({ racer, href }: { racer: RacerProfile | RacerUnique; href?: string }) {
  const isPerma = "sale_status" in racer;
  const flavorText = "flavorText" in racer ? racer.flavorText : undefined;
  const body = (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm hover:shadow-md transition">
      <div className="relative aspect-square bg-slate-100 flex items-center justify-center group">
        {"imageUrl" in racer && racer.imageUrl ? (
          <img src={racer.imageUrl} alt={racer.name} className="h-full w-full object-cover" />
        ) : (
          <div className="text-5xl select-none">🏁</div>
        )}
        {flavorText && (
          <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-2.5">
            <p className="text-[11px] leading-snug text-white/95 font-medium">{flavorText}</p>
          </div>
        )}
      </div>
      <div className="p-3">
        <div className="text-sm font-bold text-slate-900">{racer.name}</div>
        <div className="mt-1 text-[11px] text-slate-500">
          {"type" in racer ? RACER_TYPE_LABELS[racer.type] : racer.rarity}
        </div>
        {isPerma && (
          <div className="mt-1 flex flex-wrap gap-1 text-[10px] font-semibold">
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-800">Permanentní</span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-700">{racer.status}</span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-700">{racer.sale_status}</span>
          </div>
        )}
      </div>
    </div>
  );

  if (!href) return body;
  return <a href={href}>{body}</a>;
}

export default function RacersGallery({ sections }: Props) {
  return (
    <div className="space-y-10">
      {sections.map((section) => (
        <section key={section.species} className="space-y-4">
          <div>
            <h2 className="text-2xl font-black text-slate-900">{section.label}</h2>
            <p className="text-sm text-slate-500">Běžní raceři, legendy a permanentní kusy odděleně.</p>
          </div>

          <div className="space-y-6">
            <div>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Běžní raceři</h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {section.gameRacers.map((r) => <RacerCard key={r.id} racer={r} />)}
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Legendy / event raceři</h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {section.legendRacers.map((r) => <RacerCard key={r.id} racer={r} />)}
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">K prodeji</h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {section.permaForSale.map((u) => (
                  <RacerCard key={u.id} racer={u} href={`/racers/perma/${u.slug}`} />
                ))}
              </div>
            </div>

            {section.classicLegend.length > 0 && (
              <div>
                <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-amber-700">Historická stáj</h3>
                <p className="mb-2 text-xs text-amber-600">Historičtí koně z Velké pardubické. Dostupní přes speciální kartu.</p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {section.classicLegend.map((r) => <RacerCard key={r.id} racer={r} />)}
                </div>
              </div>
            )}
          </div>
        </section>
      ))}
    </div>
  );
}
