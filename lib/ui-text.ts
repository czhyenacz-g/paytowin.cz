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

  /**
   * Race overlay texty.
   *
   * types: per-raceType labels dříve v RACE_TYPE_LABELS (RaceEventOverlay.tsx).
   * Poznámka: racingTitle emoji (🏇) je horse-specific — follow-up: předat přes ThemeLabels.
   *
   * Ostatní: shared action/status texty overlay.
   */
  race: {
    types: {
      mass_race: {
        selectingTitle:  "Výběr závodníků",
        selectingEmoji:  "🏁",
        selectingPrompt: "Vyber závodníka pro závod",
        countdownSub:    "Závod začíná!",
        racingTitle:     "🏇 Závod!",   // TODO: horse emoji → theme.labels.racingEmoji
        resultsTitle:    "Výsledky závodu",
      },
      rivals_race: {
        selectingTitle:  "Souboj o závodníka",
        selectingEmoji:  "⚔️",
        selectingPrompt: "Vyber závodníka pro souboj",
        countdownSub:    "Souboj začíná!",
        racingTitle:     "⚔️ Souboj!",
        resultsTitle:    "Výsledky souboje",
      },
    },
    preferredRacer:      "Preferred závodník",
    selectOther:         "nebo vyber jiného:",
    speed:               "rychlost",
    waitingForSelection: "Čeká na výběr:",
    skipSelection:       "Přeskočit výběr",
    handoffPrepare:      "Na start se připraví",
    handoffInstruction:  "Předej zařízení a připrav se!",
    racerEliminated:     "💀 závodník vyřazen",
    continueAction:      "Pokračovat →",
    waitingForHost:      "Čeká na hostitele…",
  },
  /**
   * Herní deska — panel napravo, HUD, player cards.
   * Texty opakující se v hlavním herním UI — nezávislé na theme.
   * Poznámka: movingStatus emoji (🐎) je horse-specific — follow-up spolu s race.types.racingTitle.
   */
  board: {
    // Section labels
    gamePanelTitle:    "Herní panel",
    lastRollTitle:     "Poslední hod",
    playersTitle:      "Hráči",
    moveLogTitle:      "Log tahů",
    roundLabel:        "Kolo",
    // HUD badges / buttons
    localModeBadge:    "🖥️ Lokální",
    spectatorBadge:    "👀 Pozorovatel",
    raceButton:        "🏁 Závod",
    // Dice / turn states
    rollingStatus:     "🎲 Háže se…",
    movingStatus:      "🐎 Figurka se pohybuje…",
    rollButton:        "Hoď kostkou",
    rerollButton:      "🎲 Hoď znovu!",
    freeRerollNotice:  "🎲 Máš druhý hod zdarma!",
    waitingForPlayer:  "Čekej na tah hráče",
    // Player card labels
    activePlayerBadge: "▶ Na tahu",
    bankruptLabel:     "💀 Zkrachoval",
    staminaLabel:      "Stamina",
    preferredBadge:    "Hlavní",
  },

  /** Racer purchase panel — nabídka koupě závodníka při přistání na racer poli. */
  racer: {
    buyButton:          "Koupit",
    skipButton:         "Přeskočit",
    speedLabel:         "Rychlost:",
    priceLabel:         "Cena:",
    waitingForDecision: "Čeká na rozhodnutí",
  },

  /** Korekce tahu — panel pro volbu úpravy hodu kostkou. */
  rollDecision: {
    title:            "Korekce tahu",
    normalOption:     "Normál",
    stepUnit:         "krok",
    free:             "Zdarma",
    autoFallbackHint: "Když nic nevybereš, za chvíli se provede normální tah.",
    waitingForPlayer: "Čeká se na volbu hráče",
  },
} as const;
