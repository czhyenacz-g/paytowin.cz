# GameBoard stabilizace — další malé kroky

Zpracováno: 2026-06-09  
Stav: pouze audit, žádné změny v kódu

---

## 1. Kontext

**Dlouhodobý cíl**: Stabilní, funkční demo v duchu Dostihy a sázky — tahový engine, nákup závodníků, finanční pole, boti, log, UI feedback, konzistentní board mezi klientem/botem/serverem.

**Poslední hotové stabilizace (od 2026-05-30):**
- Bot board source priority: `theme.board ?? getBoardById(game.board_id)` — srovnáno s klientem
- botRetrySeq: horse_pending stuck edge-case ošetřen retry signálem v `onBotActionComplete`
- Guide auto-dismiss: guide se zavírá při hodu kostkou
- CorrectionGuide: PreferredGuide nahrazen CorrectionGuide (první v mutex chain, bez horse check)
- MajorGain netGainDelta: pozitivní overlay zohlední cenu korekce tahu
- 4 extrakce z gameboard-split-plan.md: scheduleMorseAudio, BankruptAnnouncementModal, AmbientBackground, BoardAnimationLayer — **všechny hotové**
- useGameBoardAudio hook: audio + overlay feedback vyčleněn
- useOnlineBotTrigger hook: bot trigger vyčleněn
- BoardSurface: herní deska vyčleněna jako komponenta

---

## 2. Projité dokumenty

| Soubor | Obsah |
|---|---|
| `docs/refaktoring/gameboard-split-plan.md` | Plán 4 mikro-extrakcí (scheduleMorseAudio, BankruptAnnouncementModal, AmbientBackground, BoardAnimationLayer). Všechny hotové. |
| `docs/stabilization/next-game-stabilization-audit.md` | Masterplan 10 rizik (R-1 až R-10). Rizika R-1 (monolith) a R-4 (typecheck) částečně ošetřena; ostatní otevřená. |
| `docs/refaktoring/gameboard-responsibility-map.md` | Mapa 15 oblastí GameBoard s řádky, DB write body a stale closure riziky. Referenční pro extrakce. |
| `docs/refaktoring/gameboard-large-render-extractions.md` | Kandidáti na render extrakce: BoardSurface (hotovo), GameBoardTopPanel (střední-vysoké riziko), GameBoardStatusBars (17 ř., nulové riziko). |
| `docs/refaktoring/board-surface-layer-split-audit.md` | Interní extrakce uvnitř BoardSurface: BoardTrackLayer (37 ř., nízké riziko). |
| `docs/refaktoring/roll-decision-stabilization-audit.md` | Audit roll decision flow. Žádné zbývající todo. |
| `docs/claude/stable-duel-architecture.md` | Kompletní architektura Stable Duel, stavový stroj, guards, PvP sync, známá rizika. |
| `docs/ARCHITECTURE.md` | Vrstvy projektu, CenterEvent systém, datový tok. |

---

## 3. Co už je hotové

| Oblast | Původní problém | Aktuální stav | Soubory |
|---|---|---|---|
| scheduleMorseAudio | Inline v GameBoard | Extrahováno do `lib/audio/morse.ts` | `lib/audio/morse.ts` |
| BankruptAnnouncementModal | 10 ř. inline JSX | Komponenta v `modals/` | `app/components/modals/BankruptAnnouncementModal.tsx` |
| AmbientBackground | Lokální funkce v GameBoard | Extrahováno do `ui/` | `app/components/ui/AmbientBackground.tsx` |
| BoardAnimationLayer | Inline trail + figurina | Extrahováno do `board/` | `app/components/board/BoardAnimationLayer.tsx` |
| useGameBoardAudio | Inline audio + overlay state | Hook vyčleněn | `app/components/board/hooks/useGameBoardAudio.ts` |
| useOnlineBotTrigger | Inline bot trigger | Hook vyčleněn | `app/components/board/hooks/useOnlineBotTrigger.ts` |
| BoardSurface | Inline SVG board render | Komponenta vyčleněna | `app/components/board/BoardSurface.tsx` |
| Bot board priority | Bot používal jiný board než klient | Opraveno: `theme.board ?? getBoardById(game.board_id)` | `app/game/bot-actions.ts:62` |
| botRetrySeq | horse_pending stuck po selhání action | Ošetřeno retry signálem | `GameBoard.tsx`, `useOnlineBotTrigger.ts` |
| CorrectionGuide | PreferredGuide bez logické vazby na korekci | Nový guide, první v mutex chain | `GameBoard.tsx`, `GamePanel.tsx`, `lib/ui-text.ts` |
| Guide auto-dismiss | Guide se nezavíral při hodu | Dismiss volán v rollDice | `GameBoard.tsx:759–764` |
| MajorGain net | Overlay ignoroval cenu korekce | netGainDelta = gainDelta − adjustmentCost | `GameBoard.tsx:1119–1121` |
| typecheck script | npm run typecheck chyběl | Funguje: `tsc --noEmit` | `package.json` |

