# GameBoard.tsx — bezpečný plán rozdělení

Zpracováno: 2026-05-30  
Soubor: `app/components/GameBoard.tsx` — **3 437 řádků**

---

## 1. Shrnutí

GameBoard.tsx je monolitický React orchestrátor celé hry. Drží ~40 useState/useRef,
~15 useEffect a ~15 useCallback. Většina logiky (finishTurn, applyCardEffect, Stable Duel
settlement, bot trigger, DB write sekvence) musí zůstat na místě — jsou tightly coupled
přes closure na sdílené refs a stav.

Existuje ale 4–5 konkrétních bloků, které lze bezpečně vytáhnout bez dotyku na gameplay:

1. `scheduleMorseAudio` — čistá TS funkce, žádný React
2. `BankruptAnnouncementModal` — 10 řádků inline JSX, žádné callbacky
3. `AmbientBackground` — již lokální subkomponenta, jen ji přesunout do souboru
4. `BoardAnimationLayer` — trail dots + plynulá figurina, čistý render bez side-effectů

---

## 2. Co bylo analyzováno

| Oblast | Rozsah | Poznámka |
|---|---|---|
| State + refs | ~řádky 211–313 | ~40 useState, ~20 useRef |
| Derived view model | ~řádky 2580–2668 | computed hodnoty před renderem |
| Render — overlay modaly | ~řádky 2839–2937 | CenterEventModal, FlashToast, RacerLostModal, BankruptAnn, RaceEventOverlay |
| Render — top HUD panel | ~řádky 2942–3103 | logo, kolo, player badge, legend strip, toggle |
| Render — board surface | ~řádky 3116–3312 | SVG trať, FieldCardList, trail dots, figurina, BoardCenterPanel |
| Render — pravý panel | ~řádky 3316–3370 | `<GamePanel>` — deleguje na existující komponentu |
| Dev overlays | ~řádky 3387–3423 | DevRaceModeShell, DevDuelShell, SpeedDevShell, LegendaryRaceDevShell |
| Footer | ~řádky 3424–3432 | statické linky + version badge |
| `scheduleMorseAudio` | ~řádky 124–158 | čistá TS audio util funkce |
| `AmbientBackground` | ~řádky 176–207 | lokální subkomponenta (useEffect + className swap) |

---

## 3. Navržené extrakce (4 kusy, seřazeny od nejbezpečnější)

---

### Extrakce 1 — `scheduleMorseAudio` → `lib/audio/morse.ts`

**Typ**: pure TypeScript utility function, žádný React

**Rozsah**: řádky 106–158 (docstring + funkce, ~53 řádků)

**Co přesně se přesune**:  
Celá funkce `scheduleMorseAudio(ctx: AudioContext, morse: string): void` + výše stojící
JSDoc komentář o Morse kodování. Je volána pouze na 1 místě v GameBoard:
```typescript
// řádek ~783
scheduleMorseAudio(audioCtxRef.current, textToMorse(text));
```

**Nový soubor**: `lib/audio/morse.ts`

**Odhad řádků zmizejících z GameBoard.tsx**: ~53

**Vstup / výstup**: žádné React props, jen `(ctx: AudioContext, morse: string) => void`

**Riziko**: **Nulové** — čistá deterministická funkce bez closure, bez state, bez importů z GameBoard. Pouze přidání importu na jednom řádku.

**Ruční validace**: Spustit telegram event v herním logiku (hráč projde STARTem s rokem) → ověřit, že Morse kód zahraje v prohlížeči.

---

### Extrakce 2 — `BankruptAnnouncementModal` → `app/components/modals/BankruptAnnouncementModal.tsx`

**Typ**: UI-only modal, žádné callbacky, žádná logika

**Rozsah**: řádky 2887–2897 (10 řádků JSX)

**Co přesně se přesune**:
```jsx
{bankruptAnn && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
    <div className="w-full max-w-sm rounded-[4px] bg-white p-8 shadow-2xl text-center space-y-4">
      <div className="text-6xl">💀</div>
      <h2 className="text-2xl font-bold text-slate-800">{bankruptAnn.playerName} zkrachoval!</h2>
      <p className="text-sm text-slate-500">Hra pokračuje bez tohoto hráče.</p>
      <div className="animate-pulse text-xs text-slate-400">Pokračujeme za chvíli…</div>
    </div>
  </div>
)}
```

**Nový soubor**: `app/components/modals/BankruptAnnouncementModal.tsx`

**Props**:
```typescript
interface Props { playerName: string; }
export default function BankruptAnnouncementModal({ playerName }: Props) { ... }
```

