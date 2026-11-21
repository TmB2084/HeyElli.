-- MissionControl: Teamziele mit Fortschritt aus PDS/Service (oder manuell) und Wochenrückblick.
-- Kennzahlen (metric): unplanned_orders (Service: Aufträge ohne Termin), overdue_tasks (PDS-CRM: überfällige Aufgaben),
-- open_offers (PDS: Angebote in gewählten Status, optional älter als N Tage nach belegDatum), manual (Wert wird gepflegt).
-- direction: max = Zielwert höchstens (abbauen), min = Zielwert mindestens (aufbauen).
CREATE TABLE platform.mission_goals (
 id uuid PRIMARY KEY,
 source text NOT NULL CHECK (length(source) BETWEEN 1 AND 400),
 title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 160),
 metric text NOT NULL CHECK (metric IN ('unplanned_orders','overdue_tasks','open_offers','manual')),
 direction text NOT NULL CHECK (direction IN ('max','min')),
 target integer NOT NULL CHECK (target BETWEEN 0 AND 1000000),
 start_value integer CHECK (start_value IS NULL OR start_value BETWEEN 0 AND 1000000),
 manual_value integer CHECK (manual_value IS NULL OR manual_value BETWEEN 0 AND 1000000),
 offer_statuses text[] NOT NULL DEFAULT '{}' CHECK (cardinality(offer_statuses)<=20),
 offer_min_age_days integer CHECK (offer_min_age_days IS NULL OR offer_min_age_days BETWEEN 1 AND 365),
 owner_name text CHECK (owner_name IS NULL OR length(owner_name) BETWEEN 1 AND 120),
 period_from date NOT NULL,
 period_to date NOT NULL CHECK (period_to>=period_from),
 archived boolean NOT NULL DEFAULT false,
 version integer NOT NULL DEFAULT 1 CHECK (version>0),
 created_by text REFERENCES platform.users(id) ON DELETE SET NULL,
 updated_by text REFERENCES platform.users(id) ON DELETE SET NULL,
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK (metric<>'open_offers' OR cardinality(offer_statuses)>0)
);
CREATE INDEX mission_goals_source ON platform.mission_goals(source,archived,period_to);
-- Tageswerte je Ziel für den Verlauf (höchstens ein Wert je Tag, der letzte Stand des Tages gilt).
CREATE TABLE platform.mission_goal_values (
 goal_id uuid NOT NULL REFERENCES platform.mission_goals(id) ON DELETE CASCADE,
 day date NOT NULL,
 value integer NOT NULL CHECK (value BETWEEN 0 AND 1000000),
 PRIMARY KEY (goal_id,day)
);
-- Aufgaben, die auf ein Ziel einzahlen (für Fokuszeit je Ziel); höchstens ein Ziel je Aufgabe und Quelle.
CREATE TABLE platform.mission_goal_items (
 goal_id uuid NOT NULL REFERENCES platform.mission_goals(id) ON DELETE CASCADE,
 source text NOT NULL CHECK (length(source) BETWEEN 1 AND 400),
 item_key text NOT NULL CHECK (length(item_key) BETWEEN 3 AND 460),
 linked_by text REFERENCES platform.users(id) ON DELETE SET NULL,
 linked_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (source,item_key)
);
CREATE INDEX mission_goal_items_goal ON platform.mission_goal_items(goal_id);
-- In MissionControl erledigte Aufgaben (Rückblick: erledigt je Woche); PDS liefert kein Erledigt-Datum in der Liste.
CREATE TABLE platform.mission_done (
 id uuid PRIMARY KEY,
 user_id text NOT NULL REFERENCES platform.users(id) ON DELETE CASCADE,
 source text NOT NULL CHECK (length(source) BETWEEN 1 AND 400),
 item_key text NOT NULL CHECK (length(item_key) BETWEEN 3 AND 460),
 title text NOT NULL CHECK (length(title) BETWEEN 1 AND 300),
 done_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX mission_done_user ON platform.mission_done(user_id,source,done_at DESC);
