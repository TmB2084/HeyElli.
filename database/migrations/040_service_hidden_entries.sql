CREATE TABLE platform.service_hidden_entries (
 user_id text NOT NULL REFERENCES platform.users(id) ON DELETE CASCADE,
 source text NOT NULL CHECK (length(source) BETWEEN 1 AND 200),
 kind text NOT NULL CHECK (kind IN ('customer','object')),
 entity_id text NOT NULL CHECK (length(entity_id) BETWEEN 1 AND 200),
 hidden_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (user_id,source,kind,entity_id)
);
