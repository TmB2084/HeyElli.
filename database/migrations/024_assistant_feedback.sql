CREATE TABLE platform.assistant_feedback (
 user_id text NOT NULL REFERENCES platform.users(id) ON DELETE CASCADE,
 epoch uuid NOT NULL,
 turn_id uuid NOT NULL,
 rating text NOT NULL CHECK (rating IN ('up','down')),
 reason text CHECK (reason IN ('workflow','missing','permission','context','unclear','other')),
 comment text NOT NULL DEFAULT '' CHECK (length(comment)<=600),
 question text NOT NULL CHECK (length(question)<=1500),
 answer text NOT NULL CHECK (length(answer)<=6000),
 sources jsonb NOT NULL CHECK (jsonb_typeof(sources)='array'),
 knowledge_version text NOT NULL CHECK (length(knowledge_version)<=80),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,epoch,turn_id),
 CHECK (rating='down' OR (reason IS NULL AND comment=''))
);
CREATE INDEX assistant_feedback_updated ON platform.assistant_feedback(updated_at DESC);
COMMENT ON TABLE platform.assistant_feedback IS 'Explicitly submitted admin feedback, including only the rated own question/answer. Kept across chat reset; removable by its owner. No model-training input.';
