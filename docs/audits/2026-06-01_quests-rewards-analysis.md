# Audit: Questy a odměny — PayToWin.cz

**Datum:** 2026-06-01  
**Typ:** Read-only audit, žádné změny kódu.

---

## 1. Kde jsou questy/úkoly definované?

### Typy (`lib/scenarios/types.ts`)

```typescript
// Osobní úkol (každý hráč dostane jiný)
interface PersonalObjectiveDefinition {
  id: string;
  title: string;
  story: string;
  task: string;
  rewardLabel: string;    // pouze text pro UI, ne skutečná hodnota odměny
  condition?: ObjectiveCondition;  // volitelné — 4 z 5 úkolů ji nemají
}

// Sdílený úkol (vidí všichni, zvítězí první kdo splní)
interface SharedObjectiveDefinition {
  id: string;
  title: string;
  story: string;
  task: string;
  rewardLabel: string;
  rewardCoins?: number;   // DEFINOVÁNO, ale NIKDY nevyplaceno
  completionMode?: "first_player_only";
  condition?: ObjectiveCondition;
}

// Podmínka splnění
type ObjectiveCondition = {
  type: "owns_at_least_racers";
  count: number;
}
// Aktuálně implementovaný jediný typ podmínky.
```

### Scénáře

**`lib/scenarios/horse-day.ts`** — scénář pro mapu "Denní dostihy":
- 1 **sdílený úkol**: `first-stable-collector` — "mít jako první 2 závodníky" → odměna 5000 coinů (NENAPLNĚNO)
- 5 **osobních úkolů** (každý hráč dostane jeden dle `turn_order % 5`):

| ID | Název | Podmínka | Vyhodnotitelné? |
|---|---|---|---|
| `stable-collector` | Stabilní sběratel | owns 3 racers | ✅ ANO |
| `mafia-debt` | Mafijský dluh | aktivuj 3 mafia karty | ❌ NE |
| `quiet-favorite` | Tichý favorit | vyhraj závod + neprodal závodníka | ❌ NE |
| `last-dollar` | Poslední dolar | drž posledního závodníka | ❌ NE |
| `dirty-money` | Špinavé peníze | měj 20 000 coinů | ❌ NE |

**`lib/scenarios/horse-night.ts`** — scénář "Noční dostihy":
- Má win condition `"collect_all_available_racers"` (sebrání všech závodníků z desky)
- **Žádné osobní ani sdílené úkoly** — objectives pole prázdné.

---

## 2. Kdy a kde se kontroluje splnění úkolu?

### Výhradně na konci hry (snapshot-based)

Hodnocení probíhá v `app/components/GameBoard.tsx` (řádky 1891–1910) při detekci konce hry:

```typescript
// GameBoard.tsx — game end handler
const scenarioWin = evaluateScenarioWinCondition({ scenario, players, fields });
if (multiplayerWin || soloLoss || scenarioWin.winnerId) {
  setGameStatus("finished");
  awardXpAction(gameId).catch(() => {});
  awardWinStarAction(gameId).catch(() => {});
  awardMoneySpentAction(gameId).catch(() => {});
  // ← ŽÁDNÉ volání pro objective rewards
}
```

**`lib/scenarios/evaluator.ts`** — vyhodnocuje splnění podmínek ze snapshotu stavu hráče:
- `evaluatePersonalObjectiveForPlayer()` — vrátí výsledek pro konkrétního hráče
- `evaluateSharedObjectiveForPlayers()` — najde prvního hráče (dle turn_order), který splnil sdílený úkol
- Pokud úkol nemá `condition` → vrátí `completed: false` + "Podmínka není strojově vyhodnotitelná"

**Vyhodnocení probíhá v `GameFinishedScreen.tsx`** (ne v server action), čistě pro zobrazení výsledku na konci hry.

### NENÍ průběžná kontrola

Úkoly se **nekontrolují v průběhu hry** (např. po každém tahu nebo při koupi závodníka). Vše je retrospektivní snapshot při game over.

---

## 3. Splní se úkol okamžitě, po tahu, nebo po dokončení hry?

**Po dokončení hry** — výhradně. Snapshots ze stavů hráčů.

---

## 4. Je splnění jednorázové nebo opakované?

**Navrženo jako jednorázové**, ale **bez jakéhokoli mechanismu ochrany** — žádný guard, žádný záznam v DB, žádný flag "already_rewarded". Splnění se po hře zobrazí, ale nic se neuloží.

