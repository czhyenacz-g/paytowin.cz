-- Discord thread URL per hra (pro budoucí per-game Discord místnost).
-- Viz docs/refaktoring/discord-per-game-communication-room-audit.md
ALTER TABLE games
  ADD COLUMN IF NOT EXISTS discord_thread_url text null;
