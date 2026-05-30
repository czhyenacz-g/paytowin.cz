# Board-game engine — audit universalizace

Zpracováno: 2026-05-30

---

## 1. Shrnutí

PayToWin.cz má solidní základ pro universalizaci — Board, Economy a Theme jsou již oddělené
konfigurace. Největší coupling je v GameBoard.tsx (field efekty, rent výpočet) a v fixní sadě
CardEffect typů. Migrace na plně pluginovatelný engine je realistická po malých krocích, aniž by
bylo nutné rozbít aktuální gameplay.

Tento dokument mapuje aktuální stav, navrhuje cílový model a navrhuje bezpečný migrační plán.

---

## 2. Co bylo analyzováno

| Soubor / oblast | Popis |
|---|---|
| `lib/engine.ts` | buildFields, applyStartPassage, computeRent, applyRentPayment, resolveGiveRacer |
| `lib/types/game.ts` | Horse, Player, GameState, EconomyConfig, ActiveEffect |
| `lib/board/types.ts` | BoardConfig, BoardFieldConfig, BoardFieldType |
| `lib/themes/manifest.ts` | ThemeManifest, RacerConfig, ThemeColors |
| `lib/scenarios/types.ts` | ScenarioDefinition, ObjectiveCondition, WinCondition |
| `lib/cards.ts` | GameCard, CardEffect, CardEffectKind, CHANCE_CARDS, FINANCE_CARDS |
| `lib/minigames/selectStableMinigame.ts` | minigame selektor |
| `lib/game-constants.ts` | STARTING_COINS, STAMINA_PER_TAP, ROLL_CORRECTION_COST |
| `app/components/GameBoard.tsx` | field effect handling (~řádky 979–1237), rent výpočet |

---

## 3. Aktuální architektura — co je již abstrahováno

### ✅ Dobře odděleno (neměnit bez důvodu)

| Vrstva | Mechanismus | Soubor |
|---|---|---|
| Ekonomika hry | `EconomyConfig` JSONB per-game (stateSubsidy, baseTax, lapTaxCoefficient, maxTax) | `lib/types/game.ts` |
| Startovní coins | Preset Hard/Normál/Bohatý, uložen v `economy.startingCoins` | `lib/game-constants.ts` |
| Herní deska | `BoardConfig` odděluje strukturu; `buildFields` aplikuje závodníky | `lib/board/types.ts` |
| Theme / UI | `ThemeManifest` — labels, colors, assets, per-theme karty | `lib/themes/manifest.ts` |
| Scénáře | `ScenarioDefinition` — objectives, win conditions, intro texty | `lib/scenarios/types.ts` |
| Výběr minihry | `selectStableMinigame()` — čistá funkce bez side-effectů | `lib/minigames/selectStableMinigame.ts` |
| Per-theme karty | `ThemeManifest.cards` — override globálního balíčku | `lib/themes/manifest.ts` |

### ⚠️ Mezistav — abstrahováno, ale s mezerami

- **Win conditions**: definovány v `ScenarioDefinition.winCondition`, ale vyhodnocení je in-GameBoard (`handleStableDuelFinish`, `multiplayerWin` flagy). Podmínka `"last_player_standing"` není nikde explicitně čtena — je hardcoded jako default chování.
- **Year events**: `theme.yearEvents` jsou theme-driven, ale `resolveYearEvent()` se volá z GameBoard s `campaignOffset` = `player.laps`. Funguje, ale je to coupling přes abstrakci.
- **Field labely**: `theme.labels.legend` (gain/lose/gamble/racer) je v ThemeManifest, ale `FieldType` enum je pevně definován v engine a musí být synchronní s config.

---

## 4. Nalezené coupling body — hardcoded pravidla

### 4.1 Rent = 20 % (GameBoard.tsx ~řádek 1001)

```typescript
const rent = Math.floor(field.racer.price * 0.20);  // hardcoded
```

**Dopad**: Classic dostihový regime by mohl mít jiné nájemné (např. fixní tabulku dle pozice
skupiny, nebo progresivní dle počtu vlastněných polí ve skupině).

