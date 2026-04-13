-- Přidá 'cancelled' jako povolený status pro hry.
-- Původní constraint povoloval jen: waiting, playing, finished.
-- Aplikace (GameBoard.tsx) potřebuje ukládat i 'cancelled'.

ALTER TABLE games DROP CONSTRAINT IF EXISTS games_status_check;

ALTER TABLE games ADD CONSTRAINT games_status_check
  CHECK (status IN ('waiting', 'playing', 'finished', 'cancelled'));
