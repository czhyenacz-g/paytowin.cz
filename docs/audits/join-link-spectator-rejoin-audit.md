# Audit: Join Link, Spectator a Rejoin Identity Flow

**Datum:** 2026-06-02  
**Typ:** Read-only analýza  
**Navazuje na:** `join-reconnect-turn-order-audit.md`, `offline-players-auto-skip-audit.md`  
**Stav:** Bez implementace — popis současného stavu, nalezené bugy a doporučení

---

## 1. Shrnutí nálezů

**Jsou tři kritické problémy:**

| # | Problém | Závažnost |
|---|---------|-----------|
| A | `?join=CODE` nenabídne automatický redirect existujícímu hráči — může kliknout „Připojit" podruhé a vytvořit duplicitní player row | Střední |
| B | Tlačítko „Připojit" je při prvním renderování zakázané (Discord state se načítá async) — vypadá jako zamrznutý UI → „nešlo se připojit, pak to nějak šlo" | Nízká / UX |
| C | `players` tabulka nemá unikátní constraint na `(game_id, discord_id)` → duplicitní hráče je možné vložit na DB úrovni | Střední |

---

## 2. Jak se zpracuje `?join=5T7G3`

**`app/components/LandingPage.tsx` lines 235–239:**

```typescript
React.useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const join = params.get("join");
  if (join) setJoinCode(join.toUpperCase());  // ← pouze předvyplní input
  // ...
}, []);
```

URL query `?join=CODE` se zpracuje **pouze jako předvyplnění `joinCode` inputu**. Žádný automatický redirect, žádný auto-submit, žádná kontrola, zda je uživatel již v hráčích.

Query parametr **zůstane v URL dokud uživatel neklikne** na tlačítko Připojit a neproběhne `router.push('/game/CODE')`.

---

## 3. Proč „nešlo se připojit, pak to nějak šlo"

### 3.1 Tlačítko Připojit je zakázané při prvním renderování

**`app/components/LandingPage.tsx` line 591:**

```typescript
const joinButtonDisabled =
  loading ||
  joinApprovalStatus === "pending" ||
  (!isDiscordConnected && !name.trim()) ||  // ← zakázáno dokud Discord nenačte
  !joinCode.trim();
```

Podmínka `!isDiscordConnected && !name.trim()` znamená:
- Pokud uživatel **není přihlášen Discordem** a **nevyplnil jméno**, tlačítko je zakázáno
- Pokud uživatel **je přihlášen Discordem**, jméno není potřeba

### 3.2 Discord state se načítá asynchronně

**`app/components/LandingPage.tsx` lines 259–272:**

```typescript
supabase.auth.getUser().then(({ data: { user } }) => {
  if (!user) return;
  const discordId = user.user_metadata?.provider_id as string | undefined;
  if (!discordId) return;
  // ...
  setDiscordUser({ id: discordId, name: fullName, avatar: avatarUrl });
  setName((prev) => prev || fullName);
});
```

Sekvence při otevření `/?join=5T7G3` Discord uživatelem:

| Čas | Stav |
|-----|------|
| T=0 | Stránka se renderuje: `discordUser=null`, `name=""`, `joinCode="5T7G3"` |
| T=0 | `joinButtonDisabled = true` (Discord nenačten, jméno prázdné) |
| T=?ms | Uživatel vidí tlačítko, klikne → nic se nestane (disabled) |
| T=~200–500ms | Discord session se načte → `discordUser` nastaven → jméno vyplněno |
| T+1 | `joinButtonDisabled = false` |
| T+2 | Uživatel klikne znovu → join proběhne |

**Toto je přesné vysvětlení „nešlo se připojit, pak to ale nějak šlo."** Není to bug v join logice, ale race condition mezi renderem UI a načtením Discord session. Disabled tlačítko neposkytuje žádný vizuální feedback „načítám…".

### 3.3 Vizuální indikace zakázaného tlačítka

Tlačítko má vizuální styl pro `disabled` stav (`disabled:bg-stone-200 disabled:text-stone-600`), ale **nevysvětluje proč je zakázané**. Tooltip indikátor (červený kroužek ⊘) se zobrazí pouze při hoveru, ne při tapnutí na mobilu.

