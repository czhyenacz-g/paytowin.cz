import type { Theme } from ".";

export const carNightTheme: Theme = {
  id: "car-night",
  name: "Závody aut — Noc",
  description: "Ilegální noční závody. Bez licence, bez svědků, bez slitování.",
  version: "1.0.1",
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
      horse:      "h-[72px] w-[72px] border-sky-500 bg-sky-900 text-sky-300",
      neutral:    "h-[72px] w-[72px] border-slate-600 bg-slate-700 text-slate-300",
      chance:     "h-[72px] w-[72px] border-amber-500 bg-amber-900 text-amber-300",
      finance:    "h-[72px] w-[72px] border-amber-500 bg-teal-900 text-teal-300",
      mafia:      "h-[72px] w-[72px] border-purple-500 bg-purple-900 text-purple-300",
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
    centerTitle:    "Ilegální závody",
    centerSubtitle: "Bez licence. Bez svědků.",
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
    { "slotIndex": 0, "racer_id": "stary_mustang" },
    { "slotIndex": 1, "racer_id": "modra_strela" },
    { "slotIndex": 2, "racer_id": "zlaty_blesk" },
    { "slotIndex": 3, "racer_id": "rychly_demon" },
    { "slotIndex": 4, "racer_id": "car_night_r5" },
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
      "id": "car_night_r5",
      "name": "Tvuj tata",
      "speed": 8,
      "price": 1500,
      "emoji": "🏎️",
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
      "emoji": "🏎️",
      "maxStamina": 100,
      "isLegendary": true,
      "image": "/themes/_shared/racer-r8.webp",
      "isBuiltIn": true,
      "racerType": "car",
      "slotIndex": 5
    }
  ],
  mapMeta: {
    yearStart: 1926,
    place: "Chicago",
    subtitle: "Organizátor neexistuje. Pravidla si dělá vítěz.",
  },
  board: {
    "id": "small",
    "fieldCount": 21,
    "racerSlotIndexes": [3, 10, 13, 17, 19],
    "fields": [
      { "index": 0,  "type": "start",      "label": "Start",              "emoji": "🏁",  "amount": 2000 },
      { "index": 1,  "type": "mafia",      "label": "Konektáž",           "emoji": "🤫",  "amount": 50 },
      { "index": 2,  "type": "coins_lose", "label": "Mechanik",           "emoji": "🔧",  "amount": -600 },
      { "index": 3,  "type": "racer",      "label": "Auto",               "emoji": "🏎️" },
      { "index": 4,  "type": "coins_gain", "label": "Cílová rovinka",     "emoji": "🏁",  "amount": 1500 },
      { "index": 5,  "type": "coins_lose", "label": "Policie",            "emoji": "🚔",  "amount": -800 },
      { "index": 6,  "type": "coins_gain", "label": "Nitro bonus",        "emoji": "⚡",  "amount": 800 },
      { "index": 7,  "type": "coins_lose", "label": "Sabotáž",            "emoji": "💥",  "amount": -1200 },
      { "index": 8,  "type": "chance",     "label": "Noční los",          "emoji": "🃏" },
      { "index": 9,  "type": "coins_gain", "label": "Silná sezóna",       "emoji": "💪",  "amount": 900 },
      { "index": 10, "type": "racer",      "label": "Auto",               "emoji": "🏎️" },
      { "index": 11, "type": "coins_lose", "label": "Porucha motoru",     "emoji": "🔥",  "amount": -500 },
      { "index": 12, "type": "mafia",      "label": "Šéf organizace",     "emoji": "🎩" },
      { "index": 13, "type": "racer",      "label": "Auto",               "emoji": "🏎️" },
      { "index": 14, "type": "finance",    "label": "Černý trh",          "emoji": "💰" },
      { "index": 15, "type": "coins_gain", "label": "Věrný mechanik",     "emoji": "🔩",  "amount": 500 },
      { "index": 16, "type": "coins_lose", "label": "Krádež dílu",        "emoji": "🔩",  "amount": -700 },
      { "index": 17, "type": "racer",      "label": "Auto",               "emoji": "🏎️" },
      { "index": 18, "type": "coins_lose", "label": "Přehřátý motor",     "emoji": "🌡️",  "amount": -600 },
      { "index": 19, "type": "racer",      "label": "Auto",               "emoji": "🏎️" },
      { "index": 20, "type": "chance",     "label": "Noční los",          "emoji": "🃏" }
    ]
  },
  content: {
    "cards": {
      "chance": [
        {
          "id": "ch3",
          "type": "chance",
          "text": "Organizátor tě přesouvá na lepší startovní pozici.",
          "effect": { "kind": "move", "value": 2 },
          "effectLabel": "Posun +2 pole"
        },
        {
          "id": "ch4",
          "type": "chance",
          "text": "Rozhodčí odhalil podvod — vracíš se zpět.",
          "effect": { "kind": "move", "value": -3 },
          "effectLabel": "Posun -3 pole"
        },
        {
          "id": "ch6",
          "type": "chance",
          "text": "Policie zavřela ulici. Čekáš na nový signál.",
          "effect": { "kind": "skip_turn" },
          "effectLabel": "Vynecháš příští tah"
        },
        {
          "id": "ch8",
          "type": "chance",
          "text": "Tvoje startovní číslo bylo přiděleno dvakrát. Chaos v garáži.",
          "effect": { "kind": "move", "value": -2 },
          "effectLabel": "Posun -2 pole"
        },
        {
          "id": "ch9",
          "type": "chance",
          "text": "Zákeřný sok tvým autům podlil palivo. Příští 2 kola jedou na poloviční výkon.",
          "effect": { "kind": "stamina_debuff", "factor": 0.5, "duration": 2 },
          "effectLabel": "Výkon ×0.5 (2 kola)"
        },
        {
          "id": "ch10",
          "type": "chance",
          "text": "Záhadný mecenáš ti nechává v garáži klíče od speciálu. Legendarion je tvůj.",
          "effect": { "kind": "give_racer", "racerId": "r8" },
          "effectLabel": "Získáš Legendariona",
          "themeTags": ["car"]
        }
      ],
      "finance": []
    }
  },
};
