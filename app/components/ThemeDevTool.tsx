"use client";

import React from "react";
import { validateThemeManifest } from "@/lib/themes/validator";
import type { ThemeManifest } from "@/lib/themes/manifest";
import { loadThemeAction, saveThemeAction, listThemesAction } from "@/app/admin/themes/dev/actions";
import type { ThemeMeta } from "@/app/admin/themes/dev/actions";

// ─── Default template ─────────────────────────────────────────────────────────

const DEFAULT_TEMPLATE: ThemeManifest = {
  meta: {
    id: "moje-theme",
    name: "Moje theme",
    description: "Popis theme.",
    version: "1.0.0",
    author: "darbujan",
  },
  labels: {
    gameName: "Dostihy",
    start: "START",
    gain: "Zisk",
    loss: "Ztráta",
    hazard: "Hazard",
    chance: "Náhoda",
    finance: "Finance",
    racer: "Kůň",
    racers: "Koně",
    racerField: "Stáj",
    bankrupt: "Bankrot",
  },
  colors: {
    pageBackground: "bg-slate-100",
    cardBackground: "bg-white",
    boardSurface: "bg-emerald-50",
    boardSurfaceBorder: "border-slate-200",
    centerBackground: "bg-slate-50",
    centerBorder: "border-slate-300",
    centerTitle: "text-slate-700",
    centerSubtitle: "text-slate-400",
    fieldStyles: {
      start: "h-20 w-20 border-red-400 bg-red-500 text-white",
      coins_gain: "h-16 w-16 border-emerald-400 bg-emerald-100 text-emerald-800",
      coins_lose: "h-16 w-16 border-red-300 bg-red-100 text-red-800",
      gamble: "h-16 w-16 border-violet-400 bg-violet-100 text-violet-800",
      racer: "h-16 w-16 border-amber-400 bg-amber-100 text-amber-800",
      horse: "h-16 w-16 border-amber-400 bg-amber-100 text-amber-800",
      neutral: "h-16 w-16 border-slate-300 bg-white text-slate-700",
      chance: "h-16 w-16 border-sky-400 bg-sky-100 text-sky-800",
      finance: "h-16 w-16 border-teal-400 bg-teal-100 text-teal-800",
    },
    activePlayerBadge: "bg-slate-900 text-white",
    rollPanelIdle: "bg-slate-100",
    rollPanelRolling: "bg-amber-100",
    textPrimary: "text-slate-800",
    textMuted: "text-slate-500",
    playerCardActive: "border-slate-900 bg-slate-50 shadow-sm",
    playerCardNormal: "border-slate-200 bg-white",
    playerCardHover: "border-blue-400 bg-blue-50 shadow-sm",
  },
  racers: [
    { id: "r1", name: "Závodník 1", speed: 2, price: 80, emoji: "🔴" },
    { id: "r2", name: "Závodník 2", speed: 3, price: 150, emoji: "🟡" },
    { id: "r3", name: "Závodník 3", speed: 4, price: 250, emoji: "🟢" },
    { id: "r4", name: "Závodník 4", speed: 5, price: 400, emoji: "🔵" },
  ],
  supportedBoards: ["small"],
};

// ─── Validation helper (captures console messages) ────────────────────────────

