import type { Metadata } from "next";
import WithAdminAuth from "@/app/components/WithAdminAuth";
import PermaRacerAdminPanel from "@/app/components/racers/PermaRacerAdminPanel";

export const metadata: Metadata = {
  title: "Perma raceři | Admin",
  description: "Správa permanentních racerů, jejich stavů a assetů.",
};

export const dynamic = "force-dynamic";

export default function AdminPermaRacersPage() {
  return (
    <WithAdminAuth>
      <main className="min-h-screen bg-slate-50 px-4 py-8">
        <div className="mx-auto max-w-5xl space-y-6">
          <div>
            <h1 className="text-3xl font-black text-slate-900">Perma raceři</h1>
            <p className="mt-1 text-sm text-slate-500">Metadata, statusy a asset cesty. Bez plateb a bez runtime zásahů.</p>
          </div>
          <PermaRacerAdminPanel />
        </div>
      </main>
    </WithAdminAuth>
  );
}
