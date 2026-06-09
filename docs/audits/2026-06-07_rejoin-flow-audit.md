# Audit: Rejoin flow — desktop → mobil (cross-device)

**Datum:** 2026-06-07  
**Typ:** Read-only analýza + návrh kroků  
**Navazuje na:** `join-link-spectator-rejoin-audit.md`, `join-reconnect-turn-order-audit.md`  
**Stav:** Bez implementace

---

## 0. TL;DR

| Scénář | Funguje dnes? |
|--------|-------------|
| Reload na stejném zařízení | ✅ Plně |
| Návrat přes přímý link `/game/CODE` na stejném zařízení | ✅ Plně |
| Návrat z mobilu přes **LandingPage** (zadání kódu) — Discord přihlášen | ✅ Funguje |
| Návrat z mobilu přes **přímý link `/game/CODE`** — Discord přihlášen | ❌ Pozorovatel |
| Návrat z mobilu bez Discord (localStorage ztracen) | ❌ Zablokován |
| Kliknutí na Discord-room link → `/game/CODE` na novém zařízení | ❌ Spectator / login_required |

**Hlavní problém:** Discord link vede na `/game/CODE`. GameBoard **nemá Discord reclaim**. Hráč skončí jako pozorovatel i když jeho player slot v DB existuje.

---

## 1. Jak je dnes identifikovaný hráč

### 1.1 Primární identifikátor — localStorage

```
localStorage.setItem(`paytowin_player_${gameCode}`, player.id)
// např. paytowin_player_ABCDE → "uuid-1234-..."
```

**Co to znamená:**
- Identita je uložena **jen v daném prohlížeči a zařízení**
- Klíč je per-game (nový klíč pro každou hru)
- UUID je generováno při INSERT do `players` tabulky
- Bez tohoto klíče = cizinec

**Kde se nastavuje:**
- `app/components/LandingPage.tsx:750` — po úspěšném joinu
- `app/components/LandingPage.tsx:668` — Discord reclaim v join flow (LandingPage only)
- `app/game/join-actions.ts` — schválení join requestu (approval flow)

**Kde se čte:**
- `app/components/GameBoard.tsx:485` — jediné místo, kde se určuje role hráče

### 1.2 Sekundární identifikátor — Discord ID

```sql
players.discord_id TEXT NULL  -- ← Discord provider_id
players.discord_avatar_url TEXT NULL
```

- Uložen v DB pro každého přihlášeného Discord hráče
- Slouží pro Discord reclaim **pouze v LandingPage join flow** (ne v GameBoard)
- Discord session spravuje Supabase Auth (cookie/storage)
- Discord ID je `user.user_metadata.provider_id`

### 1.3 Co se NEKONTROLUJE

- Platnost `localStorage` UUID vůči DB — GameBoard nastaví `viewerRole="player"` i pro neplatné UUID
- Discord ID v `GameBoard.loadGame()` — Discord session se načítá ale neporovnává s `players.discord_id`
- Expirace nebo revokace identity

---

## 2. Co se stane při změně zařízení

### 2.1 Scénář: desktop → mobil přes Discord link

```
Desktop (PC):
  localStorage["paytowin_player_ABCDE"] = "uuid-1234"
  Hráč hraje normálně → zavře prohlížeč

Mobil:
  Klikne na Discord room link → URL: paytowin.cz/game/ABCDE
  localStorage["paytowin_player_ABCDE"] → null (jiné zařízení)

GameBoard.loadGame():
  pid = localStorage.getItem("paytowin_player_ABCDE") → null
  myDiscordId = supabase.auth.getUser() → Discord ID (pokud přihlášen)
  
  if (pid) → NE
  else:
    role = myDiscordId ? "spectator" : "login_required"
    ↓
  setViewerRole("spectator")   ← HRÁČ SKONČIL JAKO POZOROVATEL
```

**Výsledek:** Hráč vidí hru, ale nemůže hodit kostkou. Hra je zablokovaná na jeho tahu. Ostatní hráči čekají nebo (pokud je bot trigger) nic neviní.

### 2.2 Proč Discord reclaim v GameBoard chybí

V `LandingPage.joinGame()` (řádky 665-674) Discord reclaim existuje:

```typescript
if (discordUser?.id) {
  const existingPlayer = existingPlayers?.find(p => p.discord_id === discordUser.id);
  if (existingPlayer) {
    localStorage.setItem(`paytowin_player_${game.code}`, existingPlayer.id);
    logEvent({ name: "join_game_rejoin", game_code: game.code });
    router.push(`/game/${game.code}`);
    return;
  }
}
```

