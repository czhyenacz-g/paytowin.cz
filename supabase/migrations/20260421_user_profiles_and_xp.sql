-- User profiles table — persistent per Discord account.
-- Created lazily on first XP award.
CREATE TABLE IF NOT EXISTS user_profiles (
  discord_id  text PRIMARY KEY,
  xp_total    integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Guard: prevents XP being awarded more than once per game.
ALTER TABLE games ADD COLUMN IF NOT EXISTS xp_awarded boolean NOT NULL DEFAULT false;

-- Atomic XP increment — upsert profilu, přičte XP.
CREATE OR REPLACE FUNCTION increment_xp(p_discord_id text, p_xp integer)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO user_profiles (discord_id, xp_total, updated_at)
    VALUES (p_discord_id, p_xp, now())
  ON CONFLICT (discord_id)
    DO UPDATE SET xp_total = user_profiles.xp_total + p_xp, updated_at = now();
END;
$$;