---

## 4. Co zůstává otevřené

| Oblast | Riziko | Proč na tom záleží | Navržený další krok |
|---|---|---|---|
| **R-4: ESLint config** | Nulové | Bez `.eslintrc.json` lint nefunguje; chybějící `react-hooks/exhaustive-deps` varování propouštějí potenciální stale closure bugy | Přidat `.eslintrc.json` s `next/core-web-vitals` |
| **R-5: Bot + card_pending stuck** | Střední | Pokud bot skončí na kartovém poli a server action nenastaví `card_pending=null`, hra čeká donekonečna — žádný fallback timeout pro boty | Přidat fallback timeout v `useOnlineBotTrigger` nebo server-side guard |
| **Guide state v GameBoard** | Nízké | 4 useState + 3 useCallback + localStorage init + shouldShow výpočty = ~60 ř. bez herní logiky. Všechno lze vyčlenit do `useGuideState` hooku | Extrahovat `useGuideState` hook |
| **GameBoardStatusBars** | Nulové | 17 ř. inline JSX, 2 props — pure presentational, kandidát z gameboard-large-render-extractions.md | Extrahovat komponentu |
| **R-2: clearOfferPending bez DB compare** | Střední | `clearOfferPending` v `finishTurn` přepíše `offer_pending` bez kontroly aktuálního DB stavu — race condition při rychlých duelech | Přidat compare guard: fetch aktuálního offer_pending před write |
| **R-3: Defender refresh v SD started fázi** | Střední | Defender refreshuje stránku po odpočtu — overlay se mu neotevře znovu, hra vypadá zamrzlá | Při načtení stránky: pokud `offer_pending.phase === "started"` a hráč je defender, otevřít overlay |
| **R-8: Bot year events** | Nízké | Bot neprocházejí year event logiku při průchodu STARTem — drobná asymetrie | Zavolat year event resolver v `executeBotTurnAction` |
| **R-9: Defender stamina** | Nízké | `STABLE_DUEL_APPLY_BOT_STAMINA_LOSS = false` — defender neztrácí staminu po duelu | Flag zapnout a ověřit logiku |
| **GameBoardTopPanel extrakce** | Střední-vysoké | 161 ř. inline JSX, 28 props — kandidát z gameboard-large-render-extractions.md; doporučeno udělat až po menších extraktech | Audit props, pak implementace |

---

## 5. Současné odpovědnosti GameBoard.tsx

**Aktuální počet řádků: 3 258** (bylo 3 437 v gameboard-split-plan.md, tedy −179 ř. od posledních extrakcí)

| Oblast | Řádky (přibližně) | Poznámka |
|---|---|---|
| **Importy + helper funkce** | 1–135 | racerSoundType, canTriggerRivalsRace |
| **State + refs** | 137–315 | ~40 useState, ~20 useRef |
| **Guide state + localStorage** | 179–405 | 4 useState, 3 useCallback, init effect → kandidát na hook |
| **Theme / board load** | 316–565 | useEffect pro async load, racerRefs |
| **refreshGame + Realtime** | 566–682 | refreshGame(), onBotActionComplete, Realtime subscriptions |
| **rollDice** | 751–1178 | 427 ř. — celý tahový orchestrátor |
| **applyCardEffect** | ~1413–1596 | 183 ř. — karty + DB write |
| **finishTurn** | ~1653–1815 | 163 ř. — post-turn cleanup, stamina regen, next player |
| **Race flow** | ~1816–2000 | ~150 ř. — closeRacePending, submitRaceSelection, atd. |
| **Stable Duel flow** | 691–699, 2117–2502 | ~350 ř. — settlement, online_1v1, countdown, defender sync |
| **Derived state** | ~2580–2668 | Computed hodnoty před renderem |
| **Render / JSX** | ~2670–3258 | ~600 ř. — overlays, HUD, board, panel, dev, footer |

---

## 6. Kandidáti na malé vyčlenění

Seřazeno od nejbezpečnějšího.

---

### Krok A — ESLint config

**Cíl**: Zprovoznit `npm run lint` jako druhý validační nástroj vedle `typecheck`.

