"use client";

/**
 * RacerAdminTool — standalone správa závodníků pro dané theme.
 *
 * Dostupné na /admin/themes/dev/[themeId]/racers.
 * Theme Builder sem odkazuje z "Editovat závodníky →" tlačítka.
 *
 * Podporuje:
 *   Built-in themes: add/delete/reorder/edit + "Uložit do souborů" (patchRacersInFileAction)
 *   DB themes:       add/delete/reorder/edit + "Uložit do DB" (saveThemeAction)
 *
 * Slot assignment zde není k dispozici — boardový kontext je v Theme Builderu.
 */

import React from "react";
import type { RacerConfig } from "@/lib/themes";
import type { ThemeManifest } from "@/lib/themes/manifest";
import {
  loadThemeAction,
  saveThemeAction,
  patchRacersInFileAction,
} from "@/app/admin/themes/dev/actions";
import RacerRosterPanel from "./editor/RacerRosterPanel";

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  themeId:    string;
  /** True pokud je theme vestavěné — save jde do .ts souboru, jinak do DB. */
  isBuiltIn:  boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function withSlotIndexes(racers: RacerConfig[]): RacerConfig[] {
  return racers.map((r, i) => (r.slotIndex !== undefined ? r : { ...r, slotIndex: i }));
}

const VALID_ID_RE = /^[a-z0-9][a-z0-9_-]*$/;

/**
 * validateRacers — vrátí seznam chybových hlášení pro zjevně rozbitá data.
 * Prázdné pole = vše OK.
 */
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

    if (!r.name?.trim()) {
      errors.push(`${lbl}: prázdné jméno`);
    }

    if (!Number.isInteger(r.speed) || r.speed < 1 || r.speed > 10) {
      errors.push(`${lbl}: speed musí být 1–10 (je ${r.speed})`);
    }

    if (r.price < 0) {
      errors.push(`${lbl}: cena nesmí být záporná (je ${r.price})`);
    }

    if (r.maxStamina !== undefined && (r.maxStamina < 0 || r.maxStamina > 100)) {
      errors.push(`${lbl}: max stamina musí být 0–100 (je ${r.maxStamina})`);
    }
  }

  return errors;
}

// ─── Komponenta ───────────────────────────────────────────────────────────────

export default function RacerAdminTool({ themeId, isBuiltIn }: Props) {
  const [manifest, setManifest]   = React.useState<ThemeManifest | null>(null);
  const [racers, setRacers]       = React.useState<RacerConfig[]>([]);
  const [loading, setLoading]     = React.useState(true);
  const [error, setError]         = React.useState<string | null>(null);
  const [saving, setSaving]       = React.useState(false);
  const [notif, setNotif]         = React.useState<{ ok: boolean; msg: React.ReactNode } | null>(null);

  // ── Load ──────────────────────────────────────────────────────────────────

  React.useEffect(() => {
    loadThemeAction(themeId).then((result) => {
      if ("error" in result) {
        setError(result.error);
      } else {
        setManifest(result);
        setRacers(withSlotIndexes(result.racers ?? []));
      }
      setLoading(false);
    });
  }, [themeId]);

  // ── Save ──────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!manifest) return;

    // Validace před save — blokuje uložení rozbitých dat
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

    let result: { ok: true; written?: string[] } | { ok: false; error: string };

    if (isBuiltIn) {
      // Built-in: patch zdrojový .ts soubor (vyžaduje commit)
      result = await patchRacersInFileAction(themeId, racers);
    } else {
      // DB: uložit celý manifest s novými racery
      const updated: ThemeManifest = { ...manifest, racers };
      result = await saveThemeAction(updated);
    }

    setSaving(false);

    if (result.ok) {
      setManifest((prev) => (prev ? { ...prev, racers } : prev));
      setNotif({
        ok:  true,
        msg: isBuiltIn
          ? `Zapsáno do lib/themes/${themeId}.ts — nezapomeň commitnout a pushнout.`
          : "Závodníci uloženi do DB.",
      });
    } else {
      setNotif({ ok: false, msg: (result as { ok: false; error: string }).error });
    }
    setTimeout(() => setNotif(null), 5000);
  }

  // ── Loading / error states ─────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-sm text-slate-500">Načítám závodníky…</div>
      </div>
    );
  }

  if (error || !manifest) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md space-y-3 text-center">
          <div className="text-4xl">⚠️</div>
          <div className="font-semibold text-red-700">Chyba načítání theme</div>
          <div className="text-sm text-slate-600">{error ?? "Theme nenalezeno."}</div>
          <a
            href={`/admin/themes/dev?openTheme=${encodeURIComponent(themeId)}`}
            className="text-xs text-indigo-600 hover:underline"
          >
            ← Zpět do Theme Builderu
          </a>
        </div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50">

      {/* Top bar */}
      <div className="border-b border-slate-200 bg-white px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <a
            href={`/admin/themes/dev?openTheme=${encodeURIComponent(themeId)}`}
            className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
          >
            ← Theme Builder
          </a>
          <span className="text-slate-300">·</span>
          <span className="font-semibold text-slate-800">Racer Admin</span>
          <code className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-600">
            {themeId}
          </code>
          {isBuiltIn && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
              built-in · změny vyžadují commit
            </span>
          )}
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-40 transition-colors"
        >
          {saving
            ? "Ukládám…"
            : isBuiltIn
              ? "💾 Uložit do souborů"
              : "💾 Uložit do DB"
          }
        </button>
      </div>

      {/* Notification */}
      {notif && (
        <div className={`mx-5 mt-4 rounded-xl border px-4 py-3 text-sm flex items-start justify-between gap-3 ${
          notif.ok
            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
            : "border-red-200 bg-red-50 text-red-800"
        }`}>
          <span>{notif.msg}</span>
          <button
            onClick={() => setNotif(null)}
            className="shrink-0 text-xs opacity-60 hover:opacity-100"
          >
            ✕
          </button>
        </div>
      )}

      {/* Content */}
      <div className="p-5 max-w-2xl space-y-3">
        <div className="text-xs text-slate-400">
          {manifest.meta.name} · v{manifest.meta.version} ·{" "}
          {racers.length} závodník{racers.length === 1 ? "" : "ů"}
          {" · "}
          <span className="text-slate-300">slot assignment není k dispozici bez kontextu boardu</span>
        </div>

        {/* Plná editace katalogu — bez slot assignment (racerFieldCount neposíláme) */}
        <RacerRosterPanel
          racers={racers}
          onChange={setRacers}
          isBuiltInTheme={false}
        />
      </div>

    </div>
  );
}
