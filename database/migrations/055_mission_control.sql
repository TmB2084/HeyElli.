-- MissionControl (Innendienst): persönliche Tages- und Wochenplanung, Fokuszeiten und Notizen zu Aufgaben.
-- Die Aufgaben selbst stammen aus der App Aufgaben (PDS-Aufgaben, MailDesk, Service); hier liegt nur die Planung.
-- source trennt Simulator- und Echtdaten (simulator bzw. pds:<workspace>).
CREATE TABLE platform.mission_plan (
 user_id text NOT NULL REFERENCES platform.users(id) ON DELETE CASCADE,
 source text NOT NULL CHECK (length(source) BETWEEN 1 AND 400),
 item_key text NOT NULL CHECK (length(item_key) BETWEEN 3 AND 460),
 title text NOT NULL CHECK (length(title) BETWEEN 1 AND 300),
 plan_day date,
 important boolean NOT NULL DEFAULT false,
 position integer NOT NULL DEFAULT 0 CHECK (position BETWEEN 0 AND 100000),
 estimate_minutes integer CHECK (estimate_minutes IS NULL OR estimate_minutes BETWEEN 5 AND 600),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (user_id,source,item_key)
);
CREATE INDEX mission_plan_day ON platform.mission_plan(user_id,source,plan_day);
-- Fokuszeiten: höchstens eine laufende Sitzung je Benutzer; Dauer wird beim Beenden serverseitig berechnet.
CREATE TABLE platform.mission_focus (
 id uuid PRIMARY KEY,
 user_id text NOT NULL REFERENCES platform.users(id) ON DELETE CASCADE,
 source text NOT NULL CHECK (length(source) BETWEEN 1 AND 400),
 item_key text NOT NULL CHECK (length(item_key) BETWEEN 3 AND 460),
 title text NOT NULL CHECK (length(title) BETWEEN 1 AND 300),
 planned_minutes integer CHECK (planned_minutes IS NULL OR planned_minutes BETWEEN 5 AND 600),
 started_at timestamptz NOT NULL DEFAULT now(),
 ended_at timestamptz,
 seconds integer CHECK (seconds IS NULL OR seconds BETWEEN 0 AND 86400),
 CHECK ((ended_at IS NULL)=(seconds IS NULL))
);
CREATE UNIQUE INDEX mission_focus_running ON platform.mission_focus(user_id) WHERE ended_at IS NULL;
CREATE INDEX mission_focus_user ON platform.mission_focus(user_id,source,started_at DESC);
-- Notizen zur Aufgabe (für alle mit Lesezugriff auf Aufgaben sichtbar); nur der Verfasser löscht.
CREATE TABLE platform.mission_notes (
 id uuid PRIMARY KEY,
 source text NOT NULL CHECK (length(source) BETWEEN 1 AND 400),
 item_key text NOT NULL CHECK (length(item_key) BETWEEN 3 AND 460),
 body text NOT NULL CHECK (length(btrim(body)) BETWEEN 1 AND 2000),
 author_id text REFERENCES platform.users(id) ON DELETE SET NULL,
 author_name text NOT NULL CHECK (length(author_name) BETWEEN 1 AND 120),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX mission_notes_item ON platform.mission_notes(source,item_key,created_at);
ALTER TABLE platform.app_usage DROP CONSTRAINT app_usage_app_path_check;
ALTER TABLE platform.app_usage ADD CONSTRAINT app_usage_app_path_check CHECK(app_path IN ('/','/hilfe','/service','/stoerungsmeister','/ressourcenmeister','/bereitschaftsmeister','/maildesk','/aufgaben','/missioncontrol','/benutzerkonto','/einstellungen'));