---

## 4. Jak vzniká hráč vs pozorovatel

### 4.1 Nový hráč přes link — cesta A (před koncem 1. kola)

```
Uživatel → /?join=CODE → vyplní jméno (nebo má Discord) → klikne Připojit
    ↓
joinGame() v LandingPage
    ↓
Kontrola: turn_count < currentPlayerCount?
    ↓ ANO → INSERT do players (nový turn_order)
    ↓       → localStorage.setItem("paytowin_player_${code}", newPlayer.id)
    ↓       → router.push("/game/CODE")
```

Hráč se stane **plnohodnotným účastníkem turn orderu**.

### 4.2 Pozorovatel — cesta B (po konci 1. kola)

```
Uživatel → /?join=CODE → klikne Připojit
    ↓
joinGame() v LandingPage
    ↓
Kontrola: turn_count >= currentPlayerCount?
    ↓ ANO → sessionStorage.setItem("paytowin_late_join", code)
    ↓       → router.push("/game/CODE")   [BEZ vložení do players!]
```

Pozorovatel **není v `players` tabulce vůbec**. Je to „procházející návštěvník."

### 4.3 Role v GameBoard

**`app/components/GameBoard.tsx` lines 485–500:**

```typescript
const pid = localStorage.getItem(`paytowin_player_${gameCode}`);
setMyPlayerId(pid);

if (pid) {
  setViewerRole("player");                   // ← localStorage klíč = hráč
} else {
  const role = myDiscordId ? "spectator" : "login_required";
  setViewerRole(role);                        // ← bez localStorage = pozorovatel
}
```

**Rozhodnutí hráč/pozorovatel je v GameBoard binární — závisí výhradně na localStorage.**

Nikde se nekontroluje, zda `pid` z localStorage skutečně odpovídá záznamu v `players` tabulce. Pokud localStorage obsahuje neplatné nebo staré ID, hráč dostane roli `"player"`, ale jeho akce budou selhat (ID nenalezeno).

---

## 5. Identita existujícího hráče — rejoin flow

### 5.1 Stejné zařízení a prohlížeč (localStorage intaktní)

Uživatel otevře `/?join=CODE`:
1. `joinCode` se předvyplní z URL
2. Discord session se načte → `discordUser` nastaven
3. Tlačítko „Připojit" je aktivní
4. **Hra NEdivá, zda uživatel je již v `players` — žádná taková kontrola neexistuje**
5. Uživatel musí **sám odejít na `/game/CODE`** nebo kliknout Připojit (čímž vytvoří DUPLICITNÍ hráče)

**LandingPage nezjistí, že uživatel je existující hráč, a nepřesměruje ho.**

### 5.2 Scénář: existující hráč klikne „Připojit" znovu

```
Hráč je v players (turn_order=2, coins=8000)
    ↓
Otevře /?join=CODE (localStorage stále obsahuje player_id)
    ↓
Nevšimne si, že by měl jít přímo na /game/CODE
    ↓
Klikne „Připojit"
    ↓
joinGame() → turn_count kontrola → pokud stále v 1. kole → INSERT nového hráče (turn_order=4)
    ↓
localStorage přepsáno: paytowin_player_${code} = nové_id
    ↓
Původní hráč (turn_order=2) je osiřelý — nikdo ho neovládá
Nový hráč (turn_order=4) začíná s 0 tahů, plnými coins
```

**Toto je bug způsobující duplicitní player row.** Hra má nyní 5 hráčů místo 4.

### 5.3 Přímý přístup na `/game/CODE` (správná cesta)

Pokud uživatel otevře `/game/CODE` přímo (bez `/?join=`):
- GameBoard načte hru, zkontroluje localStorage → `pid` nalezeno → `viewerRole = "player"`
- Hráč pokračuje ve hře normálně bez risk duplicitu

