# Ownership fee audit

Datum: 2026-06-09  
Stav: read-only audit, žádné změny v kódu

---

## 1. Kontext

Pro Dostihy-like demo je klíčovým pravidlem:  
**Když hráč vstoupí na pole s racerem vlastněným jiným hráčem, zaplatí mu poplatek (nájem).**

Toto pravidlo zajišťuje, že vlastnictví racera má trvalou ekonomickou hodnotu — nejen při nákupu,
ale po celou hru. Bez něj by Dostihy-like mechanika nedávala smysl (nákup racera by byl one-shot
investice bez pasivního výnosu).

---

## 2. Současný model racerů a vlastnictví

### Datový model

**Racer (Horse)** — `lib/types/game.ts:68–84`
```ts
interface Horse {
  id?: string;          // catalog ID (slug, e.g. "divoka_ruze")
  name: string;
  speed: number;
  price: number;
  emoji: string;
  maxStamina?: number;  // cap ze katalogu, fallback 100
  stamina?: number;     // runtime hodnota
  isLegendary?: boolean;
  isPreferred?: boolean;
  image?: string;
}
```

**Vlastnictví hráče** — `lib/types/game.ts:106`
```ts
interface Player {
  horses: OwnedRacer[];  // = Horse[], uloženo jako JSONB v DB
  // ...
}
```

Vlastnictví je snapshot racera přidaný do `player.horses` při nákupu.
Není centrální tabulka „kdo vlastní co" — ownership je distribuovaný v JSONB.

### Vyhledávání vlastníka

`lib/engine.ts` exportuje:
- `playerOwnsRacer(player, racer)` — id-first, name fallback pro stará data
- `racerOwnershipKey(racer)` — kanonický klíč `racer.id ?? racer.name`

### Board pole → racer mapování

`BoardConfig.racerSlotIndexes: number[]` — 1:1 mapování na `theme.racers[]`.  
Každé racer pole (typ `"racer"`) má konkrétního racera pevně přiřazeného pozicí v poli.
Racer pole jsou vždy viditelná i v Fog of War módu.

---

## 3. Současný flow vstupu na racer pole

### Rozhodovací strom (stejný pro člověka i bota)

```
Hráč vstoupí na pole type="racer"
│
├── alreadyOwned = playerOwnsRacer(hráč, racer)
│     └── TRUE → vlastní hráč
│                  → log "přijel ke své stáji"
│                  → finishTurn() (žádný poplatek)
│
├── ownerPlayer = jiný hráč s tímto racerem
│     └── canTriggerRivalsRace (oba mají koně)?
│           ├── TRUE  → Stable Duel (minigame)
│           │            → offer_pending: stable_duel_pending
│           │            → tah se nekončí, čeká na výsledek duelu
│           └── FALSE → Rent fallback
│                        → rent = computeRent(racer.price)  [20 % ceny]
│                        → applyRentPayment(payer, owner, rent)
│                        → pay_rent_atomic RPC (atomický DB převod)
│                        → finishTurn()
│
└── žádný vlastník
      → horse_pending = true
      → hráč se rozhodne koupit / přeskočit
```

### Člověk — GameBoard.tsx (řádky 858–1043)

1. Detekce vlastníka: `players.find(p => p.id !== currentPlayer.id && playerOwnsRacer(p, field.racer!))`
2. Stable Duel path: `canTriggerRivalsRace(movedPlayer, ownerPlayer)` — oba mají `horses.length > 0`
3. Rent fallback path:  
   - `computeRent(field.racer.price)` z `lib/engine.ts`
   - `applyRentPayment(movedPlayer, ownerPlayer, rent)` — pure helper, žádný side-effect
   - `supabase.rpc("pay_rent_atomic", { p_game_id, p_payer_id, p_owner_id, p_amount })`  
     → atomický převod na DB úrovni (race condition safe)
   - Bankrupt detection: `wouldBankruptRent → confirmBankruptOrSell(rentedPlayer)`
4. Log: `"${hráč} zaplatil ${rent} 💰 hráči ${majitel} za ${emoji} ${jméno}"`

### Bot — bot-actions.ts (řádky 259–316)

Identická logika:
- Stable Duel path: `movedPlayer.horses.length > 0 && ownerPlayer.horses.length > 0`
- Rent fallback: `computeRent(field.racer.price)` + `pay_rent_atomic` RPC
- Bot používá **stejný** `computeRent` helper jako člověk

