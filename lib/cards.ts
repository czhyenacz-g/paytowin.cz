// ─── Karty Náhoda / Finance ───────────────────────────────────────────────────

export type CardEffectKind = "coins" | "skip_turn" | "move" | "give_racer";

export interface CardEffect {
  kind: CardEffectKind;
  value?: number;    // pro coins a move
  racerId?: string;  // pro give_racer: konkrétní racer ID; pokud chybí → náhodný volný
}

export interface GameCard {
  id: string;
  type: "chance" | "finance";
  text: string;
  effect: CardEffect;
  effectLabel: string; // zkratka pro UI: "+100 💰", "Vynecháš tah", "Posun +2"
}

// ─── Balíček Náhoda ───────────────────────────────────────────────────────────

export const CHANCE_CARDS: GameCard[] = [
  {
    id: "ch1",
    type: "chance",
    text: "Neznámý příznivec ti diskrétně poslal obálku.",
    effect: { kind: "coins", value: 100 },
    effectLabel: "+100 💰",
  },
  {
    id: "ch2",
    type: "chance",
    text: "Zakopl jsi u stáje a rozbil vybavení. Zaplať škodu.",
    effect: { kind: "coins", value: -80 },
    effectLabel: "-80 💰",
  },
  {
    id: "ch3",
    type: "chance",
    text: "Pořadatel tě přemisťuje na lepší startovní pozici.",
    effect: { kind: "move", value: 2 },
    effectLabel: "Posun +2 pole",
  },
  {
    id: "ch4",
    type: "chance",
    text: "Rozhodčí odhalil chybu — vracíš se zpět.",
    effect: { kind: "move", value: -3 },
    effectLabel: "Posun -3 pole",
  },
  {
    id: "ch5",
    type: "chance",
    text: "Tisk tě označil za favorita. Sponzoři se hrnou.",
    effect: { kind: "coins", value: 150 },
    effectLabel: "+150 💰",
  },
  {
    id: "ch6",
    type: "chance",
    text: "Kůň tě zaskočil a ty jsi přehlédl start. Čekáš.",
    effect: { kind: "skip_turn" },
    effectLabel: "Vynecháš příští tah",
  },
  {
    id: "ch7",
    type: "chance",
    text: "Veterinář ti vrátil přeplatek za prohlídku.",
    effect: { kind: "coins", value: 60 },
    effectLabel: "+60 💰",
  },
  {
    id: "ch8",
    type: "chance",
    text: "Tvoje závodní číslo bylo omylem přiděleno dvakrát. Chaos.",
    effect: { kind: "move", value: -2 },
    effectLabel: "Posun -2 pole",
  },
  {
    id: "ch9",
    type: "chance",
    text: "Opuštěný kůň hledá nového majitele. Ujímáš se ho zdarma.",
    effect: { kind: "give_racer" },
    effectLabel: "🐴 Nový závodník zdarma",
  },
];

// ─── Balíček Finance ──────────────────────────────────────────────────────────

export const FINANCE_CARDS: GameCard[] = [
  {
    id: "fi1",
    type: "finance",
    text: "Obdržel jsi čtvrtletní prémii od stáje.",
    effect: { kind: "coins", value: 150 },
    effectLabel: "+150 💰",
  },
  {
    id: "fi2",
    type: "finance",
    text: "Daňový úřad provedl kontrolu. Doplácíš nedoplatek.",
    effect: { kind: "coins", value: -120 },
    effectLabel: "-120 💰",
  },
  {
    id: "fi3",
    type: "finance",
    text: "Investice do závodní výstroje se vyplatila. Dostáváš dividendy.",
    effect: { kind: "coins", value: 90 },
    effectLabel: "+90 💰",
  },
  {
    id: "fi4",
    type: "finance",
    text: "Pojišťovna zamítla tvůj nárok. Platíš z vlastní kapsy.",
    effect: { kind: "coins", value: -100 },
    effectLabel: "-100 💰",
  },
  {
    id: "fi5",
    type: "finance",
    text: "Účetní chyba ve tvůj neprospěch. Celý příští tah řešíš papírování.",
    effect: { kind: "skip_turn" },
    effectLabel: "Vynecháš příští tah",
  },
  {
    id: "fi6",
    type: "finance",
    text: "Věrnostní bonus od sponzora za tři roky spolupráce.",
    effect: { kind: "coins", value: 200 },
    effectLabel: "+200 💰",
  },
  {
    id: "fi7",
    type: "finance",
    text: "Nepředvídané náklady na dopravu koní. Zasahuje to rozpočet.",
    effect: { kind: "coins", value: -80 },
    effectLabel: "-80 💰",
  },
];

// ─── Pomocné funkce ───────────────────────────────────────────────────────────

/**
 * drawCard — náhodně lízne kartu daného typu.
 *
 * Pokud theme poskytuje vlastní karty (ThemeManifest.cards), použijí se místo globálních.
 * Fallback: pokud theme karty chybí nebo jsou prázdné, použijí se globální balíčky.
 *
 * @param type       "chance" nebo "finance"
 * @param themeCards volitelné per-theme karty (z theme.content?.cards)
 */
export function drawCard(
  type: "chance" | "finance",
  themeCards?: { chance?: GameCard[]; finance?: GameCard[] }
): GameCard {
  const globalDeck = type === "chance" ? CHANCE_CARDS : FINANCE_CARDS;
  const themeDeck  = type === "chance" ? themeCards?.chance : themeCards?.finance;
  // Použij theme karty jen pokud jsou neprázdné; jinak fallback na globální balíček
  const deck = (themeDeck && themeDeck.length > 0) ? themeDeck : globalDeck;
  return deck[Math.floor(Math.random() * deck.length)];
}
