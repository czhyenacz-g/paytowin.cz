-- Dočasní vlastníci coins_lose polí (field ownership MVP).
-- Viz lib/game/fieldOwnership.ts a lib/types/game.ts (FieldOwnerEntry).
ALTER TABLE game_state
  ADD COLUMN IF NOT EXISTS field_owners jsonb NOT NULL DEFAULT '[]'::jsonb;
