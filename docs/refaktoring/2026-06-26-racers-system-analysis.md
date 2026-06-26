# Analýza systému racerů a návrh bezpečného rozšíření

**Datum:** 2026-06-24
**Typ:** Analytický dokument (žádné funkční změny chování hry)
**Brand:** StartovníPole.cz (hlavní značka) · RaceToWin (kampaň) · PayToWin (technický engine)

---

## 1. Shrnutí aktuálního stavu

Systém racerů je v polovině migrace ze starého **per-theme embedded modelu**
(`ThemeManifest.racers: RacerConfig[]`, data napsaná přímo v `lib/themes/*.ts`)
na novou **globální Racer Registry** (tabulka `racers` v Supabase, přístup přes
`lib/racers/repository.ts`).

Obě cesty dnes existují paralelně a runtime si mezi nimi automaticky vybírá:

- Pokud `ThemeManifest.racerRefs` existuje a neprázdné → raceři se načtou z DB
  registry (`resolveRacerRefs`).
- Pokud ne (nebo registry lookup selže) → fallback na inline `manifest.racers`.

Žádná randomizace, žádný "pool" výběr a žádné odlišení legendary/owned/event-only
racerů od běžných racerů **ve hře samotné** dnes neexistuje. `isLegendary` je čistě
**kosmetická/flavor vlastnost** (ovlivňuje jen hlášku při ztrátě racera —
`RacerLostModal`), ne přístupové pravidlo.

---

## 2. Kde jsou raceři definovaní

| Vrstva | Soubor | Role |
|---|---|---|
| Typ globální registry | `lib/racers/types.ts` | `RacerProfile` — kanonický typ, mapuje 1:1 na tabulku `racers` |
| DB schéma | `supabase/migrations/20260418_add_racers_table.sql` | sloupce: `id, name, speed, price, emoji, max_stamina, is_legendary, flavor_text, image_url, image_path, type, is_builtin, owner_id, is_public` |
| DB přístup | `lib/racers/repository.ts` | `listRacers()`, `getRacerById()`, `upsertRacer()`, `updateRacer()`, `deleteRacer()` |
| Seed z theme dat | `lib/racers/seed-builtin.ts` | extrahuje racery ze starých `lib/themes/*.ts` a zapíše je do `racers` tabulky (`seedBuiltinRacers`, `resetBuiltinRacers`) |
| Adaptér pro engine | `lib/racers/adapters.ts`, `lib/racers/builtInRacers.ts` | `RacerProfile` (DB) ↔ `RacerConfig` (engine/theme typ) |
| Resolver pro hru | `lib/racers/resolver.ts` | `resolveRacerRefs()` — `{slotIndex, racer_id}[]` → `RacerConfig[]` z registry |
| Starý per-theme typ | `lib/themes/index.ts` (`RacerConfig`) | pořád aktivní; obsahuje `id, name, speed, price, emoji, image, maxStamina, isLegendary, flavorText, slotIndex, racerType` |
| Theme manifesty | `lib/themes/horse-day.ts`, `horse-night.ts`, `horse-classic.ts`, `car-day.ts`, `car-night.ts` | `racerRefs: [{slotIndex, racer_id}]` — fixní, ručně napsané přiřazení racera do slotu |
| Admin CRUD | `app/admin/racers/actions.ts`, `app/components/RacerAdminTool.tsx` | Server Actions pro editaci přes Racer Admin UI |

**Klíčové pozorování:** `RacerProfile` už má `ownerId` (nullable) a `isBuiltin`/`isPublic`
flagy — tedy základ pro odlišení "systémový vs. hráčův" racer **už částečně existuje**,
ale nikde se aktivně nevyužívá pro gating běžné nabídky.

---

## 3. Kde se raceři používají

