# Další stabilizační audit hry — PayToWin.cz

**Datum:** 2026-05-26  
**Stav:** pouze průzkum, žádné změny v kódu

---

## 1. Krátké shrnutí hry

**PayToWin.cz** je multiplayer desková hra inspirovaná Dostihy a sázky.

**Herní loop:**
1. Hráč hodí kostkou (1–6); volitelně zaplatí 600 💰 za korekci ±1 kroku
2. Figurka se animuje pole po poli po 21polní dráze
3. Podle pole se spustí akce: zisk/ztráta coinů, karta Náhoda/Finance/Mafia, nebo nabídka koupě závodníka
4. Pending stavy (`horse_pending`, `card_pending`, `offer_pending`) se zapíší do Supabase — Realtime doručí změnu všem klientům
5. Po vyřešení pendingu se zavolá `finishTurn` → posun na dalšího hráče + stamina regen
6. Bankrot při coins ≤ 0; hra končí, když zbývá ≤ 1 aktivní hráč

**Herní režimy:** Online multiplayer (Supabase Realtime, max 32 hráčů), Lokální hot-seat (1 zařízení)

**Vedlejší minihry:** Závody (mass_race / rivals_race), Stable Duel (neon rope / speed race / legendary)

**Boti:** Server actions (`bot-actions.ts`) + hook `useOnlineBotTrigger` — bot tah je triggerován owner klientem přes setTimeout → server action s turn_count guard.

---

## 2. Načtené zdroje

### Dokumentace
| Soubor | Obsah |
|---|---|
| `docs/ARCHITECTURE.md` | Vrstvy, datový tok, CenterEvent systém, board/theme oddělení |
| `docs/ENGINE.md` | Pure helpery, extraction roadmap, known debt |
| `docs/claude/stable-duel-architecture.md` | Stable Duel stavový stroj, guards, PvP sync |
| `STATUS.md` | Popis herní mechaniky, DB schéma, url struktura |
| `about.md` | Herní funkcionalita přehled |
| `bot_audit_2.md` | Detailní audit bot implementace, DB write sekvence, rizika |
| `future_todo.md` | Plánované feature |

### Klíčové kódové soubory
| Soubor | Řádky | Role |
|---|---|---|
| `app/components/GameBoard.tsx` | **3 416** | Hlavní orchestrátor — State, Realtime, herní akce |
| `app/game/bot-actions.ts` | 510 | Server actions pro bot tahy |
| `app/components/board/hooks/useOnlineBotTrigger.ts` | 77 | Hook pro spuštění bota |
| `lib/engine.ts` | — | Pure herní výpočty (bez React/Supabase) |
| `lib/minigames/settlement.ts` | — | Stable Duel výsledkový výpočet |
| `app/components/StableDuelBoardLayer.tsx` | — | Duel overlay UI |

---

## 3. Aktuální stabilizační rizika

### 🔴 KRITICKÉ

#### R-1: GameBoard.tsx jako monolith s vysokou regresní plochou
- **Popis:** GameBoard.tsx má 3 416 řádků, 56 `useState`, 36 `useRef`, 33 `useEffect`. Je to jeden komponent, který řídí načtení hry, Realtime subscriptions, animaci figurek, herní logiku, Stable Duel flow, race flow, bankrot, fog of war, scenario systém i sound.
- **Proč rizikové:** Jakákoliv změna (i malá) může neúmyslně ovlivnit jiný useEffect nebo stateový kus. Propojení mezi hooks je komplexní — refactoring bez regresí je obtížný. Přidávání nové funkcionality sem dál zvyšuje riziko.
- **Dopad:** Regrese ve stávající herní mechanice, nevyčistěný state mezi tahy/záwody/duely.
- **Soubory:** `app/components/GameBoard.tsx`

---

### 🟠 VYSOKÉ

#### R-2: Stale closure debt v `finishTurn` a navazujících funkcích
- **Popis:** Na 7+ místech v GameBoard jsou dokumentované workaroundy pro stale closures. Nejkritičtější:
  - `finishTurn` čte `players` ze stale closure pro stamina regen (proto existuje parametr `updatedCurrentPlayerHorses`)
  - `clearOfferPending` v `finishTurn` **nedělá DB compare** — obsahuje TODO: "does not compare against the latest DB row"
  - `applyCardEffect` musí být volána přes `applyCardEffectRef.current` kvůli 7s timeru
  - `closeBankruptAnnouncement` stejný pattern přes ref
