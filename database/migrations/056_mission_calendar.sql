-- MissionControl: Fokusblöcke im persönlichen Outlook-Kalender (Microsoft Graph, Calendars.ReadWrite).
-- plan_time: Beginn des Blocks am Plantag (Berliner Zeit); calendar_event_id: Graph-Ereignis (bzw. sample:… im Beispielkalender).
ALTER TABLE platform.mission_plan
 ADD COLUMN plan_time time,
 ADD COLUMN calendar_event_id text CHECK (calendar_event_id IS NULL OR length(calendar_event_id) BETWEEN 1 AND 500),
 ADD COLUMN calendar_error text CHECK (calendar_error IS NULL OR length(calendar_error) BETWEEN 1 AND 300);
-- Persönliche Einstellung: Kalenderabgleich ein/aus (standardmäßig aus).
CREATE TABLE platform.mission_settings (
 user_id text PRIMARY KEY REFERENCES platform.users(id) ON DELETE CASCADE,
 calendar_sync boolean NOT NULL DEFAULT false,
 updated_at timestamptz NOT NULL DEFAULT now()
);
