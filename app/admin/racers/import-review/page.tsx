import type { Metadata } from "next";
import WithAdminAuth from "@/app/components/WithAdminAuth";
import { loadImportReviewAction } from "./actions";
import ImportReviewClient from "./ImportReviewClient";

export const metadata: Metadata = {
  title: "Import review — koně | Admin",
  description: "Review a editace importovaných obrázků racerů.",
};

export const dynamic = "force-dynamic";

export default async function AdminRacerImportReviewPage() {
  const items = await loadImportReviewAction();
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
          <ImportReviewClient items={items} isDev={isDev} />
        </div>
      </main>
    </WithAdminAuth>
  );
}
