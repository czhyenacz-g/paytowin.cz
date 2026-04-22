import type { Theme } from ".";

export const carDayTheme: Theme = {
  id: "car-day",
  name: "Závody aut — Den",
  description: "Světlý vzhled, asfaltové závodiště, automobilové závody.",
  version: "1.0.0",
  isPaid: false,
  priceCzk: 0,
  cardThemeTag: "car",
  colors: {
    pageBackground:     "bg-slate-100",
    cardBackground:     "bg-white",
    boardSurface:       "bg-stone-200/80",
    boardSurfaceBorder: "border-stone-300",
    centerBackground:   "bg-stone-300",
    centerBorder:       "border-stone-400",
    centerTitle:        "text-slate-700",
    centerSubtitle:     "text-slate-400",
    fieldStyles: {
      start:      "h-20 w-20 border-red-400 bg-red-500 text-white",
      coins_gain: "h-[72px] w-[72px] border-emerald-400 bg-emerald-100 text-emerald-800",
      coins_lose: "h-[72px] w-[72px] border-red-300 bg-red-100 text-red-800",
      gamble:     "h-[72px] w-[72px] border-violet-400 bg-violet-100 text-violet-800",
      racer:      "h-[72px] w-[72px] border-sky-400 bg-sky-100 text-sky-800",
      horse:      "h-[72px] w-[72px] border-sky-400 bg-sky-100 text-sky-800", // @deprecated alias
      neutral:    "h-[72px] w-[72px] border-slate-300 bg-white text-slate-700",
      chance:     "h-[72px] w-[72px] border-amber-400 bg-amber-100 text-amber-800",
      finance:    "h-[72px] w-[72px] border-amber-400 bg-teal-100 text-teal-800",
      mafia:     "h-[72px] w-[72px] border-purple-400 bg-purple-100 text-purple-800",
    },
    activePlayerBadge: "bg-slate-900 text-white",
    rollPanelIdle:     "bg-slate-100",
    rollPanelRolling:  "bg-sky-100",
    textPrimary:       "text-slate-800",
    textMuted:         "text-slate-500",
    playerCardActive:  "border-slate-900 bg-slate-50 shadow-sm",
    playerCardNormal:  "border-slate-200 bg-white",
    playerCardHover:   "border-sky-400 bg-sky-50 shadow-sm",
    arenaGradient:     "radial-gradient(ellipse 140% 90% at 50% 50%, #f8fafc 0%, #e7e5e4 30%, #d6d3d1 65%, #c7c7c5 100%)",
  },
  labels: {
    themeName:      "Závody aut — Den",
    centerTitle:    "Závodiště",
    centerSubtitle: "Připravte motory.",
    legend: {
      gain:   "zisk",
      lose:   "ztráta",
      gamble: "hazard",
      racer:  "auto",
    },
    racer:       "Auto",
    racers:      "Auta",
    racerField:  "Garáž",
    racingEmoji: "🏎️",
  },
  racerRefs: [
    {
      "slotIndex": 0,
      "racer_id": "stary_mustang"
    },
    {
      "slotIndex": 1,
      "racer_id": "modra_strela"
    },
    {
      "slotIndex": 2,
      "racer_id": "zlaty_blesk"
    },
    {
      "slotIndex": 3,
      "racer_id": "rychly_demon"
    },
    {
      "slotIndex": 4,
      "racer_id": "car_day_r5"
    }
  ],
  /** @fallback inline data — seed source + runtime fallback pokud registry není dostupná */
  racers: [
    {
      "id": "stary_mustang",
      "name": "Starý Mustang",
      "speed": 2,
      "price": 800,
      "emoji": "🚗",
      "maxStamina": 100,
      "image": "https://zyiaettnrfjzwcrumgty.supabase.co/storage/v1/object/public/racers/stary_mustang.webp",
      "isBuiltIn": true,
      "racerType": "car",
      "slotIndex": 0
    },
    {
      "id": "modra_strela",
      "name": "Modrá střela",
      "speed": 3,
      "price": 2500,
      "emoji": "🏎️",
      "maxStamina": 100,
      "image": "/themes/_shared/racer-modra_strela.webp",
      "isBuiltIn": true,
      "racerType": "car",
      "slotIndex": 1
    },
    {
      "id": "zlaty_blesk",
      "name": "Zlatý blesk",
      "speed": 8,
      "price": 250,
      "emoji": "🟡",
      "maxStamina": 90,
      "flavorText": "Blesk!",
      "image": "/themes/_shared/racer-zlaty_blesk.webp",
      "isBuiltIn": true,
      "racerType": "car",
      "slotIndex": 2
    },
    {
      "id": "rychly_demon",
      "name": "Rychlý démon",
      "speed": 5,
      "price": 1500,
      "emoji": "🔥",
      "maxStamina": 100,
      "image": "https://zyiaettnrfjzwcrumgty.supabase.co/storage/v1/object/public/racers/rychly_demon.webp",
      "isBuiltIn": true,
      "racerType": "car",
      "slotIndex": 3
    },
    {
      "id": "car_day_r5",
      "name": "Tvoja mama",
      "speed": 8,
      "price": 1500,
      "emoji": "🐴",
      "maxStamina": 100,
      "image": "https://zyiaettnrfjzwcrumgty.supabase.co/storage/v1/object/public/racers/car_day_r5.webp",
      "isBuiltIn": true,
      "racerType": "car",
      "slotIndex": 4
    },
    {
      "id": "r8",
      "name": "Legendarion",
      "speed": 10,
      "price": 99999,
      "emoji": "🐴",
      "maxStamina": 100,
      "isLegendary": true,
      "image": "/themes/_shared/racer-r8.webp",
      "isBuiltIn": true,
      "racerType": "car",
      "slotIndex": 5
    }
  ],
  mapMeta: {
    yearStart: 1923,
    place: "okolí Marrákeše",
    subtitle: "Prach, horko a krátká rozhodnutí.",
  },
  board: {
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
        "type": "mafia",
        "label": "Consigliere",
        "emoji": "",
        "amount": 50
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
        "label": "Don",
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
  },
};
