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
  setPublicAction,
} from "@/app/admin/themes/dev/actions";
import type { ThemeMeta } from "@/app/admin/themes/dev/actions";
import { SMALL_BOARD } from "@/lib/board/presets";
import type { BoardConfig, BoardFieldConfig } from "@/lib/board/types";
import BoardEditorPreview from "@/app/components/editor/BoardEditorPreview";
import FieldEditorPanel from "@/app/components/editor/FieldEditorPanel";
import type { AssetSectionConfig } from "@/app/components/editor/FieldEditorPanel";
import RacerEditorPanel from "@/app/components/editor/RacerEditorPanel";
import RacerRosterPanel from "@/app/components/editor/RacerRosterPanel";
import DeckEditorPanel from "@/app/components/editor/DeckEditorPanel";
import type { GameCard } from "@/lib/cards";
import { buildFields } from "@/lib/engine";
import type { RacerConfig } from "@/lib/themes";
import {
  THEME_ASSETS,
  fieldAssetKey,
  resolveFieldCardImagePath,
  resolveRacerCardImagePath,
} from "@/lib/themes/assets";

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
      <div className={`rounded-lg border ${colors.centerBorder} ${colors.centerBackground} p-4`}>
        <div className={`mb-2 text-xs font-semibold uppercase tracking-wide ${colors.centerSubtitle}`}>Typy polí</div>
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
      <div className={`rounded-lg border ${colors.centerBorder} ${colors.centerBackground} p-4`}>
        <div className={`mb-2 text-xs font-semibold uppercase tracking-wide ${colors.centerSubtitle}`}>{labels.racers} ({labels.racerField})</div>
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
      <div className={`rounded-lg border ${colors.centerBorder} ${colors.centerBackground} p-4`}>
        <div className={`mb-2 text-xs font-semibold uppercase tracking-wide ${colors.centerSubtitle}`}>Player cards</div>
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

// ─── EditorExportPanel ───────────────────────────────────────────────────────

/**
 * EditorExportPanel — přehledný export editor state pro ruční commit.
 *
 * Tři záložky:
 *   Board  — editableBoard jako JSON (vložit do lib/board/presets.ts)
 *   Assets — liveManifest.assets jako JSON (vložit do theme souboru)
 *   Vše    — oba bloky s komentáři (jeden velký copy pro diff/PR)
 */
