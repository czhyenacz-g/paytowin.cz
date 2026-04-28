// ─── Karty Náhoda / Finance ───────────────────────────────────────────────────

export type CardEffectKind = "coins" | "skip_turn" | "move" | "give_racer" | "stamina_debuff";

export interface CardEffect {
  kind: CardEffectKind;
  value?: number;    // pro coins a move
  racerId?: string;  // pro give_racer: konkrétní racer ID; pokud chybí → náhodný volný
  /** Multiplikátor pro debuff efekty (0–1). Např. 0.5 = poloviční stamina. */
  factor?: number;
  /** Počet kol hráče, po která efekt trvá. */
  duration?: number;
}

/**
 * themeTags — volitelný příznak pro filtrování karet podle světa hry.
 *
 * "common"  — karta dává smysl v jakémkoliv theme (výchozí, pokud pole chybí)
 * "horse"   — tematicky patří do koňského světa
 * "car"     — tematicky patří do závodů aut
 *
 * Engine zatím karty podle themeTags nefiltruje — pole slouží jen jako datový základ
 * pro budoucí filtrování balíčků per-theme. Karta bez themeTags se chová jako "common".
 */
export type CardThemeTag = "common" | "horse" | "car";

export interface GameCard {
  id: string;
  type: "chance" | "finance" | "mafia";
  text: string;
  effect: CardEffect;
  /** Druhý efekt — jen pro Mafia karty (trade-off: vždy + i -). */
  effect2?: CardEffect;
  effectLabel: string; // zkratka pro UI: "+100 💰", "Vynecháš tah", "Posun +2"
  /** Volitelný obrázek zobrazovaný při reveal karty. Cesta do /public, např. "/cards/zeleznik-reveal.webp". */
  imagePath?: string;
  /** Tematické příznaky — pro budoucí filtrování balíčku podle aktivního theme. Výchozí: "common". */
  themeTags?: CardThemeTag[];
}

// ─── Balíček Náhoda ───────────────────────────────────────────────────────────
// Osud = pohyb, stavové efekty, skip, helper, situační zvraty. Bez peněz.

export const CHANCE_CARDS: GameCard[] = [
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
    id: "ch6",
    type: "chance",
    text: "Chaos před startem tě rozhodil a ty jsi přehlédl signál. Čekáš.",
    effect: { kind: "skip_turn" },
    effectLabel: "Vynecháš příští tah",
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
    text: "Zákeřný sok tvým závodníkům přimíchal do krmení sedativa. Příští 2 kola závodí na poloviční výkon.",
    effect: { kind: "stamina_debuff", factor: 0.5, duration: 2 },
    effectLabel: "Stamina ×0.5 (2 kola)",
  },
  {
    id: "ch10",
    type: "chance",
    text: "Uvědomil sis, že příští závod musíš vyhrát za každou cenu. Vtom se z mlhy vynořil Železník.",
    effect: { kind: "give_racer", racerId: "zeleznik" },
    effectLabel: "Získáš Železníka",
    themeTags: ["horse"],
  },
  {
    id: "ch11",
    type: "chance",
    text: "Policie dnes chrání zákon a pořádek ve společnosti… před tebou. Příliš rychlá jízda. Peněženka to odnesla.",
    effect: { kind: "coins", value: -1500 },
    effectLabel: "-1500 💰",
    imagePath: "/card-police.webp",
    themeTags: ["car"],
  },
  {
    id: "ch12",
    type: "chance",
    text: "Policie dnes chrání zákon a pořádek ve společnosti… před tebou. Dnes nikam nepojedeš.",
    effect: { kind: "skip_turn" },
    effectLabel: "Vynecháš příští tah",
    imagePath: "/card-police.webp",
    themeTags: ["car"],
  },
];

// ─── Balíček Finance ──────────────────────────────────────────────────────────
// Čistě peněžní efekty — žádný pohyb, žádný skip, jen coins.

export const FINANCE_CARDS: GameCard[] = [
  {
    id: "fi1",
    type: "finance",
    text: "Obdržel jsi čtvrtletní prémii od týmu.",
    effect: { kind: "coins", value: 1500 },
    effectLabel: "+1500 💰",
  },
  {
    id: "fi2",
    type: "finance",
    text: "Daňový úřad provedl kontrolu. Doplácíš nedoplatek.",
    effect: { kind: "coins", value: -1200 },
    effectLabel: "-1200 💰",
  },
  {
    id: "fi3",
    type: "finance",
    text: "Investice do závodní výstroje se vyplatila. Dostáváš dividendy.",
    effect: { kind: "coins", value: 900 },
    effectLabel: "+900 💰",
  },
  {
    id: "fi4",
    type: "finance",
    text: "Pojišťovna zamítla tvůj nárok. Platíš z vlastní kapsy.",
    effect: { kind: "coins", value: -1000 },
    effectLabel: "-1000 💰",
  },
  {
    id: "fi5",
    type: "finance",
    text: "Věrnostní bonus od sponzora za tři roky spolupráce.",
    effect: { kind: "coins", value: 2000 },
    effectLabel: "+2000 💰",
  },
  {
    id: "fi6",
    type: "finance",
    text: "Nepředvídané náklady na dopravu závodníků. Zasahuje to rozpočet.",
    effect: { kind: "coins", value: -800 },
    effectLabel: "-800 💰",
  },
  {
    id: "fi7",
    type: "finance",
    text: "Neznámý příznivec ti diskrétně poslal obálku.",
    effect: { kind: "coins", value: 1000 },
    effectLabel: "+1000 💰",
  },
  {
    id: "fi8",
    type: "finance",
    text: "Tisk tě označil za favorita. Sponzoři se hrnou.",
    effect: { kind: "coins", value: 1500 },
    effectLabel: "+1500 💰",
  },
  {
    id: "fi9",
    type: "finance",
    text: "Právě ses dozvěděl, že i v závodění existují odbory.",
    effect: { kind: "coins", value: -2000 },
    effectLabel: "-2000 💰",
  },
];

