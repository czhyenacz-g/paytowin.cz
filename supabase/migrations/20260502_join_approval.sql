-- games: přidá příznak požadovaného schválení (default false = stávající chování zachováno)
ALTER TABLE games
  ADD COLUMN require_approval boolean NOT NULL DEFAULT false;

-- Tabulka žádostí o připojení ke hře
CREATE TABLE game_join_requests (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id            uuid        NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  name               text        NOT NULL,
  discord_id         text,
  discord_avatar_url text,
  status             text        NOT NULL DEFAULT 'pending',
  created_at         timestamptz NOT NULL DEFAULT now(),
  reviewed_at        timestamptz,

  CONSTRAINT game_join_requests_status_check
    CHECK (status IN ('pending', 'approved', 'rejected'))
);

-- Index pro dotazy ownera: všechny žádosti hry
CREATE INDEX game_join_requests_game_id_idx
  ON game_join_requests (game_id);

-- Index pro dotazy filtrované stavem (nejčastější: WHERE game_id = X AND status = 'pending')
CREATE INDEX game_join_requests_game_id_status_idx
  ON game_join_requests (game_id, status);

-- Zabrání duplicitním žádostem od stejného Discord účtu (partial index ignoruje NULL discord_id)
CREATE UNIQUE INDEX game_join_requests_unique_discord
  ON game_join_requests (game_id, discord_id)
  WHERE discord_id IS NOT NULL;
