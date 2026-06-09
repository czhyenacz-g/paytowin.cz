# Audit: Bezpečné rozdělení BoardSurface — board render vrstvy

**Datum:** 2026-05-30  
**Soubor:** `app/components/board/BoardSurface.tsx` (244 řádků)  
**Typ:** Pouze plán, žádné změny kódu.

---

## 1. Název problému

BoardSurface.tsx je po extrakci z GameBoard.tsx čistá render komponenta bez state, bez DB přístupu a bez effect hooku. Přesto renderuje 7 různých vrstev v jednom těle. Cílem auditu je najít 2–4 bezpečné interní extrakce render vrstev, které:
- nemění chování,
- nemají state ani effect,
- mají do 8 props,
- jsou čistě read-only,
- snižují kognitivní zátěž BoardSurface.tsx.

---

## 2. Co bylo analyzováno

### Celý soubor BoardSurface.tsx — mapování render bloků

| Blok | Řádky | Popis |
|---|---|---|
| A | 87–124 | Outer container + flip div + bg image + SVG traťový pás |
| B | 126–143 | FieldCardList wrapper div |
| C | 145–163 | Ghost marker pro cíl hodu |
| D | 165–195 | Figurky hráčů — iterace přes FIELDS |
| E | 197–203 | BoardAnimationLayer |
| F | 205–227 | Info blok Startu (příspěvek + daň) |
| G | 229–240 | BoardCenterPanel |

**Existující extrakce (nelze měnit):**
- BoardAnimationLayer (blok E) — již extrahovaná
- FieldCardList (blok B) — již extrahovaná
- BoardCenterPanel (blok G) — zakázáno měnit

### Importy a závislosti

```typescript
import { isBankrupt, getStartTax } from "@/lib/engine";         // jen C4, D, F
import { FIGURINE_POSITIONS, FIGURINE_POSITIONS_STADIUM } from "@/lib/board/layout"; // jen C, D
import FieldCardList from "./FieldCardList";                      // jen B
import { BoardAnimationLayer } from "./BoardAnimationLayer";      // jen E
import BoardCenterPanel from "../center-panel/BoardCenterPanel";  // jen G
```

---

## 3. Kandidáti na extrakci

### Kandidát 1: `BoardTrackLayer` ⭐ NEJBEZPEČNĚJŠÍ

**Soubor:** `app/components/board/BoardTrackLayer.tsx`  
**Řádky v BoardSurface.tsx:** 88–124 (37 řádků)  
**Odhadovaný odchod:** ~35 řádků  

**Co přesně se přesouvá:**
- outer flip div s box-shadow, transition, transform
- background image div (`boardBgUrl`)
- SVG traťový pás (circle + stadium varianty)

**Props:**
```typescript
interface BoardTrackLayerProps {
  boardShape: "circle" | "stadium" | undefined;
  boardBgUrl: string;
  flipBoardAnim: "idle" | "out" | "back-in";
  devFlipOpen: boolean;
  boardSurface: string;         // theme.colors.boardSurface
  boardSurfaceBorder: string;   // theme.colors.boardSurfaceBorder
}
// 6 props — pod limitem 8
```

**Alternativa:** Předat celý `theme` místo dvou string props — ušetří 1 prop, ale zvýší coupling (komponenta by měla přístup k celému theme).  
**Doporučení:** Předat 2 string props, ne celý theme. Theme je velký objekt; komponenta potřebuje pouze 2 hodnoty.

**Read-only?** ✅ Ano — žádný callback, žádný setter  
**State?** ✅ Ne  
**Effect?** ✅ Ne  
**Callback?** ✅ Ne  

**Invariant:** Flip animace je čistá CSS transformace — žádná game state logika.

**Riziko:** **NÍZKÉ**

**Ruční validace:**
- Ověř, že board container má stále `overflow-hidden` a `rounded-[4px]`
- Ověř flip animaci: otevři DevFlip panel, deska se má animovat
- Ověř background image: vybav theme s boardBg, ověř opacity 0.5
- Ověř SVG trať: circle theme má ellipsu, stadium theme má path

---

### Kandidát 2: `BoardPlayerLayer`

**Soubor:** `app/components/board/BoardPlayerLayer.tsx`  
**Řádky v BoardSurface.tsx:** 165–195 (31 řádků)  
**Odhadovaný odchod:** ~28 řádků  

**Co přesně se přesouvá:**
- Iterace přes FIELDS.map pro zobrazení figurek hráčů
- Helper funkce `fieldPlayers()` (řádek 82–83) — interní pure funkce, přesune se do komponenty nebo zůstane jako helper
- FIGURINE_POSITIONS / FIGURINE_POSITIONS_STADIUM lookup
- Renderování DIV per hráč s `animate-figurine-bob` nebo `animate-bounce`

