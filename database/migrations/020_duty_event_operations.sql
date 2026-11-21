CREATE TABLE platform.duty_event_operations (
 id uuid PRIMARY KEY,
 actor_id text NOT NULL,
 event_id text NOT NULL,
 request_hash text NOT NULL,
 payload jsonb NOT NULL,
 complete boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX duty_event_operation_active_idx ON platform.duty_event_operations(event_id) WHERE NOT complete;
