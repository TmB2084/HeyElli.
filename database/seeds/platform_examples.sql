-- Explicit, fictional local example accounts. No passwords are stored here:
-- Start passwords are issued by an administrator (Einstellungen → Benutzer & Zugriff) or via npm run auth:admin.
INSERT INTO platform.users (id, display_name, role, enabled, username) VALUES
  ('demo-ad:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Alex Beispiel', 'admin', true, 'alex'),
  ('demo-ad:bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Kim Muster', 'dispatcher', true, 'kim'),
  ('local-service-user', 'Lokaler Servicebenutzer', 'dispatcher', true, 'service')
ON CONFLICT (id) DO NOTHING;
-- Existing example accounts receive their username once; changed usernames stay untouched.
UPDATE platform.users u SET username=v.username FROM (VALUES
  ('demo-ad:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','alex'),('demo-ad:bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','kim'),('local-service-user','service')
) AS v(id,username) WHERE u.id=v.id AND u.username IS NULL AND NOT EXISTS (SELECT 1 FROM platform.users o WHERE o.username=v.username);
-- PDS users of the simulator source (fictional employees from the PDS simulator), only where nothing is assigned yet.
INSERT INTO platform.pds_user_mappings (workspace_id, user_id, pds_user_uuid) VALUES
  ('00000000-0000-4000-8000-000000000001', 'demo-ad:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'sim-employee-1'),
  ('00000000-0000-4000-8000-000000000001', 'demo-ad:bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'sim-employee-2'),
  ('00000000-0000-4000-8000-000000000001', 'local-service-user', 'sim-employee-4')
ON CONFLICT DO NOTHING;
