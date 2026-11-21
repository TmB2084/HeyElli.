CREATE TABLE platform.calendar_history (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_id text NOT NULL,
  actor_id text NOT NULL,
  actor_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  changes jsonb NOT NULL CHECK (jsonb_typeof(changes) = 'array')
);
CREATE INDEX calendar_history_event_idx ON platform.calendar_history(event_id, id DESC);
