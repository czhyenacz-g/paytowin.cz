-- Racer catalog split: templates, uniques, assets.
-- Safe additive migration; existing `racers` table remains source of truth for the game pool.

CREATE TABLE IF NOT EXISTS racer_species (
  id          TEXT PRIMARY KEY,
  label       TEXT NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS racer_templates (
  id           TEXT PRIMARY KEY,
  species_id   TEXT NOT NULL REFERENCES racer_species(id),
  name         TEXT NOT NULL,
  slug         TEXT NOT NULL UNIQUE,
  category     TEXT NOT NULL CHECK (category IN ('game', 'legend', 'perma')),
  pool_type    TEXT NOT NULL CHECK (pool_type IN ('game', 'legend', 'perma')),
  rarity       TEXT NOT NULL DEFAULT 'common',
  description  TEXT,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS racer_uniques (
  id                  TEXT PRIMARY KEY,
  template_id          TEXT NOT NULL REFERENCES racer_templates(id) ON DELETE RESTRICT,
  owner_user_id        TEXT,
  name                TEXT NOT NULL,
  slug                TEXT NOT NULL UNIQUE,
  status              TEXT NOT NULL CHECK (status IN ('draft', 'reserved', 'owned', 'archived')),
  sale_status         TEXT NOT NULL CHECK (sale_status IN ('offered', 'sold', 'reserved', 'draft', 'hidden')),
  rarity              TEXT NOT NULL DEFAULT 'rare',
  description         TEXT,
  stamina_current     INTEGER,
  stamina_max        INTEGER,
  availability_status TEXT NOT NULL DEFAULT 'draft' CHECK (availability_status IN ('available', 'resting', 'exhausted', 'racing', 'reserved', 'draft')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT racer_uniques_owner_consistency CHECK (
    (status = 'owned' AND owner_user_id IS NOT NULL)
    OR (status <> 'owned')
  ),
  CONSTRAINT racer_uniques_sale_consistency CHECK (
    (sale_status = 'sold' AND owner_user_id IS NOT NULL)
    OR (sale_status <> 'sold')
  )
);

CREATE TABLE IF NOT EXISTS racer_assets (
  id                BIGSERIAL PRIMARY KEY,
  racer_unique_id   TEXT REFERENCES racer_uniques(id) ON DELETE CASCADE,
  racer_template_id TEXT REFERENCES racer_templates(id) ON DELETE CASCADE,
  asset_type        TEXT NOT NULL CHECK (asset_type IN ('front_image', 'side_image', 'idle_animation', 'token_image', 'badge_icon')),
  path              TEXT NOT NULL,
  sort_order        INTEGER NOT NULL DEFAULT 0,
  is_primary        BOOLEAN NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT racer_assets_target_check CHECK (
    (racer_unique_id IS NOT NULL AND racer_template_id IS NULL)
    OR (racer_unique_id IS NULL AND racer_template_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS racer_uniques_owner_one_active_idx
  ON racer_uniques (owner_user_id)
  WHERE owner_user_id IS NOT NULL AND status = 'owned';

CREATE INDEX IF NOT EXISTS racer_uniques_owner_idx ON racer_uniques (owner_user_id);
CREATE INDEX IF NOT EXISTS racer_uniques_sale_status_idx ON racer_uniques (sale_status);
CREATE INDEX IF NOT EXISTS racer_uniques_status_idx ON racer_uniques (status);
CREATE INDEX IF NOT EXISTS racer_assets_unique_idx ON racer_assets (racer_unique_id);
CREATE INDEX IF NOT EXISTS racer_assets_template_idx ON racer_assets (racer_template_id);

CREATE OR REPLACE FUNCTION update_racer_species_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS racer_species_updated_at_trigger ON racer_species;
CREATE TRIGGER racer_species_updated_at_trigger
  BEFORE UPDATE ON racer_species
  FOR EACH ROW EXECUTE FUNCTION update_racer_species_updated_at();

CREATE OR REPLACE FUNCTION update_racer_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS racer_templates_updated_at_trigger ON racer_templates;
CREATE TRIGGER racer_templates_updated_at_trigger
  BEFORE UPDATE ON racer_templates
  FOR EACH ROW EXECUTE FUNCTION update_racer_templates_updated_at();

CREATE OR REPLACE FUNCTION update_racer_uniques_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS racer_uniques_updated_at_trigger ON racer_uniques;
CREATE TRIGGER racer_uniques_updated_at_trigger
  BEFORE UPDATE ON racer_uniques
  FOR EACH ROW EXECUTE FUNCTION update_racer_uniques_updated_at();

CREATE OR REPLACE FUNCTION update_racer_assets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS racer_assets_updated_at_trigger ON racer_assets;
CREATE TRIGGER racer_assets_updated_at_trigger
  BEFORE UPDATE ON racer_assets
  FOR EACH ROW EXECUTE FUNCTION update_racer_assets_updated_at();

INSERT INTO racer_species (id, label) VALUES
  ('horse', 'Koně'),
  ('lama', 'Lamy'),
  ('camel', 'Velbloudi'),
  ('car', 'Auta')
ON CONFLICT (id) DO NOTHING;
