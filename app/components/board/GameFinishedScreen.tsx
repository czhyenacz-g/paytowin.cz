import type { Player } from "@/lib/types/game";
import { isBankrupt } from "@/lib/engine";
import { computeMatchTitles } from "@/lib/match-titles";
import ScoreTable from "../ScoreTable";

const BUST_LINES = [
  "Mafii se dluhy musí splácet. Bohužel jsi neměl už z čeho.",
  "Sázky nevyšly. Zůstaly jen dluhy a prázdná stáj.",
  "Věřitelé byli rychlejší než tvůj další tah.",
  "Když dojdou peníze, dojdou i přátelé.",
  "Tvůj závod skončil dřív, než ses dostal do cíle.",
];

interface GameFinishedScreenProps {
  players: Player[];
  bustOrder: string[];
  pageBackground: string;
}

export default function GameFinishedScreen({ players, bustOrder, pageBackground }: GameFinishedScreenProps) {
  const winner = players.find(p => !isBankrupt(p));
  const losers = players.filter(p => isBankrupt(p));
  const isSoloLoss = players.length === 1 && !winner;
  const matchTitles = players.length >= 2 ? computeMatchTitles(players, bustOrder) : undefined;

  const bustLine = (playerId: string) => {
    const idx = bustOrder.indexOf(playerId);
    return BUST_LINES[(idx >= 0 ? idx : 0) % BUST_LINES.length];
  };

  const sortedLosers = [...losers].sort((a, b) => {
    const ia = bustOrder.indexOf(a.id);
    const ib = bustOrder.indexOf(b.id);
    return ib - ia;
  });

  return (
    <div className={`min-h-screen ${pageBackground} flex items-center justify-center p-6`}>
      <div
        className="relative w-full max-w-md border-2 border-stone-500 shadow-2xl overflow-hidden"
        style={{ backgroundImage: "url('/gazete.webp')", backgroundSize: "cover", backgroundPosition: "top center" }}
      >
        {/* Aged-paper overlay pro čitelnost */}
        <div className="absolute inset-0 bg-[#f4efe4]/82 z-0" />

        {/* Veškerý obsah nad overlayem */}
        <div className="relative z-10">

          {/* ── Novinový masthead — text skrytý (titulek je v bg obrázku), výška zachována ── */}
          <div className="px-6 pt-5 pb-4 border-b-[3px] border-stone-500 text-center">
            <div className="invisible text-[8px] font-bold uppercase tracking-[0.32em] text-stone-500">— Mimořádné vydání —</div>
            <div className="invisible mt-1 font-serif text-[26px] font-black uppercase tracking-[0.12em] text-stone-900 leading-none">Pay to Win Gazette</div>
            <div className="invisible mt-1 text-[8px] uppercase tracking-[0.22em] text-stone-500">Nezávislé noviny ze světa dostihů · Archiv výsledků</div>
          </div>

          {isSoloLoss ? (
            /* ── Solo prohra ── */
            <div className="px-6 py-8 text-center border-b border-stone-500">
              <div className="text-5xl">💀</div>
              <div className="mt-3 text-[9px] font-bold uppercase tracking-[0.22em] text-stone-500">Tréninková zpráva</div>
              <h2 className="mt-1 font-serif text-2xl font-black text-stone-900">Zkrachoval jsi</h2>
              <p className="mt-1 text-xs italic text-stone-500">Tréninková hra skončila porážkou.</p>
            </div>
          ) : (
            /* ── Multiplayer výhra ── */
            <>
              <div className="px-6 py-5 border-b border-stone-500">
                <div className="text-[9px] font-bold uppercase tracking-[0.22em] text-stone-500">Vítěz sezóny</div>
                <h2 className="mt-1 font-serif text-[28px] font-black leading-tight text-stone-900">
                  {winner?.name ?? "—"}
                </h2>
                <p className="mt-1.5 text-xs italic text-stone-500">
                  Poslední závodník, který opustil závod bez dluhů.
                </p>
              </div>
              <div className="px-6 py-4 border-b border-stone-500">
                <div className="mb-2 text-[9px] font-bold uppercase tracking-[0.22em] text-stone-500">Konečné pořadí</div>
                <ScoreTable players={players} bustOrder={bustOrder} titles={matchTitles} />
              </div>
              {sortedLosers.length > 0 && (
                <div className="px-6 py-4 border-b border-stone-500">
                  <div className="mb-2 text-[9px] font-bold uppercase tracking-[0.22em] text-stone-500">Padlí závodníci</div>
                  <div className="space-y-1.5">
                    {sortedLosers.map(p => (
                      <div key={p.id} className="text-xs leading-snug">
                        <span className="font-bold text-stone-800">💀 {p.name} —</span>
                        <span className="italic text-stone-700"> {bustLine(p.id)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          <div className="px-6 py-4">
            <a href="/" className="block bg-stone-900 px-4 py-3 text-center text-sm font-semibold text-[#f4efe4] hover:bg-stone-700 transition">
              ← Nová hra
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
