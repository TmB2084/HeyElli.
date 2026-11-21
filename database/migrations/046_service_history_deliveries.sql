-- Delivery receipt commits atomically with audit and calendar history.
CREATE TABLE platform.service_history_deliveries (
 id uuid PRIMARY KEY,
 payload_hash text NOT NULL CHECK (payload_hash ~ '^[a-f0-9]{64}$'),
 delivered_at timestamptz NOT NULL DEFAULT now()
);
