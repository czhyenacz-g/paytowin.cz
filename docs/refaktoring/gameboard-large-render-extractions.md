# GameBoard.tsx — audit větších render-only extrakcí

Zpracováno: 2026-05-30  
Aktuální stav: **3 313 řádků** po čtyřech předchozích mikro-extrakcích.

---

## 1. Co bylo analyzováno

| Sekce | Orientační řádky | Popis |
|---|---|---|
| Early returns (loading, cancelled, login) | 2673–2762 | Stavové obrazovky před hlavním renderem |
| Horní HUD panel | 2858–3019 | Logo, score popup, aktuální hráč, host akce, DevToolbar, legenda |
| Board surface (herní deska) | 3032–3188 | SVG trať, pole, figurky, ghost, BoardCenterPanel |
| Game footer | 3237–3247 | Statické linky + version badge |

---

## 2. Kandidáti na větší extrakce

---

### Kandidát A — `BoardSurface` ⭐ (doporučeno)

**Nový soubor**: `app/components/board/BoardSurface.tsx`

**Rozsah**: řádky 3032–3188, ~156 řádků

**Co se přesune**:
- Outer div s `ref`, `flipBoardAnim` transform a `boardSurfaceBorder`
- Board background image layer
- SVG traťový pás (circle + stadium verze)
- `<FieldCardList>` — pole na desce
- Ghost marker pro výchozí cíl hodu
- Statické figurky hráčů (`FIELDS.map(...)`)
- `<BoardAnimationLayer>` (trail dots + pohybující figurka)
- Info blok Startu (příspěvek + výpalné)
- `<BoardCenterPanel>`

**Props — kompletní seznam**:

| Prop | Typ | Read-only? | Poznámka |
|---|---|---|---|
| `surfaceRef` | `React.RefObject<HTMLDivElement>` | ✅ | `boardSurfaceRef` z GameBoard |
| `board` | `BoardConfig` | ✅ | shape, boardBgUrl z board config |
| `boardBgUrl` | `string` | ✅ | URL pozadí desky |
| `flipBoardAnim` | `"idle" \| "out" \| "back-in"` | ✅ | stav dev flip animace |
| `devFlipOpen` | `boolean` | ✅ | dev flag |
| `theme` | `Theme` | ✅ | colors.boardSurface atd. |
| `themeId` | `string` | ✅ | |
| `themeManifest` | `ThemeManifest` | ✅ | pro FieldCardList |
| `FIELDS` | `Field[]` | ✅ | definice polí |
| `trailFields` | `number[]` | ✅ | stopa pohybu |
| `hoveredPlayerId` | `string \| null` | ✅ | |
| `displayPlayers` | `Player[]` | ✅ | derived v GameBoard |
| `racerOwnership` | `Record<string, Player>` | ✅ | derived v GameBoard |
| `hoveredFieldIdx` | `number \| null` | ✅ | |
| `ghostMoveTarget` | `number \| null` | ✅ | |
| `flippingFields` | `Set<number>` | ✅ | flip animace polí |
| `showingHiddenRef` | `React.MutableRefObject<Set<number>>` | ✅ | hidden card tracking |
| `isFieldVisible` | `(idx: number) => boolean` | ✅ | čistá funkce fog of war |
| `animatingPlayerIdx` | `number \| null` | ✅ | |
| `animPosition` | `number \| null` | ✅ | |
| `animatingPlayerId` | `string \| null` | ✅ | derived v GameBoard |
| `economy` | `EconomyConfig` | ✅ | pro Info blok Startu |
| `myPlayer` | `Player \| null` | ✅ | pro laps/daň v Info bloku |
| `coinsFeedback` | `CoinsFeedback \| null` | ✅ | pro BoardCenterPanel |
| `opponentMoneyEvent` | `OpponentMoneyEvent \| null` | ✅ | pro BoardCenterPanel |
| `currentYearEvent` | `YearEvent \| null` | ✅ | pro BoardCenterPanel |
| `gameYear` | `number` | ✅ | pro BoardCenterPanel |
| `onHoverField` | `(idx: number \| null) => void` | callback | `setHoveredFieldIdx` — jedný setter |

**Celkem: 27 props (26 read-only + 1 callback/setter)**

**Dotýká se DB/pending/finishTurn?** ❌ Vůbec ne.

**Odhad řádků zmizejících z GameBoard**: ~150 (→ zůstane `<BoardSurface ... />` cca 10 řádků)

