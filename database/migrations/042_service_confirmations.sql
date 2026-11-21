CREATE TABLE platform.service_confirmations (
 id uuid PRIMARY KEY,
 actor_id text NOT NULL REFERENCES platform.users(id),
 source text NOT NULL,order_id text NOT NULL,incident_id text NOT NULL,
 request_hash text NOT NULL CHECK(length(request_hash)=64),
 delivery_key text NOT NULL CHECK(length(delivery_key)=64),
 channel text NOT NULL CHECK(channel IN ('outlook','graph')),
 test_mode boolean NOT NULL,
 queue_id uuid REFERENCES platform.mail_queue(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(source,order_id,incident_id,channel,delivery_key)
);
COMMENT ON TABLE platform.service_confirmations IS 'Confirmation receipts and deduplication metadata only. Outlook preparation is not proof of sending. Mail content remains in the existing Graph queue.';
CREATE INDEX service_confirmations_graph_window ON platform.service_confirmations(created_at,actor_id) WHERE channel='graph';
