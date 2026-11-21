-- Korrektur zu Migration 058 (Entscheidung 21.11.2026): Die Standardrolle „Lesezugriff“ bleibt eine Nur-Lese-Rolle
-- (alle Apps sichtbar, kein Schreibrecht), damit es weiterhin eine echte Nur-Lese-Rolle gibt. Damit vorerst trotzdem
-- jedes Konto alles lesen und schreiben darf, wechseln alle Konten mit „Lesezugriff“ zu „Disposition“.
UPDATE platform.app_roles SET
 apps='["/","/servicehub","/casedesk","/planboard","/dutyboard","/maildesk","/taskhub","/missioncontrol","/benutzerkonto","/hilfe"]'::jsonb,
 write_apps='[]'::jsonb,version=version+1
WHERE id='reader';
-- Rollenänderung: nur die umgestellten Konten verlieren ihre Sitzungen.
WITH moved AS (UPDATE platform.users SET role='dispatcher',version=version+1,updated_at=now() WHERE role='reader' AND app_role_id IS NULL RETURNING id)
UPDATE platform.sessions SET revoked_at=now() WHERE revoked_at IS NULL AND user_id IN (SELECT id FROM moved);
INSERT INTO platform.audit_events(actor_id,action,target_id,changes) VALUES('system','app-role.migration','059',
 '[{"field":"role","label":"Standardrolle","before":"Lesezugriff mit Schreibrecht (058)","after":"Lesezugriff nur lesen; Konten mit Lesezugriff auf Disposition umgestellt"}]'::jsonb);
