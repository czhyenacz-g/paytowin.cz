"use client";

import React from "react";
import { validateThemeManifest } from "@/lib/themes/validator";
import type { ThemeManifest } from "@/lib/themes/manifest";
import {
  loadThemeAction,
  saveThemeAction,
  saveAsNewAction,
  archiveThemeAction,
  listThemesAction,
} from "@/app/admin/themes/dev/actions";
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

// ─── Validation helper ────────────────────────────────────────────────────────

function runValidation(manifest: ThemeManifest): { ok: boolean; messages: string[] } {
  const messages: string[] = [];
  const origError = console.error.bind(console);
  const origWarn = console.warn.bind(console);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  console.error = (...args: any[]) => { messages.push("ERR: " + args.map(String).join(" ")); origError(...args); };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  console.warn = (...args: any[]) => { messages.push("WARN: " + args.map(String).join(" ")); origWarn(...args); };
  const ok = validateThemeManifest(manifest);
  console.error = origError;
  console.warn = origWarn;
  return { ok, messages };
}

// ─── ThemePreview ─────────────────────────────────────────────────────────────

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

  const boardBgImage = manifest.assets?.boardBackgroundImage;
  return (
    <div
      className={`rounded-xl border ${colors.boardSurfaceBorder} ${colors.boardSurface} p-4 space-y-4`}
      style={boardBgImage ? { backgroundImage: `url(${boardBgImage})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
    >
      <div className={`rounded-lg border ${colors.centerBorder} ${colors.centerBackground} p-4 text-center`}>
        <div className={`text-lg font-bold ${colors.centerTitle}`}>{meta.name}</div>
        <div className={`text-sm ${colors.centerSubtitle}`}>{meta.description}</div>
        <div className="mt-1 text-xs text-slate-400">
          id: <code className="font-mono">{meta.id}</code> · v{meta.version}
        </div>
      </div>
      <div>
        <div className="mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">Typy polí</div>
        <div className="flex flex-wrap gap-2">
          {fieldTypes.map(({ key, label }) => {
            const cls = colors.fieldStyles[key as keyof typeof colors.fieldStyles] ?? "";
            return (
              <div key={key} className={`rounded-lg border-2 px-3 py-2 text-xs font-semibold flex flex-col items-center gap-0.5 ${cls}`}>
                <span className="font-mono text-[10px] opacity-60">{key}</span>
                <span>{label}</span>
              </div>
            );
          })}
        </div>
      </div>
      <div>
        <div className="mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">{labels.racers} ({labels.racerField})</div>
        <div className="flex flex-wrap gap-2">
          {racers.map((r) => (
            <div key={r.id} className={`rounded-lg border px-3 py-2 text-sm flex items-center gap-2 ${colors.playerCardNormal}`}>
              <span className="text-xl">{r.emoji}</span>
              <div>
                <div className="font-semibold text-slate-700">{r.name}</div>
                <div className="text-xs text-slate-500">speed {r.speed} · {r.price} Kč</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className={`rounded-lg border ${colors.centerBorder} ${colors.centerBackground} p-4`}>
        <div className={`mb-2 text-xs font-semibold uppercase tracking-wide ${colors.centerSubtitle}`}>Labels</div>
        <div className="grid grid-cols-2 gap-1 text-xs">
          {Object.entries(labels).map(([k, v]) => (
            <div key={k} className="flex gap-1">
              <span className={`font-mono w-28 shrink-0 ${colors.centerSubtitle}`}>{k}:</span>
              <span className={colors.centerTitle}>{String(v)}</span>
            </div>
          ))}
        </div>
      </div>
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

// ─── StatusBadge ─────────────────────────────────────────────────────────────

function StatusBadge({ ok, messages }: { ok: boolean; messages: string[] }) {
  return (
    <div className={`rounded-lg border p-3 text-sm space-y-1 ${ok ? "border-emerald-300 bg-emerald-50" : "border-red-300 bg-red-50"}`}>
      <div className={`font-semibold ${ok ? "text-emerald-700" : "text-red-700"}`}>
        {ok ? "✅ Manifest je validní" : "❌ Manifest obsahuje chyby"}
      </div>
      {messages.length > 0 && (
        <ul className="space-y-0.5 mt-1">
          {messages.map((m, i) => (
            <li key={i} className={`font-mono text-xs ${m.startsWith("ERR") ? "text-red-700" : "text-amber-700"}`}>{m}</li>
          ))}
        </ul>
      )}
      {ok && messages.length === 0 && <div className="text-xs text-emerald-600">Žádné chyby ani varování.</div>}
    </div>
  );
}

// ─── ThemeListItem ────────────────────────────────────────────────────────────

function ThemeListItem({
  theme,
  active,
  onOpen,
  onArchive,
}: {
  theme: ThemeMeta;
  active: boolean;
  onOpen: (t: ThemeMeta) => void;
  onArchive?: (id: string) => void;
}) {
  return (
    <div
      onClick={() => onOpen(theme)}
      className={`group rounded-lg px-2.5 py-2 flex items-start justify-between gap-1 cursor-pointer transition-colors ${
        active ? "bg-indigo-50 border border-indigo-200" : "border border-transparent hover:bg-slate-50"
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-slate-800 truncate">{theme.name}</div>
        <div className="text-[11px] text-slate-400 font-mono truncate">{theme.id} · v{theme.version}</div>
      </div>
      {onArchive && (
        <button
          onClick={(e) => { e.stopPropagation(); onArchive(theme.id); }}
          className="opacity-0 group-hover:opacity-100 shrink-0 p-1 text-slate-400 hover:text-red-500 transition-opacity"
          title="Archivovat"
        >
          ✕
        </button>
      )}
    </div>
  );
}

// ─── EditorMeta ──────────────────────────────────────────────────────────────

type EditorSource = "built-in" | "db" | "new";

function EditorMeta({ id, name, version, source }: { id: string; name: string; version: string; source: EditorSource }) {
  const badge =
    source === "built-in" ? (
      <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">built-in · nelze přepsat</span>
    ) : source === "db" ? (
      <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">DB</span>
    ) : (
      <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">nový</span>
    );

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-1">
      <code className="text-sm font-mono font-semibold text-slate-800">{id}</code>
      <span className="text-sm text-slate-500">{name}</span>
      <span className="text-xs text-slate-400">v{version}</span>
      {badge}
    </div>
  );
}

// ─── Notification ─────────────────────────────────────────────────────────────

type NotifType = "success" | "error" | "info";

function Notification({ type, msg, onDismiss }: { type: NotifType; msg: string; onDismiss: () => void }) {
  const styles: Record<NotifType, string> = {
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    error:   "border-red-200 bg-red-50 text-red-800",
    info:    "border-sky-200 bg-sky-50 text-sky-800",
  };
  return (
    <div className={`rounded-xl border px-4 py-3 text-sm flex items-start justify-between gap-3 ${styles[type]}`}>
      <span>{msg}</span>
      <button onClick={onDismiss} className="opacity-60 hover:opacity-100 shrink-0 text-xs">✕</button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ThemeDevTool() {
  // Library
  const [themeList, setThemeList] = React.useState<ThemeMeta[]>([]);
  const [listStatus, setListStatus] = React.useState<"loading" | "ready" | "error">("loading");

  // Editor
  const [currentId, setCurrentId] = React.useState<string | null>(null);
  const [currentSource, setCurrentSource] = React.useState<EditorSource>("new");
  const [json, setJson] = React.useState(() => JSON.stringify(DEFAULT_TEMPLATE, null, 2));
  const [parseError, setParseError] = React.useState<string | null>(null);
  const [validation, setValidation] = React.useState<{ ok: boolean; messages: string[] } | null>(null);
  const [showPreview, setShowPreview] = React.useState(false);
  const [previewManifest, setPreviewManifest] = React.useState<ThemeManifest | null>(null);

  // Actions
  const [saving, setSaving] = React.useState(false);
  const [notif, setNotif] = React.useState<{ type: NotifType; msg: string } | null>(null);

  // Meta — derived from JSON, best-effort. Používá se v meta baru i metadata formu.
  const parsedMeta = React.useMemo(() => {
    try {
      const p = JSON.parse(json) as ThemeManifest;
      return {
        id:          p?.meta?.id          ?? "",
        name:        p?.meta?.name        ?? "",
        description: p?.meta?.description ?? "",
        version:     p?.meta?.version     ?? "1.0.0",
      };
    } catch { return null; }
  }, [json]);

  // ── Notification helpers ───────────────────────────────────────────────────

  const notify = React.useCallback((type: NotifType, msg: string) => {
    setNotif({ type, msg });
    if (type !== "error") setTimeout(() => setNotif(null), 3500);
  }, []);

  // ── Load list ──────────────────────────────────────────────────────────────

  const loadList = React.useCallback(async () => {
    setListStatus("loading");
    try {
      const list = await listThemesAction();
      setThemeList(list);
      setListStatus("ready");
    } catch {
      setListStatus("error");
    }
  }, []);

  React.useEffect(() => { loadList(); }, [loadList]);

  // ── JSON parse helper ──────────────────────────────────────────────────────

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

  // ── Metadata patch — zapisuje změny z formu zpět do JSON ─────────────────
  //    JSON je stále jediný source-of-truth; form jen čte parsedMeta a patchuje.

  function patchMeta(updates: Partial<{ id: string; name: string; description: string; version: string }>) {
    try {
      const parsed = JSON.parse(json) as ThemeManifest;
      parsed.meta = { ...parsed.meta, ...updates };
      setJson(JSON.stringify(parsed, null, 2));
      setParseError(null);
    } catch {
      setParseError("JSON obsahuje syntaktickou chybu — oprav ho nejdřív.");
    }
  }

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleOpenTheme = React.useCallback(async (theme: ThemeMeta) => {
    const result = await loadThemeAction(theme.id);
    if ("error" in result) { notify("error", result.error); return; }
    setJson(JSON.stringify(result, null, 2));
    setCurrentId(theme.id);
    setCurrentSource(theme.source);
    setValidation(null);
    setShowPreview(false);
    setParseError(null);
    notify("info", `Načteno: ${theme.name}`);
  }, [notify]);

  function handleNewTheme() {
    setJson(JSON.stringify(DEFAULT_TEMPLATE, null, 2));
    setCurrentId(null);
    setCurrentSource("new");
    setValidation(null);
    setShowPreview(false);
    setParseError(null);
    notify("info", "Nový template — uprav meta.id a obsah, pak ulož.");
  }

  function handleDuplicate() {
    const manifest = parseJson();
    if (!manifest) return;
    const copy: ThemeManifest = {
      ...manifest,
      meta: { ...manifest.meta, id: manifest.meta.id + "-copy", name: manifest.meta.name + " Copy" },
    };
    setJson(JSON.stringify(copy, null, 2));
    setCurrentId(copy.meta.id);
    setCurrentSource("new");
    setValidation(null);
    setShowPreview(false);
    notify("info", `Kopie otevřena jako "${copy.meta.id}". Uprav ID a název v poli Metadata níže, pak ulož jako nové.`);
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
    setSaving(true);
    const result = await saveThemeAction(manifest);
    setSaving(false);
    if (result.ok) {
      setCurrentSource("db");
      setCurrentId(manifest.meta.id);
      notify("success", `Uloženo: ${manifest.meta.id}`);
      loadList();
    } else {
      notify("error", result.error);
    }
  }

  async function handleSaveAsNew() {
    const manifest = parseJson();
    if (!manifest) return;
    setSaving(true);
    const result = await saveAsNewAction(manifest);
    setSaving(false);
    if (result.ok) {
      setCurrentSource("db");
      setCurrentId(manifest.meta.id);
      notify("success", `Uloženo jako nové: ${manifest.meta.id}`);
      loadList();
    } else {
      notify("error", result.error);
    }
  }

  const handleArchive = React.useCallback(async (id: string) => {
    const name = themeList.find(t => t.id === id)?.name ?? id;
    if (!window.confirm(`Archivovat "${name}" (${id})?\n\nTheme zmizí ze seznamu. Data zůstanou v DB.`)) return;
    const result = await archiveThemeAction(id);
    if (!result.ok) { notify("error", result.error); return; }
    setThemeList(prev => prev.filter(t => t.id !== id));
    if (currentId === id) {
      setCurrentSource("new");
      notify("info", `"${id}" archivován. Manifest zůstává v editoru.`);
    } else {
      notify("success", `Theme "${id}" archivován.`);
    }
  }, [themeList, currentId, notify]);

  function handleFormat() {
    const manifest = parseJson();
    if (manifest) setJson(JSON.stringify(manifest, null, 2));
  }

  // Sidebar split
  const builtInThemes = themeList.filter(t => t.source === "built-in");
  const dbThemes = themeList.filter(t => t.source === "db");

  return (
    <div className="h-screen flex flex-col bg-slate-50">

      {/* ── Top bar ── */}
      <div className="border-b border-slate-200 bg-white px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-800">Theme Library</span>
          <span className="text-xs text-slate-400">/admin/themes/dev</span>
        </div>
        <a href="/admin" className="text-xs text-slate-400 hover:text-slate-600 underline">← Admin</a>
      </div>

      {/* ── Main ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Sidebar ── */}
        <aside className="w-60 shrink-0 border-r border-slate-200 bg-white flex flex-col overflow-hidden">
          {/* Header */}
          <div className="px-3 py-3 border-b border-slate-200 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Themes</span>
            <button
              onClick={handleNewTheme}
              className="rounded-lg bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-indigo-700"
            >
              + Nové
            </button>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto p-2">
            {listStatus === "loading" && (
              <div className="py-6 text-xs text-slate-400 text-center">Načítám…</div>
            )}
            {listStatus === "error" && (
              <div className="py-4 text-xs text-red-500 text-center space-y-1">
                <div>Chyba načítání</div>
                <button onClick={loadList} className="underline">Zkusit znovu</button>
              </div>
            )}
            {listStatus === "ready" && (
              <>
                {/* Built-in */}
                <div className="px-2 pt-2 pb-1 text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
                  Built-in ({builtInThemes.length})
                </div>
                {builtInThemes.map(t => (
                  <ThemeListItem
                    key={t.id} theme={t}
                    active={currentId === t.id && currentSource === "built-in"}
                    onOpen={handleOpenTheme}
                  />
                ))}

                {/* DB */}
                <div className="px-2 pt-4 pb-1 text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
                  Databáze ({dbThemes.length})
                </div>
                {dbThemes.length === 0 ? (
                  <div className="px-2 py-2 text-xs text-slate-400 italic">Žádné DB themes</div>
                ) : (
                  dbThemes.map(t => (
                    <ThemeListItem
                      key={t.id} theme={t}
                      active={currentId === t.id && currentSource === "db"}
                      onOpen={handleOpenTheme}
                      onArchive={handleArchive}
                    />
                  ))
                )}
              </>
            )}
          </div>

          {/* Sidebar footer — rules */}
          <div className="border-t border-slate-100 px-3 py-3 text-[10px] text-slate-400 space-y-1 leading-relaxed">
            <div><span className="text-amber-600 font-medium">Built-in</span> — načíst, preview, duplikovat</div>
            <div><span className="text-indigo-600 font-medium">DB</span> — načíst, upravit, uložit, archivovat</div>
          </div>
        </aside>

        {/* ── Editor ── */}
        <main className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* Notification */}
          {notif && <Notification type={notif.type} msg={notif.msg} onDismiss={() => setNotif(null)} />}

          {/* Meta bar */}
          {parsedMeta && (
            <EditorMeta
              id={parsedMeta.id}
              name={parsedMeta.name}
              version={parsedMeta.version}
              source={currentSource}
            />
          )}

          {/* Metadata form — rychlá úprava nejdůležitějších polí */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-700">Metadata</span>
              <span className="text-[11px] text-slate-400">změny se zapisují přímo do JSON</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-500">Theme ID</label>
                <input
                  type="text"
                  value={parsedMeta?.id ?? ""}
                  onChange={(e) => patchMeta({ id: e.target.value })}
                  placeholder="moje-theme"
                  disabled={!parsedMeta}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 font-mono placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:opacity-40"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-500">Název</label>
                <input
                  type="text"
                  value={parsedMeta?.name ?? ""}
                  onChange={(e) => patchMeta({ name: e.target.value })}
                  placeholder="Moje theme"
                  disabled={!parsedMeta}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:opacity-40"
                />
              </div>
              <div className="space-y-1 col-span-2">
                <label className="block text-xs font-medium text-slate-500">Popis</label>
                <input
                  type="text"
                  value={parsedMeta?.description ?? ""}
                  onChange={(e) => patchMeta({ description: e.target.value })}
                  placeholder="Krátký popis theme."
                  disabled={!parsedMeta}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:opacity-40"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-500">Verze</label>
                <input
                  type="text"
                  value={parsedMeta?.version ?? ""}
                  onChange={(e) => patchMeta({ version: e.target.value })}
                  placeholder="1.0.0"
                  disabled={!parsedMeta}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 font-mono placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:opacity-40"
                />
              </div>
            </div>
            {!parsedMeta && (
              <div className="text-xs text-amber-600">JSON obsahuje syntaktickou chybu — oprav ji nejdřív.</div>
            )}
          </div>

          {/* JSON Editor */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-700">ThemeManifest JSON</span>
              <button onClick={handleFormat} className="text-xs text-slate-400 hover:text-slate-600 underline">
                Formátovat
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
              rows={26}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 text-slate-100 px-3 py-2 font-mono text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-y"
            />

            {parseError && (
              <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700 font-mono">
                {parseError}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2">
              <button onClick={handleValidate}
                className="rounded-lg bg-slate-700 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800">
                Validovat
              </button>
              <button onClick={handlePreview}
                className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700">
                Preview
              </button>
              <button onClick={handleDuplicate}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                Duplikovat
              </button>

              <div className="flex-1" />

              {/* Save — blocked for built-in */}
              {currentSource === "built-in" ? (
                <button disabled
                  title="Built-in themes nelze přepsat. Použij Duplikovat."
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-400 cursor-not-allowed">
                  🔒 Uložit
                </button>
              ) : (
                <button onClick={handleSave} disabled={saving}
                  className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
                  {saving ? "Ukládám…" : "Uložit"}
                </button>
              )}

              <button onClick={handleSaveAsNew} disabled={saving}
                className="rounded-lg border border-emerald-400 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50">
                Uložit jako nové
              </button>
            </div>

            {currentSource === "built-in" && (
              <div className="text-xs text-amber-600">
                Built-in theme — nelze přepsat. Použij <strong>Duplikovat</strong> → uprav <code className="font-mono">meta.id</code> → <strong>Uložit jako nové</strong>.
              </div>
            )}
          </div>

          {/* Validation result */}
          {validation && <StatusBadge ok={validation.ok} messages={validation.messages} />}

          {/* Preview */}
          {showPreview && previewManifest && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-700">Preview</span>
                <button onClick={() => setShowPreview(false)} className="text-xs text-slate-400 hover:text-slate-600 underline">
                  Zavřít
                </button>
              </div>
              <ThemePreview manifest={previewManifest} />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
