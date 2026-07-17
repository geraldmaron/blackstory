
/**
 * Runs Node.js test files for @black-book/testing by layer.
 * Usage: node scripts/run-testing-layer.mjs <layer>
 * Layers: unit | contract | security | a11y | release-gates | integration | migration | e2e | all | coverage
 */
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertTestsCannotAccessProduction } from '../packages/testing/src/guards/production.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const testingSrc = join(root, 'packages', 'testing', 'src');

assertTestsCannotAccessProduction(process.env);

const layer = process.argv[2] ?? 'all';

/** @type {Record<string, (file: string) => boolean>} */
const matchers = {
  unit: (file) =>
    /(utilities|ids|builders\/builders)\.test\.ts$/.test(file) ||
    /guards\/production\.test\.ts$/.test(file) ||
    /quarantine\/registry\.test\.ts$/.test(file),
  contract: (file) => /contract\/.*\.test\.ts$/.test(file),
  security: (file) =>
    /(?:security|load-abuse|adversarial-integrity)\/.*\.test\.ts$/.test(file) ||
    /guards\/production\.test\.ts$/.test(file),
  a11y: (file) => /a11y\/.*\.test\.ts$/.test(file),
  'release-gates': (file) => /(?:release-gates|launch-gate)\/.*\.test\.ts$/.test(file),
  integration: (file) => /\.integration\.test\.ts$/.test(file),
  migration: (file) => /migration\/.*\.test\.ts$/.test(file),
  e2e: (file) => /e2e\/.*\.test\.ts$/.test(file),
  all: () => true,
  coverage: () => true,
};

function collectTests(dir = testingSrc, acc = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      collectTests(full, acc);
      continue;
    }
    if (entry.name.endsWith('.test.ts')) {
      acc.push(full);
    }
  }
  return acc;
}

const matcher = matchers[layer];
if (!matcher) {
  console.error(`Unknown layer "${layer}". Expected: ${Object.keys(matchers).join(', ')}`);
  process.exit(2);
}

const files = collectTests()
  .filter((file) => matcher(relative(testingSrc, file).replaceAll('\\', '/')))
  .sort();

if (files.length === 0) {
  console.error(`No test files matched layer "${layer}"`);
  process.exit(2);
}

const coverage = layer === 'coverage';
const args = [
  '--conditions',
  'development',
  '--import',
  'tsx',
  '--test',
  ...(coverage
    ? [
        '--experimental-test-coverage',
        '--test-coverage-include=packages/testing/src/**',
        '--test-coverage-exclude=packages/testing/src/**/*.test.ts',
        '--test-coverage-lines=70',
        '--test-coverage-functions=70',
        '--test-coverage-branches=60',
      ]
    : []),
  ...files,
];

console.log(`Running testing layer="${layer}" (${files.length} files)`);
const result = spawnSync(process.execPath, args, {
  cwd: root,
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: process.env.NODE_ENV ?? 'test',
  },
});

process.exit(result.status ?? 1);
