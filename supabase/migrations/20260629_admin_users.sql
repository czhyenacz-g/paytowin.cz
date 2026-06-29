-- Admin users allowlist for server-side admin checks.
-- Insert the first admin ručně po nasazení:
-- insert into admin_users (user_id, note) values ('UUID_UZIVATELE', 'Hynek admin');

create table if not exists admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists admin_users_created_at_idx on admin_users (created_at desc);

