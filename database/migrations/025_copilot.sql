CREATE TABLE platform.copilot_settings (
 id text PRIMARY KEY CHECK(id='central'),
 version integer NOT NULL DEFAULT 0,
 enabled boolean NOT NULL DEFAULT false,
 config_id uuid,
 tested_version integer,
 tested_at timestamptz,
 updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO platform.copilot_settings(id) VALUES('central');
CREATE TABLE platform.assistant_actions (
 id uuid PRIMARY KEY,
 user_id text NOT NULL REFERENCES platform.users(id) ON DELETE CASCADE,
 epoch uuid NOT NULL,
 turn_id uuid NOT NULL,
 config_version integer NOT NULL,
 proposal jsonb NOT NULL,
 preview jsonb NOT NULL,
 state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','executing','done','cancelled','failed','uncertain')),
 result text,
 created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL DEFAULT now()+interval '15 minutes',
 UNIQUE(user_id,epoch,turn_id)
);
CREATE INDEX assistant_actions_owner ON platform.assistant_actions(user_id,epoch);
COMMENT ON TABLE platform.assistant_actions IS 'Server-created immutable proposals. Execution requires a separate explicit user confirmation, current role, matching chat/configuration and current target state. Uncertain writes are never repeated automatically.';
