-- Přidá Discord identitu do players tabulky.
-- Obě pole jsou nullable — stará data bez Discord identity zůstanou funkční (fallback na iniciálu).

ALTER TABLE players
  ADD COLUMN IF NOT EXISTS discord_id          TEXT NULL,
  ADD COLUMN IF NOT EXISTS discord_avatar_url  TEXT NULL;
