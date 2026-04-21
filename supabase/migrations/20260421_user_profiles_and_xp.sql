-- User profiles table — persistent per Discord account.
-- Created lazily on first XP award.
CREATE TABLE IF NOT EXISTS user_profiles (
  discord_id  text PRIMARY KEY,
  xp_total    integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Wins counter — inkrementován v awardXpAction pro vítěze.
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS wins_total integer NOT NULL DEFAULT 0;

-- Guard: prevents XP being awarded more than once per game.
ALTER TABLE games ADD COLUMN IF NOT EXISTS xp_awarded boolean NOT NULL DEFAULT false;

-- Atomic XP + wins increment — upsert profilu, přičte XP a volitelně výhru.
CREATE OR REPLACE FUNCTION increment_xp_and_wins(p_discord_id text, p_xp integer, p_win boolean DEFAULT false)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO user_profiles (discord_id, xp_total, wins_total, updated_at)
    VALUES (p_discord_id, p_xp, CASE WHEN p_win THEN 1 ELSE 0 END, now())
  ON CONFLICT (discord_id)
    DO UPDATE SET
      xp_total   = user_profiles.xp_total + p_xp,
      wins_total = user_profiles.wins_total + CASE WHEN p_win THEN 1 ELSE 0 END,
      updated_at = now();
END;
$$;
