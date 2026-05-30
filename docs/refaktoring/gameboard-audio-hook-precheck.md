# useGameBoardAudio — pre-check extrakce

Zpracováno: 2026-05-30

---

## 1. Co bylo analyzováno

`app/components/GameBoard.tsx` — audio/UX feedback oblast (cca 180 řádků):
- State a ref deklarace (řádky ~178–242, ~308–314)
- Sound load useEffect (řádky 350–355)
- toggleSound, playStepSound, playSfx (řádky 370–466)
- Race sound useEffect (řádky 470–475)
- Opponent/bot step sounds useEffect (řádky 478–495)
- Year event telegram useEffect (řádky 500–507)
- Game over telegram useEffect (řádky 511–517)
- Late-join telegram useEffect (řádky 521–527)
- Join telegram useEffect (řádky 531–548)
- showCoinsFeedback, showTelegram, showFlash callbacks (řádky 693–731)
- Cross-boundary coupling: deferredOfferRef na řádcích 1146–1147, 2453–2459

---

## 2. Audio/feedback state, refs, effects a helpery

### State proměnné

| Proměnná | Typ | Kde se renderuje |
|---|---|---|
| `soundEnabled` | `boolean` | GamePanel (sound toggle button) |
| `flashEvent` | `FlashEvent\|null` | FlashToast (overlay) |
| `telegramMessage` | `TelegramMessage\|null` | TelegramStrip (overlay) |
| `coinsFeedback` | `{amount,kind,...}\|null` | BoardCenterPanel, BoardSurface |

### Refs (audio/feedback-only)

| Ref | Účel | Kde jinde se čte/píše |
|---|---|---|
| `audioCtxRef` | AudioContext singleton | Pouze v audio funkcích |
| `soundEnabledRef` | Live sync soundEnabled (pro callbacks) | Pouze v audio funkcích |
| `flashTimerRef` | Auto-dismiss timer flashEvent | Pouze v showFlash |
| `telegramTimerRef` | Auto-dismiss timer telegramMessage | Pouze v showTelegram |
| `coinsFeedbackTimerRef` | Auto-dismiss timer coinsFeedback | Pouze v showCoinsFeedback |
| `prevPlayersRef` | Tracker pozic pro opponent step sounds | Pouze v step sound efektu |
| `pendingRaceRef` | Guard pro race start sound | Pouze v race sound efektu |
| `knownPlayerIdsRef` | Tracker hráčů pro join telegram | Pouze v join telegram efektu |

### Refs s cross-boundary coupling (klíčový problém)

| Ref | Typ coupling |
|---|---|
| `flashActiveRef` | READ v `rollDice` (ř.1146) a offer restoration (ř.2453) — guard pro deferred offer |
| `deferredOfferRef` | WRITE v `rollDice` (ř.1147), offer restoration (ř.2454); READ+CLEAR v `showFlash` timer (ř.726–728) |
| `seenYearEventTurnRef` | WRITE v `loadGame` (ř.641), `rollDice` (ř.895), `applyCardEffect` (ř.1406); READ v year event efektu |
| `seenGameOverRef` | WRITE v `loadGame` (ř.568); READ+WRITE v game over efektu |
| `lateJoinRef` | WRITE v `loadGame` (ř.592); READ v late-join efektu |

### useEffects v audio/feedback oblasti

| # | Efekt | Deps | Kam patří |
|---|---|---|---|
| 1 | Načti soundEnabled z localStorage | `[]` | Hook — izolovaný |
| 2 | Race sound při startu závodu | `gameState?.offer_pending?.type` | Hook (jen volá playSfx) |
| 3 | Opponent/bot step sounds | `players, gameMode, myPlayerId` | Hook (prevPlayersRef uvnitř) |
| 4 | Year event telegram | `gameState?.year_event_telegram?.turn` | Problematický — seenYearEventTurnRef writován z rollDice |
| 5 | Game over telegram | `gameStatus` | Hook — seenGameOverRef jako param |
| 6 | Late-join telegram | `viewerRole` | Hook — lateJoinRef jako param |
| 7 | Join telegram | `players` | Hook — knownPlayerIdsRef uvnitř |

### Helper funkce

