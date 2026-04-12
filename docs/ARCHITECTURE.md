# Architektura — paytowin.cz

## Vrstvy

```
app/components/          ← React komponenty (UI)
  GameBoard.tsx            hlavní herní deska (orchestrátor)
  modals/
    CenterEventModal.tsx   sjednocený overlay pro všechny herní eventy (card + offer)

features/                ← doménové vstupy (re-exporty, budoucí logika per doméně)
  game/index.ts            herní logika (engine, typy)
  cards/index.ts           karty Náhoda / Finance
  offers/index.ts          nabídky (reroll, budoucí)
  themes/index.ts          theme systém

lib/
  types/
    game.ts                centrální herní typy (Horse, Player, GameState, OfferPending)
    events.ts              CenterEvent view model (card | offer)
  engine.ts                čisté herní funkce (bez Reactu, bez Supabase)
  repository.ts            všechna Supabase volání — UI je NEVOLÁ přímo
  cards.ts                 definice karet Náhoda / Finance + drawCard()
  board/                   ← datový kontrakt herní desky (BoardConfig)
    types.ts                 BoardPresetId, BoardFieldType, BoardFieldConfig, BoardConfig
    presets.ts               SMALL_BOARD — officiální preset 21 polí
    validator.ts             validateBoardConfig, validateThemeManifest, crossCheckBoardAndTheme
    index.ts                 getBoardById() loader + re-exporty
  themes/                  vizuální + content theme systém
    index.ts                 Theme, ThemeColors, ThemeLabels, ThemeAssets, ThemeContent
    manifest.ts              ThemeManifest v1 + themeToManifest() adapter
    default.ts, dark.ts, classic-race.ts
  supabase.ts              singleton Supabase client
  database.types.ts        typy DB schématu
```

## Pravidla

| Pravidlo | Důvod |
|---|---|
| `lib/engine.ts` neimportuje React ani Supabase | testovatelnost, čistá logika |
| `lib/repository.ts` je jediné místo kde se volá `supabase.*` | snadná výměna backendu |
| Typy `Player`, `Horse`, `GameState` importuj z `lib/types/game.ts` | jediný zdroj pravdy |
| `CenterEvent` view model odděluje data od renderu | modal neví o herní logice |
| UI texty jen v `theme.labels` — hardcode zakázán | téma může lokalizovat texty |
| `features/*` jsou vstupní body per doméně | postupná migrace bez big bang refaktoru |

## Center Event System

Všechny herní eventy zobrazované přes overlay procházejí jedním systémem:

```
game_state (DB)
  card_pending / offer_pending
        ↓
  mapToCenterEvent()          ← GameBoard.tsx helper
        ↓
  CenterEvent (view model)    ← lib/types/events.ts
        ↓
  CenterEventModal            ← app/components/modals/CenterEventModal.tsx
```

**CenterEvent** je union typ:
- `{ type: "card"; cardType, category, emoji, playerName, text, effectLabel }`
- `{ type: "offer"; playerName, playerCoins, cost, canConfirm, isActivePlayer }`

**CenterEventModal** přijímá `event: CenterEvent` + optional `onConfirm/onDecline` callbacks.
Renderuje různé varianty podle `event.type` — sdílí wrapper, animaci, overlay.

**Přidání nového event typu** (např. bankrot, výhra):
1. Rozšiř `CenterEvent` union v `lib/types/events.ts`
2. Přidej branch do `mapToCenterEvent` v `GameBoard.tsx`
3. Přidej render větev do `CenterEventModal.tsx`

## Racer systém — proč "racer", ne "horse"

Engine a theme systém používají pojem **racer** místo horse, aby projekt nebyl svázaný
s jedním typem závodníka. Theme **určuje**, jak se racer v UI nazývá:

| Theme | racer | racers | racerField |
|---|---|---|---|
| Dostihy (default, dark, classic-race) | "Kůň" | "Koně" | "Stáj" |
| Auta (budoucí) | "Auto" | "Auta" | "Garáž" |
| Mořští koníci (budoucí) | "Mořský koník" | "Mořští koníci" | "Přístav" |

UI čte `theme.labels.racer` / `theme.labels.racers` / `theme.labels.racerField` —
žádný hardcoded text "kůň" v komponentách.

**Kompatibilitní most pro legacy `horses`:**
```ts
// Nikdy nečti theme.horses přímo — vždy přes helper:
getThemeRacers(theme)
// → theme.racers  (nový kanonický zdroj)
// → theme.horses  (legacy fallback — staré theme soubory)
// → []            (prázdné, pokud theme není nakonfigurovaný)
```

**Poznámka o DB:** DB sloupec `players.horses` a `game_state.horse_pending` zachovávají
původní název — přejmenování by vyžadovalo DB migraci. Interně v kódu engine používá
`racers`, DB vrstva zůstává `horses`.

