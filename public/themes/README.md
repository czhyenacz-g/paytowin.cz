# Theme Assets — Naming Convention

Tato složka obsahuje obrazové assety pro všechna témata hry.

## Struktura

```
public/themes/
  {theme-id}/          ← built-in témata (horse-day, car-night, …)
  community/
    {map-id}/          ← komunitní mapy, každá ve vlastní podsložce
```

Built-in témata:
- `horse-day/`
- `horse-classic/`
- `horse-night/`
- `car-day/`
- `car-night/`

Komunitní mapy:
- `community/{map-id}/` — např. `community/sea-world/`

---

## Naming Convention

Každé téma / komunitní mapa používá tato kanonická jména souborů:

| Soubor               | Popis                                             |
|----------------------|---------------------------------------------------|
| `board-bg.webp`      | Pozadí herní desky (board surface)               |
| `center-bg.webp`     | Pozadí středové arény / infield                  |
| `preview.webp`       | Náhled pro výběr tématu v galerii                |
| `field-start.webp`   | Obrázek pole: START                              |
| `field-gain.webp`    | Obrázek pole: zisk coinů                         |
| `field-loss.webp`    | Obrázek pole: ztráta coinů                       |
| `field-gamble.webp`  | Obrázek pole: hazard                             |
| `field-racer.webp`   | Obrázek pole: závodník (kůň / auto / …)          |
| `field-chance.webp`  | Obrázek pole: náhoda (karta)                     |
| `field-finance.webp` | Obrázek pole: finance (karta)                    |
| `field-neutral.webp` | Obrázek pole: neutrální                          |
| `racer-{id}.webp`    | Obrázek závodníka podle racer.id, např. `racer-divoka_ruze.webp` |

Preferovaný formát: **webp** (menší soubor, dobrá kvalita). PNG je akceptovaný jako fallback.

---

## Fallback chování

Pokud soubor neexistuje, UI se nerozbije:
- `board-bg.webp` — deska se vykreslí s CSS barvou z `theme.colors.boardSurface`
- `field-*.webp` — pole se vykreslí s CSS barvou z `theme.colors.fieldStyles[type]`
- `racer-*.webp` — závodník se zobrazí s emoji z `racer.emoji`

---

## Kód helper

Cesty odvozuj přes helper v `lib/themes/assets.ts`:

```ts
import { themeAssetPath, THEME_ASSETS, racerAssetPath } from "@/lib/themes/assets";

// Board background
themeAssetPath("horse-day", THEME_ASSETS.boardBg)
// → "/themes/horse-day/board-bg.webp"

// Pole: závodník
themeAssetPath("horse-day", THEME_ASSETS.fieldRacer)
// → "/themes/horse-day/field-racer.webp"

// Závodník podle id
racerAssetPath("horse-day", "divoka_ruze")
// → "/themes/horse-day/racer-divoka_ruze.webp"

// Komunitní mapa
themeAssetPath("community/sea-world", THEME_ASSETS.boardBg)
// → "/themes/community/sea-world/board-bg.webp"
```

---

## Legacy assety v `/public` root

Soubory `bg_*.png/webp` v kořeni `/public` jsou legacy board backgroundy.
Nové assety patří do `public/themes/{theme-id}/board-bg.webp`.
