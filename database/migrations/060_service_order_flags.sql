-- Persönliche Auftragsmarkierungen pro Benutzer und aktiver Service-Datenquelle.
CREATE TABLE platform.service_order_flags (
 user_id text NOT NULL REFERENCES platform.users(id) ON DELETE CASCADE,
 source text NOT NULL CHECK (length(source) BETWEEN 1 AND 200),
 order_id text NOT NULL CHECK (length(order_id) BETWEEN 1 AND 200),
 flagged_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (user_id,source,order_id)
);
