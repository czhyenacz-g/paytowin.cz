-- Přidá sloupeček `laps` pro počítání průchodů STARTem.
-- Daně za START jsou nově laps-based místo round-based.
ALTER TABLE players ADD COLUMN IF NOT EXISTS laps INTEGER DEFAULT 0;
