# GameBoard.tsx — mapa odpovědností po extrakcích

Zpracováno: 2026-05-30  
Aktuální stav: **3 189 řádků** (původní: 3 437)

Extrahováno dříve: scheduleMorseAudio, BankruptAnnouncementModal, AmbientBackground,
BoardAnimationLayer, BoardSurface.

---

## 1. Přehled oblastí

| Oblast | Řádky | DB write | setState | Stale closure | Riziko extrakce |
|---|---|---|---|---|---|
| Loading / early return screens | ~90 | ✗ | ✗ | ✗ | Nízké (zvláštní pattern) |
| DB load / Supabase Realtime | ~138 | UPDATE games.status | ✅ 8+ | animatingPlayerIdRef | **Vysoké** |
| Turn orchestration | ~411 | ✅ players + game_state | ✅ 8+ | 3 closure refs | **Vysoké** |
| Dice / movement animation | ~70 | ✗ | ✅ 5 | animatingPlayerIdRef | Střední |
| Pending state handling | ~120 | ✗ | ✅ 3 | offerAcceptedRef | Střední |
| Card / effect handling | ~230 | ✅ players + game_state | ✅ 3 | applyCardEffectRef | **Vysoké** |
| Race flow | ~330 | ✅ game_state (4× fáze) + players | ✅ 3 | 4 idempotency refs | **Vysoké** |
| Stable Duel flow | ~360 | ✅ players + game_state | ✅ 2 | 5 idempotency refs | **Vysoké** |
| Bot trigger/integration | ~3 | ✗ | ✗ | ✗ | Již extrahovano (hook) |
| Bankrot / game over | ~170 | ✅ games.status, game_state | ✅ 2 | closeBankruptRef | **Vysoké** |
| Derived view state | ~130 | ✗ | ✗ | ✗ | Nízké |
| Overlay / modal rendering | ~62 | ✗ | ✗ | ✗ | Nízké |
| Top panel / HUD | ~165 | ✗ | ✅ setters (UI only) | ✗ | Střední |
| Audio / UX feedback | ~180 | ✗ | ✅ flashEvent, coinsFeedback | audioCtxRef | Střední |
| Dev / debug tools | ~150 | ✗ | ✅ UI only | ✗ | Nízké (dev-only) |

---

## 2. Detailní popis oblastí

### 2.1 Loading / Early return screens
**Řádky: ~2674–2763**

- `loading` → IntroOverlay
- `gameCode && !gameId` → "Hra nenalezena"
- `gameStatus === "cancelled"` → statická stránka
- `gameStatus === "finished"` → GameFinishedScreen (samostatná komponenta)
- `viewerRole === "login_required"` → Discord login nebo local warning

**Charakter**: Jsou to `return` statementy, ne JSX bloky uvnitř main renderu — nelze je elegantně vytáhnout do jedné komponenty bez přepisu control flow. Každá obrazovka individuálně je ~10 řádků statického JSX.

**Závislosti**: Minimální — theme (pro IntroOverlay), gameCode, gameStatus, viewerRole.

**Doporučení**: Jsou tak malé, že extrakce nepřinese výrazný přínos. Ponechat.

---

### 2.2 DB load / Supabase Realtime
**Řádky: ~550–687**

Dvě `useEffect` + `refreshGame()` funkce:
- Loading useEffect: `supabase.from("games").select()` → setters
- `refreshGame()`: paralelní load players + game_state → normalize → set state
- Realtime subscription: `games`, `players`, `game_state` tables

**Stale closure**: `animatingPlayerIdRef` + `animPositionRef` chrání pozici hráče při animaci — refreshGame je pak čte a neoverpíše animující figurku.

**eslint-disable**: 1× (gameId dep)

**Doporučení**: Neextrahovat. Stale closure guard je tightly coupled na animace. Vytažení by vyžadovalo sdílení refs přes context nebo props.

---

### 2.3 Turn orchestration (rollDice + finishTurn)
**Řádky: ~769–1180 (rollDice) + ~1656–1770 (finishTurn)**

`rollDice` je jeden velký async flow: validace → animace kostky → roll decision → animace pohybu → field effects → finishTurn.

