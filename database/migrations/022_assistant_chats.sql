CREATE TABLE platform.assistant_chats (
 user_id text PRIMARY KEY REFERENCES platform.users(id) ON DELETE CASCADE,
 epoch uuid NOT NULL DEFAULT gen_random_uuid(),
 turns jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(turns)='array' AND jsonb_array_length(turns)<=500),
 updated_at timestamptz NOT NULL DEFAULT now()
);
