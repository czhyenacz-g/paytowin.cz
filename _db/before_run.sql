-- ============================================================
-- paytowin.cz — migrační skript
-- Spustit v Supabase: SQL Editor → New Query → Run
-- ============================================================

-- Hry
create table games (
  id         uuid        primary key default gen_random_uuid(),
  code       text        not null unique,
  status     text        not null default 'waiting' check (status in ('waiting', 'playing', 'finished')),
  created_at timestamptz not null default now()
);

-- Hráči
create table players (
  id          uuid  primary key default gen_random_uuid(),
  game_id     uuid  not null references games(id) on delete cascade,
  name        text  not null,
  color       text  not null,
  position    int   not null default 0,
  coins       int   not null default 500,
  horses      jsonb not null default '[]',
  turn_order  int   not null default 0
);

-- Stav hry
create table game_state (
  game_id               uuid        primary key references games(id) on delete cascade,
  current_player_index  int         not null default 0,
  last_roll             int,
  log                   jsonb       not null default '[]',
  updated_at            timestamptz not null default now()
);

-- Katalog koní (editovatelný z /admin)
create table horse_catalog (
  id     uuid primary key default gen_random_uuid(),
  name   text not null,
  speed  int  not null check (speed between 1 and 5),
  price  int  not null,
  emoji  text not null
);

-- Výchozí koně
insert into horse_catalog (name, speed, price, emoji) values
  ('Modrý blesk', 3, 150, '🔵'),
  ('Zlatá hříva', 4, 250, '🟡'),
  ('Rychlý vítr', 5, 400, '🟢'),
  ('Divoká růže', 2,  80, '🌹');

-- Realtime: povol broadcast změn pro herní tabulky
alter publication supabase_realtime add table games;
alter publication supabase_realtime add table players;
alter publication supabase_realtime add table game_state;

-- Row Level Security (prozatím otevřeno — PoC)
alter table games         enable row level security;
alter table players       enable row level security;
alter table game_state    enable row level security;
alter table horse_catalog enable row level security;

create policy "public all games"        on games         for all using (true) with check (true);
create policy "public all players"      on players       for all using (true) with check (true);
create policy "public all game_state"   on game_state    for all using (true) with check (true);
create policy "public all horse_catalog" on horse_catalog for all using (true) with check (true);
