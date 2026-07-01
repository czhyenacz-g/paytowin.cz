"use client";

import React, { useState, useTransition } from "react";
import { type RacerImportReviewItem } from "@/lib/racers/import-review";
import {
  saveImportReviewItemAction,
  exportRacerDraftAction,
  saveClassicLegendReviewItemAction,
  exportClassicLegendDraftAction,
} from "./actions";

export type ImportGroup = "horses" | "classic-legend";

type Category = "race" | "work" | "perma" | "unknown";
type FilterValue = "all" | Category;

const COLOR_OPTIONS = [
  { value: "", label: "—" },
  { value: "bělouš", label: "bělouš" },
  { value: "bělka", label: "bělka" },
  { value: "hnědák", label: "hnědák" },
  { value: "hnědka", label: "hnědka" },
  { value: "tmavá hnědka", label: "tmavá hnědka" },
  { value: "tmavý hnědák", label: "tmavý hnědák" },
  { value: "ryzák", label: "ryzák" },
  { value: "ryzka", label: "ryzka" },
  { value: "ryzák s lysinou", label: "ryzák s lysinou" },
  { value: "vraník", label: "vraník" },
  { value: "strakáč", label: "strakáč" },
  { value: "šedák", label: "šedák" },
  { value: "zlatý", label: "zlatý" },
  { value: "jiný", label: "jiný" },
];

const ROLE_OPTIONS = [
  { value: "", label: "—" },
  { value: "sprinter", label: "sprinter" },
  { value: "vytrvalec", label: "vytrvalec" },
  { value: "univerzál", label: "univerzál" },
  { value: "rychlý ale bez staminy", label: "rychlý ale bez staminy" },
  { value: "pomalejší s vysokou staminou", label: "pomalejší s vysokou staminou" },
  { value: "pracovní tahoun", label: "pracovní tahoun" },
  { value: "perma unikát", label: "perma unikát" },
  { value: "classic_legend", label: "classic_legend" },
];

const RARITY_OPTIONS = [
  { value: "", label: "—" },
  { value: "common", label: "common" },
  { value: "uncommon", label: "uncommon" },
  { value: "rare", label: "rare" },
  { value: "epic", label: "epic" },
  { value: "legendary", label: "legendary" },
  { value: "legendary_classic", label: "legendary_classic" },
  { value: "unique", label: "unique" },
  { value: "premium", label: "premium" },
];

const CATEGORY_COLORS: Record<string, string> = {
  race: "bg-blue-100 text-blue-700",
  work: "bg-amber-100 text-amber-700",
  perma: "bg-purple-100 text-purple-700",
  unknown: "bg-slate-100 text-slate-500",
};

