# Audit: Offline hráči a auto-skip chování

**Datum:** 2026-06-02  
**Typ:** Read-only analýza  
**Větev:** main  
**Stav:** Bez implementace — pouze popis současného stavu a doporučení

---

## 1. Reálný scénář

Zakladatel hry přidal dva přátele přes link + bot. Hráli společně, v půlce všichni zavřeli prohlížeč. Po čase se zakladatel vrátil do stejné hry. Hra mu dovolila pokračovat. On a bot hráli; ostatní hráči byli ve hře vidět, ale jejich tahy se „přeskakovaly."

Otázka: Je to záměr, vedlejší efekt, nebo skrytý bug?

---

## 2. Stručné shrnutí současného chování

**Klíčový závěr:** Hra nemá žádný systém detekce online/offline stavu hráčů.  
Přeskakování hráčů je způsobeno **výhradně bankrotem** (`coins ≤ 0`) — ne tím, že jsou offline.

Scénář uživatele má tedy dvě možná vysvětlení:

| Možnost | Co se skutečně stalo |
|---------|---------------------|
| **A — nejpravděpodobnější** | Ostatní hráči zbankrotovali ještě před tím, než všichni odešli. Bankrotiér se automaticky přeskakuje funkcí `getNextActiveIndex()`. Po návratu zakladatele jsou tito hráči stále „vidět" v UI, ale jsou non-active z důvodu bankrotu. |
| **B — méně pravděpodobné** | Hra stojí na tahu offline hráče, nikam se nepohnula, a zakladatel to interpretoval jako „jejich tahy se přeskakují." V tomto případě by hra fakticky stála na daném tahu. |

Možnost A je daleko pravděpodobnější. Hra **neimplementuje** žádný timeout ani auto-skip pro offline živé hráče s coins > 0.

---

## 3. Kde v kódu se řeší online/offline/reconnect

### 3.1 Přítomnost (presence) — NEEXISTUJE

Kód neobsahuje žádný Supabase Realtime presence channel. Hledaná volání nenalezena:

```
.presence()    — NENALEZENO
.track()       — NENALEZENO
is_online      — NENALEZENO v DB schématu
last_seen      — NENALEZENO v DB schématu
last_heartbeat — NENALEZENO v DB schématu
```

Hra **neví**, kdo je právě připojen.

### 3.2 Identita hráče — pouze localStorage

Hráč je rozpoznán přes `localStorage.getItem(`paytowin_player_${gameCode}`)`, který vrátí jeho `player.id`.

**`app/components/GameBoard.tsx` ~line 155:**
```typescript
const pid = localStorage.getItem(`paytowin_player_${gameCode}`);
// Pokud pid odpovídá hráči ve hře → myPlayerId = pid
// Pokud ne → spectator
```

### 3.3 Reconnect — implicitní, žádný handler

Když se hráč vrátí, aplikace:
1. Načte stav ze Supabase
2. Naváže Realtime subscription na `players`, `games`, `game_state`
3. Nastaví `myPlayerId` z localStorage

Žádný explicitní reconnect flow neexistuje. Pokud je hráčův tah v momentě návratu na něm, může hrát normálně.

### 3.4 Realtime subscription

**`app/components/GameBoard.tsx` ~lines 200–280:**
```typescript
const channel = supabase
  .channel(`game:${gameId}`)
  .on("postgres_changes", { event: "UPDATE", table: "games" }, ...)
  .on("postgres_changes", { event: "*",      table: "players", filter: `game_id=eq.${gameId}` }, ...)
  .on("postgres_changes", { event: "UPDATE", table: "game_state", ... }, ...)
  .subscribe();
```

Subscription se obnoví při každém načtení stránky. Žádný heartbeat ani timeout.

---

## 4. Kde v kódu se řeší skip tahu

### 4.1 `getNextActiveIndex` — přeskakuje pouze bankrotáře

**`lib/engine.ts` lines 314–323:**
```typescript
export function getNextActiveIndex(currentIndex: number, players: Player[]): number {
  if (players.length === 0) return 0;
  let next = (currentIndex + 1) % players.length;
  let attempts = 0;
  while (isBankrupt(players[next]) && attempts < players.length) {
    next = (next + 1) % players.length;
    attempts++;
  }
  return next;
}

export function isBankrupt(player: Player): boolean {
  return player.coins <= 0;  // ← JEDINOU podmínkou je bankrot
}
```

**Offline hráč s coins > 0 se NIKDY automaticky nepřeskočí.**

### 4.2 Skip z karty — `skip_next_turn` flag

Karty s efektem `skip_turn` nastaví `player.skip_next_turn = true` v DB.

