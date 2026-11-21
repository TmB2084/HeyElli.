CREATE TABLE platform.sharepoint_settings (
 id text PRIMARY KEY CHECK(id='central'),version integer NOT NULL DEFAULT 0,
 enabled boolean NOT NULL DEFAULT false,config_id uuid,tested_version integer,
 tested_at timestamptz,updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO platform.sharepoint_settings(id) VALUES('central');
ALTER TABLE platform.secret_archives DROP CONSTRAINT secret_archives_provider_check;
ALTER TABLE platform.secret_archives ADD CONSTRAINT secret_archives_provider_check CHECK(provider IN ('bmacloud','copilot','pds','graph','sharepoint'));
CREATE TABLE platform.sharepoint_uploads (
 id uuid PRIMARY KEY,actor_id text NOT NULL REFERENCES platform.users(id),
 scope_key text NOT NULL,library_key text NOT NULL,display_name text NOT NULL,
 content_hash text NOT NULL,size integer NOT NULL CHECK(size BETWEEN 1 AND 8388608),
 state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','complete','changed','missing')),
 remote_id text,etag text,created_at timestamptz NOT NULL DEFAULT now(),completed_at timestamptz
);
CREATE INDEX sharepoint_upload_scope ON platform.sharepoint_uploads(library_key,scope_key,created_at DESC);
CREATE INDEX sharepoint_upload_repeat ON platform.sharepoint_uploads(actor_id,scope_key,library_key,content_hash,display_name) WHERE state IN ('pending','complete');
COMMENT ON TABLE platform.sharepoint_uploads IS 'Content-free shared document association and retry proof. No automatic retention/deletion; file contents remain in SharePoint.';
CREATE INDEX sharepoint_upload_day ON platform.sharepoint_uploads(created_at);
