# Bot Purchase Strategy — Audit

**Zpracováno:** 2026-05-30  
**Autor:** Code audit

---

## 1. Problém

Bot v PayToWin.cz kupuje racery/koně velmi omezeně — aktuálně působí, že koupi maximálně jednoho racera během hry a pak již žádného dalšího, i když by měl dost peněz.

---

## 2. Analýza kódu

### 2.1 Nákupní logika

Soubor: `lib/bot/botDecision.ts` (18 řádků)

```typescript
export function decideBotHorsePurchase(
  player: Player,
  racer: RacerConfig,
): "buy" | "skip" {
  if (player.horses.length > 0) return "skip";    // ← KLÍČ!
  if (player.coins < racer.price) return "skip";
  return "buy";
}
```

**Problém je na řádku 15:**
```
if (player.horses.length > 0) return "skip";
```

**Překlad:** Pokud bot vlastní JAKÉHOKOLIV racera, nikdy nekoupí dalšího.

### 2.2 Flow spuštění

1. **GameBoard.tsx** (rollDice) — bot si hodí kostkou, skončí na poli se závodníkem
2. **DB:** `game_state.horse_pending = true`
3. **useOnlineBotTrigger.ts** — detekuje `horse_pending`, zavolá `executeBotHorseDecisionAction`
4. **bot-actions.ts:executeBotHorseDecisionAction** — zavolá `decideBotHorsePurchase`
5. Pokud vrátí "buy" → koupi; pokud "skip" → nekoupí

### 2.3 Ekonomika

**Počáteční mince hráče:**
- DEFAULT_STARTING_COINS = 8 000 Kč
- HARD mode: 6 000 Kč
- NORMAL mode (default): 8 000 Kč
- RICH mode: 10 000 Kč

**Daň:**
- baseTax: 500 Kč za projití STARTem
- Může se zvyšovat až na maxTax: 5 000 Kč

**Ceny racerů:**
- Nejsou explicitně v engine.ts, jsou v jednotlivých themes
- Typicky v rozsahu 1 000–3 000 Kč (dle theme)

**Rezerva:**
- Bot typicky má po koupi prvního racera cca 5 000–7 000 Kč
- Daň STARTem odečte 500–5 000 Kč
- Zůstane tedy prostor na druhého racera, ale MVP regulace to zakazuje

---

## 3. Proč bot kupuje málo

### Root Cause: MVP Pravidlo

**Řádek 15 v `botDecision.ts`:**
```typescript
if (player.horses.length > 0) return "skip";
```

Toto je **MVP (Minimum Viable Product) pravidlo**:
- Měl by zajistit, aby bot nevyprodukoval všechny dostupné racery v prvních 2–3 tazích
- Měl by udělat hru méně dominantní vůči hráčům

### Je to bug?

**NE, není to bug.** Je to záměrný limit — komentář ve `botDecision.ts` to potvrzuje:

```typescript
/**
 * MVP pravidla:
 *  - Bot nemá žádného závodníka → kup pokud má dost coinů.
 *  - Bot má závodníka → přeskočit (nezahlcuj stáj).
 */
```

### Je to vedlejší efekt balance?

**ČÁSTEČNĚ.** MVP regulace je moc přísná:
- Zakazuje koupi 2. racera — to je OK
- **ALE** také zakazuje koupi 3., 4., ... racera — to je příliš
- Očekávaný efekt: bot koupi 1–2 racery během hry
- **Skutečnost:** bot koupi 1 racera a pak NIKDY dalšího

---

## 4. Kde se nákup děje

| Místo | Soubor | Řádek | Funkce |
|---|---|---|---|
| Volání decision | app/game/bot-actions.ts | 473 | `executeBotHorseDecisionAction` |
| Samotné nákupy | app/game/bot-actions.ts | 478–497 | DB write horses + coins |
| Rozhodovací logika | lib/bot/botDecision.ts | 11–18 | `decideBotHorsePurchase` |
| Trigger | app/components/board/hooks/useOnlineBotTrigger.ts | 48–49 | Sleduje `horse_pending` |

---

## 5. Návrh 3 nákupních strategií

### Strategie A: Konzervativní (Max 1–2 racery)

**Pravidla:**
- Bez racera: kup pokud máš > 70% ceny racera
- S 1 racerem: kup druhého pokud máš > 60% ceny a 3x cena == zdravá rezerva
- Se 2+ racery: nikdy nekupuj
- Minimální rezerva po koupi: 2 000 Kč (na daň START + emergency)

**Efekt:**
- Bot koupi 1–2 racery během hry
- Běžný pro AI oponentství
- Vyvažuje se s hráči na počtu racerů

