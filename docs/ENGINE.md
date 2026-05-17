# Engine — hranice a katalog pure helperů

Sesterský dokument k `docs/ARCHITECTURE.md`. Zaměřen výhradně na herní engine:
co do něj patří, co ne, a jak postupovat při přidávání nových mechanik.

---

## Co je engine vrstva

`lib/engine.ts` je jediné místo pro **pure herní výpočty** — funkce bez React, bez Supabase,
bez side-effectů. Každá funkce v tomto souboru musí být volatelná v unit testu bez mocků.

Ostatní engine-adjacent soubory (minigames, scenarios) řídí se stejným pravidlem:
žádný import z Reactu ani Supabase, žádné globální state.

### Kde co leží

| Vrstva | Soubor | Obsah |
|---|---|---|
| **Pure engine** | `lib/engine.ts` | herní výpočty, normalizace, buildFields |
| **Minigame settlement** | `lib/minigames/settlement.ts` | výpočet výsledku stable duel |
| **Scenario evaluator** | `lib/scenarios/evaluator.ts` | vyhodnocení objectives |
| **Board data** | `lib/board/presets.ts` + `lib/board/index.ts` | deska, pole, racer sloty |
| **Theme data** | `lib/themes/*.ts` | barvy, labels, závodníci, karty |
| **Bot logika** | `app/game/bot-actions.ts` | server action, volá engine helpery |
| **Orchestrátor** | `app/components/GameBoard.tsx` | React, Supabase, UI state |

---

## Co do engine patří

- Herní výpočty závislé jen na vstupních hodnotách (Player, Horse, economy config)
- Transformace dat ze Supabase do interních typů (normalize*)
- Stavba herní desky z BoardConfig + RacerConfig (buildFields)
- Konstanty sdílené mezi UI a bot flow

## Co do engine nepatří

- `import React` nebo libovolný React hook
- `import { supabase }` nebo libovolný Supabase klient
- Přímý přístup na DOM
- Globální state nebo singleton
- Volání `console.log` jako produkční logika (debug console je OK)
- Logování do DB
- Telegram / showTelegram UI side-effecty
- Year event resolution — patří do calleru (potřebuje React refs)
- Fog of war reset — patří do calleru (potřebuje React state)

---

## Katalog pure helperů

### `lib/engine.ts`

#### Ekonomika

```ts
getStartTax(laps: number, economy?: Partial<EconomyConfig>): number
```
Daň za průchod STARTem — roste s počtem kol. `laps=0` → první průchod → 0.

```ts
computeRent(racerPrice: number): number
```
Nájem za přistání na cizím závodníkovi (20 % ceny).

```ts
applyRentPayment(payer: Player, owner: Player, rentAmount: number): { payer: Player; owner: Player }
```
Pure převod rentu mezi dvěma hráči. Žádný side-effect, žádná DB volání.

```ts
applyStartPassage(player: Player, passedOver: boolean, economy: Partial<EconomyConfig>): { player: Player; logLines: string[] }
```
Průchod nebo přistání na STARTu.
- `passedOver=true` → subsidy + laps++ + tax
- `passedOver=false` (přistání přímo) → laps++ + tax (bez subsidy)

Caller zodpovídá za year event a fog reset (vyžadují React kontext).

#### Card effects

```ts
applyStaminaDebuff(player: Player, factor: number, duration: number): Player
```
Aplikuje `stamina_debuff` efekt. No-stacking: předchozí debuff se nahradí novým (refresh duration).
Ostatní `active_effects` zůstávají beze změny.

```ts
resolveGiveRacer(args: {
  racerId?: string;
  fields: Field[];
  players: Player[];
  themeRacers: RacerConfig[];
  randomIndex: number;
}): { horse: Horse; usedFallback: boolean } | null
```
Vybere racera pro `give_racer` card effect. Priorita: named racer na boardu → off-board legendary
v theme rosterech → náhodný fallback z boardu → `null`. Stamina vraceného koně je resetována na max.
`randomIndex` ([0, 1)) předá caller — pure funkce sama `Math.random()` nevolá.

#### Závod

```ts
computeRaceScore(args: { rawScore: number; finalStamina: number; maxStamina: number; debuffFactor: number; isLegendary?: boolean }): number
```
Výsledné skóre závodníka po závodě. Jednotná definice — volat z `closeRaceResult` i z render sekce.
Vzorec: `isLegendary ? rawScore : rawScore × (finalStamina / maxStamina) × debuffFactor`.

