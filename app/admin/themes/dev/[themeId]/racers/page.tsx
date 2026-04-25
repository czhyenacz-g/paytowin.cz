import WithAdminAuth from "@/app/components/WithAdminAuth";
import RacerAdminTool from "@/app/components/RacerAdminTool";
import { redirect } from "next/navigation";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ themeId: string }>;
}) {
  const { themeId } = await params;
  return { title: `Racer Admin · ${themeId}` };
}

export default async function RacerAdminPage({
  params,
}: {
  params: Promise<{ themeId: string }>;
}) {
  if (process.env.NODE_ENV !== "development") redirect("/");
  const { themeId } = await params;
  // isBuiltIn byl odebrán — Racer Admin čte data z globální registry, ne z theme manifestu.
  return (
    <WithAdminAuth>
      <RacerAdminTool themeId={themeId} />
    </WithAdminAuth>
  );
}
