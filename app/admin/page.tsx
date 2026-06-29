import AdminAuth from "@/app/components/AdminAuth";
import { requireAdmin } from "@/lib/auth/require-admin";

export default async function AdminPage() {
  await requireAdmin();
  return <AdminAuth />;
}
