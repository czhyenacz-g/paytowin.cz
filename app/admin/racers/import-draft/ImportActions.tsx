"use client";

import { useState } from "react";
import {
  importRaceWorkHorsesAction,
  importPermaHorsesAction,
  importClassicLegendHorsesAction,
  type ImportRaceWorkResult,
  type ImportPermaResult,
  type ImportClassicLegendResult,
} from "./actions";

interface ImportActionsProps {
  raceWorkCount: number;
  permaCount: number;
  classicLegendCount: number;
}

export default function ImportActions({ raceWorkCount, permaCount, classicLegendCount }: ImportActionsProps) {
  const [raceWorkResult,      setRaceWorkResult]      = useState<ImportRaceWorkResult      | null>(null);
  const [permaResult,         setPermaResult]         = useState<ImportPermaResult         | null>(null);
  const [classicLegendResult, setClassicLegendResult] = useState<ImportClassicLegendResult | null>(null);
  const [raceWorkLoading,      setRaceWorkLoading]      = useState(false);
  const [permaLoading,         setPermaLoading]         = useState(false);
  const [classicLegendLoading, setClassicLegendLoading] = useState(false);

  async function handleRaceWork() {
    setRaceWorkLoading(true);
    setRaceWorkResult(null);
    try { setRaceWorkResult(await importRaceWorkHorsesAction()); }
    finally { setRaceWorkLoading(false); }
  }

  async function handlePerma() {
    setPermaLoading(true);
    setPermaResult(null);
    try { setPermaResult(await importPermaHorsesAction()); }
    finally { setPermaLoading(false); }
  }

  async function handleClassicLegend() {
    setClassicLegendLoading(true);
    setClassicLegendResult(null);
    try { setClassicLegendResult(await importClassicLegendHorsesAction()); }
    finally { setClassicLegendLoading(false); }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <strong>Pozor:</strong> Tato akce zapíše do produkční DB. Upsert — bezpečné pro opakované spuštění.
      </div>

      {/* Race/work koně */}
      <div className="rounded-xl border border-blue-200 bg-white p-5 shadow-sm space-y-3">
        <div>
          <h3 className="font-bold text-slate-900">Import race/work koní do racers</h3>
          <p className="mt-0.5 text-sm text-slate-500">
            Zapíše {raceWorkCount} koní do tabulky <code className="font-mono text-xs bg-slate-100 px-1 rounded">racers</code> jako{" "}
            <code className="font-mono text-xs bg-slate-100 px-1 rounded">is_builtin=true</code>,{" "}
            <code className="font-mono text-xs bg-slate-100 px-1 rounded">is_public=true</code>.
          </p>
        </div>
        <button
          onClick={handleRaceWork}
          disabled={raceWorkLoading}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {raceWorkLoading ? "Importuji…" : `Import ${raceWorkCount} race/work koní do racers`}
        </button>
        {raceWorkResult && (
          <ResultBox result={raceWorkResult} kind="race/work">
            {raceWorkResult.ok && <p className="font-semibold">Importováno {raceWorkResult.inserted} koní.</p>}
          </ResultBox>
        )}
      </div>

      {/* Perma koně */}
      <div className="rounded-xl border border-purple-200 bg-white p-5 shadow-sm space-y-3">
        <div>
          <h3 className="font-bold text-slate-900">Import perma koní do katalogu</h3>
          <p className="mt-0.5 text-sm text-slate-500">
            Zapíše {permaCount} koní do{" "}
            <code className="font-mono text-xs bg-slate-100 px-1 rounded">racer_templates</code> +{" "}
            <code className="font-mono text-xs bg-slate-100 px-1 rounded">racer_uniques</code>{" "}
            (<code className="font-mono text-xs bg-slate-100 px-1 rounded">status=draft</code>,{" "}
            <code className="font-mono text-xs bg-slate-100 px-1 rounded">sale_status=hidden</code>).
          </p>
        </div>
        <button
          onClick={handlePerma}
          disabled={permaLoading}
          className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {permaLoading ? "Importuji…" : `Import ${permaCount} perma koní do katalogu`}
        </button>
        {permaResult && (
          <ResultBox result={permaResult} kind="perma">
            {permaResult.ok && (
              <p className="font-semibold">Importováno {permaResult.templates} šablon, {permaResult.uniques} unikátů.</p>
            )}
          </ResultBox>
        )}
      </div>

      {/* Classic legend koně */}
      <div className="rounded-xl border border-amber-300 bg-white p-5 shadow-sm space-y-3">
        <div>
          <h3 className="font-bold text-slate-900">Import classic legend koní do katalogu</h3>
          <p className="mt-0.5 text-sm text-slate-500">
            Zapíše {classicLegendCount} historických koní do{" "}
            <code className="font-mono text-xs bg-slate-100 px-1 rounded">racer_templates</code> +{" "}
            <code className="font-mono text-xs bg-slate-100 px-1 rounded">racer_uniques</code>{" "}
            s <code className="font-mono text-xs bg-slate-100 px-1 rounded">pool_type=classic_legend</code>,{" "}
            <code className="font-mono text-xs bg-slate-100 px-1 rounded">is_active=false</code> (skryté dokud se Historická stáj nezpustí).
          </p>
          {classicLegendCount === 0 && (
            <p className="mt-1 text-xs text-amber-700">
              Draft ještě neexistuje — vygeneruj ho na{" "}
              <a href="/admin/racers/import-review?group=classic-legend" className="underline hover:text-amber-900">
                /admin/racers/import-review?group=classic-legend
              </a>.
            </p>
          )}
        </div>
        <button
          onClick={handleClassicLegend}
          disabled={classicLegendLoading || classicLegendCount === 0}
          className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {classicLegendLoading ? "Importuji…" : `Import ${classicLegendCount} classic legend koní`}
        </button>
        {classicLegendResult && (
          <ResultBox result={classicLegendResult} kind="classic_legend">
            {classicLegendResult.ok && (
              <p className="font-semibold">Importováno {classicLegendResult.templates} šablon, {classicLegendResult.uniques} unikátů.</p>
            )}
          </ResultBox>
        )}
      </div>
    </div>
  );
}

function ResultBox({
  result,
  kind,
  children,
}: {
  result: { ok: boolean; error?: string; errors?: string[] };
  kind: string;
  children?: React.ReactNode;
}) {
  const errors = result.ok ? (result.errors ?? []) : [];
  return (
    <div className={`rounded-lg px-3 py-2 text-sm ${result.ok ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-800 border border-red-200"}`}>
      {result.ok ? (
        <>
          {children}
          {errors.length > 0 && (
            <ul className="mt-1 space-y-0.5 list-disc list-inside text-red-700">
              {errors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          )}
        </>
      ) : (
        <p className="font-semibold">Chyba: {result.error}</p>
      )}
    </div>
  );
}