---

## 5. Ukládá se stav splnění někam trvale?

**NE.** Žádná trvalá persistence splnění úkolů.

- Tabulka `user_profiles` neobsahuje žádný sloupec pro úkoly.
- Tabulka `games` nemá `objective_rewards_awarded` flag.
- Výsledek hodnocení vznikne jen v `GameFinishedScreen.tsx` v paměti klienta a po refreshi zmizí.

---

## 6. Je splnění navázané na konkrétní hru, nebo na profil?

**Ani jedno** — splnění se zobrazí jako UI výsledek po hře, ale neukládá se ani ke hře, ani k profilu hráče.

---

## 7. Existuje už nějaký reward systém?

**Ano, ale pro jiné věci** — objectives do něj nejsou zapojeny.

### Co funguje (`app/game/actions.ts`)

| Akce | Co dělá | Guard |
|---|---|---|
| `awardXpAction()` | XP_BASE (50) + XP_WINNER (100) za vítězství | `games.xp_awarded` boolean |
| `awardRaceStarAction()` | +1 hvězdička za vyhraný závod | `game_state.race_stars_awarded` pole |
| `awardWinStarAction()` | +1 win star za vítězství proti ≥2 lidem | `games.win_stars_awarded` boolean |
| `awardMoneySpentAction()` | Kumuluje utracenou herní měnu do profilu | `games.money_spent_awarded` boolean |

### Tabulka `user_profiles`

```sql
discord_id       TEXT PRIMARY KEY
xp_total         INTEGER
wins_total       INTEGER
stars_total      INTEGER   -- za závody
win_stars_total  INTEGER   -- za výhry vs živí hráči
money_spent_total INTEGER
```

Vše jde přes RPC `increment_xp_and_wins()` na Supabase.

### Co NEFUNGUJE — objective rewards

- `SharedObjectiveDefinition.rewardCoins` je definováno (5000 Kč za "první-stable-collector")
- `ObjectiveEvaluationResult.rewardCoins` je vyplněno v evaluatoru
- Ale nikde se tento výsledek nečte — hodnota se zahodí bez vyplacení

---

## 8. Pokud hráč splní úkol, co dostane dnes?

**Dnes:** pouze vizuální potvrzení v `ObjectiveResultPanel.tsx` na konci hry — "✓ Splněno" nebo "✗ Nesplněno" s textem důvodu a `rewardLabel` textem.

**Nic jiného neobdrží** — žádné coiny, žádné XP, žádné hvězdičky, žádný permanentní záznam.

---

## 9. Kde by bylo nejbezpečnější doplnit reward?

### Bezpečné místo: `app/game/actions.ts` — nová server action `awardObjectiveRewardsAction()`

Vzor ze stávajícího `awardXpAction()`:
1. Server action přijme `gameId`
2. Fetchne players + game + scenario
3. Vyhodnotí objectives (serverside)
4. Zkontroluje guard (`games.objective_rewards_awarded`)
5. Pokud nesplněno → zapíše guard a vyplatí coins / XP / hvězdičky

Guard je potřeba přidat jako nový sloupec do `games` tabulky přes migraci.

### Bezpečné místo v game flow: `GameBoard.tsx` řádek ~1903

Vedle stávajících `awardXpAction`, `awardWinStarAction` přidat:
```typescript
awardObjectiveRewardsAction(gameId).catch(() => {});
```

---

## 10. Rizika zneužití (farming)

| Riziko | Závažnost | Popis |
|---|---|---|
| **Farming proti botům** | 🔴 VYSOKÉ | Bot hra je rychlá, levná a předvídatelná — hráč může opakovaně plnit "stable-collector" proti botovi |
| **Bez guardu = dvojnásobek** | 🟠 STŘEDNÍ | Pokud se reward spustí bez DB guardu, hráč refresh stránky = double reward |
| **Coin reward v single-player** | 🟡 NÍZKÉ | Coiny platí jen v dané hře — po game over nemají hodnotu (hra skončila) |
| **XP/hvězdičky bez omezení** | 🟠 STŘEDNÍ | Pokud dostane XP za splnění úkolu i v bot hře, farming XP je triviální |

### Ochrana proti farmingu

Pokud se přidá **profil-level reward** (XP, hvězdičky):
- Podmínit výplatou na `hasHumanOpponent` flag (≥ 1 živý Discord hráč)
- Vzor existuje v `awardWinStarAction()` — vyžaduje `humanPlayers.length >= 2`