- **Proč rizikové:** Pokud caller zapomene předat `updatedCurrentPlayerHorses`, stamina regen přepíše nově koupené koně stale hodnotou z closure. `clearOfferPending` bez DB compare může smazat nesouvisející offer_pending v race condition.
- **Dopad:** Ztracení zakoupených závodníků po tahu; nebo zachování starého offer_pending po duelu (stuck game state).
- **Soubory:** `GameBoard.tsx:1671`, `GameBoard.tsx:1767`, `GameBoard.tsx:1688–1691`, `GameBoard.tsx:1619`

#### R-3: Stable Duel online_1v1 — defender refresh → stuck state
- **Popis:** Pokud **defender refreshuje stránku** poté, co hra přejde do fáze `"started"` (timer dobíhá), overlay se mu znovu neotevře. Dokumentováno v `docs/claude/stable-duel-architecture.md` jako TODO.
- **Proč rizikové:** Defender vidí prázdnou stránku bez overlay; hra čeká na výsledek, ale defender nemůže nic udělat. Hra je fakticky zablokována, dokud challenger nedokončí minihru a nezapíše výsledek.
- **Dopad:** Hra se z pohledu defendera tváří jako zamrzlá. Reálný hráčský zážitek: "hra nereaguje".
- **Soubory:** `StableDuelBoardLayer.tsx`, `GameBoard.tsx:~2426–2502`

#### R-4: `npm run lint` je nefunkční
- **Popis:** Příkaz `npm run lint` (resp. `next lint`) je deprecated a spustí interaktivní průvodce místo běžné validace. Žádný `.eslintrc.json` ani `eslint.config.js` není přítomen. Jediná automatická validace, která funguje, je `npx tsc --noEmit` (TypeScript check prošel čistě).
- **Proč rizikové:** Vývojáři nemají rychlou zpětnou vazbu na syntaktické a style problémy. Budoucí chyby (unused imports, `any` typ, missing deps v useEffect) projdou bez upozornění.
- **Dopad:** Střední — neovlivňuje runtime, ale zvyšuje pravděpodobnost bugů v kódu.
- **Soubory:** `package.json`, chybí `.eslintrc.json` / `eslint.config.js`

---

### 🟡 STŘEDNÍ

#### R-5: Bot + `card_pending` → tichý stuck state
- **Popis:** `useOnlineBotTrigger` má podmínku `!gameState.card_pending` — pokud je nastaveno `card_pending` a hráč na tahu je bot, hook nic nespustí. Za normální hry boti `card_pending` nenastavují (karty aplikují okamžitě v server action). Ale při race condition nebo DB chybě by mohl `card_pending` zůstat viset.
- **Proč rizikové:** Hra by se v takovém stavu zastavila bez vizuálního indikátoru pro hráče. 7s auto-apply timer v GameBoard funguje jen pro lidské hráče (spustí `applyCardEffect`), ne pro boty. Pro boty neexistuje timeout ani fallback.
- **Dopad:** Hra se zastaví; restart stránky nepomůže (state je v DB).
- **Soubory:** `useOnlineBotTrigger.ts:50`, `GameBoard.tsx:1623`

#### R-6: `useOnlineBotTrigger` — dep array záměrně vynechává `players`
- **Popis:** Effect se záměrně nespoléhá na `players` (komentář v kódu: "mění se při každém refreshi a způsobovaly by restart timeru"), ale uzavírá stale `players[0]?.id` pro owner check.
- **Proč rizikové:** Ve standardní hře `players[0]` nikdy nemění ID. Ale pokud by hráč #0 odpojil před dokončením tahu bota, owner check by selhal — bot by čekal na neexistujícího owner klienta.
- **Dopad:** Bot by přestal hrát; hra se zastaví.
- **Soubory:** `useOnlineBotTrigger.ts:35`, `useOnlineBotTrigger.ts:63`

#### R-7: Stable Duel — chybějící Broadcast timeout/fallback
- **Popis:** V online_1v1 duelu defender posílá input přes Supabase Broadcast channel. Challenger (authority) tyto inputy čte. Ale není implementovaný žádný timeout pro případ, kdy defender nic neposílá (odpojení, lag).
- **Proč rizikové:** Duel visí v nekonečné simulaci na straně challengera. Bez timeoutu musí hráč ručně refreshnout nebo opustit hru.
- **Dopad:** Střední — týká se pouze online_1v1 mód, který je zatím za `localStorage` toggle.
- **Soubory:** `docs/claude/stable-duel-architecture.md#Známá rizika`

