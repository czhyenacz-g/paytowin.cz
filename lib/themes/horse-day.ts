import type { Theme } from ".";

export const horseDayTheme: Theme = {
  id: "horse-day",
  name: "Dostihy — Den",
  description: "Světlý vzhled, vyprahlé závodiště, koňské dostihy.",
  isPaid: false,
  priceCzk: 0,
  colors: {
    pageBackground:     "bg-slate-100",
    cardBackground:     "bg-white",
    boardSurface:       "bg-emerald-50",
    boardSurfaceBorder: "border-emerald-200",
    centerBackground:   "bg-emerald-100",
    centerBorder:       "border-emerald-300",
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
      finance:    "h-[72px] w-[72px] border-teal-400 bg-teal-100 text-teal-800",
    },
    activePlayerBadge: "bg-slate-900 text-white",
    rollPanelIdle:     "bg-slate-100",
    rollPanelRolling:  "bg-amber-100",
    textPrimary:       "text-slate-800",
    textMuted:         "text-slate-500",
    playerCardActive:  "border-slate-900 bg-slate-50 shadow-sm",
    playerCardNormal:  "border-slate-200 bg-white",
    playerCardHover:   "border-blue-400 bg-blue-50 shadow-sm",
    arenaGradient:     "radial-gradient(ellipse 140% 90% at 50% 50%, #fefce8 0%, #fef9c3 30%, #fef08a 65%, #fde047 100%)",
  },
  labels: {
    themeName:      "Dostihy — Den",
    centerTitle:    "Dostihiště",
    centerSubtitle: "Přijdou závody.",
    legend: {
      gain:   "zisk",
      lose:   "ztráta",
      gamble: "hazard",
      racer:  "kůň",
    },
    racer:      "Kůň",
    racers:     "Koně",
    racerField: "Stáj",
  },
  racerRefs: [
    { slotIndex: 0, racer_id: "divoka_ruze" },
    { slotIndex: 1, racer_id: "modry_blesk" },
    { slotIndex: 2, racer_id: "zlata_hriva" },
    { slotIndex: 3, racer_id: "r6" },
    { slotIndex: 4, racer_id: "rychly_vitr" },
    // zeleznik záměrně vynechán — off-board legendary, dán přes chance kartu ch9,
    // ne přes boardové pole. Zůstává v inline racers[] pro give_racer off-board lookup.
  ],
  /** @fallback inline data — seed source + runtime fallback pokud registry není dostupná */
  racers: [
    {
      "id": "divoka_ruze",
      "name": "Divoká růže",
      "speed": 2,
      "price": 80,
      "emoji": "🌹",
      "maxStamina": 100,
      "flavorText": "Nějaká kůň musí být nejlevnější.",
      "image": "https://zyiaettnrfjzwcrumgty.supabase.co/storage/v1/object/public/racers/divoka_ruze.webp",
      "racerType": "horse",
      "slotIndex": 0
    },
    {
      "id": "zlata_hriva",
      "name": "Zlatá hříva",
      "speed": 6,
      "price": 250,
      "emoji": "🟡",
      "maxStamina": 90,
      "image": "https://zyiaettnrfjzwcrumgty.supabase.co/storage/v1/object/public/racers/zlata_hriva.webp",
      "racerType": "horse",
      "slotIndex": 2
    },
    {
      "id": "r6",
      "name": "Pepík",
      "speed": 4,
      "price": 150,
      "emoji": "🐴",
      "maxStamina": 100,
      "flavorText": "Pepó! Pepane! Pepíku!!",
      "image": "https://zyiaettnrfjzwcrumgty.supabase.co/storage/v1/object/public/racers/r6.webp",
      "racerType": "horse",
      "slotIndex": 3
    },
    {
      "id": "rychly_vitr",
      "name": "Rychlý vítr",
      "speed": 9,
      "price": 400,
      "emoji": "🟢",
      "maxStamina": 80,
      "racerType": "horse",
      "slotIndex": 4
    },
    {
      "id": "horse_night_buran",
      "name": "Burano",
      "speed": 7,
      "price": 500,
      "emoji": "🐴",
      "maxStamina": 95,
      "flavorText": "Masivní černý kůň, který vítězí silou a výdrží spíš než rychlým startem.",
      "image": "https://zyiaettnrfjzwcrumgty.supabase.co/storage/v1/object/public/racers/horse_night_buran.webp",
      "racerType": "horse",
      "slotIndex": 6
    },
    {
      "id": "zeleznik",
      "name": "Železník",
      "speed": 10,
      "price": 15000,
      "emoji": "🐴",
      "maxStamina": 10,
      "isLegendary": true,
      "flavorText": "Železník — legendární kůň, který nezná strach, únavu ani druhé místo. Jeho jediný cíl je jasný: vyhrát.",
      "image": "https://zyiaettnrfjzwcrumgty.supabase.co/storage/v1/object/public/racers/zeleznik.webp",
      "racerType": "horse",
      "slotIndex": 5
    }
  ],

  content: {
    "cards": {
      "chance": [
        {
          "id": "ch1",
          "type": "chance",
          "text": "Neznámý příznivec ti diskrétně poslal obálku.",
          "effect": {
            "kind": "coins",
            "value": 1000
          },
          "effectLabel": "+1000 💰"
        },
        {
          "id": "ch2",
          "type": "chance",
          "text": "Zakopl jsi u stáje a rozbil vybavení. Zaplať škodu.",
          "effect": {
            "kind": "coins",
            "value": -800
          },
          "effectLabel": "-800 💰"
        },
        {
          "id": "ch9",
          "type": "chance",
          "text": "Železník!!",
          "effect": {
            "kind": "give_racer",
            "racerId": "zeleznik"
          },
          "effectLabel": "💰💰💰💰💰💰💰💰",
          "imagePath": "/themes/horse-day/horse_legend.webp"
        },
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
          "id": "ch5",
          "type": "chance",
          "text": "Tisk tě označil za favorita. Sponzoři se hrnou.",
          "effect": {
            "kind": "coins",
            "value": 1500
          },
          "effectLabel": "+1500 💰"
        },
        {
          "id": "ch6",
          "type": "chance",
          "text": "Kůň tě zaskočil a ty jsi přehlédl start. Čekáš.",
          "effect": {
            "kind": "skip_turn"
          },
          "effectLabel": "Vynecháš příští tah"
        },
        {
          "id": "ch7",
          "type": "chance",
          "text": "Veterinář ti vrátil přeplatek za prohlídku.",
          "effect": {
            "kind": "coins",
            "value": 600
          },
          "effectLabel": "+600 💰"
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
        }
      ],
      "finance": []
    }
  },
};
