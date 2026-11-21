CREATE TABLE platform.microsoft_auth (
 id text PRIMARY KEY CHECK(id='central'),
 version integer NOT NULL DEFAULT 1,
 config_id uuid,
 enabled boolean NOT NULL DEFAULT false,
 checked_at timestamptz,
 tested_at timestamptz,
 tested_version integer,
 tested_user_id text REFERENCES platform.users(id),
 tested_actor text
);
INSERT INTO platform.microsoft_auth(id) VALUES('central');
CREATE TABLE platform.microsoft_auth_flows (
 state_hash text PRIMARY KEY CHECK(length(state_hash)=64),
 cookie_hash text NOT NULL CHECK(length(cookie_hash)=64),
 config_id uuid NOT NULL,
 config_version integer NOT NULL,
 actor_id text REFERENCES platform.users(id),
 purpose text NOT NULL CHECK(purpose IN ('test','login')),
 expires_at timestamptz NOT NULL DEFAULT now()+interval '10 minutes'
);
CREATE INDEX microsoft_auth_flows_expiry_idx ON platform.microsoft_auth_flows(expires_at);
ALTER TABLE platform.sessions DROP CONSTRAINT sessions_auth_mode_check;
ALTER TABLE platform.sessions ADD CONSTRAINT sessions_auth_mode_check CHECK(auth_mode IN ('simulator','demo-directory','ldaps','microsoft'));
ALTER TABLE platform.sessions ADD COLUMN microsoft_revision integer;
