/**
 * Build script: bundle discovery scheduled Functions into `.deploy/` for Firebase upload.
 * Externalizes firebase-admin / firebase-functions; workspace packages are inlined.
 */
import { build } from 'esbuild';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const deployDir = join(root, '.deploy');
const outfile = join(deployDir, 'index.js');

rmSync(deployDir, { recursive: true, force: true });
mkdirSync(deployDir, { recursive: true });

await build({
  absWorkingDir: root,
  entryPoints: [join(root, 'src', 'index.ts')],
  outfile,
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  sourcemap: true,
  packages: 'bundle',
  conditions: ['development'],
  external: [
    'firebase-admin',
    'firebase-admin/*',
    'firebase-functions',
    'firebase-functions/*',
  ],
  logLevel: 'info',
});

writeFileSync(
  join(deployDir, 'package.json'),
  `${JSON.stringify(
    {
      name: 'functions-discovery',
      private: true,
      type: 'module',
      engines: { node: '22' },
      main: 'index.js',
      dependencies: {
        'firebase-admin': '^13.4.0',
        'firebase-functions': '^6.4.0',
      },
    },
    null,
    2,
  )}\n`,
);

process.stdout.write(`Built Firebase upload root at ${deployDir}\n`);
