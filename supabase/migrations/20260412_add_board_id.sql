-- Přidá sloupec board_id do tabulky games.
-- DEFAULT 'small' zajistí zpětnou kompatibilitu: staré hry bez board_id dostanou 'small'.
ALTER TABLE games
  ADD COLUMN IF NOT EXISTS board_id TEXT NOT NULL DEFAULT 'small';
