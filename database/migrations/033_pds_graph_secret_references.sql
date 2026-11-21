-- NULL continues to read the existing legacy file without rewriting it.
ALTER TABLE platform.pds_connection ADD COLUMN config_id uuid;
ALTER TABLE platform.mail_settings ADD COLUMN config_id uuid;
ALTER TABLE platform.secret_archives DROP CONSTRAINT secret_archives_provider_check;
ALTER TABLE platform.secret_archives ADD CONSTRAINT secret_archives_provider_check CHECK(provider IN ('bmacloud','copilot','pds','graph'));
ALTER TABLE platform.secret_orphans DROP CONSTRAINT secret_orphans_provider_check;
ALTER TABLE platform.secret_orphans ADD CONSTRAINT secret_orphans_provider_check CHECK(provider IN ('bmacloud','copilot','pds','graph'));
