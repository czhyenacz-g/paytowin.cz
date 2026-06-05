# Audit: Stable Duel — mobilní ovládání a control hinty

**Datum:** 2026-06-05  
**Rozsah:** read-only analýza, žádné změny kódu  
**Autor:** Claude (Sonnet 4.6)

---

## 1. Reálný scénář

Hráč hraje **lokální hru (hot-seat) na mobilu** s kolegou. Dojde k Stable Duel. Na obrazovce se zobrazí ovládání / hinty. Hráč ťuká na tlačítka na displeji, ale had druhého hráče (P2) nezahýbá.

---

## 2. Stručné shrnutí

**Hlavní příčina:** Lokální hot-seat 1v1 Stable Duel **není implementován**. V lokální hře je P2 vždy bot — `mode="pvbot"`. Mobilní touch tlačítka pro P2 se v pvbot režimu **vůbec nevykreslují**. Hráč ťukal na hint `← →` pro defendera, který je jen vizuální text (NeonKeyCap), nikoliv interaktivní tlačítko. Had se proto nehýbal.

Sekundární nález: prestart hint ukazuje obě strany ovládání (challenger i defender) i v lokální hře, přestože P2 je bot — vizuálně matoucí.

---

## 3. Komponenty, kde se hinty / tlačítka renderují

| Komponenta | Soubor | Co renderuje |
|---|---|---|
| `PreStartPhase` | `StableDuelBoardLayer.tsx:320–454` | Vizuální hint OVLÁDÁNÍ — NeonKeyCap klávesy, není interaktivní |
| `DuelArena` (touch panel) | `DuelArena.tsx:563–597` | Skutečná interaktivní touch tlačítka TouchBtn — P1 vždy, P2 jen v pvp |
| `StableDuelBoardLayer` (outer touch) | `StableDuelBoardLayer.tsx:950–964` | Interaktivní TouchBtn pro `defender_remote` (online) |
| `NeonKeyCap` | inline v `StableDuelBoardLayer.tsx` | Pouze vizuální klávesa (span se stylem), žádný handler |
| `TouchBtn` | `app/components/ui/TouchBtn.tsx` | Skutečné interaktivní tlačítko s PointerEvent handlery |

**Dvě oddělené vrstvy:**
- **Hint vrstva** (`PreStartPhase`) — jen text/vizuál, bez handlerů
- **Control vrstva** (`DuelArena` + outer touch panel) — skutečné buttony s logikou

---

## 4. Přehled všech control hintů

### 4A. PreStartPhase — vizuální hinty (NeonKeyCap)

Soubor: `StableDuelBoardLayer.tsx:406–452`

**Challenger sekce** (zobrazena když `duelRole !== "defender_remote"`):
```
Desktop (sm:flex):   W A S D    → zatáčet
Mobile (sm:hidden):  A D Q      → ovládání
Vždy:                Q          → boost / legendary
                     nebo 2× dopředu
```

**Defender sekce** (zobrazena když `duelRole !== "challenger_authority"`):
```
Vždy (desktop i mobil):  ←  /  →   → zatáčet
                         SPACE      → nitro / legendary boost
```

> **Pozor:** Defender sekce se zobrazuje i v lokální hře, kde P2 je bot. Na mobilu jsou `←`, `→`, `SPACE` jen vizuální hinty, ne touch tlačítka.

### 4B. DuelArena — idle overlay hint

Soubor: `DuelArena.tsx:513–516`

```
pvp mode:    P1: WASD   ·  P2: ← ↑ ↓ →
pvbot mode:  P1: WASD   ·  Bot
```

Toto je text uvnitř idle stavu arény — jen informativní, žádné klávesy.

### 4C. DuelArena — skutečná touch tlačítka (TouchBtn)

Soubor: `DuelArena.tsx:563–597`

```
P1 (vždy):             A  D  Q
P2 (jen mode=pvp):     ←  →  SPACE
```

---

## 5. Jak funguje mapování kláves

### 5A. Interní input architektura

Input je postaven na **shared `keysRef`** (Set\<string\>), do které se přidávají/odebírají klávesové kódy. Tick loop čte stav setu každý frame.

