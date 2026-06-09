# Rent flow stabilization audit

Datum: 2026-06-09  
Stav: read-only audit, žádné změny v kódu

---

## 1. Kontext

MVP rent mechanismus byl implementován a potvrzen v předchozím auditu
`docs/refaktoring/ownership-fee-dostihy-like-audit.md`. Tento audit se zaměřuje na:
- přesný datový tok rent platby,
- edge cases (bankrot, bot bez forced-sell, dead player ownership),
- UI/Realtime aktualizaci peněz,
- log konzistenci,
- konkrétní nalezené problémy a doporučení.

---

## 2. Současný rent flow

### Sdílené helpery (lib/engine.ts)

```ts
// řádek 159 — pure helper, žádný side-effect
export function computeRent(racerPrice: number): number {
  return Math.round(racerPrice * 0.2); // 20 % ceny racera
}

// řádek 172 — pure helper, žádný side-effect
export function applyRentPayment(
  payer: Player, owner: Player, rentAmount: number
): { payer: Player; owner: Player } {
  return {
    payer: { ...payer, coins: payer.coins - rentAmount },
    owner: { ...owner, coins: owner.coins + rentAmount },
  };
}
```

Orientační výše nájmu podle ceníku v tématu (horse-night):
| Racer | Cena | Nájem (20 %) |
|---|---|---|
| Nejlevnější | 1 200 | 240 |
| Střední | 3 000 | 600 |
| Dražší | ~5 000+ | 1 000+ |

### Databázová RPC (supabase/migrations/20260607_pay_rent_atomic.sql)

```sql
CREATE OR REPLACE FUNCTION pay_rent_atomic(
  p_game_id uuid, p_payer_id uuid, p_owner_id uuid, p_amount integer
) RETURNS TABLE (payer_coins integer, owner_coins integer) ...
```

**Vlastnosti RPC:**
- Validace: `amount > 0`, `payer_id ≠ owner_id`, oba hráči v dané hře
- Deadlock prevention: zamyká oba řádky ve fixním pořadí (menší UUID první)
- Transakce: buď oba UPDATE proběhnou, nebo žádný
- **Záměrně NEblokuje záporné coins** (komentář v SQL: závisí to na pravidlech hry)
- Vrací `(payer_coins, owner_coins)` po převodu

### Člověk → platba nájmu (GameBoard.tsx, řádky 962–1029)

```
1. computeRent(field.racer.price) → rent (pure výpočet)
2. applyRentPayment(movedPlayer, ownerPlayer, rent) → rentedPlayer, paidOwner (pure)
3. wouldBankruptRent = rentedPlayer.coins <= 0 && currentPlayer.coins > 0
4. Pokud wouldBankruptRent → confirmBankruptOrSell(rentedPlayer) → finalRentedPlayer
   - Nabídne prodej koní (80 % hodnoty)
   - Pokud hráč prodá: horses=[], coins navýšeny o sell value
   - Pokud hráč odmítne: player nezměněn (záporné coins)
5. pay_rent_atomic(gameId, finalRentedPlayer.id, paidOwner.id, rent) → RPC
   - DB atomicky: payer.coins_db -= rent, owner.coins_db += rent
   - Returns (payer_coins_db, owner_coins_db)
6. players.UPDATE({ coins: finalRentedPlayer.coins, horses: finalRentedPlayer.horses })
   - Přepíše payer coins DB hodnotou z finalRentedPlayer (post-sell)
   - Owner coins zůstávají jak je zapsal RPC
7. finishTurn()
```

**Záměr**: RPC atomicky přenese rent. Owner coins jsou správné. Payer coins jsou následně
přepsány explicit UPDATE aby reflektovaly případný horse-sell (finalRentedPlayer.coins ≠
rentData[0].payer_coins pokud proběhl sell). Toto je zdokumentováno v komentáři na řádku 1012.

### Bot → platba nájmu (bot-actions.ts, řádky 296–316)

