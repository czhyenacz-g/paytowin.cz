export default function PayToWinBoardPoc() {
const TOTAL_FIELDS = 21;
const START_INDEX = 0;

const [playerCount, setPlayerCount] = React.useState(2);
const [players, setPlayers] = React.useState([
{ id: 1, name: "Hráč 1", position: 0, color: "bg-blue-500" },
{ id: 2, name: "Hráč 2", position: 0, color: "bg-green-500" },
]);
const [currentPlayerIndex, setCurrentPlayerIndex] = React.useState(0);
const [lastRoll, setLastRoll] = React.useState<number | null>(null);

React.useEffect(() => {
const colors = [
"bg-blue-500",
"bg-green-500",
"bg-yellow-500",
"bg-purple-500",
"bg-pink-500",
"bg-orange-500",
];

    setPlayers((prev) => {
      const next = Array.from({ length: playerCount }, (_, i) => ({
        id: i + 1,
        name: `Hráč ${i + 1}`,
        position: prev[i]?.position ?? 0,
        color: colors[i % colors.length],
      }));

      return next;
    });

    setCurrentPlayerIndex((prev) => Math.min(prev, Math.max(playerCount - 1, 0)));
}, [playerCount]);

const rollDice = () => {
const roll = Math.floor(Math.random() * 6) + 1;
setLastRoll(roll);

    setPlayers((prev) => {
      const updated = [...prev];
      const current = updated[currentPlayerIndex];
      updated[currentPlayerIndex] = {
        ...current,
        position: (current.position + roll) % TOTAL_FIELDS,
      };
      return updated;
    });

    setCurrentPlayerIndex((prev) => (prev + 1) % players.length);
};

const currentPlayer = players[currentPlayerIndex];

const fieldPlayers = (fieldIndex: number) =>
players.filter((player) => player.position === fieldIndex);

const fieldPositions = [
{ top: "50%", left: "8%", transform: "translate(-50%, -50%)" },
{ top: "35%", left: "10%", transform: "translate(-50%, -50%)" },
{ top: "22%", left: "15%", transform: "translate(-50%, -50%)" },
{ top: "12%", left: "24%", transform: "translate(-50%, -50%)" },
{ top: "8%", left: "38%", transform: "translate(-50%, -50%)" },
{ top: "8%", left: "50%", transform: "translate(-50%, -50%)" },
{ top: "8%", left: "62%", transform: "translate(-50%, -50%)" },
{ top: "12%", left: "76%", transform: "translate(-50%, -50%)" },
{ top: "22%", left: "85%", transform: "translate(-50%, -50%)" },
{ top: "35%", left: "90%", transform: "translate(-50%, -50%)" },
{ top: "50%", left: "92%", transform: "translate(-50%, -50%)" },
{ top: "65%", left: "90%", transform: "translate(-50%, -50%)" },
{ top: "78%", left: "85%", transform: "translate(-50%, -50%)" },
{ top: "88%", left: "76%", transform: "translate(-50%, -50%)" },
{ top: "92%", left: "62%", transform: "translate(-50%, -50%)" },
{ top: "92%", left: "50%", transform: "translate(-50%, -50%)" },
{ top: "92%", left: "38%", transform: "translate(-50%, -50%)" },
{ top: "88%", left: "24%", transform: "translate(-50%, -50%)" },
{ top: "78%", left: "15%", transform: "translate(-50%, -50%)" },
{ top: "65%", left: "10%", transform: "translate(-50%, -50%)" },
{ top: "50%", left: "16%", transform: "translate(-50%, -50%)" },
];

return (
<div className="min-h-screen bg-slate-100 p-6">
<div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
<div className="rounded-3xl bg-white p-6 shadow-lg">
<div className="mb-4 flex items-center justify-between">
<div>
<h1 className="text-3xl font-bold text-slate-800">Pay-to-Win PoC</h1>
<p className="text-sm text-slate-500">Základní deska se 21 poli, figurkami a hodem kostkou.</p>
</div>
<div className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700">
Na tahu: <span className="font-bold">{currentPlayer?.name ?? "-"}</span>
</div>
</div>

          <div className="relative mx-auto aspect-square w-full max-w-[760px] rounded-[40px] border border-slate-200 bg-emerald-50">
            {fieldPositions.map((pos, index) => {
              const isStart = index === START_INDEX;
              const playersHere = fieldPlayers(index);

              return (
                <div
                  key={index}
                  className={`absolute flex h-16 w-16 flex-col items-center justify-center rounded-2xl border-2 shadow-sm ${
                    isStart
                      ? "h-20 w-20 border-red-400 bg-red-500 text-white"
                      : "border-slate-300 bg-white text-slate-700"
                  }`}
                  style={pos}
                >
                  <div className="text-xs font-bold">{isStart ? "START" : index}</div>
                  <div className="mt-1 flex flex-wrap items-center justify-center gap-1 px-1">
                    {playersHere.map((player) => (
                      <div
                        key={player.id}
                        className={`h-3 w-3 rounded-full ${player.color} ring-1 ring-white`}
                        title={player.name}
                      />
                    ))}
                  </div>
                </div>
              );
            })}

            <div className="absolute left-1/2 top-1/2 flex h-[46%] w-[46%] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[36px] border-2 border-dashed border-slate-300 bg-slate-50 p-6 text-center">
              <div>
                <div className="text-lg font-semibold text-slate-700">Střed hrací plochy</div>
                <div className="mt-2 text-sm text-slate-500">
                  Později sem může přijít panel pro závody, info o koních, stáje, akce nebo log hry.
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-lg">
          <h2 className="text-2xl font-bold text-slate-800">Panel hry</h2>
          <div className="mt-6 space-y-6">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Počet hráčů</label>
              <input
                type="number"
                min={2}
                max={6}
                value={playerCount}
                onChange={(e) => {
                  const next = Number(e.target.value);
                  if (Number.isFinite(next)) {
                    setPlayerCount(Math.max(2, Math.min(6, next)));
                  }
                }}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none ring-0 focus:border-slate-500"
              />
            </div>

            <div className="rounded-2xl bg-slate-100 p-4">
              <div className="text-sm text-slate-500">Poslední hod</div>
              <div className="mt-1 text-4xl font-bold text-slate-800">{lastRoll ?? "-"}</div>
            </div>

            <button
              onClick={rollDice}
              disabled={players.length === 0}
              className="w-full rounded-2xl bg-slate-900 px-4 py-4 text-lg font-semibold text-white shadow transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              Hoď kostkou
            </button>

            <div>
              <div className="mb-3 text-sm font-medium text-slate-700">Seznam hráčů</div>
              <div className="space-y-3">
                {players.map((player, index) => {
                  const isCurrent = index === currentPlayerIndex;
                  return (
                    <div
                      key={player.id}
                      className={`rounded-2xl border p-4 ${
                        isCurrent
                          ? "border-slate-900 bg-slate-50"
                          : "border-slate-200 bg-white"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className={`h-4 w-4 rounded-full ${player.color}`} />
                          <div>
                            <div className="font-semibold text-slate-800">{player.name}</div>
                            <div className="text-sm text-slate-500">Pozice figurky: pole {player.position === 0 ? "START" : player.position}</div>
                          </div>
                        </div>
                        {isCurrent && (
                          <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
                            Na tahu
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
);
}
