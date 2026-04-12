# Theme Authoring Guide — paytowin.cz

Tento dokument popisuje jak funguje theme systém a jak vytvořit nové theme.
Určeno pro vývojáře i pro budoucí theme builder UI.

---

## Co je ThemeManifest

`ThemeManifest` je jediný kanonický datový kontrakt pro theme v paytowin.cz.

Je JSON-serializovatelný — žádné funkce, žádný React, žádné runtime-only struktury.
Může být uložen v DB, v JSON souboru nebo sestaven kódem.

```ts
interface ThemeManifest {
  meta: {
    id: string             // unikátní id, např. "classic-race"
    name: string           // zobrazovaný název, např. "Klasické dostihy"
    description: string    // krátký popis
    version: string        // verze manifestu, např. "1.0.0"
    author?: string
    isPublic?: boolean
    isPaid?: boolean
    priceCzk?: number
  }

  labels: {
    gameName: string       // název hry, např. "Dostihy"
    start: string          // text START pole
    gain: string           // legenda: typ pole "zisk"
    loss: string           // legenda: typ pole "ztráta"
    hazard: string         // legenda: typ pole "hazard"
    chance: string         // název karty Náhoda
    finance: string        // název karty Finance
    racer: string          // závodník jed. číslo, např. "Kůň"
    racers: string         // závodníci mn. číslo, např. "Koně"
    racerField: string     // místo závodníků, např. "Stáj"
    bankrupt: string       // text pro bankrot
  }

  colors: ThemeColors      // Tailwind třídy — viz níže

  racers: RacerConfig[]    // povinné, min. 1 racer

  assets?: {
    previewImage?: string           // URL náhledu pro galerii
    boardBackgroundImage?: string   // URL pozadí desky
    logoImage?: string              // URL loga theme
    racerImages?: Record<string, string>  // racer.id → URL obrázku
  }

  cards?: {
    chance: GameCard[]     // vlastní balíček Náhoda (jinak globální default)
    finance: GameCard[]    // vlastní balíček Finance (jinak globální default)
  }

  supportedBoards?: Array<"small" | "large">  // undefined = všechny presety

  tone?: {
    style?: "neutral" | "funny" | "satirical" | "cute" | "dark" | "retro"
  }
}
```

---

## Co je BoardConfig

`BoardConfig` odděluje **strukturu desky** od vizuálu a enginu.

```ts
interface BoardConfig {
  id: "small" | "large"
  fieldCount: number              // musí === fields.length
  fields: BoardFieldConfig[]      // každé pole má index, type, label, emoji, amount?
  racerSlotIndexes: number[]      // indexy polí kde sedí závodníci
}
```

`buildFields(board, racers)` převede BoardConfig + RacerConfig[] na herní `Field[]`.

---

## Engine vs Theme vs Board — rozdělení zodpovědností

| Co | Kde | Příklad |
|---|---|---|
| Herní logika | `lib/engine.ts` | bankrot, průchod STARTem, skip_turn |
| Struktura desky | `lib/board/` | 21 polí, racer sloty, coin amounts |
| Vizuál + obsah | `ThemeManifest` | barvy, texty, závodníci, karty |

Theme builder **nikdy neovlivní** engine logiku.
Board builder **nikdy neovlivní** vizuál.

---

## Jak funguje loader

Existují dvě varianty:

### loadThemeManifest — synchronní (built-in only)

```
loadThemeManifest(themeId)
  │
  ├─ getThemeById(themeId)        ← najde Theme v in-memory registru
  │                                  fallback: defaultTheme pokud id nenalezeno
  ├─ themeToManifest(theme)       ← adaptér Theme → ThemeManifest
  │                                  normalizuje legacy fields (horses, horseImages)
  ├─ validateThemeManifest(m)     ← validátor: vrátí true/false, loguje chyby
  │
  ├─ OK  → vrátí manifest
  └─ NOK → fallback na "default" theme (opakuj postup)
             pokud i default selže → vrátí manifest stejně (hra musí běžet)
```

Používej tam kde není async kontext (render, GameBoard, lokální hra).

### loadThemeManifestAsync — asynchronní (DB → built-in → default)

```
loadThemeManifestAsync(themeId)
  │
  ├─ getThemeFromDb(themeId)      ← Supabase: SELECT manifest FROM themes WHERE id=...
  │   ├─ nalezeno + validní  → vrátí manifest
  │   ├─ nalezeno + nevalidní → loguj warn, pokračuj
  │   └─ nenalezeno / chyba   → pokračuj
  │
  └─ loadThemeManifest(themeId)   ← fallback na sync built-in loader
```

Používej v Server Components, API routes nebo při inicializaci online hry.

**Import:**
```ts
// Správně — přímý import z loaderu (vyhne se circular dep)
import { loadThemeManifest } from "@/lib/themes/loader";
import { loadThemeManifestAsync } from "@/lib/themes/loader";

// Pro adapter bez validace:
import { themeToManifest } from "@/lib/themes";
```

---

## Jak funguje validace

`validateThemeManifest(manifest)` kontroluje:

| Oblast | Co validuje |
|---|---|
| `meta` | id, name, version jsou neprázdné strings |
| `labels` | všech 11 required polí existuje |
| `racers` | >= 1, unikátní ids, speed > 0, price >= 0 |
| `assets` | pokud existují, hodnoty jsou strings |
| `cards` | pole, unikátní ids, validní effect.kind, coins/move mají value |
| `supportedBoards` | jen "small" \| "large" |

Validátor **nevyhazuje výjimku** — loguje `console.error`/`console.warn` a vrátí `boolean`.

