# Audit: Join / Reconnect / Turn Order Flow

**Datum:** 2026-06-02  
**Typ:** Read-only analýza  
**Navazuje na:** `docs/audits/offline-players-auto-skip-audit.md`  
**Stav:** Bez implementace — pouze popis + doporučení

---

## 1. Reálný scénář a výchozí otázka

Zakladatel vytvořil hru s botem, poslal link dvěma přátelům. Všichni čtyři hráli. V polovině hry všichni zavřeli prohlížeč. Zakladatel se vrátil do stejné hry — hrál jen on a bot, přátelé byli vidět, ale jejich tahy se přeskakovaly.

**Předchozí audit (offline-players-auto-skip-audit.md) zjistil:**
- hra nemá online/offline detekci
- `getNextActiveIndex` přeskakuje **jen bankrotáře** (`coins <= 0`)
- offline hráč s `coins > 0` by měl hru zastavit

**Otázka tohoto auditu:** Proč se tedy přátelé přeskakovali? Jsou to skuteční turn-order hráči, nebo viditelní, ale mimo pořadí?

---

## 2. Jak se zakládá hra a přidávají hráči

### 2.1 Zakládání hry — createGame

**`app/components/LandingPage.tsx` ~line 493:**

```typescript
// Zakladatel jako hráč 0
await supabase.from("players").insert({
  turn_order: 0,
  ...
});

// Bot (pokud zaškrtnut) jako hráč 1
if (addBotPlayer) {
  await supabase.from("players").insert({
    turn_order: 1,
    is_bot: true,
    ...
  });
}
```

Identita zakladatele uložena: `localStorage.setItem("paytowin_player_${code}", newPlayer.id)`.

### 2.2 Připojení přes link — joinGame

**`app/components/LandingPage.tsx` ~lines 651–671:**

```typescript
const [{ data: existingPlayers }, { data: stateData }] = await Promise.all([
  supabase.from("players").select().eq("game_id", game.id),
  supabase.from("game_state").select("turn_count").eq("game_id", id).single(),
]);

const turnCount = stateData?.turn_count ?? 0;
const currentPlayerCount = existingPlayers?.length ?? 0;

// ── KLÍČOVÝ GUARD: late-join jako pozorovatel ──────────────────────────
if (currentPlayerCount > 0 && turnCount >= currentPlayerCount) {
  // Hra probíhá a první kolo již skončilo — připoj jako pozorovatel
  sessionStorage.setItem("paytowin_late_join", game.code);
  router.push(`/game/${game.code}`);
  return;
}
```

**Podmínka pro late-join (pozorovatel):** `turn_count >= počet_hráčů`

Příklad: 4 hráči (zakladatel + bot + přítel1 + přítel2). Late-join se aktivuje po `turn_count >= 4`, tedy až poté, co všichni 4 hráči odehráli alespoň 1 tah.

