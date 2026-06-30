import type { Metadata } from "next";
import Link from "next/link";
import WithAdminAuth from "@/app/components/WithAdminAuth";
import { loadImportReviewAction, loadClassicLegendImportReviewAction } from "./actions";
import ImportReviewClient, { type ImportGroup } from "./ImportReviewClient";

export const metadata: Metadata = {
  title: "Import review — koně | Admin",
  description: "Review a editace importovaných obrázků racerů.",
};

export const dynamic = "force-dynamic";

const GROUPS: { value: ImportGroup; label: string }[] = [
  { value: "horses", label: "Pardubice koně" },
  { value: "classic-legend", label: "Classic legend" },
];

export default async function AdminRacerImportReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ group?: string }>;
}) {
  const { group: groupParam } = await searchParams;
  const group: ImportGroup = groupParam === "classic-legend" ? "classic-legend" : "horses";

  const items = group === "classic-legend"
    ? await loadClassicLegendImportReviewAction()
    : await loadImportReviewAction();

  const isDev = process.env.NODE_ENV !== "production";

  return (
    <WithAdminAuth>
      <main className="min-h-screen bg-slate-50 px-4 py-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <div>
            <h1 className="text-3xl font-black text-slate-900">Import review — koně</h1>
            <p className="mt-1 text-sm text-slate-500">
              Prohlíž a doplňuj metadata importovaných obrázků koní.
            </p>
          </div>

          {/* Group tabs */}
          <div className="flex gap-2 border-b border-slate-200 pb-1">
            {GROUPS.map((g) => (
              <Link
                key={g.value}
                href={`/admin/racers/import-review?group=${g.value}`}
                className={`rounded-t-lg px-4 py-2 text-sm font-semibold transition-colors ${
                  group === g.value
                    ? "bg-white border border-b-white border-slate-200 text-slate-900 -mb-px"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {g.label}
                <span className="ml-1.5 text-xs opacity-60">
                  ({group === g.value ? items.length : "…"})
                </span>
              </Link>
            ))}
          </div>

          <ImportReviewClient items={items} isDev={isDev} group={group} />
        </div>
      </main>
    </WithAdminAuth>
  );
}
