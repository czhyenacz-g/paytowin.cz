"use client";

/**
 * FieldEditorPanel — editor jednoho pole herní desky.
 *
 * Zobrazí se po kliknutí na pole v BoardEditorPreview.
 * Změny se šíří nahoru přes onChange — panel sám nic neukládá.
 *
 * Vrstvy:
 *   Formulář — přívětivé inputy pro label, emoji, type, amount
 *   JSON      — raw editor celého BoardFieldConfig objektu
 *   Assets    — vždy viditelná sekce s asset/texture mappingem pro dané pole
 *
 * Budoucí fáze:
 *   - upload obrázku přímo z asset sekce
 */

import React from "react";
import type { BoardFieldConfig, BoardFieldType } from "@/lib/board/types";

// ─── AssetSection config ──────────────────────────────────────────────────────

/**
 * AssetSectionConfig — informace o asset vrstvě pro jedno pole.
 *
 * Počítá ThemeDevTool z liveManifest + editableTextures/Images.
 * FieldEditorPanel jen zobrazí a předá změny nahoru přes onOverrideChange.
 */
export interface AssetSectionConfig {
  /** Asset klíč dle THEME_ASSETS, např. "fieldGain". null = neznámý typ. */
  assetKey: string | null;
  /** Kanonický název souboru, např. "field-gain.webp" nebo "racer-divoka_ruze.webp" */
  canonicalFile: string | null;
  /** Aktuálně resolved cesta (override ? override : canonical path) */
  resolvedPath: string | null;
  /** Momentální override z editovatelného manifestu. undefined = není nastaven. */
  override: string | undefined;
  /**
   * Voláno při změně override.
   * undefined = odeber override, použij canonical fallback.
   */
  onOverrideChange: (override: string | undefined) => void;
  /** Pro racer pole: id závodníka pro zobrazení v UI */
  racerId?: string;
  /**
   * Lokální upload pipeline — volitelné, jen pro dev/editor use.
   * Pokud undefined, upload sekce se nezobrazí.
   * Fáze 1: jen pro field type assety (ne racer assety).
   */
  uploadConfig?: {
    /** ID tématu, např. "horse-day" — určuje cílovou složku */
    themeId: string;
    /** Typ pole, např. "coins_gain" — určuje canonical filename pro field assety */
    fieldType?: string;
    /** ID závodníka, např. "divoka_ruze" — určuje canonical filename pro racer assety */
    racerId?: string;
    /** Voláno po úspěšném uploadu s WebP (nebo PNG fallback) cestou */
    onUploaded: (webpPath: string) => void;
  };
}

// ─── Konstanty ────────────────────────────────────────────────────────────────

const FIELD_TYPES: BoardFieldType[] = [
  "start",
  "coins_gain",
  "coins_lose",
  "gamble",
  "racer",
  "neutral",
  "chance",
  "finance",
  "mafia",
];

const FIELD_TYPE_LABELS: Record<BoardFieldType, string> = {
  start:      "START — začátek kola",
  coins_gain: "Zisk coinů",
  coins_lose: "Ztráta coinů",
  gamble:     "Hazard",
  racer:      "Závodník (racer slot)",
  neutral:    "Neutrální",
  chance:     "Osud (karta)",
  finance:    "Finance (karta)",
  mafia:      "Mafie (karta)",
};

/** Typy polí kde amount dává smysl */
const AMOUNT_TYPES: BoardFieldType[] = ["start", "coins_gain", "coins_lose"];

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  field: BoardFieldConfig;
  /** Voláno okamžitě při každé změně. Parent drží stav. */
  onChange: (updated: BoardFieldConfig) => void;
  /** Asset vrstva — computed ThemeDevToolem. Pokud undefined, sekce se nezobrazí. */
  assetSection?: AssetSectionConfig;
}

type Tab = "form" | "json";

// ─── Komponenta ───────────────────────────────────────────────────────────────

