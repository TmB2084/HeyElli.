CREATE TABLE platform.bmacloud_settings (
 id text PRIMARY KEY CHECK(id='central'),
 version integer NOT NULL DEFAULT 0,
 enabled boolean NOT NULL DEFAULT false,
 config_id uuid,
 tested_at timestamptz,
 tested_version integer,
 updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO platform.bmacloud_settings(id) VALUES('central');
COMMENT ON TABLE platform.bmacloud_settings IS 'Read-only BMACloud lookup; credentials stay in encrypted local environment files. No remote writes.';
