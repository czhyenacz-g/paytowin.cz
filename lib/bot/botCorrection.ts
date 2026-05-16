import type { Player } from "@/lib/types/game";
import type { Field } from "@/lib/engine";
import { playerOwnsRacer, ROLL_CORRECTION_COST } from "@/lib/engine";

/**
 * Agresivita bota při výběru korekce tahu.
 *
 * safe       — korekci téměř nepoužívá (~10 %)
 * normal     — zváží korekci v ~50 % tahů
 * aggressive — zváží korekci v ~75 % tahů
 *
 * Budoucí rozšíření: napojit na bot personality config z DB.
 */
export type AggressionMode = "safe" | "normal" | "aggressive";

const CONSIDER_CHANCE: Record<AggressionMode, number> = {
  safe:       0.10,
  normal:     0.50,
  aggressive: 0.75,
};

interface BotCorrectionParams {
  botPlayer:      Player;
  players:        Player[];
  fields:         readonly Field[];
  rolledSteps:    number;
  basePosition:   number;
  aggressionMode: AggressionMode;
}

/**
 * chooseBotCorrection — vrátí korekci tahu (−1 / 0 / +1) pro bota.
 *
 * Pure funkce: žádné side efekty, žádný DB write, žádný React.
 *
 * Logika:
 *   1. RNG gate — pravděpodobnost podle aggressionMode
 *   2. Bot musí mít dost coinů (ROLL_CORRECTION_COST)
 *   3. Pro každý adjustment [−1, +1] ověří:
 *      - finalRoll >= 1
 *      - cílové pole je racer vlastněný lidským hráčem
 *      - oba mají horses.length > 0 (duel by se spustil)
 *   4. Vrátí první validní korekci nebo 0
 *
 * Budoucí rozšíření: přidat avoidance AI, revenge targeting, personality weights.
 */
export function chooseBotCorrection({
  botPlayer,
  players,
  fields,
  rolledSteps,
  basePosition,
  aggressionMode,
}: BotCorrectionParams): -1 | 0 | 1 {
  // RNG gate — jednou za tah
  if (Math.random() > CONSIDER_CHANCE[aggressionMode]) return 0;

  // Bankrot guard — korekce nesmí přivést bota na 0
  if (botPlayer.coins - ROLL_CORRECTION_COST <= 0) return 0;

  const fieldCount = fields.length;

  for (const adj of [-1, 1] as Array<-1 | 1>) {
    const finalRoll = rolledSteps + adj;
    if (finalRoll < 1) continue;

    const landingPos   = (basePosition + finalRoll) % fieldCount;
    const landingField = fields[landingPos];
    if (!landingField || landingField.type !== "racer" || !landingField.racer) continue;

    const owner = players.find(
      p => !p.is_bot && p.id !== botPlayer.id && playerOwnsRacer(p, landingField.racer!),
    );
    if (!owner) continue;

    // Duel podmínka: oba musí mít závodníka
    if (botPlayer.horses.length === 0 || owner.horses.length === 0) continue;

    return adj;
  }

  return 0;
}
