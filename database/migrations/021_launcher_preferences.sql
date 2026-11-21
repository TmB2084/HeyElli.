CREATE TABLE platform.launcher_preferences (
  user_id text PRIMARY KEY REFERENCES platform.users(id) ON DELETE CASCADE,
  view_mode text NOT NULL DEFAULT 'grid' CHECK (view_mode IN ('grid', 'list')),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
