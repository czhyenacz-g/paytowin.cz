import type { Metadata } from "next";
import Link from "next/link";
import WithAdminAuth from "@/app/components/WithAdminAuth";
import UserModerationPanel from "@/app/components/admin/UserModerationPanel";
import { getAdminUserDetailAction } from "../actions";

export const metadata: Metadata = {
  title: "Detail hráče | Admin",
};

export const dynamic = "force-dynamic";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("cs-CZ");
}

interface Props {
  params: Promise<{ id: string }>;
}

export default async function AdminUserDetailPage({ params }: Props) {
  const { id } = await params;
  const result = await getAdminUserDetailAction(id);

  return (
    <WithAdminAuth>
      <main className="min-h-screen bg-slate-50 px-4 py-8">
        <div className="mx-auto max-w-3xl space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-black text-slate-900">Detail hráče</h1>
              <p className="mt-1 font-mono text-xs text-slate-400">{id}</p>
            </div>
            <Link
              href="/admin/users"
              className="text-sm text-slate-500 underline hover:text-slate-700"
            >
              Zpět na seznam
            </Link>
          </div>

          {!result.ok ? (
            <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
              Chyba: {result.error}
            </div>
          ) : (
            <>
              {/* Identita */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="mb-3 text-base font-bold text-slate-800">Identita</h2>
                <dl className="space-y-2 text-sm">
                  <div className="flex gap-2">
                    <dt className="w-40 shrink-0 text-slate-500">E-mail</dt>
                    <dd className="text-slate-800">{result.data.email ?? "—"}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-40 shrink-0 text-slate-500">Registrace</dt>
                    <dd className="text-slate-800">{formatDate(result.data.created_at)}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-40 shrink-0 text-slate-500">Poslední přihlášení</dt>
                    <dd className="text-slate-800">{formatDate(result.data.last_sign_in_at)}</dd>
                  </div>
                </dl>
              </div>

              {/* Moderace */}
              <UserModerationPanel
                userId={result.data.id}
                moderation={result.data.moderation}
              />

              {/* Perma raceři */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="mb-3 text-base font-bold text-slate-800">
                  Perma raceři ({result.data.permaRacers.length})
                </h2>
                {result.data.permaRacers.length === 0 ? (
                  <p className="text-sm text-slate-400">Hráč nemá žádné perma racery.</p>
                ) : (
                  <ul className="divide-y divide-slate-100 text-sm">
                    {result.data.permaRacers.map((r) => (
                      <li key={r.id} className="flex items-center gap-3 py-2">
                        <span className="font-mono text-xs text-slate-400">{r.id.slice(0, 8)}…</span>
                        <span className="font-medium text-slate-700">{r.name ?? r.slug ?? "—"}</span>
                        {r.status && (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                            {r.status}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
      </main>
    </WithAdminAuth>
  );
}
