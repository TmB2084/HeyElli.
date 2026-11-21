CREATE SCHEMA service_catalog;

CREATE TABLE service_catalog.services (
  id uuid PRIMARY KEY,
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text NOT NULL CHECK (length(trim(name)) > 0),
  description text NOT NULL,
  status text NOT NULL CHECK (status IN ('planned', 'available')),
  created_at timestamptz NOT NULL DEFAULT now()
);