---

## 4. Klíčové zjištění: ownership fee je již implementován

**`computeRent` a `applyRentPayment` v `lib/engine.ts` jsou pure helpery a jsou aktivně
používány jak v GameBoard.tsx (člověk), tak v bot-actions.ts (bot).**

Stav k dnešku:

| Mechanismus | Stav |
|---|---|
| Detekce vlastníka | ✅ implementováno |
| Výpočet nájmu (20 % ceny racera) | ✅ `computeRent()` v lib/engine.ts |
| Atomický převod v DB | ✅ `pay_rent_atomic` RPC |
| Člověk platí nájem | ✅ GameBoard.tsx řádky 963–1029 |
| Bot platí nájem | ✅ bot-actions.ts řádky 297–316 |
| Log pro oba hráče | ✅ stejný formát |
| Stable Duel místo nájmu (oba mají koně) | ✅ plně implementováno |
| Bankrupt detekce při nájmu | ✅ `confirmBankruptOrSell` |

---

## 5. Dopad na GameBoard.tsx a návrh extrakce

### Co je již mimo GameBoard

- `computeRent(racerPrice)` → `lib/engine.ts` ✅ pure helper
- `applyRentPayment(payer, owner, amount)` → `lib/engine.ts` ✅ pure helper
- `playerOwnsRacer(player, racer)` → `lib/engine.ts` ✅ pure helper
- `racerOwnershipKey(racer)` → `lib/engine.ts` ✅ pure helper

### Co zůstává v GameBoard.tsx (správně)

- DB write přes `pay_rent_atomic` RPC (side-effect)
- `finishTurn()` orchestrace
- `confirmBankruptOrSell()` UI flow
- Stable Duel overlay (`openStableDuelOverlay`)
- Log sestavení

### Budoucí příležitost pro extrakci

Pokud se výpočet nájmu zkomplikuje (např. upgrade stáje, multiplikátor kol, skupiny stájí),
mohlo by dávat smysl vytvořit resolver vrstvu:

```ts
// lib/engine/ownership-fee.ts — možný budoucí helper (zatím nepotřebný)
export function resolveOwnershipFee(params: {
  landingPlayer: Player;
  ownerPlayer: Player;
  racer: Horse;
  economy: EconomyConfig;
}): {
  feeAmount: number;
  payerDelta: number;
  ownerDelta: number;
  logEntry: string;
  noOpReason?: string;
}
```

Aktuálně je `computeRent` jednoduchá 1-řádková funkce (20 % ceny) — extrakce do
plnohodnotného resolveru by byla předčasná abstrakce.

---

## 6. Doporučený MVP mechanismus

**MVP je již funkční.** Stávající implementace splňuje:

- ✅ Rent = 20 % ceny racera
- ✅ Atomický DB převod (race condition safe)
- ✅ Člověk i bot stejná pravidla
- ✅ Log pro oba hráče
- ✅ Bankrupt handling
- ✅ Stable Duel jako alternativa k nájmu (pro pokročilejší hráče s koněm)

**Slabá místa která by mohla být adresována:**

1. **Bankrupt majitel** — `pay_rent_atomic` RPC zřejmě převede peníze i bankrotujícímu
   majiteli. Není ošetřeno: "majitel zkrachoval, nájem by šel do prázdna." Dostihy řeší
   smrtí vlastnictví → racer se uvolní. Toto v aktuální verzi není implementováno.

2. **Nájem při bankrotu majitele** — pokud `ownerPlayer.coins <= 0` (bankrotující),
   logicky by racer měl být volný. Aktuálně se nájem zaplatí i bankrotujícímu.

3. **Variabilní nájem** — 20 % je flat rate. Pro Dostihy-like demo by mohlo být zajímavé
   škálování podle počtu kol majitele, ale to je beyond MVP.

---

## 7. Rizika

| Riziko | Popis | Závažnost |
|---|---|---|
| Stale ownership | Realtime doručení selže → klient nezná nového vlastníka | Nízká (`refreshGame` po bot akci) |
| Bankrot majitele | Nájem se platí i bankrotujícímu (racer by se měl uvolnit) | Střední |
| Race condition | Dva hráči kupují stejného racera ve stejný okamžik | Nízká (horse_pending serializes přes DB) |
| Bot vs bankrupt owner | Bot zaplatí nájem i mrtvolce | Střední (cosmetic — coins jdou do bankrotu) |
| Stable Duel + rent divergence | Výsledek duelu nereflektuje rent logiku | Nízká (oddělené cesty) |

