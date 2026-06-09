# ESLint hooks deps audit

Zpracováno: 2026-06-09  
Stav: pouze audit, žádné změny v kódu

---

## 1. Kontext

ESLint byl přidán přes `.eslintrc.json` s `"react-hooks/exhaustive-deps": "warn"` jako safety net
před dalšími extrakcemi z GameBoard.tsx. Cílem bylo odhalit stale closure rizika dříve, než
způsobí produkční bug.

`npm run lint` odhalil 7 `react-hooks/exhaustive-deps` varování v 6 souborech.

---

## 2. Přehled varování

| # | Soubor | Řádek | Hook | Chybějící / nadbytečné deps | Oblast | Riziko |
|---|---|---|---|---|---|---|
| 1 | `GameBoard.tsx` | 2277 | `useCallback` | `checkAndFinishGame`, `showMajorGain`, `showMajorLoss`, `themeId` (chybí) | Stable Duel settlement, DB write | 🔴 Vysoké |
| 2 | `StableDuelBoardLayer.tsx` | 948 | `useEffect` | `p2IsLegendary` (chybí) | Realtime + keyboard subscription | 🟠 Střední |
| 3 | `ThemeDevTool.tsx` | 700 | `useMemo` | `editableCards` (chybí) | Admin dev tool — isDirty výpočet | 🟢 Nízké |
| 4 | `ThemeDevTool.tsx` | 808 | `useMemo` | `editableRacerImages` (nadbytečné) | Admin dev tool — field editor state | 🟢 Nízké |
| 5 | `DeckEditorPanel.tsx` | 87 | `useEffect` | `card.text`, `card.effectLabel`, `card.effect.*`, `card.imagePath` (chybí) | Admin editor — sync local form | 🟢 Nízké (záměrný pattern) |
| 6 | `RacerEditorPanel.tsx` | 84 | `useEffect` | `racer.flavorText`, `racer.heroText`, `racer.image`, … (chybí) | Admin editor — sync local form | 🟢 Nízké (záměrný pattern) |
| 7 | `SpeedArenaPvp.tsx` | 178 | `useEffect` | `pvpState.p1.score`, `pvpState.p1.status`, `pvpState.p1NitroUsed`, `pvpState.p2.*` (chybí) | Speed Arena PvP — fire-once výsledek | 🟡 Střední |

---

## 3. Detail každého varování

---

### W1 — GameBoard.tsx:2277 `handleStableDuelFinish`

**Co efekt dělá:**  
`handleStableDuelFinish` je `useCallback` volaný po skončení Stable Duel minihy. Spouští:
- `computeMinigameSettlement` → výpočet coinsDelta
- `showMajorGain` / `showMajorLoss` → emoční overlay
- stamina update (supabase.from("players").update)
- `themeId.startsWith("car")` → určení kategorie pro RacerLostModal
- `checkAndFinishGame(postDuelPlayers)` → kontrola konce hry (supabase.from("games").update)
- `finishTurn` / `proceed` → posun na dalšího hráče + DB write
- online_1v1: setTimeout 2500ms + cleanup offer_pending

**Proč ESLint varuje:**  
Čtyři hodnoty jsou čteny uvnitř callbacku, ale nejsou v deps:
- `checkAndFinishGame` — regular async function (ne useCallback), recreated on every render
- `showMajorGain`, `showMajorLoss` — stable useCallback z `useGameBoardAudio`
- `themeId` — string state

**Reálné riziko:**
- `showMajorGain` / `showMajorLoss`: **Prakticky nulové** — tyto funkce jsou stable `useCallback` z `useGameBoardAudio` a nemění se v čase. Stale closure je zde jen technicky, ne fakticky.
- `themeId`: **Velmi nízké** — theme se nemění v průběhu hry. Stale closure by způsobila špatnou kategorii v RacerLostModal (horse vs. car), ale jen pokud by uživatel změnil téma uprostřed duelu (nemožné v produkci).
- `checkAndFinishGame`: **Střední** — není useCallback, takže se referenčně mění každý render. Stale closure by znamenala použití starší verze funkce. Reálné riziko: `checkAndFinishGame` čte `gameId`, `scenario`, `fieldsRef.current`. `gameId` je již v deps `handleStableDuelFinish`, takže tato hodnota je aktuální skrz stávající deps. `scenario` je computed z `themeId` (stable). `fieldsRef.current` je ref — vždy aktuální.

