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

## Theme systém

Každý theme definuje tři vrstvy:

| Vrstva | Typ | Účel |
|---|---|---|
| `colors` | `ThemeColors` | Tailwind třídy pro vizuální prvky |
| `labels` | `ThemeLabels` | UI texty (legenda, názvy, titulky) |
| `horses` | `HorseConfig[4]` | 4 koně mapovaní na pevné pozice desky |
| `assets?` | `ThemeAssets` | Obrázky — boardBg, horseImages, fieldTextures |
| `content?` | `ThemeContent` | Vlastní karty (připraveno, zatím nepoužíváno) |

**Horse image fallback:**
```ts
resolveHorseDisplay(horse, theme.assets?.horseImages)
// → { type: "image", src, alt } pokud existuje horseImages[horse.id]
// → { type: "emoji", value } jinak
```

**ThemeContent** (připraveno pro theme builder):
```ts
content?: {
  cards?: {
    chance?: GameCard[];   // vlastní balíček Náhoda
    finance?: GameCard[];  // vlastní balíček Finance
  };
}
```

`buildFields(horses)` v `lib/engine.ts` sestaví 21 polí desky z konfigurace koní.

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
