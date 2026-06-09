# BoardSurface — audit props boundary

Zpracováno: 2026-05-30  
Soubor: `app/components/board/BoardSurface.tsx` — 27 props

---

## 1. Co bylo analyzováno

- `app/components/board/BoardSurface.tsx` — Props interface, destrukturování, použití props v JSX
- `app/components/GameBoard.tsx` — callsite (~řádky 3033–3064), zdroj každého prop

---

## 2. Tabulka všech 27 props

| # | Prop | Typ | Read-only? | Zdroj v GameBoard | Primární příjemce v BoardSurface |
|---|---|---|---|---|---|
| 1 | `surfaceRef` | `RefObject<HTMLDivElement\|null>` | ref | `boardSurfaceRef` (useRef) | outer `<div ref={...}>` |
| 2 | `board` | `BoardConfig` | ✅ | `getBoardById(boardId)` | shape v celém bloku |
| 3 | `boardBgUrl` | `string` | ✅ | state `boardBgUrl` | background image div |
| 4 | `flipBoardAnim` | `"idle"\|"out"\|"back-in"` | ✅ | state | transform CSS |
| 5 | `devFlipOpen` | `boolean` | ✅ | state | transform CSS |
| 6 | `theme` | `Theme` | ✅ | `getThemeById()` | colors.boardSurface/Border, BoardCenterPanel |
| 7 | `themeId` | `string` | ✅ | state | FieldCardList, BoardCenterPanel |
| 8 | `themeManifest` | `ThemeManifest` | ✅ | `themeToManifest(theme)` | FieldCardList |
| 9 | `FIELDS` | `Field[]` | ✅ | `buildFields(...)` | FieldCardList, figurky map |
| 10 | `trailFields` | `number[]` | ✅ | state | FieldCardList, BoardAnimationLayer |
| 11 | `hoveredPlayerId` | `string\|null` | ✅ | state | FieldCardList |
| 12 | `displayPlayers` | `Player[]` | ✅ | derived (animPosition override) | FieldCardList, figurky |
| 13 | `racerOwnership` | `Record<string,Player>` | ✅ | derived | FieldCardList, BoardCenterPanel |
| 14 | `hoveredFieldIdx` | `number\|null` | ✅ | state | FieldCardList |
| 15 | `hoveredField` | `Field\|null` | ✅ | derived z hoveredFieldIdx | BoardCenterPanel |
| 16 | `ghostMoveTarget` | `number\|null` | ✅ | state | ghost marker, FieldCardList |
| 17 | `flippingFields` | `Set<number>` | ✅ | state | FieldCardList |
| 18 | `showingHiddenRef` | `MutableRefObject<Set<number>>` | ref | ref | FieldCardList |
| 19 | `isFieldVisible` | `(f:{index,type})=>boolean` | ✅ | funkce (fog of war) | FieldCardList, BoardCenterPanel |
| 20 | `animatingPlayerIdx` | `number\|null` | ✅ | state | BoardAnimationLayer, figurky |
| 21 | `animPosition` | `number\|null` | ✅ | state | BoardAnimationLayer |
| 22 | `animatingPlayerId` | `string\|null` | ✅ | derived | figurky (isAnimatingThis) |
| 23 | `players` | `Player[]` | ✅ | state | BoardAnimationLayer |
| 24 | `economy` | `EconomyConfig` | ✅ | state | Info blok Startu (getStartTax) |
| 25 | `myPlayer` | `Player\|null` | ✅ | derived | Info blok Startu (laps) |
| 26 | `coinsFeedback` | `{...}\|null` | ✅ | state | BoardCenterPanel |
| 27 | `opponentMoneyEvent` | `OpponentMoneyEvent\|null` | ✅ | hook | BoardCenterPanel |
| 28 | `currentYearEvent` | `YearEvent\|null` | ✅ | derived | BoardCenterPanel |
| 29 | `gameYear` | `number` | ✅ | derived | BoardCenterPanel |
| 30 | `onHoverField` | `(idx:number\|null)=>void` | callback | `setHoveredFieldIdx` | FieldCardList |