## Theme systém

Každý theme definuje tyto vrstvy:

| Vrstva | Typ | Účel |
|---|---|---|
| `colors` | `ThemeColors` | Tailwind třídy pro vizuální prvky |
| `labels` | `ThemeLabels` | UI texty + racer terminologie |
| `racers` | `RacerConfig[]` | závodníci theme (4 kusů, mapování na pevné pozice) |
| `horses?` | `RacerConfig[]` | @deprecated — legacy fallback, stále funguje |
| `assets?` | `ThemeAssets` | Obrázky — boardBg, racerImages (+ horseImages legacy) |
| `content?` | `ThemeContent` | Vlastní karty (připraveno, zatím nepoužíváno) |

**RacerConfig** (kanonický typ, nahradil `HorseConfig`):
```ts
interface RacerConfig {
  id: string; name: string; speed: number; price: number;
  emoji: string;   // vždy k dispozici
  image?: string;  // přímý obrázek — theme builder vyplní
}
// HorseConfig = RacerConfig  (legacy alias, stále funguje)
```

**Racer image fallback (3 úrovně):**
```ts
resolveRacerDisplay(racer, theme.assets?.racerImages ?? theme.assets?.horseImages)
// 1. racerImages[racer.id] — z theme assets
// 2. (budoucí: racer.image přímý obrázek v config)
// 3. racer.emoji — vždy dostupný fallback
```

**Field type "racer":**
`buildFields()` generuje pole s `type: "racer"` (nahradilo `"horse"`).
`"horse"` zůstává v `FieldStyleKey` jako deprecated alias — všechny theme soubory
definují obě hodnoty se stejným stylem pro zpětnou kompatibilitu.

**ThemeContent** (připraveno pro theme builder):
```ts
content?: {
  cards?: { chance?: GameCard[]; finance?: GameCard[]; }
}
```

`buildFields(getThemeRacers(theme))` v `lib/engine.ts` sestaví 21 polí desky.

## Datový tok

```
Uživatel klikne "Hoď kostkou"
        ↓
GameBoard.rollDice()
        ↓  herní logika
lib/engine.ts (buildFields, getStartTax, isBankrupt, …)
        ↓  zápis do DB
lib/repository.ts → Supabase DB
        ↓  Realtime postgres_changes
GameBoard useEffect (subscription)
        ↓  normalizace
engine.normalizePlayer / normalizeState
        ↓  view model
mapToCenterEvent → CenterEvent
        ↓  render
CenterEventModal (card | offer)
```

## Sdílený stav (game_state tabulka)

| Pole | Typ | Účel |
|---|---|---|
| `current_player_index` | int | kdo je na tahu |
| `horse_pending` | bool | čeká se na nákup koně |
| `card_pending` | JSONB | aktivní karta (sdílená přes Realtime) |
| `offer_pending` | JSONB | aktivní nabídka rerollu |
| `turn_count` | int | čítač tahů (pro výpočet kola a daně za START) |
| `log` | JSONB (string[]) | posledních 20 zpráv logu |

## Klíčové patterny

**fieldsRef** — `React.useRef<Field[]>` aktualizovaný každý render; Realtime handlery čtou
`fieldsRef.current` aby nevznikaly stale closures.

**cardAppliedRef / offerAcceptedRef** — ochrana před dvojím spuštěním efektu při re-renderu
nebo paralelním příjmu Realtime update.

**canReroll** — lokální stav; při `triggerOffer` se kontroluje `!canReroll` aby se nenabídl
druhý hod znovu během rerollu.

## features/ — doménová struktura

```
features/
  game/     → lib/engine.ts + lib/types/game.ts
  cards/    → lib/cards.ts
  offers/   → lib/types/game.ts (OfferPending) + lib/engine.ts (konstanty)
  themes/   → lib/themes/*
```

Aktuálně jsou `features/*` jen re-exporty. Jak doméno-specifická logika roste,
přesouvá se sem — bez zasahování do ostatních domén.

**Příklad budoucího rozšíření:**
- `features/game/race.ts` — logika závodů
- `features/game/bankruptcy.ts` — bankrotní procedury
- `features/offers/types.ts` — nové typy nabídek

---

## Engine vs Board vs Theme — oddělení zodpovědností

| Vrstva | Co obsahuje | Co NEOBSAHUJE |
|---|---|---|
| **Engine** (`lib/engine.ts`) | dice, pohyb, bankrot, skip_turn, normalize*, REROLL_*, getStartTax | coin amounts, typy polí, racer sloty |
| **BoardConfig** (`lib/board/`) | fieldCount, typy polí, pořadí, coin amounts, racer sloty | barvy, texty, závodníci, obrázky |
| **ThemeManifest** (`lib/themes/manifest.ts`) | meta, labels, colors, racers, assets, cards | engine logika, počet polí, coin amounts |

