CREATE TABLE platform.secret_archives (
 provider text NOT NULL CHECK(provider IN ('bmacloud','copilot')),
 config_id uuid NOT NULL,
 archived_at timestamptz NOT NULL DEFAULT now(),
 protected_until timestamptz NOT NULL DEFAULT now()+interval '7 days',
 PRIMARY KEY(provider,config_id)
);
CREATE TABLE platform.secret_orphans (
 provider text NOT NULL CHECK(provider IN ('bmacloud','copilot')),
 config_id uuid NOT NULL,
 fingerprint text NOT NULL,
 first_seen timestamptz NOT NULL DEFAULT now(),
 observations integer NOT NULL DEFAULT 1,
 PRIMARY KEY(provider,config_id)
);
