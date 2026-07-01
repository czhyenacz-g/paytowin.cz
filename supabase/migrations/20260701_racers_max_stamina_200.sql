-- Rozšíření limitu max_stamina na 200
-- Původní limit 100 nestačil po normalizaci hodnot (scale 1-20 → ×10 = max 200)

ALTER TABLE racers DROP CONSTRAINT racers_max_stamina_check;
ALTER TABLE racers ADD CONSTRAINT racers_max_stamina_check
  CHECK (max_stamina >= 0 AND max_stamina <= 200);
