# Rent flow manual test

Datum: 2026-06-09  
Metoda: statická code-trace (bez browser testu)  
Stav: žádné změny v kódu

---

## 1. Kontext

Tento report vznikl jako ověření rent flow po fixu zombie ownership (v0.7.54-seno):
- Přidán `!isBankrupt(p)` do `ownerPlayer` lookup v GameBoard.tsx (řádek ~861) a bot-actions.ts (řádek ~259)
- Bankrotovaný hráč/bot s `horses[]` v DB je od teď ignorován při hledání majitele pro účely výběru nájmu

Cíl: ověřit, že živý vlastník stále dostává nájem, bankrotovaný ne a ostatní scénáře zůstaly nedotčené.

---

## 2. Testované scénáře

| # | Scénář | Výsledek | Stav | Poznámka |
|---|---|---|---|---|
| 1 | Člověk platí nájem živému člověku | Viz detail níže | ✅ Kód OK | Code-trace, bez browser testu |
| 2 | Bot platí nájem živému člověku | Viz detail níže | ✅ Kód OK | Code-trace |
| 3 | Člověk platí nájem živému botovi | Viz detail níže | ✅ Kód OK | Code-trace |
| 4 | Bankrotovaný bot s horses[] nevybírá nájem | Viz detail níže | ✅ Fix ověřen | Code-trace — klíčový fix |
| 5 | Bankrotovaný člověk s horses[] nevybírá nájem | Viz detail níže | ✅ Fix ověřen | Code-trace — klíčový fix |
| 6 | Vlastní racer pole — bez nájmu | Viz detail níže | ✅ Neměnno | `alreadyOwned` větev |
| 7 | Volné racer pole — nákupní flow | Viz detail níže | ✅ Neměnno | `else` větev → horse_pending |
| 8 | Realtime UI aktualizace coins | Architektura OK | ⚠️ Bez živého testu | Neověřeno v browseru |

---

### Scénář 1: Člověk platí nájem živému člověku

**Kódová cesta** (GameBoard.tsx, rollDice flow, řádky 858–1029):

```
alreadyOwned = playerOwnsRacer(B, racer)          → false
ownerPlayer  = find(p: p.id≠B && !bankrupt(p) && owns(p, racer)) → A (živý, má racer)

→ else if (ownerPlayer) větev
→ canTriggerRivalsRace(B, A)?
    oba mají koně → Stable Duel
    jinak → Rent fallback:
        rent = computeRent(racer.price)            // 20 %
        { payer: B', owner: A' } = applyRentPayment(B, A, rent)
        pay_rent_atomic(gameId, B.id, A.id, rent)  // atomická DB transakce
        players.UPDATE(B: { coins: B'.coins, ... })
        finishTurn()
```

**Log**: `"B zaplatil ${rent} 💰 hráči A za 🐴 Jméno racera"`

**Výsledek**: ✅ — B ztratí coins, A získá coins, log identifikuje oba, tah pokračuje.

---

### Scénář 2: Bot platí nájem živému člověku

**Kódová cesta** (bot-actions.ts, řádky 257–316):

```
alreadyOwned = playerOwnsRacer(bot, racer)             → false
ownerPlayer  = find(p: p.id≠bot && !bankrupt(p) && owns(p, racer)) → člověk

→ else if (ownerPlayer)
    oba mají koně? → Stable Duel (bot defender)
    jinak → Rent fallback:
        rent = computeRent(racer.price)                // stejný helper
        pay_rent_atomic(gameId, bot.id, člověk.id, rent)
        paidBot = { coins: rentData[0].payer_coins }
        botFinishTurn(...)
```

**Log**: `"Bot zaplatil nájem ${rent} 💰 hráči Člověk za 🐴 Jméno"`

**Výsledek**: ✅ — Bot platí, člověk dostane, log srozumitelný.

---

### Scénář 3: Člověk platí nájem živému botovi

**Kódová cesta** (GameBoard.tsx, stejná jako scénář 1):

```
ownerPlayer = find(p: p.id≠člověk && !bankrupt(p) && owns(p, racer)) → bot (živý)

→ else if (ownerPlayer)
    bot má koně a člověk má koně → Stable Duel (pvbot_awareness mode)
    jinak → Rent fallback (člověk platí botovi)
        wouldBankruptRent = (člověk.coins - rent) <= 0
        → pokud ano: confirmBankruptOrSell(člověk) → nabídne prodej koní
        pay_rent_atomic(gameId, člověk.id, bot.id, rent)
        finishTurn()
```

**Výsledek**: ✅ — Člověk platí botovi, forced-sell funguje pokud hrozí bankrot.

---

### Scénář 4: Bankrotovaný bot s horses[] nevybírá nájem (klíčový fix)

**Vstupní stav**: `deadBot.coins = -100`, `deadBot.horses = [racer_x]`  
**Akce**: živý člověk C vstoupí na pole racer_x

**Kódová cesta** (GameBoard.tsx):

```
alreadyOwned = playerOwnsRacer(C, racer_x)             → false (C racer nevlastní)
ownerPlayer  = find(p:
    p.id ≠ C                         → true pro deadBot
    && !isBankrupt(p)                → !( deadBot.coins <= 0 ) = !(true) = false  ← SKIP
    && playerOwnsRacer(p, racer_x)   → [nevyhodnotí se]
) → undefined
```

→ Falls into `else` branch (žádný živý vlastník):
```
horse_pending = true
players.UPDATE(C.position)
game_state.UPDATE({ horse_pending: true, ... })
log: "C přišel na pole závodníka: 🐴 racer_x"
setPendingRacer(...)   // zobrazí UI nákupní modal
```

