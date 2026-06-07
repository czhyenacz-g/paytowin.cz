# Audit: Pending-State Engine

**Datum:** 2026-06-07  
**Větev:** v0.7.x-seno  
**Autor:** audit via Claude Code

---

## 1. Shrnutí

Engine používá **DB-centrický model fronty událostí**: pending stavy jsou serializovány do Supabase (jediný zdroj pravdy) a synchronizovány všem klientům přes Realtime subscription. Klientský React state je pouze odvozený — po refreshi se re-derivuje z DB.

Klíčové síly architektury:
- Mutual exclusion mezi `horse_pending`, `card_pending`, `offer_pending` je garantována na straně serveru (každý write nuluje ostatní).
- Každý bot action má idempotency guard přes `turn_count`.
- Každý timeout-based state má ref closure (nikdy stale callback).

Klíčová rizika:
- `Promise.all` pro parallel write dvěma hráčům — asymetrické selhání nemá rollback.
- `stableDuelCtx` cleanup (2,5s timeout) je best-effort; spoléhá na ref mutation bez atomicity.
- Spectator vidí duel overlay (read-only), ale neměl by ho vidět vůbec.

---

## 2. Inventář pending stavů

| # | Stav | DB pole | React state | Nastaví | Vyčistí | Resolver | Přežije refresh | Recovery |
|---|------|---------|-------------|---------|---------|----------|----------------|---------|
| 1 | `horse_pending` | `game_state.horse_pending` boolean | `pendingRacer` (odvozený) | `rollDice` (~940) | `buyRacer:1157`, `skipRacer:1212`, `finishTurn:1585`, `applyCardEffect:1414` | Člověk nebo bot | ✓ Ano | Realtime + `useEffect` restore (~2338) |
| 2 | `card_pending` | `game_state.card_pending` JSONB | `pendingCard` (odvozený) | `rollDice` (~964) | `applyCardEffect:1446`, `finishTurn:1586` | Člověk (timer 7 s) nebo bot | ✓ Ano | Realtime auto-populate + timer restart |
| 3 | `offer_pending` (reroll) | `game_state.offer_pending` JSONB | `pendingOffer` (odvozený) | `rollDice` (~1013) | `acceptOffer:1238`, `declineOffer:1252` | Člověk | ✓ Ano | Realtime + audio deferred queue |
| 4 | `offer_pending` (race) | `game_state.offer_pending` JSONB | `pendingRace` (odvozený) | `startRace:1861` | `closeRace:1901` | Člověk (submit scores) | ✓ Ano | Realtime |
| 5 | `offer_pending` (race_pending) | `game_state.offer_pending` JSONB | `racePendingEvt` (odvozený) | `finishTurn:1556` | `closeRacePending:1668` | Člověk (výběr → závod → výsledky) | ✓ Ano | Realtime; ref guard `selectionSubmittedRef` |
| 6 | `offer_pending` (bankrupt_ann.) | `game_state.offer_pending` JSONB | `bankruptAnn` (odvozený) | `finishTurn:1532` | `closeBankruptAnnouncement:1631` (3 s timer) | Systém (timer) | ✓ Ano | Realtime; auto-close 3 s |
| 7 | `offer_pending` (stable_duel) | `game_state.offer_pending` JSONB | `stableDuelCtx` | `rollDice:802` nebo bot (`bot-actions:285`) | `handleStableDuelFinish:2073` po 2,5 s | Člověk (minihra) | ✓ Ano | Realtime → všichni klienti otevřou overlay |
| 8 | `pendingRollDecision` | — (local only) | `pendingRollDecision` (165) | `rollDice:677` po animaci | `resolveRollDecision:403` (4 s timeout nebo tlačítko) | Člověk nebo timer | ✗ Ne | 4 s auto-timeout → adjustment=0 |
| 9 | `bankruptWarning` | — (local only) | `bankruptWarning` (166) | `confirmBankruptOrSell:624` | resolver callback (629) | Člověk (modal) | ✗ Ne | Promise; modal čeká na interakci |
| 10 | `isRolling` | — (local only) | `isRolling` (161) | `rollDice:661` | `rollDice:671` po animaci | Systém (animation) | ✗ Ne | — |
| 11 | `isMoving` | — (local only) | `isMoving` (162) | `rollDice:704` | `rollDice:728` po pohybu | Systém (animation loop) | ✗ Ne | — |
| 12 | `animatingPlayerIdx` | — (local only) | ref + state (172, 219) | `rollDice:705` | `rollDice:1051` po animaci | Systém | ✗ Ne | Ref=null → next Realtime refresh normalizuje |

