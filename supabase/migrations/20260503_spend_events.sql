-- spend_events: audit trail vědomých herních útrat
CREATE TABLE spend_events (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id            uuid        NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  player_id          uuid        NULL     REFERENCES players(id) ON DELETE SET NULL,
  discord_id         text        NULL,
  event_type         text        NOT NULL,
  amount             integer     NOT NULL,
  metadata           jsonb       NULL,
  counted_in_profile boolean     NOT NULL DEFAULT false,
  created_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT spend_events_amount_positive   CHECK (amount > 0),
  CONSTRAINT spend_events_event_type_valid  CHECK (
    event_type IN ('racer_purchase', 'move_correction', 'duel_bet', 'event_entry', 'map_publish')
  )
);

CREATE INDEX idx_spend_events_game_id   ON spend_events (game_id);
CREATE INDEX idx_spend_events_discord   ON spend_events (discord_id);
CREATE INDEX idx_spend_events_counted   ON spend_events (counted_in_profile);
CREATE INDEX idx_spend_events_type      ON spend_events (event_type);

-- user_profiles: kumulativní útrata z dokončených her
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS money_spent_total integer NOT NULL DEFAULT 0;

-- games: guard proti dvojímu zpracování útrat
ALTER TABLE games ADD COLUMN IF NOT EXISTS money_spent_awarded boolean NOT NULL DEFAULT false;

-- Rozšíř RPC o volitelný p_money_spent (zpětně kompatibilní — DEFAULT 0)
CREATE OR REPLACE FUNCTION increment_xp_and_wins(
  p_discord_id  text,
  p_xp          integer DEFAULT 0,
  p_win         boolean DEFAULT false,
  p_stars       integer DEFAULT 0,
  p_win_stars   integer DEFAULT 0,
  p_money_spent integer DEFAULT 0
)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO user_profiles (
    discord_id, xp_total, wins_total, stars_total, win_stars_total, money_spent_total, updated_at
  )
  VALUES (
    p_discord_id,
    p_xp,
    CASE WHEN p_win THEN 1 ELSE 0 END,
    p_stars,
    p_win_stars,
    p_money_spent,
    now()
  )
  ON CONFLICT (discord_id) DO UPDATE SET
    xp_total          = user_profiles.xp_total          + p_xp,
    wins_total        = user_profiles.wins_total        + CASE WHEN p_win THEN 1 ELSE 0 END,
    stars_total       = user_profiles.stars_total       + p_stars,
    win_stars_total   = user_profiles.win_stars_total   + p_win_stars,
    money_spent_total = user_profiles.money_spent_total + p_money_spent,
    updated_at        = now();
END;
$$;
