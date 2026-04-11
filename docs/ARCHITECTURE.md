# Architektura — paytowin.cz

## Vrstvy

```
app/components/        ← React komponenty (UI)
  GameBoard.tsx          hlavní herní deska (orchestrátor)
  modals/
    CardModal.tsx        overlay pro kartu Náhoda/Finance
    OfferModal.tsx       overlay pro nabídku rerollu

lib/
  types/game.ts          centrální herní typy (Horse, Player, GameState, OfferPending)
  engine.ts              čisté herní funkce (bez Reactu, bez Supabase)
  repository.ts          všechna Supabase volání — UI je NEVOLÁ přímo
  cards.ts               definice karet Náhoda / Finance + drawCard()
  themes/                vizuální theme systém
    index.ts               typy Theme, ThemeColors, HorseConfig, ThemeAssets
    default.ts, dark.ts, classic-race.ts
  supabase.ts            singleton Supabase client
  database.types.ts      typy DB schématu (generované / ručně udržované)
```

## Pravidla

| Pravidlo | Důvod |
|---|---|
| `lib/engine.ts` neimportuje React ani Supabase | testovatelnost, čistá logika |
| `lib/repository.ts` je jediný místo kde se volá `supabase.*` (kromě auth v komponentách) | snadná výměna backendu, přehled závislostí |
| Typy `Player`, `Horse`, `GameState` importuj z `lib/types/game.ts` | jediný zdroj pravdy, bez duplikátů |
| Modaly jsou samostatné komponenty | oddělení UI logiky, testovatelnost |

## Datový tok

```
Supabase DB
  ↕  (Realtime postgres_changes)
repository.ts  ←→  GameBoard.tsx  →  engine.ts (buildFields, normalizePlayer, …)
                        ↓
              CardModal / OfferModal (props, žádný stav)
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

## Theme systém

Každý theme definuje:
- `colors: ThemeColors` — Tailwind třídy pro všechny vizuální prvky
- `horses: HorseConfig[4]` — 4 koně v pořadí, mapování na pevné pozice desky (3, 10, 17, 19)
- `assets?: ThemeAssets` — volitelné obrázky (připraveno pro theme builder)

`buildFields(horses)` v `lib/engine.ts` sestaví 21 polí desky z konfigurace koní.

## Klíčové patterny

**fieldsRef** — `React.useRef<Field[]>` aktualizovaný každý render; Realtime handlery čtou
`fieldsRef.current` aby nevznikaly stale closures.

**cardAppliedRef / offerAcceptedRef** — ochrana před dvojím spuštěním efektu při re-renderu
nebo paralelním příjmu Realtime update.

**canReroll** — lokální stav; při `triggerOffer` se kontroluje `!canReroll` aby se nenabídl
druhý hod znovu během rerollu.
