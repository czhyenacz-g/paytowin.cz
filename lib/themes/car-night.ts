import type { Theme } from ".";

export const carNightTheme: Theme = {
  id: "car-night",
  name: "Závody aut — Noc",
  description: "Tmavý vzhled, noční závodní okruh, automobilové závody.",
  version: "1.0.0",
  isPaid: false,
  priceCzk: 0,
  cardThemeTag: "car",
  colors: {
    pageBackground:     "bg-slate-950",
    cardBackground:     "bg-slate-800",
    boardSurface:       "bg-slate-700/80",
    boardSurfaceBorder: "border-slate-600",
    centerBackground:   "bg-stone-950",
    centerBorder:       "border-stone-700",
    centerTitle:        "text-slate-200",
    centerSubtitle:     "text-slate-400",
    fieldStyles: {
      start:      "h-20 w-20 border-red-500 bg-red-800 text-white",
      coins_gain: "h-[72px] w-[72px] border-emerald-500 bg-emerald-900 text-emerald-300",
      coins_lose: "h-[72px] w-[72px] border-red-600 bg-red-950 text-red-300",
      gamble:     "h-[72px] w-[72px] border-violet-500 bg-violet-900 text-violet-300",
      racer:      "h-[72px] w-[72px] border-sky-500 bg-sky-900 text-sky-300",
      horse:      "h-[72px] w-[72px] border-sky-500 bg-sky-900 text-sky-300", // @deprecated alias
      neutral:    "h-[72px] w-[72px] border-slate-600 bg-slate-700 text-slate-300",
      chance:     "h-[72px] w-[72px] border-amber-500 bg-amber-900 text-amber-300",
      finance:    "h-[72px] w-[72px] border-amber-500 bg-teal-900 text-teal-300",
      mafia:     "h-[72px] w-[72px] border-purple-500 bg-purple-900 text-purple-300",
    },
    activePlayerBadge: "bg-sky-400 text-slate-900",
    rollPanelIdle:     "bg-slate-700",
    rollPanelRolling:  "bg-sky-950",
    textPrimary:       "text-slate-100",
    textMuted:         "text-slate-400",
    playerCardActive:  "border-sky-400 bg-slate-700 shadow-sm",
    playerCardNormal:  "border-slate-600 bg-slate-700",
    playerCardHover:   "border-sky-400 bg-slate-600 shadow-sm",
    arenaGradient:     "radial-gradient(ellipse 140% 90% at 50% 50%, #0f172a 0%, #090f1a 35%, #04080f 65%, #020617 100%)",
  },
  labels: {
    themeName:      "Závody aut — Noc",
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
      "racer_id": "car_night_r5"
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
      "racerType": "camel",
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
      "id": "car_night_r5",
      "name": "Tvuj tata",
      "speed": 8,
      "price": 1500,
      "emoji": "🐴",
      "maxStamina": 100,
      "image": "https://zyiaettnrfjzwcrumgty.supabase.co/storage/v1/object/public/racers/car_night_r5.webp",
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
      "racerType": "unset",
      "slotIndex": 5
    }
  ],
  mapMeta: {
    yearStart: 1926,
    place: "Chicago",
    subtitle: "Motory řvou, účet se vyrovná později.",
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

  content: {
    "cards": {
      "chance": [
        {
          "id": "ch3",
          "type": "chance",
          "text": "Pořadatel tě přemisťuje na lepší startovní pozici.",
          "effect": {
            "kind": "move",
            "value": 2
          },
          "effectLabel": "Posun +2 pole"
        },
        {
          "id": "ch4",
          "type": "chance",
          "text": "Rozhodčí odhalil chybu — vracíš se zpět.",
          "effect": {
            "kind": "move",
            "value": -3
          },
          "effectLabel": "Posun -3 pole"
        },
        {
          "id": "ch6",
          "type": "chance",
          "text": "Chaos před startem tě rozhodil a ty jsi přehlédl signál. Čekáš.",
          "effect": {
            "kind": "skip_turn"
          },
          "effectLabel": "Vynecháš příští tah"
        },
        {
          "id": "ch8",
          "type": "chance",
          "text": "Tvoje závodní číslo bylo omylem přiděleno dvakrát. Chaos.",
          "effect": {
            "kind": "move",
            "value": -2
          },
          "effectLabel": "Posun -2 pole"
        },
        {
          "id": "ch9",
          "type": "chance",
          "text": "Zákeřný sok tvým závodníkům přimíchal do krmení sedativa. Příští 2 kola závodí na poloviční výkon.",
          "effect": {
            "kind": "stamina_debuff",
            "factor": 0.5,
            "duration": 2
          },
          "effectLabel": "Stamina ×0.5 (2 kola)"
        },
        {
          "id": "ch10",
          "type": "chance",
          "text": "Uvědomil sis, že příští závod musíš vyhrát za každou cenu. Čas na legendu!",
          "effect": {
            "kind": "give_racer",
            "racerId": "legendarion"
          },
          "effectLabel": "Získáš Legendariona",
          "themeTags": [
            "horse"
          ]
        }
      ],
      "finance": []
    }
  },
};
