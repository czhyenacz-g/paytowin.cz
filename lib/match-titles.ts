import type { Player } from "@/lib/types/game";
import { isBankrupt } from "@/lib/engine";

export interface MatchTitle {
  emoji: string;
  label: string;
}

/**
 * Přiřadí každému hráči právě 1 per-match titul.
 * Pure funkce — žádné side effects, žádná persistence.
 * Vyhodnocení je greedy v pevném pořadí priority; každý titul patří max jednomu hráči.
 * Tie-break: nižší index v players[] = vyšší priorita.
 */
export function computeMatchTitles(
  players: Player[],
  bustOrder: string[],
): Map<string, MatchTitle> {
  const result = new Map<string, MatchTitle>();
  const claimed = new Set<string>();

  const assign = (playerId: string, title: MatchTitle): boolean => {
    if (claimed.has(playerId)) return false;
    result.set(playerId, title);
    claimed.add(playerId);
    return true;
  };

  const active = players.filter(p => !isBankrupt(p));

  // 1. Vítěz — jediný přeživší
  if (active.length === 1) {
    assign(active[0].id, { emoji: "🏆", label: "Šampion sezóny" });
  }

  // 2. První bankrot
  if (bustOrder.length > 0) {
    assign(bustOrder[0], { emoji: "💀", label: "Průkopník pádu" });
  }

  // 3. Poslední bankrot před vítězem (≠ první bankrot)
  if (bustOrder.length > 1) {
    assign(bustOrder[bustOrder.length - 1], { emoji: "🥈", label: "Tvrdý oříšek" });
  }

  // 4. Nejvíc průchodů STARTem (tie-break: nižší index v players[])
  const byLapsDesc = [...players].sort((a, b) => {
    const d = (b.laps ?? 0) - (a.laps ?? 0);
    return d !== 0 ? d : players.indexOf(a) - players.indexOf(b);
  });
  if ((byLapsDesc[0]?.laps ?? 0) > 0) {
    assign(byLapsDesc[0].id, { emoji: "🔄", label: "Věčný běžec" });
  }

  // 5. Nejvíc závodníků na konci (tie-break: nižší index v players[])
  const byHorsesDesc = [...players].sort((a, b) => {
    const d = b.horses.length - a.horses.length;
    return d !== 0 ? d : players.indexOf(a) - players.indexOf(b);
  });
  if ((byHorsesDesc[0]?.horses.length ?? 0) > 0) {
    assign(byHorsesDesc[0].id, { emoji: "🐎", label: "Chovatel" });
  }

  // 6. Vlastní legendárního závodníka
  for (const p of players) {
    if (p.horses.some(h => h.isLegendary)) {
      if (assign(p.id, { emoji: "⚡", label: "Legendární jezdec" })) break;
    }
  }

  // 7. Přežil bez závodníka
  for (const p of active) {
    if (p.horses.length === 0) {
      if (assign(p.id, { emoji: "🚶", label: "Pěšák" })) break;
    }
  }

  // 8. Nejméně průchodů STARTem (tie-break: vyšší index v players[] — preferuj "pozdějšího" hráče)
  const byLapsAsc = [...players].sort((a, b) => {
    const d = (a.laps ?? 0) - (b.laps ?? 0);
    return d !== 0 ? d : players.indexOf(b) - players.indexOf(a);
  });
  assign(byLapsAsc[0].id, { emoji: "🐢", label: "Klidná duše" });

  // 9. Mediocre fallback
  for (const p of players) {
    assign(p.id, { emoji: "😐", label: "Mediocre" });
  }

  return result;
}
