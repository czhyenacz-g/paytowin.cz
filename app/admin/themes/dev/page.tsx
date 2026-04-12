import WithAdminAuth from "@/app/components/WithAdminAuth";
import ThemeDevTool from "@/app/components/ThemeDevTool";

export const metadata = { title: "Theme Dev Tool" };

export default function ThemeDevPage() {
  return (
    <WithAdminAuth>
      <ThemeDevTool />
    </WithAdminAuth>
  );
}