Ale v `GameBoard.loadGame()` (řádky 485-500) žádná taková kontrola není:

```typescript
// Aktuální kód:
const pid = localStorage.getItem(`paytowin_player_${gameCode}`);
setMyPlayerId(pid);

if (pid) {
  setViewerRole("player");
} else {
  const role = myDiscordId ? "spectator" : "login_required";
  setViewerRole(role);
  // ← žádná kontrola: existuje player s tímto discord_id v této hře?
}
```

**Mezera:** Discord link vede na `/game/CODE`. Ten otevře GameBoard přímo. GameBoard nemá Discord reclaim. Hráč = spectator.

### 2.3 Duplicitní player slot

Pokud hráč z mobilu přejde zpět na LandingPage a zadá kód:
- Discord reclaim v LandingPage FUNGUJE (najde existující player dle discord_id)
- Hráč správně dostane svůj původní slot ✅

Pokud hráč NENÍ přihlášen Discordem nebo reclaim selže a klikne „Připojit":
- Vytvoří nový player slot (pokud hra stále v prvním kole)
- Původní slot osiří
- Viz podrobněji: `join-link-spectator-rejoin-audit.md` sekce 5.2

---

## 3. Co se stane při zavření a znovuotevření hry

| Situace | Výsledek | Poznámka |
|---------|---------|---------|
| Reload na stejném zařízení | ✅ Plný přístup | localStorage intact |
| Nová karta, stejný prohlížeč | ✅ Plný přístup | localStorage sdílený |
| Jiný prohlížeč, stejný PC | ❌ Spectator/blocked | Jiný localStorage scope |
| Přímý link `/game/CODE`, nové zařízení | ❌ Spectator/blocked | Viz sekce 2.1 |
| LandingPage + kód + Discord | ✅ Reclaim | Pokud Discord session platná |
| LandingPage + kód, bez Discord | ❌ Nový player slot | Pokud hra ve 1. kole |
| Návrat po delší době (>session) | ✅ Pokud localStorage | Discord session může expirovat, ale localStorage přetrvává |

**Záchranná linka je: přijít přes LandingPage + zadat kód + být přihlášen Discordem.**

---

## 4. Stav hry po návratu (pokud se rejoin podaří)

`GameBoard.loadGame()` volá `refreshGame(game.id)` vždy po úspěšném načtení:

```typescript
await refreshGame(game.id);  // fetchne players + game_state z DB
setLoading(false);
```

A useEffect na `game_state.horse_pending / card_pending / offer_pending / current_player_index` obnoví pending stavy:

```typescript
// řádky 2366–2400
React.useEffect(() => {
  if (gameState.horse_pending) {
    // obnoví pendingRacer pro správného hráče
  }
  if (gameState.card_pending) {
    // obnoví pendingCard
  }
  if (gameState.offer_pending?.type === "reroll") {
    // obnoví pendingOffer
  }
}, [gameState?.horse_pending, gameState?.card_pending, gameState?.offer_pending, gameState?.current_player_index]);
```

**Co se obnoví po úspěšném rejoin:**
- ✅ Pozice hráčů, coins, koně
- ✅ Aktuální hráč na tahu
- ✅ horse_pending (horse decision modal)
- ✅ card_pending (karta k vyřešení)
- ✅ offer_pending (reroll, bankrupt announce, race)
- ✅ Stable duel (via offer_pending + sdPending check)
- ✅ game log (posledních 20 řádků)
- ⚠️ Race / závodní výsledky — pokud race_pending nebo activePendingRace, záleží na timing
- ⚠️ stableDuelCtx — reset na null, pak obnovíme z offer_pending (funguje ale může být delay)

**Co se NEOBNOVÍ (lokální React state):**
- Animační stav (probíhající animace pohybu) — při rejoin restart
- isRolling / isMoving — reset na false (bezpečné)
- coinsFeedback floater — ztraceno (drobné UX)

---

## 5. Multiplayer edge-cases

### 5.1 Hráč se připojí z druhého zařízení, první stále otevřené

```
Device A: viewerRole="player", má localStorage
Device B: otevře /game/CODE → viewerRole="spectator" (nebo po LandingPage reclaim: "player")
```

