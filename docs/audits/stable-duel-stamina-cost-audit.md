# Audit: Stamina cost v závodní minihře (Stable Duel / Neon Rope Duel)

Datum: 2026-06-15  
Stav: pouze analýza, bez fixu

---

## Shrnutí aktuálního stavu

Stamina systém je funkční, ale má dvě kritická problémy:

1. **Duplikované konstanty se RŮZNÝMI hodnotami** — `lib/minigame-nitro.ts` a `lib/minigames/settlement.ts` definují stamina costy zvlášť, přičemž se shodují jen base a crash, ale pro nitro se liší: UI ukazuje `−20`, ale reálný DB odečet je `−30`.

2. **Nitro cost je flat (boolean), ne per-use** — přestože Neon Rope Duel umožňuje použít nitro víckrát (cooldown-based, reusable), settlement dostane jen `usedNitro: boolean`. Cost je účtován max jednou za závod bez ohledu na to, kolikrát hráč nitro použil.

---

## Kde se co počítá a ukládá

### Konstanty — dvě místa, různé hodnoty

**`lib/minigame-nitro.ts`** — slouží pro **UI preview** (DuelArena, SpeedArena, SpeedArenaPvp)
```ts
export const NITRO_COST        = 20;  // ← zobrazení v UI
export const BASE_STAMINA_COST = 20;
export const CRASH_PENALTY     = 15;
```

**`lib/minigames/settlement.ts`** — slouží pro **reálný DB zápis**
```ts
export const STABLE_DUEL_BASE_STAMINA_COST   = 20;  // ← skutečný odečet
export const STABLE_DUEL_NITRO_STAMINA_COST  = 30;  // ← JINÁ hodnota než v UI!
export const STABLE_DUEL_CRASH_STAMINA_COST  = 15;
```

| Konstanta | UI preview (`minigame-nitro.ts`) | DB deduction (`settlement.ts`) |
|---|---|---|
| base / závod | 20 | 20 |
| nitro | **20** | **30** — nesoulad! |
| crash | 15 | 15 |

### Tracking nitro použití — boolean, ne počet

**`lib/duel/types.ts:17`**
```ts
readonly nitroUsed: boolean;  // "ever activated" — ne počet použití
```

**`lib/duel/simulate.ts:152`**
```ts
nitroUsed: state.p1.nitroUsed || p1CanActivate,  // true poprvé a zůstane true navždy
```

Nitro v Neon Rope Duelu je reusable (cooldown-based), ale stav `nitroUsed` se nastaví na `true` při první aktivaci a nikdy se nevrátí na `false`. Počet aktivací se nikde nesleduje.

**`lib/minigames/types.ts:8`** — výstupní interface z minihry
```ts
p1: {
  usedNitro: boolean;  // pouze boolean, bez počtu
  crashed:   boolean;
}
```

### Kde se stamina odečítá

**Jediný settlement path:** `app/components/GameBoard.tsx:2286` — `handleStableDuelFinish()`
```ts
const s = computeMinigameSettlement(result, ...);
// challenger:
const newStamina = Math.max(0, currentStamina - s.p1.stamina.total);
await supabase.from("players").update({ horses: updatedCHorses }).eq("id", challenger.id);
```

Settlement se volá:
- **V lokální hře:** vždy challenger (v hotseat = hráč na tahu)
- **V online hře:** challenger-only guard (řádek 2271), defender/spectator odečet přeskočí
- **Bot:** `STABLE_DUEL_APPLY_BOT_STAMINA_LOSS = false` → defender stamina NIKDY neubývá (flag v settlement.ts:9)

**`lib/minigames/settlement.ts` — `calcPlayer()`**
```ts
function calcPlayer(pr, coinsDelta): PlayerSettlement {
  const base  = STABLE_DUEL_BASE_STAMINA_COST;     // vždy 20
  const nitro = pr.usedNitro ? STABLE_DUEL_NITRO_STAMINA_COST : 0;  // 0 nebo 30
  const crash = pr.crashed   ? STABLE_DUEL_CRASH_STAMINA_COST : 0;   // 0 nebo 15
  return { coinsDelta, stamina: { base, nitro, crash, total: base + nitro + crash } };
}
```

