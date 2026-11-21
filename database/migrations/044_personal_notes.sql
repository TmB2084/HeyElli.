CREATE TABLE platform.personal_notes (
 user_id text PRIMARY KEY REFERENCES platform.users(id) ON DELETE CASCADE,
 body text NOT NULL CHECK (length(body)<=20000),
 version integer NOT NULL DEFAULT 1 CHECK (version>0),
 updated_at timestamptz NOT NULL DEFAULT now()
);