**`app/components/GameBoard.tsx` ~line 2366:**
```typescript
// Auto-skip: pokud má aktuální hráč skip_next_turn = true, přeskočíme jeho tah
React.useEffect(() => {
  if (!currentP?.skip_next_turn) return;
  const isActiveClient = gameMode === "local"
    ? viewerRole === "player"
    : myPlayerId === currentP.id;   // ← Spouští jen postižený hráč sám
  if (!isActiveClient) return;
  // ... doSkip() ...
}, [gameState?.current_player_index, players.map(p => p.skip_next_turn).join(",")]);
```

**Problém:** Skip z karty spouští **pouze klient postiženého hráče**. Pokud je tento hráč offline, skip se nespustí. Tah stojí.

### 4.3 Bot skip z karty — bot-actions.ts

**`app/game/bot-actions.ts` ~line 159:**
```typescript
if (botPlayer.skip_next_turn) {
  const nextSkipIndex = getNextActiveIndex(state.current_player_index, players);
  await supabase.from("players").update({ skip_next_turn: false }).eq("id", botPlayer.id);
  await supabase.from("game_state").update({ current_player_index: nextSkipIndex, ... });
  return { ok: true };
}
```

Bot zvládá skip sám. Lidský hráč ne.

### 4.4 Přehledná tabulka všech skip cest

| Situace | Handler | Kdo spouští | Offline hráč? |
|---------|---------|-------------|----------------|
| Hráč má `coins ≤ 0` (bankrot) | `getNextActiveIndex()` | Kdokoli volá `finishTurn` | Funguje i offline ✓ |
| Hráč má `skip_next_turn = true` (karta) | useEffect v GameBoard | **Jen klient daného hráče** | **Nefunguje offline ✗** |
| Bot má `skip_next_turn = true` | `executeBotTurnAction` | Jakýkoli aktivní klient | Funguje ✓ |
| Tah bota | `useOnlineBotTrigger` + `executeBotTurnAction` | Jakýkoli aktivní klient s `myPlayerId` | N/A |
| Timeout offline hráče | **NEEXISTUJE** | — | **Chybí ✗** |

---

## 5. Co se děje s odpojenými hráči

### 5.1 Stav hry po odchodu všech hráčů

Hra v DB zůstane přesně tak, jak byla při posledním tahu. `current_player_index` ukazuje na hráče, který byl na tahu.

### 5.2 Po návratu zakladatele

- Načte se aktuální stav z DB
- Zakladatel obnoví svou identitu přes localStorage
- Realtime subscription se znovu naváže

### 5.3 Proč jsou ostatní hráči „přeskakováni" (nejpravděpodobnější vysvětlení)

Pokud ostatní hráči zbankrotovali (`coins ≤ 0`) ještě před tím, než všichni odešli:
- `getNextActiveIndex` je vždy přeskočí
- V UI jsou stále viditelní (zobrazují se i bankrotáři), ale nehrají
- Zakladatel a bot střídají tahy bez překážek

To odpovídá popsanému chování scénáře — **nejde o bug offline detekce, ale o standardní chování po bankrotu**.

### 5.4 Alternativní scénář: hra stojí na tahu offline hráče s coins > 0

Pokud offline hráč **nebankrotoval**, hra stojí na jeho tahu a nikdo jiný nemůže hrát. Výjimka: pokud měl nastaveno `skip_next_turn` z předchozí karty — ale jeho vlastní klient to musí spustit, takže i to stojí.

---

## 6. Co se děje při návratu hráče

### 6.1 Hráč se vrátí na svůj tah

Hra čeká. Hráč vidí, že je na tahu, a může hrát normálně. Žádná ztráta identity.

### 6.2 Hráč se vrátí na cizí tah

Hráč vidí stav hry, čeká na svůj tah. Realtime subscription dostává aktualizace. Vše funguje.

### 6.3 Hráč se vrátí a zjistí, že zbankrotoval (byl offline při START poli)

Pokud jiný klient (bot trigger nebo hráč) provedl START daň a hráč zbankrotoval offline — hráč se vrátí jako bankrotující účastník ve vizuálním logu, ale nemůže hrát.

### 6.4 Hráč se vrátí a chybí localStorage klíč (jiný prohlížeč, incognito)

`myPlayerId = null` → **role spectator**. Hráč vidí hru, ale nemůže hrát ani se identifikovat. Neexistuje žádná recovery cesta přes Discord přihlášení ani kód hry. Toto je tiché selhání.

---

## 7. Dopad na boty

### 7.1 Bot jako záchrana aktivní hry

Jakýkoli klient s `myPlayerId` (i ten jediný, který se vrátil) spouští bot tahy. Bot tedy hraje normálně bez závislosti na ostatních hráčích.

### 7.2 Bot NEMŮŽE spustit skip za offline lidské hráče

Bot trigger (`useOnlineBotTrigger`) spouští akce **pouze pokud je current player bot**. Pokud je current player offline člověk, bot čeká.