**Poznámka k `fieldPlayers()`:**
- Aktuálně je definovaná v těle BoardSurface.tsx (řádek 82)
- Používá ji výhradně blok D (figurky)
- Lze ji přesunout jako lokální funkci do BoardPlayerLayer — čistá logika bez side efektů

**Props:**
```typescript
interface BoardPlayerLayerProps {
  FIELDS: Field[];
  boardShape: "circle" | "stadium" | undefined;
  displayPlayers: Player[];
  animatingPlayerId: string | null;
}
// 4 props — výrazně pod limitem
```

**Read-only?** ✅ Ano — žádný callback, žádný setter  
**State?** ✅ Ne  
**Effect?** ✅ Ne  
**Callback?** ✅ Ne  
**Potřebuje isBankrupt?** ✅ Ano — import z `@/lib/engine`, přesune se do BoardPlayerLayer

**Riziko:** **NÍZKÉ**

**Ruční validace:**
- Ověř, že figurky se zobrazují na správných pozicích
- Ověř, že animující hráč má `scale-125 animate-bounce` místo `animate-figurine-bob`
- Ověř, že figurka animujícího hráče se nezobrazuje staticky (animatingPlayerId check)
- Ověř s více hráči na stejném poli (gap-0.5 layout)

---

### Kandidát 3: `BoardStartInfo`

**Soubor:** `app/components/board/BoardStartInfo.tsx`  
**Řádky v BoardSurface.tsx:** 205–227 (23 řádků)  
**Odhadovaný odchod:** ~22 řádků  

**Co přesně se přesouvá:**
- Info blok nalevo od desky (příspěvek + daň)
- Výpočet `startBonus = economy.stateSubsidy`
- Výpočet `myNextTax = getStartTax(myLaps, economy)` — pure funkce z engine
- Podmíněné zobrazení řádku s daní (myNextTax > 0)

**Props:**
```typescript
interface BoardStartInfoProps {
  economy: EconomyConfig;
  myPlayer: Player | null;
}
// 2 props — minimální
```

**Poznámka:** `getStartTax` a `stateSubsidy` jsou pure výpočty — jen čtení, žádný side effect. Komponenta si je spočítá sama z economy + myPlayer.

**Read-only?** ✅ Ano — žádný callback, žádný setter  
**State?** ✅ Ne  
**Effect?** ✅ Ne  
**Callback?** ✅ Ne  

**Riziko:** **NÍZKÉ** — izolovaný blok, 2 props, pure výpočet, fix position

**Ruční validace:**
- Ověř, že info blok se zobrazuje nalevo od desky
- Ověř hodnotu příspěvku (zelená): odpovídá `economy.stateSubsidy`
- Ověř daň (červená): zobrazena jen pokud myPlayer má laps ≥ 1
- Ověř na mobilu: blok nesmí přelézat přes desku

---

### Kandidát 4: `GhostMarker`

**Soubor:** `app/components/board/GhostMarker.tsx`  
**Řádky v BoardSurface.tsx:** 145–163 (19 řádků)  
**Odhadovaný odchod:** ~17 řádků  

**Co přesně se přesouvá:**
- Podmíněné zobrazení žlutého pulzujícího kruhu na pozici `ghostMoveTarget`
- FIGURINE_POSITIONS / FIGURINE_POSITIONS_STADIUM lookup

**Props:**
```typescript
interface GhostMarkerProps {
  ghostMoveTarget: number | null;
  boardShape: "circle" | "stadium" | undefined;
}
// 2 props — minimální
```

**Read-only?** ✅ Ano  
**State?** ✅ Ne  
**Effect?** ✅ Ne  
**Callback?** ✅ Ne  

**Riziko:** **NÍZKÉ** — nejmenší izolovaný blok, pouze podmíněný render a pozicování

**Ruční validace:**
- Ověř, že marker se zobrazí při korekci hodu (devTools nebo hra)
- Ověř, že marker je na správném poli (animPosition vs. ghostMoveTarget)
- Ověř animate-pulse a shadow efekt

---

## 4. Props/risk matrix

| Kandidát | Props count | Read-only | State | Effect | Callback | Riziko |
|---|---|---|---|---|---|---|
| BoardTrackLayer | 6 | ✅ | ✅ | ✅ | ✅ | 🟢 NÍZKÉ |
| BoardPlayerLayer | 4 | ✅ | ✅ | ✅ | ✅ | 🟢 NÍZKÉ |
| BoardStartInfo | 2 | ✅ | ✅ | ✅ | ✅ | 🟢 NÍZKÉ |
| GhostMarker | 2 | ✅ | ✅ | ✅ | ✅ | 🟢 NÍZKÉ |

