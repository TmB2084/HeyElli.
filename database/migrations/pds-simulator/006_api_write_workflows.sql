CREATE TABLE pds_api_entities (
  sequence INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL,
  payload TEXT NOT NULL,
  content BLOB
);
CREATE TABLE pds_api_steps (
  workflow_key TEXT NOT NULL,
  step_key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  response TEXT NOT NULL,
  PRIMARY KEY(workflow_key, step_key)
);