**Riziko:** Low — bot není příliš agresivní

### Strategie B: Normální (Max 2–3 racery) ⭐ DOPORUČENÁ

**Pravidla:**
- Bez racera: kup pokud máš > 50% ceny racera
- S 1 racerem: kup druhého pokud máš > 1.5x cena racera
- Se 2 racery: kup třetího pokud máš > 2x cena racera
- Se 3+ racery: nikdy nekupuj
- Minimální rezerva po koupi: 1 500 Kč
- Dodatek: upřednostni levnější racery (prioritizuj racery s nižší cenou)

**Efekt:**
- Bot koupi 2–3 racery během hry
- Realisticky se chová jako hráč
- Rozumné riziko-reward ratio

**Riziko:** Medium — bot je reálnější, ale ne dominantní

### Strategie C: Agresivnější (Max 3–4 racery)

**Pravidla:**
- Bez racera: kup pokud máš > 30% ceny racera
- S 1 racerem: kup druhého pokud máš > cenu racera
- Se 2 racery: kup třetího pokud máš > 0.5x cena racera
- Se 3+ racery: kupuj pokud máš > 3x cena racera
- Minimální rezerva po koupi: 1 000 Kč
- Dodatek: upřednostni drahší racery (strategičtější volba)

**Efekt:**
- Bot koupi 3–4 racery během hry
- Dominantnější přítomnost na trati
- Větší šance na vítězství v racích

**Riziko:** High — bot může být příliš agresivní a dosadit hráče

---

## 6. Doporučená strategie

### Strategie B: Normální

**Důvody:**
1. **Balance:** Bot je realistickější, ale ne dominantní
2. **Gameplay:** Hráči mají šanci konkurovat botovi na počtu racerů
3. **Replayability:** Taktické rozhodování o koupi si zachová hodnotu
4. **Snadné přizpůsobení:** Difficulty se později přidá změnou thresholdů

**Parametry pro Strategii B:**
```
maxRacersOwned = 3          // Bot koupi max 3 racery
minReserveCoins = 1500      // Minimální rezerva = 1 500 Kč
costThreshold1 = 0.50       // 1. racer: koupi pokud coins > 50% ceny
costThreshold2 = 1.50       // 2. racer: koupi pokud coins > 150% ceny
costThreshold3 = 2.00       // 3. racer: koupi pokud coins > 200% ceny
preferCheaperRacers = true  // Upřednostni levnější racery
```

---

## 7. Návrh extrakce do helperu

### Nový soubor: `lib/bot/botPurchaseStrategy.ts` (cca 60 řádků)

```typescript
import type { Player } from "@/lib/types/game";
import type { RacerConfig } from "@/lib/themes";

export interface BotPurchaseParams {
  player: Player;
  racer: RacerConfig;
  difficulty?: "easy" | "normal" | "hard"; // default: "normal"
}

export interface BotPurchaseDecision {
  decision: "buy" | "skip";
  reason?: string; // Debug info: "already owns 3", "not enough coins", "bought 1st racer"
}

const STRATEGIES = {
  easy: {
    maxRacers: 1,
    minReserve: 2000,
    thresholds: [0.7, Infinity], // Kup jen prvního
  },
  normal: {
    maxRacers: 3,
    minReserve: 1500,
    thresholds: [0.5, 1.5, 2.0],
  },
  hard: {
    maxRacers: 4,
    minReserve: 1000,
    thresholds: [0.3, 1.0, 0.5, 3.0],
  },
};

export function decideBotHorsePurchase(
  params: BotPurchaseParams,
): BotPurchaseDecision {
  const { player, racer, difficulty = "normal" } = params;
  const strategy = STRATEGIES[difficulty];

  // Logika...
  // 1. Pokud vlastní max racerů, skip
  // 2. Pokud nemá dost coinů (včetně minReserve), skip
  // 3. Pokud coins > threshold[ownedCount] * racer.price, buy
  // 4. Jinak skip
}
```

### Náhrada v `lib/bot/botDecision.ts`

```typescript
// Staré
export function decideBotHorsePurchase(
  player: Player,
  racer: RacerConfig,
): "buy" | "skip" {
  if (player.horses.length > 0) return "skip";
  if (player.coins < racer.price) return "skip";
  return "buy";
}

// Nové
export function decideBotHorsePurchase(
  params: BotPurchaseParams,
): BotPurchaseDecision {
  return decideBotHorsePurchaseStrategy(params);
}

import { decideBotHorsePurchaseStrategy } from "./botPurchaseStrategy";
```

### Napojení v `app/game/bot-actions.ts`

