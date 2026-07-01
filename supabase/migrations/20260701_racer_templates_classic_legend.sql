-- Přidání classic_legend do check constraints na racer_templates
-- Potřebné pro import historických koní (Historická stáj)

ALTER TABLE racer_templates DROP CONSTRAINT racer_templates_category_check;
ALTER TABLE racer_templates ADD CONSTRAINT racer_templates_category_check
  CHECK (category = ANY (ARRAY['game'::text, 'legend'::text, 'perma'::text, 'classic_legend'::text]));

ALTER TABLE racer_templates DROP CONSTRAINT racer_templates_pool_type_check;
ALTER TABLE racer_templates ADD CONSTRAINT racer_templates_pool_type_check
  CHECK (pool_type = ANY (ARRAY['game'::text, 'legend'::text, 'perma'::text, 'classic_legend'::text]));
