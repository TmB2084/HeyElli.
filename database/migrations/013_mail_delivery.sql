ALTER TABLE platform.mail_settings ADD COLUMN test_mode boolean NOT NULL DEFAULT true;
ALTER TABLE platform.mail_queue ADD COLUMN test_mode boolean NOT NULL DEFAULT true;
ALTER TABLE platform.mail_queue ADD COLUMN attempts integer NOT NULL DEFAULT 0;
ALTER TABLE platform.mail_queue ADD COLUMN next_attempt_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE platform.mail_queue ADD COLUMN error text;
ALTER TABLE platform.mail_queue DROP CONSTRAINT mail_queue_status_check;
ALTER TABLE platform.mail_queue ADD CONSTRAINT mail_queue_status_check CHECK(status IN ('queued','simulated','sending','accepted','retry','failed','unknown'));
CREATE INDEX mail_queue_pending ON platform.mail_queue(next_attempt_at) WHERE status IN ('queued','retry');