// ─── Balíček Mafie ────────────────────────────────────────────────────────────
// Princip: vždy + i - zároveň — Don nikdy nedá ani nevezme zadarmo.

export const MAFIA_CARDS: GameCard[] = [
    {
        id: "ma1",
        type: "mafia",
        text: "Na jeden tah zmizíš a budeš zmizelej .. nebo tě zmizím já!",
        effect:  { kind: "coins", value: 1200 },
        effect2:  { kind: "skip_turn" },
        effectLabel: "+1200 💰 / Vynecháš tah",
    },
    {
        id: "ma2",
        type: "mafia",
        text: "Don ti ukázal zkratku. Ne zadarmo.",
        effect:  { kind: "move",  value: 3 },
        effect2: { kind: "coins", value: -800 },
        effectLabel: "+3 pole / -800 💰",
    },
    {
        id: "ma3",
        type: "mafia",
        text: "Don si tě zavolal na „krátkou poradu“. Protáhla se do rána.",
        effect:  { kind: "skip_turn" },
        effect2: { kind: "coins", value: 1500 },
        effectLabel: "Vynecháš tah / +1500 💰",
    },
    {
        id: "ma4",
        type: "mafia",
        text: "Don ti podal obálku. A ukázal ti cestu zpátky.",
        effect:  { kind: "coins", value: 1000 },
        effect2: { kind: "move",  value: -4 },
        effectLabel: "+1000 💰 / -4 pole",
    },
    {
        id: "ma5",
        type: "mafia",
        text: "Zastavili tě jeho lidi. Don o tobě ví.",
        effect:  { kind: "move",  value: -2 },
        effect2: { kind: "coins", value: 600 },
        effectLabel: "-2 pole / +600 💰",
    },
    {
        id: "ma6",
        type: "mafia",
        text: "Zaplatil jsi, jak bylo řečeno. Cesta se otevřela.",
        effect:  { kind: "coins", value: -1000 },
        effect2: { kind: "move",  value: 4 },
        effectLabel: "-1000 💰 / +4 pole",
    },
    {
        id: "ma7",
        type: "mafia",
        text: "Don si vzal, co potřeboval. Při odchodu jsi našel obálku.",
        effect: { kind: "move",  value: -3 },
        effect2: { kind: "coins", value: 800 },
        effectLabel: "-3 pole / +800 💰",
    },
];

// ─── Pomocné funkce ───────────────────────────────────────────────────────────

/**
 * drawCard — náhodně lízne kartu daného typu s filtrováním podle theme.
 *
 * Pokud theme poskytuje vlastní karty (ThemeManifest.cards), použijí se místo globálních.
 * Fallback: pokud theme karty chybí nebo jsou prázdné, použijí se globální balíčky.
 *
 * Filtrování podle themeTags:
 *   - Karta bez themeTags → vždy zahrnuta ("common" chování)
 *   - Karta s themeTags: ["common"] → vždy zahrnuta
 *   - Karta s themeTags: ["horse"] → jen pokud themeTag === "horse"
 *   - Karta s themeTags: ["car"]   → jen pokud themeTag === "car"
 *
 * @param type      "chance" nebo "finance"
 * @param themeCards volitelné per-theme karty (z theme.content?.cards)
 * @param themeTag   aktuální tematický tag (z Theme.cardThemeTag); pokud chybí, jen "common" karty
 */
export function drawCard(
  type: "chance" | "finance" | "mafia",
  themeCards?: { chance?: GameCard[]; finance?: GameCard[]; mafia?: GameCard[] },
  themeTag?: CardThemeTag,
): GameCard {
  const globalDeck = type === "chance" ? CHANCE_CARDS : type === "finance" ? FINANCE_CARDS : MAFIA_CARDS;
  const themeDeck  = type === "chance" ? themeCards?.chance : type === "finance" ? themeCards?.finance : themeCards?.mafia;
  const baseDeck = (themeDeck && themeDeck.length > 0) ? themeDeck : globalDeck;

  // Filtruj podle themeTags: karta bez tagu nebo s "common" vždy prochází.
  // Karta se specifickým tagem prochází jen pokud themeTag odpovídá.
  const deck = baseDeck.filter(c =>
    !c.themeTags ||
    c.themeTags.includes("common") ||
    (themeTag !== undefined && c.themeTags.includes(themeTag))
  );

  // Fallback: pokud by filtrování vyprázdnilo balíček (neočekávané), použij nefiltrovaný.
  const finalDeck = deck.length > 0 ? deck : baseDeck;
  return finalDeck[Math.floor(Math.random() * finalDeck.length)];
}
