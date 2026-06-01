# Audit: XP a profilový progress systém — PayToWin.cz

**Datum:** 2026-06-01  
**Typ:** Read-only audit kódu. Žádné změny.  
**Zdroje:** `app/game/actions.ts`, `lib/scenarios/objective-rewards.ts`, `app/components/GameBoard.tsx`, `supabase/migrations/`

---

## 1. Přehled XP konstant

### Kde jsou definované

| Konstanta | Hodnota | Soubor | Scope |
|---|---|---|---|
| `XP_BASE` | **50** | `app/game/actions.ts:7` | Soukromá (modul) |
| `XP_WINNER` | **100** | `app/game/actions.ts:8` | Soukromá (modul) |
| `XP_SECOND` | **50** | `app/game/actions.ts:9` | Soukromá (modul) |
| `XP_THIRD` | **25** | `app/game/actions.ts:10` | Soukromá (modul) |
| `XP_OBJECTIVE` | **90** | `lib/scenarios/objective-rewards.ts:8` | Exportovaná |

### Poznámka k `XP_OBJECTIVE`

`XP_OBJECTIVE = 90` je ručně zapsaná hodnota s komentářem `"~90 % XP_WINNER (100)"`.  
**NENÍ matematicky odvozená** od `XP_WINNER` — obě konstanty jsou v různých souborech a `XP_WINNER` je soukromá.  
Pokud se `XP_WINNER` změní, `XP_OBJECTIVE` se automaticky **nezmění**.

---

## 2. Co dělají jednotlivé akce

### `awardXpAction(gameId)` — `app/game/actions.ts:17`

- **Trigger:** `checkAndFinishGame()` v GameBoard při `game.status = "finished"`
- **Guard:** `games.xp_awarded` boolean — spustí se max jednou
- **Podmínky:** hráč musí mít `discord_id NOT NULL` (boti typicky nemají)
- **XP rozdělení:**
  - Všichni Discord hráči: **+50 XP** (XP_BASE)
  - Vítěz (coins > 0): **+100 XP** (XP_WINNER)
  - 2. místo (poslední v bust_order): **+50 XP** (XP_SECOND)
  - 3. místo (předposlední v bust_order): **+25 XP** (XP_THIRD)
- **Bot hry:** Bot nemá discord_id → `addXp()` je no-op; XP se botům nepřipíše. Ale `winner` se hledá jako `players.find(p => coins > 0)` **bez filtru is_bot** — pokud by bot byl vítěz, `addXp(winner?.discord_id)` selže na null discord_id. Funguje, ale není explicitní.
- **Ukládá:** `user_profiles.xp_total` (upsert přes RPC), `user_profiles.wins_total`

---

### `awardObjectiveXpAction(gameId)` — `app/game/actions.ts:265`

- **Trigger:** `checkAndFinishGame()` v GameBoard (vedle `awardXpAction`)
- **Guard:** `games.objective_xp_awarded` boolean
- **Farming ochrana:** vyžaduje `humanPlayers.length >= 2` (stejný threshold jako `awardWinStarAction`)
- **Podmínky:** hráč, který splnil objective, musí mít `discord_id`
- **XP:** **+90 XP** (`XP_OBJECTIVE`) pro hráče zapsaného v `game_state.objective_completed_by`
- **Bot hry:** Farming ochrana zabrání připsání XP. Guard se nastaví na true i bez výplaty.
- **Ukládá:** `user_profiles.xp_total`

---

### `awardWinStarAction(gameId)` — `app/game/actions.ts:212`

- **Trigger:** `checkAndFinishGame()` v GameBoard
- **Guard:** `games.win_stars_awarded` boolean
- **Podmínky:**
  - `humanPlayers.length >= 2` (min. 2 Discord hráči, bez botů)
  - Vítěz nesmí být bot (`!winner.is_bot`)
  - Vítěz musí mít `discord_id`
- **Odměna:** **+1 win_star** pro vítěze hry
- **Bot hry:** Explicitně blokováno
- **Ukládá:** `user_profiles.win_stars_total`

---

### `awardRaceStarAction(gameId, winnerDiscordId, raceTurnCount)` — `app/game/actions.ts:105`

- **Trigger:** `closeRaceResult()` v GameBoard po každém dokončeném závodu
- **Guard:** `game_state.race_stars_awarded[]` — pole turnCount hodnot; přidá se `raceTurnCount`; opakování s týmž `raceTurnCount` je blokováno
- **Podmínky:** caller předá `winner.discord_id` — pokud je null (bot vítěz), volání se neprovede (kód v GameBoard: `if (winner?.discord_id)`)
- **Odměna:** **+1 race_star** pro vítěze závodu
- **Bot hry:** Pokud závod vyhraje bot, žádná hvězdička se nepřipíše (discord_id je null)
- **Per-race:** Ano — každý závod je samostatný
- **Ukládá:** `user_profiles.stars_total`

