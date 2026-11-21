import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const command = process.argv[2];
const commands = {
  up: ['up', '-d', '--wait', 'db'],
  down: ['down'],
};
function compose(args, input) {
  const result = spawnSync('docker', ['compose', ...args], {
    cwd: root, input, encoding: 'utf8',
    stdio: input === undefined ? 'inherit' : ['pipe', 'inherit', 'inherit'],
  });
  if (result.error) console.error(result.error.message);
  if (result.error || result.status !== 0) process.exit(result.status || 1);
}
function sql(input) {
  compose(['exec', '-T', 'db', 'sh', '-c',
    'exec psql -X -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"'], input);
}
const composeCheck = spawnSync('docker', ['compose', 'version'], { cwd: root, stdio: 'ignore' });
if (composeCheck.error || composeCheck.status !== 0) {
  console.error('Docker Compose v2 ist nicht verfügbar. Bitte Docker mit Compose-Plugin installieren; siehe README.md.');
  process.exit(1);
}

if (commands[command]) {
  compose(commands[command]);
} else if (command === 'migrate') {
  const directory = new URL('../database/migrations/', import.meta.url);
  const files = readdirSync(directory).filter((file) => /^\d+_[a-z0-9_]+\.sql$/.test(file)).sort();
  let script = `BEGIN;
SELECT pg_advisory_xact_lock(741963281);
CREATE TABLE IF NOT EXISTS public.schema_migrations (
  name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now()
);
`;
  for (const file of files) {
    const content = readFileSync(new URL(file, directory), 'utf8');
    const checksum = createHash('sha256').update(content).digest('hex');
    script += `
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.schema_migrations WHERE name = '${file}' AND checksum <> '${checksum}') THEN
    RAISE EXCEPTION 'Bereits ausgeführte Migration verändert: ${file}';
  END IF;
END $$;
SELECT NOT EXISTS (SELECT 1 FROM public.schema_migrations WHERE name = '${file}') AS pending \\gset
\\if :pending
${content}
INSERT INTO public.schema_migrations (name, checksum) VALUES ('${file}', '${checksum}');
\\endif
`;
  }
  sql(`${script}\nCOMMIT;\n`);
} else if (command === 'verify') {
  sql(`DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.schema_migrations WHERE name = '001_service_catalog.sql') THEN
      RAISE EXCEPTION 'Die Servicekatalog-Migration fehlt';
    END IF;
    IF (SELECT count(*) FROM service_catalog.services WHERE id IN (
      '00000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000002',
      '00000000-0000-4000-8000-000000000003'
    )) <> 3 THEN
      RAISE EXCEPTION 'Die drei Beispieldatensätze sind nicht vollständig vorhanden';
    END IF;
  END $$;
  SELECT name, applied_at FROM public.schema_migrations ORDER BY name;
  SELECT slug, name, status FROM service_catalog.services ORDER BY slug;
`);
} else if (command === 'seed') {
  sql(`BEGIN;\nSELECT pg_advisory_xact_lock(741963281);\n${['examples.sql','platform_examples.sql'].map(file=>readFileSync(new URL('../database/seeds/'+file, import.meta.url), 'utf8')).join('\n')}\nCOMMIT;\n`);
} else {
  console.error('Aufruf: node scripts/database.mjs up|down|migrate|seed|verify');
  process.exit(1);
}
