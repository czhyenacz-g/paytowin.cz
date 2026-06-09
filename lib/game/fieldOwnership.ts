/**
 * fieldOwnership.ts — pure helpery pro dočasné vlastnictví coins_lose polí.
 *
 * Všechny funkce jsou pure (žádné DB/Supabase volání, žádné side effects).
 * GameBoard a bot-actions je volají a samy řeší DB write.
 *
 * Analogie s racer ownership:
 *   buildRacerOwnership(players)   →  buildFieldOwnership(entries, players, turn)
 *   Record<racerKey, Player>       →  Record<fieldIndex, Player>
 */

import type { FieldOwnerEntry, Player } from "@/lib/types/game";
import type { Field } from "@/lib/engine";

// ── Ceny za 1., 2. a 3. pole v jednom tahu ────────────────────────────────────
const PLACEMENT_COSTS = [100, 200, 400] as const;

// ── Sestavení runtime lookup mapy ─────────────────────────────────────────────

/**
 * buildFieldOwnership — sestaví fieldIndex → Player pro všechna aktivní pole.
 *
 * Entry je aktivní pokud currentTurnCount < entry.expiresBeforeTurn.
 * Entries jejichž ownerId není v players se ignorují (obranný guard).
 */
export function buildFieldOwnership(
  entries: FieldOwnerEntry[],
  players: Player[],
  currentTurnCount: number,
): Record<number, Player> {
  const result: Record<number, Player> = {};
  for (const entry of entries) {
    if (currentTurnCount >= entry.expiresBeforeTurn) continue;
    const owner = players.find(p => p.id === entry.ownerId);
    if (!owner) continue;
    result[entry.fieldIndex] = owner;
  }
  return result;
}

/**
 * getFieldOwner — vrátí vlastníka daného pole nebo null.
 */
export function getFieldOwner(
  fieldIndex: number,
  entries: FieldOwnerEntry[],
  players: Player[],
  currentTurnCount: number,
): Player | null {
  const map = buildFieldOwnership(entries, players, currentTurnCount);
  return map[fieldIndex] ?? null;
}

// ── Placement validace ─────────────────────────────────────────────────────────

/**
 * buildFieldOwnershipPlacement — validuje výběr polí a sestaví nové entries.
 *
 * Ceny jsou fixní: 1. pole 100, 2. pole 200, 3. pole 400.
 * expiresBeforeTurn = currentTurnCount + playersCount (vlastnictví vyprší
 * na začátku příštího tahu vlastníka).
 */
export function buildFieldOwnershipPlacement(
  selectedIndexes: number[],
  ownerId: string,
  ownerName: string,
  currentTurnCount: number,
  playersCount: number,
  allFields: Field[],
  existingOwners: FieldOwnerEntry[],
): { entries: FieldOwnerEntry[]; totalCost: number; valid: boolean; reason?: string } {
  const invalid = (reason: string) => ({ entries: [], totalCost: 0, valid: false, reason });

  if (playersCount <= 0)              return invalid("playersCount musí být > 0");
  if (selectedIndexes.length === 0)   return invalid("Musíš vybrat alespoň 1 pole");
  if (selectedIndexes.length > 3)     return invalid("Lze vybrat nejvýše 3 pole");

  // Duplicity v selectedIndexes
  const unique = new Set(selectedIndexes);
  if (unique.size !== selectedIndexes.length) return invalid("Nelze vybrat stejné pole víckrát");

  const fieldMap = new Map(allFields.map(f => [f.index, f]));
  const expiresBeforeTurn = currentTurnCount + playersCount;
  const activeOwners = expireStaleEntries(existingOwners, currentTurnCount);

  const newEntries: FieldOwnerEntry[] = [];
  let totalCost = 0;

  for (let i = 0; i < selectedIndexes.length; i++) {
    const idx = selectedIndexes[i];

    if (typeof idx !== "number" || idx < 0) return invalid(`Neplatný index pole: ${idx}`);

    const field = fieldMap.get(idx);
    if (!field) return invalid(`Pole s indexem ${idx} neexistuje`);
    if (field.type !== "coins_lose") return invalid(`Pole ${idx} není coins_lose pole`);

    const alreadyOwned = activeOwners.some(e => e.fieldIndex === idx);
    if (alreadyOwned) return invalid(`Pole ${idx} už má vlastníka`);

    // Cena: 100 za 1. pole, 200 za 2. pole, 400 za 3. pole
    const cost = PLACEMENT_COSTS[i];
    totalCost += cost;

    newEntries.push({
      fieldIndex:        idx,
      ownerId,
      ownerName,
      placedAtTurn:      currentTurnCount,
      expiresBeforeTurn,
    });
  }

  return { entries: newEntries, totalCost, valid: true };
}

// ── Expiry helpery ─────────────────────────────────────────────────────────────

/**
 * expireOwnerEntries — odstraní všechny entries daného vlastníka.
 *
 * Voláno na začátku vlastníkova tahu v finishTurn / botFinishTurn.
 */
export function expireOwnerEntries(
  entries: FieldOwnerEntry[],
  ownerId: string,
): FieldOwnerEntry[] {
  return entries.filter(e => e.ownerId !== ownerId);
}

/**
 * expireStaleEntries — odstraní entries kde currentTurnCount >= expiresBeforeTurn.
 *
 * Safety net volaný před každým čtením. Chrání před race conditions
 * kde expire v finishTurn nestihlo proběhnout.
 */
export function expireStaleEntries(
  entries: FieldOwnerEntry[],
  currentTurnCount: number,
): FieldOwnerEntry[] {
  return entries.filter(e => currentTurnCount < e.expiresBeforeTurn);
}

/**
 * resetAllFieldOwners — smaže všechna vlastnictví polí.
 *
 * Připraveno pro reset event celé mapy ("krach na burze" apod.).
 */
export function resetAllFieldOwners(): FieldOwnerEntry[] {
  return [];
}

// ── Platba vlastníkovi pole ────────────────────────────────────────────────────

/**
 * applyFieldOwnerPayment — přesměruje ztrátu z coins_lose pole na vlastníka.
 *
 * Pure helper — bez DB, bez side effects.
 * Volá se jen pokud: owner existuje, owner.id !== payer.id, !isBankrupt(owner).
 */
export function applyFieldOwnerPayment(
  payer: Player,
  owner: Player,
  lossAmount: number,  // kladné číslo = kolik payer ztrácí
  fieldLabel: string,
): { payer: Player; owner: Player; log: string } {
  return {
    payer: { ...payer, coins: payer.coins - lossAmount },
    owner: { ...owner, coins: owner.coins + lossAmount },
    log: `${payer.name} zaplatil ${lossAmount} 💰 hráči ${owner.name} za pole ${fieldLabel}`,
  };
}