`crossCheckBoardAndTheme(board, manifest)` navíc ověří:
- theme má dost závodníků pro board (racer sloty)

---

## Jak fungují assety

Tři úrovně fallbacku pro zobrazení závodníka:

```
resolveRacerDisplay(racer, manifest.assets?.racerImages)
  │
  ├─ 1. manifest.assets.racerImages[racer.id]  ← obrázek z theme assets
  ├─ 2. racer.image                             ← přímý obrázek v RacerConfig
  └─ 3. racer.emoji                             ← vždy dostupné
```

Pro pozadí desky:
```
manifest.assets?.boardBackgroundImage  ← obrázek
jinak: theme.colors.*                  ← Tailwind třídy (vždy dostupné)
```

Assety jsou **jen URL string**. Loader ani engine neřeší upload ani storage.

---

## Jak fungují per-theme karty

```
drawCard(type, manifest.cards)
  │
  ├─ manifest.cards.chance/finance neprázdné  → použij theme karty
  └─ jinak                                    → fallback na globální CHANCE_CARDS / FINANCE_CARDS
```

Karta musí mít tvar `GameCard`:
```ts
interface GameCard {
  id: string
  type: "chance" | "finance"
  text: string
  effect: {
    kind: "coins" | "move" | "skip_turn"
    value?: number   // povinné pro "coins" a "move"
  }
  effectLabel: string   // zkratka pro UI, např. "+100 💰"
}
```

---

## Jak vytvořit nové theme

### Možnost A — TypeScript objekt (dnešní způsob)

```ts
// lib/themes/moje-theme.ts
import type { Theme } from ".";

export const mojeTheme: Theme = {
  id: "moje-theme",
  name: "Moje theme",
  description: "Popis.",
  isPaid: false,
  priceCzk: 0,
  colors: { /* ... zkopíruj z default.ts a uprav */ },
  labels: {
    themeName: "Moje theme",
    centerTitle: "...",
    centerSubtitle: "...",
    legend: { gain: "zisk", lose: "ztráta", gamble: "hazard", horse: "kůň" },
    racer: "Kůň", racers: "Koně", racerField: "Stáj",
  },
  racers: [
    { id: "r1", name: "Závodník 1", speed: 2, price: 80,  emoji: "🔴" },
    { id: "r2", name: "Závodník 2", speed: 3, price: 150, emoji: "🟡" },
    { id: "r3", name: "Závodník 3", speed: 4, price: 250, emoji: "🟢" },
    { id: "r4", name: "Závodník 4", speed: 5, price: 400, emoji: "🔵" },
  ],
};
```

Pak přidej do `THEMES` v `lib/themes/index.ts`:
```ts
export const THEMES: Theme[] = [defaultTheme, darkTheme, classicRaceTheme, mojeTheme];
```

### Možnost B — ThemeManifest přímo (budoucí builder způsob)

```ts
const manifest: ThemeManifest = {
  meta: { id: "moje-theme", name: "...", description: "...", version: "1.0.0" },
  labels: { gameName: "...", start: "START", ... },
  colors: { ... },
  racers: [ ... ],
};

// Validace před použitím
import { validateThemeManifest } from "@/lib/themes/validator";
validateThemeManifest(manifest); // true = v pořádku
```

---

## Soubory theme systému

```
lib/themes/
  index.ts         ← Theme typ, getThemeById(), THEMES registr, re-exporty
  manifest.ts      ← ThemeManifest typ (datový kontrakt) + themeToManifest() adapter
  validator.ts     ← validateThemeManifest() + crossCheckBoardAndTheme()
  loader.ts        ← loadThemeManifest() + loadThemeManifestAsync() — safe entry points
  default.ts       ← built-in theme "Klasika"
  dark.ts          ← built-in theme "Noční závody"
  classic-race.ts  ← built-in theme "Klasické dostihy"

lib/board/
  types.ts         ← BoardConfig typ
  presets.ts       ← SMALL_BOARD preset
  validator.ts     ← validateBoardConfig() + re-exporty z themes/validator
  index.ts         ← getBoardById(), BOARD_PRESETS pro UI

lib/repository.ts  ← getThemeFromDb(), upsertThemeToDb() — DB přístup
```

## DB schéma pro themes

```sql
themes (
  id            TEXT PRIMARY KEY,   -- === manifest.meta.id
  manifest      JSONB NOT NULL,     -- celý ThemeManifest objekt
  created_by    TEXT NULL,          -- discord_id autora, NULL = systémové
  is_public     BOOLEAN DEFAULT false,
  is_official   BOOLEAN DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()  -- auto-update trigger
)
```

### Jak seedovat built-in theme do DB

```ts
import { loadAllThemeManifests } from "@/lib/themes/loader";
import { upsertThemeToDb } from "@/lib/repository";

const { valid } = loadAllThemeManifests();
for (const manifest of valid) {
  await upsertThemeToDb(manifest, { isOfficial: true, isPublic: true });
}
```

---

## Co bude dělat theme builder UI (v budoucnu)

1. **Editor ThemeManifest** — formulářové UI pro vyplnění všech polí
2. **Asset upload** — nahrání obrázků, uložení URL do `manifest.assets`
3. **Preview** — live náhled theme na herní desce
4. **Validace v reálném čase** — `validateThemeManifest()` při každé změně
5. **Uložení do DB** — `ThemeManifest` jako JSONB do tabulky `themes`
6. **Publishing** — nastavení `meta.isPublic`, `meta.isPaid`

Builder bude pracovat **pouze s ThemeManifest** — engine a board se nemění.