```typescript
// Staré
const decision = decideBotHorsePurchase(botPlayer, racerCfg);

// Nové
const decision = decideBotHorsePurchase({
  player: botPlayer,
  racer: racerCfg,
  difficulty: "normal", // Lze později předat z game config
});

if (decision.decision === "buy") {
  // koupi...
}
```

---

## 8. API návrhu nového helperu

```typescript
// lib/bot/botPurchaseStrategy.ts

export type BotDifficulty = "easy" | "normal" | "hard";

export interface BotPurchaseParams {
  player: Player;
  racer: RacerConfig;
  difficulty?: BotDifficulty; // default: "normal"
}

export interface BotPurchaseDecision {
  decision: "buy" | "skip";
  reason?: string; // "already owns 3", "insufficient coins", "threshold not met"
}

export function decideBotHorsePurchaseStrategy(
  params: BotPurchaseParams,
): BotPurchaseDecision {
  // Logika podle strategie...
}

// Helpers pro budoucnost
export function setBotDifficultyThreshold(
  difficulty: BotDifficulty,
  threshold: number,
): void {
  // Umožní tuning thresholdů bez změny kódu
}
```

---

## 9. Rizika a mitigace

| Riziko | Popis | Mitigace |
|---|---|---|
| **Balance** | Bot bude příliš agresivní a podlomí hráče | Začít se Strategií B (Normal), měřit winrate bota vs hráčů |
| **Stale state** | Bot koupi racer který mezitím hráč kouil | Guard v `executeBotHorseDecisionAction`: ověřit că field má racer |
| **Coins desynchronization** | Bot myslí, že má dost peněz, ale DB to říká jinak | Turn guard: `turn_count` musí odpovídat (už existuje) |
| **Racer depletion** | Pole se mají omezený počet racerů, bot koupi všechny | Design: typicky 8–12 racerů na desce, bot koupi max 3 → OK |
| **Race imbalance** | Bot s více racery vítězí v racích | Feature: handicap pro bot v minigamech (budoucí práce) |

---

## 10. Validace a testování

### Co otestovat

**Manuální test:**
1. Spusť hru s botem na NORMAL režimu
2. Sleduj kolik racerů bot koupi během 20 tahů
3. Ověř že koupi min. 2–3 racery (ne jen 1)
4. Ověř že nepadne do bankrotu (<1500 Kč)
5. Ověř že race vítězí bot (měl by vítězit 60–70%)

**Unit test (budoucí):**
```typescript
describe("decideBotHorsePurchaseStrategy", () => {
  it("should buy first racer if enough coins", () => {
    const result = decideBotHorsePurchaseStrategy({
      player: { horses: [], coins: 5000 },
      racer: { price: 2000 },
      difficulty: "normal",
    });
    expect(result.decision).toBe("buy");
  });

  it("should not exceed max racers", () => {
    const result = decideBotHorsePurchaseStrategy({
      player: { horses: [r1, r2, r3], coins: 10000 },
      racer: { price: 2000 },
      difficulty: "normal",
    });
    expect(result.decision).toBe("skip");
    expect(result.reason).toContain("owns 3");
  });

  it("should respect minimum reserve", () => {
    const result = decideBotHorsePurchaseStrategy({
      player: { horses: [], coins: 2000 },
      racer: { price: 2000 },
      difficulty: "normal",
    });
    expect(result.decision).toBe("skip");
    expect(result.reason).toContain("insufficient");
  });
});
```

---

## 11. Změněné soubory

Pokud se implementuje:

1. **lib/bot/botPurchaseStrategy.ts** ← nový (60 řádků)
2. **lib/bot/botDecision.ts** ← aktualizovat (wrapper na nový helper)
3. **app/game/bot-actions.ts** ← aktualizovat callsite (1 řádek)

Pokud by se neimplementovalo, pouze audit:

- Žádné změny kódu
- Tento dokument (`docs/refaktoring/bot-purchase-strategy-audit.md`)

---

## 12. Shrnutí

**Problém:** Bot koupi jen 1 racera, nikdy víc.

**Root cause:** MVP pravidlo v `decideBotHorsePurchase`: `if (player.horses.length > 0) return "skip";`

**Řešení:** Nahradit MVP pravidlem vyladitelným pravidlem (Strategie A/B/C) s thresholds a max počtem racerů.

**Doporučení:** **Strategie B (Normal)** — bot koupi 2–3 racery, minimální rezerva 1500 Kč, thresholds podle počtu vlastněných racerů.

**Bezpečná implementace:** Extrakt do `lib/bot/botPurchaseStrategy.ts` s čistým API, zachovat existující flow v bot-actions.ts.

**Riziko:** Low (s Strategií B) — easy tuning, později difficulty settings.