**Závěr rizika:** Reálně nízké, ale code smell. Pokud bychom přidali `checkAndFinishGame` do deps bez wrap do `useCallback`, `handleStableDuelFinish` by se zbytečně recreatovalo na každý render. Pokud je `handleStableDuelFinish` předáváno jako prop do `StableDuelBoardLayer`, mohlo by způsobit zbytečné re-rendery nebo re-subscrbe efektů.

**Doporučené řešení (dvoustupňové, ne hned):**
1. Přidat `showMajorGain`, `showMajorLoss`, `themeId` do deps (bezpečné, stable hodnoty)
2. Zabalit `checkAndFinishGame` do `useCallback` s příslušnými deps — pak přidat do deps `handleStableDuelFinish`

**Implementovat hned?** Ne — samostatný task. `handleStableDuelFinish` zasahuje do kritického settlement flow a timeout cleanup. Změna deps bez wrap `checkAndFinishGame` by mohla způsobit zbytečné recreace callbacku.

---

### W2 — StableDuelBoardLayer.tsx:948 `useEffect` (Realtime + keyboard)

**Co efekt dělá:**  
Nastavuje Supabase Broadcast channel pro defendera + keydown/keyup handlery. V keydown handleru (řádek 923) se `p2IsLegendary` používá pro rozhodnutí mezi `"legendary"` a `"nitro"` akcí.

**Proč ESLint varuje:**  
`p2IsLegendary` je čteno uvnitř `down` handleru, ale není v deps array `[duelRole, duelId, gameId, defenderId]`.

**Reálné riziko:**  
**Nízké.** `p2IsLegendary` je určeno ze závodníka v momentě vzniku duelu a nemění se v průběhu hry. Stale closure by způsobila použití starého `isLegendary` hodnoty, ale v praxi to nikdy nenastane. Přidání `p2IsLegendary` do deps by navíc způsobilo odpojení a znovupřipojení Realtime kanálu a reset keyboard listenerů při každé změně — to je nežádoucí.

**Doporučené řešení:**  
Použít ref pattern místo přidání do deps:

```ts
const p2IsLegendaryRef = React.useRef(p2IsLegendary);
React.useEffect(() => { p2IsLegendaryRef.current = p2IsLegendary; }, [p2IsLegendary]);
// ... v down handleru: p2IsLegendaryRef.current ? ...
```

Alternativa: přidat komentář `// eslint-disable-next-line react-hooks/exhaustive-deps` s vysvětlením, že `p2IsLegendary` se v průběhu duelu nemění a přidání do deps by resetovalo channel.

**Implementovat hned?** Ref pattern — ano (nízké riziko, malý zásah). ESLint disable — také OK.

---

### W3 — ThemeDevTool.tsx:700 `useMemo isDirty`

**Co efekt dělá:**  
Počítá `isDirty` — jestli jsou v editoru neuložené změny. JSON.stringify zahrnuje `editableCards`, ale deps array `editableCards` neobsahuje.

```ts
const current = JSON.stringify({ editableBoard, editableRacers, editableCards, editableFieldTextures, editableRacerImages });
return current !== savedSnapshot;
}, [showBoardPreview, savedSnapshot, editableBoard, editableRacers, editableFieldTextures, editableRacerImages]);
//                                                                    ^^^^ chybí editableCards
```

**Reálné riziko:**  
**Skutečný bug** v admin dev toolu. Když editor změní karty (deck), `isDirty` se nerecomputuje — zobrazuje se "uloženo" i přesto, že jsou v kartách neuložené změny. Ovlivňuje pouze admin rozhraní pro tvorbu témat, ne herní engine.

**Doporučené řešení:**  
Přidat `editableCards` do deps array. Jednořádková oprava.

**Implementovat hned?** Ano — nulové riziko, admin-only, fix skutečného bugu.

---

### W4 — ThemeDevTool.tsx:808 `useMemo` (field editor state)

**Co efekt dělá:**  
Počítá konfiguraci upload panelu pro vybrané pole. ESLint říká, že `editableRacerImages` je v deps, ale v memu se nepoužívá.

