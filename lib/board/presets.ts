/**
 * lib/board/presets.ts — officiální board presety.
 *
 * SMALL_BOARD: 21 polí, odpovídá přesně původnímu hardcoded buildFields().
 * Veškeré coin amounts, typy polí a racer sloty jsou zde — ne v engine.
 */

import type { BoardConfig } from "./types";

// ─── Small board — 21 polí ────────────────────────────────────────────────────

/**
 * SMALL_BOARD — výchozí preset (21 polí).
 *
 * Přesně odpovídá původnímu hardcoded buildFields(). Žádné gameplay změny.
 *
 * Racer sloty: pole 3, 10, 17, 19 → mapováno 1:1 na theme.racers[0..3].
 * Coin amounts: přesné hodnoty z původního buildFields (coins_gain kladné, coins_lose záporné).
 */
export const SMALL_BOARD: BoardConfig = {
  "id": "small",
  "fieldCount": 21,
  "racerSlotIndexes": [
    3,
    10,
    17,
    19
  ],
  "fields": [
    {
      "index": 0,
      "type": "start",
      "label": "START",
      "emoji": "🏁",
      "amount": 2000
    },
    {
      "index": 1,
      "type": "coins_gain",
      "label": "Sponzor",
      "emoji": "🤝",
      "amount": 1000
    },
    {
      "index": 2,
      "type": "coins_lose",
      "label": "Veterinář",
      "emoji": "🩺",
      "amount": -600
    },
    {
      "index": 3,
      "type": "racer",
      "label": "Závodník",
      "emoji": "🐎"
    },
    {
      "index": 4,
      "type": "coins_gain",
      "label": "Vítěz dostihu",
      "emoji": "🏆",
      "amount": 1500
    },
    {
      "index": 5,
      "type": "coins_lose",
      "label": "Daňový úřad",
      "emoji": "🏛️",
      "amount": -800
    },
    {
      "index": 6,
      "type": "coins_gain",
      "label": "Zlaté podkůvky",
      "emoji": "🥇",
      "amount": 800
    },
    {
      "index": 7,
      "type": "coins_lose",
      "label": "Korupce",
      "emoji": "💸",
      "amount": -1200
    },
    {
      "index": 8,
      "type": "chance",
      "label": "Osud",
      "emoji": "🎴"
    },
    {
      "index": 9,
      "type": "coins_gain",
      "label": "Dobrá sezona",
      "emoji": "🌟",
      "amount": 900
    },
    {
      "index": 10,
      "type": "racer",
      "label": "Závodník",
      "emoji": "🐎"
    },
    {
      "index": 11,
      "type": "coins_lose",
      "label": "Krize na trhu",
      "emoji": "📉",
      "amount": -500
    },
    {
      "index": 12,
      "type": "mafia",
      "label": "Mafie",
      "emoji": "🎭"
    },
    {
      "index": 13,
      "type": "racer",
      "label": "Zlatá hříva",
      "emoji": "😈",
      "amount": -70
    },
    {
      "index": 14,
      "type": "finance",
      "label": "Finance",
      "emoji": "💼"
    },
    {
      "index": 15,
      "type": "coins_gain",
      "label": "Věrnostní bonus",
      "emoji": "🎁",
      "amount": 500
    },
    {
      "index": 16,
      "type": "coins_lose",
      "label": "Zloděj",
      "emoji": "🦹",
      "amount": -700
    },
    {
      "index": 17,
      "type": "racer",
      "label": "Závodník",
      "emoji": "🐎"
    },
    {
      "index": 18,
      "type": "coins_lose",
      "label": "Veterinář",
      "emoji": "💊",
      "amount": -600
    },
    {
      "index": 19,
      "type": "racer",
      "label": "Závodník",
      "emoji": "🐎"
    },
    {
      "index": 20,
      "type": "chance",
      "label": "Osud",
      "emoji": "🎴"
    }
  ]
};

// ─── Small-stadium board — 21 polí, stadionový okruh ─────────────────────────

/**
 * STADIUM_BOARD — stadionový preset (21 polí, stejná pole jako SMALL_BOARD).
 *
 * Identická herní struktura jako SMALL_BOARD — liší se pouze vizuálním layoutem
 * (shape: "stadium"). Umožňuje porovnat oba layouty bez dopadu na gameplay.
 */
export const STADIUM_BOARD: BoardConfig = {
  ...SMALL_BOARD,
  id: "small-stadium",
  shape: "stadium",
};