```
1. computeRent(field.racer.price) → rent (identický helper)
2. pay_rent_atomic(gameId, botPlayer.id, ownerPlayer.id, rent) → RPC
3. paidBot = { ...movedPlayer, coins: rentData[0].payer_coins } (z DB)
4. botFinishTurn(gameId, botPlayer, paidBot, updatedForNext, ...)
   - botFinishTurn: stamina regen, active effects decay, DB write
   - game over check: activePlayers.filter(!isBankrupt) → pokud ≤ 1 aktivní hráč, hra končí
```

**Klíčový rozdíl oproti člověku**: Bot **nemá** `confirmBankruptOrSell`. Pokud rent
přesáhne botův zůstatek, bot jde do záporných coins bez forced-sell. Bot může
zkrachovat s koňmi stále v DB.

### Log formáty

```
Člověk: "${hráč} zaplatil ${rent} 💰 hráči ${majitel} za ${emoji} ${jméno}"
Bot:    "${bot} zaplatil nájem ${rent} 💰 hráči ${majitel} za ${emoji} ${jméno}"
```

Drobná nekonzistence: bot log obsahuje slovo "nájem", člověk ne. Oba formáty
identifikují plátce, příjemce, částku i racera — informačně kompletní.

---

## 3. Datová konzistence

### Atomičnost platby

`pay_rent_atomic` RPC garantuje atomický převod na DB úrovni. Race condition
(dva hráči platí rent ve stejný okamžik) je ošetřen deadlock prevention logikou
(fixní pořadí zamykání dle UUID).

### Realtime aktualizace

Oba hráči (plátce i majitel) dostanou aktualizované coins přes Supabase Realtime:
- Subscription `postgres_changes` na tabulce `players` → `refreshGame(gameId)`
- Všichni klienti včetně majitele dostanou nová coins bez nutnosti explicitní akce

### Uvolnění racera při bankrotu

`isBankrupt(player) = player.coins <= 0` (lib/engine.ts:89)

Vlastník je detekován jako:
```ts
const ownerPlayer = players.find(
  p => p.id !== currentPlayer.id && playerOwnsRacer(p, field.racer!)
);
```

`playerOwnsRacer` hledá v `player.horses[]` — **neověřuje zda je hráč bankrot**.

| Scénář bankrotu | horses v DB | playerOwnsRacer vrací | Nájem se platí? |
|---|---|---|---|
| Člověk — prodal koně (sellAll=true) | `[]` | false | ❌ Ne — racer uvolněn ✅ |
| Člověk — odmítl prodat (sellAll=false) | zachovány | true | ✅ Ano — racer NENÍ uvolněn ⚠️ |
| Bot — zkrachoval při rent | zachovány | true | ✅ Ano — racer NENÍ uvolněn ⚠️ |

**Závěr**: Racer se automaticky neuvolní při bankrotu, pokud hráč/bot nezmaže `horses[]`.
Mrtvý hráč může dále přijímat nájem (money jde do záporných — nebo zpět do kladných — čísel).

---

## 4. UI a log

### Co majitel vidí při přijetí nájmu

| Kanál | Stav |
|---|---|
| Textový log v herním panelu | ✅ Zápisek s plátcem, příjemcem, částkou, racerem |
| Aktualizace coins čísla | ✅ Via Realtime (postgres_changes) |
| MajorGain overlay | ❌ Nespustí se — pouze pro coins_gain pole a Stable Duel |
| Zvukový efekt | ❌ Žádný pro příjem nájmu |
| Flash/toast notifikace | ❌ Žádná |

Majitel pasivně dostane aktualizované coins. Pokud právě nesleduje log panel,
nemusí si vůbec všimnout, že mu přišly peníze.

### Co plátce vidí

| Kanál | Stav |
|---|---|
| Textový log | ✅ Zápisek plátce |
| Aktualizace coins | ✅ Okamžitě (lokální state + potvrzeno RPC) |
| Bankrupt warning modal | ✅ Pokud `wouldBankruptRent` (jen člověk) |
| "Prodal koně a přežil!" log | ✅ Pokud forced sell |

---

## 5. Edge cases

