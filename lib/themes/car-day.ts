import type { Theme } from ".";

export const carDayTheme: Theme = {
  id: "car-day",
  name: "Závody aut — Den",
  description: "Světlý vzhled, asfaltové závodiště, automobilové závody.",
  isPaid: false,
  priceCzk: 0,
  colors: {
    pageBackground:     "bg-slate-100",
    cardBackground:     "bg-white",
    boardSurface:       "bg-stone-200",
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
      finance:    "h-[72px] w-[72px] border-teal-400 bg-teal-100 text-teal-800",
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
      horse:  "auto",
    },
    racer:      "Auto",
    racers:     "Auta",
    racerField: "Garáž",
  },
  racerRefs: [
    { slotIndex: 0, racer_id: "stary_mustang" },
    { slotIndex: 1, racer_id: "modra_strela" },
    { slotIndex: 2, racer_id: "zlaty_blesk" },
    { slotIndex: 3, racer_id: "rychly_demon" },
    { slotIndex: 4, racer_id: "car_day_r5" },
  ],
  /** @fallback inline data — seed source + runtime fallback pokud registry není dostupná */
  racers: [
    {
      "id": "stary_mustang",
      "name": "Starý Mustang",
      "speed": 2,
      "price": 800,
      "emoji": "🚗"
    },
    {
      "id": "modra_strela",
      "name": "Modrá střela",
      "speed": 3,
      "price": 1500,
      "emoji": "🏎️"
    },
    {
      "id": "zlaty_blesk",
      "name": "Zlatý blesk",
      "speed": 4,
      "price": 2500,
      "emoji": "🟡"
    },
    {
      "id": "rychly_demon",
      "name": "Rychlý démon",
      "speed": 5,
      "price": 4000,
      "emoji": "🔥"
    },
    {
      "id": "car_day_r5",
      "name": "Tvoja mama",
      "speed": 8,
      "price": 1500,
      "emoji": "🐴",
      "maxStamina": 100
    }
  ],
};