**Tok dat:**
```
BoardConfig + RacerConfig[] → buildFields() → Field[] → herní runtime
ThemeManifest               → colors, labels, racers, cards
```

**Proč toto oddělení:**
- Engine se nemění při přidání nového board presetu
- Deska se nemění při přidání nového theme
- Theme builder bude pracovat pouze s ThemeManifest — nemusí znát engine
- Board builder bude pracovat pouze s BoardConfig — nemusí znát vizuál

---

## ThemeManifest v1

`ThemeManifest` je formalizovaný datový kontrakt pro theme — připraven pro theme builder.

```ts
interface ThemeManifest {
  meta:    { id, name, description, version, author?, isPaid?, priceCzk? }
  labels:  { gameName, start, gain, loss, hazard, chance, finance,
             racer, racers, racerField, bankrupt }
  colors:  ThemeColors
  racers:  RacerConfig[]           // povinné, min. 1
  assets?: { boardBackgroundImage?, racerImages? }
  cards?:  { chance: GameCard[], finance: GameCard[] }
  supportedBoards?: Array<"small" | "large">
  tone?:   { style?: "neutral" | "funny" | "satirical" | "cute" | "dark" | "retro" }
}
```

**Stávající themes nejsou přepsány.** Adapter `themeToManifest(theme)` převádí `Theme → ThemeManifest`:
- `theme.labels.themeName` → `manifest.labels.gameName`
- `theme.labels.legend.*` → `manifest.labels.gain/loss/hazard`
- `getThemeRacers(theme)` → `manifest.racers` (respektuje horses fallback)
- `theme.assets.horseImages` + `theme.assets.racerImages` → sloučeno do `manifest.assets.racerImages`
- `theme.content?.cards` → `manifest.cards`

**Použití:**
```ts
import { themeToManifest, getThemeById } from "@/lib/themes";
const manifest = themeToManifest(getThemeById("default"));
```

---

## BoardConfig v1

`BoardConfig` odděluje strukturu desky od vizuálu a enginu.

```ts
interface BoardConfig {
  id:               BoardPresetId           // "small" | "large"
  fieldCount:       number                  // musí === fields.length
  fields:           BoardFieldConfig[]      // pořadí = renderovací pořadí
  racerSlotIndexes: number[]                // [3, 10, 17, 19] → mapuje na theme.racers[]
}

interface BoardFieldConfig {
  index:   number
  type:    BoardFieldType
  label:   string
  emoji:   string
  amount?: number  // coins_gain: +100, coins_lose: -60, start: +200
}
```

`buildFields(board, racers)` přečte BoardConfig a sestaví `Field[]` pro engine. Coin amounts, typy polí a racer sloty jsou v BoardConfig — ne hardcoded v engine.

---

## SMALL_BOARD — preset 21 polí

```
idx  type         label             amount
0    start        START             +200
1    coins_gain   Sponzor           +100
2    coins_lose   Veterinář         -60
3    racer        → racers[0]
4    coins_gain   Vítěz dostihu     +150
5    coins_lose   Daňový úřad       -80
6    coins_gain   Zlaté podkůvky    +80
7    coins_lose   Korupce           -120
8    chance       Náhoda
9    coins_gain   Dobrá sezona      +90
10   racer        → racers[1]
11   coins_lose   Krize na trhu     -50
12   coins_gain   Bankéř            +40
13   coins_lose   Zákeřný soupeř    -70
14   finance      Finance
15   coins_gain   Věrnostní bonus   +50
16   coins_lose   Zloděj            -70
17   racer        → racers[2]
18   coins_lose   Veterinář         -60
19   racer        → racers[3]
20   chance       Náhoda
```

Racer sloty [3, 10, 17, 19] jsou mapovány 1:1 na `theme.racers[0..3]`.

---

## Theme loading a fallback

```
getThemeById(id)     → Theme (in-memory registr, fallback na defaultTheme)
getBoardById(id)     → BoardConfig (in-memory registr, fallback na SMALL_BOARD)
themeToManifest(t)   → ThemeManifest (adapter, vždy sync)
```

**board_id v DB:** Sloupec `games.board_id` zatím neexistuje. GameBoard.tsx používá `boardId = "small"` jako konstantu. Až bude sloupec přidán: číst `game.board_id ?? "small"` a předat do `getBoardById()`.

---

## Theme cards fallback

```
drawCard(type, theme.content?.cards)
  ├─ theme má neprázdné cards.chance / cards.finance  → použij theme karty
  └─ theme nemá karty nebo jsou prázdné               → fallback na globální CHANCE_CARDS / FINANCE_CARDS
```

