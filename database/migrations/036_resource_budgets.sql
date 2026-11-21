CREATE TABLE platform.resource_leases (
 id uuid PRIMARY KEY,
 user_id text NOT NULL REFERENCES platform.users(id) ON DELETE CASCADE,
 kind text NOT NULL CHECK(kind IN ('normal','heavy','export')),
 expires_at timestamptz NOT NULL
);
CREATE INDEX resource_leases_expiry ON platform.resource_leases(expires_at);
CREATE INDEX resource_leases_owner ON platform.resource_leases(user_id,expires_at);
CREATE TABLE platform.resource_windows (
 scope text PRIMARY KEY,
 user_id text REFERENCES platform.users(id) ON DELETE CASCADE,
 window_start timestamptz NOT NULL DEFAULT now(),
 requests integer NOT NULL DEFAULT 0
);
CREATE INDEX audit_actor_cursor ON platform.audit_events(actor_id,id DESC);
CREATE INDEX audit_action_cursor ON platform.audit_events(action,id DESC);
CREATE INDEX audit_created_cursor ON platform.audit_events(created_at,id DESC);
