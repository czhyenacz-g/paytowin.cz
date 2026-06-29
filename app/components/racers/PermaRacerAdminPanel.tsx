"use client";

import React from "react";
import { supabase } from "@/lib/supabase";
import {
  listAllPermaRacersAction,
  updatePermaRacerDetailsAction,
  upsertPermaRacerAssetAction,
  adminAssignPermaRacerToUser,
  adminReservePermaRacerForUser,
} from "@/app/admin/racers/actions";
import type { PermaRacer } from "@/lib/racers/catalog";
import { resolvePermaRacerAssets, PERMA_BADGE_FALLBACK } from "@/lib/racers/asset-resolver";

type AssetKey = "front_image" | "side_image" | "idle_animation" | "token_image" | "badge_icon";

const ASSET_KEYS: AssetKey[] = ["front_image", "side_image", "idle_animation", "token_image", "badge_icon"];

export default function PermaRacerAdminPanel() {
  const [racers, setRacers] = React.useState<PermaRacer[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [status, setStatus] = React.useState<string | null>(null);
  const [adminDiscordId, setAdminDiscordId] = React.useState<string | null>(null);

  React.useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      const discordId = user?.user_metadata?.provider_id as string | undefined;
      setAdminDiscordId(discordId ?? null);
      const rows = await listAllPermaRacersAction();
      setRacers(rows);
      setLoading(false);
    });
  }, []);

  async function save(racer: PermaRacer, formData: FormData) {
    setStatus(null);
    const updateResult = await updatePermaRacerDetailsAction(racer.id, {
      name: String(formData.get("name") ?? ""),
      slug: String(formData.get("slug") ?? ""),
      rarity: String(formData.get("rarity") ?? ""),
      status: String(formData.get("status") ?? racer.status) as PermaRacer["status"],
      sale_status: String(formData.get("sale_status") ?? racer.sale_status) as PermaRacer["sale_status"],
      owner_user_id: String(formData.get("owner_user_id") ?? "").trim() || null,
      description: String(formData.get("description") ?? "").trim() || null,
      availability_status: String(formData.get("availability_status") ?? racer.availability_status) as PermaRacer["availability_status"],
    });
    if (!updateResult.ok) {
      setStatus(updateResult.error);
      return;
    }
    const updatedRacer = "racer" in updateResult ? updateResult.racer : racer;

    for (const assetKey of ASSET_KEYS) {
      const value = String(formData.get(assetKey) ?? "").trim();
      if (!value) continue;
      const assetResult = await upsertPermaRacerAssetAction(racer.id, assetKey, value);
      if (!assetResult.ok) {
        setStatus(assetResult.error);
        return;
      }
    }

    setRacers((prev) => prev.map((row) => row.id === racer.id ? updatedRacer : row));
    setStatus("Uloženo.");
  }

  async function assignToUser(racer: PermaRacer, userId: string) {
    if (!userId.trim()) {
      setStatus("Chybí user_id.");
      return;
    }
    const result = await adminAssignPermaRacerToUser(racer.id, userId.trim());
    if (!result.ok) {
      setStatus(result.error);
      return;
    }
    const updatedRacer = "racer" in result ? result.racer : racer;
    setRacers((prev) => prev.map((row) => row.id === racer.id ? updatedRacer : row));
    setStatus(`Přiřazeno uživateli ${userId.trim()}.`);
  }

  async function reserveForUser(racer: PermaRacer, userId: string) {
    if (!userId.trim()) {
      setStatus("Chybí user_id.");
      return;
    }
    const result = await adminReservePermaRacerForUser(racer.id, userId.trim());
    if (!result.ok) {
      setStatus(result.error);
      return;
    }
    const updatedRacer = "racer" in result ? result.racer : racer;
    setRacers((prev) => prev.map((row) => row.id === racer.id ? updatedRacer : row));
    setStatus(`Rezervováno pro ${userId.trim()}.`);
  }

  if (loading) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Načítám perma raceře…</div>;
  }

  return (
    <div className="space-y-4">
      {status && <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-600">{status}</div>}
      {racers.map((racer) => (
        <form
          key={racer.id}
          className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            save(racer, new FormData(e.currentTarget));
          }}
          >
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-bold text-slate-900">{racer.name}</div>
              <div className="text-xs text-slate-500">{racer.slug}</div>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-800">PERMA</span>
              <img src={PERMA_BADGE_FALLBACK} alt="" className="h-4 w-4 shrink-0" />
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 space-y-1">
            <div className="font-semibold text-slate-700">Ruční prodej / přiřazení</div>
            <div>Platba se řeší ručně mimo aplikaci. Po potvrzení platby přiřaď racera uživateli do stáje.</div>
            {racer.owner_user_id && (
              <div className="font-medium text-slate-700">
                {racer.sale_status === "sold" ? "Prodáno" : "Rezervováno"} · owner_user_id: <span className="font-mono">{racer.owner_user_id}</span>
              </div>
            )}
            {racer.sale_status === "sold" && (
              <div className="text-amber-700 font-semibold">Tento racer už má vlastníka.</div>
            )}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <input name="name" defaultValue={racer.name} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input name="slug" defaultValue={racer.slug} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input name="rarity" defaultValue={racer.rarity} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input name="owner_user_id" defaultValue={racer.owner_user_id ?? ""} placeholder="owner_user_id" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input name="status" defaultValue={racer.status} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input name="sale_status" defaultValue={racer.sale_status} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input name="availability_status" defaultValue={racer.availability_status} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <textarea name="description" defaultValue={racer.description ?? ""} className="rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-2" rows={3} />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {ASSET_KEYS.map((assetKey) => (
              <input key={assetKey} name={assetKey} defaultValue="" placeholder={`${assetKey} URL/path`} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            ))}
          </div>

          <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
            <input name="manual_user_id" placeholder="user_id" className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono" />
            <button
              type="button"
              onClick={async (e) => {
                const form = e.currentTarget.closest("form");
                const userId = String(new FormData(form ?? undefined).get("manual_user_id") ?? "");
                await assignToUser(racer, userId);
              }}
              disabled={racer.sale_status === "sold"}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Přiřadit do stáje
            </button>
            <button
              type="button"
              onClick={async (e) => {
                const form = e.currentTarget.closest("form");
                const userId = String(new FormData(form ?? undefined).get("manual_user_id") ?? "");
                await reserveForUser(racer, userId);
              }}
              disabled={racer.sale_status === "sold"}
              className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Rezervovat pro uživatele
            </button>
          </div>

          <button type="submit" className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Uložit</button>
        </form>
      ))}
    </div>
  );
}