| Funkce | Typ | Závislosti |
|---|---|---|
| `toggleSound()` | () => void | setSoundEnabled, soundEnabledRef, localStorage |
| `playStepSound()` | () => void | audioCtxRef, soundEnabledRef (WebAudio synthesis) |
| `playSfx(id)` | (SoundId) => void | audioCtxRef, soundEnabledRef, sfxPlay |
| `showCoinsFeedback(...)` | (...) => void | coinsFeedbackTimerRef, setCoinsFeedback, playSfx |
| `showTelegram(text)` | (string) => void | telegramTimerRef, setTelegramMessage, audioCtxRef, scheduleMorseAudio |
| `showFlash(event)` | (FlashEvent) => void | flashTimerRef, flashActiveRef, setFlashEvent, deferredOfferRef, **setPendingOffer** |

### Importy, které by se přesunuly

```typescript
import { useBgMusic } from "@/lib/audio/music";
import { sfxPlay, type SoundId } from "@/lib/audio/sfx";
import { scheduleMorseAudio } from "@/lib/audio/morse";
import { textToMorse, extractCapsSegment } from "@/lib/morse";
import { COINS_FEEDBACK_DURATION_MS } from "@/lib/game-constants";
import type { FlashEvent } from "@/lib/types/events";
import type { RerollOffer } from "@/lib/types/game";
import TelegramStrip from "./TelegramStrip";  // ← zůstane v GameBoard (renderuje se tam)
```

---

## 3. Návrh API hooku

**Navrhovaný hook**: `app/components/board/hooks/useGameBoardAudio.ts`

### Vstupní parametry (11 vstupů)

```typescript
interface UseGameBoardAudioParams {
  // Pro useBgMusic
  themeMusic: string | undefined;
  // Pro opponent step sounds
  players: Player[];
  gameMode: "online" | "local";
  myPlayerId: string | null;
  // Pro race sound
  offerPendingType: string | undefined;
  // Pro telegram efekty
  gameStatus: string;
  viewerRole: string;
  yearEventTelegram: { text: string; turn: number } | null | undefined;
  // Cross-boundary: deferred offer dispatch (volá ho showFlash timer)
  setPendingOffer: (offer: RerollOffer | null) => void;
  // Seeding refs z loadGame / turn flow — zůstávají vlastněné v GameBoard,
  // hook je jen čte/upravuje:
  seenYearEventTurnRef: React.MutableRefObject<number>;
  seenGameOverRef: React.MutableRefObject<boolean>;
  lateJoinRef: React.MutableRefObject<boolean>;
}
```

### Návratové hodnoty (12 výstupů)

```typescript
interface UseGameBoardAudioReturn {
  // State pro render
  soundEnabled: boolean;
  flashEvent: FlashEvent | null;
  coinsFeedback: CoinsFeedbackData | null;
  telegramMessage: TelegramMessage | null;
  // Helper funkce
  toggleSound: () => void;
  playSfx: (id: SoundId) => void;
  playStepSound: () => void;
  showCoinsFeedback: (amount: number, kind: "gain" | "lose", playerName: string, fieldLabel: string) => void;
  showTelegram: (text: string) => void;
  showFlash: (event: FlashEvent) => void;
  // Refs exponované GameBoard (pro rollDice, offer restoration)
  flashActiveRef: React.MutableRefObject<boolean>;
  deferredOfferRef: React.MutableRefObject<RerollOffer | null>;
}
```

### Co by zůstalo v GameBoard.tsx

- Deklarace a seedování `seenYearEventTurnRef` (writována z rollDice, applyCardEffect)
- Deklarace a seedování `seenGameOverRef` a `lateJoinRef` (zapisuje je loadGame)
- Volání hooku: `const { flashEvent, ..., flashActiveRef, deferredOfferRef } = useGameBoardAudio({...})`
- Použití `flashActiveRef.current` v rollDice (ř.1146) a offer restoration (ř.2453)
- Použití `deferredOfferRef.current` v rollDice (ř.1147) a offer restoration (ř.2454)

---

## 4. Rizika

### Izolovaná audio logika — NÍZKÉ RIZIKO
- `playStepSound`, `playSfx`, `toggleSound`, `showCoinsFeedback` — čisté funkce nad audioCtxRef
- Sound load localStorage, race sound, opponent step sounds — efekty bez DB

### deferredOffer / flashActive coupling — STŘEDNÍ RIZIKO
- `showFlash` timer volá `setPendingOffer` — hook potřebuje tento setter jako parametr
- `flashActiveRef` a `deferredOfferRef` musí být exponovány zpět do GameBoard
- Vyžaduje změnu volací místa v rollDice: `flashActiveRef.current` místo lokálního
- **Toto se nezmění z pohledu gameplaye** — timing a logika zůstane identická

