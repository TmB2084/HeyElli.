import {spawnSync} from 'node:child_process';
import {cp, mkdtemp, readFile, realpath, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname, isAbsolute, join, relative, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

// Only source and installed dependencies: never copy .env, .local or .next.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const expectedNode = (await readFile(join(root, '.node-version'), 'utf8')).trim();
if (process.version !== expectedNode) {
  throw new Error(`Für die Prüfung wird Node ${expectedNode} benötigt.`);
}

const directory = await mkdtemp(join(tmpdir(), 'heyelli-check-'));
try {
  for (const name of [
    'src', 'public', 'database', 'scripts', 'tests', 'node_modules',
    'package.json', 'package-lock.json', 'tsconfig.json', 'next.config.ts',
    'eslint.config.mjs', '.node-version',
  ]) {
    // Default cp() rewrites relative links to the source directory. That makes
    // npm run Next/React from two installations and breaks prerendering.
    await cp(join(root, name), join(directory, name), {
      recursive: true,
      verbatimSymlinks: true,
    });
  }

  // Fail before running tools if a copied executable still leaves this copy.
  for (const executable of ['next', 'eslint', 'tsc']) {
    const target = await realpath(join(directory, 'node_modules', '.bin', executable));
    const path = relative(await realpath(directory), target);
    if (isAbsolute(path) || path === '..' || path.startsWith('../')) {
      throw new Error(`Das Prüfwerkzeug ${executable} liegt außerhalb der Prüfkopie.`);
    }
  }

  // A fresh copy needs Next's generated route types before the separate tsc run.
  for (const command of ['lint', 'build', 'typecheck']) {
    const result = spawnSync('npm', ['run', command], {
      cwd: directory,
      stdio: 'inherit',
      env: {...process.env, NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1'},
    });
    if (result.error) throw result.error;
    if (result.status !== 0) {
      process.exitCode = result.status ?? 1;
      break;
    }
  }
} finally {
  await rm(directory, {recursive: true, force: true});
}