Pokud oba jako "player" (oba mají localStorage, stejný player UUID):
- Oba mohou hodit kostkou → **race condition na DB write**
- turn_count guard v server action chrání stav: první write vyhraje, druhý dostane guard fail
- Realizuje se tichý fail — no duplicate actions ✅
- UX: druhý device může vidět stale stav 1-2s

### 5.2 Dvě zařízení stejného hráče najednou

Viz 5.1. Nebezpečné hlavně pokud hráč klikne rychle na obou zařízeních. Server guard (`turn_count !== expectedTurnCount`) chrání. Ale Realtime může dodat event oběma → oba vidí aktualizovaný stav téměř synchronně.

### 5.3 Hráč otevře link v anonymním okně

- Anonymní okno = nový, izolovaný localStorage scope
- Hráč = spectator (bez localStorage, Discord session závisí na prohlížeči)
- Pokud Discord session v normálním okně nepřenáší do anonymního → login_required

### 5.4 Druhý hráč použije stejný link (`/game/CODE`)

- Dostane GameBoard ve spectator nebo login_required módu
- Pokud zkusí přes LandingPage → dle stavu hry bude late-join spectator nebo (pokud hra nezačala) nový hráč
- Žádná ochrana na "k tomuhle linku patří tento hráč" — link je zcela veřejný

### 5.5 Hostitel odmítl / schválil join a hráč se vrací

- `game_join_requests` tabulka udržuje stav `pending / approved / rejected`
- Schválený hráč dostal player row a localStorage
- Odmítnutý hráč dostane `status: "rejected"` přes polling
- Hráč, který byl schválen a vrací se přes LandingPage: Discord reclaim funguje ✅
- Hráč, který byl schválen a vrací se přes `/game/CODE` přímý link: závisí na localStorage ✅ nebo Discord reclaim v GameBoard ❌ (chybí)

---

## 6. Discord scénář

### 6.1 Jak dnes funguje přechod z Discordu do hry

Discord notifikace posílá URL hry. Typ URL záleží na implementaci v `app/game/discord-actions.ts`. Typicky jde o `paytowin.cz/game/CODE` nebo `paytowin.cz/?join=CODE`.

**Pokud link = `/game/CODE`:**
- GameBoard načte hru
- Discord session se obnoví (Supabase Auth cookie)
- Ale `localStorage["paytowin_player_CODE"]` na novém zařízení = null
- → **Spectator** (i když hráč má player slot v DB)

**Pokud link = `/?join=CODE`:**
- LandingPage předvyplní kód
- Discord session obnoví
- Discord reclaim proběhne při kliknutí „Připojit"
- → Hráč se **vrátí do svého slotu** ✅
- Ale: uživatel musí kliknout tlačítko — není to automatické

### 6.2 Vhodnost "rejoin link"

Ideální rejoin link by obsahoval player token nebo byl dost specifický pro automatický reclaim. Možné přístupy:

**Varianta A: claim token v URL**  
`/game/CODE?claim=PLAYER_UUID` — předá UUID přímo v URL, GameBoard ho načte bez localStorage

Výhody: funguje bez Discordu  
Rizika: UUID je v URL, sdítelný → kdokoliv s linkem si může převzít slot

**Varianta B: Discord-triggered reclaim v GameBoard (doporučeno)**  
GameBoard při `pid=null && myDiscordId` porovná `discord_id` z DB s `myDiscordId`, pokud match → automaticky nastaví `localStorage` a `viewerRole="player"`

Výhody: bezpečné (Discord auth), plynulé, bez token v URL  
Nevýhody: vyžaduje Discord login na novém zařízení

**Varianta C: magic link přes e-mail / notifikaci**  
Nad rámec MVP; vyžaduje nový auth systém.

---

## 7. Bezpečnost a abuse

### 7.1 Může hráč převzít cizí slot?

**Přes URL token (`/game/CODE?claim=UUID`):** Ano — pokud UUID unikne (přes historii, clipboard, screenshot URL).

**Přes Discord reclaim:** Ne — vyžaduje autentizovaný Discord účet, jehož `provider_id` musí souhlasit s `players.discord_id`. Bez Supabase session to nejde.

**Přes localStorage injection:** Lokálně na stejném zařízení lze nastavit libovolné UUID. Ale UUID jsou UUIDs (128-bit) — bez znalosti konkrétního UUID nejde uhodnout.

### 7.2 Lze uhodnout playerId nebo gameId?

- `gameId` (UUID): 128-bit náhodný UUID — prakticky neuhádnutelný
- `gameCode` (5-char alphanumeric): ~60M kombinací — brute-force možný, ale API rate-limit nebo Supabase RLS by měl bránit
- `playerId` (UUID): stejně jako gameId — prakticky neuhádnutelný