`finishTurn` zapisuje do DB: players update (position, coins, skip_next_turn, horses, active_effects), game_state update (current_player_index, turn_count, log, last_roll, offer_pending, fog_of_war, bust_order).

**Stale closures**: 3 klíčové refs:
- `pendingRollResolverRef` — Promise resolver
- `rollDecisionResolvedRef` — idempotency
- `animatingPlayerIdRef` / `animPositionRef` — guard pro refreshGame

**eslint-disable**: 2×

**Doporučení**: Neextrahovat. Celý flow je jedna nezlomitelná async sekvence. Extrakce finishTurn do oddělené funkce by vyžadovala předání 15+ parametrů nebo context.

---

### 2.4 Dice / movement animation
**Řádky: ~780–849 (subset rollDice)**

- Animace kostky: sleep(80) loop s random display values
- Animace pohybu: sleep(160) per step, trail building
- Sound effects: playSfx("dice"), playStepSound() per step
- Refs: animatingPlayerIdRef, animPositionRef nastaveny inline

**Poznámka**: Je to subset `rollDice` — nelze extrahovat samostatně bez vyčlenění celého rollDice.

---

### 2.5 Pending state handling
**Řádky: ~2429–2462 (restoration logic)**

`useEffect` který čte `game_state.horse_pending / card_pending / offer_pending` a nastaví lokální state. Restoration pattern: po Realtime update se pending stav obnoví z DB.

**Stale closures**: `offerAcceptedRef` guard — zabrání double-accept.

**eslint-disable**: 1×

**Doporučení**: Střední riziko. Mohl by být hook `usePendingStateRestoration`, ale závisí na gameState a FIELDS — více než 5 deps.

---

### 2.6 Card / effect handling
**Řádky: ~1360–1566**

`applyCardEffect` (closure synced do `applyCardEffectRef`):
- Výpočet efektu: coins, move, skip_turn, give_racer, stamina_debuff
- DB write: `players.update` + `game_state.update`
- Chain guard: depth=1 pro move karet přistávající na horse field
- Bankrot check inline

Auto-apply timer: 7s timeout → `applyCardEffectRef.current()`.

**Stale closures**: `applyCardEffectRef` — synced useEffect, aby timer zavolal fresh closure. `cardAppliedRef` — turn-based idempotency.

**eslint-disable**: 1×

**Doporučení**: Neextrahovat. applyCardEffect je closure nad turn flow state — extrakce by vyžadovala context nebo props drilling.

---

### 2.7 Race flow
**Řádky: ~1761–1991 (funkce) + ~2600–2660 (auto-transitions)**

7 funkcí: closeRacePending, closeRaceResult, submitRaceSelection, submitPendingRaceScore, startRace, submitRaceScore + auto-transitions useEffekty.

Každá fáze přepisuje `game_state.offer_pending` s novou fází: selecting → countdown → racing → results.

`closeRaceResult` dělá legendary horse elimination + players update + awardRaceStarAction.

**Stale closures**: 4 idempotency refs (pendingRaceRef, raceSubmittedRef, selectionSubmittedRef, pendingRaceScoreRef).

**eslint-disable**: 3×

**Doporučení**: Neextrahovat. Fáze jsou tightly coupled DB state machine.

---

### 2.8 Stable Duel flow
**Řádky: ~736–744 + ~2065–2425**

openStableDuelOverlay + handleStableDuelFinish + handleDefenderReady + handleFallbackToPvBot + countdown logic + pvbot auto-trigger.

Settlement (handleStableDuelFinish):
- Challenger-only guard
- computeMinigameSettlement() → players.update coins + horses
- Online 1v1: DB write phase=finished
- Deferred cleanup setTimeout 2.5s → finishTurn

**Stale closures**: 5 idempotency refs + stableDuelProceedRef (closure continuity přes turn boundary).

**eslint-disable**: 3×

**Doporučení**: Neextrahovat. Nejsložitější část GameBoard. Settlement guard + closure continuity přes tah jsou klíčové pro online bezpečnost.

---

### 2.9 Bot trigger/integration
**Řádky: ~3 v GameBoard**

`useOnlineBotTrigger({ gameId, gameState, players, myPlayerId, isLocalGame })` — **již extrahovano do hooku** (`app/components/board/hooks/useOnlineBotTrigger.ts`). GameBoard jen předá deps.