### 7.3 Výsledek scénáře: 1 člověk + bot + offline lidé

- Bot hraje normálně (spouší aktivní klient)
- Offline lidé — pokud jsou bankrotáři → přeskakují se automaticky ✓
- Offline lidé — pokud mají coins > 0 → hra stojí na jejich tahu ✗

Pokud tedy uživatel popisuje, že on + bot hrají bez problémů, ostatní hráči pravděpodobně zbankrotovali před odchodem.

---

## 8. Dopad na XP / win stars / unlocky

### 8.1 XP award — `awardXpAction`

**`app/game/actions.ts` ~line 17:**

Všichni hráči s `discord_id` dostanou XP_BASE (50). Výherce dostane +100. 2. a 3. místo dle `bust_order`.

**Offline hráči jsou zahrnuti.** Hra nerozlišuje, zda hráč byl online do konce nebo odešel v půlce.

### 8.2 Win star guard — `awardWinStarAction`

**`app/game/actions.ts` lines 234–235:**
```typescript
const humanPlayers = (players ?? []).filter(p => !p.is_bot && p.discord_id);
if (humanPlayers.length < 2) return { ok: false, error: "Méně než 2 hráči s Discord identitou" };
```

Guard kontroluje **celkový počet Discord hráčů při zakládání hry**, ne kolik jich bylo aktivních. Pokud 2 přátelé + zakladatel hráli na začátku a pak odešli, guard projde a zakladatel dostane win star i za „výhru" proti offline hráčům.

### 8.3 XP unlocky map

Unlocky jsou na základě `xp_total`. XP se uděluje za účast (XP_BASE) i za výhru. Offline hráč, který pouze startoval hru a odešel, stále dostane XP_BASE pokud je v DB s discord_id.

### 8.4 Souhrn rizika farmení

| Akce | Guard | Riziko |
|------|-------|--------|
| XP_BASE (50 XP) za účast | Žádný guard na aktivitu | Lze dostat 50 XP za hru bez jediného tahu pokud jiný hráč hru dohraje |
| XP_WINNER (100 XP) | `coins > 0` na konci | Reálné riziko nízké — vítěz musel hrát |
| Win star | ≥2 Discord hráčů celkově | **Reálné riziko** — lze získat win star výhrou nad offline hráči |
| Map unlock (XP threshold) | XP_BASE po účasti | Nízké riziko — postupné odemykání |

---

## 9. Rizika současného stavu

### 9.1 Kritické — hra může stát na tahu offline hráče

Pokud offline hráč (s coins > 0) je na tahu, hra stojí a nikdo jiný nemůže hrát. Neexistuje žádný timeout ani admin skip. Hru v tomto stavu nelze bez zásahu do DB odblokovat.

**Severity:** Kritická pro produkci s reálnými hráči.

### 9.2 Střední — win star za výhru nad offline hráči

Zakladatel může dohrát hru sám (ostatní zbankrotovali nebo byli offline) a dostat win star, jako by porazil živé hráče. Guard existuje (≥2 Discord hráčů), ale nerozlišuje offline/online účast.

**Severity:** Střední — riziko nefér progresu nebo farmení.

### 9.3 Nízké — ztráta identity v incognito / jiném zařízení

Hráč bez localStorage klíče nemůže vstoupit jako participant. Tichá chyba, chybí UX feedback.

### 9.4 Nízké — offline hráč dostane XP za neaktivní účast

Hráč, který odešel v 1. kole, dostane stejné XP jako hráč, který hrál celou hru (oba dostanou XP_BASE).

---

## 10. Doporučené cílové chování (MVP)

### 10.1 Pravidlo pro offline tah

```
1. Hráč je na tahu.
2. Pokud neudělá akci do 90 sekund → auto-skip.
3. Skip se zapíše do logu: "[jméno] byl přeskočen (neaktivní)."
4. Hráč zůstává ve hře — vrátí-li se, hraje od dalšího tahu normálně.
```

### 10.2 Jak dlouho čekat

- **Doporučeno: 60–90 sekund** pro první generaci funkce  
- Kratší než 60 s je příliš agresivní (hráč jen odskočil)  
- Delší než 120 s hra stojí a zkušenost ostatních degraduje  
- V budoucnu: konfigurovatelné per-game (zakladatel nastaví)

### 10.3 Jak označit offline hráče v UI

Přidat do `PlayerStateMarkers.tsx` nový marker:
- 🔌 nebo 💤 pro hráče, který byl přeskočen nebo je delší dobu bez akce
- Indikátor přeskočení v player listu (strikethrough, šedý styl)
- Log zpráva viditelná všem: `"[jméno] přeskočen — neaktivní"`

### 10.4 Zápis skip do logu

