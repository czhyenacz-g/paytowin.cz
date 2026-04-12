/**
 * lib/board/validator.ts — runtime validace BoardConfig.
 *
 * ThemeManifest validace a cross-check jsou v lib/themes/validator.ts.
 * Tento soubor re-exportuje crossCheckBoardAndTheme pro backward kompatibilitu.
 *
 * Přístup:
 * - console.warn pro problémy které lze bezpečně ignorovat (non-fatal)
 * - console.error pro problémy které téměř jistě způsobí chybu za běhu (fatal)
 * - vrací false pokud je config rozbitý, true pokud je v pořádku
 * - NEVYHAZUJE exception
 */

import type { BoardConfig } from "./types";

// Re-export ThemeManifest validátoru a cross-checku z kanonického umístění
export { validateThemeManifest, crossCheckBoardAndTheme } from "@/lib/themes/validator";

// ─── BoardConfig validator ────────────────────────────────────────────────────

/**
 * validateBoardConfig — ověří strukturální správnost BoardConfig.
 *
 * Kontroluje:
 * - fieldCount === fields.length
 * - indexy polí jsou unikátní a v rozsahu 0..fieldCount-1
 * - existuje právě 1 start pole
 * - racerSlotIndexes jsou unikátní a patří mezi existující pole type:"racer"
 * - racerSlotIndexes.length >= 1
 */
export function validateBoardConfig(board: BoardConfig): boolean {
  let ok = true;
  const tag = `[BoardConfig "${board.id}"]`;

  // fieldCount === fields.length
  if (board.fieldCount !== board.fields.length) {
    console.error(`${tag} fieldCount (${board.fieldCount}) !== fields.length (${board.fields.length})`);
    ok = false;
  }

  // Indexy jsou unikátní
  const allIndexes = board.fields.map((f) => f.index);
  if (new Set(allIndexes).size !== allIndexes.length) {
    console.error(`${tag} Pole obsahují duplicitní indexy.`);
    ok = false;
  }

  // Indexy jsou v rozsahu 0..fieldCount-1
  const outOfRange = allIndexes.filter((i) => i < 0 || i >= board.fieldCount);
  if (outOfRange.length > 0) {
    console.error(`${tag} Pole s indexy mimo rozsah: ${outOfRange.join(", ")}`);
    ok = false;
  }

  // Právě 1 start pole
  const startCount = board.fields.filter((f) => f.type === "start").length;
  if (startCount !== 1) {
    console.error(`${tag} Musí existovat právě 1 start pole, nalezeno: ${startCount}`);
    ok = false;
  }

  // racerSlotIndexes >= 1
  if (board.racerSlotIndexes.length < 1) {
    console.error(`${tag} racerSlotIndexes musí mít alespoň 1 prvek.`);
    ok = false;
  }

  // racerSlotIndexes jsou unikátní
  if (new Set(board.racerSlotIndexes).size !== board.racerSlotIndexes.length) {
    console.error(`${tag} racerSlotIndexes obsahují duplicity.`);
    ok = false;
  }

  // racerSlotIndexes musí odpovídat polím type:"racer"
  const racerFieldIndexes = new Set(
    board.fields.filter((f) => f.type === "racer").map((f) => f.index)
  );
  for (const slotIdx of board.racerSlotIndexes) {
    if (!racerFieldIndexes.has(slotIdx)) {
      console.error(`${tag} racerSlotIndex ${slotIdx} nemá odpovídající pole type:"racer".`);
      ok = false;
    }
  }
  if (racerFieldIndexes.size !== board.racerSlotIndexes.length) {
    console.warn(
      `${tag} Počet polí type:"racer" (${racerFieldIndexes.size}) !== racerSlotIndexes.length (${board.racerSlotIndexes.length}).`
    );
  }

  return ok;
}
