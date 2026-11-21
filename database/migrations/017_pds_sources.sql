CREATE TABLE platform.pds_workspaces(id uuid PRIMARY KEY,created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE platform.pds_connection ADD COLUMN workspace_id uuid REFERENCES platform.pds_workspaces(id);
ALTER TABLE platform.pds_connection ADD COLUMN active_source text NOT NULL DEFAULT 'simulator' CHECK(active_source IN ('simulator','pds-readonly'));
ALTER TABLE platform.pds_connection ADD COLUMN views jsonb NOT NULL DEFAULT '{}'::jsonb;
CREATE TABLE platform.pds_user_mappings(
 workspace_id uuid NOT NULL REFERENCES platform.pds_workspaces(id),
 user_id text NOT NULL REFERENCES platform.users(id),
 pds_user_uuid uuid NOT NULL,
 PRIMARY KEY(workspace_id,user_id),UNIQUE(workspace_id,pds_user_uuid)
);