---

### 🟢 NÍZKÉ

#### R-8: Bot year events se nespouštějí
- **Popis:** Dokumentováno v `docs/ENGINE.md` — "Bot year events: Bot flow nespouští year eventy při průchodu STARTem."
- **Dopad:** Minor UX nekonzistence — lidský hráč vidí telegram při průchodu STARTem, bot ne.
- **Soubory:** `bot-actions.ts:~200`

#### R-9: Defender stamina se neodečítá po Stable Duel
- **Popis:** Flag `STABLE_DUEL_APPLY_BOT_STAMINA_LOSS = false` záměrně vypnutý.
- **Dopad:** Defender neztrácí staminu po duelu — asymetrie vůči challengerovi.
- **Soubory:** `lib/minigames/settlement.ts`, `docs/claude/stable-duel-architecture.md`

#### R-10: Validátor desky loguje chyby, ale nevyhazuje exception
- **Popis:** `validateBoardConfig()` a `validateThemeManifest()` logují přes `console.error` ale vrací bool. V produkci je nelze zachytit automaticky.
- **Dopad:** Chybná konfigurace desky/theme by prošla bez pádu — hráč by viděl buggy herní stav.
- **Soubory:** `lib/board/validator.ts`

---

## 4. Nejpravděpodobnější zdroje reálných bugů při hraní

### Bot se zasekne a hra se zastaví
- **Scénář:** Race condition v DB write → `card_pending` zůstane nastaveno při bot tahu
- **Symptom:** Hra nereaguje; tlačítko "Hoď kostkou" se pro nikoho nezobrazí
- **Frekvence:** Vzácné, ale game-breaking
- **Riziko:** R-5

### Zakoupený závodník po tahu zmizí (regen přepsal koně)
- **Scénář:** Caller `finishTurn` nezapomněl předat `updatedCurrentPlayerHorses`, ale closure je stale
- **Symptom:** Hráč koupí závodníka → po tahu se závodník nezobrazuje v seznamu
- **Frekvence:** Nízká (workaround je implementovaný pro `buyRacer`), ale nový caller by ho mohl vynechat
- **Riziko:** R-2

### Defender v Stable Duelu vidí prázdnou stránku
- **Scénář:** Defender refreshuje stránku ve fázi `"started"` (po odpočtu, před koncem duelu)
- **Symptom:** Blank stránka / chybějící overlay; defender nemůže nic udělat
- **Frekvence:** Střední — refresh stránky je přirozená záchrana pro stuck games
- **Riziko:** R-3

### Offer_pending z jiného duelu přepíše aktuální pending
- **Scénář:** Dva Stable Duely v rychlém sledu; `clearOfferPending` nedělá DB compare
- **Symptom:** Duel se neuzavře správně; hra přeskočí turn nebo zablokuje dalšího hráče
- **Frekvence:** Velmi nízká (vyžaduje přesné timing), ale obtížně debugovatelná
- **Riziko:** R-2

---

## 5. Doporučený další stabilizační krok

### Přidat funkční lint + typecheck do `package.json`

**Co:** Přidat `.eslintrc.json` s Next.js konfigurací a přidat script `"typecheck"` do `package.json`.

**Proč tento krok:** 
- Zero riziko regrese — nemění žádnou herní logiku
- Okamžitě testovatelné: `npm run typecheck` + `npm run lint` projdou nebo selžou deterministically
- Poskytuje safety net pro všechny budoucí stabilizační kroky
- `tsc --noEmit` aktuálně prochází čistě → máme baselinepoint

**Konkrétní změny:**

1. Přidat do `package.json`:
```json
"typecheck": "tsc --noEmit",
```

2. Vytvořit `.eslintrc.json`:
```json
{
  "extends": "next/core-web-vitals",
  "rules": {
    "react-hooks/exhaustive-deps": "warn"
  }
}
```

**Validace:** `npm run typecheck` + `npm run lint` musí projít bez errors.

---

## 6. Co zatím nedělat