---

## 3. Kde se nastavují a čistí

### horse_pending
- **SET:** `GameBoard.tsx` ~940–950 — při rollu kostek, pokud hráč stojí na volném racerovi → `{ horse_pending: true, card_pending: null, offer_pending: null }` (vždy nuluje ostatní)
- **CLEAR:** `GameBoard.tsx:1157` (`buyRacer`), `1212` (`skipRacer`), `1585` (`finishTurn`), `1414` (`applyCardEffect` pokud karta přesunula na racera)
- **BOT CLEAR:** `bot-actions.ts:490` — bot action má guard `turn_count === expected`

### card_pending
- **SET:** `GameBoard.tsx` ~964–973 — při rollu, pokud pole je karta → `{ card_pending: CARD, horse_pending: false, offer_pending: null }`
- **CLEAR:** `GameBoard.tsx:1446` (`applyCardEffect`), `1586` (`finishTurn`)
- **TIMER:** `GameBoard.tsx:1466` — 7 s auto-apply; callback uložen v `applyCardEffectRef` (1454)

### offer_pending (všechny typy)
- **SET:** `GameBoard.tsx` ~1005–1026 (reroll offer), `1532` (bankrupt ann.), `1556` (race_pending), `1861` (race), `802` / `bot-actions:285` (stable_duel)
- **CLEAR:** Každý typ má vlastní clear funkci; všechny zapisují `offer_pending=null` do DB

### pendingRollDecision
- **SET:** `GameBoard.tsx:677–691` — po skončení dice animace, pokud hráč může upravit krok
- **CLEAR:** `GameBoard.tsx:403–412` — explicitní klik nebo 4 s countdown (uloženo v `rollDecisionResolvedRef`)

### bankruptWarning
- **SET:** `GameBoard.tsx:624–644` — `confirmBankruptOrSell()` volaná z `finishTurn` když `coins ≤ 0`
- **CLEAR:** Promise resolver callback (629); modal vrací rozhodnutí (prodej / pokračovat)

---

## 4. Kdo je řeší

| Stav | Člověk | Bot | Systém / Timer | Klient hook |
|------|--------|-----|----------------|------------|
| `horse_pending` | ✓ `buyRacer` / `skipRacer` | ✓ `executeBotHorseDecisionAction` | — | `useOnlineBotTrigger` |
| `card_pending` | ✓ klik po uplynutí timeru | — | ✓ 7 s auto-apply | — |
| `offer_pending` (reroll) | ✓ `acceptOffer` / `declineOffer` | — | — | audio deferred queue |
| `offer_pending` (race/race_pending) | ✓ výběr koně + submit | — | — | — |
| `offer_pending` (bankrupt_ann.) | — | — | ✓ 3 s timer | — |
| `offer_pending` (stable_duel) | ✓ minihra výsledek | ✓ bot_duel result | — | — |
| `pendingRollDecision` | ✓ ±1 tlačítka | — | ✓ 4 s timeout | — |
| `bankruptWarning` | ✓ modal button | — | — | — |

---

## 5. Co přežije refresh

