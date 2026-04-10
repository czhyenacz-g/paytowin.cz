-- ============================================================
-- paytowin.cz — migrační skript
-- Idempotentní: lze spustit opakovaně bez chyb
-- Supabase: SQL Editor → New Query → Run
-- ============================================================

-- Tabulky
create table if not exists games (
  id         uuid        primary key default gen_random_uuid(),
  code       text        not null unique,
  status     text        not null default 'waiting' check (status in ('waiting', 'playing', 'finished')),
  created_at timestamptz not null default now()
);

create table if not exists players (
  id          uuid  primary key default gen_random_uuid(),
  game_id     uuid  not null references games(id) on delete cascade,
  name        text  not null,
  color       text  not null,
  position    int   not null default 0,
  coins       int   not null default 500,
  horses      jsonb not null default '[]',
  turn_order  int   not null default 0
);

create table if not exists game_state (
  game_id               uuid        primary key references games(id) on delete cascade,
  current_player_index  int         not null default 0,
  last_roll             int,
  log                   jsonb       not null default '[]',
  updated_at            timestamptz not null default now()
);

create table if not exists horse_catalog (
  id     uuid primary key default gen_random_uuid(),
  name   text not null,
  speed  int  not null check (speed between 1 and 5),
  price  int  not null,
  emoji  text not null
);

-- Výchozí koně (přidá jen chybějící)
insert into horse_catalog (name, speed, price, emoji) values
  ('Modrý blesk', 3, 150, '🔵'),
  ('Zlatá hříva', 4, 250, '🟡'),
  ('Rychlý vítr', 5, 400, '🟢'),
  ('Divoká růže', 2,  80, '🌹')
on conflict do nothing;

-- Realtime (bezpečné opakování přes DO blok)
do $$
begin
  begin alter publication supabase_realtime add table games;       exception when others then null; end;
  begin alter publication supabase_realtime add table players;     exception when others then null; end;
  begin alter publication supabase_realtime add table game_state;  exception when others then null; end;
end $$;

-- Row Level Security
alter table games         enable row level security;
alter table players       enable row level security;
alter table game_state    enable row level security;
alter table horse_catalog enable row level security;

-- Policies (drop + recreate = idempotentní)
drop policy if exists "public all games"         on games;
drop policy if exists "public all players"       on players;
drop policy if exists "public all game_state"    on game_state;
drop policy if exists "public all horse_catalog" on horse_catalog;

create policy "public all games"         on games         for all using (true) with check (true);
create policy "public all players"       on players       for all using (true) with check (true);
create policy "public all game_state"    on game_state    for all using (true) with check (true);
create policy "public all horse_catalog" on horse_catalog for all using (true) with check (true);