---

### 2.10 Bankrot / game over
**Řádky: ~747–767 + ~2021–2046**

`confirmBankruptOrSell()` — Promise-based modal s ref-callback resolution.

`checkAndFinishGame()` — snapshot ověří win condition, zapíše `games.status=finished`, fire-and-forget awardXpAction, awardWinStarAction, awardMoneySpentAction.

**Stale closures**: `bankruptWarningResolverRef`, `closeBankruptAnnouncementRef`.

**Doporučení**: Neextrahovat. DB write games.status a award fire-and-forget jsou klíčové.

---

### 2.11 Derived view state
**Řádky: ~270–320 + ~2490–2598**

Čisté výpočty bez setState a bez DB:
- `getThemeById()`, `getThemeRacers()`, `getBoardById()`, `applyBoardShuffle()`, `buildFields()`
- `displayPlayers`, `fieldPlayers()`, `currentPlayer`, `isMyTurn`, `isLocalGame`, `isHost`
- `leadLaps`, `gameYear`, `currentYearEvent`, `scenario`
- `raceResults` — sorted s effectiveScore
- `rollDecisionOptions` = `buildRollDecisionOptions()`
- `racerOwnership` map

**Závisí na**: players, gameState, theme, economy, myPlayerId, viewerRole — vše jsou live state/props.

**Doporučení**: ✅ Kandidát na extrakci do view-model helperu nebo hooku.

---

### 2.12 Overlay / modal rendering
**Řádky: ~2775–2836**

JSX blok s overlaye a modaly:
- CenterEventModal, FlashToast, RacerLostModal, TelegramStrip
- RaceModal, BankruptAnnouncementModal, RaceEventOverlay

Všechny jsou buď již samostatné komponenty nebo jednoduché podmíněné rendery. Samotný JSX blok v GameBoard je `~62` řádků.

**Doporučení**: ✅ Kandidát — `GameBoardModals` wrapper (nízké riziko, ale malý přínos).

---

### 2.13 Top panel / HUD
**Řádky: ~2855–3019**

- Toggle button, BrandLogo, mode badges, score popup modal, current player badge
- Host actions (startRace, cancelGame)
- DevToolbar (stableDuelMode toggle, dev harness openers)
- Field legend strip

**setState**: setTopPanelVisible, setScorePopupOpen, setStableDuelCtx, setDevRaceMode, ... (UI only, žádný DB write).

**Doporučení**: ✅ Kandidát na extrakci (Kandidát B z předchozího auditu). Střední riziko — mnoho setter props.

---

### 2.14 Audio / UX feedback
**Řádky: ~369–730**

- `toggleSound()`, `soundEnabled`, `soundEnabledRef`
- `playStepSound()` — custom AudioContext synthesis
- `playSfx()` — preset SFX
- `useBgMusic()` — background music
- `showCoinsFeedback()` — 3s auto-dismiss
- `showTelegram()` — 4s strip + morse audio
- `showFlash()` — 2–3s spotlight
- Timer refs: coinsFeedbackTimerRef, telegramTimerRef, flashTimerRef
- State: flashEvent, coinsFeedback, telegramMessage

**Charakter**: AudioContext je sdílený s `playStepSound` a `playSfx`. State (flashEvent, coinsFeedback, telegramMessage) je renderován v GameBoard JSX.

**Doporučení**: ✅ Kandidát na `useGameBoardAudio()` hook. Střední riziko.

---

### 2.15 Dev / debug tools
**Řádky: ~183–194 (state) + ~2051–2063 (flip) + ~3139–3180 (shells)**

- State: devRaceMode, devDuelOpen, devSpeedOpen, devLegendaryOpen, devFlipOpen, flipBoardAnim
- Dev shell render: DevRaceModeShell, DevDuelShell, SpeedDevShell, LegendaryRaceDevShell
- flipBoardAnim animace (2 funkce, timer ref)
- Vše obaleno `process.env.NODE_ENV === "development"`

**Doporučení**: Státy a shell render jsou malé, tree-shakeable. Ponechat nebo seskupit jako samostatný dev overlay blok.

---