Toto je **bezpečná cesta**, ale aplikace ji hráče nenaučí — po joinu hráče přesměruje na `/game/CODE`, odkud hráč sdílí link `/?join=CODE` z join formuláře. Pokud si hráč bookmark uloží /?join= místo /game/, je v riziku.

### 5.4 Jiné zařízení / prohlížeč (ztracený localStorage)

`localStorage.getItem("paytowin_player_${code}")` vrátí `null`:
- `viewerRole = "spectator"` (pokud Discord přihlášen) nebo `"login_required"`
- Hráč vidí hru ale nemůže hrát
- Žádná recovery cesta

**Neexistuje Discord-based reclaim identity.** Discord přihlášení slouží pouze pro rozlišení spectator vs. login_required, nikoli pro obnovu player identity.

---

## 6. DB schéma — chybějící unikátní constraint

**`_db/before_run.sql` lines 15–24:**

```sql
create table if not exists players (
  id          uuid  primary key default gen_random_uuid(),
  game_id     uuid  not null references games(id) on delete cascade,
  name        text  not null,
  color       text  not null,
  position    int   not null default 0,
  coins       int   not null default 500,
  horses      jsonb not null default '[]',
  turn_order  int   not null default 0
  -- ← žádný UNIQUE (game_id, discord_id)
);
```

**Tabulka `players` nemá unikátní constraint na kombinaci `(game_id, discord_id)`.** Databáze nebrání vložení dvou hráčů se stejným `discord_id` do jedné hry. Ochrana musí být čistě aplikační — a ta aktuálně neexistuje v `joinGame`.

Přehled migrací s `discord_id`:
- `20260417_players_add_discord_identity.sql` — přidává sloupec `discord_id TEXT NULL`, ale bez UNIQUE indexu

---

## 7. Matice scénářů — jak aplikace reaguje

| Scénář | Co LandingPage udělá | Co GameBoard udělá |
|--------|---------------------|-------------------|
| Nový uživatel, hra nespuštěna | Zobrazí formulář. Po vyplnění jména + kliknutí: INSERT player | Nastaví `viewerRole="player"` |
| Nový uživatel, hra v 1. kole | Zobrazí formulář. INSERT player (pokud turn_count < playerCount) | `viewerRole="player"` |
| Nový uživatel, hra po 1. kole | Zobrazí formulář. Late-join guard → redirect jako spectator | `viewerRole="spectator"` |
| Discord uživatel, poprvé | Formulář s předvyplněným jménem. **Tlačítko zakázáno** dokud Discord nenačte | N/A |
| Discord uživatel, opakovaný pokus | Formulář aktivní po načtení Discordu. **Bez kontroly na duplicitu** | N/A |
| Existující hráč, localStorage intact | Zobrazí formulář. **Nepřesměruje, nekontroluje existence** | `viewerRole="player"` via localStorage |
| Existující hráč, jiné zařízení | Zobrazí formulář. Může vložit duplicitního hráče | `viewerRole="spectator"` — ztracená identita |
| Existující hráč, ztracený localStorage | Zobrazí formulář. Vytvoří nového hráče pokud klikne | `viewerRole="spectator"` nebo `"login_required"` |

---

## 8. Pozorovatel — detailní flow

### 8.1 Jak vzniká

1. **Late-join přes link** po konci 1. kola (nejčastější)
2. **Přímý přístup na `/game/CODE`** bez localStorage klíče
3. **Discord přihlášení bez localStorage** → `"spectator"` role

### 8.2 Co pozorovatel vidí a může dělat

- Vidí celou herní desku (GameBoard renderuje plně i pro spectator)
- **Nemůže hodit kostkou** (akce jsou guarded přes `myPlayerId`)
- **Nemůže kupovat koně, klást sázky** (stejné guardy)
- **Vidí log, stav hráčů, pole**
- Dostane late-join telegram: `"ZÁVOD BĚŽÍ — Připojil ses jako pozorovatel."`
- **V PlayerList není zobrazen** (není v `players` tabulce)

### 8.3 Může pozorovatel omylem skončit jako hráč?