---

## 11. Navrhované varianty odměn

### A) Pouze vizuální potvrzení / achievement toast
- **Výhody:** Nulová implementace, nulové riziko
- **Nevýhody:** Žádná motivace ke splnění, prázdný příslib
- **Rizika:** Žádná
- **Složitost:** Existuje už dnes (ObjectiveResultPanel)
- **Vhodné pro MVP:** ✅ Ano, ale je to "už dnes stav"

### B) Peněžní odměna do aktuální hry (coins)
- **Výhody:** Snadná implementace, coiny fungují v DB, vzor existuje
- **Nevýhody:** Po konci hry nemají hodnotu — hráč je nedostane "do kapsy"; coiny by musely přijít PŘED game over
- **Rizika:** Pokud se proplácí serverside až po game-over, hráč coins nevidí
- **Složitost:** Střední — potřeba server action + guard + vyplacení před game-end
- **Vhodné pro MVP:** ⚠️ Podmíněně — jen pokud se vyplatí BĚHEM hry (ne po)

### C) XP do profilu
- **Výhody:** Jednoduchá implementace (volat `increment_xp_and_wins()` s extra XP), viditelné v profilu
- **Nevýhody:** Farming riziko bez ochrany
- **Rizika:** Bez `hasHumanOpponent` guardu = snadný farming
- **Složitost:** Nízká — 1 server action, 1 DB guard sloupec
- **Vhodné pro MVP:** ✅ Ano, s farming ochranou

### D) Hvězdička / medaile do profilu
- **Výhody:** Vizuálně zajímavé, dobré pro gamifikaci, existuje `stars_total`
- **Nevýhody:** Stejné farming riziko jako XP; `stars_total` a `win_stars_total` jsou oddělené — kam přidat objective stars?
- **Rizika:** Farming, nejasnost kam hvězdičky dát
- **Složitost:** Střední — potřeba nový sloupec `objective_stars_total` nebo repurpose `stars_total`
- **Vhodné pro MVP:** ⚠️ Podmíněně — závisí na tom, co hvězdičky budou znamenat

### E) Odemčení mapy/kosmetiky
- **Výhody:** Nefarmilovatelné (jednorázové), přirozená motivace
- **Nevýhody:** Potřeba systém pro "odemčená" — žádný základ neexistuje; velká implementace
- **Rizika:** Komplexita, risk regrese
- **Složitost:** Vysoká — LIVE_UNLOCKED_ACCESS v MapMenuStrip je hardcoded
- **Vhodné pro MVP:** ❌ Ne teď

### F) Kombinace: malá herní odměna + profilový progress ⭐ DOPORUČENO
- Při splnění sdíleného úkolu (first-stable-collector): +XP do profilu (pouze vs živí hráči)
- `rewardCoins` z definice (5000 Kč) přidat jako coins v DB PŘED game-over, nebo jako bonus XP
- Zobrazit v ObjectiveResultPanel konkrétní hodnotu, ne jen label
- **Výhody:** Smysluplné, rozšiřitelné, bezpečné s guardem
- **Nevýhody:** Potřeba migrace + server action
- **Složitost:** Střední
- **Vhodné pro MVP:** ✅ Ano

---

## 12. Doporučený nejmenší další krok

### Cíl: Vyplatit sdílený úkol `first-stable-collector` — 5000 coinů vítězi

**Proč tento úkol jako první:**
- Jako jediný má `rewardCoins` definované (5000)
- Evaluátor vrací výsledek správně včetně `rewardCoins`
- Je strojově vyhodnotitelný (`owns_at_least_racers: 2`)
- Má jediného vítěze (`first_player_only`) — eliminuje edge cases

**Co je potřeba implementovat:**

#### Krok 1: Migrace (nový sloupec)
```sql
ALTER TABLE games ADD COLUMN objective_rewards_awarded boolean NOT NULL DEFAULT false;
```

#### Krok 2: Server action `awardObjectiveRewardsAction()`
```typescript
// app/game/actions.ts
export async function awardObjectiveRewardsAction(gameId: string) {
  // 1. Fetch game + players + scenario
  // 2. Zkontroluj guard: if (game.objective_rewards_awarded) return;
  // 3. Nastav guard ihned (optimisticky)
  // 4. Vyhodnoť shared objectives
  // 5. Najdi vítěze (completed + rewardCoins)
  // 6. Přičti coins k hráči v DB (players.coins += rewardCoins)
  // 7. Zapiš log entry do game_state.log
}
```

