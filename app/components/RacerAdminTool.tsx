"use client";

/**
 * RacerAdminTool — globální správa závodníků z Racer Registry.
 *
 * Dostupné na /admin/themes/dev/[themeId]/racers.
 * Theme Builder sem odkazuje z "Editovat závodníky →" tlačítka.
 *
 * Source of truth: tabulka `racers` v Supabase (globální Racer Registry).
 * Per-theme ThemeManifest.racers je dočasný fallback pro runtime (buildFields).
 * Tento tool s ním už nepracuje.
 *
 * themeId slouží jen pro navigaci (back link) a odvození výchozího type ('horse' / 'car').
 */

import React from "react";
import type { RacerConfig } from "@/lib/themes";
import { profileToConfig, configToProfile } from "@/lib/racers/adapters";
import {
  RACER_TYPE_LABELS,
  RACER_TYPE_ORDER,
} from "@/lib/racers/types";
import type { RacerType } from "@/lib/racers/types";
import {
  listRacersAction,
  upsertRacerAction,
  deleteRacerAction,
  seedBuiltinRacersAction,
  resetBuiltinRacersAction,
} from "@/app/admin/racers/actions";
import RacerRosterPanel from "./editor/RacerRosterPanel";

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  /** Používá se jen pro back-link a odvození výchozího type. Data se načítají z registry. */
  themeId: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function withSlotIndexes(racers: RacerConfig[]): RacerConfig[] {
  return racers.map((r, i) => (r.slotIndex !== undefined ? r : { ...r, slotIndex: i }));
}

/** Odvodí racer type z ID theme — pro defaulting nových závodníků. */
function inferTypeFromTheme(themeId: string): string {
  if (themeId.startsWith("car")) return "car";
  return "horse";
}

const VALID_ID_RE = /^[a-z0-9][a-z0-9_-]*$/;