---

### `awardMoneySpentAction(gameId)` — `app/game/actions.ts:145`

- **Trigger:** `checkAndFinishGame()` v GameBoard
- **Guard:** `games.money_spent_awarded` boolean
- **Podmínky:** `spend_events` záznamy s `discord_id NOT NULL`, `counted_in_profile = false`, `event_type = "racer_purchase"`
- **Odměna:** Kumulativní útrata coinů → `user_profiles.money_spent_total`
- **Bot hry:** Bot nemá discord_id → jeho spend_events se nepočítají
- **Ukládá:** `user_profiles.money_spent_total`

---

## 3. Přehled sloupců v `user_profiles`

| Sloupec | Co měří | Kdo přispívá | Guard |
|---|---|---|---|
| `xp_total` | Celkové XP (účast, výhry, objective) | Všichni Discord hráči | `games.xp_awarded` + `games.objective_xp_awarded` |
| `wins_total` | Počet výher (libovolná hra) | Discord vítěz | `games.xp_awarded` (součást stejného RPC) |
| `stars_total` | Hvězdičky za vyhraný závod | Discord vítěz závodu | `game_state.race_stars_awarded[]` |
| `win_stars_total` | Hvězdičky za výhru vs živí hráči | Discord vítěz (≥2 lidé) | `games.win_stars_awarded` |
| `money_spent_total` | Utracené coiny za racery | Discord hráči | `games.money_spent_awarded` |

### Sémantický rozdíl: `stars_total` vs `win_stars_total`

- `stars_total` = **závodní hvězdičky** — za vyhraný závod (minigame), každá hra může mít více závodů
- `win_stars_total` = **výherní hvězdičky** — za výhru celé hry, pouze pokud hráli ≥2 živí hráči
- Tyto dvě hodnoty jsou různé věci, aktuálně obě jen sedí v DB bez viditelného UI využití

---

## 4. Tabulka odměn per akce

| Akce | Odměna | Komu | Kdy | Bot hra? | Guard | Funkce |
|---|---|---|---|---|---|---|
| Dokončení hry (účast) | +50 XP | Všichni Discord hráči | game end | ✅ Ano (pokud má discord_id) | `games.xp_awarded` | `awardXpAction` |
| Výhra hry | +100 XP, wins++ | Vítěz (Discord) | game end | ✅ Ano (bot nemá discord_id, no-op) | `games.xp_awarded` | `awardXpAction` |
| 2. místo | +50 XP | 2. hráč (Discord) | game end | ✅ Ano | `games.xp_awarded` | `awardXpAction` |
| 3. místo | +25 XP | 3. hráč (Discord) | game end | ✅ Ano | `games.xp_awarded` | `awardXpAction` |
| Objective splněn (in-game) | +2000 💰 (herní coiny) | Vítěz objective | okamžitě při koupi | ✅ Ano | `game_state.objective_rewards_awarded[]` | `buyRacer` v GameBoard |
| Objective splněn (profil) | +90 XP | Vítěz objective (Discord) | game end | ❌ Ne (min. 2 lidé) | `games.objective_xp_awarded` | `awardObjectiveXpAction` |
| Výhra závodu (minigame) | +1 race_star | Vítěz závodu (Discord) | po závodu | ❌ Ne (bot nemá discord_id) | `game_state.race_stars_awarded[]` | `awardRaceStarAction` |
| Výhra hry vs živí hráči | +1 win_star | Vítěz (Discord, ne bot) | game end | ❌ Ne (explicitní guard) | `games.win_stars_awarded` | `awardWinStarAction` |
| Útrata za racery | money_spent_total++ | Discord hráči | game end | ❌ Ne (bot nemá discord_id) | `games.money_spent_awarded` | `awardMoneySpentAction` |

---

## 5. Scénáře — co hráč dostane

### Scénář 1: Hráč prohraje hru proti botovi

- **Podmínky:** 1 hráč + 1 bot, hráč zbankrotuje
- **XP za účast:** +50 XP (`xp_total`)
- **XP za výhru:** 0 (prohrál)
- **Win star:** 0 (bot hra, guard blokuje)
- **Race stars:** závisí na závodech (bot nemá discord_id → hvězdičky za závody vyhrané hráčem se připíší)
- **Objective XP:** 0 (jen 1 lidský hráč)
- **Farming riziko:** ✅ NÍZKÉ — 50 XP za prohru s botem, opakovat je nudné

