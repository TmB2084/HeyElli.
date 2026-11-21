CREATE TABLE platform.pds_connection (
 id text PRIMARY KEY CHECK(id='central'),
 version integer NOT NULL DEFAULT 1,
 configured boolean NOT NULL DEFAULT false,
 checked_at timestamptz,
 checks jsonb,
 checked_version integer
);
INSERT INTO platform.pds_connection(id) VALUES('central');