| Stav | Přežije refresh | Jak se obnoví |
|------|----------------|--------------|
| `horse_pending` | ✓ Ano | `refreshGame` na load → Realtime handler ~586 + useEffect restore ~2338 |
| `card_pending` | ✓ Ano | Realtime auto-populate ~2352 + timer restart |
| `offer_pending` (všechny) | ✓ Ano | Realtime → klientský derived state; stable_duel overlay se znovu otevře |
| `pendingRollDecision` | ✗ Ne | Hráč musí znovu hodit; stará data ztracena (přijatelné — lokální) |
| `bankruptWarning` | ✗ Ne | `finishTurn` vyhodnotí coins znovu, zavolá `confirmBankruptOrSell` znovu |
| Animace (`isRolling`, `isMoving`) | ✗ Ne | Viz DB pozice; klient snaps na DB hodnotu |

### localStorage / sessionStorage

| Klíč | Hodnota | Přežije zavření tabu | Použití |
|------|---------|---------------------|---------|
| `paytowin_player_${gameCode}` | Player ID | ✓ localStorage | Obnova identity po refreshi (~485) |
| `paytowin_late_join` | Game code | ✗ sessionStorage | Jednorázový signál "právě se připojil jako spectator" |
| `paytowin_guide_*` | "dismissed" | ✓ localStorage | Skrytí guide banneru |
| `stableDuelMode` | mode string | ✓ localStorage | Dev override pro stable duel mode |

---

## 6. Konflikty a deadlock rizika

### Vzájemné vyloučení (garantované)

`horse_pending`, `card_pending`, `offer_pending` jsou **navzájem exkluzivní** — každý SET nuluje ostatní dva na straně serveru. Nelze, aby byly aktivní dva najednou.

### Konfliktní scénáře

#### A — Promise.all asymetrie (střední riziko)
**Kde:** `bot-actions.ts:301` (rent payment)
```typescript
await Promise.all([
  supabase.from("players").update({ coins: paidBot.coins }).eq("id", botPlayer.id),
  supabase.from("players").update({ coins: paidOwner.coins }).eq("id", ownerPlayer.id),
]);
```
**Scénář:** Druhý write selže → bot přišel o coins, owner je nedostal. Turn_count guard zabrání re-apply, ale asymetrický stav přetrvává.  
**Mitigace:** Existuje, ale není rollback. Monitorování error logů.

#### B — Stable Duel cleanup race (nízké-střední riziko)
**Kde:** `GameBoard.tsx:2079–2106`  
**Scénář:** Minihra skončí → `handleStableDuelFinish` zapíše `phase="finished"` → cleanup `setTimeout(2500ms)` refetchne DB a zavolá `proceed()`. Pokud Realtime zpoždění → cleanup fetches before DB update is visible → tiše přeskočí.  
**Mitigace:** `proceed` ref nulled po prvním invoke (2115-2116). Cleanup bez efektu pokud fáze nesedí.  
**Riziko:** Fragile — závisí na ref mutation side-effect.

#### C — Spectator bot trigger (nízké riziko)
**Kde:** `useOnlineBotTrigger.ts:45–49`  
**Scénář:** Spectator (bez `myPlayerId`) přeskočí trigger. Pokud se reconnectne jako hráč, nový `scheduledRef` pro aktuální tah.  
**Mitigace:** `scheduledRef` předchází duplicate scheduling.

#### D — Karta + forced sale (přijatelné)
**Kde:** `GameBoard.tsx:1411–1420`  
**Scénář:** Karta přesune hráče na racera → `horse_pending=true` v DB, card cleared. Správné pořadí.  
**Mitigace:** Explicitní `updatedCurrentPlayerHorses` param předán do `finishTurn` (1514) — zabraňuje stale closure přepsání koní.

#### E — Mobile Realtime unreliability (nízké riziko)
**Kde:** `useOnlineBotTrigger.ts:79–89`  
**Scénář:** Bot action proběhne, ale klient na mobilu nevidí Realtime event.  
**Mitigace:** Explicitní `onBotActionComplete()` refetch po bot action. Idempotentní read.

---