---

### Scénář 2: Hráč vyhraje hru proti botovi

- **XP:** +50 (base) + 100 (výhra) = **150 XP**
- **Win star:** 0 (bot hra, explicitní guard)
- **Race stars:** Ano (za vyhraný závod, pokud hráč vyhrál)
- **Objective XP:** 0 (jen 1 lidský hráč)
- **Farming riziko:** ⚠️ STŘEDNÍ — 150 XP za výhru vs bot je farmovatelné v krátkých hrách

---

### Scénář 3: Hráč vyhraje hru proti živému hráči (1v1)

- **XP:** +50 (base) + 100 (výhra) = **150 XP**
- **Win star:** +1 win_star
- **Race stars:** Ano (za vyhraný závod)
- **Objective XP:** 0 (objective nesplněn)
- **Farming riziko:** ✅ NÍZKÉ — vyžaduje soupeře

---

### Scénář 4: Hráč splní objective, ale prohraje (vs živý hráč)

- **In-game coins:** +2000 💰 (okamžitě v průběhu hry)
- **XP za účast:** +50 XP
- **Objective XP:** +90 XP (splněn s živými hráči)
- **Celkem XP:** **140 XP**
- **Win star:** 0 (prohrál)
- **Farming riziko:** ✅ NÍZKÉ — vyžaduje živého hráče a splnění podmínky
- **Poznámka:** Hráč dostane víc XP (140) než prohravší 2. místo ve standardní hře (100), ale méně než vítěz (150). Motivační asymetrie je zajímavá — poražený s objective je skoro jako vítěz.

---

### Scénář 5: Hráč splní objective a vyhraje (vs živý hráč)

- **In-game coins:** +2000 💰
- **XP:** +50 (base) + 100 (výhra) + 90 (objective) = **240 XP**
- **Win star:** +1 win_star
- **Race stars:** Ano (za závody)
- **Farming riziko:** ✅ NÍZKÉ — vyžaduje výhru + živého hráče + splnění podmínky
- **Poznámka:** 240 XP je výrazně víc než jen výhra (150). Vítěz s objective dostane 60 % více XP.

---

### Scénář 6: Hráč vyhraje závod během hry

- **Okamžitá odměna:** coins za závod (herní ekonomika)
- **Race star:** +1 star (pokud má discord_id)
- **XP:** 0 (závod sám o sobě nedává XP)
- **Farming riziko:** ✅ NÍZKÉ — závody jsou součástí standardní hry, nevyužitelné izolovaně

---

### Scénář 7: Hráč utratí hodně peněz ve hře (koupí racery)

- **money_spent_total:** navýší se o utracenou částku
- **XP:** 0
- **Hvězdičky:** 0
- **Farming riziko:** ✅ NÍZKÉ — `money_spent_total` je zatím jen datový atribut bez mechanického efektu

---

## 6. Analýza rizik

### Riziko 1: Objective XP (90) je téměř stejné jako XP za výhru (100)

**Stav:** XP_OBJECTIVE = 90, XP_WINNER = 100.

Hráč, který splní objective a prohraje: **140 XP** (50 base + 90 objective).  
Hráč, který nevyhraje ale dojde 2. (4hráčová hra): **100 XP** (50 base + 50 second).  
Hráč, který vyhraje bez objective: **150 XP** (50 base + 100 winner).

**Závěr:** Objective je téměř tak hodnotné jako výhra. To může být záměrné (motivuje k plnění objective) nebo příliš velkorysé. Pro MVP je to OK — odměna za splnění specifické podmínky v přítomnosti živého soupeře má smysl.

---

### Riziko 2: Farming XP proti botovi (150 XP za výhru)

**Stav:** 150 XP za výhru vs bot není omezeno.  
Hráč může opakovaně hrát krátké hry 1v1 s botem a sbírat XP.

**Zmírnění:** `awardXpAction` neblokuje bot hry. Ostatní premium odměny (win_star, objective XP) jsou blokované.

**Doporučení:** Pokud XP bude mít mechanický efekt (odemykání map), zvážit snížení XP za bot hry nebo přidání bot-hra penalizace.

---

### Riziko 3: Nekonzistence XP_OBJECTIVE a XP_WINNER (není matematicky svázané)

**Stav:** `XP_OBJECTIVE = 90` je hardcoded v jiném souboru než `XP_WINNER = 100`.

Pokud se změní `XP_WINNER`, `XP_OBJECTIVE` se **automaticky nezmění**. Komentář `~90 % XP_WINNER (100)` je jen informativní.

