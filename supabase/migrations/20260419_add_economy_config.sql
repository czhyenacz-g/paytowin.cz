-- Add economy configuration column to games table.
-- NULL means "use DEFAULT_ECONOMY in code" — backward compatible with existing games.
ALTER TABLE games ADD COLUMN IF NOT EXISTS economy JSONB DEFAULT NULL;
