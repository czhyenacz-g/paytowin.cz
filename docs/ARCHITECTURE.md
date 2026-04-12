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
  themes/                  vizuální + content theme systém
    index.ts                 typy Theme, ThemeColors, ThemeLabels, ThemeAssets, ThemeContent
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
