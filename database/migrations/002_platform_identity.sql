CREATE SCHEMA platform;
CREATE TABLE platform.users (
  id text PRIMARY KEY CHECK (length(id) BETWEEN 1 AND 120),
  display_name text NOT NULL CHECK (length(display_name) BETWEEN 1 AND 100),
  role text NOT NULL CHECK (role IN ('admin', 'dispatcher', 'reader')),
  enabled boolean NOT NULL DEFAULT false,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE platform.sessions (
  id uuid PRIMARY KEY,
  token_hash text NOT NULL UNIQUE CHECK (length(token_hash) = 64),
  user_id text NOT NULL REFERENCES platform.users(id),
  auth_mode text NOT NULL CHECK (auth_mode IN ('simulator', 'demo-directory', 'ldaps')),
  pds_user_uuid text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz
);
CREATE INDEX sessions_user_idx ON platform.sessions(user_id);
CREATE INDEX sessions_expiry_idx ON platform.sessions(expires_at);
CREATE TABLE platform.audit_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id text NOT NULL,
  action text NOT NULL,
  target_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE platform.login_limits (
  scope text PRIMARY KEY,
  window_start timestamptz NOT NULL,
  attempts integer NOT NULL
);
