import type { Metadata } from "next";
import Link from "next/link";
import WithAdminAuth from "@/app/components/WithAdminAuth";
import { listAdminUsersAction } from "./actions";

export const metadata: Metadata = {
  title: "Uživatelé | Admin",
  description: "Přehled registrovaných hráčů a jejich moderace.",
};

export const dynamic = "force-dynamic";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("cs-CZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function shortId(id: string): string {
  return id.slice(0, 8) + "…";
}

export default async function AdminUsersPage() {
  const result = await listAdminUsersAction();

  return (
    <WithAdminAuth>
      <main className="min-h-screen bg-slate-50 px-4 py-8">
        <div className="mx-auto max-w-6xl space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-black text-slate-900">Uživatelé</h1>
              <p className="mt-1 text-sm text-slate-500">
                Registrovaní hráči, jejich raceři a moderační stav.
              </p>
            </div>
            <Link
              href="/admin"
              className="text-sm text-slate-500 underline hover:text-slate-700"
            >
              Zpět na rozcestník
            </Link>
          </div>

          {!result.ok ? (
            <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
              Chyba: {result.error}
            </div>
          ) : result.data.length === 0 ? (
            <div className="rounded-xl bg-white p-6 text-center text-sm text-slate-400">
              Zatím žádní hráči.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-3">ID</th>
                    <th className="px-4 py-3">E-mail</th>
                    <th className="px-4 py-3">Registrace</th>
                    <th className="px-4 py-3">Poslední přihlášení</th>
                    <th className="px-4 py-3">Stav</th>
                    <th className="px-4 py-3">Raceři</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {result.data.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono text-xs text-slate-400">
                        {shortId(user.id)}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {user.email ?? <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {formatDate(user.created_at)}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {formatDate(user.last_sign_in_at)}
                      </td>
                      <td className="px-4 py-3">
                        {user.moderation_status === "banned" ? (
                          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                            Zakázaný
                          </span>
                        ) : (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                            Aktivní
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {user.perma_racer_count}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/users/${user.id}`}
                          className="text-indigo-600 underline hover:text-indigo-800"
                        >
                          Detail
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-4 py-2 text-right text-xs text-slate-400">
                Celkem: {result.data.length} hráčů
              </div>
            </div>
          )}
        </div>
      </main>
    </WithAdminAuth>
  );
}
