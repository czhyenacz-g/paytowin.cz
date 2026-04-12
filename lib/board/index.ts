/**
 * lib/board — vstupní bod pro board konfiguraci.
 *
 * Používej getBoardById() místo přímého importu presetu — je připraveno na budoucí
 * načítání board presetů z DB nebo JSON (theme builder).
 */

export type { BoardPresetId, BoardFieldType, BoardFieldConfig, BoardConfig } from "./types";
export { SMALL_BOARD } from "./presets";
export { validateBoardConfig, validateThemeManifest, crossCheckBoardAndTheme } from "./validator";

import { SMALL_BOARD } from "./presets";
import type { BoardConfig } from "./types";

// ─── UI metadata pro board presety ───────────────────────────────────────────

/**
 * BoardPresetMeta — UI popis board presetu pro create game flow.
 * Stejný pattern jako THEMES array v lib/themes.
 */
export interface BoardPresetMeta {
  id: string;
  name: string;
  description: string;
  fieldCount: number;
  /** false = preset existuje v UI jako "coming soon", ale nelze vybrat */
  available: boolean;
}

/**
 * BOARD_PRESETS — seznam presetů zobrazovaných v create game UI.
 * Přidej sem nový preset až bude LARGE_BOARD hotový.
 */
export const BOARD_PRESETS: BoardPresetMeta[] = [
  {
    id: "small",
    name: "Klasická deska",
    description: "21 polí, 4 závodníci.",
    fieldCount: 21,
    available: true,
  },
  // {
  //   id: "large",
  //   name: "Velká deska",
  //   description: "42 polí, více závodníků.",
  //   fieldCount: 42,
  //   available: false,  // coming soon
  // },
];

// ─── In-memory registr ────────────────────────────────────────────────────────

/** Registr dostupných board presetů. Budoucí přidání "large" → přidat sem. */
const BOARD_REGISTRY: Record<string, BoardConfig> = {
  small: SMALL_BOARD,
  // large: LARGE_BOARD,  // TODO: přidat až bude LARGE_BOARD preset hotový
};

// ─── Loader ───────────────────────────────────────────────────────────────────

/**
 * getBoardById — vrátí BoardConfig podle id.
 *
 * Fallback: pokud id není nalezeno (nebo je null/undefined), vrátí SMALL_BOARD.
 * Architektura je připravena na budoucí async variantu (DB / JSON load).
 */
export function getBoardById(id: string | null | undefined): BoardConfig {
  if (!id) return SMALL_BOARD;
  const board = BOARD_REGISTRY[id];
  if (!board) {
    console.warn(`[getBoardById] Neznámý board id: "${id}", fallback na "small".`);
    return SMALL_BOARD;
  }
  return board;
}
