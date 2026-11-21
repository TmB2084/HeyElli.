ALTER TABLE platform.pds_connection ADD COLUMN calendar_checked_at timestamptz;
ALTER TABLE platform.pds_connection ADD COLUMN calendar_checked_version integer;
ALTER TABLE platform.pds_connection ADD COLUMN calendar_check jsonb;