#### Závodníci a ownership

```ts
playerOwnsRacer(player: Player, racer: Horse): boolean
racerOwnershipKey(racer: Pick<Horse, "id" | "name">): string
normalizeRacer(rc: RacerConfig): Horse
getPreferredHorse(horses: Horse[]): Horse | null
normalizeFavoriteHorse(horses: Horse[]): Horse[]
```

#### Stav a hráči

```ts
isBankrupt(player: Player): boolean
getNextActiveIndex(currentIndex: number, players: Player[]): number
normalizePlayer(raw: unknown): Player
normalizeState(raw: unknown): GameState
```

#### Deska

```ts
buildFields(board: BoardConfig, racers: RacerConfig[], economy?: Partial<EconomyConfig>): Field[]
```
Sestaví pole herní desky z datové konfigurace. Coin amounts, typy polí a racer sloty
jsou v `BoardConfig`, ne hardcoded v engine.

#### Konstanty

```ts
REROLL_COST       // cena za reroll
REROLL_CHANCE     // pravděpodobnost rerollu
ROLL_CORRECTION_COST  // cena za korekci hodu ±1 krok (sdíleno UI i bot)
```

---

### `lib/minigames/settlement.ts`

```ts
computeMinigameSettlement(input: MinigameSettlementInput): MinigameSettlement
computeDuelReward(p1HorsePrice?, p2HorsePrice?, mafiaBonus?): number
computeBaseDuelReward(p1HorsePrice?, p2HorsePrice?): number
```

Pure výpočet výsledku stable duel — kdo vyhrál, kolik dostane, jak se mění stamina koní.
Žádný React, žádný Supabase. Vzorový pattern pro budoucí minigame helpery.

---

### `lib/scenarios/evaluator.ts`

```ts
evaluatePersonalObjectiveForPlayer(objective, player, players, fields): boolean
evaluateSharedObjectiveForPlayers(objective, players, fields): boolean
evaluateObjectiveForPlayer(objective, player, players, fields): boolean
```

Pure vyhodnocení scenario objectives. Vstup: herní stav. Výstup: splněno / nesplněno.

---

## Přidání nové mechaniky — postup

1. **Definuj data** — do `BoardConfig` (nový typ pole) nebo `EconomyConfig` (nový parametr).
2. **Nová pravidla → pure helper** v `lib/engine.ts`. Signatura: jen herní typy, žádný React.
3. **GameBoard orchestruje** — volá helper, aplikuje výsledek, zapisuje do DB, spouští UI efekty.
4. **Bot flow volá stejný helper** — žádná kopie logiky v `bot-actions.ts`.
5. `npx tsc --noEmit` musí projít bez chyb.

---

## Guidelines pro budoucí velkou mapu

- **Nové typy polí nejdřív data-driven** — přidej do `BoardFieldType` union, pak do `BoardConfig`.
  Teprve potom přidej render větev do `GameBoard.tsx`.
- **Pravidla do pure helperů** — vlastnění pole, nájem, upgrade cena → `lib/engine.ts`.
  Nikdy inline v `rollDice`.
- **GameBoard orchestruje, neobsahuje pravidla** — `rollDice` má volat helpery, ne počítat vzorce.
- **Žádné React/Supabase importy v `lib/engine.ts`** — breakne testovatelnost a oddělení vrstev.
- **Nové ekonomické mechaniky mají mít testovatelný helper** — funkce se vstupem a čistým výstupem,
  bez globálního state.
- **Vlastnictví polí** — až přibude property systém (nákup pole, nájem), modeluj přes
  `applyFieldPurchase` / `applyFieldRent` v engine. DB zápis zůstane v GameBoard / bot-actions.

---

## Card effects — co je kde

Po sérii malých extrakcí je `applyCardEffect` částečně odlehčen.

### Co je vyčleněno do engine helperů

| Card effect | Engine helper |
|---|---|
| `stamina_debuff` | `applyStaminaDebuff` |
| `give_racer` — výběr racera | `resolveGiveRacer` |
| `move` — START crossing | `applyStartPassage` |

### Co zůstává v GameBoard / bot-actions

