# Bot Purchase Year Metadata — Audit bez DB migrace

**Datum:** 2026-05-30  
**Cíl:** Ověřit, zda lze pravidlo "max 1 racer za herní rok" implementovat spolehlivě přes game_state metadata bez DB migrace.

---

## 1. Název problému

Aktuální detekce `alreadyBoughtThisYear` se spoléhá na string matching v game_state.log, který se omezuje na 20 posledních záznamů. V dlouhých hrách se koupi z minulých let vytlačí z logu, což umožní botovi koupit více než 1 racera za rok.

**Cíl:** Najít strukturovaný způsob tracking koupi per rok bez DB migrace.

---

## 2. Co bylo analyzováno

### 2.1 GameState interface (lib/types/game.ts)

```typescript
export interface GameState {
  game_id: string;
  current_player_index: number;
  last_roll: number | null;
  log: string[];                              // Max 20 záznamů
  turn_count: number;
  horse_pending: boolean;
  card_pending: GameCard | null;
  offer_pending: OfferPending | null;
  mass_race_done: boolean;
  revealed_fields: number[];
  bust_order?: string[];                      // Optional, JSONB v DB
  year_event_telegram?: { ... } | null;      // Optional metadata
  race_stars_awarded?: number[];              // Optional pole pro guard
}
```

**Zjištění:**
- Interface dovoluje **optional pole** bez DB migrace
- Existující optional pole (bust_order, year_event_telegram, race_stars_awarded) jsou uložena jako JSONB v PostgreSQL
- To znamená: JSONB pole se zachovávají automaticky, jakékoliv nové pole také

### 2.2 Kde se game_state čte

**bot-actions.ts (fetchBotContext):**
```typescript
supabase.from("game_state").select("*").eq("game_id", gameId).single()
```
→ Vrací **raw data** z DB (nepoužívá normalizeState)

**GameBoard.tsx (refreshGame):**
```typescript
supabase.from("game_state").select().eq("game_id", id).single()
```
→ Načte raw data, pak je passa do `normalizeState()`

### 2.3 normalizeState (lib/engine.ts:347)

```typescript
export function normalizeState(raw: unknown): GameState {
  return {
    game_id: r.game_id as string,
    current_player_index: Number(r.current_player_index),
    // ... ostatní pole ...
    bust_order: Array.isArray(r.bust_order) ? (r.bust_order as string[]) : undefined,
    year_event_telegram: (r.year_event_telegram as { ... }) ?? null,
    // CHYBÍ: race_stars_awarded (v interface ale ne v normalizeState!)
  };
}
```

**Zjištění:**
- normalizeState explicitně deserializuje selected pole
- race_stars_awarded se v normalizeState **nepřeposílá** (bug v existujícím kódu!)
- Pokud přidám bot_purchase_years, GameBoard se o něj postará přes raw raw data, ale normalizeState ho nebude zawírat

### 2.4 Kde se game_state zapisuje

**botFinishTurn (app/game/bot-actions.ts:92–111):**
```typescript
const stateUpdate: Record<string, unknown> = {
  current_player_index: params.nextIndex,
  turn_count: params.turnCount,
  horse_pending: false,
  card_pending: null,
  offer_pending: null,
  log: params.log.slice(0, 20),
};
if (params.lastRoll !== undefined) stateUpdate.last_roll = params.lastRoll;
if (params.revealedFields !== undefined) stateUpdate.revealed_fields = params.revealedFields;

await Promise.all([
  supabase.from("game_state").update(stateUpdate).eq("game_id", gameId),
  // ... players update ...
]);
```

**Zjištění:**
- Supabase .update() automaticky **zachovává** pole co se neupdatují
- Pokud přidám `bot_purchase_years` do stateUpdate, Supabase jej zapíše do JSONB
- Stará pole (bust_order, year_event_telegram, atd.) zůstanou zachovány

