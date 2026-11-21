ALTER TABLE platform.app_roles ADD COLUMN tools jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(tools)='array');
CREATE TABLE platform.tool_preferences (
 user_id text PRIMARY KEY REFERENCES platform.users(id) ON DELETE CASCADE,
 hidden_tools jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(hidden_tools)='array'),
 version integer NOT NULL DEFAULT 1,
 updated_at timestamptz NOT NULL DEFAULT now()
);