### Celkové stamina costy aktuálně (skutečné DB hodnoty)

| Situace | Stamina cost |
|---|---|
| Závod bez nitra, bez crashe | **−20** |
| Závod + nitro (1× nebo 5×, je to jedno) | **−50** (20+30) |
| Závod + crash | **−35** (20+15) |
| Závod + nitro + crash | **−65** (20+30+15) |

### Kdy se stamina odečítá

- **Po skončení minihry** — v `handleStableDuelFinish` po přijetí výsledku z `onResult` callbacku
- Nikdy během minihry
- Nikdy v samotné `DuelArena` / `SpeedArena`

### `onResult` — kde se generuje výsledek

**`app/components/duel/DuelArena.tsx:215-226`**
```ts
React.useEffect(() => {
  if (state.status !== "idle" && state.status !== "running") {
    onResultRef.current?.({
      winner: ...,
      p1: { usedNitro: state.p1.nitroUsed, crashed: !state.p1.alive, score: state.p1.ticksAlive },
      p2: { usedNitro: state.p2.nitroUsed, crashed: !state.p2.alive, score: state.p2.ticksAlive },
    });
  }
}, [state.status]);
```

Dependency `[state.status]` → fireuje přesně jednou (status přejde z running → p1_win/p2_win/draw a zůstane).

### Crash definice

V Neon Rope Duelu: `crashed = !state.p1.alive` — hráč zemřel (narazil do zdi nebo do soupeřova laana). Vítěz může být `crashed = false`, poražený vždy `crashed = true` (kromě draw, kde oba crashed = true).

---

## Odpovědi na otázky z auditu

| Otázka | Odpověď |
|---|---|
| Kolik staminy stojí jedno použití nitra? | **30** (DB), ale UI ukazuje **20** — nesoulad |
| Odečítá se za každé použití, nebo jednou? | **Jednou** — `usedNitro` je boolean, opakované použití nestojí víc |
| Stamina penalty za samotný závod? | **Ano, vždy −20** (base cost) |
| Stamina penalty za crash? | **Ano, −15** pokud `crashed = true` |
| Kdy se odečítá? | **Po skončení**, v `handleStableDuelFinish()` |
| Bere se v úvahu výhra/prohra? | **Ne** — stamina cost je stejný pro vítěze i poraženého |
| Bere se v úvahu typ racera? | **Ne** |
| Rozdíl hráč vs bot? | **Ano** — bot (defender) stamina neubývá (`STABLE_DUEL_APPLY_BOT_STAMINA_LOSS = false`) |
| Rozdíl local vs online? | **Online:** challenger-only guard, defender nedostane odečet na svém klientu; **Local:** oba v jednom settlement call |

---

## Rizika

### Riziko 1 — Dvojité odečtení staminy

**Nalezeno:** NE. `handleStableDuelFinish` má:
- challenger-only guard v online módu (řádek 2271)
- `setStableDuelCtx(null)` a `stableDuelProceedRef.current = null` na začátku funkce — guard pro druhé volání

`onResult` fireuje jednou (dependency `[state.status]`). **Dvojité odečtení nehrozí v aktuálním kódu.**

### Riziko 2 — Opakovaný settlement při reloadu

**Potenciální riziko:** `handleStableDuelFinish` se volá z client-side React callbacku, ne ze serveru. Při reloadu stránky se `stableDuelCtx` ztratí a settlement se NEPROVEDE znovu. To znamená, že reload v průběhu settlementu může způsobit ztrátu výsledku (ne duplicitu). **Duplicate risk: nízký. Loss risk: střední.**

### Riziko 3 — Nesoulad UI vs DB pro nitro

**Nalezeno:** `lib/minigame-nitro.ts` říká −20 (UI preview), `lib/minigames/settlement.ts` odečítá −30 (DB). Hráč vidí jinou hodnotu než dostaně. Toto je aktivní bug v UX.

### Riziko 4 — Flat cost za reusable nitro

Neon Rope Duel má nitro s cooldownem, které lze použít víckrát. Stamina cost je flat (jednou −30 nebo 0) bez ohledu na 1 nebo 5 použití. Uživatel reportuje "4–5× boost za jeden závod" — to stojí pořád jen −30 staminy celkem.

---