**Reálné riziko:**  
**Nulové** — nadbytečný dep způsobuje zbytečné recompute mema, ale neovlivňuje správnost. Čistý cleanup.

**Doporučené řešení:**  
Odebrat `editableRacerImages` z deps array. Jednořádková oprava.

**Implementovat hned?** Ano — nulové riziko, admin-only, čistý cleanup.

---

### W5 — DeckEditorPanel.tsx:87 `useEffect` (sync local form)

**Co efekt dělá:**  
Synchronizuje lokální form state (text, effectLabel, kind, value, racerId, imagePath) z prop `card` při přepnutí na jinou kartu.

```ts
React.useEffect(() => {
    setText(card.text);
    // ...
}, [card.id]);  // záměrně jen card.id
```

**Proč ESLint varuje:**  
Všechny `card.*` vlastnosti jsou čteny uvnitř efektu, ale v deps je jen `card.id`.

**Reálné riziko:**  
**Nulové — záměrný pattern.** Efekt má záměrně `card.id` jako deps: "resetuj form lokální state jen při přepnutí na jinou kartu". Přidání všech `card.*` polí by způsobilo reset lokální editace pokaždé, kdy parent aktualizuje kteroukoli vlastnost karty — uživatel by přišel o rozeditaná pole.

**Doporučené řešení:**  
Přidat komentář:
```ts
// Záměrně pouze card.id — resetuje form jen při přepnutí karty, ne při každé aktualizaci prop.
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [card.id]);
```

**Implementovat hned?** Ano — jen komentář, admin-only.

---

### W6 — RacerEditorPanel.tsx:84 `useEffect` (sync local form)

**Co efekt dělá:**  
Identický pattern jako W5 — sync lokálního form state z `racer` prop při přepnutí závodníka.

```ts
React.useEffect(() => {
    setName(racer.name);
    // ...
}, [racer.id]);  // záměrně jen racer.id
```

**Reálné riziko:**  
**Nulové — záměrný pattern.** Stejná logika jako W5.

**Doporučené řešení:**  
Přidat komentář s `// eslint-disable-next-line react-hooks/exhaustive-deps`.

**Implementovat hned?** Ano — jen komentář, admin-only.

---

### W7 — SpeedArenaPvp.tsx:178 `useEffect` (fire onResult once)

**Co efekt dělá:**  
Volá `onResult` callback jednou, když `pvpState.overallStatus === "finished"`. Čte finální hodnoty `pvpState.p1.score`, `p1.status`, `p1NitroUsed` atd., ale má je v closure, ne v deps.

```ts
React.useEffect(() => {
    if (pvpState.overallStatus === "finished" && pvpState.winner !== null && !onResultFiredRef.current) {
      onResultFiredRef.current = true;
      onResult?.({
        // čte pvpState.p1.score, p1NitroUsed atd.
      });
    }
}, [pvpState.overallStatus, pvpState.winner, onResult]);
```

**Reálné riziko:**  
**Nízké.** Efekt se záměrně spouští jen při změně `overallStatus`/`winner`. V momentě kdy `overallStatus === "finished"`, jsou všechny `pvpState.*` hodnoty finální — nezmění se. Stale closure by mohla zaznamenat výsledek s nesprávnými hodnotami jen pokud by `overallStatus` přešel na "finished" dříve, než se aktualizovaly `p1.score` atd. V praxi k tomu nedochází, protože score se nastavuje v momentě pád/výhry, ne až pak.

`onResultFiredRef` guard navíc zabraňuje double-firing, takže přidání missing deps by bylo bezpečné, ale zbytečné.

**Doporučené řešení:**  
Přidat komentář s vysvětlením záměrného patternu:
```ts
// Záměrně jen overallStatus + winner v deps — hodnoty pvpState.* jsou finální při "finished".
// eslint-disable-next-line react-hooks/exhaustive-deps
```

Nebo alternativně: přidat chybějící deps — `onResultFiredRef` guard to dělá bezpečným. Rozhodnutí záleží na preferenci.

**Implementovat hned?** Komentář — ano. Přidání deps — lze, ale není nutné.

---

## 4. Doporučené pořadí oprav

