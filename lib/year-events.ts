export interface YearEvent {
  title: string;
  /** Krizový rok — při průchodu STARTem resetuje všechna non-racer pole zpět na hidden. */
  crisis?: boolean;
}

/**
 * Roční eventy — vyhodnocují se při průchodu STARTem.
 * Klíč = herní rok (yearStart + počet průchodů STARTem lídra).
 * Rozšiřitelné: přidej nový rok nebo přidej další pole do YearEvent.
 */
export const YEAR_EVENTS: Record<number, YearEvent> = {
  1921: { title: "Don rád chodí na dostihy." },
  1922: { title: "Poplatek za ochranu." },
  1923: { title: "Město chce svůj podíl." },
  1924: { title: "Úřední dohled sílí.", crisis: true },
};

export function getYearEvent(year: number): YearEvent | null {
  return YEAR_EVENTS[year] ?? null;
}