| Oblast | Proč ne |
|---|---|
| Velký refactoring GameBoard.tsx | 3 416 řádků, příliš mnoho propojených stavů — každý refactor je riskantní regrese |
| Přepis `applyCardEffect` | Chain guard a horse_pending flow jsou jemné — ENGINE.md explicitně říká "nedělat teď" |
| Landing field resolution extrakce | Entangled s horse_pending, chain guard depth=1, rent skip — extrakce by přidala abstrakci bez redukce komplexity |
| Real PvP input sync dokončení | Záměrně vynecháno (docs/claude/stable-duel-architecture.md) |
| Reward persistence pro stable-collector | Závisí na event logu, který ještě neexistuje |
| Final Race implementace | Příliš velký nový feature |
| Defender stamina fix | Izolovaný, ale vyžaduje re-audit settlement výpočtu + ověření, že defender klient neprovádí double-zápis |
| clearOfferPending atomický compare | Vyžaduje buď Postgres transakci / RPC nebo kompletní refactor finishTurn na useCallback s live gameState dep |

---

## 7. Doporučený implementační prompt

Následující prompt je určen pro **samostatné vlákno**, které bude implementovat první stabilizační krok. Neobsahuje kontext z tohoto vlákna.

---

```
Název: Přidání funkčního `typecheck` scriptu a ESLint konfigurace do PayToWin.cz

Kontext:
Pracuji na Next.js 15 + TypeScript projektu paytowin.cz. Projekt momentálně nemá funkční
`npm run lint` — příkaz `next lint` je deprecated a ptá se interaktivně, žádný `.eslintrc.json`
ani `eslint.config.js` neexistuje. Příkaz `npx tsc --noEmit` prochází čistě (0 chyb).

Úkol:
Proveď POUZE tyto minimální změny:

1. Do `package.json` přidej script:
   "typecheck": "tsc --noEmit"
   (přidej ho vedle existujících scriptů, neměň ostatní)

2. Vytvoř soubor `.eslintrc.json` v kořeni projektu s obsahem:
   {
     "extends": "next/core-web-vitals",
     "rules": {
       "react-hooks/exhaustive-deps": "warn"
     }
   }
   (ne "error" — jen "warn", abychom viděli existující problémy aniž build selže)

3. Spusť `npm run typecheck` — musí projít s 0 chybami.

4. Spusť `npm run lint` — může vykazovat warningy (to je v pořádku), ale nesmí selhat na setup error.

Guardrails:
- Neměň žádný herní kód.
- Neměň GameBoard.tsx, bot-actions.ts, ani žádné lib/* soubory.
- Neodstraňuj existující eslint-disable komentáře.
- Pokud `npm run lint` reportuje chyby (ne warningy), napiš je do výstupu ale neopravuj je.

Výstup:
1. Jaké soubory jsi změnil
2. Výsledek `npm run typecheck`
3. Výsledek `npm run lint` (počet warnings, případné errors)
4. Zda jsou dál použitelné jako baseline pro další iterace
```

---

## Poznámky k validaci tohoto auditu

| Validace | Výsledek |
|---|---|
| `npx tsc --noEmit` | ✅ 0 chyb |
| `npm run lint` | ❌ Nefunkční — `next lint` je deprecated, ptá se interaktivně |
| `npm test` | Není k dispozici (žádný test script v `package.json`) |
| `npm run build` | Nespouštěno (audit only) |

**Poznámka:** TypeScript check prošel čistě — codebase je typově konzistentní. Absence ESLint znamená, že react-hooks/exhaustive-deps problémy (dokumentované stale closures) nejsou automaticky hlášeny.

---

## Audit ovládání soubojů a local play

**Datum:** 2026-05-26  
**Rozsah:** všechny komponenty se keyboard handlery v soubojích, závodech a minihrách

---

### Ověřený aktuální mapping (podle kódu)

Prošel jsem tyto soubory s keyboard listenery:

| Soubor | Typ handleru |
|---|---|
| `app/components/duel/DuelArena.tsx` | keydown/keyup, window-level |
| `app/components/StableDuelBoardLayer.tsx` | keydown/keyup, defender_remote handler |
| `app/components/speed/SpeedArenaPvp.tsx` | keydown/keyup, window-level |
| `app/components/speed/SpeedArena.tsx` | keydown/keyup, window-level |
| `app/components/legendary/LegendaryHorseRaceArena.tsx` | keydown/keyup, window-level |
| `app/components/race/RacingMinigame.tsx` | keydown, single-player per-turn |
| `app/components/RaceModal.tsx` | keydown, sprint tap |
| `app/components/speed/SpeedDevShell.tsx` | UI labels only (no handler) |
| `app/components/legendary/LegendaryRaceDevShell.tsx` | UI labels only (no handler) |