## 7. UI overlay priority (z-index)

| z-index | Komponenta | Účel | Blokuje klikání |
|---------|-----------|------|----------------|
| 0 | Herní deska | Base board | Ne |
| 40 | RollCorrectionPanel | ±1 rozhodnutí po hodu | Ano |
| 44 | StableDuelStatusBanners | Online_1v1 waiting banner | Ne (UI-only) |
| 50 | DevRaceBoardLayer / DevRaceFlipLayer | Dev-only race/flip overlays | Ano (dev) |
| **55** | **StableDuelBoardLayer** | **Minihra (pvbot + online_1v1)** | **Ano (fullscreen)** |
| 60 | RacerLostModal / FlashToast | Racer burnout notifikace | Ano (modal) |
| **70** | **IntroOverlay / CenterEventModal / BankruptAnnouncementModal / RacerPurchaseModal** | **Pending-state modály (karta, kůň, nabídka, bankrot)** | **Ano (fullscreen)** |
| 71 | Sound toggle button | Zvukové tlačítko (fixed) | Ne (inertní) |
| 80 | MapMenuStrip | Telegram menu (fixed top) | Ne |
| 200 | DevRaceModeShell / DevDuelShell / DevSpeedShell | Dev harness shells | Ano (fullscreen dev) |
| 9999 | SharedObjectiveOverlay / PersonalObjectiveOverlay | Scenario objectives (start/end) | Ano (start-only) |

**Klíčové pozorování:** Stable Duel (z=55) je záměrně pod obecnými modály (z=70) — modály se nad ním zobrazí. Duel musí skončit, než engine přejde do dalšího pending state.

---

## 8. Bot a reconnect rizika

### Timeout-based clearing

| Stav | Timeout | Kde | Recovery |
|------|---------|-----|---------|
| `pendingRollDecision` | 4 000 ms | `GameBoard.tsx:688` | Auto-resolve adjustment=0 |
| `card_pending` | 7 000 ms | `GameBoard.tsx:1466` | Auto-apply; closure v `applyCardEffectRef` |
| `bankruptAnn.` modal | 3 000 ms | `GameBoard.tsx:1657` | Auto-close; closure v `closeBankruptAnnouncementRef` |
| Stable duel cleanup | 2 500 ms | `GameBoard.tsx:2079` | Volá `proceed()` pokud DB fáze sedí; ref guard |
| Movement trail | 3 000 ms | `GameBoard.tsx:1055` | Vizuální efekt, bez game state |

### Bot idempotency guardy (`bot-actions.ts:165–180`)
```typescript
if (state.turn_count !== expectedTurnCount) return { ok: false };
if (state.horse_pending) return { ok: false };
if (state.card_pending) return { ok: false };
if (state.offer_pending) return { ok: false };
```
Čtyři guardy na každé bot action. 100% účinné server-side.

### Reconnect recovery pattern
1. **Manual fetch on load** — `refreshGame(game.id)` při mountu (~508); idempotentní read
2. **Realtime + manual refetch** — `onBotActionComplete()` po bot action; race guard
3. **DB-centric idempotency** — `turn_count` guard na každé mutation

---

## 9. Návrh cílového pending-state modelu

### Prioritní pořadí pending stavů

```
forced_sale (bankruptWarning)
  > stable_duel_result (minigame active)
  > bot_recovery (bot action inflight)
  > purchase_decision (horse_pending)
  > card_resolution (card_pending)
  > offer_resolution (offer_pending: reroll / race / bankrupt_ann.)
  > info_modal (RacerLostModal, FlashToast)
  > roll_decision (pendingRollDecision)
```

Pravidla:
- Žádný stav nižší priority nesmí spustit resolver, pokud je aktivní stav vyšší priority.
- Každý pending state musí mít přesně: **owner**, **resolver**, **timeout/recovery**, **idempotency guard**, **UI component**, **cleanup condition**.
- Všechny DB writes zabraňující concurrent execution musí být atomic (RPC, ne Promise.all).

