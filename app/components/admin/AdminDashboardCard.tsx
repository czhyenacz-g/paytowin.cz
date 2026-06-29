import Link from "next/link";

export type AdminDashboardCardStatus = "active" | "planned" | "dev";

interface AdminDashboardCardProps {
  title: string;
  description: string;
  href: string;
  status: AdminDashboardCardStatus;
  disabled?: boolean;
}

const statusLabel: Record<AdminDashboardCardStatus, string> = {
  active: "Aktivní",
  planned: "Plánováno",
  dev: "Dev",
};

const statusClass: Record<AdminDashboardCardStatus, string> = {
  active: "bg-emerald-100 text-emerald-700",
  planned: "bg-slate-100 text-slate-500",
  dev: "bg-amber-100 text-amber-700",
};

export default function AdminDashboardCard({
  title,
  description,
  href,
  status,
  disabled = false,
}: AdminDashboardCardProps) {
  const badge = (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusClass[status]}`}>
      {statusLabel[status]}
    </span>
  );

  if (disabled) {
    return (
      <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-5 opacity-50 cursor-not-allowed">
        <div className="flex items-center justify-between gap-2">
          <span className="text-base font-semibold text-slate-700">{title}</span>
          {badge}
        </div>
        <p className="text-sm text-slate-400">{description}</p>
      </div>
    );
  }

  return (
    <Link
      href={href}
      className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-indigo-300 hover:shadow-md"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-base font-semibold text-slate-800">{title}</span>
        {badge}
      </div>
      <p className="text-sm text-slate-500">{description}</p>
    </Link>
  );
}