**Aktuální stav:** Supabase RLS konfigurace nebyla součástí tohoto auditu — ověřit samostatně, zda `players` tabulka má RLS zapnuté.

### 7.3 Expirace tokenu / linku

Dnes žádná expirace:
- localStorage přetrvává dokud uživatel ručně nevymaže nebo prohlížeč neresetuje
- Discord session expiruje dle Supabase session TTL (default: 1h access token, refresh token déle)
- `game_join_requests` záznamy nemají timeout

**Riziko:** Hráč s neplatným localStorage UUID (hra smazána) stále dostane `viewerRole="player"`, ale akce selžou.

---

## 8. UX — co hráč uvidí

### 8.1 Při správném rejoin (localStorage intact)

- GameBoard načte rovnou se správnou rolí
- Žádná speciální obrazovka "Pokračuješ jako..."
- Hra je připravena ihned ✅
- UX gap: hráč neví, že se vrátil jako hráč (žádný confirmation banner)

### 8.2 Při neúspěšném rejoin (nové zařízení, spectator)

- Hráč vidí desku, ale dice button chybí
- Žádná zpráva: "Poznávám tě, chceš se vrátit jako [jméno]?"
- Žádné tlačítko "To jsem já, přihlaš mě"
- Hráč neví, co udělat ← **toto je hlavní UX fail**

### 8.3 Doporučené UX pro rejoin

**Minimální verze:**
```
[Obrazovka při spectator módu, pokud Discord je přihlášen]

"Poznávám tvůj Discord účet — jseš [jméno] v této hře?"
[Pokračovat jako [jméno]] [Sledovat jako pozorovatel]
```

**Ideální verze:**
```
Automatický rejoin bez obrazovky — GameBoard tiše nastaví localStorage
z Discord identity, stránka se překreslí jako player mode.
```

---

## 9. Konkrétní soubory a kód

| Soubor | Relevantní sekce | Popis |
|--------|-----------------|-------|
| `app/components/GameBoard.tsx` | řádky 480–501 | `loadGame()` — identita z localStorage, nastavení role. **Sem patří Discord reclaim.** |
| `app/components/LandingPage.tsx` | řádky 606–752 | `joinGame()` — join flow s Discord reclaim (již existuje) |
| `app/game/join-actions.ts` | `createPlayer`, `approveJoinRequestAction` | Server actions pro vytvoření player row |
| `app/components/GameBoard.tsx` | řádky 2366–2400 | useEffect: obnova pending stavů po reload — OK |
| `supabase/migrations/20260417_players_add_discord_identity.sql` | celý soubor | Přidává `discord_id` sloupec — bez UNIQUE indexu |
| `_db/before_run.sql` | players table | Schema — chybí UNIQUE constraint na (game_id, discord_id) |

---

## 10. Návrh kroků

### Minimální bezpečná verze pro MVP

**Krok 1 — Discord reclaim v GameBoard (nejdůležitější)**

Soubor: `app/components/GameBoard.tsx`, funkce `loadGame()`, za řádkem 486.

```typescript
let pid = localStorage.getItem(`paytowin_player_${gameCode}`);

// Discord reclaim: pokud nemáme localStorage, zkus najít player row dle discord_id
if (!pid && myDiscordId) {
  const { data: discordPlayer } = await supabase
    .from("players")
    .select("id, name")
    .eq("game_id", game.id)
    .eq("discord_id", myDiscordId)
    .eq("is_bot", false)
    .maybeSingle();
  if (discordPlayer) {
    localStorage.setItem(`paytowin_player_${gameCode}`, discordPlayer.id);
    pid = discordPlayer.id;
  }
}

setMyPlayerId(pid);
```

**Dopad:** Hráč s Discord session, který přijde přes přímý link `/game/CODE`, automaticky dostane zpět svůj player slot. Žádná interakce není potřeba.

**Krok 2 — Informovat hráče při auto-reclaim (UX)**

Přidat krátký toast/banner: `"Pokračuješ jako [jméno] 🐎"` — zobrazit jednou po reclaim.

**Krok 3 — UNIQUE DB index (prevence duplikátů)**

```sql
CREATE UNIQUE INDEX IF NOT EXISTS players_game_discord_unique
  ON players(game_id, discord_id)
  WHERE discord_id IS NOT NULL;
```

