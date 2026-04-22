import type { Theme } from ".";

export const horseDayTheme: Theme = {
  id: "horse-day",
  name: "Dostihy — Den",
  description: "Světlý vzhled, vyprahlé závodiště, koňské dostihy.",
  version: "1.0.5",
  isPaid: false,
  priceCzk: 0,
  cardThemeTag: "horse",
  colors: {
    pageBackground:     "bg-slate-100",
    cardBackground:     "bg-white",
    boardSurface:       "bg-[#fefce8]/80",
    boardSurfaceBorder: "border-[#dddddd]",
    centerBackground:   "bg-[#eeeeee]",
    centerBorder:       "border-[#dddddd]",
    centerTitle:        "text-slate-700",
    centerSubtitle:     "text-slate-400",
    fieldStyles: {
      start:      "h-20 w-20 border-red-400 bg-red-500 text-white",
      coins_gain: "h-[72px] w-[72px] border-emerald-400 bg-emerald-100 text-emerald-800",
      coins_lose: "h-[72px] w-[72px] border-red-300 bg-red-100 text-red-800",
      gamble:     "h-[72px] w-[72px] border-violet-400 bg-violet-100 text-violet-800",
      racer:      "h-[72px] w-[72px] border-amber-400 bg-amber-100 text-amber-800",
      horse:      "h-[72px] w-[72px] border-amber-400 bg-amber-100 text-amber-800", // @deprecated alias
      neutral:    "h-[72px] w-[72px] border-slate-300 bg-white text-slate-700",
      chance:     "h-[72px] w-[72px] border-sky-400 bg-sky-100 text-sky-800",
      finance:    "h-[72px] w-[72px] border-sky-400 bg-teal-100 text-teal-800",
      mafia:     "h-[72px] w-[72px] border-purple-400 bg-purple-100 text-purple-800",
    },
    activePlayerBadge: "bg-slate-900 text-white",
    rollPanelIdle:     "bg-slate-100",
    rollPanelRolling:  "bg-amber-100",
    textPrimary:       "text-slate-800",
    textMuted:         "text-slate-500",
    playerCardActive:  "border-slate-900 bg-slate-50 shadow-sm",
    playerCardNormal:  "border-slate-200 bg-white",
    playerCardHover:   "border-blue-400 bg-blue-50 shadow-sm",
    arenaGradient:     "url('/savana-day.webp') center / cover no-repeat",
  },
  labels: {
    themeName:      "Dostihy — Den",
    centerTitle:    "Connecticut",
    centerSubtitle: "Sezóna začíná.",
    legend: {
      gain:   "zisk",
      lose:   "ztráta",
      gamble: "hazard",
      racer:  "kůň",
    },
    racer:       "Kůň",
    racers:      "Koně",
    racerField:  "Stáj",
    racingEmoji: "🐎",
  },
  racerRefs: [
    {
      "slotIndex": 0,
      "racer_id": "divoka_ruze"
    },
    {
      "slotIndex": 1,
      "racer_id": "rychly_vitr"
    },
    {
      "slotIndex": 2,
      "racer_id": "zlata_hriva"
    },
    {
      "slotIndex": 3,
      "racer_id": "r6"
    },
    {
      "slotIndex": 4,
      "racer_id": "horse_night_buran"
    }
  ],
  /** @fallback inline data — seed source + runtime fallback pokud registry není dostupná */
  racers: [
    {
      "id": "divoka_ruze",
      "name": "Mariane DR",
      "speed": 2,
      "price": 1200,
      "emoji": "🌹",
      "maxStamina": 100,
      "flavorText": "Nějaká kůň musí být nejlevnější.",
      "image": "https://zyiaettnrfjzwcrumgty.supabase.co/storage/v1/object/public/racers/divoka_ruze.webp",
      "isBuiltIn": true,
      "racerType": "horse",
      "slotIndex": 0
    },
    {
      "id": "rychly_vitr",
      "name": "Razor Wind",
      "speed": 9,
      "price": 4000,
      "emoji": "🟢",
      "maxStamina": 80,
      "isBuiltIn": true,
      "racerType": "horse",
      "slotIndex": 1
    },
    {
      "id": "zlata_hriva",
      "name": "Goldie",
      "speed": 6,
      "price": 3000,
      "emoji": "🟡",
      "maxStamina": 90,
      "image": "https://zyiaettnrfjzwcrumgty.supabase.co/storage/v1/object/public/racers/zlata_hriva.webp",
      "isBuiltIn": true,
      "racerType": "horse",
      "slotIndex": 2
    },
    {
      "id": "r6",
      "name": "Pepík",
      "speed": 4,
      "price": 2500,
      "emoji": "🐴",
      "maxStamina": 100,
      "flavorText": "Pepó! Pepane! Pepíku!!",
      "image": "/themes/_shared/racer-r6.webp",
      "isBuiltIn": true,
      "racerType": "horse",
      "slotIndex": 3
    },
    {
      "id": "horse_night_buran",
      "name": "Burano",
      "speed": 7,
      "price": 5000,
      "emoji": "🐴",
      "maxStamina": 95,
      "flavorText": "Masivní černý kůň, který vítězí silou a výdrží spíš než rychlým startem.",
      "image": "/themes/_shared/racer-horse_night_buran.webp",
      "isBuiltIn": true,
      "racerType": "horse",
      "slotIndex": 4
    },
    {
      "id": "zeleznik",
      "name": "Železník",
      "speed": 10,
      "price": 99999,
      "emoji": "🐴",
      "maxStamina": 10,
      "isLegendary": true,
      "flavorText": "Železník — legendární kůň, který nezná strach, únavu ani druhé místo. Jeho jediný cíl je jasný: vyhrát.",
      "image": "https://zyiaettnrfjzwcrumgty.supabase.co/storage/v1/object/public/racers/zeleznik.webp",
      "racerType": "horse",
      "slotIndex": 5
    },
    {
      "id": "viento_dorado",
      "name": "Hogo fogo",
      "speed": 3,
      "price": 1500,
      "emoji": "🟤",
      "maxStamina": 100,
      "flavorText": "Umí zabrat, ale i shodit jezdce!",
      "image": "https://zyiaettnrfjzwcrumgty.supabase.co/storage/v1/object/public/racers/viento_dorado.webp",
      "racerType": "horse",
      "slotIndex": 6
    }
  ],

  assets: {
    boardBgImage: "/horse-day-board.webp",
  },

  mapMeta: {
    yearStart: 1921,
    place: "Connecticut",
    subtitle: "Sezóna začíná.",
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
        "type": "coins_gain",
        "label": "Drobné po kapsách",
        "emoji": "",
        "amount": 20
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