```
keysRef.current.add("KeyA")   ← injektuje klávesa A nebo TouchBtn "A"
keysRef.current.add("KeyD")   ← injektuje klávesa D nebo TouchBtn "D"
```

**WASD i ADQ jsou tedy JEDEN mechanismus.** Touch tlačítka `A` a `D` injektují `"KeyA"` a `"KeyD"` — stejné kódy jako fyzické klávesy A a D na klávesnici. Nejde o přejmenování, jsou to totožné kódy.

### 5B. Klávesy P1 (challenger)

| Klávesa / Touch | Code | Akce |
|---|---|---|
| W / ↑ | KeyW | zatáčet nahoru |
| A | KeyA | zatáčet doleva |
| S / ↓ | KeyS | zatáčet dolů |
| D | KeyD | zatáčet doprava |
| Q (klávesa i TouchBtn) | KeyQ | boost / legendary |
| 2× straight key | double-tap | boost / legendary |

Směr je **relativní** (vlevo/rovně/vpravo vzhledem k aktuálnímu směru hada), ne absolutní. Řeší `resolveRelativeDir()` v `lib/duel/steeringInput.ts`.

### 5C. Klávesy P2 (defender)

| Klávesa / Touch | Code | Akce |
|---|---|---|
| ← | ArrowLeft | zatáčet doleva |
| → | ArrowRight | zatáčet doprava |
| ↑ | ArrowUp | zatáčet nahoru |
| ↓ | ArrowDown | zatáčet dolů |
| SPACE (klávesa i TouchBtn) | Space | nitro / legendary |

### 5D. Q jako akce

`Q` (KeyQ) je **aktivní akce** — explicitní boost. Není to starý label — používá se jako:
1. Klávesový zkratka na klávesnici
2. Label na touch tlačítku v `DuelArena` pro P1
3. Zobrazuje se v hint `NeonKeyCap` v prestartu

### 5E. Kde se rozhoduje mode (pvp vs pvbot)

Klíčová řádka: `StableDuelBoardLayer.tsx:500`
```tsx
mode={duelRole ? "pvp" : "pvbot"}
```

- `duelRole` je `undefined` v lokální hře → `mode = "pvbot"`
- `duelRole = "challenger_authority"` nebo `"defender_remote"` v online hře → `mode = "pvp"`

---

## 6. Jsou mobilní tlačítka skutečně klikací?

**TouchBtn (`app/components/ui/TouchBtn.tsx`) — ANO, je interaktivní:**

```tsx
onPointerDown={e => { e.preventDefault(); onPressStart?.(); }}
onPointerUp={() => onPressEnd?.()}
onPointerCancel={() => onPressEnd?.()}
onPointerLeave={() => onPressEnd?.()}
```

- Používá PointerEvents (funguje pro touch i mouse)
- `e.preventDefault()` zabraňuje ghost click
- `touchAction: "none"` v CSS — zabraňuje browser scroll interakci
- `minWidth: 44, minHeight: 44` — Apple HIG minimální touch target
- **Je to `<button>` element** — správně přístupný

**NeonKeyCap (prestart hint) — NE, není interaktivní:**
- Jen vizuální `span` s barevným border stylem
- Žádný handler
- Žádná funkce

---

## 7. Proč had na mobilu v lokální hře nezahýbal

### Kořenová příčina

Rozhodnutí v `StableDuelBoardLayer.tsx:500`:
```tsx
mode={duelRole ? "pvp" : "pvbot"}
```

V lokální hře není `duelRole` nastaven (je `undefined`), takže:
- `mode = "pvbot"` → P2 je bot
- Touch panel v `DuelArena.tsx:580` renderuje P2 tlačítka podmíněně:
  ```tsx
  {mode === "pvp" && !remoteP2Ref && (
    // P2 touch tlačítka
  )}
  ```
- Podmínka `mode === "pvp"` je **false** → P2 tlačítka se **nevykreslí vůbec**

### Sekundární příčina

I kdyby hráč ťukal na prestart hint (`←`, `→`, `SPACE` v `NeonKeyCap`), nic by se nestalo — jsou to vizuální prvky bez handlerů.

