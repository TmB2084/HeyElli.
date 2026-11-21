ALTER TABLE platform.secret_orphans DROP CONSTRAINT secret_orphans_provider_check;
ALTER TABLE platform.secret_orphans ADD CONSTRAINT secret_orphans_provider_check CHECK(provider IN ('bmacloud','copilot','pds','graph','sharepoint'));