| Místo | Soubor | Jak |
|---|---|---|
| Veřejný katalog | `app/racers/page.tsx` → `listRacersAction({isBuiltin: true, isPublic: true})` | Server-rendered, filtr jen na builtin+public, žádný pool/legendary filtr |
| Galerie + detail | `app/components/racers/RacersGallery.tsx`, `app/components/editor/RacerDetailCard.tsx` | Klientské filtrování podle `RacerType` (`horse/lama/camel/car`), legendary = jen ✦ ikonka |
| Herní deska | `app/components/GameBoard.tsx` (řádky ~237–269) | Při načtení theme manifestu: pokud `racerRefs` existují → `resolveRacerRefsAction()`; jinak inline `getThemeRacers(theme)`. Předá se do `buildFields()` |
| Engine — sestavení desky | `lib/engine.ts` → `buildFields(board, racers, economy)` | Racery přiřadí **1:1 podle `slotIndex`** na pole typu `"racer"`. Žádný výběr/náhoda — kolik racer-slotů na desce, tolik racerů se použije, v pevném pořadí |
| Nákup | `lib/engine.ts` → `normalizeRacer()` (RacerConfig → Horse), zápis do `player.horses` (JSONB) | Cena/rychlost/stamina se zkopírují jako snapshot v okamžiku nákupu |
| Quick game | `lib/quickGame.ts` → `createQuickGame()` | Vytvoří hru s fixním `theme_id` (po naší poslední úpravě: `horse-day`/`horse-night` podle denní doby) — raceři se odvozují stejně jako u běžné hry, žádná zvláštní logika |
| Multiplayer / vytvoření hry | `app/local/new/page.tsx`, `lib/game.ts` | Hra se vytváří s `theme_id` + `board_id`; raceři se **nikdy neukládají do `games` řádku** — odvozují se až při loadu `GameBoard` |
| Stamina / ztráta racera | `lib/minigames/apply-stable-duel-settlement.ts`, `app/components/modals/RacerLostModal.tsx`, `lib/minigames/stamina-costs.ts` | Stamina klesá při soubojích/minihrách; při 0 se racer odstraní z `player.horses`. `RacerCategory` (`"animal"\|"car"\|"generic"\|"legendary"`) je **jen UI typ pro flavor text v modalu**, ne datový model — pozor na jmennou kolizi s navrhovaným `raceCategory` (bod 7) |
| Bot nákup | `app/game/bot-actions.ts` | Bot kupuje racery ze stejných polí na desce jako hráč (žádný separátní pool) |
| Theme editor (dev) | `app/components/ThemeDevTool.tsx` | Admin nástroj pro editaci `racerRefs`/`racers` přímo v theme souborech (jen localhost) |

---

## 4. Jak funguje `/racers`

`app/racers/page.tsx` (Server Component, `force-dynamic`):

1. `listRacersAction({isBuiltin: true, isPublic: true})` — natáhne všechny builtin+public racery z DB.
2. `racerProfilesToConfigs()` — převod na `RacerConfig[]`.
3. Předá do `RacersGallery` (client component).

`RacersGallery`:
- Filtr pills podle `RacerType` (`horse | lama | camel | car`, `unset` se skrývá).
- Grid karet (emoji nebo obrázek, jméno, rychlost, ✦ pro legendary).
- Detail panel vpravo (`RacerDetailCard`) pro vybraného racera.

Žádné rozdělení podle `raceCategory` (typ závodu) ani podle `racerStyle` (styl výkonu)
dnes neexistuje — jen plochý filtr podle `RacerType`, který je granularnější
(per "zvíře", ne per "typ závodu").

---

## 5. Jak fungují raceři ve hře

1. Hra se vytvoří s `theme_id` + `board_id` (žádná racer data v `games` řádku).
2. `GameBoard` při loadu zjistí theme manifest → pokud má `racerRefs`, natáhne
   aktuální profily z DB; jinak použije inline `manifest.racers`.
3. `buildFields()` umístí racery **v pevném pořadí podle `slotIndex`** na board
   pole typu `"racer"` — počet polí = počet využitých racerů. Stejná mapa =
   stejní raceři ve stejných slotech v každé hře.
4. Hráč/bot "koupí" racera vstupem na pole → `normalizeRacer()` vytvoří snapshot
   (`Horse`) uložený do `player.horses` (JSONB v DB).
5. Stamina klesá při soubojích/minihrách; při vyčerpání se racer odstraní z
   `player.horses` a vrátí se zpět na desku k dalšímu odkupu.

**Není tu žádný "pool" ani randomizace** — nabídka racerů na desce je 100 %
deterministická podle theme manifestu. Board shuffle (`applyBoardShuffle`) mění
**pozice polí** podle `gameId` seedu, ale nemění **kteří raceři** se na desce
objeví.

