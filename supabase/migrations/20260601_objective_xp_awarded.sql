-- Guard pro profilové XP odměny za splnění sdílených objectives.
-- Vzor identický s xp_awarded, win_stars_awarded, money_spent_awarded.
ALTER TABLE games ADD COLUMN IF NOT EXISTS objective_xp_awarded boolean NOT NULL DEFAULT false;