Stávající card flow (`applyCardEffect`, `card_pending`, Realtime) se nemění.
`drawCard` přijímá volitelný druhý argument — starý kód bez tohoto argumentu funguje dál.

---

## Validátor

```ts
import { validateBoardConfig, validateThemeManifest, crossCheckBoardAndTheme } from "@/lib/board";

validateBoardConfig(SMALL_BOARD);              // true
validateThemeManifest(themeToManifest(theme)); // true
crossCheckBoardAndTheme(SMALL_BOARD, manifest); // true pokud theme.racers.length >= 4
```

Validátor loguje chyby přes `console.error` / `console.warn` ale **nevyhazuje exception**.
Vrací `true` = valid, `false` = chyba nalezena.

**Doporučení:** volat v dev buildu při startu hry nebo v unit testech.

---

## Build versioning

Verze se mění automaticky při každém commitu / Vercel deployi — bez ruční úpravy.

**Odkud se bere:**
```
Vercel build → VERCEL_GIT_COMMIT_SHA (system env)
                    ↓
             next.config.ts env block
             NEXT_PUBLIC_BUILD_SHA = SHA ?? "dev"
                    ↓
             lib/build-info.ts
             BUILD_SHA = first 7 chars
             ENGINE_VERSION = "0.1+{BUILD_SHA}"
                    ↓
             BuildInfoBar.tsx  →  "Engine 0.1+abc1234"
```

**Format `0.1+abc1234`:**
- `0.1` — major.minor prefix, mění se ručně jen při breaking change
- `abc1234` — prvních 7 znaků commit SHA, mění se automaticky
- lokálně: `Engine 0.1+dev`
- na Vercel preview: `Engine 0.1+abc1234 (preview)`
- na produkci: `Engine 0.1+abc1234`

**Theme version:**
Čte se z `ThemeManifest.meta.version` přes `themeToManifest(theme)`.
Aktuálně hardcoded `"1.0.0"` v `themeToManifest()` — mění se až při změně theme schématu.

**Kde se zobrazuje:**
`BuildInfoBar` komponenta v patičce `GameBoard.tsx`:
```
Engine 0.1+abc1234  ·  Theme default v1.0.0  ·  Board small
```

**Soubory:**
- `next.config.ts` — bake Vercel env vars do bundle
- `lib/build-info.ts` — čisté konstanty (ENGINE_VERSION, BUILD_SHA, BUILD_ENV)
- `app/components/BuildInfoBar.tsx` — UI komponenta

---

## board_id — end-to-end flow

`board_id` funguje stejně jako `theme_id` — ukládá se do DB, načítá se při startu hry.

**Create flow (online + local):**
```
uživatel vybere board preset z BOARD_PRESETS[]
  ↓
games.insert({ board_id: selectedBoardId, ... })
  ↓
games.board_id uloženo v DB (DEFAULT 'small' pro staré hry)
```

**Load flow (GameBoard):**
```
supabase: games.select() → game.board_id
  ↓
setBoardId(game.board_id ?? "small")   ← fallback pro staré hry
  ↓
board = getBoardById(boardId)
FIELDS = buildFields(board, getThemeRacers(theme))
fieldCount = FIELDS.length             ← žádné hardcoded 21
```

**Fallback:**
- Staré hry bez `board_id` v DB: DB DEFAULT je `'small'`, navíc GameBoard fallbackuje na `"small"`.
- Neznámý `board_id`: `getBoardById()` loguje warning + vrátí `SMALL_BOARD`.

**Přidání nového presetu:**
1. Vytvoř `LARGE_BOARD` v `lib/board/presets.ts`
2. Přidej do `BOARD_REGISTRY` v `lib/board/index.ts`
3. Odkomentuj záznam v `BOARD_PRESETS[]` (nastavit `available: true`)
4. Přidej 42 CSS pozic do `FIELD_POSITIONS[]` v `GameBoard.tsx`

---

## Připraveno pro theme builder

Proč je tato architektura připravena pro theme builder:

1. **ThemeManifest** je samostatný JSON-serializovatelný typ — lze ho uložit do DB
2. **themeToManifest()** dokazuje, že stávající themes jsou kompatibilní se schématem
3. **getBoardById()** je připraveno na async variantu (board z DB)
4. **validateThemeManifest()** + **crossCheckBoardAndTheme()** jsou ready pro server-side validaci
5. **drawCard()** čte per-theme karty pokud existují — theme builder může přidat vlastní deck
6. **assets.racerImages** je normalizovaný Record bez legacy alias — theme builder vyplní přímo

**Další krok před theme builderem:**
1. Přidat `games.board_id` do DB schématu + migraci
2. Přidat GameBoard read: `setBoardId(game.board_id ?? "small")`
3. Přidat UI výběr board presetu při create game (volitelné, lze přidat boardId do create flow)
