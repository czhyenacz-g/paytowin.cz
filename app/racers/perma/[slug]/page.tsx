import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPermaRacerBySlug } from "@/lib/racers/catalog";
import { getPermaRacerAssetsAction } from "@/app/admin/racers/actions";
import { PERMA_BADGE_FALLBACK, resolvePermaRacerAssets } from "@/lib/racers/asset-resolver";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const racer = await getPermaRacerBySlug(slug);
  if (!racer) return { title: "Perma racer | StartovníPole.cz" };
  return {
    title: `${racer.name} | Perma racer`,
    description: racer.description ?? `Unikátní permanentní racer ${racer.name}.`,
  };
}

export default async function PermaRacerPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const racer = await getPermaRacerBySlug(slug);
  if (!racer) notFound();
  const assets = await getPermaRacerAssetsAction(racer.id);
  const resolved = resolvePermaRacerAssets(racer, assets);
  const availabilityLabel =
    racer.availability_status === "available" ? "dostupný" :
    racer.availability_status === "resting" ? "odpočívá" :
    racer.availability_status === "exhausted" ? "vyčerpaný" :
    racer.availability_status === "racing" || racer.availability_status === "reserved"
      ? "právě v závodě"
      : racer.availability_status;

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-4xl px-4 py-10">
        <a href="/racers" className="text-sm text-slate-500 underline">← Zpět na katalog</a>
        <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
            <div className="aspect-square bg-slate-100 flex items-center justify-center">
              <img src={resolved.primaryDisplayImage} alt={racer.name} className="h-full w-full object-cover" />
            </div>
          </div>
          <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
            <div>
              <div className="text-xs font-semibold uppercase tracking-widest text-slate-400">{racer.rarity}</div>
              <h1 className="text-3xl font-black text-slate-900">{racer.name}</h1>
              <p className="mt-1 text-sm text-slate-500">{racer.description ?? "Bez popisu."}</p>
            </div>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-slate-400">Slug</dt><dd className="font-medium">{racer.slug}</dd></div>
              <div><dt className="text-slate-400">Status</dt><dd className="font-medium">{racer.status}</dd></div>
              <div><dt className="text-slate-400">Prodej</dt><dd className="font-medium">{racer.sale_status}</dd></div>
              <div><dt className="text-slate-400">Vlastník</dt><dd className="font-medium">{racer.owner_user_id ?? "—"}</dd></div>
              <div><dt className="text-slate-400">Dostupnost</dt><dd className="font-medium">{availabilityLabel}</dd></div>
              <div><dt className="text-slate-400">Species</dt><dd className="font-medium">{racer.species_id}</dd></div>
            </dl>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs font-semibold uppercase tracking-widest text-slate-400">Front</div>
                <div className="mt-2 aspect-square rounded-lg bg-white flex items-center justify-center overflow-hidden">
                  <img src={resolved.frontImage ?? resolved.primaryDisplayImage} alt={`${racer.name} front`} className="h-full w-full object-cover" />
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs font-semibold uppercase tracking-widest text-slate-400">Side / animace</div>
                <div className="mt-2 aspect-square rounded-lg bg-white flex items-center justify-center overflow-hidden">
                  <img src={resolved.secondaryDisplayImage} alt={`${racer.name} side`} className="h-full w-full object-cover" />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs font-semibold uppercase tracking-widest text-slate-400">Token</div>
                <div className="mt-2 aspect-square rounded-lg bg-white flex items-center justify-center overflow-hidden">
                  <img src={resolved.tokenImage ?? resolved.primaryDisplayImage} alt={`${racer.name} token`} className="h-full w-full object-cover" />
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs font-semibold uppercase tracking-widest text-slate-400">Badge</div>
                <div className="mt-2 aspect-square rounded-lg bg-white flex items-center justify-center overflow-hidden">
                  <img src={resolved.badgeIcon ?? PERMA_BADGE_FALLBACK} alt={`${racer.name} badge`} className="h-full w-full object-cover" />
                </div>
              </div>
            </div>
            <button type="button" className="rounded-xl bg-amber-500 px-4 py-3 text-sm font-bold text-white opacity-70">
              Koupě bude doplněna později
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
