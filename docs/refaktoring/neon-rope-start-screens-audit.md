# Neon Rope Duel — audit startovacích a čekacích obrazovek

Zpracováno: 2026-05-29

---

## 1. Shrnutí problému

Po přechodu na relativní WASD ovládání (commit a237172) zůstaly zastaralé texty klávesnic na třech místech:
- `StableDuelBoardLayer.tsx` PreStartPhase: stále ukazuje `A / D + S` (staré schéma).
- `StableDuelStatusBanners.tsx` pending/ready overlay i countdown overlay: ukazují `A / D + SPACE` pro challengera (SPACE boost je nesprávný — challenger má `Q`).

Mimo špatné texty existuje **duplicitní start-step v pvbot režimu**: po automatickém odpočtu PreStartPhase (5 s) se hráč ocitne v DuelArena idle obrazovce, kde musí znovu kliknout „▶ Start". Dvě fáze odpočtu za sebou jsou matoucí.

---

## 2. Nalezené komponenty a soubory

| Soubor | Komponenta / funkce | Typ obrazovky | Poznámka |
|---|---|---|---|
| `StableDuelBoardLayer.tsx` | `PreStartPhase` | Odpočet + OVLÁDÁNÍ overlay | Hlavní intro obrazovka; renderuje NeonKeyCap boxy |
| `StableDuelBoardLayer.tsx` | `ArenaPhase` | Wrapper DuelArena | Předává `autoStart` prop; pvbot = `false`, online = `true` |
| `StableDuelBoardLayer.tsx` | `ResultPhase` | Výsledková obrazovka | Bez klávesových textů |
| `StableDuelBoardLayer.tsx` | `waiting_result` fase | Defender čekací obrazovka | Bez klávesových textů |
| `StableDuelBoardLayer.tsx` | `defender_remote` keydown handler | Broadcast input | Posílá jen ArrowLeft / ArrowRight (starý scheme) |
| `StableDuelStatusBanners.tsx` | `pending / both_ready` blok | Online čekací overlay (fullscreen) | Obsahuje staré texty ovládání |
| `StableDuelStatusBanners.tsx` | `countdown` blok | Online odpočet overlay (fullscreen) | Obsahuje staré texty ovládání |
| `StableDuelStatusBanners.tsx` | `pvbot_awareness` blok | Malý defender info bar | Bez klávesových textů |
| `StableDuelStatusBanners.tsx` | `hasStarted` blok | Defender přechodový banner | Bez klávesových textů |
| `DuelArena.tsx` | idle overlay | In-arena intro | Texty aktuální: WASD, double-tap hint |
| `DuelArena.tsx` | HUD (ability bar) | Nitro/legendary label | Aktuální: `Q P1`, `P2 SPACE` |
| `GameBoard.tsx` | `StableDuelBoardLayer` render | Board overlay | Předává props, sám texty nezobrazuje |

---

## 3. Aktuální flow podle režimu

### 3.1 Local player vs bot (pvbot_awareness)

> Typický případ: lokální hra, oba hráči na stejném počítači nebo solo vs bot.

1. Hráč hodí kostkou, přistane na soupeřově dostihové poli.
2. `GameBoard.tsx` vytvoří `StableDuelPendingOffer` s `mode: "pvbot_awareness"` a okamžitě otevře overlay (bez čekání na ready).
3. **Obrazovka A — PreStartPhase** (5 sekund, automatický odpočet):
   - Zobrazí: player cards challenger vs defender, stakes preview, countdown `5 → 4 → 3 → 2 → 1 → GO!`, minigame název.
   - **OVLÁDÁNÍ box**: Challenger `A / D` zatáčet + `S` boost/nitro ← **ZASTARALÉ**. Defender `← / →` + `SPACE`. Nezobrazuje W/S ani double-tap hint.
   - Hráč může kliknout pro přeskočení.
   - Countdown běží sám; po `0` automaticky přejde na arenu.
4. **Obrazovka B — DuelArena idle screen** (vyžaduje kliknutí):
   - Zobrazí: "NEON ROPE DUEL", `WASD` (P1) / `Bot`, "double-tap straight key = boost" hint.
   - Hráč musí kliknout `▶ Start`. ← **DUPLICITNÍ KROK** (druhé spuštění po odpočtu)
