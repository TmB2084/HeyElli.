CREATE TABLE platform.incident_defaults (
 source text PRIMARY KEY,
 positions jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(positions)='array' AND jsonb_array_length(positions)<=20),
 version integer NOT NULL DEFAULT 1 CHECK (version>0),
 updated_at timestamptz NOT NULL DEFAULT now(),
 updated_by text REFERENCES platform.users(id)
);
