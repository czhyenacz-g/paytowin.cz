import type { Field } from "@/lib/engine";

/**
 * Vrátí aktualizovaný seznam odhalených polí po přistání na fieldIndex.
 * Racer a start pole jsou vždy viditelné — nepřidávají se (zabrání zbytečnému flipu).
 */
export function buildFogReveal(
  fieldIndex: number,
  fields: Pick<Field, "index" | "type">[],
  currentRevealed: number[],
): number[] {
  if (currentRevealed.includes(fieldIndex)) return currentRevealed;
  const fieldType = fields.find(f => f.index === fieldIndex)?.type;
  if (fieldType === "racer" || fieldType === "start") return currentRevealed;
  return [...currentRevealed, fieldIndex];
}
