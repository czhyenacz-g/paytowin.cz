"use client";

import type { Player } from "@/lib/types/game";
import { isBankrupt } from "@/lib/engine";
import type { MatchTitle } from "@/lib/match-titles";

export interface ScoreEntry {
  id: string;
  name: string;
  coins: number;
  isBankrupt: boolean;
  /** 0-based index in bustOrder; undefined = not in bust list (legacy/active). */
  bustRank?: number;
}

interface Props {
  players: Player[];
  /** Player IDs in order they went bankrupt. First = earliest bust (lowest rank). */
  bustOrder: string[];
  className?: string;
  /** Per-match tituly — pokud přítomno, zobrazí se jako subtitle pod jménem. */
  titles?: Map<string, MatchTitle>;
}

/**
 * Shared score table — dočasný ranking model:
 *   Aktivní hráči nad zkrachovalými, řazeni podle coins desc.
 *   Zkrachovalí pod aktivními, řazeni dle pořadí krachu desc (pozdější = výše).
 *
 * Navrženo pro znovupoužití: průběžný score popup i finální výsledková obrazovka.
 */
export default function ScoreTable({ players, bustOrder, className = "", titles }: Props) {
  const entries: ScoreEntry[] = players.map(p => ({
    id: p.id,
    name: p.name,
    coins: p.coins,
    isBankrupt: isBankrupt(p),
    bustRank: bustOrder.indexOf(p.id) >= 0 ? bustOrder.indexOf(p.id) : undefined,
  }));

  const sorted = [...entries].sort((a, b) => {
    if (!a.isBankrupt && !b.isBankrupt) return b.coins - a.coins;
    if (!a.isBankrupt) return -1;
    if (!b.isBankrupt) return 1;
    // Both bankrupt: later bust = higher rank (higher bustRank index = busted later)
    const ra = a.bustRank ?? -1;
    const rb = b.bustRank ?? -1;
    return rb - ra;
  });

  return (
    <table className={`w-full text-left text-sm ${className}`}>
      <tbody>
        {sorted.map((entry, i) => (
          <tr key={entry.id} className={i < sorted.length - 1 ? "border-b border-slate-100" : ""}>
            <td className="w-6 py-1.5 pr-2 text-center text-xs font-bold text-slate-400 tabular-nums">
              {i + 1}.
            </td>
            <td className="py-1.5 pr-1 max-w-[140px]">
              <div className="font-medium text-slate-800 truncate">{entry.name}</div>
              {titles?.get(entry.id) && (
                <div className="text-[10px] text-stone-500 truncate">
                  {titles.get(entry.id)!.emoji} {titles.get(entry.id)!.label}
                </div>
              )}
            </td>
            <td className="py-1.5 text-right tabular-nums">
              {entry.isBankrupt ? (
                <span className="text-xs text-red-400 font-medium">zkrachoval</span>
              ) : (
                <span className="font-semibold text-emerald-600">{entry.coins} 💰</span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
