-- user_profiles: win stars bucket (samostatný od race stars)
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS win_stars_total integer NOT NULL DEFAULT 0;

-- games: guard proti dvojímu připsání win stars
ALTER TABLE games ADD COLUMN IF NOT EXISTS win_stars_awarded boolean NOT NULL DEFAULT false;

-- Rozšíř increment_xp_and_wins o volitelný p_win_stars (zpětně kompatibilní).
CREATE OR REPLACE FUNCTION increment_xp_and_wins(
  p_discord_id text,
  p_xp         integer,
  p_win        boolean  DEFAULT false,
  p_stars      integer  DEFAULT 0,
  p_win_stars  integer  DEFAULT 0
)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO user_profiles (discord_id, xp_total, wins_total, stars_total, win_stars_total, updated_at)
    VALUES (p_discord_id, p_xp, CASE WHEN p_win THEN 1 ELSE 0 END, p_stars, p_win_stars, now())
  ON CONFLICT (discord_id)
    DO UPDATE SET
      xp_total        = user_profiles.xp_total        + p_xp,
      wins_total      = user_profiles.wins_total      + CASE WHEN p_win THEN 1 ELSE 0 END,
      stars_total     = user_profiles.stars_total     + p_stars,
      win_stars_total = user_profiles.win_stars_total + p_win_stars,
      updated_at      = now();
END;
$$;
