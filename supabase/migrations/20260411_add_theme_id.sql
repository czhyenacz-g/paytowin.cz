-- Přidá sloupec theme_id do tabulky games.
-- Defaultní hodnota 'default' zajistí zpětnou kompatibilitu se starými hrami.
ALTER TABLE games
  ADD COLUMN IF NOT EXISTS theme_id TEXT NOT NULL DEFAULT 'default';
