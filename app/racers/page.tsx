import type { Metadata } from "next";
import { listRacersAction } from "@/app/admin/racers/actions";
import { racerProfilesToConfigs } from "@/lib/racers/builtInRacers";
import RacersGallery from "@/app/components/racers/RacersGallery";

export const metadata: Metadata = {
  title: "Závodníci | StartovníPole.cz",
  description: "Prohlédni si všechny dostupné závodníky — koně, lamy, velbloudy i auta. Každý má jiný charakter, rychlost a příběh.",
};

export const dynamic = "force-dynamic";

export default async function RacersPage() {
  const profiles = await listRacersAction({ isBuiltin: true, isPublic: true });
  const racers = racerProfilesToConfigs(profiles);

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-black text-slate-900">Závodníci</h1>
          <p className="mt-1 text-sm text-slate-500">
            {racers.length} dostupných závodníků — vyber si svého favorita
          </p>
        </div>
        <RacersGallery racers={racers} />
      </div>
    </main>
  );
}