| Scénář | Aktuální chování | Riziko | Doporučení |
|---|---|---|---|
| Plátce nemá dost coins (člověk) | `confirmBankruptOrSell` nabídne forced sell | Nízké — ošetřeno | ✅ |
| Plátce odmítne prodat (člověk) | záporné coins, bankrot bez horse sell | Střední — horses zůstanou, racer nevisuvoln | Viz Fix-1 |
| Bot zkrachuje při nájmu | záporné coins, horses zachovány | Střední — racer neuvisuvoln, bot "mrtvý" ale vlastní | Viz Fix-1 |
| Nájem mrtvému majiteli (člověk odmítl sell) | RPC úspěšně převede, majitel dostane coins | Nízké (cosmetic) — mrtvý dostane peníze | Viz Fix-1 |
| Nájem mrtvému botovi | RPC úspěšně převede | Nízké (cosmetic) | Viz Fix-1 |
| Majitel je bankrot ale `coins` po nájmu kladné | Může "oživnout" — není guard | Nízké | Zdokumentovat |
| Race condition dva plátci | pay_rent_atomic garantuje serialize | Nízké | ✅ |
| Rent → owner_coins z RPC vs. explicit UPDATE | Owner: čistě z RPC. Payer: explicit UPDATE přepíše | Design intent, dokumentováno | ✅ |
| Bot nemá `confirmBankruptOrSell` | Bot může jít do záporných coins bez šance prodat | Střední — asymetrie vs člověk | Viz Fix-2 |
| Log "nájem" u bota vs. chybějící u člověka | Drobná nekonzistence v textu | Nízké | Sjednotit log |
| MajorGain pro majitele při příjmu nájmu | Nespustí se vůbec | Nízké — UX gap | Viz Fix-3 |

---

## 6. Doporučený testovací scénář pro manuální ověření

### Scénář A: Člověk platí nájem člověku

1. Vytvoř local hru, 2 hráči
2. Hráč 1: kup racera na poli X (horse_pending → buy)
3. Hráč 2: hoď kostkou, pohni se na pole X
4. ✓ Zobrazí se log s nájem
5. ✓ Hráč 2 ztratí coins (20 % ceny racera)
6. ✓ Hráč 1 získá coins
7. ✓ Stable Duel se NESPUSTÍ (hráč 2 nemá koně)
8. Hráč 2: kup jiného racera. Pak pohni znovu na pole X hráče 1
9. ✓ Stable Duel se spustí (oba mají koně)

### Scénář B: Bot platí nájem člověku

1. Local hra, 1 člověk + 1 bot
2. Člověk: kup racera
3. Počkej na tah bota — bot přistane na poli člověka
4. ✓ Log: "Bot zaplatil nájem X 💰 hráči Y za..."
5. ✓ Bot ztratil coins, člověk získal
6. ✓ Realtime aktualizace bez nutnosti reload

### Scénář C: Plátce jde bankrotem při nájmu

1. Local hra. Nastav hráči nízký zůstatek (edituj v ThemeDevTool nebo db)
2. Přistaň na cizím raceru kde nájem přesáhne zůstatek
3. ✓ Zobrazí se BankruptWarning modal
4. ✓ Nabídka prodeje koní s hodnotou
5. Test A: potvrď sell → horses=[], coins navýšeny, hra pokračuje
6. Test B: odmítni sell → záporné coins, bankrot, horses ZŮSTANOU v DB

### Scénář D: Bot jde bankrotem při nájmu

1. Local hra, bot s minimálním zůstatkem
2. Bot přistane na drahém cizím raceru
3. ✓ Bot zaplatí, coins záporné, `isBankrupt(bot)=true`
4. ✓ Hra detekuje konec (activePlayers ≤ 1)
5. ⚠️ Bot zůstane v DB s koňmi — ověřit supabase dashboard `players.horses`

---

## 7. Doporučené minimální fixy

### Fix-1 (Střední priorita): Racer se neuvolní po bankrotu bez horse-sell

**Problém**: Bot zkrachuje s koňmi. Člověk, který odmítl prodat, zkrachuje s koňmi.
Obě situace vedou k tomu, že mrtvý hráč stále "vlastní" racery → ostatní platí nájem
mrtvému.

**Minimální fix pro bota**:
V `bot-actions.ts` po RPC, pokud `paidBot.coins <= 0`, smazat botovi horses:
```ts
const botBankrupt = rentData[0].payer_coins <= 0;
const paidBot = {
  ...movedPlayer,
  coins: rentData[0].payer_coins,
  ...(botBankrupt ? { horses: [] } : {}),
};
```
A napsat horses do DB v `botFinishTurn` (já tam pisuji horses přes regen, ale prázdné pole
přeskočí podmínku `regenHorses.length > 0` → nutno napsat explicitně).

