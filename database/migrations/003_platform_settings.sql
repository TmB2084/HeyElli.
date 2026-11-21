CREATE TABLE platform.calendar_colors (
  id text PRIMARY KEY CHECK (id = 'calendar'),
  settings jsonb NOT NULL CHECK (jsonb_typeof(settings) = 'object'),
  version text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- The hash also preserves legacy files whose user has not yet been provisioned.
-- Ownership is always derived from the verified session, never a client-supplied ID.
CREATE TABLE platform.user_preferences (
  owner_hash text PRIMARY KEY CHECK (owner_hash ~ '^[a-f0-9]{64}$'),
  calendar jsonb NOT NULL CHECK (jsonb_typeof(calendar) = 'object'),
  calendar_version integer NOT NULL DEFAULT 1,
  appearance text CHECK (appearance IN ('dark', 'light', 'system')),
  appearance_version integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);
