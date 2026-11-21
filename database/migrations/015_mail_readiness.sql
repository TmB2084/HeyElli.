ALTER TABLE platform.mail_settings ADD COLUMN checked_sender text;
ALTER TABLE platform.mail_settings ADD COLUMN checked_at timestamptz;
ALTER TABLE platform.mail_settings ADD COLUMN connection_ok boolean NOT NULL DEFAULT false;
CREATE TABLE platform.mail_worker_health (
 id text PRIMARY KEY CHECK(id='central'),
 last_seen timestamptz NOT NULL,
 last_success timestamptz,
 healthy boolean NOT NULL DEFAULT false
);
ALTER TABLE platform.mail_queue DROP CONSTRAINT mail_queue_status_check;
ALTER TABLE platform.mail_queue ADD CONSTRAINT mail_queue_status_check CHECK(status IN ('queued','simulated','sending','accepted','retry','failed','unknown','cancelled'));
