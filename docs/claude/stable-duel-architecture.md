# Stable Duel — architektura (cache pro Claude)

Poslední aktualizace: 2026-04-28 · commit c6b61e2

---

## Hlavní soubory a jejich role

| Soubor | Role |
|---|---|
| `app/components/GameBoard.tsx` | Orchestrátor — trigger, flow, settlement, finishTurn, DB zápisy |
| `app/components/StableDuelBoardLayer.tsx` | Overlay UI — prestart/arena/result/waiting_result fáze |
| `app/components/duel/DuelArena.tsx` | Neon Rope Duel simulace (pvbot / pvp / remote P2) |
| `app/components/speed/SpeedArenaPvp.tsx` | Speed Race simulace (zatím jen pvbot) |
| `lib/types/game.ts` | `StableDuelPendingOffer`, `StableDuelResultSummary` typy |
| `lib/minigames/settlement.ts` | `computeMinigameSettlement` — coins/stamina výpočet |
| `lib/minigames/selectStableMinigame.ts` | Volba minihry (rope/speed/legendary) podle koní a tématu |
| `lib/minigames/types.ts` | `MinigameResult` interface |
| `lib/duel/types.ts` | `DuelConfig`, `DuelState`, `Dir` |
| `lib/duel/broadcastTypes.ts` | `StableDuelInputEvent` — Broadcast eventy pro PvP input sync |
| `lib/duel/simulate.ts` | `applyTick`, `createInitialState`, `getBotInput` |

---

## Kde je Stable Duel trigger

**GameBoard.tsx ~řádek 1182–1236**

Při `rollDice()` → hráč přistane na protivníkově racer fieldu → oba mají koně → vytvoří se `StableDuelPendingOffer` a zapíše se do `game_state.offer_pending`.

Klíčové proměnné: `challenger` (ten, kdo šel), `defender` (majitel fieldu), `stableDuelMode` (pvbot_awareness vs online_1v1).

---

## Kde je offer_pending lifecycle

**`game_state.offer_pending`** (Supabase tabulka) — sdílený stav pro všechny klienty.

Typ: `StableDuelPendingOffer` (lib/types/game.ts řádek 190–215):
```typescript
phase: "pending" | "both_ready" | "countdown" | "started" | "finished"
mode?: "pvbot_awareness" | "online_1v1"
challengerId, defenderId, createdAt
startsAt?         // Unix timestamp startu
countdownOwnerId? // kdo zapsal countdown
resultSummary?    // zapíše challenger, čtou ostatní
winnerId, loserId, finishedAt
```

Cleanup: `finishTurn()` s `clearOfferPending` → nastaví `offer_pending: null`.

---

## Kde je ready/countdown/finished flow

### pvbot_awareness
- Challenger zapíše offer → **okamžitě** otevře overlay (`openStableDuelOverlay`) bez čekání
- Defender vidí read-only info banner

### online_1v1
| Krok | Kdo | Co |
|---|---|---|
| 1 | Challenger | Zapíše `offer_pending` s `phase: "pending"`, `mode: "online_1v1"` |
| 2 | Defender | Klikne "Jsem připraven" → `handleDefenderReady()` → `phase: "both_ready"` |
| 3 | Challenger | Efekt detekuje `both_ready` → zapíše `phase: "countdown"`, `startsAt: Date.now()+3000` |
| 4 | Oba | Lokální interval počítá z `startsAt` → UI 3/2/1/GO |
| 5 | Challenger | `openStableDuelOverlay` s `duelRole: "challenger_authority"` |
| 5 | Defender | `openStableDuelOverlay` s `duelRole: "defender_remote"` |
| 6 | Challenger | Simulace skončí → `handleStableDuelFinish()` → zapíše `phase: "finished"` + `resultSummary` |
| 7 | Defender | Efekt detekuje `phase: "finished"` → `setStableDuelCtx(null)` → UI ukáže result panel |
| 8 | Challenger | Po 2.5s ověří pending a zavolá `finishTurn()` → `offer_pending: null` |

---

## Kde je settlement guard

**GameBoard.tsx ~řádek 2306–2425** — `handleStableDuelFinish()`:

```typescript
// Challenger-only guard — řádek 2313
if (!ctx?.isPreview && ctx?.challengerId && myPlayerId !== ctx.challengerId) {
  setStableDuelCtx(null);
  return; // defender/spectator → exit bez settlement
}
```

Defender nikdy nevolá `onFinish` — `StableDuelBoardLayer` přejde do `waiting_result` fáze místo volání callbacku (řádek handleDuelResult).

---

## Kde je PvBot fallback

**GameBoard.tsx ~řádek 2455–2474** — `handleFallbackToPvBot()`:

Challenger klikne "Hrát proti botovi" → `openStableDuelOverlay` bez `duelRole` → pvbot chování.

Efekt detekuje `mode: "pvbot_awareness"` → challenger otevře overlay okamžitě bez čekání na ready.

---

## Kde je online_1v1 toggle

```typescript
// GameBoard.tsx ~řádek 490
const [stableDuelMode] = React.useState<"pvbot_awareness" | "online_1v1">(() => {
  const v = localStorage.getItem("stableDuelMode");
  return v === "online_1v1" ? "online_1v1" : "pvbot_awareness";
});
```

Přepnout: `localStorage.setItem("stableDuelMode", "online_1v1")` + refresh.