**Riziko změny**: Střední. `computeRent()` v `engine.ts` existuje ale není voláno — rent se
počítá znovu inline. Sjednocení by bylo čisté.

---

### 4.2 CardEffectKind — fixní union (lib/cards.ts)

```typescript
type CardEffectKind = "coins" | "skip_turn" | "move" | "give_racer" | "stamina_debuff"
```

**Dopad**: Classic dostihový režim by potřeboval efekty jako `"move_to_group"`, `"buy_upgrade"`,
`"distance_penalty"`, `"pay_all_players"`. Přidání nových efektů vyžaduje rozšíření union
+ case v GameBoard `applyCardEffectRef`.

**Riziko změny**: Střední. Union je TypeScript-level — rozšíření je bezpečné pokud stávající
case zůstane. Problém je, že vyhodnocení efektů je inline velký switch v GameBoard, ne
separátní engine.

---

### 4.3 Výpočet stamina při závodech (lib/engine.ts `computeRaceScore`)

```typescript
const staminaMultiplier = horse.isLegendary ? 1.0 : (currentStamina / maxStamina) * debuffFactor;
```

**Dopad**: Konkrétní vzorec (linear stam/max × debuff) je specifický pro PayToWin. Jiný
scénář by mohl mít jiné race scoring (čistě rychlost, nebo náhodný element).

**Riziko změny**: Nízké pro racing samotný — `computeRaceScore` je izolovaná funkce.

---

### 4.4 Minigame selektor — theme-type if-else (lib/minigames/selectStableMinigame.ts)

```typescript
if (anyLegendary) return "legendary_race";
if (themeContainsCar) return "neon_speedrace";
return "neon_rope_duel";
```

**Dopad**: Funkční pro 2 typy témat. Classic dostihový režim by mohl vždy vracet `"neon_rope_duel"`
nebo mít vlastní typ. Selektor by mohl číst z `ScenarioDefinition.defaultMinigame` nebo
`ThemeManifest.minigameType`.

**Riziko změny**: Nízké — izolovaná čistá funkce.

---

### 4.5 Field types — fixní enum (lib/board/types.ts + lib/engine.ts)

```typescript
type BoardFieldType = "start" | "coins_gain" | "coins_lose" | "gamble" | "racer" |
                      "neutral" | "chance" | "finance" | "mafia"
```

**Dopad**: Pro classic dostihový režim by byly potřeba typy jako `"upgrade"`, `"group_bonus"`,
`"service"`, `"stable"`. Nelze přidat bez změny union + buildFields + GameBoard handler.

**Riziko změny**: Vysoké. Field type enum je referenced na mnoha místech (GameBoard handler,
FieldStyleKey v ThemeColors, buildFields v engine, BoardConfig validation). Přidání nového
typeu je bezpečné (additive), ale vyžaduje koherentní update napříč vrstvami.

---

### 4.6 Win condition vyhodnocení — in-GameBoard (GameBoard.tsx ~řádek 2097–2120)

```typescript
const multiplayerWin = updatedPlayers.length >= 2 && activePlayers.length === 1;
// ↑ hardcoded "last player standing" — ScenarioDefinition.winCondition se nečte
```

**Dopad**: ScenarioDefinition má `winCondition: "last_player_standing" | "collect_all_available_racers"`,
ale `"collect_all_available_racers"` podmínka není implementována v GameBoard — jen v
scenario evaluatoru (pro startovní objectives, ne live win detection).

**Riziko změny**: Střední. Win condition is a high-stakes operation — jakákoli chyba zde
by způsobila předčasné nebo opomenuté ukončení hry.

---

### 4.7 AssetGroups / Stáje — neexistují

Aktuální model nemá koncept skupiny polí/stájí. `Horse` (OwnedRacer) nemá `groupId`.
`BoardFieldConfig` nemá `groupId` ani `groupColor`. Pro classic dostihový režim by to byl
zásadní přídavek.

**Dopad**: Nelze implementovat "vlastnění celé skupiny odemyká upgrade" bez nového datového
modelu.

