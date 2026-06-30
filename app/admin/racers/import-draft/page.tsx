import type { Metadata } from "next";
import WithAdminAuth from "@/app/components/WithAdminAuth";
import { loadDraftManifest, loadClassicLegendDraftManifest, type RacerDraftItem } from "@/lib/racers/import-review";
import ImportActions from "./ImportActions";

export const metadata: Metadata = {
  title: "Racer draft export | Admin",
  description: "Přehled vygenerovaného racer draftu.",
};

export const dynamic = "force-dynamic";

const KIND_COLORS: Record<RacerDraftItem["kind"], string> = {
  game_pool:      "bg-blue-100 text-blue-700",
  work:           "bg-amber-100 text-amber-700",
  perma_unique:   "bg-purple-100 text-purple-700",
  classic_legend: "bg-amber-200 text-amber-800",
  unknown:        "bg-slate-100 text-slate-500",
};

function KindBadge({ kind }: { kind: RacerDraftItem["kind"] }) {
  const cls = KIND_COLORS[kind] ?? "bg-slate-100 text-slate-500";
  return <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${cls}`}>{kind}</span>;
}

function Val({ v }: { v: string | number | null | undefined }) {
  if (v === null || v === undefined || v === "") return <span className="text-slate-400">—</span>;
  return <span>{String(v)}</span>;
}

function HorseCard({ item }: { item: RacerDraftItem }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="aspect-video w-full overflow-hidden bg-slate-100 flex items-center justify-center">
        <img src={item.imagePath} alt={item.displayName} className="h-full w-full object-contain p-2" loading="lazy" />
      </div>
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="font-bold text-slate-900">{item.displayName}</div>
            <div className="text-xs font-mono text-slate-400">{item.slug}</div>
          </div>
          <KindBadge kind={item.kind} />
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          <dt className="text-slate-400">color</dt>      <dd className="text-slate-700"><Val v={item.color} /></dd>
          <dt className="text-slate-400">speed</dt>      <dd className="text-slate-700"><Val v={item.speed} /></dd>
          <dt className="text-slate-400">maxStamina</dt> <dd className="text-slate-700"><Val v={item.maxStamina} /></dd>
          <dt className="text-slate-400">price</dt>      <dd className="text-slate-700"><Val v={item.price} /></dd>
          <dt className="text-slate-400">rarity</dt>     <dd className="text-slate-700"><Val v={item.rarity} /></dd>
          {item.poolType && (
            <><dt className="text-slate-400">poolType</dt><dd className="text-slate-700"><Val v={item.poolType} /></dd></>
          )}
        </dl>
        {item.flavorText && (
          <p className="text-xs italic text-slate-600 border-t border-slate-100 pt-2">&ldquo;{item.flavorText}&rdquo;</p>
        )}
        <div className="border-t border-slate-100 pt-2">
          <p className="text-xs font-mono text-slate-400 truncate" title={item.imagePath}>{item.imagePath}</p>
        </div>
      </div>
    </div>
  );
}

export default async function AdminRacerImportDraftPage() {
  const draft   = loadDraftManifest();
  const clDraft = loadClassicLegendDraftManifest();

  const raceWorkCount      = draft?.filter((d) => d.kind === "game_pool" || d.kind === "work").length ?? 0;
  const permaCount         = draft?.filter((d) => d.kind === "perma_unique").length ?? 0;
  const classicLegendCount = clDraft?.length ?? 0;

  return (
    <WithAdminAuth>
      <main className="min-h-screen bg-slate-50 px-4 py-8">
        <div className="mx-auto max-w-7xl space-y-8">
          <div>
            <h1 className="text-3xl font-black text-slate-900">Racer draft export</h1>
            <p className="mt-1 text-sm text-slate-500">
              Read-only přehled vygenerovaných draft souborů před zápisem do DB.
            </p>
          </div>

          {/* Summary counts */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {(
              [
                { label: "Horses celkem", value: draft?.length ?? 0,   cls: "bg-slate-800 text-white" },
                { label: "game_pool",     value: raceWorkCount - (draft?.filter(d => d.kind === "work").length ?? 0), cls: "bg-blue-600 text-white" },
                { label: "work",          value: draft?.filter((d) => d.kind === "work").length ?? 0,         cls: "bg-amber-500 text-white" },
                { label: "perma_unique",  value: permaCount,            cls: "bg-purple-600 text-white" },
                { label: "classic_legend",value: classicLegendCount,    cls: "bg-amber-700 text-white" },
              ] as { label: string; value: number; cls: string }[]
            ).map(({ label, value, cls }) => (
              <div key={label} className={`rounded-xl px-4 py-3 ${cls}`}>
                <div className="text-2xl font-black">{value}</div>
                <div className="text-xs font-medium opacity-80">{label}</div>
              </div>
            ))}
          </div>

          {/* Import actions */}
          <ImportActions
            raceWorkCount={raceWorkCount}
            permaCount={permaCount}
            classicLegendCount={classicLegendCount}
          />

          {/* Pardubice koně */}
          {draft === null ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-6 py-8 text-center text-amber-800">
              <p className="text-base font-semibold">Pardubice draft zatím neexistuje.</p>
              <p className="mt-1 text-sm">
                Vygeneruj ho na{" "}
                <a href="/admin/racers/import-review" className="underline hover:text-amber-900">/admin/racers/import-review</a>.
              </p>
            </div>
          ) : (
            <section className="space-y-4">
              <h2 className="text-xl font-black text-slate-800">Pardubice koně ({draft.length})</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {draft.map((item) => <HorseCard key={item.id} item={item} />)}
              </div>
            </section>
          )}

          {/* Classic legend koně */}
          {clDraft === null ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-6 py-8 text-center text-slate-600">
              <p className="text-base font-semibold">Classic legend draft zatím neexistuje.</p>
              <p className="mt-1 text-sm">
                Vygeneruj ho na{" "}
                <a href="/admin/racers/import-review?group=classic-legend" className="underline hover:text-slate-900">
                  /admin/racers/import-review?group=classic-legend
                </a>.
              </p>
            </div>
          ) : (
            <section className="space-y-4">
              <h2 className="text-xl font-black text-slate-800">Classic legend koně ({clDraft.length})</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {clDraft.map((item) => <HorseCard key={item.id} item={item} />)}
              </div>
            </section>
          )}
        </div>
      </main>
    </WithAdminAuth>
  );
}