---

## PvP input sync (nové — commit c6b61e2)

**Broadcast channel:** `stable-duel:{gameId}:stable_duel:{cId}:{dId}:{createdAt}`

**duelId:** `stable_duel:${challengerId}:${defenderId}:${createdAt}`

**Challenger (authority):**
- `StableDuelBoardLayer` subscribuje Broadcast channel
- Přijaté eventy → `remoteP2Ref.current` (dir + nitroActivate)
- `DuelArena` čte P2 z `remoteP2Ref` místo klávesnice (prop `remoteP2Ref`)
- Simulace je autoritativní → zapíše výsledek

**Defender (remote):**
- `StableDuelBoardLayer` subscribuje Broadcast channel (jen pro send)
- keydown/keyup ArrowLeft/ArrowRight/S → `channel.send(StableDuelInputEvent)`
- Lokální DuelArena běží v pvbot módu (vizuální feedback, výsledek se ignoruje)
- Po lokálním konci → `phase: "waiting_result"` (nevolá `onFinish`)
- GameBoard efekt: `sdPending.phase === "finished"` → `setStableDuelCtx(null)`

---

## Důležité guardy

| Guard | Kde | Co hlídá |
|---|---|---|
| Challenger-only settlement | GameBoard.tsx ~2313 | `myPlayerId !== ctx.challengerId` → return |
| Defender no DB write | StableDuelBoardLayer `handleDuelResult` | `duelRole === "defender_remote"` → waiting_result, bez `onFinish` |
| Countdown dedup | `countdownStartedRef` + `sdPending.startsAt` guard | Zabrání dvojímu zápisu countdown |
| Overlay dedup | `overlayOpenedRef` keyed `duelKey` | Zabrání dvojímu otevření overlay |
| Fallback guard | `myPlayerId !== sdPending.challengerId` | Jen challenger smí spustit fallback |
| Defender ready guard | `sdPending.defenderId !== myPlayerId` → return | Jen správný defender smí kliknout ready |
| Finish verify | 2.5s timeout re-fetch + compare | Zabrání cleanup jiného duelu |
| Scroll-before-overlay | `openStableDuelOverlay` | `window.scrollTo({top:0})` + `requestAnimationFrame` |

---

## Idempotency refs (GameBoard.tsx ~řádek 485)

```typescript
countdownStartedRef  // klíč: `cdown_{challengerId}_{createdAt}`
overlayOpenedRef     // klíč: `overlay_{cId}_{dId}_{createdAt}_{startsAt}`
                     //    nebo `def_{...}` pro defender
offerAcceptedRef
raceSubmittedRef
selectionSubmittedRef
```

---

## Settlement výpočet

```
reward = max(200, floor(max(p1HorsePrice, p2HorsePrice) / 10))
winner: +reward coins, loser: -reward coins
stamina: base(-20) + nitro(-30 if used) + crash(-15 if crashed)
```

Defender stamina se zatím neodečítá: `STABLE_DUEL_APPLY_BOT_STAMINA_LOSS = false`

---

## Stavový stroj (zkráceno)

```
pvbot_awareness:
  trigger → overlay ihned (challenger) → arena → result → settlement → finishTurn

online_1v1:
  trigger → pending → both_ready → countdown → started*
    → challenger: overlay(authority) + arena → finish → DB result
    → defender:   overlay(remote) + pvbot arena → waiting_result → DB close → result panel
    → spectator:  countdown panel → started panel → result panel
  → finishTurn (challenger, 2.5s delay)

* "started" phase v DB se nezapisuje — detekce přes startsAt <= Date.now()
```

---

## Legendary ability (commit 6a4e9e2 + 8fd660d)

Speciální mechanika pro legendární koně, která nahrazuje jednorázové nitro.

- **Dostupnost:** Pouze pokud má racer příznak `isLegendary`.
- **Cooldown:** 2000 ms (opakovaně použitelné během jednoho závodu).
- **Stamina:** Použití nestojí žádnou stamina (legendary racer nemá `usedNitro` penalizaci).
- **Podmínka:** Funguje i při 0 stamina.
- **Kompatibilita:** Běžné nitro pro ne-legendární racery zůstává beze změny.
- **PvBot Guard:** V pvbot módu (lokální hra proti AI) nelze ovládat P2 legendary schopnost klávesou `S`.
- **PvP Authority:** V online duelu o úspěšném provedení legendary dash rozhoduje výhradně challenger (authority).

---

## Známá rizika / TODO

- **clearOfferPending není atomický compare** — `finishTurn` re-fetchuje pending a porovnává, ale není to DB transakce. Nízké riziko v praxi.
- **PvP input sync je experimentální** — defender vidí pvbot lokálně, ne synchronizovaný stav challengera. Výsledek je autoritativní challenger-side.
- **Refresh defendera během started** — overlay se znovu neotevře (chybí detekce při load). TODO.
- **SpeedArenaPvp a LegendaryRace** nemají `remoteP2Ref` hook — pouze neon_rope_duel je plně PvP.
- **Broadcast timeout/fallback** — není automatický timeout pokud defender nepřichází inputy. TODO.
- **Defender stamina** — zatím se neodečítá i v online_1v1 (TODO: `STABLE_DUEL_APPLY_BOT_STAMINA_LOSS`).
