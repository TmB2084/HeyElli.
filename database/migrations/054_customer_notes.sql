-- Kunde 360: Notizen am Kunden (Gesprächsvermerke, Hinweise). PDS bietet Aktivitäten nicht über die API an,
-- daher bleiben Notizen in heyelli. Nur Anlegen und Löschen eigener Notizen; je Datenquelle getrennt.
CREATE TABLE platform.customer_notes (
 id uuid PRIMARY KEY,
 source text NOT NULL CHECK (length(source) BETWEEN 1 AND 400),
 customer_id text NOT NULL CHECK (length(customer_id) BETWEEN 1 AND 200),
 body text NOT NULL CHECK (length(btrim(body)) BETWEEN 1 AND 2000),
 author_id text REFERENCES platform.users(id) ON DELETE SET NULL,
 author_name text NOT NULL CHECK (length(author_name) BETWEEN 1 AND 120),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX customer_notes_customer ON platform.customer_notes(source,customer_id,created_at DESC);
