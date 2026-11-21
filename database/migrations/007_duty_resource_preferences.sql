CREATE TABLE platform.duty_resource_preferences (
 user_id text PRIMARY KEY REFERENCES platform.users(id) ON DELETE CASCADE,
 selection jsonb NOT NULL DEFAULT 'null'::jsonb CHECK (selection = 'null'::jsonb OR jsonb_typeof(selection) = 'array'),
 version integer NOT NULL DEFAULT 0 CHECK (version >= 0),
 updated_at timestamptz NOT NULL DEFAULT now()
);
