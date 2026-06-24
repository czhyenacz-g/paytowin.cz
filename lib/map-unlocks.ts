/**
 * XP thresholdy pro odemknutí map v MapMenuStrip.
 * Klíče odpovídají panel.id v MapMenuStrip.tsx.
 *
 * Orientační přepočet: vítěz hry dostane ~150 XP, prohra ~50 XP.
 * Přibližné počty her k odemčení jsou uvedeny v komentářích.
 */
export const MAP_XP_THRESHOLDS: Record<string, number> = {
  "mapa-1":  0,     // Denní dostihy — zdarma, vždy dostupné
  "mapa-2":  600,   // Noční dostihy — ~4–5 výher (gating hlavně časem, viz isTimeLocked)
  "mapa-3":  150,   // Chuchle 1930 — ~1 výhra, snadné rychlé odemčení
  "mapa-4":  2250,  // Denní auta — ~15 výher
  "mapa-5":  3000,  // Noční auta — ~20 výher
  "ostatni": 4500,  // Komunitní mapy — ~30 výher
  "editor":  6000,  // Editor map — ~40 výher (+ monetizace přijde později)
  "profil":  0,     // Profil — vždy dostupný
};

/** Mapy s denní/noční tematikou, zamykané podle reálného lokálního času hráče. */
const TIME_GATED_PANELS: Record<string, "day" | "night"> = {
  "mapa-1": "day",   // Denní dostihy
  "mapa-2": "night", // Noční dostihy
};

const NIGHT_START_HOUR = 20; // 20:00
const NIGHT_END_HOUR = 7;    // 7:00

/** Vrátí true, pokud je podle lokálního času prohlížeče právě noc (20:00–7:00). */
export function isNightTime(date: Date = new Date()): boolean {
  const hour = date.getHours();
  return hour >= NIGHT_START_HOUR || hour < NIGHT_END_HOUR;
}

/** Vrátí true, pokud je panel časově zamčený. Platí jen pro denní/noční koňské mapy. */
export function isTimeLocked(panelId: string, date: Date = new Date()): boolean {
  const slot = TIME_GATED_PANELS[panelId];
  if (!slot) return false;
  const night = isNightTime(date);
  return slot === "day" ? night : !night;
}

/** Krátký text pro odznak na zamčené kartě (např. "Dostupné od 20:00"). */
export function getTimeLockShortLabel(panelId: string): string | null {
  const slot = TIME_GATED_PANELS[panelId];
  if (slot === "day") return `Dostupné od ${NIGHT_END_HOUR}:00`;
  if (slot === "night") return `Dostupné od ${NIGHT_START_HOUR}:00`;
  return null;
}

/** Plná hláška do toastu vysvětlující časový zámek. */
export function formatTimeLockMessage(panelId: string): string {
  const slot = TIME_GATED_PANELS[panelId];
  if (slot === "day") return `Dostupné od ${NIGHT_END_HOUR}:00. Do té doby se závodí na mapě Noční dostihy.`;
  if (slot === "night") return `Noční závody začínají ve ${NIGHT_START_HOUR}:00. Do té doby se závodí na mapě Denní dostihy.`;
  return "";
}

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

export interface PanelLockState {
  locked:  boolean;
  /** Důvod zámku — "time" má prioritu před "xp", aby hláška nebyla matoucí. */
  reason:  "time" | "xp" | null;
  /** Krátký text pro odznak přímo na kartě (jen u časového zámku). */
  shortLabel: string | null;
  /** Plná hláška do toastu po kliknutí na zamčenou kartu. */
  message: string | null;
}

/**
 * Spojí časový a XP zámek do jednoho stavu pro danou kartu.
 * Časový zámek má přednost — pokud je mapa nedostupná kvůli dennímu/nočnímu
 * gatingu, ukáže se tato hláška i kdyby hráč už měl dost XP.
 */
export function getPanelLockState(
  panelId: string,
  currentXp: number | null | undefined,
  isLoggedIn: boolean,
  isDev: boolean,
  date: Date = new Date(),
): PanelLockState {
  if (isDev) return { locked: false, reason: null, shortLabel: null, message: null };

  if (isTimeLocked(panelId, date)) {
    return {
      locked: true,
      reason: "time",
      shortLabel: getTimeLockShortLabel(panelId),
      message: formatTimeLockMessage(panelId),
    };
  }

  const required = getRequiredXpForPanel(panelId);
  if (required > 0 && (currentXp == null || !isUnlockedByXp(currentXp, required))) {
    return {
      locked: true,
      reason: "xp",
      shortLabel: null,
      message: formatUnlockMessage(panelId, required, currentXp ?? null, isLoggedIn),
    };
  }

  return { locked: false, reason: null, shortLabel: null, message: null };
}