### Co se skutečně stalo

1. Lokální hra → `duelRole = undefined` → `mode = "pvbot"`
2. P2 had ovládá bot engine (`getBotInput()`), nikoliv hráč
3. Prestart OVLÁDÁNÍ panel stále ukazuje obě strany (Challenger + Defender) — viz podmínky `duelRole !== "defender_remote"` a `duelRole !== "challenger_authority"` — obě jsou true když duelRole=undefined
4. Hráč vidí defender hint s `←`, `→` a ťuká na ně — ale jsou to jen styly, ne buttony
5. Had (bot) se pohybuje sám, nezávisle na tapech

---

## 8. Matice režimů

| Režim | Desktop hint (prestart) | Mobilní hint (prestart) | Mobilní P1 tlačítka klikací? | Mobilní P2 tlačítka klikací? | Ovládaný P2 | Riziko |
|---|---|---|---|---|---|---|
| **Lokální hra — hot-seat** | W A S D + ← → SPACE (oba) | A D Q + ← → SPACE (oba) | ✅ Ano (A D Q) | ❌ Nevykreslí se | Bot | **KRITICKÉ** — hint matoucí, P2 nelze ovládat |
| **Lokální hra — PvBot** | W A S D + ← → SPACE (oba) | A D Q + ← → SPACE (oba) | ✅ Ano (A D Q) | ❌ Nevykreslí se | Bot | Střední — defender hint je nadbytečný |
| **Online — challenger_authority** | W A S D (jen challenger) | A D Q (jen challenger) | ✅ Ano (A D Q) | ❌ Nevykreslí se (P2 je remote) | Remote přes Broadcast | OK — P2 ovládá vlastní zařízení |
| **Online — defender_remote** | ← → SPACE (jen defender) | ← → SPACE (jen defender) | N/A | ✅ Ano (outer panel) | Lokální touch | OK — správně izolováno |
| **Desktop — pvbot** | W A S D | W A S D | N/A | N/A | Bot | OK |
| **Desktop — online pvp** | W A S D nebo ← → SPACE | W A S D nebo ← → SPACE | N/A | N/A | Remote | OK |

---

## 9. Rizika současného stavu

### R1 — KRITICKÉ: Lokální hot-seat Stable Duel nelze hrát na mobilu

- P2 nemá žádná touch tlačítka v pvbot režimu
- Bot ovládá P2 automaticky
- Hráč neví, že P2 je bot — hint naznačuje, že může ovládat

### R2 — STŘEDNÍ: Prestart hint ukazuje defender ovládání i v lokální hře

- `duelRole !== "challenger_authority"` je `true` při `duelRole=undefined`
- Defender hint (šipky, SPACE) se zobrazí i v pvbot lokálním souboji
- Na mobilu jsou tyto hinty jen vizuální — nemají touch ekvivalent

### R3 — NÍZKÉ: Absence Q touch tlačítka na mobilu v DuelArena pro boost double-tap

- `Q` touch button existuje, ale double-tap logika funguje jen pro fyzické klávesy (kontroluje `e.repeat` z KeyboardEvent)
- Touch tap → `keysRef.current.add("KeyQ")` → funguje pro boost, ale double-tap "2× dopředu" hint nefunguje pro touch

### R4 — NÍZKÉ: NeonKeyCap vs TouchBtn vizuální nekonzistence

- Prestart: hinty jsou jen vizuály → hráč může mít dojem, že ťuknutím na ně něco udělá
- Po spuštění souboje: skutečná touch tlačítka se liší rozložením
- Hráč musí "přejít" z hintu na ovládání

### R5 — NÍZKÉ: SpeedArenaPvp — P2 touch tlačítka bez role guardu

- `SpeedArenaPvp.tsx` zobrazuje P2 touch tlačítka bez podmínky na `duelRole`
- V online hře může challenger ťukat na P2 tlačítka challengerova zařízení
- (Reálný dopad nízký — SpeedArenaPvp může být jen dev/test feature)

---

## 10. Doporučené cílové chování (bez implementace)

### Desktop

- Prestart hint: `W A S D` pro challengera, `← → SPACE` pro defendera
- Žádná touch tlačítka — klávesnice stačí

