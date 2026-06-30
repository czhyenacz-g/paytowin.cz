import WithAdminAuth from "@/app/components/WithAdminAuth";
import AdminDashboardCard from "@/app/components/admin/AdminDashboardCard";

export const metadata = {
  title: "Admin | PayToWin",
};

export default function AdminPage() {
  return (
    <WithAdminAuth>
      <main className="min-h-screen bg-slate-50 px-4 py-8">
        <div className="mx-auto max-w-3xl space-y-6">
          <div>
            <h1 className="text-3xl font-black text-slate-900">Admin rozcestník</h1>
            <p className="mt-1 text-sm text-slate-500">Správa hry PayToWin.cz / StartovníPole.cz.</p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <AdminDashboardCard
              title="Permanentní raceři"
              description="Správa perma racerů, stavů, assetů a přiřazení hráčům."
              href="/admin/racers/perma"
              status="active"
            />
            <AdminDashboardCard
              title="Uživatelé / hráči"
              description="Přehled registrovaných hráčů, jejich racerů a moderace."
              href="/admin/users"
              status="active"
            />
            <AdminDashboardCard
              title="Katalog racerů"
              description="Veřejný katalog dostupných racerů a druhů."
              href="/racers"
              status="active"
            />
            <AdminDashboardCard
              title="Import review — koně"
              description="Editace metadat importovaných obrázků koní, presety, export draft JSONu."
              href="/admin/racers/import-review"
              status="dev"
            />
            <AdminDashboardCard
              title="Import draft — koně"
              description="Read-only náhled exportovaného draft JSONu před zápisem do DB."
              href="/admin/racers/import-draft"
              status="dev"
            />
            <AdminDashboardCard
              title="Vývojové nástroje"
              description="Theme editor, debug nástroje — pouze localhost."
              href="/admin/themes/dev"
              status="dev"
            />
          </div>
        </div>
      </main>
    </WithAdminAuth>
  );
}