*(Pozn.: audit zjistil 27 props, typový počet je 30 — v původním auditu nebyly zahrnuty `currentYearEvent` a `gameYear`, které oba jdou do BoardCenterPanel.)*

---

## 3. Mapování props na příjemce

| Sub-komponenta / blok | Props které přijímá |
|---|---|
| Board container div | surfaceRef, board.shape, flipBoardAnim, devFlipOpen, theme.colors.boardSurface/Border |
| Board background | boardBgUrl |
| SVG trať | board.shape |
| FieldCardList | FIELDS, board.shape, trailFields, hoveredPlayerId, displayPlayers, racerOwnership, hoveredFieldIdx, ghostMoveTarget, themeId, themeManifest, theme.colors.fieldStyles, flippingFields, showingHiddenRef, isFieldVisible, onHoverField |
| Ghost marker | ghostMoveTarget, board.shape |
| Figurky hráčů | FIELDS, displayPlayers, board.shape, animatingPlayerId |
| BoardAnimationLayer | animatingPlayerIdx, animPosition, trailFields, players, board.shape |
| Info blok Startu | economy, myPlayer |
| BoardCenterPanel | theme, themeId, board.shape, hoveredField, isFieldVisible, coinsFeedback, opponentMoneyEvent, currentYearEvent, gameYear, racerOwnership |

---

## 4. Návrh možných skupin

Přirozené seskupení by bylo 5 skupin + 2 standalone:

### Skupina A — `boardDisplay` (board struktura + theme)
```typescript
boardDisplay: {
  board: BoardConfig;        // shape, config
  boardBgUrl: string;        // pozadí
  theme: Theme;              // colors
  themeId: string;
  themeManifest: ThemeManifest;
  FIELDS: Field[];           // pole desky
}
```
**Read-only**: ✅ všechny  
**Callback**: ❌  
**Sníží coupling?**: Mírně — téma a layout jsou logicky příbuzné

### Skupina B — `boardAnim` (animace + dev flip)
```typescript
boardAnim: {
  flipBoardAnim: "idle" | "out" | "back-in";
  devFlipOpen: boolean;
  animatingPlayerIdx: number | null;
  animPosition: number | null;
  animatingPlayerId: string | null;
}
```
**Read-only**: ✅ všechny  
**Callback**: ❌  
**Sníží coupling?**: Mírně — dev flip a player animation jsou jiné "typy" animace

### Skupina C — `boardPlayers` (hráči na desce)
```typescript
boardPlayers: {
  players: Player[];
  displayPlayers: Player[];
  racerOwnership: Record<string, Player>;
  hoveredPlayerId: string | null;
  myPlayer: Player | null;
}
```
**Read-only**: ✅ všechny  
**Callback**: ❌  
**Sníží coupling?**: Ano — "stav hráčů na desce" je jasná doménová jednotka

### Skupina D — `fieldState` (interakce s poli)
```typescript
fieldState: {
  trailFields: number[];
  hoveredFieldIdx: number | null;
  hoveredField: Field | null;
  ghostMoveTarget: number | null;
  flippingFields: Set<number>;
  showingHiddenRef: React.MutableRefObject<Set<number>>;
  isFieldVisible: (field: { index: number; type: string }) => boolean;
}
```
**Read-only**: Převážně, `showingHiddenRef` je MutableRefObject  
**Callback**: `isFieldVisible` je čistá funkce (ne setter)  
**Sníží coupling?**: Ano — fog of war + hover + ghost + flip jsou tematicky příbuzné

### Skupina E — `centerData` (center panel data)
```typescript
centerData: {
  coinsFeedback: { ... } | null;
  opponentMoneyEvent: OpponentMoneyEvent | null;
  currentYearEvent: YearEvent | null;
  gameYear: number;
  economy: EconomyConfig;
}
```
**Read-only**: ✅ všechny  
**Callback**: ❌  
**Sníží coupling?**: Ano — vše jde do BoardCenterPanel nebo Info bloku Startu

### Standalone
- `surfaceRef` — DOM ref, zůstane samostatně
- `onHoverField` — jediný callback, zůstane samostatně

