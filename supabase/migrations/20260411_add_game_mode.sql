-- Přidá herní režim, vlastníka a limit hráčů do tabulky games.
-- Všechny staré záznamy dostanou bezpečné fallback hodnoty.
ALTER TABLE games ADD COLUMN IF NOT EXISTS game_mode TEXT NOT NULL DEFAULT 'online';
ALTER TABLE games ADD COLUMN IF NOT EXISTS owner_discord_id TEXT;
ALTER TABLE games ADD COLUMN IF NOT EXISTS max_players INTEGER NOT NULL DEFAULT 32;