function validateRacers(racers: RacerConfig[]): string[] {
  const errors: string[] = [];
  const seenIds = new Set<string>();

  for (let i = 0; i < racers.length; i++) {
    const r   = racers[i];
    const lbl = `Závodník ${i + 1}${r.name ? ` („${r.name}")` : ""}`;

    if (!r.id || !VALID_ID_RE.test(r.id)) {
      errors.push(`${lbl}: neplatné ID "${r.id}" — jen a-z 0-9 _ -, začít písmenem/číslicí`);
    } else if (seenIds.has(r.id)) {
      errors.push(`${lbl}: duplicitní ID "${r.id}"`);
    } else {
      seenIds.add(r.id);
    }
    if (!r.name?.trim())  errors.push(`${lbl}: prázdné jméno`);
    if (!Number.isInteger(r.speed) || r.speed < 1 || r.speed > 10)
      errors.push(`${lbl}: speed musí být 1–10 (je ${r.speed})`);
    if (r.price < 0)
      errors.push(`${lbl}: cena nesmí být záporná (je ${r.price})`);
    if (r.maxStamina !== undefined && (r.maxStamina < 0 || r.maxStamina > 100))
      errors.push(`${lbl}: max stamina musí být 0–100 (je ${r.maxStamina})`);
  }

  return errors;
}

// ─── Komponenta ───────────────────────────────────────────────────────────────

export default function RacerAdminTool({ themeId }: Props) {
  const [racers, setRacers]           = React.useState<RacerConfig[]>([]);
  const [deletedIds, setDeletedIds]   = React.useState<Set<string>>(new Set());
  const [loading, setLoading]         = React.useState(true);
  const [error, setError]             = React.useState<string | null>(null);
  const [saving, setSaving]           = React.useState(false);
  const [seeding, setSeeding]         = React.useState(false);
  const [notif, setNotif]             = React.useState<{ ok: boolean; msg: React.ReactNode } | null>(null);
  const [filterType, setFilterType]   = React.useState<RacerType | "all">("all");

  const racerType = inferTypeFromTheme(themeId);

  // ── Load z globální registry ───────────────────────────────────────────────

  async function loadRegistry() {
    setLoading(true);
    setError(null);
    const profiles = await listRacersAction();
    if (profiles === null) {
      setError("Chyba při načítání z Racer Registry.");
    } else {
      // V dev módu: zachovej isBuiltIn flag pro editaci (toggle je v RacerEditorPanel)
      setRacers(withSlotIndexes(profiles.map(profileToConfig)));
      setDeletedIds(new Set());
    }
    setLoading(false);
  }

  React.useEffect(() => { loadRegistry(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Detekce smazaných závodníků (diff) ────────────────────────────────────

  function handleRacersChange(updated: RacerConfig[]) {
    const updatedIds = new Set(updated.map((r) => r.id));
    const removedIds = racers.filter((r) => !updatedIds.has(r.id)).map((r) => r.id);
    if (removedIds.length > 0) {
      setDeletedIds((prev) => {
        const next = new Set(prev);
        removedIds.forEach((id) => next.add(id));
        return next;
      });
    }
    setRacers(updated);
  }

  // ── Save do registry ───────────────────────────────────────────────────────

  async function handleSave() {
    const errors = validateRacers(racers);
    if (errors.length > 0) {
      setNotif({
        ok:  false,
        msg: (
          <span>
            Nelze uložit — oprav {errors.length === 1 ? "tuto chybu" : `${errors.length} chyby`}:
            <ul className="mt-1 list-disc list-inside space-y-0.5 text-xs">
              {errors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          </span>
        ),
      });
      setTimeout(() => setNotif(null), 10_000);
      return;
    }

    setSaving(true);
    const deleteErrors: string[] = [];
    const upsertErrors: string[] = [];

    // 1. Smazat odstraněné závodníky z registry
    for (const id of deletedIds) {
      const res = await deleteRacerAction(id);
      if (!res.ok) deleteErrors.push(`${id}: ${res.error}`);
    }

    // 2. Upsert všech závodníků v lokálním stavu
    for (const config of racers) {
      const profile = configToProfile(config, { type: racerType });
      const res = await upsertRacerAction(profile);
      if (!res.ok) upsertErrors.push(`${config.id}: ${res.error}`);
    }

    setSaving(false);
    const allErrors = [...deleteErrors, ...upsertErrors];

    if (allErrors.length === 0) {
      setDeletedIds(new Set()); // reset po úspěšném save
      setNotif({ ok: true, msg: `Uloženo do Racer Registry — ${racers.length} závodník${racers.length === 1 ? "" : "ů"}.` });
    } else {
      setNotif({
        ok:  false,
        msg: (
          <span>
            Část operací selhala:
            <ul className="mt-1 list-disc list-inside space-y-0.5 text-xs">
              {allErrors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          </span>
        ),
      });
    }
    setTimeout(() => setNotif(null), 6_000);
  }

  // ── Seed built-in závodníků do prázdné registry ────────────────────────────

  async function handleSeed() {
    setSeeding(true);
    const result = await seedBuiltinRacersAction();
    setSeeding(false);
    if (result.errors.length === 0) {
      setNotif({ ok: true, msg: `Seedováno ${result.inserted} built-in závodníků.` });
      await loadRegistry();
    } else {
      setNotif({
        ok:  false,
        msg: `Seedováno ${result.inserted}, ${result.errors.length} chyb: ${result.errors.map((e) => e.id).join(", ")}`,
      });
    }
    setTimeout(() => setNotif(null), 6_000);
  }

  // ── Reset built-in závodníků ───────────────────────────────────────────────

  async function handleReset() {
    if (!window.confirm(
      "Smazat všechny built-in závodníky z registry a seedovat znovu ze zdrojových souborů?\n\n" +
      "User-created závodníci (is_builtin=false) zůstanou nedotčeni."
    )) return;
    setSeeding(true);
    const result = await resetBuiltinRacersAction();
    setSeeding(false);
    setNotif({
      ok:  result.errors.length === 0,
      msg: `Reset: smazáno ${result.deleted}, seedováno ${result.inserted}${result.errors.length > 0 ? `, ${result.errors.length} chyb` : ""}.`,
    });
    await loadRegistry();
    setTimeout(() => setNotif(null), 6_000);
  }

  // ── Loading / error states ─────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-sm text-slate-500">Načítám Racer Registry…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md space-y-3 text-center">
          <div className="text-4xl">⚠️</div>
          <div className="font-semibold text-red-700">Chyba načítání Racer Registry</div>
          <div className="text-sm text-slate-600">{error}</div>
          <a href={`/admin/themes/dev?openTheme=${encodeURIComponent(themeId)}`}
            className="text-xs text-indigo-600 hover:underline">
            ← Zpět do Theme Builderu
          </a>
        </div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const isEmpty = racers.length === 0 && deletedIds.size === 0;

  return (
    <div className="min-h-screen bg-slate-50">

      {/* Top bar */}
      <div className="border-b border-slate-200 bg-white px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <a href={`/admin/themes/dev?openTheme=${encodeURIComponent(themeId)}`}
            className="text-xs text-slate-400 hover:text-slate-600 transition-colors">
            ← Theme Builder
          </a>
          <span className="text-slate-300">·</span>
          <span className="font-semibold text-slate-800">Racer Admin</span>
          <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
            globální registry
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Dev: reset built-in tlačítko */}
          {process.env.NODE_ENV !== "production" && (
            <button
              onClick={handleReset}
              disabled={seeding || saving}
              title="Smazat built-in závodníky z registry a seedovat znovu"
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-500 hover:border-amber-300 hover:text-amber-700 disabled:opacity-40 transition-colors"
            >
              {seeding ? "Resetuji…" : "↺ Reset built-in"}
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving || seeding}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-40 transition-colors"
          >
            {saving ? "Ukládám…" : "💾 Uložit do Registry"}
          </button>
        </div>
      </div>

      {/* Notification */}
      {notif && (
        <div className={`mx-5 mt-4 rounded-xl border px-4 py-3 text-sm flex items-start justify-between gap-3 ${
          notif.ok
            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
            : "border-red-200 bg-red-50 text-red-800"
        }`}>
          <span>{notif.msg}</span>
          <button onClick={() => setNotif(null)} className="shrink-0 text-xs opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Content */}
      <div className="p-5 max-w-2xl space-y-3">

        {/* Info řádek */}
        <div className="text-xs text-slate-400">
          Racer Registry ·{" "}
          {racers.length} závodník{racers.length === 1 ? "" : "ů"}
          {deletedIds.size > 0 && (
            <span className="text-amber-500"> · {deletedIds.size} čeká na smazání</span>
          )}
        </div>

        {/* Filter podle skupiny */}
        {!isEmpty && (
          <div className="flex flex-wrap gap-1.5">
            {(["all", ...RACER_TYPE_ORDER] as const).map((t) => {
              const count = t === "all"
                ? racers.length
                : racers.filter((r) => (r.racerType ?? "unset") === t).length;
              if (t !== "all" && count === 0) return null;
              return (
                <button
                  key={t}
                  onClick={() => setFilterType(t)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    filterType === t
                      ? "bg-indigo-600 text-white"
                      : "border border-slate-200 text-slate-500 hover:border-indigo-300 hover:text-indigo-600"
                  }`}
                >
                  {t === "all" ? "Vše" : RACER_TYPE_LABELS[t]}
                  <span className="ml-1.5 opacity-60">{count}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Prázdná registry — nabídni seed */}
        {isEmpty && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-8 text-center space-y-3">
            <div className="text-2xl">📭</div>
            <div className="text-sm font-medium text-slate-700">Racer Registry je prázdná</div>
            <div className="text-xs text-slate-400">
              Chceš naplnit registy built-in závodníky ze zdrojových theme souborů?
            </div>
            <button
              onClick={handleSeed}
              disabled={seeding}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-40 transition-colors"
            >
              {seeding ? "Seeduji…" : "🌱 Seedovat built-in závodníky"}
            </button>
          </div>
        )}

        {/* Katalog — seskupený podle skupiny nebo filtrovaný */}
        {!isEmpty && RACER_TYPE_ORDER.map((groupType) => {
          if (filterType !== "all" && filterType !== groupType) return null;
          const groupRacers = racers.filter((r) => (r.racerType ?? "unset") === groupType);
          if (groupRacers.length === 0) return null;
          return (
            <div key={groupType} className="space-y-1">
              {/* Skupinová hlavička — jen ve výpisu "vše" */}
              {filterType === "all" && (
                <div className="px-1 pt-1 pb-0.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                  {RACER_TYPE_LABELS[groupType]}
                  <span className="ml-2 font-normal normal-case text-slate-300">{groupRacers.length}</span>
                </div>
              )}
              <RacerRosterPanel
                racers={groupRacers}
                onChange={(updated) =>
                  handleRacersChange([
                    ...racers.filter((r) => (r.racerType ?? "unset") !== groupType),
                    ...updated,
                  ])
                }
                isBuiltInTheme={false}
              />
            </div>
          );
        })}

      </div>
    </div>
  );
}