### 2.5 Realtime subscription (GameBoard.tsx:570)

```typescript
.on("postgres_changes", { event: "UPDATE", schema: "public", table: "game_state", ... },
  async () => {
    const { state: freshState } = await refreshGame(gameId);
    // ... aktualizuj stav ...
  }
)
```

**Zjištění:**
- Když se game_state updatuje, Realtime se spustí a refreshGame se zavolá
- freshState pak obsahuje **všechna pole** včetně bot_purchase_years (pokud existuje)
- Žádné zvláštní handling není potřeba

---

## 3. Aktuální problém log heuristiky

### 3.1 Implementace

```typescript
const botRacersInLog = logEntries.filter(e => e.includes(`${botPlayer.name} koupil`)).length;
const botRacersOwned = botPlayer.horses.length;
const alreadyBoughtThisYear = botRacersOwned > 0 && botRacersInLog >= botRacersOwned;
```

### 3.2 Selhání v dlouhých hrách

| Scénář | Rok | Tah | Koupi | Log | Horses | Dedekce | Výsledek |
|---|---|---|---|---|---|---|---|
| Normální hra | 1 | 5 | 1. racer | ✓ ["koupil"] | 1 | true | ✓ Blokuje koupi |
| Dlouhá hra po evikci | 1 | 5 | 1. racer | ✓ ["koupil"] | 1 | true | ✓ Blokuje koupi |
| Dlouhá hra po evikci | 2 | 30 | 2. racer | ✗ [] | 1 | false | ❌ **Povolí koupi!** |

**Příklad selhání:**
- Rok 1, tah 5: Bot koupi 1. racera → log: `["Bot1 koupil…", ...]` (botRacersInLog=1, horses=1)
- Rok 1, tah 25: 20+ tahů uplynulo, koupi se vytlačil z logu → log: `[ostatní…]` (botRacersInLog=0, horses=1)
- Rok 2, tah 30: Bot se snaží koupit → `botRacersInLog=0 && horses=1` → `alreadyBoughtThisYear=false` → **POVOLÍ KOUPI** ❌

---

## 4. Lze použít game_state metadata bez DB migrace? ✅ ANO

**Odpověď: ANO, je to bezpečné a vhodné.**

### Důvody

1. **GameState interface je flexibilní**
   - Optional pole se automaticky zachovávají v JSONB
   - Žádná DB migrace neexistuje (schema se nemění)

2. **bot-actions.ts čte raw data**
   - Nepoužívá normalizeState
   - Dostane bot_purchase_years automaticky

3. **Supabase .update() zachovává pole**
   - Pokud přidám bot_purchase_years do stateUpdate, zapíše se bez problémů
   - Stará pole zůstanou intaktní

4. **Backward compatibility**
   - Staré hry bez bot_purchase_years: field bude undefined
   - bot-actions.ts: stateUpdate.bot_purchase_years se prostě neinicijalizuje
   - GameBoard: normalizeState bot_purchase_years neobsahuje (není potřeba)

5. **Bez GameBoard změn**
   - GameBoard se o bot_purchase_years nemusí starat
   - Bot decision se provádí jenom v bot-actions.ts

---

## 5. Navržený tvar metadata

### 5.1 GameState interface

```typescript
export interface GameState {
  // ... existující pole ...
  
  /** Tracking poslední koupi racera pro každého bota (k vynucení max 1 per year).
   *  Key: botPlayer.id, Value: gameYear koupi.
   *  Optional pro backward kompatibilitu se starými hrami.
   *  Např: { "bot123": 1922, "bot456": 1921 }
   */
  bot_purchase_years?: Record<string, number>;
}
```

### 5.2 Typ metadata v DB

```
bot_purchase_years: JSONB = {
  "player-id-1": 1922,
  "player-id-2": 1921
}
```

### 5.3 Logika v app/game/bot-actions.ts

