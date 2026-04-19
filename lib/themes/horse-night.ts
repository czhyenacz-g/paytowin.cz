import type { Theme } from ".";

export const horseNightTheme: Theme = {
  id: "horse-night",
  name: "Dostihy — Noc",
  description: "Tmavý vzhled, koňské dostihy za noci.",
  isPaid: false,
  priceCzk: 0,
  colors: {
    pageBackground:     "bg-slate-950",
    cardBackground:     "bg-slate-800",
    boardSurface:       "bg-slate-700",
    boardSurfaceBorder: "border-slate-600",
    centerBackground:   "bg-green-950",
    centerBorder:       "border-green-800",
    centerTitle:        "text-slate-200",
    centerSubtitle:     "text-slate-400",
    fieldStyles: {
      start:      "h-20 w-20 border-red-500 bg-red-800 text-white",
      coins_gain: "h-[72px] w-[72px] border-emerald-500 bg-emerald-900 text-emerald-300",
      coins_lose: "h-[72px] w-[72px] border-red-600 bg-red-950 text-red-300",
      gamble:     "h-[72px] w-[72px] border-violet-500 bg-violet-900 text-violet-300",
      racer:      "h-[72px] w-[72px] border-amber-500 bg-amber-900 text-amber-300",
      horse:      "h-[72px] w-[72px] border-amber-500 bg-amber-900 text-amber-300", // @deprecated alias
      neutral:    "h-[72px] w-[72px] border-slate-600 bg-slate-700 text-slate-300",
      chance:     "h-[72px] w-[72px] border-sky-500 bg-sky-900 text-sky-300",
      finance:    "h-[72px] w-[72px] border-teal-500 bg-teal-900 text-teal-300",
    },
    activePlayerBadge: "bg-amber-400 text-slate-900",
    rollPanelIdle:     "bg-slate-700",
    rollPanelRolling:  "bg-amber-950",
    textPrimary:       "text-slate-100",
    textMuted:         "text-slate-400",
    playerCardActive:  "border-amber-400 bg-slate-700 shadow-sm",
    playerCardNormal:  "border-slate-600 bg-slate-700",
    playerCardHover:   "border-blue-400 bg-slate-600 shadow-sm",
    arenaGradient:     "radial-gradient(ellipse 140% 90% at 50% 50%, #0c1f11 0%, #071a0b 35%, #030d05 65%, #020617 100%)",
  },
  labels: {
    themeName:      "Dostihy — Noc",
    centerTitle:    "Dostihiště",
    centerSubtitle: "Přijdou závody.",
    legend: {
      gain:   "zisk",
      lose:   "ztráta",
      gamble: "hazard",
      horse:  "kůň",
    },
    racer:      "Kůň",
    racers:     "Koně",
    racerField: "Stáj",
  },
  racerRefs: [
    { slotIndex: 0, racer_id: "divoka_ruze" },
    { slotIndex: 1, racer_id: "modry_blesk" },
    { slotIndex: 2, racer_id: "zlata_hriva" },
    { slotIndex: 3, racer_id: "rychly_vitr" },
    { slotIndex: 4, racer_id: "horse_night_buran" },
  ],
  /** @fallback inline data — seed source + runtime fallback pokud registry není dostupná */
  racers: [
    {
      "id": "divoka_ruze",
      "name": "Divoká růže",
      "speed": 2,
      "price": 800,
      "emoji": "🌹"
    },
    {
      "id": "modry_blesk",
      "name": "Modrý blesk",
      "speed": 3,
      "price": 1500,
      "emoji": "🔵"
    },
    {
      "id": "zlata_hriva",
      "name": "Zlatá hříva",
      "speed": 4,
      "price": 2500,
      "emoji": "🟡"
    },
    {
      "id": "rychly_vitr",
      "name": "Rychlý vítr",
      "speed": 5,
      "price": 4000,
      "emoji": "🟢"
    },
    {
      "id": "horse_night_buran",
      "name": "Buran",
      "speed": 10,
      "price": 1500,
      "emoji": "🐴",
      "maxStamina": 100
    }
  ],
};
