ALTER TABLE platform.assistant_chats
 ADD COLUMN drafts jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(drafts)='object'),
 ADD COLUMN pending jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(pending)='array' AND jsonb_array_length(pending)<=50);
