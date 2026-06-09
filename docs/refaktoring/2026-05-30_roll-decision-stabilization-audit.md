# Roll decision flow — stabilizační audit

Zpracováno: 2026-05-30

---

## 1. Shrnutí

Po hodu kostkou se hráči zobrazí krátké okno (4 000 ms), ve kterém si může zaplatit korekci o ±1 krok. Flow je implementováno jako `await new Promise<RollAdjustment>` uvnitř `rollDice`, což vytváří přirozené sekvenční pořadí: hod → korekce → pohyb → efekty → finishTurn. Tato inline-async architektura funguje spolehlivě, ale je citlivá na jakýkoliv zásah do pořadí volání nebo sdílených refs.

Dvě malé neshody byly nalezeny a opraveny (viz sekce 6):
- hardcoded `600` místo konstanty `ROLL_CORRECTION_COST`
- UI countdown startující na 3 s při timeoutu 4 000 ms

---

## 2. Aktuální mapa flow

### Krok 1 — Hod kostkou (`rollDice`, ~řádek 843)
- Guard: zkontroluje všechny blokující stavy (pendingRacer, pendingCard, pendingOffer, pendingRollDecision, activePendingRace, pendingBankrupt, stableDuel, isRolling, isMoving, bankruptWarning)
- Vygeneruje `roll = Math.floor(Math.random() * 6) + 1`
- Animace kostky (800–1 200 ms, flicker + sleep)
- `setGhostMoveTarget((currentPlayer.position + roll) % fieldCount)` — ghost indikátor výchozího cíle

### Krok 2 — Otevření korekčního okna
- Zapíše `PendingRollDecision { playerId, playerIndex, baseRoll, basePosition }` do state
- Spustí `setTimeout(() => resolveRollDecision(0), 4000)` — auto-fallback
- UI zobrazí 3 tlačítka (−1 / 0 / +1) a countdown

### Krok 3 — Výběr korekce nebo timeout
- Hráč klikne → `resolveRollDecision(adjustment)` → Promise se resolvuje
- Timeout (4 000 ms) → `resolveRollDecision(0)` automaticky
- `resolveRollDecision`: idempotentní guard (`rollDecisionResolvedRef`), vyčistí timer, null resolver, null state

### Krok 4 — Validace a výpočet (po resolve)
```
adjustmentAllowed = selectedAdjustment !== 0
  && currentPlayer.coins >= ROLL_CORRECTION_COST  // (dříve 600)
  && (roll + selectedAdjustment) >= 1
finalAdjustment = adjustmentAllowed ? selectedAdjustment : 0
finalRoll       = roll + finalAdjustment
adjustmentCost  = finalAdjustment === 0 ? 0 : ROLL_CORRECTION_COST
```

### Krok 5 — Platba a pohyb
- `movedPlayer = { ...currentPlayer, position: newPosition, coins: currentPlayer.coins - adjustmentCost }`
- Animace pohybu pole po poli (loop, sleep 160 ms / pole)
- Průchod STARTem: `applyStartPassage`, daň, year event

### Krok 6 — Field/card efekty (~řádky 932–1240)
- Vyhodnotí typ pole (racer, card, start, rent, gamble, …)
- Rozvětvení: normální pole / racer koupě / rent / skip karta / gamble / …
- Bankrot guard: `isBankrupt(movedPlayer)` → `finishTurn` s bankrot logem

### Krok 7 — Dokončení tahu (`finishTurn`, ~řádek 1656)
- DB write: `players`, `game_state` (current_player_index, turn_count, log, last_roll, offer_pending, …)
- Posun na dalšího hráče
- Bot trigger: pokud je aktuální hráč bot, spustí `botTurn`

---

## 3. Zapojené funkce, state a refs

