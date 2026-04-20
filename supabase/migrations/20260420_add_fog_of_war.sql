-- Fog of War V1
-- fog_of_war: per-game flag — vypnutý default, zapíná se při vytvoření/editaci hry
-- revealed_fields: sdílený seznam odhalených indexů polí; synced přes Realtime

ALTER TABLE games
  ADD COLUMN IF NOT EXISTS fog_of_war boolean NOT NULL DEFAULT false;

ALTER TABLE game_state
  ADD COLUMN IF NOT EXISTS revealed_fields jsonb NOT NULL DEFAULT '[]'::jsonb;
