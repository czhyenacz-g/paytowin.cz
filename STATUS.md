# Paytowin.cz — aktuální stav projektu

## Co to je
Desková hra ve stylu Dostihy a sázky. Hráči házejí kostkou, pohybují se po 21 polích, sbírají a utrácejí coins a nakupují koně.

---

## Stack

- **Next.js 15** (App Router) + **TypeScript** + **Tailwind CSS**
- **Supabase** — Postgres databáze + Realtime WebSocket sync
- **Vercel** — hosting, auto-deploy z GitHubu na push do `main`
- **GitHub** repo: `czhyenacz-g/paytowin.cz`
- **Live URL**: https://paytowin-cz.vercel.app

---

## Supabase

- **Projekt**: paytowin
- **URL**: `https://zyiaettnrfjzwcrumgty.supabase.co`
- **Anon key + Access token**: uloženy v `~/PhpstormProjects/starter/.tokens` a `.env.local` (není v gitu)

### Spuštění / aktualizace DB schématu

```bash
npm run db:migrate
```

Skript `_db/migrate.sh` načte token z `~/.tokens`, zjistí projekt z `.env.local` a spustí `_db/before_run.sql` přes Supabase Management API. Idempotentní — lze spustit opakovaně.

📄 [`_db/before_run.sql`](_db/before_run.sql) — SQL schema  
📄 [`_db/migrate.sh`](_db/migrate.sh) — spouštěcí skript

---

## Struktura souborů

```
app/
  page.tsx                    # Landing page (vytvořit / připojit hru)
  components/
    LandingPage.tsx            # UI landing stránky
    GameBoard.tsx              # Herní deska + logika (Supabase Realtime)
    AdminPanel.tsx             # Admin tabulky (hry, hráči, koně)
  game/
    [code]/
      page.tsx                 # Route /game/XK9F2 → GameBoard
  admin/
    page.tsx                   # Route /admin → AdminPanel
  api/og/route.tsx             # OG image endpoint
  layout.tsx
  globals.css

lib/
  supabase.ts                  # Supabase client
  database.types.ts            # TypeScript typy pro DB tabulky
  game.ts                      # generateGameCode(), PLAYER_COLORS

_db/
  before_run.sql               # Idempotentní SQL migrace
  migrate.sh                   # Spustí migraci přes Supabase Management API
```

---

## Datový model

### `games`
| sloupec    | typ  | popis                          |
|------------|------|--------------------------------|
| id         | uuid | PK                             |
| code       | text | unikátní kód hry (např. XK9F2) |
| status     | text | waiting / playing / finished   |
| created_at | ts   | čas vytvoření                  |

### `players`
| sloupec     | typ   | popis                          |
|-------------|-------|--------------------------------|
| id          | uuid  | PK                             |
| game_id     | uuid  | FK → games                     |
| name        | text  | jméno hráče                    |
| color       | text  | Tailwind třída (bg-blue-500)   |
| position    | int   | index pole (0–20)              |
| coins       | int   | aktuální zůstatek              |
| horses      | jsonb | pole Horse[]                   |
| turn_order  | int   | pořadí v tahu                  |

### `game_state`
| sloupec               | typ   | popis                                        |
|-----------------------|-------|----------------------------------------------|
| game_id               | uuid  | PK FK → games                                |
| current_player_index  | int   | index hráče na tahu                          |
| last_roll             | int?  | poslední hod kostkou                         |
| log                   | jsonb | string[] posledních tahů                     |
| turn_count            | int   | celkový počet tahů (pro výpočet kola)        |
| updated_at            | ts    | čas poslední změny                           |

### `horse_catalog`
| sloupec | typ  | popis               |
|---------|------|---------------------|
| id      | uuid | PK                  |
| name    | text | název koně          |
| speed   | int  | rychlost 1–5        |
| price   | int  | cena v coins        |
| emoji   | text | emoji ikonka        |

---

## Herní mechaniky

### Kola
- Kolo = `Math.floor(turn_count / počet_hráčů) + 1`
- Zobrazeno v hlavičce herní desky