5. Hra běží.
6. Hra skončí → ResultPhase → "Pokračovat →" → `onFinish`.

**Problém**: Hráč musí překonat dvě bariéry za sebou (odpočet → kliknutí Start). PreStartPhase ovládání ukazuje staré klávesy.

---

### 3.2 Local player vs player (hot-seat / same keyboard)

> V aktuální architektuře neexistuje explicitní "local pvp" mód.

- Pro lokální hru je P2 vždy bot (`mode === "pvbot"`).
- Oba hráči na stejné klávesnici v jedné lokální hře jsou technicky podporovaní (WASD pro P1, šipky pro P2), ale flow je totožný s pvbot — P2 pohyb generuje bot; klávesnice pro P2 (šipky) by fungovala jen pokud by byl `mode === "pvp"`, což se v lokální hře nespustí.
- **Závěr**: Local hot-seat pvp není v současné architektuře implementovaný mód. Pokud je žádoucí, vyžaduje explicitní toggle.

---

### 3.3 Online / remote defender (online_1v1)

**Challenger flow:**

1. Přistane na poli, vytvoří `StableDuelPendingOffer` s `mode: "online_1v1"`, `phase: "pending"`.
2. **Obrazovka A — StableDuelStatusBanners pending overlay** (fullscreen, z-44):
   - "STÁJOVÝ SOUBOJ", "Čekáš na [defender]…"
   - Ovládání: `A / D zatáčet · SPACE boost` ← **ZASTARALÉ** (má být `WASD · Q boost`)
   - Tlačítko: "Hrát proti botovi (pokud druhý hráč nereaguje)"
3. Defender klikne ready → `phase: "both_ready"`.
4. Challenger detekuje `both_ready` → zapíše `phase: "countdown"`, `startsAt: Date.now()+3000`.
5. **Obrazovka B — StableDuelStatusBanners countdown overlay** (fullscreen, z-44):
   - Velké číslo odpočtu (3 / 2 / 1 / …).
   - Ovládání: `A / D zatáčet · SPACE boost` ← **ZASTARALÉ**
   - "Po odpočtu se hra spustí automaticky"
6. `startsAt` vyprší → overlay se otevře s `duelRole="challenger_authority"`, `autoStart=true`.
7. **Obrazovka C — PreStartPhase** (sdílený odpočet z DB):
   - Zobrazí player cards, stakes, residuální countdown (obvykle < 1s), OVLÁDÁNÍ box se starými klávesami.
   - `disableManualStart=true` (nelze přeskočit).
8. Arena startuje automaticky (bez DuelArena idle screen, `autoStart=true`). ✓

**Defender flow:**

1. Vidí **Obrazovku A — StableDuelStatusBanners pending overlay**:
   - "[Challenger] tě vyzval na souboj"
   - Ovládání: `← / → zatáčet · SPACE boost` ← správné
   - Tlačítko "⚔️ JSEM PŘIPRAVEN"
2. Po kliknutí → `both_ready`, pak `countdown`.
3. Countdown overlay (stejný jako u challengera) + správné ovládání pro defendera.
4. Overlay se otevře s `duelRole="defender_remote"`, `autoStart=true`.
5. **PreStartPhase**: Zobrazí OVLÁDÁNÍ pro defendera (`← / → + SPACE`). Challenger sekce je skrytá.
6. Arena startuje automaticky. Inputy se posílají přes Broadcast channel na challengera.
7. Po lokálním konci hry → `waiting_result` fáze: "Čekám na potvrzení výsledku od challengera…"

**Poznámka k online defender inputu**: Defender v `online_1v1` posílá přes Broadcast pouze `direction: "left" | "right"` (starý scheme — arrow-left = turn-left). Nová relativní vrstva (steeringInput.ts) se na tento Broadcast kanál nevztahuje. Defender tedy nemá WASD ani double-tap boost v online módu — ovládání zůstává `← → SPACE`.

---

### 3.4 Countdown / start sequence — přehled kroků

| Mód | Krok 1 | Krok 2 | Krok 3 | Krok 4 |
|---|---|---|---|---|
| pvbot | PreStartPhase auto 5s | DuelArena idle (kliknutí) ← duplicita | Hra | — |
| online challenger | StatusBanners pending (čekání) | StatusBanners countdown (DB) | PreStartPhase (residuální) | Arena auto |
| online defender | StatusBanners pending (ready button) | StatusBanners countdown | PreStartPhase | Arena auto |

