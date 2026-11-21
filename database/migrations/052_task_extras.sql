-- Aufgaben: Kern liegt in PDS (CRM-Aufgaben, /crm/*). heyelli speichert nur Ergänzungen, die PDS nicht kennt:
-- Checkliste, Verknüpfungen (Mail, Dokument, Auftrag) und einen kurzen Verlauf der in heyelli ausgeführten Änderungen.
-- source: Datenquelle (simulator bzw. pds:<workspace>), damit Simulator- und Echtdaten getrennt bleiben.
CREATE TABLE platform.task_extras (
 source text NOT NULL CHECK (length(source) BETWEEN 1 AND 400),
 task_id text NOT NULL CHECK (length(task_id) BETWEEN 1 AND 200),
 checklist jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(checklist)='array' AND jsonb_array_length(checklist)<=50),
 links jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(links)='array' AND jsonb_array_length(links)<=20),
 history jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(history)='array' AND jsonb_array_length(history)<=100),
 version integer NOT NULL DEFAULT 1 CHECK (version>0),
 updated_by text REFERENCES platform.users(id) ON DELETE SET NULL,
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (source,task_id)
);
