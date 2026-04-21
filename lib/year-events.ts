/**
 * lib/year-events.ts — year event systém pro průchod STARTem.
 *
 * Dva typy eventů:
 *   CAMPAIGN_EVENTS  — relativní offset od startu (0 = počáteční rok, 1 = první průchod, …)
 *   HISTORICAL_EVENTS — absolutní historický rok (1929, 1933, …)
 *
 * resolveYearEvent() sloučí oba zdroje + volitelné theme overrides.
 * Priorita pro telegram strip: historical > campaign.
 */

// ─── YearEvent ────────────────────────────────────────────────────────────────

export interface YearEvent {
  /** Headline — krátký CAPS titulek, použije se jako audio morse cue. */
  title: string;
  /** Tělo zprávy — zobrazí se pod headlinem v telegram stripu. */
  body?: string;
  /**
   * Resetuje všechna non-racer pole zpět na hidden (fog of war).
   */
  resetNonRacerCards?: boolean;
  /**
   * Historical milestone s tímto flagem přebíjí i gameplay efekty campaign eventu
   * ve stejném roce — campaign effect se v takovém roce ignoruje úplně.
   */
  dominatesEffects?: boolean;
  /**
   * @deprecated Použij resetNonRacerCards.
   * Zachováno pro zpětnou kompatibilitu.
   */
  crisis?: boolean;
}

// ─── Theme overrides ──────────────────────────────────────────────────────────

export interface YearEventOverrides {
  campaign?: Record<number, YearEvent>;
  historical?: Record<number, YearEvent>;
}

// ─── Campaign events ──────────────────────────────────────────────────────────

/**
 * CAMPAIGN_EVENTS — eventy relativní k yearStart.
 *
 * offset 0 = počáteční rok (zobrazeno v UI, nespouští se přes passedStart)
 * offset 1 = první průchod STARTem
 * …
 */
export const CAMPAIGN_EVENTS: Record<number, YearEvent> = {
  0: {
    title: "SENZACE",
    body: "Na závodiště proudí noví diváci. Vlivní muži začínají sledovat každou sázku.",
  },
  1: {
    title: "POPLATEK ZA OCHRANU",
    body: "Bojím se, že tihle lidé budou chtít každý rok více a více.",
  },
  2: {
    title: "DOHLED",
    body: "Město zpřísňuje kontrolu. Každý výdělek přitahuje další ruce.",
  },
  3: {
    title: "CHAOS V SÁZKÁCH",
    body: "Zákony o sázení se mění ze dne na den. Staré informace přestávají platit.",
    resetNonRacerCards: true,
  },
  4: {
    title: "BOOM",
    body: "Peníze obíhají rychleji než dřív. S nimi ale rostou i požadavky okolí.",
  },
  5: {
    title: "STÁVKA",
    body: "Ulice i podniky jsou neklidné. Kdo chce pokračovat, musí zaplatit víc.",
  },
  6: {
    title: "HOREČKA",
    body: "Dav žádá rychlost, show a velká jména. Úspěch je dražší než kdy dřív.",
  },
  7: {
    title: "CHAMTIVOST",
    body: "Všichni chtějí vydělat víc. Opatrnost ustupuje risku.",
  },
};

// ─── Historical milestone events ──────────────────────────────────────────────

/**
 * HISTORICAL_EVENTS — eventy navázané na absolutní historický rok.
 * Při konfliktu s campaign eventem mají prioritu pro telegram strip.
 */
export const HISTORICAL_EVENTS: Record<number, YearEvent> = {
  1929: {
    title: "KRACH NA BURZE",
    body: "Trhy se otřásly. Důvěra mizí a peníze najednou váží víc než sliby.",
    resetNonRacerCards: true,
    dominatesEffects: true,
  },
  1930: {
    title: "ÚTLUM",
    body: "Po velkém pádu přichází ticho. Každá chyba teď stojí víc než dřív.",
  },
  1931: {
    title: "NOUZE",
    body: "Hotovost mizí z oběhu. Kdo má rezervu, ten přežije déle.",
  },
  1932: {
    title: "NEKLID",
    body: "Města jsou unavená krizí. Dav rychleji věří hlasitým slibům.",
  },
  1933: {
    title: "NOVÝ REŽIM",
    body: "V Německu sílí nacisté. Strach, propaganda a moc začínají měnit Evropu.",
  },
  1934: {
    title: "ČISTKY",
    body: "Silní hráči odstraňují slabší. Ve vzduchu je méně důvěry a více poslušnosti.",
  },
  1935: {
    title: "ZBROJENÍ",
    body: "Evropa znovu mluví o síle. Peníze i lidé se přesouvají jinam než dřív.",
  },
  1936: {
    title: "NAPĚTÍ",
    body: "Spojenectví se lámou a přepisují. Každý tah je opatrnější než předtím.",
  },
  1937: {
    title: "STÍNY",
    body: "Kontinent je nervózní. Zprávy zvenčí znějí čím dál hůř.",
  },
  1938: {
    title: "MNICHOV",
    body: "Evropa ustupuje nátlaku. Hranice, sliby i jistoty se znovu mění.",
  },
  1939: {
    title: "VÁLKA",
    body: "Starý svět končí. Začíná doba, ve které už nic nezůstane beze změny.",
  },
};

// ─── Resolver ─────────────────────────────────────────────────────────────────

/**
 * resolveYearEvent — sloučí campaign event, historical event a theme overrides.
 *
 * Priorita pro telegram strip: historical > campaign.
 * Flags (resetNonRacerCards): union — resetuje pokud má flag JAKÝKOLIV zdroj.
 * Theme override přetíží příslušný globální zdroj pro daný slot.
 */
export function resolveYearEvent(
  campaignOffset: number,
  displayYear: number,
  overrides?: YearEventOverrides,
): YearEvent | null {
  const campaignEvent: YearEvent | null =
    overrides?.campaign?.[campaignOffset] ?? CAMPAIGN_EVENTS[campaignOffset] ?? null;

  const historicalEvent: YearEvent | null =
    overrides?.historical?.[displayYear] ?? HISTORICAL_EVENTS[displayYear] ?? null;

  if (!campaignEvent && !historicalEvent) return null;

  // Historical má prioritu pro title + body.
  // dominatesEffects: campaign efekt se ignoruje — použijí se jen historical flagy.
  // Bez dominatesEffects: flagy se unionují (stávající chování).
  const primary = historicalEvent ?? campaignEvent!;
  const secondary = (historicalEvent && !historicalEvent.dominatesEffects) ? campaignEvent : null;

  return {
    title: primary.title,
    body: primary.body,
    resetNonRacerCards: !!(
      primary.resetNonRacerCards || primary.crisis ||
      secondary?.resetNonRacerCards || secondary?.crisis
    ),
  };
}

/** @deprecated Použij resolveYearEvent(). */
export function getYearEvent(absoluteYear: number): YearEvent | null {
  return HISTORICAL_EVENTS[absoluteYear] ?? null;
}