**Ne přímo.** Pozorovatel nemůže provést herní akci. Ale pokud se vrátí na LandingPage a klikne „Připojit," může se stát novým hráčem (INSERT do players) — pokud hra je stále v 1. kole. To je pak duplicitní join, ne „omylem spectator → hráč."

### 8.4 Může hráč omylem skončit jako pozorovatel?

**Ano — ztráta localStorage.** Hráč s čistým prohlížečem nebo jiným zařízením přijde na `/game/CODE`, localStorage je prázdný → `viewerRole = "spectator"`. Žádná recovery. **Tato chyba je tichá** — aplikace mu neřekne „ty jsi hráč, ale ztratil jsi klíč."

---

## 9. Kde v kódu se rozhoduje o roli

```
LandingPage.joinGame()
├── Kontrola: turn_count >= playerCount?
│   ├── ANO  → sessionStorage late_join flag + redirect /game/CODE [SPECTATOR PATH]
│   └── NE   → INSERT do players + localStorage.setItem + redirect /game/CODE [PLAYER PATH]
│
GameBoard.loadGame()
├── Čti: localStorage.getItem("paytowin_player_${gameCode}")
│   ├── NALEZENO → viewerRole = "player"
│   └── NENALEZENO
│       ├── Discord přihlášen → viewerRole = "spectator"
│       └── Discord nepřihlášen → viewerRole = "login_required"
```

---

## 10. Identifikované bugy a rizika

### Bug A — duplicitní hráč [Střední závažnost]

**Popis:** `joinGame()` v LandingPage nevytvoří existenci hráče (Discord nebo localStorage) před vložením nového záznamu. Discord uživatel nebo uživatel se ztraceným localStorage může kliknout „Připojit" a být přidán jako nový hráč, zatímco původní player row zůstane v DB osiřelý.

**Podmínky výskytu:**
- Hra ještě neskončila 1. kolo (turn_count < playerCount)
- Uživatel přišel přes `/?join=CODE` místo `/game/CODE`
- Uživatel klikl „Připojit" i přesto, že byl původně hráčem

**Dopady:**
- Původní hráč (s tahy, coins, koňmi) = osiřelý záznam, nikdo ho neovládá
- Nový hráč = duplikát ve turn orderu, začíná od nuly
- Celkový počet hráčů je vyšší než by měl být

### Bug B — zakázané tlačítko bez feedbacku [Nízká závažnost / UX]

**Popis:** Při prvním načtení `/?join=CODE` je tlačítko „Připojit" zakázáno kvůli async načítání Discord session. Discord uživatel vidí aktivní formulář s kódem, ale tlačítko nereaguje (disabled). Po ~200–500 ms Discord načte a tlačítko se odblokuje.

**Projeví se jako:** „nešlo mi se připojit, pak to ale nějak šlo."

**Není bug v logice** — je to UX issue (chybí loading state/spinner).

### Bug C — chybí DB constraint [Střední závažnost]

**Popis:** Tabulka `players` nemá UNIQUE index na `(game_id, discord_id)`. Ochrana proti duplicitám je čistě aplikační a aktuálně neexistuje.

**Riziko:** Exploitovatelné manuálně nebo race-condition přes paralelní requesty.

### Potenciální problém D — localhost nevalidní player ID [Nízká závažnost]

**Popis:** `viewerRole` je nastaveno na `"player"` čistě z existence localStorage klíče, bez verifikace, že `pid` odpovídá záznamu v `players` tabulce pro tuto hru. Pokud localStorage obsahuje stale/expired ID, hráč dostane roli player, ale všechny write akce selžou tiše nebo s chybou.

---

## 11. Doporučené cílové chování — MVP pravidla

### A) Uživatel přijde přes join link a NENÍ ve hře

**Pokud hra ještě nezačala (status = waiting nebo turn_count < playerCount):**
```
→ Zobrazit formulář, nabídnout připojení jako hráč
→ Discord: předvyplnit jméno, button disabled jen dokud Discord načítá (zobrazit spinner)
→ Po kliknutí INSERT player → /game/CODE
```

