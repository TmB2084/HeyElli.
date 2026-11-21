CREATE TABLE platform.private_draft_keys (
 user_id text PRIMARY KEY REFERENCES platform.users(id) ON DELETE CASCADE,
 key_id uuid NOT NULL UNIQUE,
 wrapped_key text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE platform.private_draft_copies (
 user_id text NOT NULL REFERENCES platform.private_draft_keys(user_id) ON DELETE CASCADE,
 storage_key text NOT NULL CHECK(length(storage_key)<=600),
 envelope text,
 state text NOT NULL CHECK(state IN ('pending','complete')),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,storage_key)
);
CREATE INDEX private_drafts_pending ON platform.private_draft_copies(user_id,storage_key) WHERE state='pending';
