# Audit: Bot card_pending stuck fallback

Datum: 2026-06-09  
Stav: read-only audit, žádné změny v kódu

---

## Shrnutí

**Boti sami `card_pending` nikdy nenastaví.** Zpracování karet je u botů čistě server-side
(`executeBotTurnAction` v `bot-actions.ts`, řádky 333–454). Skutečné riziko stuck stavu pochází
z jiného scénáře: **stale `card_pending` po selhání tahu lidského hráče zablokuje bota
na neomezenou dobu**, protože `useOnlineBotTrigger` nemá pro tento případ žádný retry
mechanismus (na rozdíl od `horse_pending`, kde byl přidán `botRetrySeq`).

---

## Jak boti zpracovávají karty

`executeBotTurnAction` (`bot-actions.ts`, řádky 333–454):

1. Server nalosuje kartu (`drawCard`)
2. Okamžitě aplikuje všechny efekty (pohyb, koně, peníze, atd.)
3. Zavolá `botFinishTurn` — ta zapisuje `card_pending: null`
4. `card_pending` se v žádném momentě nenačte

Bot tedy nikdy nevytváří `card_pending` v DB.

---

## Guard v `useOnlineBotTrigger`

`app/components/board/hooks/useOnlineBotTrigger.ts`, řádek 77:

```ts
if (gameState.card_pending) {
  log("card_pending active — skipping bot turn");
  return;
}
```

Bot turn se nespustí, dokud je `card_pending` v DB aktivní. Bez retry mechanismu = permanentní blokace.

---

## Popis stuck scénáře

```
1. Hráč H přistane na poli s kartou
2. GameBoard.tsx (řádek 1061) zapíše card_pending do DB
3. Na klientu hráče H spustí se 7s timer (řádek 1575)
4. Síťové spojení hráče H selže / tab se zavře
5. Timer buď nevystřelí, nebo vystřelí, ale write do DB selže
6. card_pending zůstane v DB neomezeně dlouho
7. Přijde tah bota → useOnlineBotTrigger vidí card_pending → skip
8. Žádný retry → hra je zaseknutá navždy
```

Varianta: hráč H se vrátí online po minutě — 7s timer jest proběhl ve staré closure,
`cardAppliedRef` guard (viz níže) ho zachytí, ale pokud klient úplně odešel, žádný
aplikační kód neexistuje.

---

## Ochrana proti double-apply

`applyCardEffect` (`GameBoard.tsx`, řádky 1374–1562) má explicitní guard:

```ts
// řádek 1377–1378
if (cardAppliedRef.current === card.id + "_" + gameState.turn_count) return;
cardAppliedRef.current = card.id + "_" + gameState.turn_count;
```

Klíč je `cardId + "_" + turn_count`. Jak 7s timer (řádek 1577), tak manuální tlačítko
(řádek 2771) volají přes `applyCardEffectRef` — obě cesty jsou chráněné.

Double-apply tedy není problém pro normální flow. Riziko nastane až při stale `card_pending`
(scénář výše).

---

## Auto-skip logika

`GameBoard.tsx`, řádek 2501:

```ts
if (gameState.horse_pending || gameState.card_pending) return; // počkej až se vyřeší
```

Auto-skip (přeskočení tahu při AFK) také čeká na `card_pending`. V normálním flow je
to správně. Při stale `card_pending` ale auto-skip nikdy nevystřelí → game loop stojí.

---

## Srovnání s horse_pending

| Aspekt | horse_pending | card_pending |
|---|---|---|
| Bot ho vytváří? | Ano (`horse_pending = horse`) | Ne (jen lidský hráč) |
| Guard v botTrigger | `!horse_pending` | `!card_pending` |
| Retry mechanismus | `botRetrySeq` (v0.7.50) | **chybí** |
| Watchdog na host | chybí | chybí |

---

## Pravděpodobnost výskytu

Nízká až střední. Podmínky:
- Hráč přistane na poli s kartou
- Síťové spojení selže přesně v okně mezi zápisem `card_pending` a `applyCardEffect`
- Hráč se nevrátí online (nebo zavřel tab)
- Následuje tah bota

V online hrách s mobilními klienty (nestabilní Wi-Fi / přepnutí sítě) je toto reálný
scénář.

---

## Doporučení: minimální fix

### Varianta A — Host watchdog (preferovaná)

Analogie s race watchdog (GameBoard.tsx, řádky 2616–2633), který už v kódu existuje.

Host by po 30s aktivního `card_pending` zapsal `card_pending: null` přímo do DB.
Efekt karty se ztratí (karta "neexistovala"), ale hra se odblokuje.

```ts
// Vzor — hostův watchdog na stale card_pending
React.useEffect(() => {
  if (!gameState?.card_pending) return;
  if (!isHost && !isLocalGame) return;
  const timer = setTimeout(async () => {
    console.warn("[watchdog] card_pending stale — clearing");
    await supabase
      .from("game_state")
      .update({ card_pending: null })
      .eq("game_id", gameId);
  }, 30_000);
  return () => clearTimeout(timer);
}, [gameState?.card_pending ? "active" : null]);
```

Bezpečnost: pokud hráč H přijde online a timer ještě nevystřelil, `applyCardEffect`
proběhne normálně a watchdog se zruší (`clearTimeout`). Pokud watchdog vystřelí dříve,
`card_pending` se smaže → hráčův `pendingCard` se vyčistí přes Realtime update →
`applyCardEffect` dostane stale kartu, ale ta už není v DB, takže write selže nebo
způsobí no-op (záleží na implementaci).

**Pozor**: aktuální `applyCardEffect` nezapisuje `card_pending: null` podmíněně
(neověřuje, zda `card_pending` stále existuje). Watchdog by bylo potřeba zkombinovat
s ověřením, nebo akceptovat, že efekt karty se v edge case ztratí (přijatelné pro
odblokování hry).

### Varianta B — cardRetrySeq pro bota

Obdobný mechanismus jako `botRetrySeq` pro `horse_pending`:
- `onBotActionComplete` detekuje, že bot byl zablokován `card_pending`
- Incrementuje counter → `useOnlineBotTrigger` se re-triggeruje

Problém: bot se bude nekonečně pokoušet spustit, ale `card_pending` stále blokuje.
Varianta B sama o sobě neřeší stuck — musí být kombinována s Variantou A.

### Varianta C — Server-side timeout

Supabase Edge Function nebo cron job, který maže `card_pending` starší než 60s.
Nejrobustnější, ale mimo scope standardního Next.js projektu.

---

## Závěr

| # | Nález | Závažnost |
|---|---|---|
| R-1 | Boti card_pending nikdy nenastaví — obavy z R-5 v gameboard-audit byly jiné povahy | ✅ V pořádku |
| R-2 | cardAppliedRef guard funguje — double-apply reálně nehrozí | ✅ V pořádku |
| R-3 | Stale card_pending z lidského tahu může zablokovat bota natrvalo | ⚠️ Reálné riziko |
| R-4 | Žádný watchdog ani retry pro card_pending — na rozdíl od horse_pending | ⚠️ Chybí fallback |

**Doporučená akce**: Implementovat host watchdog (Varianta A) analogicky s existujícím
race watchdog. Jeden `useEffect` s 30s timeout, ~10 řádků kódu.

---

## Soubory zahrnuté v auditu

- `app/components/board/hooks/useOnlineBotTrigger.ts` — guard řádek 77
- `app/game/bot-actions.ts` — bot karta processing řádky 333–454
- `app/components/GameBoard.tsx` — `applyCardEffect` (řádky 1374–1562), 7s timer (1565–1582), watchdog vzor (2616–2633), auto-skip (2501)