| Pořadí | Warning | Akce | Riziko | Soubor |
|---|---|---|---|---|
| 1 | W3 | Přidat `editableCards` do deps `isDirty` | Nulové | `ThemeDevTool.tsx:700` |
| 2 | W4 | Odebrat `editableRacerImages` z deps | Nulové | `ThemeDevTool.tsx:808` |
| 3 | W5 | Přidat eslint-disable komentář | Nulové | `DeckEditorPanel.tsx:87` |
| 4 | W6 | Přidat eslint-disable komentář | Nulové | `RacerEditorPanel.tsx:84` |
| 5 | W7 | Přidat eslint-disable komentář | Nízké | `SpeedArenaPvp.tsx:178` |
| 6 | W2 | Přidat `p2IsLegendaryRef` pattern | Nízké | `StableDuelBoardLayer.tsx:948` |
| 7 | W1 (část) | Přidat `showMajorGain`, `showMajorLoss`, `themeId` do deps | Nízké | `GameBoard.tsx:2277` |
| 8 | W1 (část) | Zabalit `checkAndFinishGame` do `useCallback`, pak přidat do deps | Střední | `GameBoard.tsx:2277` + 2072 |

**Poznámka k W3**: Jde o skutečný bug v admin toolingu — `isDirty` nedetekuje změny v kartách. Ostatní jsou záměrné patterny nebo rizikově bezvýznamné stale closure.

---

## 5. První implementační prompt

```
Název problému: Oprava ESLint warnings v admin dev toolech (W3, W4, W5, W6)

Cíl:
Oprav 4 nejbezpečnější react-hooks/exhaustive-deps warningy ve dvou admin-only souborech.
Jeden je skutečný bug (W3), ostatní jsou záměrné patterny, které potřebují komentář.

Soubory:
- app/components/ThemeDevTool.tsx
- app/components/editor/DeckEditorPanel.tsx
- app/components/editor/RacerEditorPanel.tsx

Neměň:
- app/components/GameBoard.tsx
- app/components/StableDuelBoardLayer.tsx
- app/components/speed/SpeedArenaPvp.tsx

Změny:

1. ThemeDevTool.tsx řádek 700 (W3 — skutečný bug):
   isDirty useMemo má v deps chybějící editableCards.
   Deps array je:
     [showBoardPreview, savedSnapshot, editableBoard, editableRacers, editableFieldTextures, editableRacerImages]
   Přidej editableCards:
     [showBoardPreview, savedSnapshot, editableBoard, editableRacers, editableCards, editableFieldTextures, editableRacerImages]

2. ThemeDevTool.tsx řádek 808 (W4 — nadbytečný dep):
   useMemo má v deps editableRacerImages, ale nepoužívá ho.
   Deps array je:
     [selectedFieldIndex, editableBoard, liveManifest, editableFieldTextures, editableRacerImages]
   Odeber editableRacerImages:
     [selectedFieldIndex, editableBoard, liveManifest, editableFieldTextures]

3. DeckEditorPanel.tsx řádek 87 (W5 — záměrný pattern):
   useEffect má deps [card.id] záměrně — resetuje form jen při přepnutí karty.
   Přidej eslint-disable komentář nad deps:
     // Záměrně pouze card.id — form se resetuje jen při přepnutí karty, ne při každé aktualizaci.
     // eslint-disable-next-line react-hooks/exhaustive-deps
     }, [card.id]);

4. RacerEditorPanel.tsx řádek 84 (W6 — záměrný pattern):
   Stejný pattern jako W5 — deps [racer.id] je záměrné.
   Přidej eslint-disable komentář:
     // Záměrně pouze racer.id — form se resetuje jen při přepnutí závodníka.
     // eslint-disable-next-line react-hooks/exhaustive-deps
     }, [racer.id]);

Validace:
- npm run typecheck (0 chyb)
- npm run lint — zkontroluj, že W3 a W4 zmizely z výstupu
- W5 a W6 by měly také zmizet (eslint-disable)
- Zkontroluj, že W1 (GameBoard.tsx:2277), W2 (StableDuelBoardLayer.tsx:948),
  W7 (SpeedArenaPvp.tsx:178) zůstávají beze změny

Verze:
Není nutné navyšovat — jde o admin tooling a komentáře, ne produkční změnu.

Commit:
chore: fix ESLint hooks-deps warnings in admin editors
```
