-- Soft delete pro DB themes — is_archived=true skryje theme ze seznamu,
-- ale data zůstanou v DB (bezpečnější než hard delete pro editoriální workflow).

ALTER TABLE themes ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false;

-- Index pro rychlý filtr aktivních themes
CREATE INDEX IF NOT EXISTS themes_active_idx ON themes (is_archived) WHERE is_archived = false;
