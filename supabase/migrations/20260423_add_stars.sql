-- Persistentní hvězdy za výhru v závodě (první verze — jen sběr, bez utrácení).
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS stars_total integer NOT NULL DEFAULT 0;

-- Guard: pole turnCount hodnot závodů, kde byly hvězdy uděleny v rámci jedné hry.
-- Zabrání dvojímu připsání při re-renderu nebo opakovaném volání closeRaceResult.
ALTER TABLE game_state ADD COLUMN IF NOT EXISTS race_stars_awarded jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Rozšíř increment_xp_and_wins o volitelný parametr pro hvězdy.
-- Zpětně kompatibilní — existující volání (p_stars vynecháno) fungují bez změny.
CREATE OR REPLACE FUNCTION increment_xp_and_wins(
  p_discord_id text,
  p_xp         integer,
  p_win        boolean DEFAULT false,
  p_stars      integer DEFAULT 0
)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO user_profiles (discord_id, xp_total, wins_total, stars_total, updated_at)
    VALUES (p_discord_id, p_xp, CASE WHEN p_win THEN 1 ELSE 0 END, p_stars, now())
  ON CONFLICT (discord_id)
    DO UPDATE SET
      xp_total    = user_profiles.xp_total    + p_xp,
      wins_total  = user_profiles.wins_total  + CASE WHEN p_win THEN 1 ELSE 0 END,
      stars_total = user_profiles.stars_total + p_stars,
      updated_at  = now();
END;
$$;
