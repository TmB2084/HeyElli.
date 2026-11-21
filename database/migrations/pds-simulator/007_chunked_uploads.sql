ALTER TABLE uploads ADD COLUMN transfer_id TEXT;
ALTER TABLE uploads ADD COLUMN chunked_size INTEGER;
CREATE TABLE upload_transfers (
 id TEXT PRIMARY KEY,
 upload_id TEXT NOT NULL,
 created_by TEXT NOT NULL,
 bytes INTEGER NOT NULL DEFAULT 0,
 state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','complete'))
);
CREATE TABLE upload_chunks (
 transfer_id TEXT NOT NULL REFERENCES upload_transfers(id) ON DELETE CASCADE,
 position INTEGER NOT NULL,
 content BLOB NOT NULL,
 PRIMARY KEY(transfer_id,position)
);
CREATE INDEX upload_owner ON uploads(created_by);
CREATE INDEX transfer_owner ON upload_transfers(created_by,state);