## Doporučený minimální fix

### Krok 1 — Sjednotit konstanty (odstranit duplikaci)

Přesunout všechny stamina konstanty do `lib/minigames/settlement.ts` (autoritativní zdroj) a `lib/minigame-nitro.ts` z nich importovat:

```ts
// lib/minigames/settlement.ts — NOVÉ HODNOTY
export const STABLE_DUEL_BASE_STAMINA_COST   = 30;  // bylo 20
export const STABLE_DUEL_NITRO_STAMINA_COST  = 10;  // bylo 30 (per-use, pokud se změní tracking)
export const STABLE_DUEL_CRASH_STAMINA_COST  = 10;  // bylo 15

// lib/minigame-nitro.ts — IMPORT místo vlastních konstant
import { STABLE_DUEL_BASE_STAMINA_COST, STABLE_DUEL_NITRO_STAMINA_COST, STABLE_DUEL_CRASH_STAMINA_COST } from "./minigames/settlement";
export const BASE_STAMINA_COST = STABLE_DUEL_BASE_STAMINA_COST;
export const NITRO_COST        = STABLE_DUEL_NITRO_STAMINA_COST;
export const CRASH_PENALTY     = STABLE_DUEL_CRASH_STAMINA_COST;
```

### Krok 2 — Přidat počítání nitro použití (pokud chceme per-use cost)

Přidat `nitroCount: number` do `PlayerDuelState` (vedle `nitroUsed: boolean`) a do `MinigameResult`:

```ts
// lib/duel/types.ts
readonly nitroActivations: number;   // počet aktivací (0, 1, 2, ...)

// lib/minigames/types.ts
p1: { usedNitro: boolean; nitroActivations: number; crashed: boolean; }
```

Settlement pak použije:
```ts
const nitro = pr.nitroActivations * STABLE_DUEL_NITRO_STAMINA_COST;
```

Tato změna je větší (zasahuje simulate.ts, DuelArena.tsx, MinigameResult interface, settlement).

### Krok 3 — Cap crash penalty

Aktuálně crash je boolean → max jednou. Cap je de facto zadarmo. Pokud se architektura nemění, stačí jen změnit hodnotu konstanty.

### Doporučené cílové hodnoty

| Složka | Aktuálně (DB) | Navrhovaná hodnota |
|---|---|---|
| Base (závod) | 20 | **30** |
| Nitro | 30 flat (jednou) | **10 × počet použití** (nebo 20 flat pokud nechceme tracking) |
| Crash | 15 | **10** |
| Max za závod bez nitra: | 35 | 40 |
| Max za závod s nitrem 1× bez crashe: | 50 | 40 (30+10) |
| Max za závod s nitrem 5× bez crashe: | 50 | 80 (30+50) — nutný cap? |

Pokud chceme zůstat u flat (boolean) systému bez per-use trackingu, doporučená hodnota nitro = **20 flat** (jednou za závod, stejně jako base), aby celkový cost byl 50 s nitrem a 30 bez.

---

## Soubory a řádky

| Soubor | Řádky | Popis |
|---|---|---|
| `lib/minigame-nitro.ts` | 6–8 | UI preview konstanty (NITRO_COST=20, BASE=20, CRASH=15) |
| `lib/minigames/settlement.ts` | 6–8, 31–33 | DB settlement konstanty (BASE=20, NITRO=30, CRASH=15) |
| `lib/minigames/types.ts` | 7–9, 14–16 | MinigameResult — `usedNitro: boolean` bez počtu |
| `lib/duel/types.ts` | 17 | `nitroUsed: boolean` v PlayerDuelState |
| `lib/duel/simulate.ts` | 152, 165 | `nitroUsed = state.nitroUsed || p1CanActivate` |
| `app/components/duel/DuelArena.tsx` | 215–226 | `onResult` callback — sestavuje MinigameResult |
| `app/components/GameBoard.tsx` | 2263–2341 | `handleStableDuelFinish` — settlement + DB zápis |
| `app/components/GameBoard.tsx` | 2300–2305 | Challenger stamina odečet |
| `app/components/GameBoard.tsx` | 2307–2314 | Defender stamina (STABLE_DUEL_APPLY_BOT_STAMINA_LOSS flag) |
