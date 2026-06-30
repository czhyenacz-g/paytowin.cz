import type { Metadata } from "next";
import WithAdminAuth from "@/app/components/WithAdminAuth";
import { loadDraftManifest, type RacerDraftItem } from "@/lib/racers/import-review";

export const metadata: Metadata = {
  title: "Racer draft export | Admin",
  description: "Přehled vygenerovaného racer draftu.",
};

export const dynamic = "force-dynamic";

const KIND_COLORS: Record<RacerDraftItem["kind"], string> = {
  game_pool: "bg-blue-100 text-blue-700",
  work: "bg-amber-100 text-amber-700",
  perma_unique: "bg-purple-100 text-purple-700",
  unknown: "bg-slate-100 text-slate-500",
};

function KindBadge({ kind }: { kind: RacerDraftItem["kind"] }) {
  const cls = KIND_COLORS[kind] ?? "bg-slate-100 text-slate-500";
  return (
    <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${cls}`}>
      {kind}
    </span>
  );
}

function Val({ v }: { v: string | number | null | undefined }) {
  if (v === null || v === undefined || v === "") {
    return <span className="text-slate-400">—</span>;
  }
  return <span>{String(v)}</span>;
}

export default async function AdminRacerImportDraftPage() {
  const draft = loadDraftManifest();

  return (
    <WithAdminAuth>
      <main className="min-h-screen bg-slate-50 px-4 py-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <div>
            <h1 className="text-3xl font-black text-slate-900">Racer draft export</h1>
            <p className="mt-1 text-sm text-slate-500">
              Read-only přehled vygenerovaného souboru{" "}
              <code className="font-mono">horses.racers-draft.json</code>.
            </p>
          </div>

          {draft === null ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-6 py-8 text-center text-amber-800">
              <p className="text-base font-semibold">Draft zatím neexistuje.</p>
              <p className="mt-1 text-sm">
                Nejdřív ho vygeneruj na{" "}
                <a
                  href="/admin/racers/import-review"
                  className="underline hover:text-amber-900"
                >
                  /admin/racers/import-review
                </a>
                .
              </p>
            </div>
          ) : (
            <>
              {/* Summary counts */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                {(
                  [
                    { label: "Total", value: draft.length, cls: "bg-slate-800 text-white" },
                    { label: "game_pool", value: draft.filter((d) => d.kind === "game_pool").length, cls: "bg-blue-600 text-white" },
                    { label: "work", value: draft.filter((d) => d.kind === "work").length, cls: "bg-amber-500 text-white" },
                    { label: "perma_unique", value: draft.filter((d) => d.kind === "perma_unique").length, cls: "bg-purple-600 text-white" },
                    { label: "unknown", value: draft.filter((d) => d.kind === "unknown").length, cls: "bg-slate-400 text-white" },
                  ] as { label: string; value: number; cls: string }[]
                ).map(({ label, value, cls }) => (
                  <div key={label} className={`rounded-xl px-4 py-3 ${cls}`}>
                    <div className="text-2xl font-black">{value}</div>
                    <div className="text-xs font-medium opacity-80">{label}</div>
                  </div>
                ))}
              </div>

              {/* Cards grid */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {draft.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden"
                  >
                    {/* Image */}
                    <div className="aspect-video w-full overflow-hidden bg-slate-100 flex items-center justify-center">
                      <img
                        src={item.imagePath}
                        alt={item.displayName}
                        className="h-full w-full object-contain p-2"
                        loading="lazy"
                      />
                    </div>

                    {/* Info */}
                    <div className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-bold text-slate-900">{item.displayName}</div>
                          <div className="text-xs font-mono text-slate-400">{item.slug}</div>
                        </div>
                        <KindBadge kind={item.kind} />
                      </div>

                      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                        <dt className="text-slate-400">sourceCategory</dt>
                        <dd className="text-slate-700 font-medium"><Val v={item.sourceCategory} /></dd>

                        <dt className="text-slate-400">color</dt>
                        <dd className="text-slate-700"><Val v={item.color} /></dd>

                        <dt className="text-slate-400">role</dt>
                        <dd className="text-slate-700"><Val v={item.role} /></dd>

                        <dt className="text-slate-400">speed</dt>
                        <dd className="text-slate-700"><Val v={item.speed} /></dd>

                        <dt className="text-slate-400">maxStamina</dt>
                        <dd className="text-slate-700"><Val v={item.maxStamina} /></dd>

                        <dt className="text-slate-400">price</dt>
                        <dd className="text-slate-700"><Val v={item.price} /></dd>

                        <dt className="text-slate-400">rarity</dt>
                        <dd className="text-slate-700"><Val v={item.rarity} /></dd>
                      </dl>

                      {item.flavorText && (
                        <p className="text-xs italic text-slate-600 border-t border-slate-100 pt-2">
                          &ldquo;{item.flavorText}&rdquo;
                        </p>
                      )}

                      {item.story && (
                        <div className="border-t border-slate-100 pt-2">
                          <p className="text-xs text-slate-400 font-medium mb-0.5">story</p>
                          <p className="text-xs text-slate-600 line-clamp-3"><Val v={item.story} /></p>
                        </div>
                      )}

                      {item.internalNotes && (
                        <div className="border-t border-slate-100 pt-2">
                          <p className="text-xs text-slate-400 font-medium mb-0.5">internalNotes</p>
                          <p className="text-xs text-slate-500 italic"><Val v={item.internalNotes} /></p>
                        </div>
                      )}

                      <div className="border-t border-slate-100 pt-2">
                        <p className="text-xs font-mono text-slate-400 truncate" title={item.imagePath}>
                          {item.imagePath}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </main>
    </WithAdminAuth>
  );
}