| Název | Typ | Umístění | Role | Riziko při přesunu |
|---|---|---|---|---|
| `rollDice` | async function | GameBoard.tsx ~843 | Celý turn flow | Velmi vysoké — je to celý flow |
| `resolveRollDecision` | useCallback | GameBoard.tsx ~478 | Resolve promise + cleanup | Střední — závisí na `clearRollDecisionTimer` |
| `clearRollDecisionTimer` | useCallback | GameBoard.tsx ~471 | Vyčistí timeout ref | Nízké — čistá funkce |
| `pendingRollDecision` | useState | GameBoard.tsx ~240 | UI stav korekčního okna | Nízké pro čtení, vysoké pro přesun |
| `rollDecisionCountdown` | useState | GameBoard.tsx ~245 | UI countdown zobrazení | Nízké — čistý UI state |
| `rollDecisionTimerRef` | useRef | GameBoard.tsx ~291 | Timeout handle | Nízké — jen cleanup |
| `rollDecisionResolvedRef` | useRef | GameBoard.tsx ~292 | Idempotency guard | Střední — musí být v closure rollDice |
| `pendingRollResolverRef` | useRef | GameBoard.tsx ~293 | Promise resolver | Vysoké — váže async flow |
| `ghostMoveTarget` | useState | GameBoard.tsx ~238 | Ghost indikátor na boardu | Nízké — čistý vizuální stav |
| `buildRollDecisionOptions` | pure function | lib/game/viewModel.ts:51 | Sestaví možnosti korekce | Nízké — již vyčleněno ✓ |
| `ROLL_CORRECTION_COST` | const (600) | lib/engine.ts:26 | Cena korekce tahu | Nízké — již vyčleněno ✓ |
| `RollAdjustment` | local type | GameBoard.tsx ~165 | `-1 \| 0 \| 1` union | Nízké — mohlo by jít do lib/types |
| Countdown effect | useEffect | GameBoard.tsx ~490 | UI odpočet (3→0) | Nízké — čistý efekt |

---

## 4. Bot / local / online vazby

### Bot
- Po `finishTurn` GameBoard kontroluje `currentPlayer.is_bot` → spustí `botTurn`
- `rollDice` je volán jak pro lidské hráče, tak pro bota (přes `botTurn`)
- Bot nemá UI korekce — ale `resolveRollDecision(0)` se zavolá automaticky timeoutem

### Local hot-seat
- `isMyPendingRollDecisionTurn`: local → `viewerRole === "player"` (kdo drží klávesnici)
- `isMyTurn`: local → `viewerRole === "player" && !isRolling && !isMoving && !hasPendingRollDecision`
- Korekci může provést kdokoliv u klávesnice

### Online
- `isMyPendingRollDecisionTurn`: online → `myPlayerId === pendingRollDecision.playerId`
- Ostatní hráči vidí panel ale tlačítka jsou skrytá (`isMyPendingRollDecisionTurn === false`)
- Timeout se odpočítává lokálně; při timeoutu každý klient volá svůj rollDice nezávisle (online flow obchází to jinak — online hráč spouští rollDice jen pro sebe)

### Current player guard
- `rollDice` guard: `pendingRollDecision` blokuje další hod (idempotency)
- `resolveRollDecision`: `rollDecisionResolvedRef` zabrání dvojímu resolve

### DB/sync
- Korekce se nepíše do DB jako zvláštní krok — `adjustmentCost` se odečítá z `movedPlayer.coins` před DB write v `finishTurn`
- Žádný mezistavový DB zápis pro korekci → korekce je čistě lokální UI operace

---

## 5. Kandidáti na bezpečné vyčlenění

| Kandidát | Cílový soubor | Přínos | Riziko | Doporučení |
|---|---|---|---|---|
| `ROLL_CORRECTION_COST` konstanta | `lib/engine.ts` — **již tam je** | single source of truth | Nízké | Ihned — použít v GameBoard (viz sekce 6) |
| `buildRollDecisionOptions` | `lib/game/viewModel.ts` — **již tam je** | čistá pure funkce | Nízké | Hotovo ✓ |
| `RollAdjustment` typ | `lib/types/game.ts` nebo `lib/game/rollDecision.ts` | sdílený typ | Nízké | Později — není urgentní |
| `clearRollDecisionTimer` callback | zůstat v GameBoard | minimální funkce | — | Ponechat |
| `resolveRollDecision` callback | zůstat v GameBoard | závisí na closure refs | Střední | Ponechat |
| Countdown effect | zůstat v GameBoard | triviální UI efekt | — | Ponechat |
| `rollDice` async funkce | zůstat v GameBoard | vše závisí na closure | Velmi vysoké | Ne teď |

---

## 6. Provedené malé změny

### Změna A — Nahrazení hardcoded `600` za `ROLL_CORRECTION_COST`

**Kde**: `app/components/GameBoard.tsx`, funkce `rollDice`, řádky ~891 a ~895

**Před**:
```js
const adjustmentAllowed = selectedAdjustment !== 0 &&
  currentPlayer.coins >= 600 &&
  (roll + selectedAdjustment) >= 1;
...
const adjustmentCost = finalAdjustment === 0 ? 0 : 600;
```

**Po**:
```js
const adjustmentAllowed = selectedAdjustment !== 0 &&
  currentPlayer.coins >= ROLL_CORRECTION_COST &&
  (roll + selectedAdjustment) >= 1;
...
const adjustmentCost = finalAdjustment === 0 ? 0 : ROLL_CORRECTION_COST;
```