**Proč to pomůže**: `react-hooks/exhaustive-deps` varování automaticky odhalí budoucí stale closure rizkia. Nulové riziko regrese.

**Riziko**: Nulové.

**Rozsah**: 1 nový soubor, žádná změna kódu.

**Soubory**: `.eslintrc.json` (nový)

**Audit nebo implementace?** Implementace.

**Validace**: `npm run lint` projde bez errors.

---

### Krok B — `useGuideState` hook

**Cíl**: Vyčlenit guide state a localStorage logiku z GameBoard do samostatného hooku.

**Proč to pomůže**: Odstraní ~60 řádků state + callbacks bez herní logiky. GameBoard nebude vědět nic o localStorage klíčích. Hook bude testovatelný izolovaně.

**Riziko**: Nízké — guide state nemá žádnou vazbu na DB, pending states ani server actions. Interaguje pouze přes `shouldShow*` computed props předávané do GamePanel, a přes `dismiss*` volání v rollDice.

**Rozsah**: ~60 ř. přesunuto z GameBoard → nový hook. V GameBoard zůstane jen volání hooku a předání výstupu.

**Soubory**: 
- Nový: `app/components/board/hooks/useGuideState.ts`
- Změna: `app/components/GameBoard.tsx` (odstranit 4× useState, 3× useCallback, init effect, shouldShow výpočty)

**Audit nebo implementace?** Implementace (po krátkém auditu že shouldShow výpočty nemají jiné závislosti).

**Validace**: `npm run typecheck`, manuálně: guide se zobrazí/skryje po hodu kostkou.

---

### Krok C — `GameBoardStatusBars` extrakce

**Cíl**: Vyčlenit 17 ř. inline JSX (status bars) do presentační komponenty.

**Proč to pomůže**: Čistý render-only kus, nulové riziko, sníží délku render sekce.

**Riziko**: Nulové — 2 props, žádné callbacky, žádná logika.

**Rozsah**: ~17 ř. JSX → komponenta s 2 props.

**Soubory**:
- Nový: `app/components/board/GameBoardStatusBars.tsx`
- Změna: `app/components/GameBoard.tsx` (17 ř. → 1 ř.)

**Audit nebo implementace?** Implementace.

**Validace**: `npm run typecheck`, vizuální ověření status barů.

---

### Krok D — R-5: Bot + card_pending fallback timeout

**Cíl**: Přidat server-side nebo client-side fallback pro případ kdy bot skončí na kartovém poli a `card_pending` zůstane viset.

**Proč to pomůže**: Odstraní game-breaking stuck state. Hra se nikdy nezastaví kvůli card_pending pro bota.

**Riziko**: Střední — zasahuje do bot flow a pending state. Nutný přesný audit card_pending bot scénáře.

**Rozsah**: ~10–20 ř. v `useOnlineBotTrigger` nebo v bot-actions.ts.

**Soubory**: `app/components/board/hooks/useOnlineBotTrigger.ts`, případně `app/game/bot-actions.ts`

**Audit nebo implementace?** Nejdřív audit scénáře, pak implementace.

**Validace**: `npm run typecheck`, simulace bot tahu s kartovým polem.

---

### Krok E — R-3: Defender refresh v SD started fázi

**Cíl**: Při načtení stránky otevřít Stable Duel overlay pro defendera pokud `offer_pending.phase === "started"` nebo `"finished"`.

**Proč to pomůže**: Refresh stránky je přirozený způsob jak hráč zachrání stuck hru — pokud overlay po refreshi neotevře, defender je uvězněn.

**Riziko**: Střední — zasahuje do Stable Duel initialization flow.

**Rozsah**: ~15–25 ř. v GameBoard load effect.

**Soubory**: `app/components/GameBoard.tsx` (load useEffect), `docs/claude/stable-duel-architecture.md` (aktualizovat TODO)

**Audit nebo implementace?** Nejdřív audit stable-duel-architecture.md a load flow, pak implementace.

**Validace**: Simulace: duel v phase "started" → refresh → overlay se otevře.

---

### Krok F — R-4 → R-2: clearOfferPending DB compare guard

**Cíl**: Přidat fetch před clearOfferPending v finishTurn, aby se nepřepsalo jiné offer_pending.

**Proč to pomůže**: Eliminuje race condition při rychlých duelech v multiplayer.

**Riziko**: Střední — finishTurn je kritická funkce. Nutné sledovat timing DB write.

**Rozsah**: ~5–10 ř. v finishTurn.

**Soubory**: `app/components/GameBoard.tsx` (~řádky 1767–1791)