**V GameBoard** zůstane jen:
```jsx
{bankruptAnn && <BankruptAnnouncementModal playerName={bankruptAnn.playerName} />}
```

**Odhad řádků zmizejících z GameBoard.tsx**: 10 (JSX) → 1 (komponenta)

**Riziko**: **Nulové** — žádné callbacky, žádný state, žádná logika. `bankruptAnn` state zůstává v GameBoard. Komponenta jen displayuje.

**Ruční validace**: Dovést hráče na 0 coins → počkat na bankrot announcement overlay.

---

### Extrakce 3 — `AmbientBackground` → `app/components/ui/AmbientBackground.tsx`

**Typ**: izolovaná subkomponenta (již je jako lokální funkce v souboru)

**Rozsah**: řádky 174–207 (~33 řádků)

**Co přesně se přesune**:
```typescript
function AmbientBackground({ primary, alt }: { primary: string; alt: string }) {
  const [showAlt, setShowAlt] = React.useState(false);
  React.useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    function schedule() {
      const delay = 4000 + Math.random() * 8000;
      timer = setTimeout(() => { setShowAlt(s => !s); schedule(); }, delay);
    }
    schedule();
    return () => clearTimeout(timer);
  }, []);
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      ...
    </div>
  );
}
```

**Nový soubor**: `app/components/ui/AmbientBackground.tsx`

**Props**: `{ primary: string; alt: string }` — beze změny

**V GameBoard** zůstane volání beze změny. Přibude jen import.

**Odhad řádků zmizejících z GameBoard.tsx**: 33

**Riziko**: **Velmi nízké** — lokální state (`showAlt`) je čistě interní, žádný upward callback, žádná vazba na game logic. Komponent funguje autonomně.

**Ruční validace**: Otevřít hru s ambientním tématem (horse-night) → pozorovat pozvolný přechod pozadí mezi dvěma barvami.

---

### Extrakce 4 — `BoardAnimationLayer` → `app/components/board/BoardAnimationLayer.tsx`

**Typ**: pure render component — trail dots + plynulá animovaná figurina

**Rozsah**: řádky 3228–3273 (~46 řádků JSX)

**Co přesně se přesune**:
1. **Trail dots** (řádky 3228–3249) — animatedPlayerIdx, trailFields, players, board.shape → FIGURINE_POSITIONS / FIGURINE_POSITIONS_STADIUM
2. **Smooth floating figurine** (řádky 3252–3273) — animatingPlayerIdx, animPosition, players, board.shape → FIGURINE_POSITIONS / FIGURINE_POSITIONS_STADIUM

**Nový soubor**: `app/components/board/BoardAnimationLayer.tsx`

**Props**:
```typescript
interface Props {
  animatingPlayerIdx: number | null;
  animPosition: number | null;
  trailFields: number[];
  players: Player[];
  boardShape: "circle" | "stadium";
}
```

FIGURINE_POSITIONS a FIGURINE_POSITIONS_STADIUM jsou importované konstanty — nová komponenta je importuje přímo.

**Odhad řádků zmizejících z GameBoard.tsx**: ~46 (JSX) → 8 (komponenta s props)

**Riziko**: **Nízké** — žádné callbacky, žádné side-effecty, žádné DB volání. Stav `animatingPlayerIdx`, `animPosition`, `trailFields` zůstávají v GameBoard. Komponenta je čistý renderer.

**Jedna subtilita**: FIGURINE_POSITIONS_STADIUM je importován v GameBoard jako:
```typescript
import { FIGURINE_POSITIONS, FIGURINE_POSITIONS_STADIUM } from "@/lib/board/constants";
```
Nová komponenta bude tyto importovat přímo — žádný prop needed.

**Ruční validace**: Hodit kostkou → pozorovat trail dots a plynulý pohyb figuriny.

---

## 4. Co zatím nerozdělovat

Následující části mají vysoké riziko při extrakci nebo jsou záměrně ponechány v GameBoard:

