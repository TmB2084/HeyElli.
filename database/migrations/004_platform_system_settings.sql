CREATE TABLE platform.system_settings (
  id text PRIMARY KEY CHECK (id = 'platform'),
  default_appearance text NOT NULL DEFAULT 'dark' CHECK (default_appearance IN ('dark','light','system')),
  show_technician_badges boolean NOT NULL DEFAULT true,
  limit_working_hours boolean NOT NULL DEFAULT false,
  show_tentative boolean NOT NULL DEFAULT true,
  version integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO platform.system_settings (id) VALUES ('platform');
