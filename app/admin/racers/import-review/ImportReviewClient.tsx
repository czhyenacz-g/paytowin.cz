"use client";

import React, { useState, useTransition } from "react";
import { type RacerImportReviewItem } from "@/lib/racers/import-review";
import { saveImportReviewItemAction } from "./actions";

type Category = "race" | "work" | "perma" | "unknown";
type FilterValue = "all" | Category;

const COLOR_OPTIONS = [
  { value: "", label: "—" },
  { value: "bělouš", label: "bělouš" },
  { value: "hnědák", label: "hnědák" },
  { value: "ryzák", label: "ryzák" },
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
];

const RARITY_OPTIONS = [
  { value: "", label: "—" },
  { value: "common", label: "common" },
  { value: "rare", label: "rare" },
  { value: "epic", label: "epic" },
  { value: "legendary", label: "legendary" },
  { value: "unique", label: "unique" },
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
}

export default function ImportReviewClient({ items, isDev }: Props) {
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
    setEditMap((prev) => ({
      ...prev,
      [selectedId]: { ...prev[selectedId], [field]: value },
    }));
    // Reset save status on change
    setSaveStatus((prev) => ({ ...prev, [selectedId]: "idle" }));
  }

  function handleSave() {
    if (!selectedId || !isDev) return;
    setSaveStatus((prev) => ({ ...prev, [selectedId]: "saving" }));
    const updates = editMap[selectedId] ?? {};
    startTransition(async () => {
      const result = await saveImportReviewItemAction(selectedId, updates);
      if (result.ok) {
        setSaveStatus((prev) => ({ ...prev, [selectedId!]: "ok" }));
      } else {
        setSaveStatus((prev) => ({ ...prev, [selectedId!]: "error" }));
        setSaveError((prev) => ({ ...prev, [selectedId!]: result.error ?? "Neznámá chyba" }));
      }
    });
  }

  const status = selectedId ? (saveStatus[selectedId] ?? "idle") : "idle";

  return (
    <div className="space-y-4">
      {/* Banner */}
      {isDev ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <strong>Lokální review mód:</strong> Změny se ukládají do{" "}
          <code className="font-mono">data/racer-imports/horses.review.json</code>. Používej lokálně a commitni výsledek do gitu.
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
                  {/* Image */}
                  <div className="aspect-square w-full overflow-hidden bg-slate-100">
                    <img
                      src={item.targetPath}
                      alt={e.displayName ?? item.id}
                      className="h-full w-full object-contain p-1"
                      loading="lazy"
                    />
                  </div>

                  {/* Info */}
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
                        <span className="rounded bg-indigo-50 px-1 text-indigo-600">
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
            {/* Header image */}
            <div className="aspect-square w-full overflow-hidden rounded-lg bg-slate-100">
              <img
                src={selectedItem.targetPath}
                alt={edit.displayName ?? selectedItem.id}
                className="h-full w-full object-contain p-2"
              />
            </div>

            {/* Read-only meta */}
            <div className="space-y-1 text-xs text-slate-500 font-mono bg-slate-50 rounded-lg p-3">
              <div><span className="text-slate-400">id: </span>{selectedItem.id}</div>
              <div className="truncate"><span className="text-slate-400">target: </span>{selectedItem.targetPath}</div>
              <div><span className="text-slate-400">folder: </span>{selectedItem.sourceFolder}</div>
              <div><span className="text-slate-400">suggested: </span>
                <CategoryBadge category={selectedItem.suggestedCategory} />
              </div>
            </div>

            {/* Editable fields */}
            <div className="space-y-3">
              <Field label="Jméno (displayName)">
                <input
                  type="text"
                  value={edit.displayName ?? ""}
                  onChange={(e) => updateEdit("displayName", e.target.value || null)}
                  disabled={!isDev}
                  className="input-field"
                  placeholder="např. Blesk"
                />
              </Field>

              <Field label="Slug">
                <input
                  type="text"
                  value={edit.slug ?? ""}
                  onChange={(e) => updateEdit("slug", e.target.value || null)}
                  disabled={!isDev}
                  className="input-field"
                  placeholder="např. blesk"
                />
              </Field>

              <Field label="Typ (confirmedType)">
                <input
                  type="text"
                  value={edit.confirmedType ?? ""}
                  onChange={(e) => updateEdit("confirmedType", e.target.value || null)}
                  disabled={!isDev}
                  className="input-field"
                  placeholder="např. horse"
                />
              </Field>

              <Field label="Barva (confirmedColor)">
                <select
                  value={edit.confirmedColor ?? ""}
                  onChange={(e) => updateEdit("confirmedColor", e.target.value || null)}
                  disabled={!isDev}
                  className="input-field"
                >
                  {COLOR_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </Field>

              <Field label="Role (confirmedRole)">
                <select
                  value={edit.confirmedRole ?? ""}
                  onChange={(e) => updateEdit("confirmedRole", e.target.value || null)}
                  disabled={!isDev}
                  className="input-field"
                >
                  {ROLE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </Field>

              <Field label="Rychlost (speed)">
                <input
                  type="number"
                  value={edit.speed ?? ""}
                  onChange={(e) => updateEdit("speed", e.target.value === "" ? null : Number(e.target.value))}
                  disabled={!isDev}
                  className="input-field"
                  placeholder="—"
                />
              </Field>

              <Field label="Max stamina (maxStamina)">
                <input
                  type="number"
                  value={edit.maxStamina ?? ""}
                  onChange={(e) => updateEdit("maxStamina", e.target.value === "" ? null : Number(e.target.value))}
                  disabled={!isDev}
                  className="input-field"
                  placeholder="—"
                />
              </Field>

              <Field label="Cena (price)">
                <input
                  type="number"
                  value={edit.price ?? ""}
                  onChange={(e) => updateEdit("price", e.target.value === "" ? null : Number(e.target.value))}
                  disabled={!isDev}
                  className="input-field"
                  placeholder="—"
                />
              </Field>

              <Field label="Raritu (rarity)">
                <select
                  value={edit.rarity ?? ""}
                  onChange={(e) => updateEdit("rarity", e.target.value || null)}
                  disabled={!isDev}
                  className="input-field"
                >
                  {RARITY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </Field>

              <Field label="Flavor text (veřejný text na kartě)">
                <textarea
                  value={edit.flavorText ?? ""}
                  onChange={(e) => updateEdit("flavorText", e.target.value || null)}
                  disabled={!isDev}
                  className="input-field resize-none"
                  rows={2}
                  placeholder="Krátký veřejný text..."
                />
              </Field>

              <Field label="Příběh / lore (story)">
                <textarea
                  value={edit.story ?? ""}
                  onChange={(e) => updateEdit("story", e.target.value || null)}
                  disabled={!isDev}
                  className="input-field resize-none"
                  rows={4}
                  placeholder="Delší lore nebo příběh koně..."
                />
              </Field>

              <Field label="Interní poznámka (nezobrazovat hráčům)">
                <textarea
                  value={edit.notes ?? ""}
                  onChange={(e) => updateEdit("notes", e.target.value || null)}
                  disabled={!isDev}
                  className="input-field resize-none"
                  rows={2}
                  placeholder="Poznámka pro interní použití..."
                />
              </Field>
            </div>

            {/* Save button */}
            {isDev && (
              <div className="space-y-1">
                <button
                  onClick={handleSave}
                  disabled={isPending || status === "saving"}
                  className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {status === "saving" ? "Ukládám…" : "Uložit změny"}
                </button>
                {status === "ok" && (
                  <p className="text-center text-xs text-green-600 font-medium">Uloženo ✓</p>
                )}
                {status === "error" && (
                  <p className="text-center text-xs text-red-600">{saveError[selectedId!] ?? "Chyba při ukládání"}</p>
                )}
              </div>
            )}

            {!isDev && (
              <p className="text-center text-xs text-slate-400">Read-only v produkci</p>
            )}
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
