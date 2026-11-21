CREATE TABLE customer_persons (
  id TEXT PRIMARY KEY,
  customer_number TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  created_by TEXT NOT NULL,
  UNIQUE(customer_number, name, phone)
);
CREATE TABLE uploads (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  content BLOB NOT NULL,
  checksum TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