---

### Tabulka komponent a skutečného mappingu (z kódu)

| Komponenta | Mód | P1 doleva | P1 doprava | P1 akce | P2 doleva | P2 doprava | P2 akce |
|---|---|---|---|---|---|---|---|
| **DuelArena** | pvbot (solo vs bot) | `A` | `D` | `Space` | — | — | — |
| **DuelArena** | pvp (local 2-player) | `A` | `D` | `Space` | `Arrow←` | `Arrow→` | `S` |
| **StableDuelBoardLayer** | prestart UI label | A | D | SPACE | ← | → | S |
| **StableDuelBoardLayer** | defender_remote | — | — | — | `Arrow←` | `Arrow→` | `S` |
| **SpeedArena** | solo / pvbot | `A` nebo `Arrow←` | `D` nebo `Arrow→` | `Space` | — | — | — |
| **SpeedArenaPvp** | local PvP | `Arrow←` ⚠ | `Arrow→` ⚠ | `Space` | `A` ⚠ | `D` ⚠ | `S` |
| **SpeedDevShell** | dev shell UI label | `← →` ⚠ | — | `SPACE` | `A D` ⚠ | — | `S` |
| **LegendaryHorseRaceArena** | local 2-player | — | — | `Space` | — | — | `S` |
| **RacingMinigame** | sequential solo | `Arrow←` | `Arrow→` | — | N/A | N/A | N/A |
| **RaceModal** | sprint tap | `a` nebo `l` | — | — | N/A | N/A | N/A |

⚠ = Nesoulad s cílovým mappingem nebo s ostatními komponentami.

---

### Nalezené nesoulady

#### 1. SpeedArenaPvp — P1 a P2 pohyb je OBRÁCENÝ oproti DuelArena

Největší nesoulad. V `DuelArena.tsx` (Neon Rope Duel) platí:
- P1 = WASD (`A`/`D`)
- P2 = šipky (`Arrow←`/`Arrow→`)

V `SpeedArenaPvp.tsx` (Speed Race) je to přesně naopak:
- P1 = **šipky** (`Arrow←`/`Arrow→`)
- P2 = **WASD** (`A`/`D`)

Kód v `SpeedArenaPvp.tsx:210–211`:
```ts
const p1Input = keys.has("ArrowLeft") ? "left" : keys.has("ArrowRight") ? "right" : "none";
const p2Input = keys.has("KeyA") ? "left" : keys.has("KeyD") ? "right" : "none";
```

UI label v `SpeedDevShell.tsx:157–162` toto potvrzuje:  
`P1: ← →` zatočit · `SPACE` nitro  
`P2: A D` zatočit · `S` nitro

#### 2. Akce (nitro/boost) — P1 a P2 má swapnuté klávesy vs cílový stav

Aktuální stav (ve všech komponentách):
- P1 akce = `Space` (mezerník)
- P2 akce = `S`

Cílový stav:
- P1 akce = `S`
- P2 akce = `Space` (mezerník)

Dotčené komponenty: `DuelArena.tsx`, `SpeedArenaPvp.tsx`, `SpeedArena.tsx`, `LegendaryHorseRaceArena.tsx`

#### 3. StableDuelBoardLayer defender_remote — akce klávesa je S, cílová je Space

Defender v online_1v1 posílá nitro/legendary přes `KeyS`. Cílový stav: `Space`.

Kód v `StableDuelBoardLayer.tsx:853`:
```ts
} else if (e.code === "KeyS") {
  sendInput(p2IsLegendary ? { action: "legendary" } : { action: "nitro" });
}
```

#### 4. LegendaryRaceDevShell — UI hint "Nitro: Space/S (v přípravě)" je nekonkrétní

Dočasný placeholder, ale matoucí — neříká, která klávesa je pro koho.

#### 5. RacingMinigame — odlišná sada kláves (záměrně)