Formát konzistentní s existujícím:
```
"${player.name} přeskočen (neaktivní — auto-skip po 90 s)"
```

### 10.5 Reconnect po skoku

- Hráč se vrátí → normálně čeká na svůj tah
- UI zobrazí "Tvůj tah byl přeskočen, čekáš na další" (toast nebo badge)
- Žádná penalizace, žádná ztráta coins

### 10.6 Rozhodnutí o win star a XP — fairness guard

**Minimální guard:**
```
Win star se udělí pouze pokud vítěz PORAZIL alespoň 1 hráče, 
který byl aktivní (měl alespoň N tahů) v dané hře.
```

Technicky: přidat `turn_count_per_player` do `game_state` nebo čítač do `Player` tabulky a kontrolovat ho v `awardWinStarAction`.

### 10.7 Farmaření XP — doporučený guard

XP_BASE udělit pouze hráčům s `turns_played ≥ 1`. Hráč, který neudělal žádný tah, dostane 0 XP.

### 10.8 Scénář: 1 člověk + bot + odpojení lidé

Doporučené chování po implementaci:
1. Offline lidé se po 90 s auto-skipnou
2. Hra pokračuje normálně s aktivním hráčem + botem
3. Win star se neudělí pokud všichni lidé byli offline (only bot opponent)
4. XP dostane pouze aktivní hráč (za tahy) + offline hráči co hráli (za tahy)

---

## 11. Doporučený nejmenší bezpečný implementační krok

**Krok 1: Server-side turn timeout (cron nebo edge function)**

Místo klientského timeoutu (náchylného k desync) přidat server-side job:

```
Každých 30 s zkontroluj hry ve stavu "playing".
Pro každou hru: pokud current_player_index ukazuje na ne-bot hráče
                a last_action_at je starší než 90 sekund
                → auto-skip na dalšího hráče.
```

Vyžaduje:
- Přidat `last_action_at` timestamp do `game_state` (nová kolona v DB)
- Cron job (Vercel cron nebo Supabase pg_cron)
- Server action `skipInactivePlayerAction(gameId)`

**Alternativní krok 1 (jednodušší, bez nové kolony):**

Přidat client-side timeout do GameBoard:
```
Pokud jsem aktivní klient (myPlayerId != null)
   a current player != já
   a current player != bot
   a turn_started_at (z local Date.now()) je starší než 90 s
→ zavolat skipPlayerAction (nová server action)
```

Tato varianta je jednodušší (žádná DB migrace), ale závislá na aktivním klientovi.

**Doporučení pro MVP:** Client-side timeout jako první krok, server-side cron jako druhý krok po stabilizaci.

---

## 12. Otevřené otázky pro rozhodnutí člověkem

1. **Jak dlouho čekat na offline hráče?** 60 s / 90 s / 120 s — závisí na tempu hry
2. **Má offline hráč přijít o coiny za přeskočený tah?** (penalizace) nebo ne (neutrální skip)?
3. **Má se hra automaticky ukončit, pokud zbývá jen 1 aktivní hráč + offline lidé?** nebo pokračovat?
4. **Má win star za výhru „nad offline hráči" platit?** nebo vyžadovat minimální počet aktivních protihráčů?
5. **Má se reconnect hráče oznamovat ostatním?** (log entry / toast)
6. **Co dělat s hráčem, který ztratí localStorage** (jiný prohlížeč)? Přidat recovery přes Discord login?
7. **Má zakladatel mít možnost manuálně skipnout hráče?** (admin skip tlačítko v UI)
8. **Má se stagnující hra (bez tahu déle než X minut) automaticky ukončit?**

---

## Přílohy

### A. Dotčené soubory (pro budoucí implementaci)

| Soubor | Relevantní část |
|--------|----------------|
| `lib/engine.ts:314` | `getNextActiveIndex` — přidá skip offline logic |
| `app/components/GameBoard.tsx:2366` | auto-skip useEffect — rozšíření o timeout |
| `app/components/board/hooks/useOnlineBotTrigger.ts` | model pro nový `useOfflineSkipTrigger` hook |
| `app/game/actions.ts:212` | `awardWinStarAction` — fairness guard |
| `app/game/actions.ts:17` | `awardXpAction` — guard na min. počet tahů |
| `lib/playerMarkers.ts` | přidat offline/skipped marker |
| `lib/types/game.ts` | přidat `last_action_at`, `turns_played` do schématu |

### B. Neexistující části (pro budoucí přidání)

- `app/components/board/hooks/useOfflineSkipTrigger.ts` — nový hook
- `app/game/skip-actions.ts` — server action pro auto-skip
- Supabase migrace: `players.turns_played INT DEFAULT 0`
- Supabase migrace: `game_state.last_action_at TIMESTAMPTZ`