Migrační soubor: `supabase/migrations/202606xx_players_discord_unique_index.sql`

**Krok 4 — Dokumentovat správný link formát**

Discord notifikace a sdílecí link `paytowin.cz/?join=CODE` → LandingPage flow (pro hráče bez localStorage jako fallback). Přímý link `/game/CODE` je primární a po Kroku 1 bude plně funkční pro Discord hráče.

---

### Ideální verze do budoucna

1. **Claim token v URL** — pro non-Discord hráče: `paytowin.cz/game/CODE?claim=TOKEN` kde TOKEN je krátkodobý (15 min) podepsaný JWT nebo HMAC token vázaný na player UUID
2. **Game share link** po joinu = `/game/CODE` (ne `/?join=CODE`) — snižuje riziko náhodného duplicitního joinu
3. **"Přejít do hry" button** v Discord notifikaci → `paytowin.cz/game/CODE` — po Kroku 1 bude fungovat pro všechny Discord hráče
4. **Session persistence** — Supabase session refresh token by měl pokrýt multi-day session, ověřit TTL nastavení
5. **RLS audit** — ověřit, že `players` tabulka má správné Row Level Security pravidlo tak, aby hráč nemohl zapisovat za jiného hráče

---

## 11. Rizika

| Riziko | Závažnost | Poznámka |
|--------|-----------|---------|
| Hráč skončí jako spectator přes Discord link | Vysoká | Hlavní blocker pro claim "pokračuješ z mobilu" |
| Duplicitní player slot (ztracený localStorage) | Střední | Discord reclaim v LandingPage částečně chrání |
| Neplatné UUID v localStorage | Nízká | Akce selžou tiše, hráč neví proč |
| Claim token uniklý z URL | Střední | Jen pokud implementujeme token-v-URL variantu |
| Žádná expirace localStorage | Nízká | Hra stará měsíce stále "live" pro daný browser |
| RLS neověřeno | Neznámá | Potenciálně kritická mezera |

---

## 12. Testovací checklist

### Krok 1 — základ (localStorage)

- [ ] Desktop: join hry → localStorage klíč nastaven ✓
- [ ] Reload stejné stránky → stejný hráč, plný přístup ✓
- [ ] Nová karta, stejný prohlížeč → plný přístup ✓
- [ ] Jiný prohlížeč, stejný PC → spectator (očekávané bez Kroku 1) ✓

### Krok 2 — Discord reclaim v GameBoard (po implementaci)

- [ ] Desktop: join s Discord → zavřít prohlížeč
- [ ] Mobil: přejít na `/game/CODE` přímým linkem
- [ ] Ověřit: hráč automaticky identifikován (žádná interakce)
- [ ] Ověřit: player slot stejný jako na desktopu (turn_order, coins, horses)
- [ ] Ověřit: dice button dostupný
- [ ] Ověřit: hra plynule pokračuje

### Krok 3 — edge-cases

- [ ] Dvě zařízení najednou (stejný hráč) — oba jako player → rychlé akce → žádná double-execution
- [ ] Hráč bez Discord na novém zařízení → spectator, jasná zpráva
- [ ] Anon okno → spectator
- [ ] Cizí hráč otevře link → spectator nebo nový join (ne přijetí cizího slotu)
- [ ] Rejoin po 24h (Supabase token refresh) → Discord session platná → reclaim funguje

---

## 13. Závěrečné doporučení

**Lze dnes tvrdit: "Začneš u stolu, pokračuješ z mobilu"?**

**Ne.** Bez Kroku 1 (Discord reclaim v GameBoard) je toto tvrzení nepravdivé pro hlavní scénář:

> Desktop → zavřít → mobil → kliknutí na Discord link → `/game/CODE` → **spectator**

Přechod z mobilu FUNGUJE pouze pokud hráč:
1. Přijde přes LandingPage (ne přímý link), zadá kód a má aktivní Discord session

To je příliš složité pro marketingové tvrzení.

**Po implementaci Kroku 1 (Discord reclaim v GameBoard, ~30 řádků kódu):**
- Tvrzení "Začneš u stolu, pokračuješ z mobilu" je pravdivé **pro Discord hráče**
- Non-Discord hráči stále závisí na localStorage (stejný prohlížeč)
- Podmínka: Discord session platná na novém zařízení (standardně ano při Discord loginu)

**Doporučení:** Implementuj Krok 1 před použitím tohoto marketingového tvrzení. Je to malá změna (~30 řádků v GameBoard.loadGame()) s velkým dopadem.
