/**
 * Build script: bundle discovery scheduled Functions into `.deploy/` for Firebase upload.
 * Externalizes firebase-admin / firebase-functions; workspace packages are inlined.
 * Copies domain adapter fixtures so fixture-mode dispatch works in Cloud Functions
 * (DISCOVERY_REPO_ROOT → upload root).
 */
import { build } from 'esbuild';
import { cpSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = join(root, '..');
const deployDir = join(root, '.deploy');
const outfile = join(deployDir, 'index.js');

const FIXTURE_RELATIVE_PATHS = [
  'packages/domain/src/adapters/rss/fixtures/historical-society-feed.rss.xml',
  'packages/domain/src/adapters/rss/fixtures/the-american-blackstory.trimmed.rss.xml',
  'packages/domain/src/adapters/internet-archive/fixtures/advanced-search-response.json',
  'packages/domain/src/adapters/dpla/fixtures/search-response-current-shape.json',
  'packages/domain/src/adapters/web-search/fixtures/brave-search-response.json',
  'packages/schemas/constitution/policy.v1.json',
  'packages/schemas/constitution/product-constitution.schema.json',
];

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
  banner: {
    js: "import { dirname as __dsDirname } from 'node:path'; import { fileURLToPath as __dsFileURLToPath } from 'node:url'; process.env.DISCOVERY_REPO_ROOT ??= __dsDirname(__dsFileURLToPath(import.meta.url));",
  },
  external: [
    'firebase-admin',
    'firebase-admin/*',
    'firebase-functions',
    'firebase-functions/*',
  ],
  logLevel: 'info',
});

for (const relative of FIXTURE_RELATIVE_PATHS) {
  const from = join(repoRoot, relative);
  const to = join(deployDir, relative);
  mkdirSync(dirname(to), { recursive: true });
  cpSync(from, to);
}

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

execFileSync('npm', ['install', '--omit=dev', '--no-fund', '--no-audit'], {
  cwd: deployDir,
  stdio: 'inherit',
  env: { ...process.env, npm_config_update_notifier: 'false' },
});

process.stdout.write(`Built Firebase upload root at ${deployDir}\n`);