---

## 6. Rizika současného řešení

1. **Žádné gatekeeping pravidlo pro „kdo může do běžné nabídky“.** `isLegendary`
   je jen kosmetický flag. Pokud by se dnes naivně přidala randomizace nad
   `listRacers()`, legendary i `ownerId`-vlastnění raceři by mohli omylem
   skončit v běžné nabídce — nic to nebrání.
2. **Jmenná kolize `RacerCategory` vs. navrhované `raceCategory`.** Existující
   `RacerCategory` (`app/components/modals/RacerLostModal.tsx`) řeší UI flavor
   text, ne typ závodu. Nový `raceCategory` (horse_racing/car_racing) musí mít
   jasně odlišený název a nesmí se zaměnit.
3. **`RacerType` (horse/lama/camel/car/unset) ≠ navrhovaný `raceCategory`.**
   Dnešní typ je per-zvíře, ne per-typ-závodu. Lama a velbloud by měly spadat
   pod `horse_racing` kategorii závodu, i když jde o jiný `RacerType`. Nutno
   ujasnit mapování, ne nahrazovat jedno druhým.
4. **Žádné stabilní úložiště pro per-hru výběr racerů.** `games` řádek nemá
   sloupec pro "tato hra používá tyto racery" — dnes se vždy odvozuje znovu
   z theme manifestu při každém loadu `GameBoard`. Pokud by se zítra přidala
   randomizace bez perzistence, hrozí přegenerování při refreshi/reloadu a
   nekonzistence mezi hráči ve stejné hře.
5. **`owner_id` v DB existuje, ale nic ho nečte pro filtrování.** Riziko: až
   přijdou profilové/owned raceři, je snadné je omylem zahrnout do `listRacers()`
   volání, která nemají explicitní filtr (např. budoucí random-pool helper).
6. **Dvojí zdroj pravdy (inline `manifest.racers` vs. DB registry) pořád běží
   paralelně.** Každá nová logika (random pool, kategorie, styl) musí počítat
   s fallback cestou, jinak bude nekonzistentní mezi theme, které migrovaly na
   `racerRefs`, a těmi, co ještě ne.
7. **Žádné testy pro "kdo je v nabídce".** Jediný test dotýkající se racerů
   (`lib/minigames/apply-stable-duel-settlement.test.ts`) řeší ztrátu staminy,
   ne pool/eligibility logiku — ta dnes ani neexistuje, tudíž není co testovat.

---

## 7. Doporučený datový model

Rozšíření `RacerProfile` (a tabulky `racers`) o čtyři nová pole — **bez
přejmenování existujících**, jen přídavek:

```ts
/** Typ závodu, do kterého racer patří. Odlišné od RacerType (per-zvíře/vozidlo). */
export const RACE_CATEGORIES = ["horse_racing", "car_racing"] as const;
export type RaceCategory = typeof RACE_CATEGORIES[number];

/** Styl výkonu — ovlivňuje budoucí balancing/flavor, ne přístup. */
export const RACER_STYLES = ["sprint", "endurance", "risk", "outsider", "heavy"] as const;
export type RacerStyle = typeof RACER_STYLES[number];

/**
 * Pool = KDE se racer smí objevit. Toto pole je bezpečnostní hranice,
 * ne kosmetika — viz pravidlo v bodě 8.
 */
export const RACER_POOLS = [
  "game_pool",       // smí do běžné random nabídky / běžného prodeje
  "owned_cosmetic",  // vlastní hráč, kosmetický, nikdy v běžné nabídce
  "legendary_only",  // legendary raceři — speciální získání, ne běžný pool
  "event_only",       // dočasné eventy
  "admin_only",       // jen admin/testing, nikdy hráčům
] as const;
export type RacerPool = typeof RACER_POOLS[number];

export const RARITIES = ["common", "uncommon", "rare", "legendary", "joke"] as const;
export type Rarity = typeof RARITIES[number];
```

Doplnění `RacerProfile`:

```ts
export interface RacerProfile {
  // ...existující pole beze změny...
  raceCategory: RaceCategory;   // NOT NULL, default 'horse_racing' (zpětná kompatibilita)
  racerStyle?:  RacerStyle;     // nullable — staré záznamy nemusí mít přiřazeno
  racerPool:    RacerPool;      // NOT NULL, default 'game_pool'
  rarity?:      Rarity;         // nullable, kosmetické — viz pravidlo níže
}
```

DB migrace (návrh, **needimplementovat v tomto tasku**):

```sql
ALTER TABLE racers
  ADD COLUMN race_category TEXT NOT NULL DEFAULT 'horse_racing',
  ADD COLUMN racer_style   TEXT,
  ADD COLUMN racer_pool    TEXT NOT NULL DEFAULT 'game_pool',
  ADD COLUMN rarity        TEXT;
```

`default 'game_pool'` zní rizikově na první pohled, ale je to **bezpečná
strana chyby** pro existující built-in racery (žádný z nich dnes není
legendary-only/owned — `isLegendary` je jen flavor). Při zavedení pole je
ale nutné explicitně přeřadit `is_legendary = true` záznamy na
`racer_pool = 'legendary_only'` v rámci stejné migrace (data backfill), ne
nechat default udělat špatné rozhodnutí.

---

## 8. Pravidlo pro `game_pool` vs. `legendary/owned/special`

**Bezpečnostní invariant (musí platit od první implementace dál):**

> Jakákoliv funkce, která vybírá racery pro běžnou hru (random nabídka,
> board sloty, quick game, bot nákup), **musí** explicitně filtrovat
> `racerPool === "game_pool"`. Žádná jiná hodnota `racerPool` se nesmí
> dostat do běžné hry žádnou cestou — ani přes `rarity`, ani přes
> `isLegendary`, ani přes absence filtru.

Konkrétně:

- `rarity` **nesmí** být použita jako filtr pro eligibility. Je čistě
  kosmetická/zobrazovací. Důvod: rarity řekne "jak vzácně vypadá", ne "kde
  se smí objevit" — to je přesně req. z bodu 4 zadání. Hypotetický `rarity:
  "common"` racer může klidně být `racerPool: "owned_cosmetic"` (např. dárek
  za splnění achievementu) a nesmí skončit v běžné nabídce jen proto, že
  vypadá "common".
- Doporučený helper (budoucí task, **needimplementovat teď**):

  ```ts
  // lib/racers/pool.ts (návrh, needělat zatím)
  export function isEligibleForGamePool(racer: RacerProfile): boolean {
    return racer.racerPool === "game_pool";
  }

  export async function listGamePoolRacers(raceCategory: RaceCategory): Promise<RacerProfile[]> {
    const all = await listRacers({ isPublic: true });
    return all.filter(r => r.raceCategory === raceCategory && isEligibleForGamePool(r));
  }
  ```

  Klíčové: filtr `racerPool` je **AND**, ne OR, se zbytkem podmínek — nikdy
  se nesmí stát side-cestou (např. "pokud je `isBuiltin` true, ber i bez
  ohledu na pool").

- Test, který tohle musí hlídat (návrh pro budoucí task, viz bod 10):
  `listGamePoolRacers()` vrácí prázdné pole nebo jen `game_pool` záznamy i
  v situaci, kdy DB obsahuje `legendary_only`/`owned_cosmetic`/`event_only`/
  `admin_only` záznamy se stejnou `raceCategory`.

---

## 9. Návrh random nabídky racerů pro konkrétní hru

Požadavky ze zadání: generovat při vytvoření hry, podle typu mapy, stabilně
pro danou hru, beze regenerace při reloadu, stejně pro všechny hráče.

**Návrh (bez implementace):**

1. **Kdy generovat:** v okamžiku vytvoření hry (`createQuickGame()` /
   `app/local/new/page.tsx` flow / multiplayer create), ne při loadu desky.
   Dnes se theme/racer rozhoduje teprve při `GameBoard` mountu — to je
   potřeba posunout o krok dřív, právě proto, aby výsledek šel uložit.
2. **Podle typu mapy:** `raceCategory` odvozený z `theme_id`
   (`horse-*` → `horse_racing`, `car-*` → `car_racing`) určí, ze kterého
   poolu se losuje — `listGamePoolRacers(raceCategory)`.
3. **Stabilita / žádná regenerace:** jakmile se vylosuje sada `racer_id`
   pro danou hru, **uloží se přímo do `games` řádku** jako nový sloupec,
   např. `racer_pool_refs JSONB` ve stejném tvaru jako `racerRefs`
   (`[{slotIndex, racer_id}]`). `GameBoard` pak při loadu **přednostně
   čte `game.racer_pool_refs`** místo statického `manifest.racerRefs` —
   přesně stejný `resolveRacerRefs()` helper se dá použít beze změny,
   jen se mu předá jiný zdroj referencí.
4. **Stejné pro všechny hráče:** protože je výběr uložen na `games` řádku
   (ne v `localStorage` ani per-klient stavu), všichni klienti čtou stejná
   data přes stejný Realtime/fetch mechanismus, který už existuje pro
   `theme_id`/`board_id`.
5. **Determinismus losování:** doporučeno seedovat losování `gameId`
   (stejně jako `applyBoardShuffle(board, gameId)` dělá pro layout) —
   zajistí reprodukovatelnost při debugging bez nutnosti uložit seed
   samostatně, i když uložení výsledných `racer_id` referencí do DB je
   stejně nutné pro stabilitu (seed by jen pomohl při ručním ověřování).

**To, co se v tomto tasku NEDĚLÁ:** žádný kód pro losování, žádná migrace,
žádné nové sloupce. Toto je popis cílového tvaru pro budoucí task.

---

## 10. Architektonická kontrola — lze uložit random nabídku bez velkého refactoru?

**Ano.** Existující kus skládačky to umožňuje s minimální úpravou:

- `ThemeManifest.racerRefs?: Array<{slotIndex, racer_id}>` je **přesně ten
  tvar**, který potřebujeme uložit per-hru — jen ne na manifestu (statický,
  shared přes všechny hry na té mapě), ale na `games` řádku (per-hra).
- `resolveRacerRefs(refs: RacerRef[])` v `lib/racers/resolver.ts` je už
  čistá funkce nezávislá na tom, odkud `refs` pocházejí — bere libovolný
  `RacerRef[]`, nemusí to být jen `manifest.racerRefs`.
- `GameBoard.tsx` (řádek ~248) by jen potřeboval přidat podmínku:
  „pokud `game.racer_pool_refs` existuje, použij ten; jinak fallback na
  `manifest.racerRefs` (current behavior)" — stejná fallback-priorita jaká
  už dnes existuje mezi DB registry a inline manifest.racers.

**Nejmenší bezpečná úprava (popis, needělat teď):**

1. Migrace: `ALTER TABLE games ADD COLUMN racer_pool_refs JSONB;` (nullable,
   žádný default → staré hry beze změny chování).
2. Při vytvoření hry: pokud bude implementována randomizace, zapsat vylosované
   refs do tohoto sloupce.
3. `GameBoard.tsx`: rozšířit existující `if (manifest.racerRefs?.length)`
   větev o prioritní čtení `game.racer_pool_refs ?? manifest.racerRefs`.

Žádná z těchto úprav nezasahuje do `buildFields()`, `engine.ts` ani
ekonomiky — `resolveRacerRefs()` zůstává jediný styčný bod.

---

## 11. Návrh rozdělení `/racers`

Současný stav: flat filtr podle `RacerType` (horse/lama/camel/car).

Navrhované rozdělení (bez funkční změny — jen návrh pro budoucí task):

```
Závody aut
└── horse_racing zástupně nepatří sem

Koňské závody (horse_racing)
├── Sprint     (racerStyle = "sprint")
├── Výdrž      (racerStyle = "endurance")
├── Riskanti   (racerStyle = "risk")
├── Outsideři  (racerStyle = "outsider")
└── Těžké váhy (racerStyle = "heavy")

