import GameBoard from "@/app/components/GameBoard";

export default async function GamePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <GameBoard gameCode={code} />;
}