### Průchod STARTem
- Přistání nebo průchod polem 0 = **+200 coins**
- Od kola 3 navíc **-50 coins daň** (nastavitelné: `BANKRUPTCY_TAX_ROUND`, `BANKRUPTCY_TAX_AMOUNT` v `GameBoard.tsx`)

### Bankrot
- Hráč s `coins <= 0` je bankrotář
- Figurka zmizí z desky
- V panelu hráčů: červený okraj, šedá karta, přeškrtnuté jméno, "💀 Zkrachoval"
- Tahy bankrotáře se automaticky přeskakují

### Identita hráče
- `playerId` se uloží do `localStorage` při vytvoření/připojení hry (`paytowin_player_[KOD]`)
- Tlačítko "Hoď kostkou" je aktivní pouze pro hráče na tahu
- Ostatní vidí "Čekej na tah hráče X"

### Koně
- 4 koňská pole na desce (indexy 3, 10, 17, 19)
- Při přistání se zobrazí nabídka Koupit / Přeskočit
- Kůň se uloží do `horses: Horse[]` u hráče (jsonb v DB)
- Katalog koní editovatelný z `/admin`

---

## Herní pole (21 polí, index 0–20)

| Index | Typ        | Název            | Emoji | Efekt                     |
|-------|------------|------------------|-------|---------------------------|
| 0     | start      | START            | 🏁    | +200 coins průchodem      |
| 1     | coins_gain | Sponzor          | 🤝    | +100 coins                |
| 2     | coins_lose | Veterinář        | 🩺    | -60 coins                 |
| 3     | horse      | Divoká růže      | 🌹    | koupě koně za 80 coins    |
| 4     | coins_gain | Vítěz dostihu    | 🏆    | +150 coins                |
| 5     | coins_lose | Daňový úřad      | 🏛️   | -80 coins                 |
| 6     | coins_gain | Zlaté podkůvky   | 🥇    | +80 coins                 |
| 7     | coins_lose | Korupce          | 💸    | -120 coins                |
| 8     | gamble     | Loterie          | 🎟️   | +300 nebo -100 (30%)      |
| 9     | coins_gain | Dobrá sezona     | 🌟    | +90 coins                 |
| 10    | horse      | Modrý blesk      | 🔵    | koupě koně za 150 coins   |
| 11    | coins_lose | Krize na trhu    | 📉    | -50 coins                 |
| 12    | coins_gain | Bankéř           | 🏦    | +40 coins                 |
| 13    | coins_lose | Zákeřný soupeř   | 😈    | -70 coins                 |
| 14    | gamble     | Sázková kancelář | 📋    | +200 nebo -80 (40%)       |
| 15    | coins_gain | Věrnostní bonus  | 🎁    | +50 coins                 |
| 16    | coins_lose | Zloděj           | 🦹    | -70 coins                 |
| 17    | horse      | Zlatá hříva      | 🟡    | koupě koně za 250 coins   |
| 18    | coins_lose | Veterinář        | 💊    | -60 coins                 |
| 19    | horse      | Rychlý vítr      | 🟢    | koupě koně za 400 coins   |
| 20    | gamble     | Ruleta           | 🎡    | +250 nebo -150 (45%)      |

---

## URL struktura

| URL             | Co dělá                          |
|-----------------|----------------------------------|
| `/`             | Landing — vytvoř nebo připoj hru |
| `/game/[KOD]`   | Herní deska, sync přes Realtime  |
| `/admin`        | Admin panel                      |

---

## Co ještě chybí / možné další kroky

- [ ] **Závody** — hráči s koňmi se utkají na dostihové dráze
- [ ] **Stáje** — hráč si může koupit stáj (pole)
- [ ] **Podmínka konce hry** — poslední hráč co není bankrotář vyhrává
- [ ] **Admin přihlášení** — /admin je prozatím veřejné
- [ ] **Mobilní UI** — herní deska není responsivní na malých obrazovkách
- [ ] **Zvuky / animace** — hod kostkou, posun figurky