## 3. Tři nejbezpečnější kandidáti na extrakci

### ⭐ Kandidát 1 — `useGameBoardAudio` hook
**Rozsah**: ~180 řádků → nový `app/components/board/hooks/useGameBoardAudio.ts`

**Co by se přesunulo**:
- Veškerá audio logika: toggleSound, playStepSound, playSfx, useBgMusic
- UX feedback: showCoinsFeedback, showTelegram, showFlash
- State: soundEnabled, flashEvent, coinsFeedback, telegramMessage
- Timer refs: coinsFeedbackTimerRef, telegramTimerRef, flashTimerRef, flashActiveRef, flashTimerRef
- Ref: audioCtxRef, soundEnabledRef

**Hook by vracel**:
```typescript
{
  soundEnabled, toggleSound,
  playSfx, playStepSound,
  showCoinsFeedback, showTelegram, showFlash,
  flashEvent, coinsFeedback, telegramMessage,
  // deferredOfferRef pro acceptOffer
}
```

**Riziko**: Střední. `showFlash` používá `deferredOfferRef` (vazba na offer flow) — tento ref by musel být předán nebo sdílen. `showTelegram` volá `scheduleMorseAudio` (již extrahovano ✓).

**Výsledek**: GameBoard ztratí ~180 řádků, získá jeden hook call.

---

### ⭐ Kandidát 2 — `GameBoardTopPanel` komponenta
**Rozsah**: ~165 řádků → `app/components/board/GameBoardTopPanel.tsx`

Auditován v `gameboard-large-render-extractions.md` jako Kandidát B.

**Co by se přesunulo**: HUD row + score popup modal + host actions + DevToolbar + legend strip.

**Riziko**: Střední-Vysoké. Mnoho setter props (13+ callbacků), včetně DB-touching `startRace` + `cancelGame` předaných jako funkce.

**Výsledek**: GameBoard ztratí ~165 řádků.

---

### ⭐ Kandidát 3 — Inline view-model helpery → `lib/game/gameBoardViewModel.ts`
**Rozsah**: ~130 řádků (jen computed, žádný state)

**Co by se přesunulo**:
- Výpočty jako pure funkce: `computeRaceResults(...)`, `computeRacerOwnership(...)`, `computeDisplayPlayers(...)`
- Konstanty: `RACE_WINNER_REWARD`
- `buildRollDecisionOptions` (již v lib/game/viewModel.ts ✓)

**Riziko**: Nízké. Jde o čisté výpočty bez React state. GameBoard by jen volal funkce a destructuroval výsledky.

**Výsledek**: GameBoard ztratí ~60–80 řádků computed logiky (ne všechno lze snadno vyčlenit bez deps).

---

## 4. Co zatím neextrahovat

| Oblast | Proč |
|---|---|
| Turn orchestration (rollDice, finishTurn) | Jeden async flow s 3 stale-closure refs a DB write. Extrakce by vyžadovala context API. |
| Card / effect handling (applyCardEffect) | Closure protection přes applyCardEffectRef — ref pattern nutný pro auto-apply timer. |
| Race flow | 4 idempotency refs + state machine přes DB offer_pending fáze. |
| Stable Duel flow | Nejsložitější oblast. 5 idempotency refs + stableDuelProceedRef přes turn boundary. |
| DB load / Realtime | animatingPlayerIdRef guard tightly coupled na animace. |
| Bankrot / game over | DB write games.status + Promise-based modal s ref-callback. |
| Pending state restoration | Závisí na FIELDS + gameState.offer_pending — too many cross-deps. |

---

## 5. Doporučené pořadí dalších kroků

```
useGameBoardAudio hook      (~180 ř., střední riziko, jasná boundary)
  ↓
View-model helpery          (~60–80 ř., nízké riziko, pure funkce)
  ↓
GameBoardTopPanel           (~165 ř., střední-vysoké riziko, audit dříve proveden)
```

Po těchto třech krocích by GameBoard.tsx klesl přibližně z **3 189** na **~2 764 řádků** (−425).

Jádro (turn orchestration + race + duel + card + bankrot + DB load) by zůstalo jako monolitická orchestrační logika na ~1 600 řádcích. To je přijatelný stav pro komponentu této komplexity.