`RacingMinigame.tsx` používá `Arrow←`/`Arrow→`/`Arrow↑` pro pohyb v překážkách a sprint. Tato minigra je **sekvenční solo** — každý hráč hraje samostatně, není local 2-player. Klávesy jsou proto jiné a to je **záměrné a správné** — bez konfliktu.

#### 6. RaceModal — sprint tap klávesy `a` nebo `l`

`RaceModal.tsx` má starší sprint mechaniků používající `key.toLowerCase() === "a"` nebo `"l"`. Týká se mass_race sprintu. Nezávislé na P1/P2 konfliktu — opět sekvenční solo.

---

### Cílový mapping

| Hráč | Doleva | Doprava | Akce (nitro / boost / skok) |
|---|---|---|---|
| **Hráč 1 (Challenger / P1)** | `A` | `D` | `S` |
| **Hráč 2 (Defender / P2)** | `Arrow←` | `Arrow→` | `Space` |

Toto je konzistentní se **WASD + S pro levou ruku** (hráč 1 sedí vlevo) a **šipky + mezerník pro pravou ruku** (hráč 2 sedí vpravo). Ergonomicky to dává smysl na sdílené klávesnici.

---

### Doporučený implementační plán

#### Krok 0 (příprava) — vytvořit konstanty pro klávesy

Nový soubor `lib/game-controls.ts` (~8 řádků):

```ts
export const P1_KEYS = {
  left:   "KeyA",
  right:  "KeyD",
  action: "KeyS",
} as const;

export const P2_KEYS = {
  left:   "ArrowLeft",
  right:  "ArrowRight",
  action: "Space",
} as const;
```

Toto je volitelné — komponenty mohou strings použít přímo. Ale jednorázový soubor zabrání dalšímu rozjíždění mappingů.

#### Krok 1 — DuelArena.tsx (Neon Rope Duel) — swap akce

**Změny:**
1. Keyboard handler: `Space` → P1 akce, `KeyS` → P2 akce → swap na: `KeyS` → P1, `Space` → P2
2. UI HUD text: `"SPACE P1"` → `"S P1"`, `"P2 S"` → `"P2 SPACE"`
3. Idle overlay text: `"A / D"` zůstává, klávesy akce opravit
4. LegendaryBadge label: `"LEGENDARY · SPACE"` → `"LEGENDARY · S"` (P1 side)
5. LegendaryBadge label: `"LEGENDARY · S"` → `"LEGENDARY · SPACE"` (P2 side)

**Soubor:** `app/components/duel/DuelArena.tsx`  
**Riziko:** Nízké — izolovaná komponenta, jasně testovatelné lokálně

#### Krok 2 — SpeedArenaPvp.tsx (Speed Race) — swap P1/P2 pohyb + akce

**Změny:**
1. Keyboard handler: swap P1 (Arrow→WASD) a P2 (WASD→Arrow) pro pohyb
2. Keyboard handler: `Space` → P1, `KeyS` → P2 → swap na `KeyS` → P1, `Space` → P2
3. UI start-screen labels: přepsat P1/P2 řádky
4. UI HUD: `"P1 SPACE"` → `"P1 S"`, `"P2 S"` → `"P2 SPACE"`

**Soubor:** `app/components/speed/SpeedArenaPvp.tsx`  
**Riziko:** Střední — kompletní swap pohybových kláves. Nutno otestovat obě strany.

#### Krok 3 — SpeedArena.tsx (Speed Race solo) — swap akce

**Změny:**
1. Keyboard handler: `Space` → `KeyS` pro nitro trigger
2. UI text: `"SPACE"` → `"S"` kde se zobrazuje uživateli

**Soubor:** `app/components/speed/SpeedArena.tsx`  
**Riziko:** Nízké — solo hra, jednoduchá změna jedné klávesy

#### Krok 4 — StableDuelBoardLayer.tsx — swap akce + defender remote

**Změny:**
1. Prestart UI label: `"SPACE"` → `"S"` pro Challenger, `"S"` → `"SPACE"` pro Defender
2. Defender keyboard handler (`defender_remote`): `e.code === "KeyS"` → `e.code === "Space"`, přidat `Space` do `preventDefault` listu

**Soubor:** `app/components/StableDuelBoardLayer.tsx`  
**Riziko:** Střední — ovlivňuje online multiplayer flow. Defender input se posílá Broadcast channelem.

#### Krok 5 — LegendaryHorseRaceArena.tsx — swap akce

