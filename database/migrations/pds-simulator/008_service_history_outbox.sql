-- Same transaction as the local business change; pending rows never expire.
CREATE TABLE service_history_outbox (
 id TEXT PRIMARY KEY,
 payload TEXT NOT NULL,
 delivered INTEGER NOT NULL DEFAULT 0 CHECK(delivered IN (0,1))
);
CREATE INDEX service_history_pending ON service_history_outbox(delivered);
