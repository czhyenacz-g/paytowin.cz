-- Tabulka pro persistentní uložení ThemeManifest objektů.
-- manifest je uložen jako JSONB — celý ThemeManifest kontrakt.
-- Zabudované themes (default, dark, classic-race) lze seedovat sem,
-- ale primárně slouží pro user-created themes z budoucího theme builderu.

CREATE TABLE IF NOT EXISTS themes (
  id            TEXT        PRIMARY KEY,          -- === manifest.meta.id
  manifest      JSONB       NOT NULL,             -- celý ThemeManifest objekt
  created_by    TEXT        NULL,                 -- discord_id autora, NULL = systémové
  is_public     BOOLEAN     NOT NULL DEFAULT false,
  is_official   BOOLEAN     NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index pro rychlé hledání veřejných a oficiálních themes (galerie)
CREATE INDEX IF NOT EXISTS themes_public_idx    ON themes (is_public)   WHERE is_public = true;
CREATE INDEX IF NOT EXISTS themes_official_idx  ON themes (is_official) WHERE is_official = true;
CREATE INDEX IF NOT EXISTS themes_created_by_idx ON themes (created_by) WHERE created_by IS NOT NULL;

-- Automatická aktualizace updated_at při každém UPDATE
CREATE OR REPLACE FUNCTION update_themes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS themes_updated_at_trigger ON themes;
CREATE TRIGGER themes_updated_at_trigger
  BEFORE UPDATE ON themes
  FOR EACH ROW EXECUTE FUNCTION update_themes_updated_at();
