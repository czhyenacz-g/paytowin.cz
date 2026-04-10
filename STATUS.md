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
- **Anon key**: uložen v `.env.local` (není v gitu)

### ⚠️ NUTNÉ UDĚLAT: spustit SQL schema v Supabase

Jdi na: https://supabase.com → projekt paytowin → SQL Editor → New Query → vlož a spusť:

```sql
-- Hry
create table games (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  status text not null default 'waiting' check (status in ('waiting', 'playing', 'finished')),
  created_at timestamptz not null default now()
);

-- Hráči
create table players (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  name text not null,
  color text not null,
  position int not null default 0,
  coins int not null default 500,
  horses jsonb not null default '[]',
  turn_order int not null default 0
);

-- Stav hry
create table game_state (
  game_id uuid primary key references games(id) on delete cascade,
  current_player_index int not null default 0,
  last_roll int,
  log jsonb not null default '[]',
  updated_at timestamptz not null default now()
);

-- Katalog koní (editovatelný z admin panelu)
create table horse_catalog (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  speed int not null check (speed between 1 and 5),
  price int not null,
  emoji text not null
);

-- Výchozí koně
insert into horse_catalog (name, speed, price, emoji) values
  ('Modrý blesk', 3, 150, '🔵'),
  ('Zlatá hříva', 4, 250, '🟡'),
  ('Rychlý vítr', 5, 400, '🟢'),
  ('Divoká růže', 2, 80,  '🌹');

-- Realtime: povol pro všechny tabulky
alter publication supabase_realtime add table games;
alter publication supabase_realtime add table players;
alter publication supabase_realtime add table game_state;

-- Row Level Security: prozatím otevřeno (PoC)
alter table games       enable row level security;
alter table players     enable row level security;
alter table game_state  enable row level security;
alter table horse_catalog enable row level security;

create policy "public read games"       on games       for all using (true) with check (true);
create policy "public read players"     on players     for all using (true) with check (true);
create policy "public read game_state"  on game_state  for all using (true) with check (true);
create policy "public read horses"      on horse_catalog for all using (true) with check (true);
```

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
| sloupec               | typ   | popis                     |
|-----------------------|-------|---------------------------|
| game_id               | uuid  | PK FK → games             |
| current_player_index  | int   | index hráče na tahu       |
| last_roll             | int?  | poslední hod kostkou      |
| log                   | jsonb | string[] posledních tahů  |
| updated_at            | ts    | čas poslední změny        |

### `horse_catalog`
| sloupec | typ  | popis               |
|---------|------|---------------------|
| id      | uuid | PK                  |
| name    | text | název koně          |
| speed   | int  | rychlost 1–5        |
| price   | int  | cena v coins        |
| emoji   | text | emoji ikonka        |

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

| URL                    | Co dělá                          |
|------------------------|----------------------------------|
| `/`                    | Landing — vytvoř nebo připoj hru |
| `/game/[KOD]`          | Herní deska, sync přes Realtime  |
| `/admin`               | Admin panel                      |

---

## Co ještě chybí / možné další kroky

- [ ] **Autentizace hráče** — momentálně kdokoli může hodit za kohokoliv (TODO: local session)
- [ ] **Závody** — hráči s koňmi se utkají na dostihové dráze
- [ ] **Stáje** — hráč si může koupit stáj (pole)
- [ ] **Více kol** — hra momentálně nemá podmínku konce (např. X kol nebo bankrot)
- [ ] **Admin přihlášení** — /admin je prozatím veřejné
- [ ] **Mobilní UI** — herní deska není responsivní na malých obrazovkách
- [ ] **Zvuky / animace** — hod kostkou, posun figurky