**Duplicitní krok v pvbot**: Krok 2 (DuelArena idle) je nadbytečný. PreStartPhase již provedla vizuální odpočet; přistání na idle obrazovce s dalším tlačítkem je matoucí.

---

## 4. Nalezené staré nebo matoucí texty

| Soubor | Aktuální text | Problém | Doporučená oprava |
|---|---|---|---|
| `StableDuelBoardLayer.tsx:418` | `NeonKeyCap "A"` / `NeonKeyCap "D"` | Nezobrazuje W/S; WASD je nyní plný scheme | Nahradit za `NeonKeyCap "W"` / `NeonKeyCap "A"` / `NeonKeyCap "S"` / `NeonKeyCap "D"` nebo kompaktní `WASD` cap |
| `StableDuelBoardLayer.tsx:424` | `NeonKeyCap "S"` + `"nitro"` | Boost je nyní na Q, ne S | `NeonKeyCap "Q"` + `"boost"` + druhý řádek `"nebo 2× dopředu"` |
| `StableDuelStatusBanners.tsx:115` | `A / D zatáčet · SPACE boost` (challenger) | A/D neúplné, SPACE je P2/Defender boost, challenger má Q | `WASD · Q boost` nebo `WASD · Q (nebo 2× dopředu)` |
| `StableDuelStatusBanners.tsx:201` | `A / D zatáčet · SPACE boost` (challenger) | Stejný problém jako řádek 115 | Stejná oprava |
| `StableDuelBoardLayer.tsx:421` | `zatáčet` (obecný popis) | Nezmíní že jde o relativní zatáčení dle směru | Volitelně: `relativní zatáčení` nebo zůstat obecné |

---

## 5. Doporučené sjednocené texty

### P1 ovládání (challenger / local pvbot)
```
W A S D    zatáčení (relativní dle směru)
Q          boost / nitro
2× dopředu = boost
```

Kompaktní varianta pro inline text:
```
WASD zatáčet · Q boost (nebo 2× dopředu)
```

NeonKeyCap layout pro PreStartPhase:
- Řádek 1: `[W]` `[A]` `[S]` `[D]` + text „zatáčet"
- Řádek 2: `[Q]` + text „boost · nebo 2× dopředu"

### P2 ovládání (defender / local — pokud by existoval local pvp)
```
← ↑ ↓ →   zatáčení (relativní dle směru)
SPACE      boost / nitro
2× dopředu = boost
```

Kompaktní varianta:
```
← ↑ ↓ → zatáčet · SPACE boost (nebo 2× dopředu)
```

### P2 ovládání v online_1v1 (defender remote — Broadcast)
```
← →        zatáčení (přímé: left = otočit vlevo)
SPACE      boost / nitro
```
> Pozn.: v online módu relatvní steering nefunguje — defender posílá pouze ArrowLeft/ArrowRight jako přímé relativní turn příkazy.

### Boost hint (universal)
```
boost: Q (P1) · SPACE (P2)
nebo: double-tap klávesa ve směru jízdy
```

### Bot / local / online badges
- pvbot: `BOT` badge u defender player card (již existuje v kódu jako `PlayerCard label="Defender"`)
- local pvp (pokud by se implementoval): `LOCAL P2` badge
- online: `ONLINE 1v1` badge (existuje jako `CHALLENGER` / `DEFENDER` small badge v PreStartPhase)

### Čekací obrazovky
- Challenger čeká: `Čekáš na [jméno]…`
- Defender ready button: `⚔️ JSEM PŘIPRAVEN` (ponechat)
- Oba ready: `Spouštím odpočet…` (ponechat)
- Waiting result: `Čekám na výsledek od challengera…` (ponechat)

---

## 6. Doporučený plán úprav

### Krok 1 — Bezpečné textové změny (nízké riziko, žádná logika)

**1a. `StableDuelBoardLayer.tsx` PreStartPhase OVLÁDÁNÍ box (řádky ~413–444)**
- Nahradit `NeonKeyCap "A"` / `NeonKeyCap "D"` layoutem pro WASD.
- Nahradit `NeonKeyCap "S"` za `NeonKeyCap "Q"` + přidat řádek „nebo 2× dopředu".
- Doporučená struktura:
  ```
  Řádek 1: [W] [A] [S] [D]   zatáčet
  Řádek 2: [Q]               boost · nebo 2× dopředu
  ```

