-- heyelli-Konten: eigenes Passwort bis zur Entra-Aktivierung, Verknüpfung mit einem Microsoft-Konto
-- und Zuordnung zu einem PDS-Benutzer je PDS-Quelle. Ersetzt Demo-/Simulator-Anmeldung und Mitarbeiterzuordnung.

ALTER TABLE platform.users
 ADD COLUMN username text CHECK (username ~ '^[a-z0-9][a-z0-9._-]{2,79}$'),
 ADD COLUMN password_hash text CHECK (password_hash IS NULL OR password_hash ~ '^scrypt\$[0-9]+\$[0-9]+\$[0-9]+\$[A-Za-z0-9_-]{22}\$[A-Za-z0-9_-]{86}$'),
 ADD COLUMN password_must_change boolean NOT NULL DEFAULT false,
 ADD COLUMN password_changed_at timestamptz,
 ADD COLUMN microsoft_subject text CHECK (microsoft_subject ~ '^entra:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),
 ADD COLUMN microsoft_upn text CHECK (microsoft_upn = lower(microsoft_upn) AND length(microsoft_upn) BETWEEN 3 AND 254 AND microsoft_upn ~ '^[^\s@]+@[^\s@]+$'),
 ADD COLUMN microsoft_linked_at timestamptz;
CREATE UNIQUE INDEX users_username_key ON platform.users(username) WHERE username IS NOT NULL;
CREATE UNIQUE INDEX users_microsoft_subject_key ON platform.users(microsoft_subject) WHERE microsoft_subject IS NOT NULL;
CREATE UNIQUE INDEX users_microsoft_upn_key ON platform.users(microsoft_upn) WHERE microsoft_upn IS NOT NULL;

-- Bisher eigenständige Microsoft-Identitäten bleiben als verknüpfte Konten erhalten.
UPDATE platform.users SET microsoft_subject=id, microsoft_linked_at=now() WHERE id ~ '^entra:[0-9a-f-]{36}:[0-9a-f-]{36}$';

-- Fester Arbeitsbereich für die Simulator-Quelle; echte PDS-Quellen behalten ihre eigenen Arbeitsbereiche.
-- Wie createWorkspace (src/modules/pds-connection/source.ts): Eintrag plus eigenes Schema; der Simulator nutzt weiterhin die Plattformtabellen.
INSERT INTO platform.pds_workspaces(id) VALUES ('00000000-0000-4000-8000-000000000001');
CREATE SCHEMA "pds_00000000000040008000000000000001";
CREATE TABLE "pds_00000000000040008000000000000001".calendar_colors (LIKE platform.calendar_colors INCLUDING ALL);
CREATE TABLE "pds_00000000000040008000000000000001".user_preferences (LIKE platform.user_preferences INCLUDING ALL);
-- Simulator-Kennungen sind keine UUIDs.
ALTER TABLE platform.pds_user_mappings ALTER COLUMN pds_user_uuid TYPE text USING pds_user_uuid::text;
-- Die Zuordnung gehört zum Konto und wird mit ihm gelöscht.
ALTER TABLE platform.pds_user_mappings DROP CONSTRAINT pds_user_mappings_user_id_fkey;
ALTER TABLE platform.pds_user_mappings ADD CONSTRAINT pds_user_mappings_user_id_fkey FOREIGN KEY (user_id) REFERENCES platform.users(id) ON DELETE CASCADE;
ALTER TABLE platform.pds_user_mappings ADD CONSTRAINT pds_user_mappings_pds_user_check CHECK (length(pds_user_uuid) BETWEEN 1 AND 200 AND pds_user_uuid !~ '\s');

-- Mitarbeiterzuordnung des BereitschaftsMeisters wird zur PDS-Zuordnung der damals aktiven Quelle.
INSERT INTO platform.pds_user_mappings(workspace_id,user_id,pds_user_uuid)
 SELECT CASE WHEN c.active_source='pds-readonly' AND c.workspace_id IS NOT NULL THEN c.workspace_id ELSE '00000000-0000-4000-8000-000000000001'::uuid END, l.user_id, l.resource_id
 FROM platform.duty_employee_links l CROSS JOIN platform.pds_connection c WHERE c.id='central'
 ON CONFLICT DO NOTHING;
DROP TABLE platform.duty_employee_links;

-- Microsoft-Anmeldevorgang: zusätzlicher Zweck „link“ (angemeldetes Konto mit Microsoft verknüpfen).
ALTER TABLE platform.microsoft_auth_flows DROP CONSTRAINT microsoft_auth_flows_purpose_check;
ALTER TABLE platform.microsoft_auth_flows ADD CONSTRAINT microsoft_auth_flows_purpose_check CHECK (purpose IN ('test','login','link'));

-- Sitzungen: nur noch lokale Konten und Microsoft. Bisherige Demo-/Simulator-Sitzungen enden (einmal neu anmelden).
UPDATE platform.sessions SET revoked_at=now() WHERE revoked_at IS NULL AND auth_mode<>'microsoft';
ALTER TABLE platform.sessions DROP CONSTRAINT sessions_auth_mode_check;
ALTER TABLE platform.sessions ADD CONSTRAINT sessions_auth_mode_check CHECK (auth_mode IN ('simulator','demo-directory','ldaps','microsoft','local'));