Všichni kandidáti jsou nízké riziko. Rozdíl je pouze v počtu props a v míře izolace.

---

## 5. Doporučený první krok

**`BoardStartInfo`** je nejlepší první krok.

**Důvody:**
1. **2 props** — absolutně minimální interface, žádný risk špatného předání
2. **Zcela izolovaný blok** — netýká se FIELDS, Players, Animation, Theme — jen economy + myPlayer
3. **Jasné fyzické umístění** — `translate(-108%, -50%)` je statická pozice, nemůže interference s ostatním layoutem
4. **Snadno verifikovatelný** — zobrazení je vizuální a okamžitě patrné, stačí načíst hru
5. **Žádné importy z layout konstant** — BoardStartInfo nepotřebuje FIGURINE_POSITIONS ani board.shape
6. **Pure výpočty** — `getStartTax` a `stateSubsidy` jsou deterministické, žádný network/state
7. **Menší než GhostMarker** — jen 22 řádků, ale obsahuje smysluplný business výpočet (daň), ne pouze pozici

**Pořadí pro všechny extrakce (doporučené):**

| Pořadí | Kandidát | Proč |
|---|---|---|
| 1. | BoardStartInfo | 2 props, zcela izolovaný, pure výpočet |
| 2. | GhostMarker | 2 props, podmíněný render, jen layout |
| 3. | BoardPlayerLayer | 4 props, přesun fieldPlayers helperu, jasná sémantika |
| 4. | BoardTrackLayer | 6 props, přesun SVG + flip container — největší dopad na čitelnost BoardSurface |

---

## 6. Co zatím nerozdělovat

### FieldCardList — zakázáno (jiný task)
Již extrahovaná, neměnit.

### BoardCenterPanel — zakázáno
Velká komponenta s vlastní logikou (coinsFeedback, yearEvent), zakázáno dle zadání.

### BoardAnimationLayer — již hotovo
Již extrahovaná v předchozím kroku.

### Wrapper div (řádek 126) `absolute inset-0 overflow-visible`
Tento div drží všechny overlay komponenty pohromadě. **Neextrahovat** — je to layout wrapper, ne logická vrstva. Extrakce by přidala komponentu bez přidané hodnoty.

### Celý outer surfaceRef container (řádek 87)
Ref musí být předán BoardSurface z GameBoard. Outer container musí zůstat v BoardSurface — je to kořenový element s aspect-ratio logikou, která se vždy musí přizpůsobit board.shape.

### Figurka animujícího hráče v BoardAnimationLayer
Přesunuto sem záměrně z jiných důvodů — opakovaná extrakce by způsobila split responsbility pro AnimatingPlayer.

---

## 7. Validace po každé extrakci (checklista)

Pro každou extrakci:
- [ ] `npm run typecheck` — 0 chyb
- [ ] Hra se spustí a načte desku
- [ ] Vizuálně ověřen extrahovaný prvek (viz ruční validace u každého kandidáta)
- [ ] Deska funguje ve dvou tvarech (circle + stadium) — přepnutí přes board settings
- [ ] Flip animace funguje (DevFlip panel)
- [ ] BoardSurface.tsx má po extrakci méně importů (ověřit, že odstraněné importy zmizely)

---

## 8. Změněné soubory

Žádné soubory nebyly změněny. Pouze audit.

**Vytvořen:**
- `docs/refaktoring/board-surface-layer-split-audit.md` (tento soubor)

**Nedotčeno:**
- `app/components/board/BoardSurface.tsx`
- `app/components/GameBoard.tsx`
- `app/components/board/BoardAnimationLayer.tsx`
- `app/components/board/FieldCardList.tsx`
- `app/components/center-panel/BoardCenterPanel.tsx`

---

## Shrnutí

BoardSurface.tsx (244 řádků) obsahuje 4 bezpečné izolované render bloky vhodné k extrakci. Všechny jsou čistý render bez state, effect nebo callbacku. Celkový odchod ~102 řádků (~42 % souboru) přes 4 extrakce.

| Výsledek po všech extrakcích | Hodnota |
|---|---|
| Současný počet řádků BoardSurface.tsx | 244 |
| Odhadovaný počet po extrakcích | ~140 |
| Odchod | ~102 řádků |
| Přidané soubory | 4 nové komponenty |
| Změna chování | Žádná |
| Změna props BoardSurface | Žádná (dál přijímá stejné props, předává dál) |
