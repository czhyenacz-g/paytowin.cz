-- Tracks the order in which players go bankrupt within a game.
-- Array of player IDs appended when coins drop to 0.
-- First element = first to go bankrupt (lowest rank), last = most recent bankrupt (higher rank).
ALTER TABLE game_state ADD COLUMN IF NOT EXISTS bust_order text[] NOT NULL DEFAULT '{}';
