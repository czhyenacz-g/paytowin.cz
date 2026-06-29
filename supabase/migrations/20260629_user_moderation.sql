-- user_moderation: stav zákazu/povolení hráče v systému.
-- Propojeno 1:1 na auth.users, row existuje jen pokud byl hráč někdy moderován.

CREATE TABLE IF NOT EXISTS user_moderation (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  status     text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'banned')),
  ban_reason text,
  banned_at  timestamptz,
  banned_by  uuid REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_moderation_status_idx ON user_moderation (status);
