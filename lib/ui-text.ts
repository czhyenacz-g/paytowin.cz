/**
 * Core UI text layer — theme-neutral, locale-ready.
 *
 * Všechny uživatelské texty, které NEJSOU theme-specific, patří sem.
 * Theme-specific pojmy (racer/auto/kůň, stáj/garáž…) zůstávají v ThemeLabels.
 *
 * Cílová vrstvová architektura:
 *   ui-text.ts      — core/shared texty (tato vrstva)
 *   ThemeLabels     — přepis pojmů per theme (racer, racerField, legend…)
 *   RacerConfig     — flavor texty per závodník (flavorText)
 *   locale/cs.ts    — BUDOUCÍ: překlad do jiného jazyka, zatím neimplementováno
 *
 * Kdy přidat sem: text se neliší mezi horse / car / lama tématem.
 * Kdy přidat do ThemeLabels: text závisí na tom, jak theme nazývá závodníka.
 */
export const UI_TEXT = {
  guide: {
    noRacer: {
      title: "Chceš závodit? Nejdřív si pořiď racera.",
      body:  "Bez vlastního závodníka se do většiny závodních akcí nedostaneš. Sleduj pole s racerem a kup prvního, který ti sedne do strategie.",
    },
    hasRacer: {
      title: "Máš racera. Hlídej si jeho staminu, unavený závodník v závodě ztrácí.",
      body:  "Po každém závodě sleduj, kolik mu zbývá sil. Když si označíš hlavního racera, budeš ho mít po ruce rychleji.",
    },
    setPreferred: {
      title: "Vyber si hlavního racera. Do dalších závodů se ti bude hodit jako první volba.",
      body:  "Označený závodník je po ruce rychleji a usnadní ti výběr, když budeš chtít jít do dalšího závodu bez zdržení.",
    },
  },
} as const;