**Riziko změny**: Vysoké pro DB schema (players.horses JSONB). Bezpečné jako additive optional
field (`groupId?: string`).

---

## 5. Doporučený cílový model

### 5.1 BoardScenario (rozšíření ScenarioDefinition)

```typescript
interface BoardScenario extends ScenarioDefinition {
  rules: ScenarioRules;
}

interface ScenarioRules {
  rentFormula: "percentage" | "fixed_table" | "group_progressive";
  rentPercentage?: number;              // default: 0.20
  groupBonusEnabled: boolean;           // stáje/skupiny
  upgradeEnabled: boolean;              // upgrade poles
  minigameOverride?: StableMinigameType; // force minigame type
  winCondition: ScenarioWinConditionType;
  cardDecks: Array<"chance" | "finance" | "mafia" | string>; // které balíčky
  diceRules?: DiceRules;
  startPassageRules?: StartPassageRules;
}
```

### 5.2 OwnableAsset + AssetGroup

```typescript
interface OwnableAsset extends Horse {
  groupId?: string;        // null = bez skupiny (PayToWin default)
  upgradeLevel?: number;   // 0 = základní, 1–4 = classic upgrade
}

interface AssetGroup {
  id: string;
  name: string;
  color: string;
  assetIds: string[];      // které závodníky patří do skupiny
  upgrades?: UpgradeRule[];
}

interface UpgradeRule {
  level: number;
  cost: number;
  rentMultiplier: number;
  label: string;
}
```

### 5.3 FieldDefinition (rozšíření BoardFieldConfig)

```typescript
interface FieldDefinition extends BoardFieldConfig {
  groupId?: string;          // pro classic stájový systém
  upgradeCapacity?: number;  // max upgrade level
  visitEffect?: FieldVisitEffect; // separace od FieldType pro vlastní efekty
}
```

### 5.4 EconomyRules (rozšíření EconomyConfig)

```typescript
interface EconomyRules extends EconomyConfig {
  rentPercentage: number;        // default 0.20, nyní hardcoded
  startingCoins: number;         // již implementováno ✓
  groupBonusMultiplier?: number; // bonus za vlastnění celé skupiny
  upgradeRentTable?: Record<number, number>; // přepis dle upgrade level
}
```

### 5.5 DiceRules

```typescript
interface DiceRules {
  sides: number;               // default 6
  rollCorrectionEnabled: boolean;
  rollCorrectionCost: number;  // default 600, nyní ROLL_CORRECTION_COST konstanta ✓
  rollCorrectionWindowMs: number; // default 4000 ✓
}
```

### 5.6 WinCondition (runtime evaluátor)

```typescript
type WinConditionEvaluator = (players: Player[], fields: Field[], scenario: BoardScenario) => {
  winnerId: string | null;
  reason: string;
} | null;

const WIN_CONDITIONS: Record<ScenarioWinConditionType, WinConditionEvaluator> = {
  "last_player_standing": evaluateLastPlayerStanding,
  "collect_all_available_racers": evaluateCollectAll,
};
```

### 5.7 CardEffect rozšíření

Stávající `CardEffectKind` union rozšířit additive (nezměnit stávající):

```typescript
type CardEffectKind =
  | "coins" | "skip_turn" | "move" | "give_racer" | "stamina_debuff"  // stávající
  | "move_to_group_field" | "pay_rent_to_all" | "buy_upgrade_free"    // budoucí
  | "distance_bonus" | "cancel_next_rent";                             // budoucí
```

---

## 6. Migrační plán po krocích

Každý krok je nezávislý a bezpečně rollbackovatelný.

---

### Krok 0 — Quick-wins (< 30 min, nulové riziko)

**Co**: Vyčlenit hardcoded hodnoty do pojmenovaných konstant.
- `0.20` (rent) → `RENT_PERCENTAGE = 0.20` do `lib/game-constants.ts`
- Volat `computeRent()` z `lib/engine.ts` (funkce existuje ale je nepoužívána)