**Audit nebo implementace?** Nejdřív audit přesného flow clearOfferPending.

**Validace**: `npm run typecheck`, multiplayer simulace rychlých duelů.

---

### Krok G — GameBoardTopPanel extrakce

**Cíl**: Vyčlenit 161 ř. inline top HUD panelu do komponenty.

**Proč to pomůže**: Největší render blok, který ještě zůstává inline. Zlepší čitelnost render sekce.

**Riziko**: Střední-vysoké — 28 props, přistupuje k `theme`, `isHost`, `stableDuelMode`, `scorePopupOpen`, `topPanelVisible`. Vhodné až po stabilizaci hooků.

**Rozsah**: 161 ř. JSX → komponenta s ~28 props.

**Soubory**: Nový `app/components/board/GameBoardTopPanel.tsx`, změna GameBoard.tsx.

**Audit nebo implementace?** Audit props boundary, pak implementace.

**Validace**: `npm run typecheck`, vizuální ověření celého HUD.

---

## 7. Co zatím nedělat

| Oblast | Proč |
|---|---|
| **rollDice** refaktoring | 427 ř., celý tahový orchestrátor, closure přes desítky refs a state. Jakákoli extrakce vyžaduje redesign state ownership. |
| **finishTurn** extrakce | 163 ř., closure přes gameId, players, economy, mnoho refs. Stale closure problém by se přesunul, ne odstranil. |
| **applyCardEffect** extrakce | Volá finishTurn, drží horse_pending guard, chain guard depth. Tightly coupled. |
| **handleStableDuelFinish** extrakce | Settlement + DB write + clearOfferPending + online_1v1 cleanup. Challenger-only guard. |
| **Realtime subscription** extrakce | refreshGame() closure drží všechny state settery. Extrakce bez redesign ownership = high risk. |
| **Race flow** extrakce | Countdown → racing → results chain s DB writes a časovači. Komplexní timing závislosti. |
| **lib/engine.ts** refaktoring | Funguje, pure funkce, nízká chybovost. Beze změny. |
| **DB schéma** změny | Mimo scope stabilizace. |

---

## 8. Doporučené pořadí dalších 3 kroků

### 1. ESLint config (Krok A)
**Proč první**: Nulové riziko. Jakmile lint funguje, všechny další kroky mají automatický safety net přes `react-hooks/exhaustive-deps`. Zero regresní plocha.

### 2. useGuideState hook (Krok B)
**Proč druhý**: Guide state (4× useState, 3× useCallback, init, shouldShow výpočty) je čistě izolovaná doména bez herní logiky. Extrakce sníží kognitivní zátěž při čtení GameBoard a zároveň ověří pattern hook extrakce pro složitější kandidáty.

### 3. R-5: bot + card_pending fallback (Krok D)
**Proč třetí**: Game-breaking stuck state pro boty. Po lint a guide hook jde o nejvyšší produktový přínos — bez toho může bot trvale zablokovat hru. Závisí na auditu scénáře.

---

## 9. Přesný prompt pro nejbližší další krok (Krok A — ESLint)

```
Název problému: Přidat funkční ESLint konfiguraci

Cíl:
Zprovoznit npm run lint jako validační nástroj.
Aktuálně chybí .eslintrc.json — next lint spustí interaktivní průvodce
místo validace. Typecheck funguje (npm run typecheck), ale lint ne.

Soubory:
- .eslintrc.json (nový)
- package.json (zkontroluj, zda script "lint" existuje; pokud ne, přidej)

Implementace:
1. Vytvoř .eslintrc.json v kořenu projektu:
{
  "extends": "next/core-web-vitals",
  "rules": {
    "react-hooks/exhaustive-deps": "warn"
  }
}

2. V package.json ověř, že existuje script:
"lint": "next lint"
Pokud ne, přidej ho.

Důležité:
- Neměň žádný aplikační kód.
- Necommituj žádné automatické lint opravy.
- Pokud lint vrátí warnings (ne errors), to je OK — jen zaloguj výstup.
- Pokud lint vrátí errors, zaloguj je a NEopravuj automaticky — napiš report.

Validace:
- npm run typecheck — musí projít (baseline)
- npm run lint — musí se dokončit bez interaktivního promptu
- Zapiš výsledek: počet errors, počet warnings

Verze:
- Navyšovat není nutné — jde o vývojářský tooling, ne produkční změnu.

Očekávaný výstup:
1. Název problému
2. Změněné soubory
3. Výstup npm run lint (počet errors / warnings)
4. Výstup npm run typecheck
5. Žádné aplikační soubory nebyly změněny
```