export default function FieldEditorPanel({ field, onChange, assetSection }: Props) {
  const [tab, setTab] = React.useState<Tab>("form");
  const [rawJson, setRawJson] = React.useState(() => JSON.stringify(field, null, 2));
  const [jsonError, setJsonError] = React.useState<string | null>(null);

  // Sync rawJson při přepnutí na nové pole (nebo změně zvenčí)
  // Reaguje na změnu index — každé pole má unikátní index
  React.useEffect(() => {
    setRawJson(JSON.stringify(field, null, 2));
    setJsonError(null);
    setTab("form"); // reset na form tab při výběru nového pole
  }, [field.index]); // eslint-disable-line react-hooks/exhaustive-deps
  // ^ záměrně pouze field.index — nechceme přepisovat rawJson při každé dílčí změně z formu

  // Sync rawJson při přepnutí na JSON tab (aby odrážel aktuální stav formu)
  function handleTabSwitch(next: Tab) {
    if (next === "json") {
      setRawJson(JSON.stringify(field, null, 2));
      setJsonError(null);
    }
    setTab(next);
  }

  function handleFormChange(patch: Partial<BoardFieldConfig>) {
    onChange({ ...field, ...patch });
  }

  function handleJsonApply() {
    try {
      const parsed = JSON.parse(rawJson) as BoardFieldConfig;

      // Bezpečnostní kontroly — index musí zůstat stejný
      if (typeof parsed.index !== "number") {
        setJsonError("index musí být číslo");
        return;
      }
      if (parsed.index !== field.index) {
        setJsonError(`index musí zůstat ${field.index} — nelze přesunout pole`);
        return;
      }
      if (!FIELD_TYPES.includes(parsed.type)) {
        setJsonError(`neplatný type: "${parsed.type}" — povolené: ${FIELD_TYPES.join(", ")}`);
        return;
      }
      if (typeof parsed.label !== "string" || !parsed.label.trim()) {
        setJsonError("label nesmí být prázdný string");
        return;
      }
      if (typeof parsed.emoji !== "string") {
        setJsonError("emoji musí být string");
        return;
      }
      if (parsed.amount !== undefined && typeof parsed.amount !== "number") {
        setJsonError("amount musí být číslo nebo undefined");
        return;
      }

      setJsonError(null);
      onChange(parsed);
    } catch (e) {
      setJsonError("JSON chyba: " + (e instanceof Error ? e.message : String(e)));
    }
  }

  const amountRelevant = AMOUNT_TYPES.includes(field.type);

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2.5">
        <span className="text-xl leading-none">{field.emoji}</span>
        <span className="font-semibold text-slate-700 text-sm">{field.label}</span>
        <span className="font-mono text-xs text-slate-400">
          #{field.index} · {field.type}
        </span>

        {/* Tab switcher */}
        <div className="ml-auto flex rounded-lg border border-slate-200 bg-white overflow-hidden text-xs">
          <button
            onClick={() => handleTabSwitch("form")}
            className={`px-3 py-1.5 font-medium transition-colors ${
              tab === "form" ? "bg-slate-800 text-white" : "text-slate-500 hover:bg-slate-50"
            }`}
          >
            Formulář
          </button>
          <button
            onClick={() => handleTabSwitch("json")}
            className={`px-3 py-1.5 font-medium transition-colors border-l border-slate-200 ${
              tab === "json" ? "bg-slate-800 text-white" : "text-slate-500 hover:bg-slate-50"
            }`}
          >
            JSON
          </button>
        </div>
      </div>

      <div className="p-4">

        {/* ── Formulář ── */}
        {tab === "form" && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">

              {/* Label */}
              <div className="col-span-2 space-y-1">
                <label className="block text-xs font-medium text-slate-500">Label</label>
                <input
                  type="text"
                  value={field.label}
                  onChange={(e) => handleFormChange({ label: e.target.value })}
                  placeholder="Název pole"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>

              {/* Emoji */}
              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-500">Emoji</label>
                <input
                  type="text"
                  value={field.emoji}
                  onChange={(e) => handleFormChange({ emoji: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>

              {/* Type */}
              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-500">Type</label>
                <select
                  value={field.type}
                  onChange={(e) => handleFormChange({ type: e.target.value as BoardFieldType })}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                >
                  {FIELD_TYPES.map((t) => (
                    <option key={t} value={t}>{FIELD_TYPE_LABELS[t]}</option>
                  ))}
                </select>
              </div>

              {/* Amount — jen pro relevantní typy polí */}
              {amountRelevant && (
                <div className="col-span-2 space-y-1">
                  <label className="block text-xs font-medium text-slate-500">
                    Amount (coins)
                    {field.type === "coins_lose" && (
                      <span className="ml-1 text-red-500">— záporné číslo (např. −60)</span>
                    )}
                    {field.type === "coins_gain" && (
                      <span className="ml-1 text-emerald-600">— kladné číslo (např. 100)</span>
                    )}
                    {field.type === "start" && (
                      <span className="ml-1 text-slate-400">— start bonus (např. 200)</span>
                    )}
                  </label>
                  <input
                    type="number"
                    value={field.amount ?? ""}
                    onChange={(e) =>
                      handleFormChange({
                        amount: e.target.value === "" ? undefined : parseInt(e.target.value, 10),
                      })
                    }
                    placeholder={
                      field.type === "coins_lose" ? "-60" : field.type === "start" ? "200" : "100"
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                </div>
              )}
            </div>

            {/* Flavor text — volitelné pro všechny typy polí */}
            <div className="col-span-2 space-y-1">
              <label className="block text-xs font-medium text-slate-500">
                Flavor text
                <span className="ml-1 font-normal text-slate-400">— zobrazí se při hoveru jako detail karty</span>
              </label>
              <textarea
                value={field.flavorText ?? ""}
                onChange={(e) =>
                  handleFormChange({ flavorText: e.target.value || undefined })
                }
                rows={2}
                placeholder="Toto místo skrývá příběh…"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>

            {/* Index — pouze info, nelze měnit */}
            <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-500">
              <span className="font-mono font-medium">index: {field.index}</span>
              <span className="mx-2 text-slate-300">·</span>
              pozice pole na desce — read-only
            </div>
          </div>
        )}

        {/* ── JSON editor ── */}
        {tab === "json" && (
          <div className="space-y-2">
            <textarea
              value={rawJson}
              onChange={(e) => {
                setRawJson(e.target.value);
                setJsonError(null);
              }}
              spellCheck={false}
              rows={10}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 text-slate-100 px-3 py-2 font-mono text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-y"
            />

            {jsonError && (
              <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700 font-mono">
                {jsonError}
              </div>
            )}

            <div className="flex items-center gap-2">
              <button
                onClick={handleJsonApply}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                Aplikovat JSON
              </button>
              <button
                onClick={() => {
                  setRawJson(JSON.stringify(field, null, 2));
                  setJsonError(null);
                }}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Reset
              </button>
              <span className="ml-auto text-xs text-slate-400">
                index musí zůstat {field.index}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ── Asset sekce — vždy viditelná, nezávislá na tabu ── */}
      {assetSection && <AssetSection section={assetSection} fieldType={field.type} />}
    </div>
  );
}

// ─── Image resize helper (Canvas API, žádné závislosti) ──────────────────────

/**
 * resizeImage — client-side resize přes Canvas API.
 *
 * Vrací PNG blob a WebP blob (v Chrome/Edge nativní WebP; v ostatních prohlížečích
 * WebP slot dostane PNG-encoded data — funkčně i vizuálně OK pro dev tooling).
 *
 * maxDim: nejdelší strana výstupu v pixelech. Menší obrázky se nezvětšují.
 */
function resizeImage(
  file: File,
  maxDim: number,
): Promise<{ pngBlob: Blob; webpBlob: Blob; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.round(img.width  * scale);
      const h = Math.round(img.height * scale);

      const canvas = document.createElement("canvas");
      canvas.width  = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("Canvas 2D context není dostupný.")); return; }
      ctx.drawImage(img, 0, 0, w, h);

      canvas.toBlob((pngBlob) => {
        if (!pngBlob) { reject(new Error("Konverze na PNG selhala.")); return; }
        // WebP — Chrome/Edge vráti WebP, ostatní prohlížeče null → fallback na PNG
        canvas.toBlob(
          (webpBlob) => resolve({ pngBlob, webpBlob: webpBlob ?? pngBlob, width: w, height: h }),
          "image/webp",
          0.88,
        );
      }, "image/png");
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Obrázek nelze načíst."));
    };
    img.src = url;
  });
}