```typescript
// ČTENÍ: před koupi
const purchaseYearForThisBot = state.bot_purchase_years?.[botPlayer.id];
const alreadyBoughtThisYear = purchaseYearForThisBot === gameYear;

// ZÁPIS: po koupi
if (decision === "buy") {
  // ... existující koupi logika ...
  
  // Updatuj metadata
  const updatedBotPurchaseYears = {
    ...state.bot_purchase_years,
    [botPlayer.id]: gameYear
  };
  
  // V botFinishTurn call
  await botFinishTurn(gameId, botPlayer, paidBot, updatedPlayers, {
    nextIndex, 
    turnCount: newTurnCount, 
    log, 
    updatedHorses,
    botPurchaseYears: updatedBotPurchaseYears,  // ← nový parametr
    revealedFields: fogReveal(botPlayer.position),
  });
}
```

### 5.4 Aktualizace botFinishTurn

```typescript
async function botFinishTurn(
  gameId: string,
  botPlayer: Player,
  updatedBotPlayer: Player,
  allPlayers: Player[],
  params: {
    nextIndex: number;
    turnCount: number;
    log: string[];
    lastRoll?: number;
    updatedHorses?: Horse[];
    revealedFields?: number[];
    botPurchaseYears?: Record<string, number>;  // ← nový parametr
  },
) {
  const stateUpdate: Record<string, unknown> = {
    // ... existující pole ...
    log: params.log.slice(0, 20),
  };
  
  if (params.botPurchaseYears !== undefined) {
    stateUpdate.bot_purchase_years = params.botPurchaseYears;
  }
  
  await Promise.all([
    supabase.from("game_state").update(stateUpdate).eq("game_id", gameId),
    // ...
  ]);
}
```

---

## 6. Kde se má číst alreadyBoughtThisYear

**Místo:** app/game/bot-actions.ts :: executeBotHorseDecisionAction, řádek ~479

**Aktuální:**
```typescript
const botRacersInLog = logEntries.filter(e => e.includes(`${botPlayer.name} koupil`)).length;
const botRacersOwned = botPlayer.horses.length;
const alreadyBoughtThisYear = botRacersOwned > 0 && botRacersInLog >= botRacersOwned;
```

**Navržené:**
```typescript
const purchaseYearForThisBot = state.bot_purchase_years?.[botPlayer.id];
const alreadyBoughtThisYear = purchaseYearForThisBot === gameYear;
```

**Důvody:**
- Přesná detekce (rok je uložen strukturovaně)
- Bez závislosti na logu (log se neignoruje)
- Bezpečnější v dlouhých hrách

---

## 7. Kde se má zapisovat last purchase year

**Místo:** app/game/bot-actions.ts :: executeBotHorseDecisionAction, po koupi (řádka ~521)

**Klíčový bod:** Pouze pokud se koupi opravdu provede!

```typescript
if (decision === "buy") {
  // ... existující koupi logika (řádky 493–517) ...
  
  // ← NOVÝ KÓD: aktualizuj bot_purchase_years
  const updatedBotPurchaseYears = {
    ...state.bot_purchase_years,
    [botPlayer.id]: gameYear
  };
  
  const log = [`${botPlayer.name} koupil závodníka ...`, ...logEntries];
  const updatedPlayers = players.map(p => p.id === botPlayer.id ? paidBot : p);
  
  await botFinishTurn(gameId, botPlayer, paidBot, updatedPlayers, {
    nextIndex, 
    turnCount: newTurnCount, 
    log, 
    updatedHorses,
    botPurchaseYears: updatedBotPurchaseYears,  // ← nový parametr
    revealedFields: fogReveal(botPlayer.position),
  });
} else {
  // koupi se neprovedl → bot_purchase_years se nezmění
  const log = [`${botPlayer.name} odmítl koupit...`, ...logEntries];
  await botFinishTurn(gameId, botPlayer, botPlayer, players, { 
    nextIndex, 
    turnCount: newTurnCount, 
    log, 
    revealedFields: fogReveal(botPlayer.position) 
  });
}
```

