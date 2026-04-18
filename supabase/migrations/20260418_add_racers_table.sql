-- Globální Racer Registry — závodníci jako samostatné entity.
--
-- Nahrazuje per-theme embedded model (ThemeManifest.racers: RacerConfig[]).
-- Theme si závodníka vybírá přes racer_id; profil žije tady.
--
-- Poznámky:
--   horse_catalog   — starší jednoduchá tabulka, tímto překonána (neodstraňujeme zatím)
--   ThemeManifest   — stará per-theme embedded data jsou dočasná; budou odstraněna ve fázi cleanup
--   player.horses   — zůstává snapshot (Horse JSONB); migrace na racer_id referenci je oddělený krok

CREATE TABLE IF NOT EXISTS racers (
  id            TEXT        PRIMARY KEY,                        -- slug, globálně unikátní, např. "divoka_ruze"
  name          TEXT        NOT NULL,
  speed         SMALLINT    NOT NULL CHECK (speed BETWEEN 1 AND 10),
  price         INTEGER     NOT NULL CHECK (price >= 0),
  emoji         TEXT        NOT NULL,
  max_stamina   SMALLINT    NOT NULL DEFAULT 100 CHECK (max_stamina BETWEEN 0 AND 100),
  is_legendary  BOOLEAN     NOT NULL DEFAULT false,
  flavor_text   TEXT,
  image_url     TEXT,                                           -- veřejná URL obrázku (CDN nebo ext.)
  image_path    TEXT,                                           -- storage path v Supabase bucket "racers"
  type          TEXT        NOT NULL DEFAULT 'horse',           -- 'horse' | 'car' | vlastní
  is_builtin    BOOLEAN     NOT NULL DEFAULT false,             -- true = nelze smazat, jen admin může editovat
  owner_id      TEXT,                                           -- discord_id vlastníka; NULL = globální/systémový
  is_public     BOOLEAN     NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexy
CREATE INDEX IF NOT EXISTS racers_type_idx      ON racers (type);
CREATE INDEX IF NOT EXISTS racers_is_builtin_idx ON racers (is_builtin) WHERE is_builtin = true;
CREATE INDEX IF NOT EXISTS racers_is_public_idx  ON racers (is_public)  WHERE is_public  = true;
CREATE INDEX IF NOT EXISTS racers_owner_idx      ON racers (owner_id)   WHERE owner_id IS NOT NULL;

-- Automatická aktualizace updated_at
CREATE OR REPLACE FUNCTION update_racers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS racers_updated_at_trigger ON racers;
CREATE TRIGGER racers_updated_at_trigger
  BEFORE UPDATE ON racers
  FOR EACH ROW EXECUTE FUNCTION update_racers_updated_at();