**Doporučení:** Exportovat `XP_WINNER` z `actions.ts` nebo přesunout všechny XP konstanty do sdíleného `lib/game-xp-constants.ts`.

---

### Riziko 4: Dvojí připsání při reconnectu/refreshi

**Stav:** Všechny game-end akce mají DB guard (boolean sloupce v `games`).  
`awardRaceStarAction` má guard v `game_state.race_stars_awarded[]`.

**Závěr:** Dvojí připsání je technicky blokováno. Guard se nastavuje vždy, i při chybě (objective action). ✅

---

### Riziko 5: Hvězdičky nemají jasnou roli

**Stav:**
- `stars_total` — hvězdičky za závody, hromadí se bez viditelného efektu
- `win_stars_total` — hvězdičky za výhry vs lidé, hromadí se bez viditelného efektu

Ani jeden typ hvězdiček nemá momentálně UI prezentaci v profilu ani mechanický efekt (odemykání, bonusy).

**Doporučení:** Rozhodnout nejprve, co hvězdičky dělají, a pak je prezentovat. Jinak matou hráče.

---

## 7. Celkový přehled XP hodnot

```
Hra s botem:
  Prohra:   50 XP
  Výhra:   150 XP

Hra s živým hráčem (2 hráči):
  Prohra:   50 XP
  2. místo: 100 XP
  Výhra:   150 XP + 1 win_star

Objective splněn (vs živý hráč):
  + 90 XP (profilové)
  + 2000 💰 (herní coiny, vždy)

Maximum za jednu hru (vítěz + objective, 2 hráči):
  50 (base) + 100 (výhra) + 90 (objective) = 240 XP + 1 win_star

Závod (per-race):
  +1 race_star (hráč s discord_id)
```

---

## 8. Doporučení

### 1. Ponechat aktuální hodnoty — ✅ Zatím ano

Hodnoty jsou rozumné pro MVP. XP neovlivňuje gameplay. Měnit je teď je předčasné.

### 2. Objective XP (90) vs Winner XP (100) — svázat konstanty

Ideální stav: `XP_OBJECTIVE` odvozeno od `XP_WINNER`. Minimální bezpečná úprava:
- Exportovat `XP_WINNER` z `actions.ts` (nebo přesunout do `lib/game-xp-constants.ts`)
- V `objective-rewards.ts`: `export const XP_OBJECTIVE = Math.round(XP_WINNER * 0.9)`

Toto snižuje riziko nesynchronizace. **Priorita: nízká pro MVP, střední pro stabilitu.**

### 3. XP pro odemykání map — ❌ Zatím ne

Odemykání map přes XP by vyžadovalo mechanismus, thresholdy, UI a testování. Zatím není základ. Hvězdičky/win_stars by mohly být lepším tokenem pro odemykání.

### 4. Hvězdičky — rozhodnout co dělají, nebo je zatím ignorovat

Dokud nemají mechanický efekt, netlaček jejich zobrazení. Jednoduché řešení: profil je zatím jen vizuální bez thresholdů.

### 5. Farming bot-XP — monitorovat, neřešit teď

150 XP za výhru vs bot je farmovatelné, ale:
- XP zatím nic neodemyká → farming není výhodný
- Pokud se přidá odemykání, zvážit `XP_WINNER_VS_BOT = 75` nebo podobné snížení

### 6. Nejmenší další krok

**Exportovat XP konstanty do sdíleného souboru.** Jednoduchá technická hygiena:

```
lib/game-xp-constants.ts
  export const XP_BASE    = 50;
  export const XP_WINNER  = 100;
  export const XP_SECOND  = 50;
  export const XP_THIRD   = 25;
  export const XP_OBJECTIVE = Math.round(XP_WINNER * 0.9);
```

Pak aktualizovat `actions.ts` a `objective-rewards.ts` aby importovaly z tam.

Toto nevyžaduje DB migraci, nemění hodnoty, jen odstraňuje duplikaci a riziko nesynchronizace.

---

## Příloha: Guard sloupce v DB

| Sloupec | Tabulka | Kdy se nastaví |
|---|---|---|
| `xp_awarded` | `games` | Po `awardXpAction` (game end) |
| `win_stars_awarded` | `games` | Po `awardWinStarAction` (game end) |
| `money_spent_awarded` | `games` | Po `awardMoneySpentAction` (game end) |
| `objective_xp_awarded` | `games` | Po `awardObjectiveXpAction` (game end, i při chybě) |
| `race_stars_awarded` | `game_state` | Po každém závodu (pole turnCount hodnot) |
