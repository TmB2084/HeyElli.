-- Neue App-Namen und Adressen (21.11.2026): /service → /servicehub, /stoerungsmeister → /casedesk,
-- /ressourcenmeister → /planboard, /bereitschaftsmeister → /dutyboard, /aufgaben → /taskhub.
-- Alte Adressen leiten dauerhaft weiter (next.config.ts). Auf Wunsch der Fachverantwortung erhalten zunächst alle Rollen
-- alle Apps mit Lese- und Schreibrecht (Einstellungen bleiben Administratoren vorbehalten).
CREATE FUNCTION pg_temp.rename_app(path text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
 SELECT CASE path WHEN '/service' THEN '/servicehub' WHEN '/stoerungsmeister' THEN '/casedesk' WHEN '/ressourcenmeister' THEN '/planboard'
  WHEN '/bereitschaftsmeister' THEN '/dutyboard' WHEN '/aufgaben' THEN '/taskhub' ELSE path END $$;

-- Rollen: Pfade umschreiben (falls später wieder eingeschränkt wird, bleibt die Zuordnung korrekt) …
UPDATE platform.app_roles SET
 apps=COALESCE((SELECT jsonb_agg(pg_temp.rename_app(app)) FROM jsonb_array_elements_text(apps) AS app),'[]'::jsonb),
 write_apps=COALESCE((SELECT jsonb_agg(pg_temp.rename_app(app)) FROM jsonb_array_elements_text(write_apps) AS app),'[]'::jsonb);
-- … und vollständig freigeben: alle Apps lesen und schreiben.
UPDATE platform.app_roles SET
 apps='["/","/servicehub","/casedesk","/planboard","/dutyboard","/maildesk","/taskhub","/missioncontrol","/benutzerkonto","/hilfe"]'::jsonb,
 write_apps='["/","/servicehub","/casedesk","/planboard","/dutyboard","/maildesk","/taskhub","/missioncontrol"]'::jsonb,
 version=version+1;
-- Rollenänderung: bestehende Sitzungen der betroffenen Konten widerrufen (Administratoren unverändert).
UPDATE platform.sessions SET revoked_at=now() WHERE revoked_at IS NULL AND user_id IN (SELECT id FROM platform.users WHERE role<>'admin');
INSERT INTO platform.audit_events(actor_id,action,target_id,changes) VALUES('system','app-role.migration','058',
 '[{"field":"apps","label":"App-Freigaben","before":"je Rolle","after":"alle Apps lesen und schreiben (Migration 058, neue App-Adressen)"}]'::jsonb);

-- App-Nutzung: neue Pfade und Prüfbedingung.
ALTER TABLE platform.app_usage DROP CONSTRAINT app_usage_app_path_check;
UPDATE platform.app_usage SET app_path=pg_temp.rename_app(app_path);
ALTER TABLE platform.app_usage ADD CONSTRAINT app_usage_app_path_check CHECK(app_path IN ('/','/hilfe','/servicehub','/casedesk','/planboard','/dutyboard','/maildesk','/taskhub','/missioncontrol','/benutzerkonto','/einstellungen'));