function EditorExportPanel({
  editableBoard,
  liveManifest,
  editableFieldTextures,
  editableRacerImages,
  editableRacers,
  editableCards,
}: {
  editableBoard: BoardConfig;
  liveManifest: ThemeManifest;
  editableFieldTextures: Record<string, string>;
  editableRacerImages: Record<string, string>;
  editableRacers: RacerConfig[];
  editableCards: { chance: GameCard[]; finance: GameCard[] };
}) {
  type ExportTab = "board" | "racers" | "decks" | "assets" | "all";
  const [tab, setTab] = React.useState<ExportTab>("board");
  const [copied, setCopied] = React.useState<ExportTab | null>(null);

  function copy(text: string, which: ExportTab) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(which);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  // Výsledný assets objekt — base z manifestu + editor overrides
  const mergedAssets = React.useMemo(() => ({
    ...(liveManifest.assets?.boardBackgroundImage !== undefined && {
      boardBackgroundImage: liveManifest.assets.boardBackgroundImage,
    }),
    ...(liveManifest.assets?.previewImage !== undefined && {
      previewImage: liveManifest.assets.previewImage,
    }),
    ...(Object.keys(editableFieldTextures).length > 0 && {
      fieldTextures: editableFieldTextures,
    }),
    ...(Object.keys(editableRacerImages).length > 0 && {
      racerImages: editableRacerImages,
    }),
  }), [liveManifest.assets, editableFieldTextures, editableRacerImages]);

  const hasAssetChanges =
    Object.keys(editableFieldTextures).length > 0 ||
    Object.keys(editableRacerImages).length > 0;

  const boardJson   = JSON.stringify(editableBoard, null, 2);
  const racersJson  = JSON.stringify(editableRacers, null, 2);
  const decksJson   = JSON.stringify(editableCards, null, 2);
  const assetsJson  = JSON.stringify(mergedAssets, null, 2);
  const hasDecksChanges = editableCards.chance.length > 0 || editableCards.finance.length > 0;

  const themeFile   = `lib/themes/${liveManifest.meta.id}.ts`;

  const combinedText = [
    `// ═══ BOARD CONFIG ═══`,
    `// Soubor: lib/board/presets.ts`,
    `// export const ${editableBoard.id.toUpperCase().replace(/-/g, "_")}_BOARD: BoardConfig = ${boardJson};`,
    ``,
    `// ═══ RACEŘI ═══`,
    `// Soubor: ${themeFile} — sekce racers: [...]`,
    racersJson,
    ``,
    `// ═══ DECKY ═══`,
    `// Soubor: ${themeFile} — sekce cards: { chance: [...], finance: [...] }`,
    `// Vložit jen pokud chceš přepsat globální balíčky z lib/cards.ts.`,
    decksJson,
    ``,
    `// ═══ ASSET MAPPING ═══`,
    `// Soubor: ${themeFile} — sekce assets: { … }`,
    assetsJson,
  ].join("\n");

  const TAB_LABELS: Record<ExportTab, string> = {
    board:  "Board config",
    racers: "Raceři",
    decks:  "Decky",
    assets: "Asset mapping",
    all:    "Vše",
  };

  // Zda jsou raceři změnění oproti původnímu manifestu (heuristika: JSON diff)
  const hasRacerChanges = JSON.stringify(editableRacers) !== JSON.stringify(liveManifest.racers);

  const EXPORT_HINTS: Record<ExportTab, string> = {
    board:  "→ lib/board/presets.ts — export const … : BoardConfig = { … }",
    racers: `→ ${themeFile} — sekce racers: [ … ]`,
    decks:  hasDecksChanges ? `→ ${themeFile} — sekce cards: { chance: […], finance: […] }` : "— prázdné decky = hra použije globální karty z lib/cards.ts",
    assets: hasAssetChanges ? `→ ${themeFile} — sekce assets: { … }` : "— žádné asset overrides zatím nebyly nastaveny",
    all:    "→ všechny bloky s komentáři — vhodné pro diff review nebo PR popis",
  };

  const content: Record<ExportTab, string> = {
    board:  boardJson,
    racers: racersJson,
    decks:  decksJson,
    assets: assetsJson,
    all:    combinedText,
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-2.5">
        <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">
          Export
        </span>
        <div className="flex items-center gap-3">
          {/* Záložky */}
          <div className="flex rounded-lg border border-slate-200 bg-white overflow-hidden text-xs">
            {(["board", "racers", "decks", "assets", "all"] as ExportTab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-1.5 font-medium transition-colors border-l first:border-l-0 border-slate-200 ${
                  tab === t ? "bg-slate-800 text-white" : "text-slate-500 hover:bg-slate-50"
                }`}
              >
                {TAB_LABELS[t]}
                {t === "assets" && hasAssetChanges && (
                  <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-violet-500 align-middle" />
                )}
                {t === "racers" && hasRacerChanges && (
                  <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-amber-400 align-middle" />
                )}
                {t === "decks" && hasDecksChanges && (
                  <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-sky-400 align-middle" />
                )}
              </button>
            ))}
          </div>

          {/* Copy button */}
          <button
            onClick={() => copy(content[tab], tab)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              copied === tab
                ? "bg-emerald-100 text-emerald-700"
                : "bg-indigo-600 text-white hover:bg-indigo-700"
            }`}
          >
            {copied === tab ? "✓ Zkopírováno!" : "Kopírovat"}
          </button>
        </div>
      </div>

      {/* Nápověda k záložce */}
      <div className="border-b border-slate-100 bg-slate-50/60 px-4 py-1.5 text-[10px] text-slate-400">
        {EXPORT_HINTS[tab]}
      </div>

      {/* JSON preview */}
      <pre className="px-4 py-3 font-mono text-[10px] leading-relaxed text-slate-600 max-h-64 overflow-y-auto whitespace-pre-wrap break-all">
        {content[tab]}
      </pre>

      {/* Asset diff summary */}
      {tab === "assets" && (
        <div className="border-t border-slate-100 px-4 py-2.5 space-y-1">
          <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Změněné textury</div>
          {!hasAssetChanges ? (
            <div className="text-[10px] text-slate-400 italic">Žádné změny oproti výchozímu manifestu.</div>
          ) : (
            <div className="space-y-0.5">
              {Object.entries(editableFieldTextures).map(([type, path]) => (
                <div key={type} className="flex items-center gap-2 text-[10px]">
                  <span className="font-mono text-violet-600 w-24 shrink-0">{type}</span>
                  <span className="text-slate-400 truncate">{path}</span>
                </div>
              ))}
              {Object.entries(editableRacerImages).map(([id, path]) => (
                <div key={id} className="flex items-center gap-2 text-[10px]">
                  <span className="font-mono text-indigo-600 w-24 shrink-0">racer:{id}</span>
                  <span className="text-slate-400 truncate">{path}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Deck diff summary */}
      {tab === "decks" && (
        <div className="border-t border-slate-100 px-4 py-2.5 space-y-2">
          {(["chance", "finance"] as const).map((deckType) => {
            const deckCards = editableCards[deckType];
            const deckLabel = deckType === "chance" ? "🎴 Náhoda" : "💼 Finance";
            return (
              <div key={deckType}>
                <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
                  {deckLabel} — {deckCards.length > 0 ? `${deckCards.length} vlastních karet` : "globální fallback (lib/cards.ts)"}
                </div>
                {deckCards.length > 0 && (
                  <div className="space-y-0.5">
                    {deckCards.map((c) => (
                      <div key={c.id} className="flex items-center gap-2 text-[10px]">
                        <span className="font-mono text-slate-300 w-16 shrink-0">{c.id}</span>
                        <span className="text-slate-500 shrink-0 w-20">{c.effect.kind}{c.effect.value !== undefined ? ` ${c.effect.value}` : ""}</span>
                        <span className="text-slate-400 truncate italic">{c.text.slice(0, 50)}{c.text.length > 50 ? "…" : ""}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Racer diff summary */}
      {tab === "racers" && (
        <div className="border-t border-slate-100 px-4 py-2.5 space-y-1">
          <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Raceři v editoru</div>
          <div className="space-y-0.5">
            {editableRacers.map((r) => (
              <div key={r.id} className="flex items-center gap-2 text-[10px]">
                <span className="text-base leading-none">{r.emoji}</span>
                <span className="font-mono text-amber-700 w-28 shrink-0">{r.id}</span>
                <span className="text-slate-500 shrink-0">speed:{r.speed}</span>
                <span className="text-slate-500 shrink-0">stamina:{r.stamina ?? 100}</span>
                {r.flavorText && <span className="text-slate-400 truncate italic">{r.flavorText.slice(0, 40)}{r.flavorText.length > 40 ? "…" : ""}</span>}
              </div>
            ))}
          </div>
          {hasRacerChanges && (
            <div className="mt-1 text-[10px] text-amber-600">● Oproti manifestu byly změněny parametry závodníků</div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── LegendaryRacerGuide ──────────────────────────────────────────────────────

function LegendaryRacerGuide() {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="rounded-xl border border-indigo-200 bg-indigo-50 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-indigo-100/60 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-base">📖</span>
          <span className="text-xs font-semibold text-indigo-800">Jak vytvořit legendárního racera získatelného z Náhody</span>
        </div>
        <span className="text-xs text-indigo-400 shrink-0">{open ? "▲ Skrýt" : "▼ Zobrazit"}</span>
      </button>

      {open && (
        <div className="border-t border-indigo-200 px-4 py-4 space-y-4 text-xs text-indigo-900">

          <div className="space-y-2.5">
            {([
              {
                n: 1,
                title: "Přidej racera do rosteru",
                body: <>V sekci <strong>Závodníci</strong> klikni <em>+ Přidat</em>. Nastav mu unikátní ID — např. <code className="font-mono bg-indigo-100 px-1 rounded">zeleznik</code>. ID musí být slug (jen a–z, 0–9, _, -).</>,
              },
              {
                n: 2,
                title: "Nastav mu Legendary + Flavor text",
                body: <>Klikni na racera v rosteru, otevře se RacerEditor. Zaškrtni <strong>Legendární</strong> a vyplň <strong>Flavor text</strong> — zobrazí se při burnoutu i při revealu karty.</>,
              },
              {
                n: 3,
                title: "Volitelně: přidej racer art obrázek",
                body: <>V RacerEditoru nebo v FieldEditoru (kliknutím na racer pole v boardu) nahraj <code className="font-mono bg-indigo-100 px-1 rounded">.webp</code> obrázek závodníka. Zobrazuje se při hoveru na kartu v boardu.</>,
              },
              {
                n: 4,
                title: "Otevři Deck editor — Náhoda",
                body: <>Pokud je deck prázdný, klikni <strong>Importovat globální</strong> (zkopíruje výchozí karty k editaci). Nebo rovnou klikni <strong>+ Přidat</strong> pro novou kartu.</>,
              },
              {
                n: 5,
                title: "Nastav kartu: efekt give_racer + Racer ID",
                body: <>Klikni na kartu, v editoru vyber efekt <strong>Závodník zdarma</strong>. Do pole <strong>Racer ID</strong> zadej přesně stejné ID, které jsi použil v kroku 1 — např. <code className="font-mono bg-indigo-100 px-1 rounded">zeleznik</code>. Pokud ID nesedí, hra dá náhodného volného racera.</>,
              },
              {
                n: 6,
                title: "Volitelně: přidej reveal obrázek ke kartě",
                body: <>V poli <strong>Art obrázek</strong> zadej cestu k souboru v <code className="font-mono bg-indigo-100 px-1 rounded">/public</code> — např. <code className="font-mono bg-indigo-100 px-1 rounded">/themes/horse-day/horse_legend.webp</code>. Zobrazí se při reveal karty ve hře.</>,
              },
              {
                n: 7,
                title: "Ulož do souborů",
                body: <>Klikni <strong>💾 Uložit do souborů</strong> v liště nad boardem. Zapíše racer do <code className="font-mono bg-indigo-100 px-1 rounded">lib/themes/{"{themeId}"}.ts</code> a karty do stejného souboru. Pak commitni a pushni.</>,
              },
            ] as { n: number; title: string; body: React.ReactNode }[]).map(({ n, title, body }) => (
              <div key={n} className="flex gap-3">
                <div className="shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-white font-bold text-[10px] mt-0.5">
                  {n}
                </div>
                <div>
                  <div className="font-semibold text-indigo-800 mb-0.5">{title}</div>
                  <div className="text-indigo-700 leading-relaxed">{body}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-lg border border-indigo-200 bg-white/60 px-3 py-2.5 space-y-1">
            <div className="font-semibold text-indigo-800 text-[11px] uppercase tracking-wide">Jak to funguje uvnitř</div>
            <div className="text-indigo-600 leading-relaxed">
              Každé theme má vlastní deck karet (<code className="font-mono bg-indigo-100 px-1 rounded">theme.content.cards</code>).
              Karta <code className="font-mono bg-indigo-100 px-1 rounded">give_racer</code> hledá racera podle <code className="font-mono bg-indigo-100 px-1 rounded">racerId</code> v živém boardu aktuálního theme.
              Díky tomu horse-day dá Železníka, car-day dá Ferrari — každé theme má svého legendu, bez zásahu do globálního kódu.
              Pokud racerId nesedí na žádného volného racera, hra dá náhodného volného jako fallback.
            </div>
          </div>

        </div>
      )}
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
  const [showBoardPreview, setShowBoardPreview] = React.useState(false);
  const [boardPreviewManifest, setBoardPreviewManifest] = React.useState<ThemeManifest | null>(null);
  const [previewAssetVersion, setPreviewAssetVersion] = React.useState(0);
  // Editovatelná kopie board configu — živá jen v local state, nezapisuje se do presets.ts
  const [editableBoard, setEditableBoard] = React.useState<BoardConfig>(() => ({
    ...SMALL_BOARD,
    fields: SMALL_BOARD.fields.map((f) => ({ ...f })),
  }));
  const [selectedFieldIndex, setSelectedFieldIndex] = React.useState<number | null>(null);
  // Editovatelné asset overrides — nezávislé na boardPreviewManifest
  // fieldTextures: type → custom path, racerImages: racerId → custom path
  const [editableFieldTextures, setEditableFieldTextures] = React.useState<Record<string, string>>({});
  const [editableRacerImages, setEditableRacerImages] = React.useState<Record<string, string>>({});
  // Editovatelní závodníci — živá kopie manifest.racers pro editor
  const [editableRacers, setEditableRacers] = React.useState<RacerConfig[]>([]);

  /**
   * withSlotIndexes — zajistí, že každý racer má explicitní slotIndex.
   * Pokud racer slotIndex nemá (stará data), přiřadí mu pořadový index.
   * Volá se při každém načtení racerů z manifestu/draftu.
   */
  function withSlotIndexes(racers: RacerConfig[]): RacerConfig[] {
    return racers.map((r, i) => r.slotIndex !== undefined ? r : { ...r, slotIndex: i });
  }
  // Editovatelné decky — živá kopie manifest.cards; prázdné = hra používá globální balíčky
  const [editableCards, setEditableCards] = React.useState<{ chance: GameCard[]; finance: GameCard[] }>({ chance: [], finance: [] });

  // ── Draft persistence (localStorage) ──────────────────────────────────────
  // savedSnapshot: JSON otisk stavu při posledním otevření/uložení — slouží pro isDirty
  const [savedSnapshot, setSavedSnapshot] = React.useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = React.useState<Date | null>(null);
  const [hasDraft, setHasDraft] = React.useState<boolean>(() => {
    try { return !!localStorage.getItem("ptw_board_draft"); } catch { return false; }
  });

  const isDirty = React.useMemo(() => {
    if (!showBoardPreview || savedSnapshot === null) return false;
    const current = JSON.stringify({ editableBoard, editableRacers, editableCards, editableFieldTextures, editableRacerImages });
    return current !== savedSnapshot;
  }, [showBoardPreview, savedSnapshot, editableBoard, editableRacers, editableFieldTextures, editableRacerImages]);

  // Živý manifest pro BoardEditorPreview — base manifest + asset overrides + editableRacers
  const liveManifest = React.useMemo<ThemeManifest | null>(() => {
    if (!boardPreviewManifest) return null;
    const hasCustomCards = editableCards.chance.length > 0 || editableCards.finance.length > 0;
    return {
      ...boardPreviewManifest,
      racers: editableRacers.length > 0 ? editableRacers : boardPreviewManifest.racers,
      cards: hasCustomCards ? editableCards : boardPreviewManifest.cards,
      assets: {
        ...boardPreviewManifest.assets,
        fieldTextures: {
          ...boardPreviewManifest.assets?.fieldTextures,
          ...editableFieldTextures,
        },
        racerImages: {
          ...boardPreviewManifest.assets?.racerImages,
          ...editableRacerImages,
        },
      },
    };
  }, [boardPreviewManifest, editableRacers, editableCards, editableFieldTextures, editableRacerImages]);

  // Asset sekce pro FieldEditorPanel — počítá se z vybraného pole + liveManifest
  const currentAssetSection = React.useMemo<AssetSectionConfig | undefined>(() => {
    if (selectedFieldIndex === null || !liveManifest) return undefined;
    const fieldConfig = editableBoard.fields.find((f) => f.index === selectedFieldIndex);
    if (!fieldConfig) return undefined;

    const themeId = liveManifest.meta.id;

    if (fieldConfig.type === "racer") {
      // Racer pole: asset je per-racer-id, ne per-type
      const runtimeFields = buildFields(editableBoard, liveManifest.racers);
      const runtimeField = runtimeFields.find((f) => f.index === selectedFieldIndex);
      const racerId = runtimeField?.racer?.id;
      const override = racerId ? editableRacerImages[racerId] : undefined;
      const resolvedPath = resolveRacerCardImagePath(themeId, racerId, override);

      return {
        assetKey: "fieldRacer",
        canonicalFile: racerId ? `racer-${racerId}.webp` : null,
        resolvedPath,
        override,
        racerId,
        onOverrideChange: (newOverride) => {
          if (!racerId) return;
          setEditableRacerImages((prev) => {
            const next = { ...prev };
            if (newOverride === undefined) { delete next[racerId]; } else { next[racerId] = newOverride; }
            return next;
          });
        },
        uploadConfig: racerId ? {
          themeId,
          racerId,
          onUploaded: (webpPath: string) => {
            setEditableRacerImages((prev) => ({ ...prev, [racerId]: webpPath }));
            setPreviewAssetVersion((prev) => prev + 1);
          },
        } : undefined,
      };
    } else {
      // Ostatní pole: asset je per-type
      const assetKey = fieldAssetKey(fieldConfig.type);
      const canonicalFile = assetKey ? THEME_ASSETS[assetKey] : null;
      const override = editableFieldTextures[fieldConfig.type];
      const resolvedPath = resolveFieldCardImagePath(themeId, fieldConfig.type, override);

      return {
        assetKey,
        canonicalFile,
        resolvedPath,
        override,
        onOverrideChange: (newOverride) => {
          setEditableFieldTextures((prev) => {
            const next = { ...prev };
            if (newOverride === undefined) { delete next[fieldConfig.type]; } else { next[fieldConfig.type] = newOverride; }
            return next;
          });
        },
        // Upload pipeline — fáze 1: jen pro non-racer field assety
        uploadConfig: {
          themeId,
          fieldType: fieldConfig.type,
          onUploaded: (webpPath: string) => {
            setEditableFieldTextures((prev) => ({ ...prev, [fieldConfig.type]: webpPath }));
            setPreviewAssetVersion((prev) => prev + 1);
          },
        },
      };
    }
  }, [selectedFieldIndex, editableBoard, liveManifest, editableFieldTextures, editableRacerImages]);

  // Aktuálně vybraný závodník — jen pro racer pole
  const currentSelectedRacer = React.useMemo<RacerConfig | null>(() => {
    if (selectedFieldIndex === null || !liveManifest) return null;
    const fieldConfig = editableBoard.fields.find((f) => f.index === selectedFieldIndex);
    if (fieldConfig?.type !== "racer") return null;
    const runtimeFields = buildFields(editableBoard, liveManifest.racers);
    const runtimeField = runtimeFields.find((f) => f.index === selectedFieldIndex);
    const racerId = runtimeField?.racer?.id;
    if (!racerId) return null;
    return liveManifest.racers.find((r) => r.id === racerId) ?? null;
  }, [selectedFieldIndex, editableBoard, liveManifest]);

  // Actions
  const [saving, setSaving] = React.useState(false);
  const [savingToFiles, setSavingToFiles] = React.useState(false);
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

  function handleBoardPreview() {
    const manifest = parseJson();
    if (!manifest) return;

    const newBoard: BoardConfig     = { ...SMALL_BOARD, fields: SMALL_BOARD.fields.map((f) => ({ ...f })) };
    const newRacers: RacerConfig[]  = withSlotIndexes(manifest.racers.map((r) => ({ ...r })));
    const newCards: { chance: GameCard[]; finance: GameCard[] } = manifest.cards
      ? { chance: [...manifest.cards.chance], finance: [...manifest.cards.finance] }
      : { chance: [], finance: [] };
    const newTextures               = manifest.assets?.fieldTextures ? { ...manifest.assets.fieldTextures } : {};
    const newRacerImages            = manifest.assets?.racerImages   ? { ...manifest.assets.racerImages }   : {};

    setBoardPreviewManifest(manifest);
    setPreviewAssetVersion(0);
    setShowBoardPreview(true);
    setSelectedFieldIndex(null);
    setEditableBoard(newBoard);
    setEditableFieldTextures(newTextures);
    setEditableRacerImages(newRacerImages);
    setEditableRacers(newRacers);
    setEditableCards(newCards);

    // Nastav čistý snapshot — žádné neuložené změny hned po otevření
    const snap = JSON.stringify({ editableBoard: newBoard, editableRacers: newRacers, editableCards: newCards, editableFieldTextures: newTextures, editableRacerImages: newRacerImages });
    setSavedSnapshot(snap);
    setLastSavedAt(null);
  }

  function saveDraft() {
    if (!liveManifest) return;
    const draft = {
      savedAt: new Date().toISOString(),
      themeId: liveManifest.meta.id,
      editableBoard,
      editableRacers,
      editableCards,
      editableFieldTextures,
      editableRacerImages,
    };
    try {
      localStorage.setItem("ptw_board_draft", JSON.stringify(draft));
      const snap = JSON.stringify({ editableBoard, editableRacers, editableCards, editableFieldTextures, editableRacerImages });
      setSavedSnapshot(snap);
      setLastSavedAt(new Date());
      setHasDraft(true);
      notify("success", "Draft uložen lokálně.");
    } catch {
      notify("error", "Nepodařilo se uložit draft (localStorage).");
    }
  }

  function loadDraft() {
    try {
      const raw = localStorage.getItem("ptw_board_draft");
      if (!raw) { notify("info", "Žádný lokální draft nenalezen."); return; }
      const draft = JSON.parse(raw) as {
        savedAt: string; themeId: string;
        editableBoard: BoardConfig; editableRacers: RacerConfig[];
        editableCards?: { chance: GameCard[]; finance: GameCard[] };
        editableFieldTextures: Record<string, string>; editableRacerImages: Record<string, string>;
      };
      const newBoard    = draft.editableBoard;
      const newRacers   = withSlotIndexes(draft.editableRacers   ?? []);
      const newCards    = draft.editableCards    ?? { chance: [], finance: [] };
      const newTextures = draft.editableFieldTextures ?? {};
      const newImages   = draft.editableRacerImages   ?? {};
      setEditableBoard(newBoard);
      setEditableRacers(newRacers);
      setEditableCards(newCards);
      setEditableFieldTextures(newTextures);
      setEditableRacerImages(newImages);
      setSelectedFieldIndex(null);
      const snap = JSON.stringify({ editableBoard: newBoard, editableRacers: newRacers, editableCards: newCards, editableFieldTextures: newTextures, editableRacerImages: newImages });
      setSavedSnapshot(snap);
      const savedDate = new Date(draft.savedAt);
      setLastSavedAt(savedDate);
      notify("success", `Draft načten — uložen ${savedDate.toLocaleString("cs", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}`);
    } catch {
      notify("error", "Draft je poškozený nebo nelze načíst.");
    }
  }

  function resetDraft() {
    if (!boardPreviewManifest) return;
    if (!window.confirm("Resetovat board editor? Ztratíš všechny neuložené změny a vrátíš se na výchozí stav manifestu.")) return;
    const newBoard    = { ...SMALL_BOARD, fields: SMALL_BOARD.fields.map((f) => ({ ...f })) };
    const newRacers   = withSlotIndexes(boardPreviewManifest.racers.map((r) => ({ ...r })));
    const newCards    = boardPreviewManifest.cards
      ? { chance: [...boardPreviewManifest.cards.chance], finance: [...boardPreviewManifest.cards.finance] }
      : { chance: [], finance: [] };
    const newTextures = boardPreviewManifest.assets?.fieldTextures ? { ...boardPreviewManifest.assets.fieldTextures } : {};
    const newImages   = boardPreviewManifest.assets?.racerImages   ? { ...boardPreviewManifest.assets.racerImages }   : {};
    setEditableBoard(newBoard);
    setEditableRacers(newRacers);
    setEditableCards(newCards);
    setEditableFieldTextures(newTextures);
    setEditableRacerImages(newImages);
    setSelectedFieldIndex(null);
    const snap = JSON.stringify({ editableBoard: newBoard, editableRacers: newRacers, editableCards: newCards, editableFieldTextures: newTextures, editableRacerImages: newImages });
    setSavedSnapshot(snap);
    setLastSavedAt(null);
    notify("info", "Editor resetován na výchozí stav manifestu.");
  }

  async function handleSaveToFiles() {
    if (!liveManifest) return;
    setSavingToFiles(true);
    try {
      const res = await fetch("/api/dev/save-editor-state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          themeId: liveManifest.meta.id,
          editableBoard,
          editableRacers,
          editableCards,
        }),
      });
      const data = await res.json() as { ok: boolean; written?: string[]; error?: string };
      if (data.ok) {
        notify("success", `Zapsáno do souborů: ${data.written?.join(", ") ?? "soubory"}`);
        // Mark as clean — files are now in sync
        const snap = JSON.stringify({ editableBoard, editableRacers, editableCards, editableFieldTextures, editableRacerImages });
        setSavedSnapshot(snap);
        setLastSavedAt(new Date());
      } else {
        notify("error", `Chyba při zápisu: ${data.error ?? "Neznámá chyba"}`);
      }
    } catch (err) {
      notify("error", `Síťová chyba: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSavingToFiles(false);
    }
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

  async function handleSetPublic(isPublic: boolean) {
    if (!currentId) return;
    const result = await setPublicAction(currentId, isPublic);
    if (!result.ok) { notify("error", result.error); return; }
    setThemeList(prev => prev.map(t => t.id === currentId ? { ...t, isPublic } : t));
    notify("success", isPublic ? `"${currentId}" zveřejněno — viditelné v pikeru.` : `"${currentId}" skryto z pikeru.`);
  }

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
              <button onClick={handleBoardPreview}
                className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white hover:bg-violet-700">
                Board
              </button>
              <button onClick={handleDuplicate}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                Duplikovat
              </button>

              <div className="flex-1" />

              {/* Save — TODO: dočasně povoleno i pro built-in; před finálním nasazením vrátit blokaci pro currentSource === "built-in" */}
              <button onClick={handleSave} disabled={saving}
                className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
                {saving ? "Ukládám…" : "Uložit"}
              </button>

              <button onClick={handleSaveAsNew} disabled={saving}
                className="rounded-lg border border-emerald-400 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50">
                Uložit jako nové
              </button>
            </div>

            {/* TODO: dočasně skryto — varování "built-in nelze přepsat"; vrátit spolu s blokací tlačítka Uložit */}
          </div>

          {/* Validation result */}
          {validation && <StatusBadge ok={validation.ok} messages={validation.messages} />}

          {/* Publish toggle — jen po úspěšné validaci a jen pro DB themes */}
          {validation?.ok && currentSource === "db" && currentId && (() => {
            const isPublic = themeList.find(t => t.id === currentId)?.isPublic ?? false;
            return (
              <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-slate-700">Viditelnost v pikeru</div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {isPublic ? "Theme je veřejné — hráči ho vidí při výběru." : "Theme je skryté — hráči ho nevidí."}
                  </div>
                </div>
                {isPublic ? (
                  <button
                    onClick={() => handleSetPublic(false)}
                    className="shrink-0 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                  >
                    Skrýt
                  </button>
                ) : (
                  <button
                    onClick={() => handleSetPublic(true)}
                    className="shrink-0 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                  >
                    Zveřejnit
                  </button>
                )}
              </div>
            );
          })()}

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

          {/* Board Preview + Field Editor */}
          {showBoardPreview && boardPreviewManifest && (
            <div className="space-y-4">

              {/* Header */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-700">Board Editor</span>
                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-slate-400">
                    preset: <code className="font-mono">{editableBoard.id}</code> · {editableBoard.fieldCount} polí
                    {selectedFieldIndex !== null && (
                      <span className="ml-2 text-indigo-500">· pole #{selectedFieldIndex} vybráno</span>
                    )}
                  </span>
                  <button
                    onClick={() => { setShowBoardPreview(false); setSelectedFieldIndex(null); }}
                    className="text-xs text-slate-400 hover:text-slate-600 underline"
                  >
                    Zavřít
                  </button>
                </div>
              </div>

              {/* Draft status bar */}
              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5">
                {/* Status badge */}
                <div className={`flex items-center gap-1.5 text-xs font-medium ${
                  isDirty ? "text-amber-600" : lastSavedAt ? "text-emerald-600" : "text-slate-400"
                }`}>
                  <div className={`h-2 w-2 rounded-full shrink-0 ${
                    isDirty ? "bg-amber-400" : lastSavedAt ? "bg-emerald-400" : "bg-slate-300"
                  }`} />
                  {isDirty
                    ? "Neuložené změny"
                    : lastSavedAt
                      ? `Uloženo lokálně — ${lastSavedAt.toLocaleTimeString("cs", { hour: "2-digit", minute: "2-digit" })}`
                      : "Čistý stav"}
                </div>

                <div className="flex-1" />

                {/* Draft actions */}
                <button
                  onClick={saveDraft}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    isDirty
                      ? "bg-emerald-600 text-white hover:bg-emerald-700"
                      : "border border-slate-200 text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  💾 Uložit draft
                </button>
                {hasDraft && (
                  <button
                    onClick={loadDraft}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    📂 Načíst draft
                  </button>
                )}
                <button
                  onClick={resetDraft}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors"
                  title="Resetovat na výchozí stav manifestu"
                >
                  ↺ Reset
                </button>
                <button
                  onClick={handleSaveToFiles}
                  disabled={savingToFiles}
                  className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                  title="Zapsat board, raceře a decky přímo do zdrojových souborů (jen v dev)"
                >
                  {savingToFiles ? "Zapisuji…" : "💾 Uložit do souborů"}
                </button>
              </div>

              {/* Board + panel vedle sebe na větších obrazovkách, pod sebou na malých */}
              <div className="flex flex-col xl:flex-row gap-6 items-start">

                {/* Board preview */}
                <div className="w-full xl:w-auto xl:flex-1 xl:max-w-[560px]">
                  {liveManifest && (
                    <BoardEditorPreview
                      board={editableBoard}
                      manifest={liveManifest}
                      assetVersion={previewAssetVersion}
                      selectedIndex={selectedFieldIndex}
                      onFieldClick={(field) => setSelectedFieldIndex(field.index)}
                    />
                  )}
                </div>

                {/* Field editor — zobrazí se po kliknutí na pole */}
                <div className="w-full xl:w-[380px] xl:shrink-0 space-y-4">
                  {selectedFieldIndex !== null ? (() => {
                    const fieldConfig = editableBoard.fields.find(
                      (f) => f.index === selectedFieldIndex,
                    );
                    if (!fieldConfig) return null;
                    return (
                      <>
                        <FieldEditorPanel
                          field={fieldConfig}
                          onChange={(updated: BoardFieldConfig) =>
                            setEditableBoard((prev) => ({
                              ...prev,
                              fields: prev.fields.map((f) =>
                                f.index === selectedFieldIndex ? updated : f,
                              ),
                            }))
                          }
                          assetSection={currentAssetSection}
                        />
                        {/* Racer editor — jen pro racer pole */}
                        {currentSelectedRacer && (
                          <RacerEditorPanel
                            racer={currentSelectedRacer}
                            onChange={(updated: RacerConfig) =>
                              setEditableRacers((prev) =>
                                prev.map((r) => (r.id === updated.id ? updated : r)),
                              )
                            }
                          />
                        )}
                      </>
                    );
                  })() : (
                    <div className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-400">
                      <div className="text-2xl mb-2">👈</div>
                      Klikni na pole pro editaci
                    </div>
                  )}
                </div>
              </div>

              {/* Roster závodníků — správa katalogu, počet, nesoulad */}
              <RacerRosterPanel
                racers={editableRacers}
                racerFieldCount={editableBoard.fields.filter((f) => f.type === "racer").length}
                onChange={setEditableRacers}
                isBuiltInTheme={currentSource === "built-in"}
              />

              {/* Deck editor — Náhoda + Finance */}
              <DeckEditorPanel
                chanceDeck={editableCards.chance}
                financeDeck={editableCards.finance}
                onChangeChance={(cards) => setEditableCards((prev) => ({ ...prev, chance: cards }))}
                onChangeFinance={(cards) => setEditableCards((prev) => ({ ...prev, finance: cards }))}
              />

              {/* Návod: legendární racer z karty Náhoda */}
              <LegendaryRacerGuide />

              {/* Export — board config + asset mapping */}
              {liveManifest && (
                <EditorExportPanel
                  editableBoard={editableBoard}
                  liveManifest={liveManifest}
                  editableFieldTextures={editableFieldTextures}
                  editableRacerImages={editableRacerImages}
                  editableRacers={editableRacers}
                  editableCards={editableCards}
                />
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