**Proč je to bezpečné**: Čistá konstanta substituce, žádná logická změna. `buildRollDecisionOptions` v `viewModel.ts` ji správně používalo, `rollDice` ne — teď jsou synchronizované.

### Změna B — Countdown start `3` → `4` (match s timeoutem 4 000 ms)

**Kde**: `app/components/GameBoard.tsx`, countdown useEffect, ~řádek 492

**Před**:
```js
setRollDecisionCountdown(3);
```

**Po**:
```js
setRollDecisionCountdown(4);
```

**Proč**: Countdown klesá každých 1 000 ms (3→2→1→0), ale timer je 4 000 ms. Hráč viděl „0 s" přibližně 1 sekundu před auto-resolve, což vypadalo jako prošlý čas. Se startem na `4` countdown zobrazí 4→3→2→1 a pak se okno auto-uzavře — žádná zavádějící nula.

---

## 7. Doporučený další stabilizační krok

**Nejbezpečnější next step**: Vyčlenit `RollAdjustment` typ z lokálního `GameBoard.tsx` do `lib/types/game.ts` nebo nového `lib/game/rollDecision.ts`. Jde o čistý typový přesun bez logiky — `GameBoard` by importoval typ místo lokální definice. Přínos: sdílený typ pro případné budoucí testy nebo oddělené komponenty.

Teprve poté (ne dříve) by dávalo smysl zvažovat, zda `resolveRollDecision` + `clearRollDecisionTimer` lze popsat jako mini-hook — ale jen pokud by existoval jasný testovací případ, který to motivuje.

---

## 8. Ruční testovací scénáře

| Scénář | Co dělat | Očekávaný výsledek |
|---|---|---|
| Hráč bez korekce | Hod → klikni „0 kroků" nebo počkej | Hráč se pohne o původní počet, bez poplatku |
| Hráč s korekcí +1 | Hod → klikni +1 | Hráč se pohne o roll+1, strhne se 600 💰 |
| Hráč s korekcí −1 | Hod → klikni −1 | Hráč se pohne o roll−1, strhne se 600 💰 |
| Timeout bez kliknutí | Hod → nesahej 4 s | Auto-resolve na 0, pohyb o původní roll |
| Nedostatek peněz (< 600) | Hráč má < 600 💰, hod → pokus o ±1 | Tlačítka ±1 jsou disabled, nelze vybrat |
| Roll = 1, korekce −1 | Hod padl 1, pokus o −1 | Tlačítko −1 disabled (finalRoll < 1 není možný) |
| Opakovaný tah (bot) | Bot táhne | Bot nečeká na korekci, timeout projde automaticky |
| Online — jiný hráč | Online hra, není můj tah | Panel korekce viditelný, tlačítka skrytá/readonly |
| Online — můj tah | Online hra, jsem current player | Vidím tlačítka, klik funguje, timeout funguje |
| Reroll offer vs korekce | Korekce a pak padne random reroll offer | Jsou to dvě různé mechaniky, nestírají se |

---

## 9. Rizika a otázky před implementací

1. **`rollDice` je stále monolitický async flow** — jakákoliv budoucí extrakce do hooku musí zachovat closure přístup k `pendingRollResolverRef`, `rollDecisionResolvedRef` a `rollDecisionTimerRef`. Tyto refs nelze jednoduše vyčlenit bez refaktoru celého flow.

2. **Timeout race condition**: `setInterval` (countdown) i `setTimeout` (auto-resolve) mohou firovat ve stejnou milisekundu (~4 000 ms). JavaScript event loop garantuje sekvenční zpracování, ale pořadí není deterministické. V praxi je dopad minimální (na UI rozdíl max. 1 render).

3. **Korekce se nepersistuje do DB** jako zvláštní transakce — je to čistě lokální výpočet aplikovaný těsně před `finishTurn`. Pokud by `finishTurn` selhal (síťový problém), korekce by se ztratila. Toto je pre-existující riziko celého turn flow, ne specifické pro korekci.

4. **Online sync**: V online hře vidí ostatní hráči `pendingRollDecision` state (přes React props / Realtime), ale `resolveRollDecision` volá jen current player (nebo timeout). Pokud by timeout proběhl dříve u jiného klienta než u aktuálního, mohl by stav divergovat. Toto by vyžadovalo server-side timer — v současném designu je záměrně lokální.

5. **Reroll vs. Roll Correction** jsou dvě samostatné mechaniky — neplést:
   - **Roll Correction** (tato část): ±1 krok za `ROLL_CORRECTION_COST` ihned po hodu, vždy dostupné
   - **Reroll** (`REROLL_CHANCE`, `REROLL_COST`): náhodná nabídka po přistání na poli, házení znovu
