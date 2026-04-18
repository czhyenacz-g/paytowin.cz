import WithAdminAuth from "@/app/components/WithAdminAuth";
import RacerAdminTool from "@/app/components/RacerAdminTool";
import { THEMES } from "@/lib/themes";

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
  const { themeId } = await params;
  const isBuiltIn = THEMES.some((t) => t.id === themeId);

  return (
    <WithAdminAuth>
      <RacerAdminTool themeId={themeId} isBuiltIn={isBuiltIn} />
    </WithAdminAuth>
  );
}
