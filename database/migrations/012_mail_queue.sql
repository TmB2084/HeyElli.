CREATE TABLE platform.mail_settings (
 id text PRIMARY KEY CHECK(id='central'),
 sender text NOT NULL DEFAULT 'service@example.invalid',
 version integer NOT NULL DEFAULT 1
);
INSERT INTO platform.mail_settings(id) VALUES('central');
CREATE TABLE platform.mail_queue (
 id uuid PRIMARY KEY,
 request_id uuid NOT NULL UNIQUE,
 sender text NOT NULL,
 recipient text NOT NULL,
 subject text NOT NULL,
 body text NOT NULL,
 actor_id text NOT NULL,
 status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','simulated')),
 created_at timestamptz NOT NULL DEFAULT now(),
 processed_at timestamptz
);
CREATE TABLE platform.mail_log (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 mail_id uuid NOT NULL REFERENCES platform.mail_queue(id),
 actor_id text NOT NULL,
 action text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
