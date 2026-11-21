-- SharePoint-Ablagestruktur (Vorgabe 21.11.2026): Objekte/<Stadt>/<straße_nr>/<Gewerk>/<Einheit>/<Ablagetyp>,
-- Kunden/<kunde_nr>/<Ablagetyp>. Ablagetypen sind von Administratoren pflegbar; angelegte Ordner werden je Akte
-- fest zugeordnet, damit spätere Adress- oder Namensänderungen in PDS keine Dokumente verwaisen lassen.
CREATE TABLE platform.sharepoint_storage_types (
 key text PRIMARY KEY CHECK (key ~ '^[a-z0-9][a-z0-9_-]{1,39}$'),
 label text NOT NULL CHECK (length(label) BETWEEN 1 AND 60),
 sort integer NOT NULL DEFAULT 100,
 active boolean NOT NULL DEFAULT true,
 updated_by text REFERENCES platform.users(id) ON DELETE SET NULL,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX sharepoint_storage_type_label ON platform.sharepoint_storage_types(lower(label));
INSERT INTO platform.sharepoint_storage_types(key,label,sort) VALUES
 ('mails','Mails',10),('berichte','Berichte',20),('ruecklaeufe','Rückläufe',30),('fotos','Fotos',40),
 ('vertraege','Verträge',50),('angebote','Angebote',60),('sonstiges','Sonstiges',70)
ON CONFLICT DO NOTHING;
-- Zuordnung Akte (+ Ablagetyp) → SharePoint-Ordner. type_key '' = Basisordner der Akte. name_prefix filtert
-- z. B. Auftragsdokumente im Ordner der Einheit (Dateiname beginnt mit der Auftragsnummer).
CREATE TABLE platform.sharepoint_folders (
 library_key text NOT NULL,
 scope_key text NOT NULL CHECK (scope_key ~ '^[a-f0-9]{64}$'),
 type_key text NOT NULL DEFAULT '',
 folder_id text NOT NULL CHECK (length(folder_id) BETWEEN 1 AND 200),
 path text NOT NULL CHECK (length(path) BETWEEN 1 AND 1000),
 name_prefix text NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (library_key,scope_key,type_key)
);
ALTER TABLE platform.sharepoint_uploads ADD COLUMN storage_type text, ADD COLUMN remote_name text;
COMMENT ON COLUMN platform.sharepoint_uploads.storage_type IS 'Ablagetyp; NULL = bisherige Ablage im Hash-Ordner heyelli-<scope>.';
COMMENT ON COLUMN platform.sharepoint_uploads.remote_name IS 'Festgelegter Dateiname in SharePoint (für Wiederholung und Duplikatschutz).';
