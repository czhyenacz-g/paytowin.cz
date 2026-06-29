import type { Metadata } from "next";
import { getRacerCatalogSections } from "@/lib/racers/catalog";
import RacersGallery from "@/app/components/racers/RacersGallery";
import MyStableSection from "@/app/components/racers/MyStableSection";

export const metadata: Metadata = {
  title: "Závodníci | StartovníPole.cz",
  description: "Prohlédni si všechny dostupné závodníky — koně, lamy, velbloudy i auta. Každý má jiný charakter, rychlost a příběh.",
};

export const dynamic = "force-dynamic";

export default async function RacersPage() {
  const sections = await getRacerCatalogSections();

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-black text-slate-900">Závodníci</h1>
          <p className="mt-1 text-sm text-slate-500">
            Katalog rozdělený na běžné raceře, legendy a unikátní perma kusy.
          </p>
        </div>
        <div className="mb-8">
          <MyStableSection />
        </div>
        <RacersGallery sections={sections} />
      </div>
    </main>
  );
}