// ─── AssetSection subkomponenta ───────────────────────────────────────────────

type UploadState =
  | { status: "idle" }
  | { status: "processing" }
  | { status: "uploading" }
  | { status: "success"; webpPath: string; width: number; height: number }
  | { status: "error"; message: string };

/** Max. nejdelší strana výstupního assetu v pixelech */
const ASSET_MAX_DIM = 800;

function AssetSection({
  section,
  fieldType,
}: {
  section: AssetSectionConfig;
  fieldType: string;
}) {
  const [imgOk, setImgOk] = React.useState(false);
  const [overrideInput, setOverrideInput] = React.useState(section.override ?? "");
  const [uploadState, setUploadState] = React.useState<UploadState>({ status: "idle" });
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Sync input + reset upload state při výběru nového pole
  React.useEffect(() => {
    setOverrideInput(section.override ?? "");
    setImgOk(false);
    setUploadState({ status: "idle" });
  }, [section.assetKey, section.racerId]); // eslint-disable-line react-hooks/exhaustive-deps

  const isOverrideActive = Boolean(section.override);
  const isUsingFallback  = !section.resolvedPath;

  function handleApplyOverride() {
    const trimmed = overrideInput.trim();
    section.onOverrideChange(trimmed || undefined);
  }

  function handleClearOverride() {
    setOverrideInput("");
    section.onOverrideChange(undefined);
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !section.uploadConfig) return;
    // Reset input tak, aby šlo znovu vybrat stejný soubor
    if (fileInputRef.current) fileInputRef.current.value = "";

    const { themeId, fieldType: ft, racerId, onUploaded } = section.uploadConfig;

    try {
      // Krok 1: resize na klientu
      setUploadState({ status: "processing" });
      const { pngBlob, webpBlob, width, height } = await resizeImage(file, ASSET_MAX_DIM);

      // Krok 2: odeslat na dev API route
      setUploadState({ status: "uploading" });
      const form = new FormData();
      form.append("themeId",   themeId);
      if (ft) form.append("fieldType", ft);
      if (racerId) form.append("racerId", racerId);
      form.append("png",  new File([pngBlob],  "upload.png",  { type: "image/png"  }));
      form.append("webp", new File([webpBlob], "upload.webp", { type: "image/webp" }));

      const res = await fetch("/api/dev/upload-field-asset", { method: "POST", body: form });
      const json = await res.json() as { ok?: boolean; error?: string; webpPath?: string; pngPath?: string };

      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }

      // Krok 3: aktualizuj local state (preview se automaticky překreslí)
      const savedPath = json.webpPath ?? json.pngPath ?? "";
      onUploaded(savedPath);

      setUploadState({ status: "success", webpPath: savedPath, width, height });
    } catch (err) {
      setUploadState({
        status: "error",
        message: err instanceof Error ? err.message : "Neznámá chyba.",
      });
    }
  }

  return (
    <div className="border-t border-slate-100 px-4 py-3 space-y-3">

      {/* ── Header ── */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
          Texture / Asset
        </span>
        {isOverrideActive && (
          <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-medium text-violet-700">
            override aktivní
          </span>
        )}
        {!isOverrideActive && !isUsingFallback && (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">
            canonical
          </span>
        )}
        {isUsingFallback && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] text-amber-700">
            fallback placeholder
          </span>
        )}
      </div>

      {/* ── Miniatura + info ── */}
      <div className="flex gap-3 items-start">
        {/* Miniatura — zobrazí se jen pokud asset fyzicky existuje */}
        <div className="relative shrink-0 h-14 w-10 rounded border border-slate-200 bg-slate-50 overflow-hidden">
          {section.resolvedPath && (
            <img
              key={section.resolvedPath}
              src={section.resolvedPath}
              alt=""
              className={`h-full w-full object-cover transition-opacity ${imgOk ? "opacity-100" : "opacity-0"}`}
              onLoad={() => setImgOk(true)}
              onError={() => setImgOk(false)}
            />
          )}
          {!imgOk && (
            <div className="absolute inset-0 flex items-center justify-center text-[16px]">🖼</div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 space-y-1 min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            {section.assetKey && (
              <span className="font-mono text-[10px] text-slate-400">{section.assetKey}</span>
            )}
            {section.racerId && (
              <span className="font-mono text-[10px] text-slate-400">racer: {section.racerId}</span>
            )}
            {section.canonicalFile && (
              <span className="font-mono text-[10px] text-slate-500 bg-slate-100 px-1 rounded">
                {section.canonicalFile}
              </span>
            )}
          </div>
          <div className="font-mono text-[10px] break-all leading-relaxed text-slate-500" title={section.resolvedPath ?? "—"}>
            {section.resolvedPath
              ? <span className={isOverrideActive ? "text-violet-600" : ""}>{section.resolvedPath}</span>
              : <span className="italic text-slate-400">— žádná cesta</span>}
          </div>
          {fieldType !== "racer" && (
            <div className="text-[10px] text-amber-600">
              Platí pro všechna pole type <code className="font-mono">{fieldType}</code> v tomto tématu
            </div>
          )}
        </div>
      </div>

      {/* ── Override input — skryto pro racer assety (obrázek patří profilu závodníka) ── */}
      {section.racerId ? (
        <div className="rounded-lg bg-indigo-50 border border-indigo-100 px-3 py-2.5 text-xs text-indigo-700 space-y-0.5">
          <div className="font-medium">Obrázek ze závodního profilu</div>
          <div className="text-indigo-500 leading-snug">
            Edituj obrázek v <strong>Racer Adminu</strong> — karta ho přebírá automaticky z profilu závodníka.
          </div>
        </div>
      ) : (
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-slate-500">
            Override cesta <span className="font-normal text-slate-400">(prázdné = canonical)</span>
          </label>
          <div className="flex gap-1.5">
            <input
              type="text"
              value={overrideInput}
              onChange={(e) => setOverrideInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleApplyOverride(); }}
              placeholder={section.canonicalFile ? `/themes/moje-theme/${section.canonicalFile}` : "/themes/..."}
              className="flex-1 min-w-0 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-300 placeholder:text-slate-400"
            />
            <button onClick={handleApplyOverride}
              className="shrink-0 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-700">
              Použít
            </button>
            {isOverrideActive && (
              <button onClick={handleClearOverride}
                className="shrink-0 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                title="Odeber override, vrátit na canonical">
                ✕
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Upload pipeline — jen pro non-racer assety ── */}
      {!section.racerId && section.uploadConfig && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500">Nahrát obrázek</span>
            <span className="text-[10px] text-slate-400">
              PNG/JPG/WebP → resize max {ASSET_MAX_DIM}px → PNG + WebP → uloží do{" "}
              <code className="font-mono">/themes/{section.uploadConfig.themeId}/</code>
            </span>
          </div>

          {/* Stav uploadu */}
          {uploadState.status === "processing" && (
            <div className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-xs text-blue-700">
              ⏳ Zpracovávám obrázek…
            </div>
          )}
          {uploadState.status === "uploading" && (
            <div className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-xs text-blue-700">
              ⬆️ Nahrávám…
            </div>
          )}
          {uploadState.status === "success" && (
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs text-emerald-700 space-y-0.5">
              <div className="font-medium">✅ Uloženo ({uploadState.width}×{uploadState.height}px)</div>
              <div className="font-mono break-all">{uploadState.webpPath}</div>
            </div>
          )}
          {uploadState.status === "error" && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
              ❌ {uploadState.message}
            </div>
          )}

          {/* Skrytý file input + viditelné tlačítko */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            onChange={handleFileSelected}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadState.status === "processing" || uploadState.status === "uploading"}
            className="w-full rounded-lg border-2 border-dashed border-slate-300 px-3 py-2.5 text-xs text-slate-500 hover:border-violet-400 hover:text-violet-600 hover:bg-violet-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploadState.status === "idle" || uploadState.status === "error" || uploadState.status === "success"
              ? "📁 Vybrat soubor (PNG / JPG / WebP)"
              : "Zpracovávám…"}
          </button>
        </div>
      )}
    </div>
  );
}