**Pokud hra začala (turn_count >= playerCount):**
```
→ Zobrazit jasné sdělení: "Hra probíhá, nový hráč se nemůže připojit."
→ Nabídnout: "Sledovat hru" (spectator)
→ Nenabízet „Připojit" tlačítko
```

### B) Uživatel přijde přes join link a JIŽ je hráčem

**Stejné zařízení (localStorage intact):**
```
→ LandingPage detekuje localStorage.getItem("paytowin_player_${code}")
→ Automaticky přesměrovat na /game/CODE (přeskočit formulář)
→ Zobrazit banner: "Pokračuješ ve hře jako [jméno]"
```

**Jiné zařízení (Discord přihlášen):**
```
→ GameBoard nebo LandingPage detekuje discord_id v players tabulce
→ Nabídnout: "Vrátit se jako [jméno]?" tlačítko
→ Po potvrzení: localStorage.setItem + role = player
```

**Jiné zařízení (Discord nepřihlášen):**
```
→ Zobrazit formulář s vysvětlením: "Rozpoznat tě jako hráče lze jen přes Discord nebo stejný prohlížeč."
→ Nabídnout: Přihlásit Discord | Vstoupit jako pozorovatel
→ NEVYTVÁŘET nového hráče bez explicitního záměru
```

### C) Duplicita prevention — minimum

1. Před INSERT v `joinGame()` zkontrolovat:
   ```typescript
   const existing = existingPlayers?.find(p => 
     p.discord_id && discordUser?.id && p.discord_id === discordUser.id
   );
   if (existing) {
     localStorage.setItem(`paytowin_player_${game.code}`, existing.id);
     router.push(`/game/${game.code}`);
     return;  // ← NEINSERTOVAT duplicitního hráče
   }
   ```
2. Přidat DB UNIQUE index: `CREATE UNIQUE INDEX players_game_discord_unique ON players(game_id, discord_id) WHERE discord_id IS NOT NULL;`

### D) UX zlepšení — minimální

- Tlačítko „Připojit" při disabled stavu zobrazit jako `"Načítám…"` (ne jen vizuálně disabled)
- Po úspěšném joinu odkaz „Sdílet hru" sdílet `/game/CODE` (ne `/?join=CODE`) — existující hráč pak přijde rovnou na hru

---

## 12. Doporučený nejmenší bezpečný implementační krok

**Krok 1 (bez DB migrace): Detekce existujícího hráče v joinGame()**

V `app/components/LandingPage.tsx` funkci `joinGame()`, před INSERT blokem:

```typescript
// Pokud je Discord přihlášen, zkontroluj zda už hráč existuje
if (discordUser?.id) {
  const alreadyPlayer = existingPlayers?.find(p => p.discord_id === discordUser.id);
  if (alreadyPlayer) {
    localStorage.setItem(`paytowin_player_${game.code}`, alreadyPlayer.id);
    router.push(`/game/${game.code}`);
    return;
  }
}

// Alternativně: zkontroluj localStorage
const existingPid = localStorage.getItem(`paytowin_player_${game.code}`);
if (existingPid) {
  router.push(`/game/${game.code}`);
  return;
}
```

**Krok 2 (UX): Loading stav tlačítka**

Zobrazit spinner/text „Připojuji…" dokud Discord session načítá — místo tichého disabled stavu.

---

## 13. Otevřené otázky pro rozhodnutí člověkem

1. **Má se LandingPage automaticky přesměrovat na `/game/CODE` pokud je localStorage přítomné?** (bypass formuláře)
2. **Má Discord reclaim být automatický nebo vyžadovat potvrzení?**
3. **Má existovat UNIQUE DB constraint na `(game_id, discord_id)`?** (doporučeno ano)
4. **Má se link, který hráč sdílí po joinu, být `/game/CODE` nebo `/?join=CODE`?**
5. **Má se pozorovatel explicitně zobrazit v UI jako „pozorovatel" (badge, odlišný stav)?**
6. **Co se má stát při `viewerRole = "login_required"`?** Dnes zobrazí GameBoard s výzvou, ale bez formuláře pro join — ověřit, zda to vedete správně.