**Riziko**: **STŘEDNÍ**
- Žádné DB write, žádné pending flow, žádný finishTurn
- Hodně props (27), ale jsou všechny jasně typované
- 1 setter prop (`onHoverField`)
- `surfaceRef` předán jako regular prop (`React.RefObject<HTMLDivElement>`) — bez nutnosti `forwardRef`
- `fieldPlayers` funkce se derivuje přímo uvnitř komponenty z `displayPlayers` + `animatingPlayerId` (nezajistit jako prop)
- FIGURINE_POSITIONS a FIGURINE_POSITIONS_STADIUM se importují přímo v BoardSurface

**Ruční validace**:
- Figurky se zobrazují na správných políčkách
- Hover na poli funguje (tooltip/zvýraznění)
- Ghost marker po hodu viditelný
- Info blok Startu zobrazuje správný příspěvek a daň
- Trail dots a pohybující figurka fungují (deleguje na BoardAnimationLayer)
- Fog of war skrývá pole správně
- Dev flip animace desky funguje (horse-night, stadium)

---

### Kandidát B — `GameBoardTopPanel`

**Nový soubor**: `app/components/board/GameBoardTopPanel.tsx`

**Rozsah**: řádky 2858–3019, ~161 řádků

**Co se přesune**:
- Toggle button „Zobrazit panel" (když topPanelVisible=false)
- HUD řádek: BrandLogo, mode badges, score popup modal, current player badge
- Hostitelské akce (startRace, cancelGame)
- Skrýt panel button
- DevToolbar (dev only)
- Legend strip

**Props — vybrané klíčové**:

| Prop | Read-only? | Poznámka |
|---|---|---|
| `topPanelVisible` | ✅ | |
| `scorePopupOpen` | ✅ | |
| `currentPlayer`, `currentRound`, `economy` | ✅ | |
| `isHost`, `isLocalGame`, `isSpectator`, `gameStatus` | ✅ | |
| `pendingRace`, `pendingCard`, `pendingRacer`, `pendingOffer` | ✅ | jen pro "disabled" check |
| `players` | ✅ | pro DevToolbar + filter bankrupt |
| `theme`, `stableDuelMode` | ✅ | |
| `setTopPanelVisible` | ❌ setter | toggle viditelnosti panelu |
| `setScorePopupOpen` | ❌ setter | score popup |
| `setStableDuelCtx` | ❌ setter | pro DevToolbar onOpenStableDuel |
| `setStableDuelMode` | ❌ setter | pro DevToolbar toggle |
| `startRace` | ❌ callback s DB | host akce — spouští DB write |
| `cancelGame` | ❌ callback s DB | host akce — spouští DB write |
| `setDevRaceMode`, `setDevRaceBoardLayer`, `openDevFlip`, `setDevDuelOpen`, `setDevSpeedOpen`, `setDevLegendaryOpen` | ❌ settery | dev only |
| `boardSurfaceRef` | ref | pro scrollIntoView v DevToolbar |

**Celkem: ~28 props (15 read-only + 13 setterů/callbacků)**

**Dotýká se DB?** Nepřímo — `startRace` a `cancelGame` jsou DB-writing funkce předané jako callback. Komponenta sama DB nevolá, ale vizuálně „drží" tlačítka co DB volají.

**Riziko**: **STŘEDNÍ-VYSOKÉ**
- 13 setter/callback props
- `cancelGame` a `startRace` jsou DB-touching
- `boardSurfaceRef` musí být předán přes prop
- DevToolbar s inline `setStableDuelCtx` konstruktorem z `players`
- Funkčně komplex, ale vizuálně jasná sekce

**Doporučení**: Implementovat AŽ PO kandidátu A. Pokud A proběhne bezpečně, B bude jednodušší.

---

### Kandidát C — `GameBoardStatusBars`

**Nový soubor**: `app/components/board/GameBoardStatusBars.tsx`  
(nebo integrovat do existujícího)

**Rozsah**: řádky 2837–2853, ~17 řádků

**Co se přesune**:
- gameCode info strip (amber, hra: XXXX)
- spectator info bar + join link

**Props**: `gameCode: string | undefined`, `isSpectator: boolean`  
**Callbacky**: žádné  
**Riziko**: **NULOVÉ**

**Poznámka**: Pouze 17 řádků — příliš malé pro "větší extrakci" (pod 100 řádků). Zahrnuto pro úplnost, lze případně sloučit s jiným krokem, nikoliv implementovat samostatně.

---