**Změny:**
1. Keyboard handler: `Space` → P1, `KeyS` → P2 → swap
2. Pokud existuje UI label, aktualizovat

**Soubor:** `app/components/legendary/LegendaryHorseRaceArena.tsx`  
**Riziko:** Nízké — izolovaná komponenta

#### Krok 6 — SpeedDevShell.tsx — opravit UI labels

**Změny (UI text only, žádný keyboard handler):**
- `"P1: ← →"` → `"P1: A D"`
- `"P2: A D"` → `"P2: ← →"`
- `"SPACE nitro"` → `"S nitro"` (P1)
- `"S nitro"` → `"SPACE nitro"` (P2)

**Soubor:** `app/components/speed/SpeedDevShell.tsx`  
**Riziko:** Minimální — dev shell, jen UI text

---

### Soubory k úpravě — přehled

| Soubor | Typ změny | Keyboard logika | UI text | Riziko |
|---|---|---|---|---|
| `lib/game-controls.ts` (nový) | Nový soubor | — | — | Nulové |
| `app/components/duel/DuelArena.tsx` | Swap akce | ✅ | ✅ | Nízké |
| `app/components/speed/SpeedArenaPvp.tsx` | Swap pohyb + akce | ✅ | ✅ | Střední |
| `app/components/speed/SpeedArena.tsx` | Swap akce | ✅ | ✅ | Nízké |
| `app/components/StableDuelBoardLayer.tsx` | Swap akce + defender remote | ✅ | ✅ | Střední |
| `app/components/legendary/LegendaryHorseRaceArena.tsx` | Swap akce | ✅ | případně | Nízké |
| `app/components/speed/SpeedDevShell.tsx` | UI labels only | — | ✅ | Minimální |

Nedotčené soubory (záměrně odlišné):
- `app/components/race/RacingMinigame.tsx` — sekvenční solo, šipky jsou správné
- `app/components/RaceModal.tsx` — sekvenční solo, sprint tap, odlišný kontext

---

### Rizika implementace

| Riziko | Závažnost | Poznámka |
|---|---|---|
| Hráči jsou zvyklí na staré ovládání | Nízká | Hra je ve vývoji, hráčská základna malá |
| SpeedArenaPvp full swap: P1 dostane WASD místo šipek | Střední | Nutno ověřit, že swap je v kódu i v UI konzistentní |
| Defender v online_1v1 pošle akci přes Space místo S | Střední | Broadcast payload se nemění, jen triggerující klávesa |
| Space je systemová klávesa (scroll stránky) | Nízké | `e.preventDefault()` je implementované ve všech handlerech — nutno ověřit po změně |
| Komponenty sdílí jeden `window` event listener | Nízké | Pokud jsou dvě minihry najednou otevřeny (není možné v normálním flow), mohou se klávesy křížit |
| Legendary ability — P2 legendary akce přes Space | Nízké | Nutno ověřit, že Broadcast channel odesílá správnou akci při Space klávese |

---

### Doporučený první implementační krok (pro toto téma)

**Nejmenší bezpečná první změna:** Krok 6 — `SpeedDevShell.tsx` UI labels.

Proč:
- Nulové riziko (jen text, dev shell)
- Okamžitě verifikovatelné vizuálně
- Žádná herní logika
- Ideální jako "dry run" pro zjištění, jestli jsou další soubory zapomenuté

Druhý krok: Krok 1 — `DuelArena.tsx` swap akce (Space ↔ S).  
Je izolovaný, jasně testovatelný: otevřít dev duel shell, vyzkoušet obě klávesy.

---

### Kopírovatelný implementační prompt pro další vlákno