**Soubory**: `lib/game-constants.ts`, `lib/engine.ts`, `GameBoard.tsx` (1 řádek)

**Riziko**: Velmi nízké — čistá konstanta substituce, žádná logická změna.

**Validace**: `npx tsc --noEmit`, vizuálně ověřit rent v lokální hře.

---

### Krok 1 — WinCondition evaluátor (nízké riziko)

**Co**: Implementovat `last_player_standing` jako pojmenovanou evaluátor funkci v `lib/scenarios/evaluator.ts`.
GameBoard ji zavolá místo inline podmínky.

**Soubory**: `lib/scenarios/evaluator.ts`, `GameBoard.tsx` (~3 řádky)

**Riziko**: Nízké — refaktor existující podmínky. Výsledek musí být identický.

**Validace**: `npx tsc --noEmit` + lokální hra s 2 hráči dohrát do konce.

---

### Krok 2 — `ScenarioRules.rentFormula` (střední riziko)

**Co**: Přidat `rules.rentFormula: "percentage"` do `ScenarioDefinition`.
`computeRent()` v engine čte `rentFormula` a `rentPercentage` místo hardcoded 0.20.
Aktuální PayToWin scénář má `rentFormula: "percentage", rentPercentage: 0.20`.

**Soubory**: `lib/scenarios/types.ts`, `lib/engine.ts`, `lib/scenarios/horse-day.ts`, `GameBoard.tsx`

**Riziko**: Střední — rent je klíčový pro herní ekonomiku. Chyba = špatný příjem z racerů.

**Validace**: `npx tsc --noEmit` + test rent platby v lokální hře (přistát na cizím raceru).

---

### Krok 3 — `BoardFieldConfig.groupId` (additive, nízké riziko)

**Co**: Přidat optional `groupId?: string` do `BoardFieldConfig` a `Horse`/`OwnableAsset`.
Žádná herní logika se ještě nemění — pole zůstane null pro PayToWin mapu.

**Soubory**: `lib/board/types.ts`, `lib/types/game.ts`

**Riziko**: Velmi nízké — additive optional field. Existující data nejsou ovlivněna.

**Validace**: `npx tsc --noEmit` — TypeScript nesmí hlásit chyby u existujícího kódu.

---

### Krok 4 — `AssetGroup` model a registr (nízké riziko)

**Co**: Definovat `AssetGroup` a `UpgradeRule` typy. Přidat `assetGroups?: AssetGroup[]`
do `ThemeManifest`. Přidat prázdný registr pro PayToWin téma.

**Soubory**: `lib/types/game.ts`, `lib/themes/manifest.ts`, theme soubory

**Riziko**: Velmi nízké — jen typy a prázdná data.

**Validace**: `npx tsc --noEmit`.

---

### Krok 5 — CardEffect rozšíření (nízké riziko, high-value)

**Co**: Přidat nové `CardEffectKind` hodnoty jako union members. Přidat handler case
do `applyCardEffectRef` (no-op nebo TODO pro nové typy). Stávající efekty beze změny.

**Soubory**: `lib/cards.ts`, `GameBoard.tsx` (switch rozšíření)

**Riziko**: Nízké — TypeScript union is additive, exhaustive check pomůže zachytit chybějící case.

**Validace**: `npx tsc --noEmit` + spustit kartu s každým stávajícím efektem.

---

### Krok 6 — Minigame selektor z config (nízké riziko)

**Co**: Přidat optional `defaultMinigame?: StableMinigameType` do `ScenarioDefinition`.
`selectStableMinigame()` ho preferuje před theme-based if-else.

**Soubory**: `lib/scenarios/types.ts`, `lib/minigames/selectStableMinigame.ts`

**Riziko**: Nízké — fallback na stávající logiku pokud není nastaveno.

**Validace**: `npx tsc --noEmit` + ověřit že duel spustí správnou minihru.

---

### Krok 7 — `ScenarioRules.winCondition` runtime evaluátor (střední riziko)

