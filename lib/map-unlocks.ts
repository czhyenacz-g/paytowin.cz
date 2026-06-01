/**
 * XP thresholdy pro odemknutí map v MapMenuStrip.
 * Klíče odpovídají panel.id v MapMenuStrip.tsx.
 *
 * Orientační přepočet: vítěz hry dostane ~150 XP, prohra ~50 XP.
 * Přibližné počty her k odemčení jsou uvedeny v komentářích.
 */
export const MAP_XP_THRESHOLDS: Record<string, number> = {
  "mapa-1":  0,     // Denní dostihy — zdarma, vždy dostupné
  "mapa-2":  600,   // Noční dostihy — ~4–5 výher
  "mapa-3":  1500,  // Chuchle 1930 — ~10 výher
  "mapa-4":  2250,  // Denní auta — ~15 výher
  "mapa-5":  3000,  // Noční auta — ~20 výher
  "ostatni": 4500,  // Komunitní mapy — ~30 výher
  "editor":  6000,  // Editor map — ~40 výher (+ monetizace přijde později)
  "profil":  0,     // Profil — vždy dostupný
};

/** Vrátí potřebné XP pro dané panel ID. Panel bez záznamu je zdarma. */
export function getRequiredXpForPanel(panelId: string): number {
  return MAP_XP_THRESHOLDS[panelId] ?? 0;
}

/** Vrátí true pokud hráč má dostatek XP pro daný panel. */
export function isUnlockedByXp(currentXp: number, requiredXp: number): boolean {
  return currentXp >= requiredXp;
}

/**
 * Sestaví českou zprávu o odemknutí zobrazovanou po kliknutí na zamčenou mapu.
 * currentXp === null = přihlášen ale XP se ještě načítá.
 */
export function formatUnlockMessage(
  panelId: string,
  requiredXp: number,
  currentXp: number | null,
  isLoggedIn: boolean,
): string {
  const req = requiredXp.toLocaleString("cs-CZ");

  if (panelId === "editor") {
    const base = `Editor map se odemkne od ${req} XP. Monetizace editoru přijde později.`;
    if (!isLoggedIn) return `${base} Přihlas se, aby se ti počítal postup.`;
    if (currentXp === null) return base;
    return `${base} Máš ${currentXp.toLocaleString("cs-CZ")} / ${req} XP.`;
  }

  if (panelId === "ostatni") {
    const base = `Komunitní mapy se odemknou od ${req} XP.`;
    if (!isLoggedIn) return `${base} Přihlas se, aby se ti počítal postup.`;
    if (currentXp === null) return base;
    return `${base} Máš ${currentXp.toLocaleString("cs-CZ")} / ${req} XP.`;
  }

  const base = `Pro odemknutí je potřeba ${req} XP.`;
  if (!isLoggedIn) return `${base} Přihlas se, aby se ti počítal postup.`;
  if (currentXp === null) return base;
  return `${base} Máš ${currentXp.toLocaleString("cs-CZ")} / ${req} XP.`;
}