**Výsledek**: ✅ — Nájem se neplatí. Racer se chová jako volný. Nákupní offer se zobrazí.

**Vedlejší efekt (žádoucí)**: Pole se ukáže jako volné ke koupi. Hra se neseknula.

---

### Scénář 5: Bankrotovaný člověk s horses[] nevybírá nájem (klíčový fix)

**Vstupní stav**: `deadHuman.coins = 0`, `deadHuman.horses = [racer_y]`  
**Poznámka**: Normálně nastane pokud člověk odmítl forced-sell v BankruptWarning modalu.  
**Akce**: jiný živý hráč D vstoupí na pole racer_y

**Kódová cesta** (GameBoard.tsx) — identická logika jako scénář 4:

```
ownerPlayer = find(p:
    p.id ≠ D
    && !isBankrupt(p)    → !( deadHuman.coins <= 0 ) = false  ← SKIP
    && owns(p, racer_y)
) → undefined
```

→ `else` branch → horse_pending, purchase offer

**Výsledek**: ✅ — Nájem se neplatí. Racer se chová jako volný.

**Poznámka k dostupnosti scénáře**: `isBankrupt` = `coins <= 0`. Hráč s coins = 0 je
bankrotovaný. Bankrotovaný hráč je přeskočen v `getNextActiveIndex` → nedostane další tah.
Ale jiní hráči mohou přistávat na jeho polích → tohle je přesně ošetřený edge case.

---

### Scénář 6: Vlastní racer pole — bez nájmu

**Kódová cesta**:

```
alreadyOwned = playerOwnsRacer(movedPlayer, field.racer) → true

→ if (alreadyOwned) větev:
    log: "A přijel ke své stáji: 🐴 racer"
    players.UPDATE(position, coins, laps)
    finishTurn()   // bez rent, bez horse_pending
```

**Výsledek**: ✅ — Žádný nájem. Žádný purchase modal. Tah plynule pokračuje.

---

### Scénář 7: Volné racer pole (žádný vlastník)

**Kódová cesta**:

```
alreadyOwned = false
ownerPlayer  = undefined (nikdo neowns racer)

→ else větev (řádky 1031–1045):
    horse_pending = true
    players.UPDATE(position)
    game_state.UPDATE({ horse_pending: true, ... })
    setPendingRacer(...)   // purchase UI
```

**Výsledek**: ✅ — Nákupní flow se spustí normálně.

---

### Scénář 8: Realtime / UI aktualizace

**Architektura** (GameBoard.tsx, řádky 617–650):

```ts
supabase.channel(`game:${gameId}`)
  .on("postgres_changes", { table: "players" }, () => refreshGame(gameId))
  .on("postgres_changes", { table: "game_state" }, async () => { ... refreshGame ... })
```

`pay_rent_atomic` RPC provede atomické UPDATE na obou hráčích v `players` tabulce.
Supabase Realtime odešle notifikaci všem subscribed klientům → `refreshGame(gameId)` →
`setPlayers(normalized)` → oba hráči vidí nové coins bez page refresh.

**Výsledek**: ⚠️ Architektura ověřena code-tracingem. **Live browser test neproběhl.**

---

## 3. Zjištěné problémy

Žádný blokující bug nenalezen.

### Drobná observace (non-blocking):

**Log nekonzistence** mezi scénářem 1 a 2:
- Člověk: `"B zaplatil ${rent} 💰 hráči A za..."`
- Bot:    `"Bot zaplatil nájem ${rent} 💰 hráči A za..."`

Slovo `"nájem"` je v bot logu, v human logu není. Cosmetic — neopravovat v tomto tasku.

**Vedlejší efekt fixu — racer se stane koupitelný po bankrotu majitele.**  
Po fixu: pole bankrotovaného vlastníka se chová jako volné → jiný hráč ho může koupit.  
Toto je žádoucí chování (Dostihy-like logika: bankrot = ztráta majetku). Nikoliv bug.

---

## 4. Co nebylo ověřeno

| Oblast | Důvod |
|---|---|
| Realtime live update coins (browser) | Bez přístupu k browseru |
| BankruptWarning modal rendering | Bez přístupu k UI |
| Stable Duel → rent parity | SD je komplexní flow, neřešeno v tomto tasku |
| Multiplayer online ≥ 3 hráči | Bez live session |
| Log panel render na mobilu | Bez device testu |
| `confirmBankruptOrSell` modal UI | Bez browser testu |

---

## 5. Doporučení

**Rent flow je připraveno pro lokální demo (local / hot-seat).**

Code-trace neodhalil žádný blokující bug. Klíčový fix zombie ownership funguje
správně — `!isBankrupt(p)` v obou lookup místech garantuje, že mrtvý hráč nevybírá nájem.

**Před online multiplayer demo doporučuji ověřit v browseru:**

1. Local hra 2 hráči — scénáře 1, 6, 7 (15 minut)
2. Local hra 1 člověk + 1 bot — scénáře 2, 3 (10 minut)
3. Manuálně nastavit v ThemeDevTool nebo Supabase dashboard bot coins = -1,
   ponechat horses[] — jiný hráč vstoupí na pole → ověřit horse_pending (scénář 4)

**Realtime (scénář 8)** je ověřen jen architektonicky — v production demo
stačí sledovat, zda majitel vidí aktualizované coins po rent platbě druhým hráčem
bez refresh.