---

## 8. Co zatím nedělat

- Aukce mezi hráči
- Hypotéky / zástavy racerem
- Skupiny stájí (vlastnění více stájí = bonus nájem)
- Upgrade / trénink racera → vyšší nájem
- Prodej racera jinému hráči
- Komplexní nájemní tabulky (podobné Monopoly)
- Refactor `pay_rent_atomic` RPC bez jasné potřeby

---

## 9. Doporučený další krok

Ownership fee **je již implementován**. Není potřeba MVP implementace.

**Doporučené kroky pro Dostihy-like demo:**

1. **Audit uvolnění racera při bankrotu majitele** — co se stane s racerem v `horses[]`,
   když majitel zkrachuje? Aktuálně se nezobrazí jako volný pro nákup.
   Viz `confirmBankruptOrSell()` a `isBankrupt()` logika.

2. **Audit Stable Duel výsledků** — výsledek duelu aktuálně neovlivňuje vlastnictví racera
   (jen coins). V Dostihy pravidlech je výsledek závodu o stáj důležitější.

3. **Finanční log** — log je textový array v `game_state.log`. Pokud chceme strukturovaný
   finanční přehled (kdo komu zaplatil kolik a kdy), bylo by potřeba rozšíření.
   Aktuálně je jen textový log.

4. **UI feedback pro majitele** — majitel závodníka nedostane v UI žádný explicitní feedback
   že mu právě přišly peníze (jen log). Major Gain overlay by mohl být rozšířen.

---

## 10. Přesný implementační prompt (pro bankrot + racer uvolnění)

Pokud je dalším krokem oprava toho, že racer bankrotujícího majitele se neuvolní:

```
Název problému: Racer se uvolní po bankrotu majitele

Cíl:
Když hráč zkrachuje (coins <= 0 a prodá všechny koně), jeho raceři
na board polích by se měli stát opět volnými k nákupu.

Současný stav:
- Bankrot: confirmBankruptOrSell() v GameBoard.tsx smaže horses[] z player
- Ale: jiný hráč, který přistane na jeho racer poli, stále najde ownerPlayer
  protože... (NUTNO OVĚŘIT: playerOwnsRacer porovnává horses[], po bankrotu
  by mělo vracet false protože horses=[] )

Pravděpodobně není problém — bankrot maže horses[], takže playerOwnsRacer
vrátí false. Ale nutno ověřit co přesně confirmBankruptOrSell() zanechá
v DB a jestli existuje edge case při Realtime latency.

Postup:
1. Dohledej confirmBankruptOrSell() v GameBoard.tsx
2. Ověř že po bankrotu player.horses = []
3. Ověř že playerOwnsRacer vrátí false pro prázdné horses
4. Pokud ano: není potřeba fix, jen potvrdit
5. Pokud ne: navrhni minimální fix

Validace: npm run typecheck + mentální walkthrough
```

---

## Shrnutí pro implementaci

| Otázka z auditu | Odpověď |
|---|---|
| Je dnešní model vlastnictví dostatečný pro poplatek? | **Ano — již implementován** |
| Je racer pevně svázaný s board position? | Ano — 1:1 mapování `racerSlotIndexes[i]` → `racers[i]` |
| Kde je nejbezpečnější místo pro výpočet poplatku? | `lib/engine.ts` (computeRent) — **již tam je** |
| Sdílí člověk a bot stejná pravidla? | **Ano** — oba volají `computeRent` + `pay_rent_atomic` |
| Jaký je MVP poplatek? | 20 % ceny racera — **již funguje** |
| Co zobrazit hráči? | Existující log + rozšíření MajorGain overlay pro majitele |
| Co nedělat v první verzi? | Skupiny stájí, hypotéky, aukce, upgrade nájmu |
| Jak navrhnout bez bobtnání GameBoard? | Výpočet je mimo (lib/engine.ts) — **splněno** |
| Nejlepší soubor pro nový resolver? | `lib/engine/ownership-fee.ts` — **zatím není potřeba** |