function CategoryBadge({ category }: { category: string }) {
  const cls = CATEGORY_COLORS[category] ?? "bg-slate-100 text-slate-500";
  return (
    <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${cls}`}>
      {category}
    </span>
  );
}

type EditState = Partial<Omit<RacerImportReviewItem, "id" | "sourceFolder" | "sourceFile" | "targetPath" | "suggestedCategory">>;

function buildEditState(item: RacerImportReviewItem): EditState {
  return {
    displayName: item.displayName,
    slug: item.slug,
    confirmedType: item.confirmedType,
    confirmedColor: item.confirmedColor,
    confirmedRole: item.confirmedRole,
    speed: item.speed,
    maxStamina: item.maxStamina,
    price: item.price,
    rarity: item.rarity,
    flavorText: item.flavorText,
    story: item.story,
    notes: item.notes,
  };
}

interface Props {
  items: RacerImportReviewItem[];
  isDev: boolean;
  group: ImportGroup;
}

export default function ImportReviewClient({ items, isDev, group }: Props) {
  const [filter, setFilter] = useState<FilterValue>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editMap, setEditMap] = useState<Record<string, EditState>>(() => {
    const m: Record<string, EditState> = {};
    for (const item of items) m[item.id] = buildEditState(item);
    return m;
  });
  const [saveStatus, setSaveStatus] = useState<Record<string, "idle" | "saving" | "ok" | "error">>({});
  const [saveError, setSaveError] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();
  const [exportStatus, setExportStatus] = useState<"idle" | "exporting" | "ok" | "error">("idle");
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportMsg, setExportMsg] = useState<string | null>(null);
  const [exportValidationErrors, setExportValidationErrors] = useState<string[] | null>(null);

  const isClassicLegend = group === "classic-legend";

  const categories: FilterValue[] = ["all", "race", "work", "perma", "unknown"];

  const counts: Record<FilterValue, number> = {
    all: items.length,
    race: items.filter((i) => i.suggestedCategory === "race").length,
    work: items.filter((i) => i.suggestedCategory === "work").length,
    perma: items.filter((i) => i.suggestedCategory === "perma").length,
    unknown: items.filter((i) => i.suggestedCategory === "unknown").length,
  };

  const filtered = filter === "all" ? items : items.filter((i) => i.suggestedCategory === filter);
  const selectedItem = selectedId ? items.find((i) => i.id === selectedId) ?? null : null;
  const edit = selectedId ? (editMap[selectedId] ?? {}) : {};

  function updateEdit(field: keyof EditState, value: string | number | null) {
    if (!selectedId) return;
    setEditMap((prev) => ({ ...prev, [selectedId]: { ...prev[selectedId], [field]: value } }));
    setSaveStatus((prev) => ({ ...prev, [selectedId]: "idle" }));
  }

  function handleSave() {
    if (!selectedId || !isDev) return;
    setSaveStatus((prev) => ({ ...prev, [selectedId]: "saving" }));
    const updates = editMap[selectedId] ?? {};
    startTransition(async () => {
      const action = isClassicLegend ? saveClassicLegendReviewItemAction : saveImportReviewItemAction;
      const result = await action(selectedId, updates);
      if (result.ok) {
        setSaveStatus((prev) => ({ ...prev, [selectedId!]: "ok" }));
      } else {
        setSaveStatus((prev) => ({ ...prev, [selectedId!]: "error" }));
        setSaveError((prev) => ({ ...prev, [selectedId!]: result.error ?? "Neznámá chyba" }));
      }
    });
  }

  function applyPreset(preset: "sprinter" | "vytrvalec" | "tahoun" | "perma_unique" | "classic_legend") {
    if (!selectedId) return;
    const current = editMap[selectedId] ?? {};
    let updates: Partial<EditState> = {};

    if (preset === "sprinter") {
      updates = { confirmedRole: "sprinter", confirmedType: "race", speed: 9, maxStamina: 4, rarity: current.rarity ?? "common", price: current.price ?? 100, flavorText: current.flavorText ?? "Rychlý start, krátký dech." };
    } else if (preset === "vytrvalec") {
      updates = { confirmedRole: "vytrvalec", confirmedType: "race", speed: 6, maxStamina: 9, rarity: current.rarity ?? "common", price: current.price ?? 120, flavorText: current.flavorText ?? "Nespěchá. On ví, že ostatní časem odpadnou." };
    } else if (preset === "tahoun") {
      updates = { confirmedRole: "pracovní tahoun", confirmedType: "work", speed: 4, maxStamina: 10, rarity: current.rarity ?? "rare", price: current.price ?? 150, flavorText: current.flavorText ?? "Možná není nejrychlejší, ale utáhne i špatný den." };
    } else if (preset === "perma_unique") {
      updates = { confirmedRole: "perma unikát", confirmedType: "perma", rarity: "unique", price: current.price ?? 500, flavorText: current.flavorText ?? "Jeden kus. Jedna stáj. Jedna legenda." };
    } else if (preset === "classic_legend") {
      updates = { confirmedRole: "classic_legend", confirmedType: "horse", rarity: "legendary_classic", poolType: "classic_legend", spawnSource: "historical_stable_card" };
    }

    setEditMap((prev) => ({ ...prev, [selectedId]: { ...prev[selectedId], ...updates } }));
    setSaveStatus((prev) => ({ ...prev, [selectedId]: "idle" }));
  }

  function handleExport() {
    if (!isDev) return;

    if (!isClassicLegend) {
      // Pardubice: client-side validation
      const errors: string[] = [];
      for (const item of items) {
        const e = editMap[item.id] ?? {};
        const missing: string[] = [];
        if (!e.displayName) missing.push("displayName");
        if (!e.slug) missing.push("slug");
        if (missing.length > 0) errors.push(`${item.id}: ${missing.join(", ")}`);
      }
      if (errors.length > 0) {
        setExportValidationErrors(errors);
        setExportStatus("idle");
        return;
      }
    }

    setExportValidationErrors(null);
    setExportStatus("exporting");
    setExportError(null);
    setExportMsg(null);

    startTransition(async () => {
      if (isClassicLegend) {
        const result = await exportClassicLegendDraftAction();
        if (result.ok) {
          setExportStatus("ok");
          setExportMsg(result.count !== undefined ? `Exportováno ${result.count} koní.` : null);
        } else {
          setExportStatus("error");
          setExportError(result.error ?? "Neznámá chyba při exportu.");
        }
      } else {
        const result = await exportRacerDraftAction();
        if (result.ok) {
          setExportStatus("ok");
          if (result.warnings && result.warnings.length > 0) {
            setExportMsg(result.warnings.join("\n"));
          }
        } else {
          setExportStatus("error");
          setExportError(result.error ?? "Neznámá chyba při exportu.");
        }
      }
    });
  }

  const status = selectedId ? (saveStatus[selectedId] ?? "idle") : "idle";

  const draftFile = isClassicLegend ? "horses-classic-legend.draft.json" : "horses.racers-draft.json";
  const reviewFile = isClassicLegend ? "horses-classic-legend.review.json" : "horses.review.json";

  return (
    <div className="space-y-4">
      {/* Banner */}
      {isDev ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <strong>Lokální review mód:</strong> Změny se ukládají do{" "}
          <code className="font-mono">data/racer-imports/{reviewFile}</code>. Používej lokálně a commitni výsledek do gitu.
        </div>
      ) : (
        <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          <strong>Production read-only mode:</strong> Lokální JSON nelze bezpečně editovat na produkci.
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
              filter === cat
                ? "bg-slate-800 text-white"
                : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
            }`}
          >
            {cat === "all" ? "Vše" : cat}{" "}
            <span className="ml-1 opacity-60">{counts[cat]}</span>
          </button>
        ))}
      </div>

      {/* Export section (dev only) */}
      {isDev && (
        <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
          <div className="flex items-center gap-4 flex-wrap">
            <div>
              <h2 className="text-sm font-semibold text-slate-700">Export racer draftu</h2>
              <p className="text-xs text-slate-500">
                Zapíše <code className="font-mono">{draftFile}</code> z aktuálně uloženého review.
                Neuložené změny v editoru se nepřenesou — nejdřív ulož každého koně.
              </p>
            </div>
            <button
              onClick={handleExport}
              disabled={isPending || exportStatus === "exporting"}
              className="shrink-0 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              {exportStatus === "exporting" ? "Exportuji…" : "Exportovat racer draft"}
            </button>
          </div>

          {exportValidationErrors && exportValidationErrors.length > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 space-y-1">
              <p className="font-semibold">Export nelze provést. Chybí povinná pole:</p>
              <ul className="list-disc list-inside text-xs space-y-0.5">
                {exportValidationErrors.map((err) => <li key={err}>{err}</li>)}
              </ul>
            </div>
          )}

          {exportStatus === "ok" && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
              <p className="font-semibold">Draft exportován ✓</p>
              {exportMsg && <p className="mt-1 text-xs whitespace-pre-wrap">{exportMsg}</p>}
            </div>
          )}

          {exportStatus === "error" && exportError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <p className="font-semibold">Chyba při exportu:</p>
              <pre className="mt-1 text-xs whitespace-pre-wrap">{exportError}</pre>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-6">
        {/* Grid */}
        <div className="flex-1 min-w-0">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4">
            {filtered.map((item) => {
              const e = editMap[item.id] ?? {};
              const isSelected = item.id === selectedId;
              return (
                <button
                  key={item.id}
                  onClick={() => setSelectedId(item.id)}
                  className={`group relative flex flex-col overflow-hidden rounded-xl border bg-white text-left shadow-sm transition-all hover:shadow-md ${
                    isSelected
                      ? "border-indigo-500 ring-2 ring-indigo-300"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="aspect-square w-full overflow-hidden bg-slate-100">
                    <img
                      src={item.targetPath}
                      alt={e.displayName ?? item.id}
                      className="h-full w-full object-contain p-1"
                      loading="lazy"
                    />
                  </div>
                  <div className="flex flex-col gap-1 p-2">
                    <div className="flex items-center justify-between gap-1">
                      <span className="truncate text-xs font-mono text-slate-400">{item.id}</span>
                      <CategoryBadge category={item.suggestedCategory} />
                    </div>
                    <div className="text-sm font-semibold text-slate-800 truncate">
                      {e.displayName ?? <span className="text-slate-400">—</span>}
                    </div>
                    <div className="flex flex-wrap gap-1 text-xs text-slate-500">
                      {e.confirmedColor && <span>{e.confirmedColor}</span>}
                      {e.speed != null && <span>spd {e.speed}</span>}
                      {e.maxStamina != null && <span>sta {e.maxStamina}</span>}
                      {e.rarity && (
                        <span className={`rounded px-1 ${e.rarity === "legendary_classic" ? "bg-amber-50 text-amber-700" : "bg-indigo-50 text-indigo-600"}`}>
                          {e.rarity}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Edit panel */}
        {selectedItem && (
          <div className="w-80 shrink-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-4 sticky top-4 self-start max-h-[calc(100vh-6rem)] overflow-y-auto">
            <div className="aspect-square w-full overflow-hidden rounded-lg bg-slate-100">
              <img
                src={selectedItem.targetPath}
                alt={edit.displayName ?? selectedItem.id}
                className="h-full w-full object-contain p-2"
              />
            </div>

            <div className="space-y-1 text-xs text-slate-500 font-mono bg-slate-50 rounded-lg p-3">
              <div><span className="text-slate-400">id: </span>{selectedItem.id}</div>
              <div className="truncate"><span className="text-slate-400">target: </span>{selectedItem.targetPath}</div>
              <div><span className="text-slate-400">folder: </span>{selectedItem.sourceFolder}</div>
              <div><span className="text-slate-400">suggested: </span>
                <CategoryBadge category={selectedItem.suggestedCategory} />
              </div>
              {selectedItem.poolType && (
                <div><span className="text-slate-400">poolType: </span>{selectedItem.poolType}</div>
              )}
            </div>

            {/* Quick presets */}
            {isDev && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Rychlé presety</p>
                <div className="grid grid-cols-2 gap-2">
                  {!isClassicLegend && (
                    <>
                      <button onClick={() => applyPreset("sprinter")} className="rounded-lg border border-blue-200 bg-blue-50 px-2 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition-colors text-left">
                        ⚡ Sprinter
                      </button>
                      <button onClick={() => applyPreset("vytrvalec")} className="rounded-lg border border-green-200 bg-green-50 px-2 py-1.5 text-xs font-semibold text-green-700 hover:bg-green-100 transition-colors text-left">
                        🏃 Vytrvalec
                      </button>
                      <button onClick={() => applyPreset("tahoun")} className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100 transition-colors text-left">
                        🐎 Tahoun
                      </button>
                      <button onClick={() => applyPreset("perma_unique")} className="rounded-lg border border-purple-200 bg-purple-50 px-2 py-1.5 text-xs font-semibold text-purple-700 hover:bg-purple-100 transition-colors text-left">
                        ✦ Perma unique
                      </button>
                    </>
                  )}
                  {isClassicLegend && (
                    <button onClick={() => applyPreset("classic_legend")} className="col-span-2 rounded-lg border border-amber-300 bg-amber-50 px-2 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100 transition-colors text-left">
                      ★ Classic legend (nastaví rarity + poolType)
                    </button>
                  )}
                </div>
                <p className="text-xs text-slate-400">Preset upraví formulář, ale neuloží automaticky.</p>
              </div>
            )}

            {/* Editable fields */}
            <div className="space-y-3">
              <Field label="Jméno (displayName)">
                <input type="text" value={edit.displayName ?? ""} onChange={(e) => updateEdit("displayName", e.target.value || null)} disabled={!isDev} className="input-field" placeholder="např. Fantôme" />
              </Field>
              <Field label="Slug">
                <input type="text" value={edit.slug ?? ""} onChange={(e) => updateEdit("slug", e.target.value || null)} disabled={!isDev} className="input-field" placeholder="např. fantome" />
              </Field>
              <Field label="Typ (confirmedType)">
                <input type="text" value={edit.confirmedType ?? ""} onChange={(e) => updateEdit("confirmedType", e.target.value || null)} disabled={!isDev} className="input-field" placeholder="např. horse" />
              </Field>
              <Field label="Barva (confirmedColor)">
                <select value={edit.confirmedColor ?? ""} onChange={(e) => updateEdit("confirmedColor", e.target.value || null)} disabled={!isDev} className="input-field">
                  {COLOR_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </Field>
              <Field label="Role (confirmedRole)">
                <select value={edit.confirmedRole ?? ""} onChange={(e) => updateEdit("confirmedRole", e.target.value || null)} disabled={!isDev} className="input-field">
                  {ROLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </Field>
              {isClassicLegend && (
                <>
                  <Field label="Pool type (poolType)">
                    <select value={edit.poolType ?? ""} onChange={(e) => updateEdit("poolType", e.target.value || null)} disabled={!isDev} className="input-field">
                      <option value="">—</option>
                      <option value="classic_legend">classic_legend</option>
                    </select>
                  </Field>
                  <Field label="Spawn source (spawnSource)">
                    <select value={edit.spawnSource ?? ""} onChange={(e) => updateEdit("spawnSource", e.target.value || null)} disabled={!isDev} className="input-field">
                      <option value="">—</option>
                      <option value="historical_stable_card">historical_stable_card</option>
                    </select>
                  </Field>
                </>
              )}
              <Field label="Rychlost (speed)">
                <input type="number" value={edit.speed ?? ""} onChange={(e) => updateEdit("speed", e.target.value === "" ? null : Number(e.target.value))} disabled={!isDev} className="input-field" placeholder="—" />
              </Field>
              <Field label="Max stamina (maxStamina)">
                <input type="number" value={edit.maxStamina ?? ""} onChange={(e) => updateEdit("maxStamina", e.target.value === "" ? null : Number(e.target.value))} disabled={!isDev} className="input-field" placeholder="—" />
              </Field>
              <Field label="Cena (price)">
                <input type="number" value={edit.price ?? ""} onChange={(e) => updateEdit("price", e.target.value === "" ? null : Number(e.target.value))} disabled={!isDev} className="input-field" placeholder="—" />
              </Field>
              <Field label="Raritu (rarity)">
                <select value={edit.rarity ?? ""} onChange={(e) => updateEdit("rarity", e.target.value || null)} disabled={!isDev} className="input-field">
                  {RARITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </Field>
              <Field label="Flavor text (veřejný text na kartě)">
                <textarea value={edit.flavorText ?? ""} onChange={(e) => updateEdit("flavorText", e.target.value || null)} disabled={!isDev} className="input-field resize-none" rows={2} placeholder="Krátký veřejný text..." />
              </Field>
              <Field label="Příběh / lore (story)">
                <textarea value={edit.story ?? ""} onChange={(e) => updateEdit("story", e.target.value || null)} disabled={!isDev} className="input-field resize-none" rows={4} placeholder="Delší lore nebo příběh koně..." />
              </Field>
              <Field label="Interní poznámka (nezobrazovat hráčům)">
                <textarea value={edit.notes ?? ""} onChange={(e) => updateEdit("notes", e.target.value || null)} disabled={!isDev} className="input-field resize-none" rows={2} placeholder="Poznámka pro interní použití..." />
              </Field>
            </div>

            {isDev && (
              <div className="space-y-1">
                <button
                  onClick={handleSave}
                  disabled={isPending || status === "saving"}
                  className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {status === "saving" ? "Ukládám…" : "Uložit změny"}
                </button>
                {status === "ok" && <p className="text-center text-xs text-green-600 font-medium">Uloženo ✓</p>}
                {status === "error" && <p className="text-center text-xs text-red-600">{saveError[selectedId!] ?? "Chyba při ukládání"}</p>}
              </div>
            )}

            {!isDev && <p className="text-center text-xs text-slate-400">Read-only v produkci</p>}
          </div>
        )}
      </div>

      <style jsx>{`
        .input-field {
          width: 100%;
          border-radius: 0.5rem;
          border: 1px solid #e2e8f0;
          background: white;
          padding: 0.375rem 0.5rem;
          font-size: 0.875rem;
          color: #1e293b;
          outline: none;
        }
        .input-field:focus {
          border-color: #6366f1;
          box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2);
        }
        .input-field:disabled {
          background: #f8fafc;
          color: #94a3b8;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium text-slate-600">{label}</label>
      {children}
    </div>
  );
}
