-- Bounded, content-free operational telemetry; no request/user/payload snapshots.
CREATE TABLE platform.operation_metrics (
 minute timestamptz NOT NULL, area text NOT NULL,
 requests integer NOT NULL CHECK(requests BETWEEN 1 AND 1000000),
 failures integer NOT NULL, slow integer NOT NULL, duration_ms bigint NOT NULL,
 PRIMARY KEY(minute,area)
);
CREATE TABLE platform.operation_alarms (
 code text PRIMARY KEY, active boolean NOT NULL,
 incident_id uuid NOT NULL, first_seen timestamptz NOT NULL, last_seen timestamptz NOT NULL,
 resolved_at timestamptz, occurrences integer NOT NULL DEFAULT 1,
 acknowledged_by text, acknowledged_at timestamptz
);
CREATE TABLE platform.operation_monitor (
 id text PRIMARY KEY CHECK(id='local'), checked_at timestamptz NOT NULL,
 snapshot jsonb NOT NULL
);