**Co**: Implementovat `"collect_all_available_racers"` evaluátor. Napojit
`WIN_CONDITIONS[scenario.winCondition](...)` do GameBoard win detection.

**Soubory**: `lib/scenarios/evaluator.ts`, `GameBoard.tsx` (~10 řádků)

**Riziko**: Střední — win detection je kritická. `"last_player_standing"` musí zůstat identické.

**Validace**: Lokální hra s 2 hráči dohrát do konce. Unit test evaluátoru pokud existuje test setup.

---

### Krok 8 — DiceRules config (nízké riziko)

**Co**: Přidat `DiceRules` do `ScenarioRules`. GameBoard čte `diceRules.rollCorrectionCost`
místo `ROLL_CORRECTION_COST` konstanty. Default zůstane `ROLL_CORRECTION_COST`.

**Soubory**: `lib/scenarios/types.ts`, `GameBoard.tsx` (3 řádky)

**Riziko**: Nízké — hodnota se nespustí změnou, jen přesune zdroj.

**Validace**: Ověřit že korekce hodu stojí správně (600 coins v PayToWin scénáři).

---

### Krok 9 — Nový BoardFieldType (vysoké riziko, dělat naposledy)

**Co**: Přidat nové typy polí (`"upgrade"`, `"service"`, `"stable"`) do `BoardFieldType` union.
Přidat handler case v `GameBoard.tsx`. Přidat `fieldStyles` klíče do `ThemeColors`.

**Soubory**: `lib/board/types.ts`, `lib/engine.ts`, `lib/themes/manifest.ts`, `GameBoard.tsx`

**Riziko**: Vysoké — field type je referenced na mnoha místech. Postupovat jen po kompletním
dokončení kroků 1–8.

**Validace**: `npx tsc --noEmit` + ověřit že existující PayToWin mapa funguje beze změny
(nové typy nesmí ovlivnit existující mapy).

---

## 7. Rizika

### Globální rizika

| Riziko | Pravděpodobnost | Dopad | Mitigace |
|---|---|---|---|
| Rozbití rent logiky | Střední | Vysoký (ekonomika) | Krok 0 musí být výsledkově identický |
| Win condition false-positive | Nízká | Kritický | Krok 1+7: výsledek musí být identický před merge |
| DB JSONB inkompatibilita | Nízká | Střední | Additive optional fields v JSONB jsou zpětně compat |
| Racing engine side-effects při refaktoru | Střední | Střední | Izolovat každý krok; neprovádět kroky 1-9 najednou |
| TypeScript exhaustive check failures | Nízká | Nízký | tsc --noEmit po každém kroku |

### Co záměrně NENÍ v tomto plánu

- Multiplayer sync (Supabase Realtime) — zůstává beze změny
- DB schema migration — všechny návrhy jsou additive (optional fields), nevyžadují migraci
- Bot strategie — boti drží PayToWin pravidla; universalizace bota je samostatný projekt
- Classic dostihový režim implementation — tento audit je jen příprava cesty

---

## 8. Doporučené pořadí implementace

```
Krok 0 (quick-wins)
  ↓
Krok 3 + 4 (additive typy, bezpečné)
  ↓
Krok 1 (win condition evaluátor — low risk, high value)
  ↓
Krok 5 + 6 (card + minigame config)
  ↓
Krok 2 (rent formula — ověřit ekonomiku)
  ↓
Krok 7 (win condition runtime, až po Kroku 1 je otestovaný)
  ↓
Krok 8 (dice rules)
  ↓
Krok 9 (nové field types — pouze před zahájením classic mode)
```

---

## 9. Quick-wins pro nejbližší sprint (bez dopadu na gameplay)

1. **Vyčlenit rent 0.20 na konstantu** a volat `computeRent()` — 15 min, nulové riziko
2. **Přidat `BoardFieldConfig.groupId?: string`** — 5 min, additive only
3. **Přidat `ScenarioDefinition.defaultMinigame?: StableMinigameType`** — 10 min, fallback zůstane
4. **Implementovat `last_player_standing` jako pojmenovanou funkci** — 30 min, identická logika