### Canonical pending state contract (návrh typů)

```typescript
interface PendingStateDescriptor {
  name: string;
  owner: "human" | "bot" | "system";
  resolver: string;        // function name
  timeoutMs?: number;      // optional auto-resolve
  recoveryOnLoad: boolean; // can be re-derived from DB?
  idempotencyKey: string;  // co zabraňuje double-resolve
  uiComponent: string;     // která komponenta ho zobrazuje
  zIndex: number;
  blocksRollDice: boolean;
}
```

---

## 10. První 3 malé refaktory

### Refaktor 1 — Extrahovat `pendingStateFromDBRow()` helper

**Problém:** Logika odvozování `pendingRacer`, `pendingCard`, `pendingOffer` z DB row je roztroušena v `GameBoard.tsx` v Realtime handleru (~586), useEffect restore (~2338) a post-roll bloku (~940–976). Každá kopie má mírně odlišnou logiku.

**Akce:** Vytvorit `app/game/utils/derivePendingState.ts` s čistou funkcí:
```typescript
function derivePendingState(state: GameStateRow, players: Player[], myPlayerIndex: number): DerivedPendingState
```
Volat z Realtime handleru, post-roll i recovery useEffect.

**Dopad:** Eliminuje 3 místa s divergentní logikou; zjednodušuje testování; zabrání budoucí divergenci.

**Riziko:** Nízké — čistá funkce bez side-effectů; lze zavést postupně.

---

### Refaktor 2 — Atomic rent payment přes RPC

**Problém:** `bot-actions.ts:301` používá `Promise.all` pro dvě oddělené Supabase writes (bot coins + owner coins). Pokud druhý write selže, stav je asymetrický.

**Akce:** Vytvořit Supabase RPC funkci `pay_rent(game_id, payer_player_id, owner_player_id, amount)` která provede oba UPDATE v jedné transakci. Volat místo Promise.all.

**Dopad:** Eliminuje jedinou kritickou neatomicity v engine; zachovává idempotency guard.

**Riziko:** Nízké — RPC je server-side; klient kód se zjednoduší (jeden await).

---

### Refaktor 3 — Spectator guard na stableDuelCtx overlay

**Problém:** Spectator dostane `stableDuelCtx` přes Realtime → `StableDuelBoardLayer` se otevře s read-only controls. Správná logika, ale spectator by overlay vůbec neměl vidět — zbytečná komplexita.

**Akce:** V `GameBoard.tsx` v místě kde se nastavuje `stableDuelCtx` (~2197) přidat podmínku:
```typescript
if (duelRole === undefined && !isSpectator) return; // skip if spectator
```
Nebo přímo v `StableDuelBoardLayer`: `if (isSpectator) return null;`

**Dopad:** Eliminuje render zbytečné vrstvy; zjednodušuje UX; snižuje riziko tap-through na mobilu.

**Riziko:** Nízké — spectator overlay je read-only; odebrání je bezpečné.

---

## 11. Otevřené otázky

1. **Jsou pending stavy validovány server-side při každé mutaci?** Guardy existují v `bot-actions.ts`, ale human actions (`buyRacer`, `acceptOffer`) — mají server-side guard nebo jen klientský?
2. **Co se stane, když RPC pro atomic rent selže?** Existuje retry? Nebo hra pokračuje s nekonzistentním stavem?
3. **Lze `stableDuelCtx` duplikovat?** Pokud klient refreshuje v průběhu stable_duel a Realtime doručí offer_pending znovu → `openStableDuelOverlay` se zavolá podruhé. `overlayOpenedRef` guard — je nulled při cleanup?
4. **Jak se chovají pending stavy při `game_status="finished"`?** Explicitně vyčištěny v `checkAndFinishGame`? Nebo jen ignorovány protože game screen se nerenduje?
5. **`deferredOfferRef` po game finish** — není nulled; memory leak? (Nízká priorita.)