---

## 8. Rizika

| Riziko | Severity | Mitigace |
|---|---|---|
| **Nový field v game_state** | LOW | Optional field, backward compatible, JSONB support |
| **botFinishTurn signatura** | MEDIUM | Přidej `botPurchaseYears?` parametr; všechny callsites zůstanou OK |
| **Stará data bez bot_purchase_years** | LOW | undefined ?? {} fallback, nic se nerozbije |
| **Bot-actions se mění** | MEDIUM | Minimální změny, single responsibility (bot decision) |
| **GameBoard nezná bot_purchase_years** | NONE | GameBoard to nepotřebuje, není to relevantní pro UI |
| **Normalizestate** | NONE | GameBoard nepoužívá normalizeState pro bot metadata |

---

## 9. Doporučení: IMPLEMENTOVAT

**Verdikt: IMPLEMENTOVAT s minimální detekcí (bez DB migrace).**

### Důvody pro implementaci

1. **Velmi bezpečné** — optional JSONB field, žádná DB schéma change
2. **Strukturované** — rok je uložen explicitně, ne textové string matching
3. **Spolehlivé** — funguje v dlouhých hrách, není omezené na 20 log záznamů
4. **Minimální kód** — změny jen v bot-actions.ts a botFinishTurn
5. **Zero impact GameBoard** — GameBoard se nezmění

### Implementační kroky

1. **lib/types/game.ts** — přidej bot_purchase_years?: Record<string, number>
2. **app/game/bot-actions.ts :: executeBotHorseDecisionAction**
   - Čti `state.bot_purchase_years?.[botPlayer.id]`
   - Porovnaj s `gameYear`
   - Pokud se koupi provede, aktualizuj metadata
3. **app/game/bot-actions.ts :: botFinishTurn**
   - Přidej parametr `botPurchaseYears?: Record<string, number>`
   - Zapiš do stateUpdate pokud existuje
4. **npm run typecheck** — validuj
5. **git commit**

---

## 10. Validace

- ✅ GameState interface je flexibilní (optional pole existují)
- ✅ JSONB na PostgreSQL automaticky handleuje nová pole
- ✅ bot-actions.ts čte raw data (žádný normalization problém)
- ✅ Supabase .update() zachovává pole (no data loss)
- ✅ GameBoard nemusí vědět o bot_purchase_years
- ✅ backward compatible se starými hrami (undefined fallback)
- ✅ Žádná DB migrace (JSONB field je existující)

---

## 11. Změněné soubory (pokud by se implementovalo)

**Přípravy na implementaci:**
- lib/types/game.ts — přidej typ
- app/game/bot-actions.ts — logic pro čtení a zápis bot_purchase_years
- botFinishTurn parametry — nový optional parametr

**Soubory které se NEMĚNÍ:**
- GameBoard.tsx (žádné změny)
- lib/engine.ts normalizeState (nemusí se updatovat)
- lib/bot/botPurchaseStrategy.ts (stávající strategie)
- useOnlineBotTrigger.ts (nemusí se měnit)

---

## Závěr

**Pravidlo "max 1 racer za herní rok" lze implementovat bezpečně bez DB migrace přes game_state.bot_purchase_years metadata.**

Implementace by byla:
- **Bezpečná** — optional JSONB, zero schema changes
- **Čistá** — strukturované metadata místo string matching na logu
- **Spolehlivá** — funkce v dlouhých hrách bez log evikce
- **Minimální** — změny jen v 2 funkcích (executeBotHorseDecisionAction + botFinishTurn)
- **Bezzávislá** — žádný vliv na GameBoard nebo ostatní systémy

**Doporučení: Pokud je "max 1 per year" kritické pro balance, implementovat tuto metadata-based detekci.**
