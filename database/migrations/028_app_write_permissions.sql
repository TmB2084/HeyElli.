ALTER TABLE platform.app_roles ADD COLUMN write_apps jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(write_apps)='array');
-- Preserve existing capabilities: personal preferences remain available with app read access.
UPDATE platform.app_roles r SET write_apps=COALESCE((SELECT jsonb_agg(app) FROM jsonb_array_elements_text(r.apps) AS app WHERE app IN ('/','/service','/stoerungsmeister','/ressourcenmeister','/bereitschaftsmeister')),'[]'::jsonb) WHERE base_role='dispatcher';