**Minimální fix pro člověka**:
Pokud `wentBankrupt` → v `finishTurn` nebo ihned po, přepsat `horses: []` v DB pro daného
hráče (nezávisle na tom, zda odmítl sell modal).

**Alternativa (jednodušší)**: Filtrovat `ownerPlayer` lookup tak, aby ignoroval bankrot hráče:
```ts
const ownerPlayer = players.find(
  p => p.id !== currentPlayer.id &&
       !isBankrupt(p) &&          // ← přidat
       playerOwnsRacer(p, field.racer!)
);
```
Toto je nejmenší a nejbezpečnější změna — bankrot hráč se pro účely rent lookupustane
neviditelný, aniž bychom měnili horses v DB.

### Fix-2 (Nízká priorita): Bot nemá forced-sell při bankrotu z nájmu

Bot lze nechat krachovat bez sell (zjednodušuje kód). Ale pokud chceme paritu s člověkem,
bot by měl prodat koně před zaplacením nájmu pokud by jinak šel bankrot. Toto je
gameplay rozhodnutí, ne technický bug.

### Fix-3 (Nízká priorita): Žádný vizuální feedback majiteli při příjmu nájmu

MajorGain overlay se nespustí. Owner dostane coins jen přes Realtime. Pro Dostihy-like
demo by bylo příjemné vidět "dostali jste nájem". Šlo by přidat `showMajorGain(rent, ownerPlayer.id)`
na straně vlastníka — ale owner není vždy na stejném klientu jako plátce.

**Záměrnější řešení**: Rozšíření `CenterEvent` o `rent_received` typ, který každý klient
vypočítá lokálně po Realtime aktualizaci. Mimo scope MVP.

---

## 8. Přesný implementační prompt (Fix-1 varianta ownerPlayer filter)

```
Název problému: Ignorovat bankrot hráče při rent owner lookup

Cíl:
Přidat !isBankrupt(p) do ownerPlayer lookup v rollDice flow GameBoard.tsx.
Stejnou podmínku přidat do analogického místa v bot-actions.ts.

Kontext:
Pokud hráč zkrachuje (coins <= 0) ale horses[] zůstanou v DB (edge case kdy odmítl
forced-sell nebo bot bez forced-sell), ostatní hráči stále platí nájem mrtvému.
Nejmenší fix: ignorovat bankrot hráče v owner lookup.

Soubory:
- app/components/GameBoard.tsx, řádek ~861:
    const ownerPlayer = players.find(
      p => p.id !== currentPlayer.id && playerOwnsRacer(p, field.racer!)
    );
  → přidat && !isBankrupt(p)

- app/game/bot-actions.ts, řádek 259:
    const ownerPlayer = players.find(p => p.id !== botPlayer.id && playerOwnsRacer(p, field.racer!));
  → přidat && !isBankrupt(p)

Validace:
- npm run typecheck
- Ověřit: bankrot hráč s koňmi = racer se chová jako volný (horse_pending)
- Ověřit: normální hra neovlivněna

Verze: navýš PATCH o 1
```

---

## 9. Celkové hodnocení stability

| Oblast | Hodnocení |
|---|---|
| Výpočet nájmu (computeRent) | ✅ Stabilní, pure helper, správně sdílený |
| Atomičnost DB převodu | ✅ Stabilní, RPC s deadlock prevention |
| Člověk rent flow | ✅ Stabilní, bankrot handling implementován |
| Bot rent flow | ⚠️ Funkční, ale chybí forced-sell |
| Realtime aktualizace | ✅ Spolehlivá (postgres_changes → refreshGame) |
| Log formát | ✅ Informačně kompletní, drobná nekonzistence |
| Racer release při bankrotu | ⚠️ Negarantováno (Fix-1 doporučen) |
| UI feedback pro majitele | ⚠️ Jen log + coins update, žádný overlay |
| Race condition | ✅ Ošetřen RPC transakcí |