#### Krok 3: Zavolat v GameBoard.tsx při game end
```typescript
// Vedle stávajících awardXpAction, awardWinStarAction
awardObjectiveRewardsAction(gameId).catch(() => {});
```

#### Krok 4: Zobrazit konkrétní hodnotu v ObjectiveResultPanel
Místo jen `rewardLabel` textu zobrazit "💰 +5 000 Kč" pokud `rewardCoins` existuje.

**Implementační rizika:**
- Coins se proplácí po game-over — hráč je vidí jen ve výsledkovém panelu, ne v hře
- Farming: tento úkol je v rámci jedné hry (coiny), ne profilu → farming nemá smysl (hra skončila)

---

## 13. Rozhodnutí, která musí udělat člověk

1. **Mají objective rewards jít do profilu (trvalé XP/hvězdičky) nebo jen do aktuální hry (coiny)?**
   - Profil → potřeba farming protection (hasHumanOpponent guard)
   - Aktuální hra → jednodušší, ale coins po game-over mají nulovou hodnotu

2. **Mají se farmerské hry (bot-only) počítat pro objective rewards?**
   - Pokud NE → přidat `hasHumanOpponent` check (jako v `awardWinStarAction`)
   - Pokud ANO → jednodušší, ale vystavuje systém farmingu

3. **Mají se newyhodnotitelné úkoly (mafia-debt, quiet-favorite, last-dollar, dirty-money) dostat vlastní podmínku?**
   - Tyto podmínky nelze kontrolovat ze snapshotu — potřebují průběžný tracking během hry
   - Komplexnější implementace, zatím je to záměrně vynecháno

4. **Co má být `rewardLabel` u personal úkolů?**
   - Nyní říká "výsledek se ukáže po hře" — vyhnutí se slibu odměny
   - Pokud se přidá odměna, co konkrétně to bude?

5. **Kde se zobrazí splněné úkoly po hře — jen GameFinishedScreen nebo i trvalý achievement log?**
   - Trvalý log = nová tabulka v DB, větší implementace

---

## 14. Přehled klíčových souborů

| Soubor | Role |
|---|---|
| `lib/scenarios/types.ts` | Typy: PersonalObjective, SharedObjective, Condition, EvaluationResult |
| `lib/scenarios/horse-day.ts` | Definice 5 osobních + 1 sdílený úkol |
| `lib/scenarios/horse-night.ts` | Scénář bez úkolů, jen win condition |
| `lib/scenarios/evaluator.ts` | Vyhodnocení podmínek (snapshot-based) |
| `lib/scenarios/objectives.ts` | Přiřazení úkolů hráčům (turn_order deterministic) |
| `lib/scenarios/win-conditions.ts` | Scénářové win conditions |
| `app/components/start-flow/StartFlowOverlay.tsx` | Phase machine: intro → kontrakt → dismiss |
| `app/components/start-flow/PersonalObjectiveOverlay.tsx` | UI osobního kontraktu před hrou |
| `app/components/start-flow/SharedObjectiveOverlay.tsx` | UI sdíleného kontraktu před hrou |
| `app/components/board/GameFinishedScreen.tsx` | Vyhodnocení + zobrazení výsledku na konci hry |
| `app/components/board/ObjectiveResultPanel.tsx` | Karta s výsledkem (✓/✗ + reason + rewardLabel) |
| `app/game/actions.ts` | Existující reward akce (XP, stars, spend) |
| `app/components/GameBoard.tsx` (řádky ~1891–1910) | Spouštění reward akcí při game end |

---

## 15. Shrnutí

Systém úkolů je z **50 % hotový**:

✅ **Funguje:**
- Definice úkolů a typy
- Přiřazení úkolů hráčům (deterministické)
- Vyhodnocení na konci hry (stable-collector)
- UI pro zobrazení úkolů před a po hře
- Sdílený úkol s `first_player_only` módem

❌ **Nefunguje / není implementováno:**
- Vyplacení `rewardCoins` za sdílený úkol (5000 Kč definováno, evaluováno, ale zahozeno)
- Odměny za osobní úkoly (žádná datová struktura)
- Guard proti dvojímu vyplacení
- 4 z 5 osobních úkolů nemají vyhodnotitelnou podmínku
- Žádná trvalá persistence splnění
