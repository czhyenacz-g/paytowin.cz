# Rent feedback current state

Datum: 2026-06-09  
Stav: read-only audit, žádné změny v kódu

---

## 1. Kde se rent feedback řeší

| Oblast | Soubor | Přibližné řádky |
|---|---|---|
| Rent platba člověkem | `app/components/GameBoard.tsx` | 961–1029 |
| Rent platba botem | `app/game/bot-actions.ts` | 296–316 |
| Feedback funkce (coins, major) | `app/components/GameBoard.tsx` | 311–319 (import z hooků) |
| Board pole glow (vlastník) | `app/components/board/FieldCardList.tsx` | 75, 96–116 |
| Hover panel (vlastník) | `app/components/center-panel/BoardCenterPanel.tsx` | 101–127 |
| FieldDetail / MetaLabel | `lib/board/fieldHelpers.ts` | 3–30 |
| racerOwnership mapa | `lib/game/gameBoardViewModel.ts` | 12–16 |
| Sestavení mapy v GameBoard | `app/components/GameBoard.tsx` | 2585 |

---

## 2. Co vidí plátce

### Člověk

Při přistání na cizím racer poli (rent fallback, tj. když alespoň jeden z hráčů nemá koně):

1. **Tah neprobíhá** — žádný pending modal (na rozdíl od horse_pending purchase flow)
2. **Coins se okamžitě sníží** — GameBoard aktualizuje lokální `players` state + RPC
3. **Textový log se doplní** (viz sekce 4)
4. **showCoinsFeedback — NEVOLÁ SE** — funkce se nepoužívá pro rent platbu
5. **showMajorLoss — NEVOLÁ SE** — ani při vysokém nájmu
6. **playSfx — POUZE při bankrotu** — `playSfx("bankrupt")` se spustí pokud hráč po zaplacení nájmu zkrachuje
7. **BankruptWarning modal** — zobrazí se pokud `wouldBankruptRent = true` (coins by šly do záporných); nabídne prodej koní za 80 % hodnoty

### Bot

Bot nemá UI — platba proběhne tichce server-side. Z pohledu ostatních klientů:
- Realtime update na `players` tabulce → `refreshGame` → zobrazí nové coins bota
- Log se zobrazí v herním panelu (viz sekce 4)

---

## 3. Co vidí majitel

Majitel dostane peníze **passivně** — neprobíhá na jeho klientu žádná akce:

1. **Coins se zvýší** — přes Realtime `postgres_changes` na `players` tabulce → `refreshGame(gameId)` → `setPlayers(normalized)` → číslo coins se aktualizuje v UI
2. **Textový log** — zobrazí se v herním panelu (stejný text jako vidí plátce)
3. **showMajorGain — NEVOLÁ SE** — žádný velký zelený overlay
4. **showCoinsFeedback — NEVOLÁ SE** — žádný coins toast
5. **playSfx — NESPUSTÍ SE** — žádný zvuk pro příjem nájmu
6. **Toast/notification — NEEXISTUJE** — žádný explicitní "dostali jste nájem" feedback

---

## 4. Log texty

### Člověk platí nájem

```
"${player.name} zaplatil ${rent} 💰 hráči ${owner.name} za ${racer.emoji} ${racer.name}"
```

Příklady:
- `"Pavel zaplatil 240 💰 hráči Jana za 🐎 Divoká Růže"`

Pokud plátce nemá koně (a tedy nemohl být Stable Duel):
```
"${player.name} ještě nemá koně na souboj — platí nájem."
```
→ připojí se jako druhý řádek logu.

Pokud plátce po nájmu zkrachoval:
```
"💀 ${player.name} zkrachoval!"
```

Pokud plátce prodal koně a přežil (forced sell):
```
"${player.name} prodal koně a přežil! 💰"
```

### Bot platí nájem

```
"${bot.name} zaplatil nájem ${rent} 💰 hráči ${owner.name} za ${racer.emoji} ${racer.name}"
```

Příklady:
- `"Kometa zaplatil nájem 600 💰 hráči Pavel za 🐎 Bouřlivák"`

**Drobná nekonzistence**: bot log obsahuje slovo `"nájem"`, human log ne.

### Vlastní pole (bez nájmu)

```
"${player.name} přijel ke své ${theme.labels.racerField.toLowerCase()}: ${racer.emoji} ${racer.name}"
```

Příklady:
- `"Pavel přijel ke své stáji: 🐎 Divoká Růže"` (horse theme)
- `"Pavel přijel ke své garáži: 🚗 Blesk"` (car theme)

---

## 5. Toasty / overlaye / zvuky