### seenYearEventTurnRef cross-writing — STŘEDNÍ-VYSOKÉ RIZIKO
- Ref je writován z `rollDice` (ř.895) a `applyCardEffect` (ř.1406)
- Pokud by byl uvnitř hooku, rollDice by musel volat `markYearEventSeen(turnCount)` (hook return)
- To by znamenalo změnu rozhraní rollDice — guardrails to zakazují
- **Řešení**: Ref zůstane v GameBoard, hook ho dostane jako parametr (čte ho, ale nepíše)
- Nebo: hook efekt pro year event se nechá v GameBoard a volá jen `showTelegram()`

### seenGameOverRef, lateJoinRef — NÍZKÉ RIZIKO
- Seedovány v loadGame, ale dál se nemodifikují mimo hook
- Předání jako parametry hooku je bezpečné

### Browser autoplay
- AudioContext je lazy-init při první interakci — zachováno, žádné změny

### Cleanup efektů
- Všechny timery mají cleanup v closures nebo return () => clearTimeout — zachováno

---

## 5. Doporučení

### Implementovat, s jednou zjednodušující úpravou

**Riziko celkově: STŘEDNÍ** — hook je feasibilní, ale vyžaduje pozornou API.

**Doporučená odlehčená varianta**: Místo přesunu VŠECH telegram efektů do hooku, přesunout jen audio/feedback state a funkce. Čtyři telegram `useEffect` zůstanou v GameBoard — jen volají `showTelegram` z hooku. Tím se vyhne:
- Předávání `seenYearEventTurnRef` jako parametru (zatím zůstane v GameBoard)
- Kolizi s rollDice/applyCardEffect closure

**Co by hook obsahoval** (odlehčená varianta):
- Veškerý audio state + refs (audioCtxRef, soundEnabledRef, timers, prevPlayersRef, pendingRaceRef, knownPlayerIdsRef)
- Všechny 4 helper funkce (playStepSound, playSfx, showCoinsFeedback, showTelegram, showFlash)
- Sound load effect, race sound effect, opponent step sounds effect, join telegram effect
- useBgMusic call

**Co zůstane v GameBoard**:
- Year event, game over, late-join telegram useEffect (jen volají showTelegram)
- seenYearEventTurnRef, seenGameOverRef, lateJoinRef deklarace + seedování
- flashActiveRef, deferredOfferRef — exponovány z hooku

**Zmenšení GameBoard**: ~120–140 řádků

---

## 6. Implementační prompt pro samostatný commit

```
Název problému: Extrakce useGameBoardAudio hooku z GameBoard.tsx

Úkol:
1. Vytvoř app/components/board/hooks/useGameBoardAudio.ts
2. Přesun do hooku:
   - state: soundEnabled, flashEvent, telegramMessage, coinsFeedback
   - refs: audioCtxRef, soundEnabledRef, flashTimerRef, telegramTimerRef,
     coinsFeedbackTimerRef, prevPlayersRef, pendingRaceRef, knownPlayerIdsRef
   - funkce: toggleSound, playStepSound, playSfx,
     showCoinsFeedback, showTelegram, showFlash
   - efekty: sound load localStorage, race sound, opponent step sounds, join telegram
   - useBgMusic call
3. Hook INPUT params:
   - themeMusic: string | undefined
   - players: Player[]
   - gameMode: "online" | "local"
   - myPlayerId: string | null
   - offerPendingType: string | undefined
   - gameStatus: string
   - viewerRole: string
   - setPendingOffer: (offer: RerollOffer | null) => void
   - seenGameOverRef: React.MutableRefObject<boolean>
   - lateJoinRef: React.MutableRefObject<boolean>
4. Hook RETURNS:
   - soundEnabled, flashEvent, coinsFeedback, telegramMessage
   - toggleSound, playSfx, playStepSound
   - showCoinsFeedback, showTelegram, showFlash
   - flashActiveRef, deferredOfferRef (exponovány pro rollDice)
5. V GameBoard:
   - Nahraď deklarace voláním hooku
   - Čtyři telegram useEffecty (year event, game over, late-join, join->pozor join je v hooku)
     které závisí na seenYearEventTurnRef ZŮSTÁVAJÍ v GameBoard
   - flashActiveRef a deferredOfferRef používej z hook returnu

Guardrails: neměnit timing, logiku, gameplay, DB, pending flow.
Validace: npm run typecheck.
Commit: refactor: extract useGameBoardAudio hook
```

---

## 7. Validace

Žádné změny kódu — typecheck není nutný.

## 8. Změněné soubory

- `docs/refaktoring/gameboard-audio-hook-precheck.md` ← nový
