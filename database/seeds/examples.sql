INSERT INTO service_catalog.services (id, slug, name, description, status)
VALUES
  ('00000000-0000-4000-8000-000000000001', 'it-support', 'IT-Support', 'Beispielservice für technische Unterstützung.', 'available'),
  ('00000000-0000-4000-8000-000000000002', 'raumservice', 'Raumservice', 'Beispielservice für Räume und Ausstattung.', 'available'),
  ('00000000-0000-4000-8000-000000000003', 'onboarding', 'Onboarding', 'Beispielservice für einen strukturierten Einstieg.', 'planned')
ON CONFLICT (id) DO NOTHING;