### Mobil

- Prestart hint: pouze krátký text „ovládáš tlačítky níže"
- Za prestartem: skutečná touch tlačítka

### Touch tlačítka pro Stable Duel

| Akce | Label | Hráč |
|---|---|---|
| Zatočit doleva | `◀` nebo `A` | P1 |
| Zatočit doprava | `▶` nebo `D` | P1 |
| Boost / legendary | `Q` nebo `⚡` | P1 |

Doporučení: ponechat `A`, `D`, `Q` jako labely — jsou konzistentní s klávesnicí a existujícím kódem.

### ADQ — ponechat, přejmenovat, nebo odstranit?

Doporučení: **Ponechat `A`, `D`, `Q`** — labely odpovídají KeyA, KeyD, KeyQ kódům. Není důvod přejmenovávat. Případně přidat ikonky šipek vedle labelů pro intuitivnost.

### Local hot-seat Stable Duel

Tři možnosti (rozhodnutí pro člověka):

**Varianta A — Plná podpora local 1v1:**
- Přidat `localMode: "pvp" | "pvbot"` prop do ArenaPhase
- V pvp+local: P2 dostane touch panel na dolní části obrazovky, P1 na horní
- Fyzicky složité na jednom telefonu, ale technicky proveditelné

**Varianta B — Explicitní omezení:**
- Zobrazit přes defender sekci hintu banner: „V lokální hře ovládá P2 bot."
- Podmínit: `duelRole === undefined && mode === "pvbot"` → skrýt defender hint
- Nejmenší změna, transparentní vůči hráči

**Varianta C — PvBot jako výchozí, jasná komunikace:**
- Současný stav ponechat, ale opravit prestart hint (viz R2)
- Přidat text „Souboj s botem" do PreStartPhase pro lokální hru

### Jak zabránit zobrazování neklikacích „tlačítek"

- NeonKeyCap v prestart hintu jsou jasně klávesy, ne tlačítka — vizuálně OK pokud jsou doprovázeny textem
- Problém není vzhled, ale chybějící context: na mobilu klávesa `←` neznamená nic bez touch counterpartu
- Řešení: na mobilních viewportech skrýt defender NeonKeyCap hint (nebo celou defender sekci) v pvbot lokální hře

---

## 11. Doporučený nejmenší implementační krok

**Cíl:** eliminovat matoucí defender hint v lokální hře

```tsx
// StableDuelBoardLayer.tsx — PreStartPhase
// Přidat podmínku: nezobrazovat defender sekci pokud je to lokální pvbot game

{duelRole !== "challenger_authority" && duelRole !== undefined && (
  // Defender sekce
)}
// nebo
{duelRole === "defender_remote" && (
  // Defender sekce — zobraz jen pokud jsi skutečný online defender
)}
```

Tato změna:
1. Odstraní matoucí `← → SPACE` hint v lokální hře
2. Nezmění online chování (defender_remote stále vidí svůj hint)
3. Neopraví absenci P2 touch tlačítek (to je samostatný ticket)
4. Je minimální a bezpečná (1 podmínka)

---

## 12. Otevřené otázky pro rozhodnutí člověkem

1. **Local hot-seat Stable Duel** — chceme ho plně podporovat (Varianta A), nebo ho explicitně omezit / označit jako „PvBot only" (Varianta B/C)?

2. **Defender hint na mobilu** — má úplně zmizet pro lokální hru, nebo stačí přidat text „P2 = bot"?

3. **Double-tap boost na mobilu** — `Q` touch button funguje jako jednorázový boost. Je to dostatečné, nebo chceme i mobile double-tap gesto?

4. **SpeedArenaPvp** — je to produkční feature nebo jen dev/test? Pokud produkční, R5 je relevantní.

5. **Online 1v1 mobile UX** — challenger (na mobilu) vidí jen A D Q touch tlačítka. Defender (na mobilu) vidí outer touch panel s `← → SPACE`. Funguje to? Bylo testováno na dvou mobilech zároveň?

---

*Audit je read-only. Žádné soubory projektu nebyly změněny.*
