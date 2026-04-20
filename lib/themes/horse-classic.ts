import type { Theme } from ".";

export const horseClassicTheme: Theme = {
  id: "horse-classic",
  name: "Klasické dostihy",
  description: "Zelené závodiště, krémová pole — autentický boardgame zážitek.",
  isPaid: false,
  priceCzk: 0,
  cardThemeTag: "horse",
  colors: {
    pageBackground:     "bg-amber-50",
    cardBackground:     "bg-amber-50",
    boardSurface:       "bg-green-700/80",
    boardSurfaceBorder: "border-green-900",
    centerBackground:   "bg-green-800",
    centerBorder:       "border-green-600",
    centerTitle:        "text-amber-200",
    centerSubtitle:     "text-green-300",
    fieldStyles: {
      start:      "h-20 w-20 border-red-700 bg-red-600 text-white",
      coins_gain: "h-[72px] w-[72px] border-green-600 bg-amber-100 text-green-900",
      coins_lose: "h-[72px] w-[72px] border-red-400 bg-red-100 text-red-900",
      gamble:     "h-[72px] w-[72px] border-purple-500 bg-purple-100 text-purple-900",
      racer:      "h-[72px] w-[72px] border-amber-600 bg-amber-200 text-amber-900",
      horse:      "h-[72px] w-[72px] border-amber-600 bg-amber-200 text-amber-900", // @deprecated alias
      neutral:    "h-[72px] w-[72px] border-stone-400 bg-stone-100 text-stone-700",
      chance:     "h-[72px] w-[72px] border-sky-500 bg-sky-100 text-sky-900",
      finance:    "h-[72px] w-[72px] border-sky-500 bg-teal-100 text-teal-900",
    },
    activePlayerBadge: "bg-green-900 text-amber-200",
    rollPanelIdle:     "bg-amber-100",
    rollPanelRolling:  "bg-green-100",
    textPrimary:       "text-stone-800",
    textMuted:         "text-stone-500",
    playerCardActive:  "border-green-700 bg-green-50 shadow-sm",
    playerCardNormal:  "border-stone-300 bg-amber-50",
    playerCardHover:   "border-amber-500 bg-amber-100 shadow-sm",
    arenaGradient:     "radial-gradient(ellipse 140% 90% at 50% 50%, #f0fdf4 0%, #dcfce7 30%, #d1fae5 60%, #bbf7d0 100%)",
  },
  labels: {
    themeName:      "Klasické dostihy",
    centerTitle:    "Hipódromo",
    centerSubtitle: "Que gane el mejor.",
    legend: {
      gain:   "ganancia",
      lose:   "pérdida",
      gamble: "apuesta",
      racer:  "caballo",
    },
    racer:       "Kůň",
    racers:      "Koně",
    racerField:  "Stáj",
    racingEmoji: "🐎",
  },
  racerRefs: [
    { slotIndex: 0, racer_id: "sombra_roja" },
    { slotIndex: 1, racer_id: "viento_dorado" },
    { slotIndex: 2, racer_id: "el_relampago" },
    { slotIndex: 3, racer_id: "caballo_real" },
    { slotIndex: 4, racer_id: "horse_classic_pablo" },
  ],
  /** @fallback inline data — seed source + runtime fallback pokud registry není dostupná */
  racers: [
    {
      "id": "sombra_roja",
      "name": "Sombra Roja",
      "speed": 2,
      "price": 800,
      "emoji": "🔴"
    },
    {
      "id": "viento_dorado",
      "name": "Viento Dorado",
      "speed": 3,
      "price": 1500,
      "emoji": "🟤"
    },
    {
      "id": "el_relampago",
      "name": "El Relámpago",
      "speed": 4,
      "price": 2500,
      "emoji": "⚡"
    },
    {
      "id": "caballo_real",
      "name": "Caballo Real",
      "speed": 5,
      "price": 4000,
      "emoji": "👑"
    },
    {
      "id": "horse_classic_pablo",
      "name": "Pablo",
      "speed": 7,
      "price": 1500,
      "emoji": "🐴",
      "maxStamina": 78
    }
  ],
  mapMeta: {
    yearStart: 1921,
    place: "Kentucky",
    subtitle: "Tradice na tribuně, nervy ve stáji.",
  },
};
