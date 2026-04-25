import WithAdminAuth from "@/app/components/WithAdminAuth";
import ThemeDevTool from "@/app/components/ThemeDevTool";

export const metadata = { title: "Theme Dev Tool" };

export default function ThemeDevPage() {
  if (process.env.NODE_ENV !== "development") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950 text-slate-400 text-sm">
        Editor map je v přípravě
      </div>
    );
  }
  return (
    <WithAdminAuth>
      <ThemeDevTool />
    </WithAdminAuth>
  );
}
