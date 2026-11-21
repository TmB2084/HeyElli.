CREATE TABLE platform.retention_rules (
 category text PRIMARY KEY CHECK(category IN ('chat','feedback','mail','sessions')),
 review_after_days integer CHECK(review_after_days BETWEEN 1 AND 36500),
 hold boolean NOT NULL DEFAULT false,
 version integer NOT NULL DEFAULT 1,
 updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO platform.retention_rules(category) VALUES('chat'),('feedback'),('mail'),('sessions');
CREATE TABLE platform.privacy_plans (
 id uuid PRIMARY KEY,
 actor_id text NOT NULL REFERENCES platform.users(id),
 subject_id text NOT NULL REFERENCES platform.users(id),
 categories jsonb NOT NULL,
 cutoff date NOT NULL,
 fingerprint text NOT NULL,
 summary jsonb NOT NULL,
 expires_at timestamptz NOT NULL DEFAULT now()+interval '10 minutes',
 consumed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE platform.privacy_executions (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 plan_id uuid NOT NULL UNIQUE REFERENCES platform.privacy_plans(id),
 actor_id text NOT NULL,
 subject_id text NOT NULL,
 summary jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
-- Keep identifiers after removal, so a late tab/request cannot recreate a turn.
CREATE TABLE platform.removed_chat_turns (
 user_id text NOT NULL REFERENCES platform.users(id),
 epoch uuid NOT NULL,
 turn_id uuid NOT NULL,
 removed_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,epoch,turn_id)
);
ALTER TABLE platform.mail_queue ADD COLUMN content_cleared_at timestamptz;
CREATE INDEX privacy_plans_actor ON platform.privacy_plans(actor_id,created_at DESC);
CREATE INDEX privacy_executions_subject ON platform.privacy_executions(subject_id,id DESC);