**Pokud se přátelé připojili PŘED dokončením 1. kola** (pravděpodobný případ, hráli „společně"):
```typescript
const turnOrder = existingPlayers?.length ?? 0;  // 2 nebo 3

await supabase.from("players").insert({
  turn_order: turnOrder,
  ...
});

localStorage.setItem(`paytowin_player_${game.code}`, newPlayer.id);
```

→ Přátelé se stali **plnohodnotnými hráči v `players` tabulce** s `turn_order 2` a `3`.

### 2.3 Kdy je hráč v turn orderu

Hráč je v turn orderu výhradně pokud **je v `players` tabulce s neprázdným `turn_order`**. Nic jiného nerozhoduje.

Late-join pozorovatel (`paytowin_late_join`) se do `players` tabulky **nepřidá vůbec**.

---

## 3. Jak funguje pořadí hráčů a current_player_index

**`app/components/GameBoard.tsx` ~line 522:**

```typescript
supabase.from("players").select().eq("game_id", id).order("turn_order")
```

Hráči jsou načteni vždy **seřazeni podle `turn_order` ASC**. `current_player_index` je **index do tohoto pole**, ne ID hráče.

Příklad stavu po připojení přátel:
```
players[0] = Zakladatel  (turn_order=0)
players[1] = Bot          (turn_order=1)
players[2] = Přítel1      (turn_order=2)
players[3] = Přítel2      (turn_order=3)

current_player_index = 2  →  Přítel1 je na tahu
```

### 3.1 Přeskakování — `getNextActiveIndex`

**`lib/engine.ts` lines 314–323:**

```typescript
export function getNextActiveIndex(currentIndex: number, players: Player[]): number {
  let next = (currentIndex + 1) % players.length;
  let attempts = 0;
  while (isBankrupt(players[next]) && attempts < players.length) {
    next = (next + 1) % players.length;
    attempts++;
  }
  return next;
}

export function isBankrupt(player: Player): boolean {
  return player.coins <= 0;  // ← JEDINÁ podmínka pro skip
}
```

**Hráč se přeskočí jedině pokud má `coins <= 0` (bankrot). Offline stav neexistuje.**

---

## 4. Odpověď na otázku reálného scénáře

### 4.1 Proč se přátelé přeskakovali — nejpravděpodobnější vysvětlení

**Přátelé zbankrotovali (`coins <= 0`) ještě před tím, než všichni odešli.**

V tom případě:
1. Přátelé jsou v `players` tabulce jako regulérní hráči (turn_order 2 a 3)
2. `getNextActiveIndex` jejich index v každé iteraci přeskočí
3. Zakladatel a bot střídají tahy nepřetržitě
4. Přátelé jsou **vidět v PlayerList** (zobrazují se i bankrotáři), ale do kola nejsou zahrnuti

Toto je **záměrné a správné chování**.

### 4.2 Alternativní vysvětlení — hráči měli coins > 0

Pokud přátelé nezbankrotovali, hra by při jejich tahu stála. Zakladatel by nemohl hrát bez jejich akce. Tento scénář neodpovídá popsanému „pokračování hry."

→ **Scénář s bankrotem je prakticky jistý.**

---

## 5. Jak se hráč identifikuje po refreshi / reconnectu

**`app/components/GameBoard.tsx` lines 480–501:**

```typescript
const { data: { user } } = await supabase.auth.getUser();
const myDiscordId = user?.user_metadata?.provider_id as string | undefined;

const pid = localStorage.getItem(`paytowin_player_${gameCode}`);
setMyPlayerId(pid);

// Urči roli: hráč / pozorovatel / nepřihlášen
if (pid) {
  setViewerRole("player");              // ← Má localStorage klíč = hráč
} else {
  const role = myDiscordId ? "spectator" : "login_required";
  setViewerRole(role);                  // ← Bez localStorage klíče = pozorovatel nebo nepřihlášen
}
```

### 5.1 Identita hráče závisí výhradně na localStorage

| Stav | Výsledek |
|------|---------|
| localStorage klíč přítomen + odpovídá player ID v DB | `viewerRole = "player"`, `myPlayerId = pid` ✓ |
| localStorage klíč přítomen, ale player_id v DB neexistuje | `viewerRole = "player"`, ale akce selžou (ID nenalezeno) |
| localStorage chybí + Discord přihlášen | `viewerRole = "spectator"` — jen čte hru |
| localStorage chybí + Discord nepřihlášen | `viewerRole = "login_required"` — vyzve k přihlášení |

### 5.2 Neexistuje Discord-based identity recovery

Discord ID se při načtení hry použije **pouze** pro:
- detekci host role (`owner_discord_id === myDiscordId`)
- rozhodnutí spectator vs. login_required (pokud chybí localStorage)

**Discord přihlášení nedokáže hráči vrátit jeho player slot**, pokud ztratil localStorage klíč.

### 5.3 Kdy zakladatel / přátelé reconnectují úspěšně

Pokud se vrátí na **stejném zařízení a prohlížeči** (localStorage je perzistentní):
- localStorage klíč je stále přítomen
- `pid` odpovídá jejich player ID v `players` tabulce
- `viewerRole = "player"`, hra se obnoví normálně

**Zakladatel po zavření a znovuotevření prohlížeče měl localStorage nedotčený → mohl hrát.**

---

## 6. Kdy může být hráč vidět, ale nebýt v turn orderu

### 6.1 Bankrotovaný hráč

Hráč je v `players` tabulce, ale `coins <= 0`:
- viditelný v PlayerList s vizuální degradací
- **přeskakován v každém tahu**
- nemůže provádět žádné herní akce (formuláře zakázány)

### 6.2 Late-join pozorovatel

Hráč, který se pokusil připojit po prvním kole:
- **NENÍ v `players` tabulce** — nebyl vůbec přidán
- vidí GameBoard jako spectator
- nemůže dělat žádné akce
- v PlayerList se nezobrazí

### 6.3 Hráč bez localStorage (ztracená identita)

Hráč, který byl původně v `players` tabulce, ale ztratil localStorage klíč:
- `viewerRole = "spectator"` nebo `"login_required"`
- **není odstraněn z `players` tabulky** — jeho player row stále existuje
- po jeho tahu hra může stát (pokud není bankrot)
- **tichá chyba** — žádný feedback pro ostatní hráče

---

## 7. Vizuální označení bankrotu

**`app/components/board/PlayerList.tsx` ~lines 60–135:**

```typescript
const bankrupt = isBankrupt(player);  // coins <= 0

// Border/background
bankrupt ? "border-red-200 bg-red-50/50 opacity-35" : ...

// Avatar
bankrupt ? "ring-slate-300 opacity-40" : "ring-black/20"

// Jméno
bankrupt ? "text-slate-400 line-through" : ...  // přeškrtnuté jméno

// Status label
bankrupt
  ? <div className="text-xs font-semibold text-red-500">💀 Zkrachoval</div>
  : <div>{field?.emoji} {field?.label}</div>
```

Bankrot je vizuálně **zřetelně označen** v PlayerList:
- červený rámeček
- 35% průhlednost (opacity-35)
- šedý avatar s nižší opacity
- přeškrtnuté jméno
- label **„💀 Zkrachoval"**

**Problém:** Vizuální rozlišení je ale jen v PlayerList panelu. Pokud hráč není zaměřen na tento panel a sleduje herní desku, nemusí si uvědomit, že ostatní zbankrotovali — zvlášť když přišel až po zavření prohlížeče a neviděl průběh bankrotu.

---

## 8. Dopad na win stars a XP

**`app/game/actions.ts` lines 234–237:**

```typescript
const humanPlayers = (players ?? []).filter(p => !p.is_bot && p.discord_id);
if (humanPlayers.length < 2) return { ok: false, error: "Méně než 2 hráči s Discord identitou" };

const winner = (players ?? []).find(p => (p.coins ?? 0) > 0 && !p.is_bot && p.discord_id);
```

**Guard pro win star:**
- Vyžaduje ≥ 2 hráče s Discord ID **bez ohledu na bankrot**
- Bankrotovaný přítel s Discord ID se počítá do limitu → guard projde
- Win star se udělí zakladateli jako vítězi i přesto, že soutěžil jen s bankrotovanými hráči

Toto je **sémanticky nevýznamná výhra** (přátelé zbankrotovali), ale technicky hra tuto situaci nerozlišuje od situace, kdy zakladatel porazil aktivní hráče.

---

## 9. Shrnutí: matice stavů hráče v UI vs turn orderu

| Stav hráče | Viditelný v PlayerList | V turn orderu | Může hrát | Vizuálně označen |
|-----------|----------------------|---------------|-----------|-----------------|
| Aktivní hráč (coins > 0) | ✓ | ✓ | ✓ | — (normální vzhled) |
| Bankrotovaný (coins ≤ 0) | ✓ | ✓ (ale přeskakován) | ✗ | ✓ (💀 Zkrachoval, opacity-35) |
| Late-join pozorovatel | ✗ | ✗ | ✗ | — (není v PlayerList) |
| Ztracená identita (spectator) | ✗ | ✓ (row stále v DB) | ✗ | ✗ (tichá chyba — ostatní nevidí) |
| Offline hráč s coins > 0 | ✓ | ✓ (stojí na tahu) | — | ✗ (není označen jako offline) |

---

## 10. Identifikované problémy a matení

### 10.1 [Bug — střední závažnost] Ztracená identity je tichá

Pokud hráč ztratí localStorage (jiný prohlížeč, jiné zařízení, vymazání dat):
- Vidí hru jako spectator bez vysvětlení
- Ostatní hráči neví, že je jejich protihráč de-facto odpojen
- Hra může stát na jeho tahu, pokud není bankrotovaný

**Dopad:** Hra stojí indefinitně. Není recovery cesta.

### 10.2 [UX matení — nízká závažnost] Bankrotovaný hráč „přeskakuje"

Pro nového pozorovatele/zakladatele po reconnectu může být bankrot ostatních hráčů **nečitelný**, zvlášť pokud:
- nepozoroval průběh jejich bankrotu (byl offline)
- fokus je na herní desce, ne na PlayerList

Technické chování je správné (bankrot → skip), ale UX neinformuje zakladatele dostatečně silně „tito hráči zbankrotovali, proto přeskakuji jejich tahy."

### 10.3 [Designový problém — střední závažnost] Win star za bankrot soupeřů

Win star se udělí i v situaci, kdy všichni soupeři zbankrotovali nebo odešli. Guard existuje (≥ 2 Discord hráčů), ale nerozlišuje aktivní účast.

### 10.4 [Potenciální confusion] Late-join podmínka je nejasná

Podmínka `turn_count >= currentPlayerCount` je matematicky správná (1 kolo = všichni hráli 1× = turn_count == N), ale pro přátele, kteří chtějí vstoupit do hry, kde se „teprve začíná hrát," může být překvapující přesměrování do spectator mode.

---

## 11. Doporučené cílové chování

### 11.1 Bankrot

**Současný stav je správný.** Vizuální označení existuje. Doporučení:
- Přidat log zprávu při bankrotu: `"${jméno} zkrachoval 💀"` (pokud ještě neexistuje)
- Přidat toast/telegram pro zakladatele po reconnectu: `"2 hráči jsou mimo hru (bankrot)."`

### 11.2 Ztracená identita — reclaim flow

Nejmenší bezpečný krok:
1. Pokud `viewerRole = "spectator"` a hráč má Discord přihlášení, zkontrolovat, zda existuje `players` row se stejným `discord_id`
2. Pokud existuje → nabídnout "Vrátit se jako hráč [jméno]" button
3. Po potvrzení → uložit `paytowin_player_${code}` do localStorage a reload

Tento tok umožní recovery přes Discord bez nové identity.

### 11.3 Offline hráč s coins > 0 (viz předchozí audit)

Viz `docs/audits/offline-players-auto-skip-audit.md` — implementovat timeout skip.

### 11.4 Win star guard zpřísnění

Přidat do `awardWinStarAction`:
```typescript
// Hráč se "počítá" pouze pokud odehrál alespoň 1 tah (vyžaduje nový sloupec turns_played)
const activeHumanPlayers = humanPlayers.filter(p => (p.turns_played ?? 0) >= 1);
if (activeHumanPlayers.length < 2) return { ok: false, error: "Méně než 2 aktivně hrající hráči" };
```

Vyžaduje DB migraci (`players.turns_played INT DEFAULT 0`).

---

## 12. Doporučený první implementační krok

**Discord-based identity recovery** (bez DB migrace):

```typescript
// V GameBoard loadGame(), pokud pid === null a Discord přihlášen:
if (!pid && myDiscordId) {
  const match = playersData?.find(p => p.discord_id === myDiscordId);
  if (match) {
    // Nabídnout reclaim
    setReclaimCandidate(match);  // → zobrazí modal "Vrátit se jako [jméno]?"
  }
}
```

Toto řeší nejhorší tiché selhání (ztracený localStorage) a umožní reconnect na jiném zařízení.

---

## 13. Otevřené otázky pro rozhodnutí člověkem

1. **Má se bankrot hráče zapisovat do herního logu?** (Nyní se zapisuje jen bankrot přes startovní pole — zkontrolovat.)
2. **Má toast/telegram při reconnectu informovat zakladatele o stavu soupeřů?** ("Přítel1 a Přítel2 zbankrotovali.")
3. **Má Discord-based reclaim být automatický nebo vyžadovat potvrzení?**
4. **Má být win star podmíněna aktivní účastí (`turns_played`) nebo stačí existence hráče v DB?**
5. **Co se má stát s hrou, kde zbyl jen 1 aktivní člověk + bot?** Oznámit? Ukončit automaticky?
6. **Má zakladatel vidět rozdíl mezi „přítel zbankrotoval" a „přítel odešel z hry"?**

---

## Přílohy

### A. Dotyčné soubory

| Soubor | Relevantní část |
|--------|----------------|
| `app/components/LandingPage.tsx:651–671` | Late-join guard a spectator redirect |
| `app/components/LandingPage.tsx:706–717` | Přidání hráče do players (turn_order) |
| `app/components/GameBoard.tsx:480–501` | loadGame — identita z localStorage |
| `app/components/GameBoard.tsx:520–525` | refreshGame — načtení players seřazených dle turn_order |
| `app/components/board/PlayerList.tsx:60–135` | Vizuální stav bankrotu |
| `lib/engine.ts:314–323` | getNextActiveIndex — skipuje jen bankrotáře |
| `lib/engine.ts:89–91` | isBankrupt — `coins <= 0` |
| `app/game/actions.ts:234–237` | awardWinStarAction — guard |

### B. Odpovědi na klíčové otázky auditu

| Otázka | Odpověď |
|--------|---------|
| Byli přátelé v turn orderu? | Ano — pokud se připojili před koncem 1. kola |
| Proč se přeskakovali? | Téměř jistě zbankrotovali. Bankrot = auto-skip v každém tahu |
| Mohli být vidět, ale mimo tah? | Ano — bankrotovaný hráč je viditelný (PlayerList), ale přeskakován |
| Jak funguje reconnect? | Výhradně přes localStorage klíč `paytowin_player_${code}` |
| Existuje Discord recovery? | NE — jen pro rozlišení spectator vs. login_required |
| Je chování technicky správné? | Ano — bankrot skip je záměrný. Problem je UX, ne bug |
| Kde chybí? | Tichá ztráta identity (jiné zařízení), win star za bankrot soupeře, žádný reconnect toast |
