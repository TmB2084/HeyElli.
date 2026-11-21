-- MailDesk-Postfachquelle zentral in den Einstellungen (statt Umgebungsvariablen): Beispielpostfach oder
-- geteiltes Microsoft-365-Postfach. Umschalten auf Microsoft 365 nur nach erfolgreicher Verbindungsprüfung.
CREATE TABLE platform.maildesk_settings (
 id text PRIMARY KEY CHECK (id='central'),
 source text NOT NULL DEFAULT 'simulator' CHECK (source IN ('simulator','graph')),
 mailbox text CHECK (mailbox IS NULL OR (mailbox=lower(mailbox) AND length(mailbox) BETWEEN 3 AND 320)),
 version integer NOT NULL DEFAULT 1 CHECK (version>0),
 checked_mailbox text,
 checked_at timestamptz,
 connection_ok boolean NOT NULL DEFAULT false,
 updated_by text REFERENCES platform.users(id) ON DELETE SET NULL,
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK (source<>'graph' OR mailbox IS NOT NULL)
);
INSERT INTO platform.maildesk_settings(id) VALUES('central') ON CONFLICT DO NOTHING;
