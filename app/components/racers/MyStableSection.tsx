"use client";

import React from "react";
import { supabase } from "@/lib/supabase";
import { getOwnedPermaRacersAction, getPermaRacerAssetsAction } from "@/app/admin/racers/actions";
import type { PermaRacer } from "@/lib/racers/catalog";
import { PERMA_BADGE_FALLBACK, resolvePermaRacerAssets } from "@/lib/racers/asset-resolver";

function statusLabel(status: string): string {
  if (status === "available") return "dostupný";
  if (status === "resting") return "odpočívá";
  if (status === "exhausted") return "vyčerpaný";
  if (status === "racing" || status === "in_race") return "právě v závodě";
  return status;
}

function StableCard({ racer }: { racer: PermaRacer & { __assets?: Awaited<ReturnType<typeof getPermaRacerAssetsAction>> } }) {
  const resolved = resolvePermaRacerAssets(racer, racer.__assets ?? []);
  return (
    <a href={`/racers/perma/${racer.slug}`} className="block">
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm hover:shadow-md transition">
        <div className="aspect-square bg-slate-100 flex items-center justify-center">
          {resolved.primaryDisplayImage ? (
            <img src={resolved.primaryDisplayImage} alt={racer.name} className="h-full w-full object-cover" />
          ) : (
            <div className="text-5xl select-none">🐴</div>
          )}
        </div>
        <div className="p-3">
          <div className="flex items-center gap-2">
            <div className="text-sm font-bold text-slate-900">{racer.name}</div>
            <img src={PERMA_BADGE_FALLBACK} alt="" className="h-4 w-4 shrink-0" />
          </div>
          <div className="mt-1 text-[11px] text-slate-500">{racer.species_id}</div>
          <div className="mt-1 flex flex-wrap gap-1 text-[10px] font-semibold">
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-700">{racer.rarity}</span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-700">{statusLabel(racer.availability_status)}</span>
          </div>
        </div>
      </div>
    </a>
  );
}

export default function MyStableSection() {
  const [state, setState] = React.useState<"loading" | "unauthenticated" | "loaded">("loading");
  const [userId, setUserId] = React.useState<string | null>(null);
  const [racers, setRacers] = React.useState<Array<PermaRacer & { __assets?: Awaited<ReturnType<typeof getPermaRacerAssetsAction>> }>>([]);

  React.useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      const discordId = user?.user_metadata?.provider_id as string | undefined;
      if (!discordId) {
        setState("unauthenticated");
        return;
      }
      setUserId(discordId);
      const rows = await getOwnedPermaRacersAction(discordId);
      const rowsWithAssets = await Promise.all(
        rows.map(async (row) => ({
          ...row,
          __assets: await getPermaRacerAssetsAction(row.id),
        })),
      );
      setRacers(rowsWithAssets);
      setState("loaded");
    });
  }, []);

  if (state === "loading") {
    return <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-400">Načítám tvoji stáj…</div>;
  }

  if (state === "unauthenticated") {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
        Přihlas se a uvidíš svoji stáj.
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-2xl font-black text-slate-900">Moje stáj</h2>
        <p className="text-sm text-slate-500">
          {userId ? "Tvé permanentní kusy a jejich stav." : "Tvoje vlastněné perma racery."}
        </p>
      </div>

      {racers.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          Ve stáji zatím nemáš žádného permanentního racera.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {racers.map((r) => <StableCard key={r.id} racer={r} />)}
        </div>
      )}
    </section>
  );
}