function runValidation(manifest: ThemeManifest): { ok: boolean; messages: string[] } {
  const messages: string[] = [];
  const origError = console.error.bind(console);
  const origWarn = console.warn.bind(console);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  console.error = (...args: any[]) => {
    messages.push("ERR: " + args.map(String).join(" "));
    origError(...args);
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  console.warn = (...args: any[]) => {
    messages.push("WARN: " + args.map(String).join(" "));
    origWarn(...args);
  };
  const ok = validateThemeManifest(manifest);
  console.error = origError;
  console.warn = origWarn;
  return { ok, messages };
}

// ─── Mini preview ─────────────────────────────────────────────────────────────

function ThemePreview({ manifest }: { manifest: ThemeManifest }) {
  const { colors, labels, racers, meta } = manifest;
  const fieldTypes = [
    { key: "start", label: "START" },
    { key: "coins_gain", label: labels.gain },
    { key: "coins_lose", label: labels.loss },
    { key: "gamble", label: labels.hazard },
    { key: "racer", label: labels.racer },
    { key: "chance", label: labels.chance },
    { key: "finance", label: labels.finance },
    { key: "neutral", label: "Neutrální" },
  ] as const;

  return (
    <div className={`rounded-xl border ${colors.boardSurfaceBorder} ${colors.boardSurface} p-4 space-y-4`}>
      {/* Header */}
      <div className={`rounded-lg border ${colors.centerBorder} ${colors.centerBackground} p-4 text-center`}>
        <div className={`text-lg font-bold ${colors.centerTitle}`}>{meta.name}</div>
        <div className={`text-sm ${colors.centerSubtitle}`}>{meta.description}</div>
        <div className="mt-1 text-xs text-slate-400">
          id: <code className="font-mono">{meta.id}</code> · v{meta.version}
        </div>
      </div>

      {/* Field types */}
      <div>
        <div className="mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">Typy polí</div>
        <div className="flex flex-wrap gap-2">
          {fieldTypes.map(({ key, label }) => {
            const cls = colors.fieldStyles[key as keyof typeof colors.fieldStyles] ?? "";
            return (
              <div
                key={key}
                className={`rounded-lg border-2 px-3 py-2 text-xs font-semibold flex flex-col items-center gap-0.5 ${cls}`}
              >
                <span className="font-mono text-[10px] opacity-60">{key}</span>
                <span>{label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Racers */}
      <div>
        <div className="mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">
          {labels.racers} ({labels.racerField})
        </div>
        <div className="flex flex-wrap gap-2">
          {racers.map((r) => (
            <div
              key={r.id}
              className={`rounded-lg border px-3 py-2 text-sm flex items-center gap-2 ${colors.playerCardNormal}`}
            >
              <span className="text-xl">{r.emoji}</span>
              <div>
                <div className="font-semibold text-slate-700">{r.name}</div>
                <div className="text-xs text-slate-500">
                  speed {r.speed} · {r.price} Kč
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Labels summary */}
      <div>
        <div className="mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">Labels</div>
        <div className="grid grid-cols-2 gap-1 text-xs">
          {Object.entries(labels).map(([k, v]) => (
            <div key={k} className="flex gap-1">
              <span className="font-mono text-slate-400 w-28 shrink-0">{k}:</span>
              <span className="text-slate-700">{String(v)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Player panels */}
      <div>
        <div className="mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">Player cards</div>
        <div className="flex gap-2">
          <div className={`rounded-lg border-2 px-3 py-1.5 text-xs ${colors.playerCardActive}`}>Aktivní hráč</div>
          <div className={`rounded-lg border-2 px-3 py-1.5 text-xs ${colors.playerCardNormal}`}>Normální hráč</div>
        </div>
      </div>
    </div>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ ok, messages }: { ok: boolean; messages: string[] }) {
  return (
    <div className={`rounded-lg border p-3 text-sm space-y-1 ${ok ? "border-emerald-300 bg-emerald-50" : "border-red-300 bg-red-50"}`}>
      <div className={`font-semibold ${ok ? "text-emerald-700" : "text-red-700"}`}>
        {ok ? "✅ Manifest je validní" : "❌ Manifest obsahuje chyby"}
      </div>
      {messages.length > 0 && (
        <ul className="space-y-0.5 mt-1">
          {messages.map((m, i) => (
            <li key={i} className={`font-mono text-xs ${m.startsWith("ERR") ? "text-red-700" : "text-amber-700"}`}>
              {m}
            </li>
          ))}
        </ul>
      )}
      {ok && messages.length === 0 && (
        <div className="text-xs text-emerald-600">Žádné chyby ani varování.</div>
      )}
    </div>
  );
}

// ─── Main tool ────────────────────────────────────────────────────────────────

export default function ThemeDevTool() {
  const [json, setJson] = React.useState(() => JSON.stringify(DEFAULT_TEMPLATE, null, 2));
  const [parseError, setParseError] = React.useState<string | null>(null);
  const [validation, setValidation] = React.useState<{ ok: boolean; messages: string[] } | null>(null);
  const [showPreview, setShowPreview] = React.useState(false);
  const [previewManifest, setPreviewManifest] = React.useState<ThemeManifest | null>(null);
  const [saveStatus, setSaveStatus] = React.useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [themeList, setThemeList] = React.useState<ThemeMeta[]>([]);
  const [listStatus, setListStatus] = React.useState<"loading" | "ready" | "error">("loading");
  const [selectedId, setSelectedId] = React.useState("");
  const [loadId, setLoadId] = React.useState("");
  const [loadStatus, setLoadStatus] = React.useState<"idle" | "loading" | "error">("idle");
  const [loadError, setLoadError] = React.useState<string | null>(null);

  // Načti seznam themes při mountu
  React.useEffect(() => {
    listThemesAction()
      .then((list) => { setThemeList(list); setListStatus("ready"); })
      .catch(() => setListStatus("error"));
  }, []);

  // Parse JSON from textarea
  function parseJson(): ThemeManifest | null {
    try {
      const parsed = JSON.parse(json) as ThemeManifest;
      setParseError(null);
      return parsed;
    } catch (e) {
      setParseError(`JSON chyba: ${e instanceof Error ? e.message : String(e)}`);
      return null;
    }
  }

  function handleValidate() {
    const manifest = parseJson();
    if (!manifest) { setValidation(null); return; }
    setValidation(runValidation(manifest));
  }

  function handlePreview() {
    const manifest = parseJson();
    if (!manifest) return;
    setPreviewManifest(manifest);
    setShowPreview(true);
  }

  async function handleSave() {
    const manifest = parseJson();
    if (!manifest) return;
    setSaveStatus("saving");
    setSaveError(null);
    const result = await saveThemeAction(manifest);
    if (result.ok) {
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 3000);
    } else {
      setSaveStatus("error");
      setSaveError(result.error);
    }
  }

  async function loadById(id: string) {
    setLoadStatus("loading");
    setLoadError(null);
    const result = await loadThemeAction(id);
    if ("error" in result) {
      setLoadStatus("error");
      setLoadError(result.error);
    } else {
      setJson(JSON.stringify(result, null, 2));
      setValidation(null);
      setShowPreview(false);
      setLoadStatus("idle");
    }
  }

  async function handleSelectLoad() {
    if (!selectedId) return;
    await loadById(selectedId);
  }

  async function handleLoad() {
    if (!loadId.trim()) return;
    await loadById(loadId.trim());
    setLoadId("");
  }

  function handleFormat() {
    const manifest = parseJson();
    if (manifest) setJson(JSON.stringify(manifest, null, 2));
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top bar */}
      <div className="border-b border-slate-200 bg-white px-6 py-3 flex items-center justify-between">
        <div>
          <h1 className="font-bold text-slate-800">Theme Dev Tool</h1>
          <p className="text-xs text-slate-400">/admin/themes/dev — interní nástroj</p>
        </div>
        <a href="/admin" className="text-xs text-slate-400 hover:text-slate-600 underline">← Admin</a>
      </div>

      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Load theme */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
          <div className="text-sm font-semibold text-slate-700">Načíst existující theme do editoru</div>

          {/* Primary: selectbox */}
          <div className="space-y-1.5">
            <div className="text-xs font-medium text-slate-500">Vyber theme</div>
            <div className="flex gap-2">
              <select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                disabled={listStatus !== "ready"}
                className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:opacity-50"
              >
                <option value="">
                  {listStatus === "loading" ? "Načítám seznam…" : listStatus === "error" ? "Chyba načítání" : "— vyber theme —"}
                </option>
                {themeList.map((t) => (
                  <option key={`${t.source}-${t.id}`} value={t.id}>
                    {t.id} — {t.name} ({t.source}{t.isOfficial ? " · official" : ""} · v{t.version})
                  </option>
                ))}
              </select>
              <button
                onClick={handleSelectLoad}
                disabled={!selectedId || loadStatus === "loading"}
                className="rounded-lg bg-slate-700 px-4 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-50 whitespace-nowrap"
              >
                {loadStatus === "loading" ? "Načítám…" : "Načíst vybrané"}
              </button>
            </div>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 border-t border-slate-200" />
            <span className="text-xs text-slate-400">nebo načti podle ID</span>
            <div className="flex-1 border-t border-slate-200" />
          </div>

          {/* Fallback: manual ID input */}
          <div className="space-y-1.5">
            <div className="text-xs font-medium text-slate-500">Načíst podle ID (advanced)</div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="ID theme, např. my-custom-theme"
                value={loadId}
                onChange={(e) => setLoadId(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLoad()}
                className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 font-mono placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
              <button
                onClick={handleLoad}
                disabled={loadStatus === "loading" || !loadId.trim()}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap"
              >
                Načíst
              </button>
            </div>
          </div>

          {loadStatus === "error" && loadError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {loadError}
            </div>
          )}
        </div>

        {/* JSON Editor */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-slate-700">ThemeManifest JSON</div>
            <button
              onClick={handleFormat}
              className="text-xs text-slate-400 hover:text-slate-600 underline"
            >
              Formátovat JSON
            </button>
          </div>

          <textarea
            value={json}
            onChange={(e) => {
              setJson(e.target.value);
              setParseError(null);
              setValidation(null);
              setShowPreview(false);
            }}
            spellCheck={false}
            rows={28}
            className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-y"
          />

          {parseError && (
            <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700 font-mono">
              {parseError}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleValidate}
              className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Validovat
            </button>
            <button
              onClick={handlePreview}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Preview
            </button>
            <button
              onClick={handleSave}
              disabled={saveStatus === "saving"}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {saveStatus === "saving" ? "Ukládám…" : saveStatus === "saved" ? "✅ Uloženo!" : "Uložit do DB"}
            </button>
          </div>

          {saveStatus === "error" && saveError && (
            <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700">
              Chyba při ukládání: {saveError}
            </div>
          )}
        </div>

        {/* Validation result */}
        {validation && <StatusBadge ok={validation.ok} messages={validation.messages} />}

        {/* Preview */}
        {showPreview && previewManifest && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-700">Preview</div>
              <button
                onClick={() => setShowPreview(false)}
                className="text-xs text-slate-400 hover:text-slate-600 underline"
              >
                Zavřít
              </button>
            </div>
            <ThemePreview manifest={previewManifest} />
          </div>
        )}

        {/* Usage hint */}
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-xs text-slate-400 space-y-1">
          <div className="font-semibold text-slate-500">Jak použít uložené theme ve hře</div>
          <div>Po uložení do DB — vytvoř hru a nastav <code className="font-mono">theme_id = manifest.meta.id</code>.</div>
          <div>Nebo přímo v URL: <code className="font-mono">/?theme=tvoje-theme-id</code> při vytváření hry.</div>
        </div>
      </div>
    </div>
  );
}