**1b. `StableDuelStatusBanners.tsx` challenger ovládání (řádky 115 a 201)**
- Nahradit `A / D zatáčet · SPACE boost` za `WASD · Q boost (nebo 2× dopředu)`.
- Defender text (`← / → zatáčet · SPACE boost`) ponechat (správné pro online defender).

### Krok 2 — Odstranění duplicitního start-step v pvbot (střední riziko, logická změna)

**Problém**: Po PreStartPhase odpočtu se zobrazí DuelArena idle screen vyžadující kliknutí.

**Řešení**: V `ArenaPhase` nastavit `autoStart={true}` i pro pvbot mód, nebo přidat novou prop `autoStart` přímo na `StableDuelBoardLayer` props a předávat ji do ArenaPhase.

Alternativa (méně invazivní): změnit podmínku v `ArenaPhase`:
```jsx
// Místo:
autoStart={duelRole === "challenger_authority" || duelRole === "defender_remote"}
// Na:
autoStart={true}
```
Tím se DuelArena idle screen pro StableDuelBoardLayer flow úplně přeskočí. DuelArena mimo BoardLayer (dev shell) zůstane bez `autoStart` prop (výchozí false).

### Krok 3 — Volitelné: online defender WASD upgrade (vysoké riziko, broadcast změna)

V aktuálním stavu defender v `online_1v1` posílá pouze `direction: "left" | "right"` přes Broadcast (absolut key → přímý relative turn). Pokud by měl defender těžit z relativního WASD steeringu:
- Broadcast handler v `StableDuelBoardLayer.tsx` (defender_remote keydown, řádky 850–870) by musel být přepsán, aby:
  a) posílal absolutní klávesy (ArrowUp/Down/Left/Right) a
  b) challenger je přeložil přes `resolveRelativeDir` na relative directions.
  NEBO
  c) defender přeložil lokálně a posílal výsledný `Dir` (jak je nyní), ale pomocí `stateRef` pro aktuální facing — problém: defender nevidí autoritativní stav, jen svůj lokální.
- Tato změna je záměrně přeskočena v tomto auditu. Je to architektonická otázka PvP sync, nikoli textový fix.

---

## 7. Rizika a otázky před implementací

1. **autoStart=true v pvbot**: Zkontrolovat, jestli DuelArena idle screen v jiných kontextech (DevDuelShell, DevSpeedOpen) závisí na výchozím `autoStart=false`. Změna by se týkala pouze `ArenaPhase` v `StableDuelBoardLayer`, ne všech použití DuelArena.

2. **NeonKeyCap pro 4 klávesy WASD**: Aktuálně je layout pro A/D + S (3 keycaps). WASD jsou 4 klávesy — UI layout v PreStartPhase bude potřeba vizuálně přeskládat, aby se vešly do dostupného prostoru (šířka 176px player cards). Zvážit kompaktní řešení: jeden `WASD` keycap box místo čtyř.

3. **Double-tap v OVLÁDÁNÍ textu**: Double-tap boost je nová mechanika, která nemá ekvivalent u P2/defendera v online módu (kde double-tap nefunguje přes Broadcast). Text musí rozlišovat: local pvbot = double-tap funguje; online defender = double-tap nefunguje.

4. **Defender online controls text**: V PreStartPhase se defender kontrolám říká jen `← / →` (bez šipek nahoru/dolů). Po aktualizaci DuelArena idle screen na `← ↑ ↓ →` je nesoulad. Bylo by vhodné unifikovat na `← ↑ ↓ →` všude kde to dává smysl — ale pro online defender platí poznámka z bodu 3 (jen ArrowLeft/ArrowRight fungují přes Broadcast).

5. **`p1IsLegendary` v PreStartPhase**: Boost text rozlišuje „nitro" vs „legendary boost" na základě `p1IsLegendary`. Toto je správně. Po přejmenování klávesy S → Q zůstane tato podmínka platná.

6. **Pořadí oprav**: Doporučené pořadí: nejdřív Krok 1b (StatusBanners, čistý text), pak Krok 1a (PreStartPhase, UI layout), pak Krok 2 (autoStart). Každý krok je nezávislý.
