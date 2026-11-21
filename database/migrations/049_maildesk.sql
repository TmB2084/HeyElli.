-- MailDesk: geteiltes Postfach mit Kundenzuordnung. Gespeichert werden nur Entscheidungen und Bearbeitungsstände
-- je Nachricht (Zuordnung, Auftrag, Zuständigkeit, Markierung, Archiv) – keine Mailinhalte.
CREATE TABLE platform.maildesk_messages (
 source text NOT NULL CHECK (length(source) BETWEEN 1 AND 400),
 message_id text NOT NULL CHECK (length(message_id) BETWEEN 1 AND 400),
 customer_id text CHECK (customer_id IS NULL OR length(customer_id) BETWEEN 1 AND 200),
 object_id text CHECK (object_id IS NULL OR length(object_id) BETWEEN 1 AND 200),
 order_number text CHECK (order_number IS NULL OR length(order_number) BETWEEN 1 AND 80),
 decision text NOT NULL DEFAULT 'auto' CHECK (decision IN ('auto','manual','confirmed','cleared')),
 assignee_id text REFERENCES platform.users(id) ON DELETE SET NULL,
 flagged boolean NOT NULL DEFAULT false,
 archived boolean NOT NULL DEFAULT false,
 version integer NOT NULL DEFAULT 1 CHECK (version>0),
 updated_by text REFERENCES platform.users(id) ON DELETE SET NULL,
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (source,message_id),
 CHECK (decision<>'manual' AND decision<>'confirmed' OR customer_id IS NOT NULL)
);
-- Gelernte Absender: nach bestätigter oder manueller Zuordnung ordnet dieselbe Absenderadresse künftig automatisch zu.
CREATE TABLE platform.maildesk_senders (
 source text NOT NULL CHECK (length(source) BETWEEN 1 AND 400),
 sender text NOT NULL CHECK (sender=lower(sender) AND length(sender) BETWEEN 3 AND 320),
 customer_id text NOT NULL CHECK (length(customer_id) BETWEEN 1 AND 200),
 learned_by text REFERENCES platform.users(id) ON DELETE SET NULL,
 learned_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (source,sender)
);
-- Antworten aus MailDesk laufen über die zentrale Mail-Warteschlange (Testbetrieb wird dort beachtet).
CREATE TABLE platform.maildesk_replies (
 id uuid PRIMARY KEY,
 source text NOT NULL CHECK (length(source) BETWEEN 1 AND 400),
 message_id text NOT NULL CHECK (length(message_id) BETWEEN 1 AND 400),
 actor_id text NOT NULL CHECK (length(actor_id) BETWEEN 1 AND 120),
 queue_id uuid NOT NULL REFERENCES platform.mail_queue(id),
 test_mode boolean NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX maildesk_replies_message ON platform.maildesk_replies(source,message_id,created_at);