| Oblast | Proč nerozdělovat |
|---|---|
| `finishTurn` (~řádky 1656–1795) | Closure přes gameId, players, gameState, economy, mnoho refs. Jakákoli extrakce by vyžadovala předávat desítky parametrů nebo context. |
| `applyCardEffectRef` / applyCardEffect (~řádky 1427–1657) | Inline async closure, volá finishTurn, clearOfferPending, DB write. Nerozdělovat. |
| `handleStableDuelFinish` (~řádky 2139–2282) | Challenger-only guard, DB write, clearOfferPending, stableDuelProceedRef. Citlivé. |
| `rollDice` (~řádky 843–1252) | Celý turn flow jako jeden async. Inline přístup k všem state a refs. |
| HUD top panel (řádky 2942–3103) | Přistupuje k `theme`, `isHost`, `stableDuelMode`, `scorePopupOpen`, `topPanelVisible` — příliš mnoho state pro jednoduché oddělení. |
| `GamePanel` (pravý panel, ~řádky 3316–3370) | Již deleguje na `<GamePanel>`. Stávající rozdělení je dostatečné. |
| `useBgMusic`, `playSfx`, `playStepSound` | Sound system používá `audioCtxRef`, `soundEnabledRef` — tyto refs jsou shared s rest of GameBoard. Extrakce na hook by vyžadovala redesign ref ownership. |
| Realtime subscriptions (~řádky 550–840) | `refreshGame()` closure drží všechny state settery. Vysoké riziko. |
| Bot trigger / `handleBotTurn` | Volá rollDice, finishTurn. Tightly coupled. |
| Supabase loading sekvence (~řádky 590–840) | Initialization flow se stávajícím error handling. Nerozdělovat. |
| Race flow efekty (~řádky 2674–2760) | Countdown → racing → results chain s DB writes a časovači. |

---

## 5. Nejbezpečnější první implementační krok

**Extrakce 1: `scheduleMorseAudio` → `lib/audio/morse.ts`**

Doporučuji jako první krok z těchto důvodů:
- Jde o čistou TypeScript funkci (ne React komponentu) — extrémně nízké riziko
- Nulový dopad na render strom, state, closure, DB
- Okamžitě verifikovatelné přes `npx tsc --noEmit`
- Pokud se něco pokazí, jednoduchý rollback (vrátit funkci zpět)
- Připraví `lib/audio/` jako modul pro případné budoucí audio utility

**Implementace**:
1. Vytvořit `lib/audio/morse.ts` s `export function scheduleMorseAudio(ctx: AudioContext, morse: string): void { ... }`
2. Přidat import v GameBoard.tsx: `import { scheduleMorseAudio } from "@/lib/audio/morse";`
3. Smazat lokální definici (~řádky 106–158)
4. Spustit `npm run typecheck`

Celkem: ~3 minuty práce, nulové riziko.

**Doporučené pořadí dalších kroků**:
```
Extrakce 1: scheduleMorseAudio (čistá funkce)
  ↓
Extrakce 3: AmbientBackground (lokální komponenta → soubor)
  ↓
Extrakce 2: BankruptAnnouncementModal (10 řádků JSX)
  ↓
Extrakce 4: BoardAnimationLayer (trail + figurina)
```

Po těchto 4 krocích zmizí z GameBoard.tsx přibližně **142 řádků** (53 + 10 + 33 + 46)
bez jakékoli změny chování.

---

## 6. Rizika

| Riziko | Pravděpodobnost | Dopad | Mitigace |
|---|---|---|---|
| Closure breakage při extrakci | Nízká pro vybrané kandidáty | Vysoký | Typicky se stane jen pokud komponenta čte state mimo props — vybrané komponenty to nedělají |
| Import cycles | Nízká | Střední | Nové soubory importují pouze z `lib/*` a `@/lib/*`, ne z `app/components/GameBoard.tsx` |
| Nekompatibilita FIGURINE_POSITIONS (Extrakce 4) | Velmi nízká | Nízký | Konstanty jsou v `lib/board/constants.ts` — přímý import v nové komponentě |
| Zapomenutá ESLint/tsc chyba | Nízká | Nízký | `npm run typecheck` po každé extrakci |

---

## 7. Shrnutí extrakcí

| # | Extrakce | Cílový soubor | Řádků z GB | Riziko |
|---|---|---|---|---|
| 1 | `scheduleMorseAudio` | `lib/audio/morse.ts` | ~53 | Nulové |
| 2 | `BankruptAnnouncementModal` | `app/components/modals/BankruptAnnouncementModal.tsx` | ~10 | Nulové |
| 3 | `AmbientBackground` | `app/components/ui/AmbientBackground.tsx` | ~33 | Velmi nízké |
| 4 | `BoardAnimationLayer` | `app/components/board/BoardAnimationLayer.tsx` | ~46 | Nízké |
| **Celkem** | | | **~142 řádků** | |

GameBoard.tsx by po implementaci všech 4 extrakcí klesl z **3 437** na přibližně **3 295 řádků**.
Jde o skromný, ale bezpečný první krok směrem k udržitelnějšímu orchestrátoru.