| Část | Důvod |
|---|---|
| Landing field resolution po `move` | Entangled s horse_pending, chain guard depth=1, rent, React state — každá změna je riskantní regrese |
| Year event po `move` | Vyžaduje React refs (`seenYearEventTurnRef`) a `showTelegram` UI hook |
| Bankrot check / `confirmBankruptOrSell` | Async React modal, nelze vyčlenit |
| DB write blok (`playerUpdate`) | Supabase, záměrně selective (position jen při move, laps jen při změně) |
| `effect2` handling | Malá sekundární větev (3 cases); extrakce by přinesla minimum hodnoty |
| Log texty | Závisí na `card.text` a `player.name` — patří do calleru |

### Proč landing field resolution zatím neměnit

`move` efekt přistane na poli a pak rozhoduje:
- `chance/finance/mafia` → karta se nevylosuje (chain guard depth=1)
- `racer` volný → spustí `horse_pending` purchase flow
- `racer` vlastněný → skip (rent se neaplikuje při pohybu kartou)
- `coins_gain/coins_lose/start` → bezpečná synchronní akce

Toto chování je správné a otestované hraním. Jakýkoliv helper pro landing field by musel
přijmout `fieldsRef`, `players`, a vracet mutation intent — to je přesně stejný kontext, jaký
má GameBoard. Extrakce by přidala abstrakci bez redukce komplexity.

---

## Extraction roadmap

### Hotovo

- ✅ `applyRentPayment` — rent transfer mezi dvěma hráči
- ✅ `computeRaceScore` — scoringová logika závodů (sjednoceno z 2 míst)
- ✅ `applyStartPassage` — START crossing (sjednoceno ze 4 míst: GameBoard×2, bot-actions×2)
- ✅ `applyStaminaDebuff` — stamina debuff aplikace (sjednoceno ze 2 míst)
- ✅ `resolveGiveRacer` — výběr racera pro give_racer efekt (sjednoceno ze 2 míst, opravena maxStamina odchylka)

### Možné malé kroky v budoucnu

- Audit `rollDice` field resolution — zmapovat které části jsou pure a které ne
- Koncept `resolveFieldLanding` — pure funkce vracející "intent" (typ pole, racer info),
  caller rozhodne o side-effectech; zatím jen návrh, ne implementace
- Deduplikace stamina regen logiky (finishTurn) pokud se ukáže jako zdroj bugů
- Event log záznamy jako strukturovaný typ místo string[] — až bude jasný use-case

### Co nedělat teď

- Velký rewrite `GameBoard.tsx` — příliš riskantní, příliš mnoho propojených stavů
- DB migrace pro property systém — ještě není jasný datový model
- Reward persistence bez jasného event logu — neznámé, kdo co zaplatil
- Kompletní refactor `applyCardEffect` najednou — chain guard a horse_pending flow jsou jemné

---

## Known remaining debt

Tato sekce dokumentuje known debt — není výzva k okamžitému refaktoru.

| Oblast | Popis |
|---|---|
| `rollDice` v `GameBoard.tsx` | ~300 řádků, stále obsahuje inline field resolution, mafia logiku, bankrot check, DB zápisy a side-effecty smíchané dohromady |
| `applyCardEffect` | velký switch přes typy karet; pure logika karet z části vytažena, landing field resolution zůstává |
| Landing field resolution po `move` | Zůstává inline v GameBoard i bot-actions — chain guard + horse_pending je entangled, extrakce nepřinese hodnotu |
| Race flow | Celý závod (selection, racing, stamina) zůstává v `GameBoard.tsx`; `computeRaceScore` je extrahován, orchestrace ne |
| Property / vlastnictví polí | Systém neexistuje; budoucí velká mapa ho bude potřebovat jako první |
| Event log pro kontrakty | Zatím není — transakce jako nájem nebo koupě závodníka nemají auditovatelný záznam odděleně od herního logu |
| Bot year events | Bot flow nespouští year eventy při průchodu STARTem (nezávadné pro gameplay, ale nekonzistentní s human flow) |

---

## Jak přidat nový engine helper — checklist

- [ ] Funkce je pure (stejný vstup → stejný výstup, žádný side-effect)
- [ ] Žádný import z Reactu ani Supabase
- [ ] Signatura používá jen typy z `lib/types/game.ts`, `lib/themes`, `lib/board`
- [ ] Přidáno do `lib/engine.ts` nebo do vhodného souboru v `lib/minigames/` nebo `lib/scenarios/`
- [ ] Import přidán do všech callerů (GameBoard.tsx + bot-actions.ts pokud potřeba)
- [ ] `npx tsc --noEmit` = 0 errors
- [ ] Katalog v tomto dokumentu aktualizován