```
Název: Sjednocení klávesového ovládání soubojů a závodů — PayToWin.cz

Kontext:
Pracuji na Next.js 15 hře PayToWin.cz. Minihrám (Neon Rope Duel, Speed Race, Legendary Race)
chybí jednotné klávesové ovládání pro local 2-player. Auditoval jsem všechny keyboard handlery.

Aktuální stav (z kódu):
- DuelArena: P1 = A/D/Space, P2 = Arrow←/Arrow→/S
- SpeedArenaPvp: P1 = Arrow←/Arrow→/Space (OBRÁCENO), P2 = A/D/S (OBRÁCENO)
- LegendaryHorseRaceArena: P1 = Space, P2 = S
- StableDuelBoardLayer defender (online): posílá S pro akci

Cílový stav:
- Hráč 1 (Challenger / P1 / levá ruka): A = doleva, D = doprava, S = nitro/akce
- Hráč 2 (Defender / P2 / pravá ruka): Arrow← = doleva, Arrow→ = doprava, Space = nitro/akce

Implementuj POUZE tyto změny v tomto pořadí:

KROK 1 — SpeedDevShell.tsx (UI text only, nulové riziko)
Soubor: app/components/speed/SpeedDevShell.tsx
- "P1: ← →" → "P1: A D"
- "P2: A D" → "P2: ← →"
- "SPACE nitro" (P1 řádek) → "S nitro"
- "S nitro" (P2 řádek) → "SPACE nitro"

KROK 2 — DuelArena.tsx (Neon Rope Duel)
Soubor: app/components/duel/DuelArena.tsx
- Keyboard handler: e.code === "Space" → P1 akce, e.code === "KeyS" → P2 akce → SWAP
  (Space bude P2, KeyS bude P1)
- HUD text: "SPACE P1" → "S P1" (linka ~419), "P2 S" → "P2 SPACE" (linka ~425)
- Idle overlay controls text: aktualizuj klávesy akce
- LegendaryBadge label: "LEGENDARY · SPACE" → "LEGENDARY · S" (P1), "LEGENDARY · S" → "LEGENDARY · SPACE" (P2)

KROK 3 — SpeedArenaPvp.tsx (Speed Race PvP)
Soubor: app/components/speed/SpeedArenaPvp.tsx
- Keyboard handler pohyb (linka ~210-211): 
  P1 klávesy: ArrowLeft/ArrowRight → KeyA/KeyD
  P2 klávesy: KeyA/KeyD → ArrowLeft/ArrowRight
- Keyboard handler akce (linka ~185-186):
  Space → P1, KeyS → P2 → SWAP (Space bude P2, KeyS bude P1)
- UI start-screen labels (linka ~343-349):
  "P1: ← → · SPACE nitro" → "P1: A D · S nitro"
  "P2: A D · S nitro" → "P2: ← → · SPACE nitro"
- HUD labels: "P1 SPACE" → "P1 S", "P2 S" → "P2 SPACE"

KROK 4 — SpeedArena.tsx (solo / pvbot)
Soubor: app/components/speed/SpeedArena.tsx
- Keyboard handler akce: e.code === "Space" → e.code === "KeyS"
- Přidej "KeyS" do preventDefault listu (místo nebo vedle "Space")
- UI text "SPACE" → "S" kde se zobrazuje hráči

KROK 5 — LegendaryHorseRaceArena.tsx
Soubor: app/components/legendary/LegendaryHorseRaceArena.tsx
- Keyboard handler: p1Jump: keys.has("Space") → keys.has("KeyS")
                    p2Jump: keys.has("KeyS") → keys.has("Space")
- Přidej/oprav preventDefault: "KeyS" a "Space" oba by měly být preventovány

KROK 6 — StableDuelBoardLayer.tsx
Soubor: app/components/StableDuelBoardLayer.tsx
Část A — Prestart overlay UI text (hledej sekci "OVLÁDÁNÍ"):
  NeonKeyCap label="SPACE" (Challenger) → label="S"
  NeonKeyCap label="S" (Defender) → label="SPACE"
Část B — Defender remote keyboard handler (hledej duelRole === "defender_remote"):
  e.code === "KeyS" → e.code === "Space"
  Přidej "Space" do preventDefault listu: ["ArrowLeft", "ArrowRight"] → ["ArrowLeft", "ArrowRight", "Space"]

Guardrails:
- Neimplementuj nic mimo výše popsaných změn.
- Neměň herní logiku, scores, stamina ani žádnou gameplay mechaniku.
- Neměň soubory RacingMinigame.tsx ani RaceModal.tsx (sekvenční solo, záměrně odlišné).
- Neměň GameBoard.tsx.
- Po každém kroku spusť: npx tsc --noEmit
- Po dokončení všech kroků napiš výsledek: které soubory jsi změnil + výsledek tsc.

Validace pro každý krok:
- tsc --noEmit musí projít s 0 chybami
- Ověř ručně: v dev shellu (DevDuelShell, SpeedDevShell) vyzkoušej obě klávesy
```
