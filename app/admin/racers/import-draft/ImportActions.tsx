"use client";

import { useState } from "react";
import {
  importRaceWorkHorsesAction,
  importPermaHorsesAction,
  type ImportRaceWorkResult,
  type ImportPermaResult,
} from "./actions";

interface ImportActionsProps {
  raceWorkCount: number;
  permaCount: number;
}

export default function ImportActions({ raceWorkCount, permaCount }: ImportActionsProps) {
  const [raceWorkResult, setRaceWorkResult] = useState<ImportRaceWorkResult | null>(null);
  const [permaResult,    setPermaResult]    = useState<ImportPermaResult    | null>(null);
  const [raceWorkLoading, setRaceWorkLoading] = useState(false);
  const [permaLoading,    setPermaLoading]    = useState(false);

  async function handleRaceWork() {
    setRaceWorkLoading(true);
    setRaceWorkResult(null);
    try {
      const result = await importRaceWorkHorsesAction();
      setRaceWorkResult(result);
    } finally {
      setRaceWorkLoading(false);
    }
  }

  async function handlePerma() {
    setPermaLoading(true);
    setPermaResult(null);
    try {
      const result = await importPermaHorsesAction();
      setPermaResult(result);
    } finally {
      setPermaLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Varování */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <strong>Pozor:</strong> Tato akce zapíše do produkční DB. Upsert — bezpečné pro opakované spuštění.
      </div>

      {/* Tlačítko 1: race/work koně */}
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
          <div className={`rounded-lg px-3 py-2 text-sm ${raceWorkResult.ok ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-800 border border-red-200"}`}>
            {raceWorkResult.ok ? (
              <>
                <p className="font-semibold">Importováno {raceWorkResult.inserted} koní.</p>
                {raceWorkResult.errors.length > 0 && (
                  <ul className="mt-1 space-y-0.5 list-disc list-inside text-red-700">
                    {raceWorkResult.errors.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                )}
              </>
            ) : (
              <p className="font-semibold">Chyba: {raceWorkResult.error}</p>
            )}
          </div>
        )}
      </div>

      {/* Tlačítko 2: perma koně */}
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
          <div className={`rounded-lg px-3 py-2 text-sm ${permaResult.ok ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-800 border border-red-200"}`}>
            {permaResult.ok ? (
              <>
                <p className="font-semibold">
                  Importováno {permaResult.templates} šablon, {permaResult.uniques} unikátů.
                </p>
                {permaResult.errors.length > 0 && (
                  <ul className="mt-1 space-y-0.5 list-disc list-inside text-red-700">
                    {permaResult.errors.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                )}
              </>
            ) : (
              <p className="font-semibold">Chyba: {permaResult.error}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
