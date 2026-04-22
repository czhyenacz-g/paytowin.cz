-- Year event telegram — globální zpráva pro všechny klienty při průchodu STARTem.
-- Payload: { text: string; turn: number } — turn slouží jako unikátní klíč.
-- Klienti zobrazí telegram jednou a pak ho ignorují (guard seenYearEventTurnRef).
ALTER TABLE game_state ADD COLUMN IF NOT EXISTS year_event_telegram jsonb DEFAULT NULL;