## 3. Props/risk matrix

| Kandidát | Řádky | Props celkem | Read-only | Settery/CB | DB | Riziko |
|---|---|---|---|---|---|---|
| **BoardSurface** | ~156 | 27 | 26 | 1 | ❌ | **Střední** |
| **GameBoardTopPanel** | ~161 | ~28 | ~15 | ~13 | Nepřímo | Střední-Vysoké |
| **GameBoardStatusBars** | ~17 | 2 | 2 | 0 | ❌ | Nulové (malé) |

---

## 4. Doporučený první kandidát

### ⭐ `BoardSurface` jako první velká extrakce

**Proč jako první**:
- Architektonicky nejčistší boundary — celá herní plocha je jeden vizuální celek
- Jen 1 setter prop (`onHoverField`)
- Nulový dopad na DB, pending flow, finishTurn, race/duel settlement
- `fieldPlayers` logika je derivovaná inline z props — nevyžaduje extra prop
- `surfaceRef` se předá jako `React.RefObject<HTMLDivElement>` — jednoduchý pattern
- Po extrakci bude GameBoard ~150 řádků menší

**Pořadí implementace**:
```
BoardSurface  (156 ř., střední riziko, nejčistší)
  ↓
GameBoardStatusBars  (17 ř., nulové riziko, bonus)
  ↓
GameBoardTopPanel  (161 ř., střední-vysoké riziko, po ověření BoardSurface)
```

---

## 5. Co zatím neextrahovat

| Sekce | Proč |
|---|---|
| Early return screens (loading, cancelled, login) | Jsou `return` statementy, ne JSX bloky — nelze vyextrahovat jako komponentu bez změny control flow GameBoard |
| `<GamePanel>` (pravý panel) | Již deleguje na existující komponentu (GamePanel.tsx), state ownership je v GameBoard |
| Dev overlays (DevDuelShell, SpeedDevShell, LegendaryRaceDevShell, DevRaceModeShell) | Dev-only, malé, výhody extrakce minimální |
| Celý main render `return (...)` jako jedna komponenta | Příliš velké — rozbilo by closure nad state a refs |

---

## 6. Implementační prompt pro BoardSurface

```
Název problému: Extrakce BoardSurface z GameBoard.tsx

Úkol:
1. Přesuň blok řádky ~3032–3188 z GameBoard.tsx do:
   app/components/board/BoardSurface.tsx

2. Named export: BoardSurface

3. Props interface (viz audit gameboard-large-render-extractions.md):
   - surfaceRef: React.RefObject<HTMLDivElement>
   - board: BoardConfig
   - boardBgUrl: string
   - flipBoardAnim: "idle" | "out" | "back-in"
   - devFlipOpen: boolean
   - theme: Theme
   - themeId: string
   - themeManifest: ThemeManifest
   - FIELDS: Field[]
   - trailFields: number[]
   - hoveredPlayerId: string | null
   - displayPlayers: Player[]
   - racerOwnership: Record<string, Player>
   - hoveredFieldIdx: number | null
   - ghostMoveTarget: number | null
   - flippingFields: Set<number>
   - showingHiddenRef: React.MutableRefObject<Set<number>>
   - isFieldVisible: (idx: number) => boolean
   - animatingPlayerIdx: number | null
   - animPosition: number | null
   - animatingPlayerId: string | null
   - economy: EconomyConfig
   - myPlayer: Player | null
   - coinsFeedback: CoinsFeedback | null
   - opponentMoneyEvent: OpponentMoneyEvent | null
   - currentYearEvent: YearEvent | null (nebo konkrétní typ)
   - gameYear: number
   - onHoverField: (idx: number | null) => void

4. fieldPlayers derivuj přímo uvnitř BoardSurface:
   const fieldPlayers = (fieldIndex: number) =>
     displayPlayers.filter(p => p.position === fieldIndex && !isBankrupt(p) && p.id !== animatingPlayerId);

5. FIGURINE_POSITIONS a FIGURINE_POSITIONS_STADIUM importuj z @/lib/board/layout.
   getStartTax importuj z @/lib/engine.

6. V GameBoard nahraď blok jedním <BoardSurface ... /> a předej boardSurfaceRef jako surfaceRef.

7. Zachovej identicky: JSX, CSS, podmínky, animace, styly.

Guardrails: neměnit finishTurn, applyCardEffect, clearOfferPending, rollDice, DB flow.
Validace: npm run typecheck.
Commit: refactor: extract board surface
```