| Typ feedbacku | Člověk platí | Bot platí | Majitel přijímá | Poznámka |
|---|---|---|---|---|
| Textový log | ✅ Ano | ✅ Ano | ✅ Ano (stejný text) | Zobrazí se všem klientům po `finishTurn` |
| Aktualizace coins čísla | ✅ Ano (okamžitě) | ✅ Ano (Realtime) | ✅ Ano (Realtime) | DB → Realtime → refreshGame |
| showCoinsFeedback toast | ❌ Ne | ❌ Ne | ❌ Ne | Pouze pro coins_gain/lose pole a prodej racera |
| showMajorLoss overlay | ❌ Ne | ❌ Ne | — | Pouze pro coins_lose pole (≥ 500) a Stable Duel |
| showMajorGain overlay | ❌ Ne | — | ❌ Ne | Pouze pro coins_gain pole (≥ 1000) a Stable Duel |
| playSfx ("bankrupt") | ✅ Jen při bankrotu | ❌ Ne | ❌ Ne | Jen plátce, jen pokud zkrachuje |
| BankruptWarning modal | ✅ Jen při hrozícím bankrotu | ❌ Ne | ❌ Ne | Nabídne forced sell |
| showTelegram | ❌ Ne | ❌ Ne | ❌ Ne | Pouze pro year events a závody |
| Board pole glow | — | — | ✅ Persistentní | Vlastníkova barva svítí kolem pole |

---

## 6. Board / vlastník na poli

### FieldCardList.tsx — glow efekt

`buildRacerOwnership(players)` sestaví mapu `racerKey → Player` ze **všech hráčů** (včetně bankrotovaných):

```ts
// lib/game/gameBoardViewModel.ts:12
export function buildRacerOwnership(players: Player[]): Record<string, Player> {
  const map: Record<string, Player> = {};
  players.forEach(p => p.horses.forEach(h => { map[racerOwnershipKey(h)] = p; }));
  return map;
}
```

Pokud pole má vlastníka (`owner !== null`), karta dostane barevný glow v barvě hráče:
```
drop-shadow(0 0 6px {ownerColor}cc)
drop-shadow(0 0 14px {ownerColor}88)
drop-shadow(0 0 24px {ownerColor}44)
```

**Poznámka**: `detail` a `metaLabel` jsou v FieldCardList sice vypočítány, ale **nikde v komponentě nevyrenderovány** — jsou to mrtvé proměnné.

### BoardCenterPanel.tsx — hover panel

Při najetí na racer pole se zobrazí hover overlay s detaily. Pokud pole má vlastníka:

```
[závodník]           ← badge
{racer.name}         ← název
[obrázek racera]     ← pokud existuje
✓ {owner.name}       ← vlastník — jméno hráče
Rychlost:  ⭐⭐⭐··
Stamina:   🔵🔵🔵🔵·  ← runtime stamina vlastníkova koně
```

Pokud pole je volné (žádný vlastník):

```
[závodník]
{racer.name}
[obrázek]
Rychlost:  ⭐⭐⭐··
Max stamina: 🔵🔵🔵🔵·
Cena:      {racer.price} 💰   ← cena je viditelná jen u volného racera
```

### Rozlišení racer polí v UI

| Stav pole | Hover panel | Glow | FieldCard detail (neviditelný) | Karta metaLabel (neviditelný) |
|---|---|---|---|---|
| Volné | cena + stamina | ❌ Žádný | `{price} 💰 ⭐⭐⭐` | `{price} 💰` |
| Vlastní hráče | `✓ {owner}` + stamina | ✅ Barva vlastníka | `✓ {owner}` | `obsazeno` |
| Cizí (živý vlastník) | `✓ {owner}` + stamina | ✅ Barva vlastníka | `✓ {owner}` | `obsazeno` |
| Cizí (bankrotovaný vlastník) | `✓ {owner}` + stamina | ✅ Barva vlastníka | `✓ {owner}` | `obsazeno` |

**UI nerozlišuje živého a bankrotovaného vlastníka.** `buildRacerOwnership` nezahrnuje `!isBankrupt` filtr — pole bankrotovaného hráče stále svítí jeho barvou a hover panel ukazuje jeho jméno.

Přitom po kliknutí (vstup na pole) se chová jako volné — rent lookup bankrotovaného ignoruje, spustí se horse_pending purchase flow.

---

## 7. Neověřené nebo nejasné části

| Oblast | Nejasnost |
|---|---|
| Live Realtime rychlost | Z kódu víme, že DB → Realtime → refreshGame. Jak rychle (ms) coins u majitele naskočí, nelze zjistit bez live testu |
| FieldCardList `detail` a `metaLabel` proměnné | Jsou vypočítány ale nikde nevyrenderovány — buď dead code, nebo původní záměr pro budoucí použití |
| BankruptWarning modal UX | Modal nabídne hráči `sellAll: true/false`. Přesné tlačítky a texty jsou v komponentě BankruptWarning — bez přečtení není jasné, jak silně motivuje k prodeji |
| `playSfx` při rent | Tichá platba nájmu (bez zvuku) je záměrná nebo zapomenutá funkce — kód neobsahuje žádný komentář |