Závody aut (car_racing)
└── (stejné podkategorie podle racerStyle)
```

- **Horní úroveň:** `raceCategory` (Koňské závody / Závody aut) — odpovídá
  zadání bodu 7.
- **Vnitřní filtr:** `racerStyle` pills, podobně jako dnešní `RacerType`
  pills v `RacersGallery.tsx` — stejný UI vzor, jen nad jiným polem.
- **Vizuální odlišení legendary/special:** zachovat dnešní ✦ badge
  (`isLegendary`), případně doplnit `racerPool` badge jen pro `legendary_only`/
  `event_only` (ne pro `owned_cosmetic`/`admin_only`, ty by se v public
  katalogu nemusely zobrazovat vůbec — záleží na budoucím rozhodnutí, zda
  `/racers` má vůbec ukazovat non-`game_pool` racery). **Důležité:** i bez
  ohledu na vizuální odlišení musí `/racers` katalog (čistě informativní
  stránka) zůstat oddělený od `game_pool` gating logiky — zobrazení v
  katalogu ≠ právo objevit se v běžné nabídce ve hře.

---

## 12. Doporučené pořadí dalších implementačních tasků

1. **Datový model + migrace** — přidat `race_category`, `racer_style`,
   `racer_pool`, `rarity` do `racers` tabulky a `RacerProfile` typu.
   Backfill: explicitně nastavit `racer_pool = 'legendary_only'` pro
   všechny `is_legendary = true` záznamy v rámci té samé migrace.
2. **`/racers` katalog rozdělení** — UI podle `raceCategory` → `racerStyle`,
   bez změny herní logiky.
3. **~20 nových racerů** — jména, popisky, obrázky, rozdělené mezi
   `horse_racing`/`car_racing`, různé `racerStyle`, výchozí `racer_pool:
   "game_pool"`.
4. **Helper pro random výběr** (`lib/racers/pool.ts`) — `listGamePoolRacers()`
   + losovací funkce, čistá/testovatelná, **bez** zápisu do DB.
5. **Testy eligibility** — ověřit, že `legendary_only`/`owned_cosmetic`/
   `event_only`/`admin_only` se nikdy nevrátí z `listGamePoolRacers()`,
   nezávisle na `rarity`.
6. **Zapojení do vytvoření hry** — migrace `games.racer_pool_refs`,
   losování při create, zápis refs, čtení v `GameBoard.tsx` s fallbackem.
7. **Demo profilový racer jako odměna** (4+ hráčů) — až po bodu 1–6,
   protože vyžaduje `racerPool: "owned_cosmetic"` a `ownerId` vazbu, která
   dnes existuje v typu, ale nikde se nezapisuje.

Pořadí je navrženo tak, aby každý task byl samostatně commitovatelný a
neporušil současné chování, dokud se explicitně nezapne (`racer_pool_refs`
je nullable/optional na každém kroku).

---

## 13. Otevřené otázky

1. **Mapování `RacerType` → `raceCategory`:** má `lama`/`camel` spadat pod
   `horse_racing`, nebo si zaslouží vlastní `raceCategory` (např.
   `desert_racing`)? Zadání zmiňuje jen dvě kategorie — potřeba rozhodnutí
   majitele produktu.
2. **Co dělat s `RacerCategory` (UI typ v `RacerLostModal.tsx`)?**
   Přejmenovat na něco jako `LossFlavorCategory`, aby nekolidovalo jménem
   s novým `RaceCategory`? Doporučeno přejmenovat v rámci tasku 1, ne nechat
   zmatek.
3. **Mají `/racers` katalog vidět i `legendary_only`/`event_only` raceři,
   nebo jen `game_pool`?** Ovlivňuje, zda je `/racers` čistě marketingová
   vitrína, nebo přesný odraz toho, co je "ve hře dostupné".
4. **Má `rarity: "joke"` mít speciální chování** (např. nikdy v `legendary_only`),
   nebo je to čistě kosmetický tag bez vazby na pool? Doporučení z bodu 8:
   `rarity` nikdy neřídí eligibility, ale stojí za explicitní potvrzení.
5. **Seedování losování (`gameId`-based) vs. čistá `Math.random()`:**
   potřebujeme determinismus jen pro debugging, nebo i pro replay/testing
   účely? Ovlivní návrh helperu v tasku 4.
6. **Migrace `games.racer_pool_refs`:** má se vztahovat i na staré/rozjeté
   hry (retroaktivně), nebo jen na nově vytvořené hry od okamžiku zapnutí
   feature? Doporučeno: jen nové hry — staré zůstanou na `manifest.racerRefs`
   fallbacku, nic se jim nemění.