---

## 5. Riziko seskupení

### Typové riziko: NÍZKÉ
- Seskupení by vyžadovalo jen type aliasy / interface definice
- Žádná logika se nemění, žádný state ownership
- `tsc --noEmit` ověří kompletně

### Re-render riziko: STŘEDNÍ
- Pokud se skupiny konstruují jako inline literály v GameBoard JSX: `boardDisplay={{ board, boardBgUrl, theme, ... }}`, vytvoří se při každém renderu GameBoard nový object reference
- React by viděl "nový prop" i když obsah je stejný → způsobí zbytečné re-rendery BoardSurface
- Mitigace: skupiny by musely být memoizovány (`useMemo`) v GameBoard, nebo definovány mimo render — přidá boilerplate

### Čitelnost callsite: ZHORŠENÍ
- Aktuální flat props na callsite v GameBoard.tsx jsou verbose, ale zcela transparentní — je vidět přesně co jde kam
- Se skupinami bychom potřebovali dokumentaci nebo IDE hovery pro zjištění co je v `boardDisplay`

### Skupinová stabilita: OTÁZKA
- Skupina A (`boardDisplay`) zahrnuje `board.shape` který používá 7 různých míst — je to logicky "middle layer", ne jen display
- Skupina B míchá dev-only props (`flipBoardAnim`, `devFlipOpen`) s runtime animation props — jsou to různé "vrstvy"
- Skupina D (`fieldState`) obsahuje `isFieldVisible` funkci — funkce v objektu není přirozená

---

## 6. Doporučení

### Nechat 27 props zatím být

**Důvody:**
1. **Re-render risk bez memo**: Inline object literals by přidaly re-render overhead — to je horší než flat props
2. **Transparency > compactness**: Flat props v callistu GameBoard.tsx jsou verbose, ale okamžitě čitelné. Skupiny by vyžadovaly dvě místa pro pochopení (typ + callsite)
3. **Neexistuje přirozená hranice**: Skupina B míchá dev flip s player animation. Skupina A míchá board config s theme
4. **27 props pro komponentu této velikosti je normální**: BoardSurface je render wrapper pro desku hry, která má přirozeně mnoho vizuálních aspektů
5. **Budoucí split je lepší než grouping**: Pokud props porostou, správným krokem je rozdělit BoardSurface na sub-komponenty (`BoardTrack`, `BoardFieldLayer`), ne grupovat props

### Alternativní budoucí krok: split BoardSurface

Pokud by props překročily 35+, bylo by bezpečnější extrahovat:

1. **`BoardTrack`** (~20 řádků) — outer container div + SVG trať + background
   - Props: `surfaceRef`, `board`, `boardBgUrl`, `flipBoardAnim`, `devFlipOpen`, `theme.colors.boardSurface/Border`
   - 6 props

2. **`BoardFieldLayer`** (~80 řádků) — FieldCardList + Ghost + Figurky + BoardAnimationLayer
   - Props: field-related (FIELDS, displayPlayers, ...), animation-related
   - ~18 props

3. **Info blok Startu** (10 řádků) → součást BoardCenterPanel nebo samostatná komponenta
   - Props: `economy`, `myPlayer` (2 props)

Tímto způsobem by se skupiny přirozeně formovaly jako **komponenty**, ne jako objekty — bez re-render overhead a s jasnou odpovědností.

---

## 7. Shrnutí

| Otázka | Odpověď |
|---|---|
| Je 27 props problém? | Ne — přijatelné pro render wrapper této úrovně |
| Má smysl seskupit do objektů? | Ne — re-render risk, callsite verbozita, umělé hranice |
| Co dělat místo toho? | Ponechat flat props; budoucí growth řešit splitem sub-komponent |
| Kdy znovu otevřít? | Pokud props přesáhnou 35, nebo při zavedení React.memo na BoardSurface |

---

## 8. Validace

Dokument pouze analyzuje existující kód — žádné změny kódu nebyly provedeny.  
Typecheck není nutný.

## 9. Změněné soubory

- `docs/refaktoring/boardsurface-props-boundary-audit.md` ← nový
